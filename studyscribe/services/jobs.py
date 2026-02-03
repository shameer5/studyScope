"""Background job helpers."""

from __future__ import annotations

import atexit
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import logging
import os
import traceback
from typing import Callable, Any
from uuid import uuid4

from studyscribe.core import db


_LOGGER = logging.getLogger(__name__)

RUN_JOBS_INLINE = False


def _resolve_max_workers() -> int:
    raw = os.getenv("JOBS_MAX_WORKERS", "2")
    try:
        value = int(raw)
    except ValueError:
        _LOGGER.warning("Invalid JOBS_MAX_WORKERS=%r; falling back to 2", raw)
        return 2
    return max(1, value)


_EXECUTOR = ThreadPoolExecutor(max_workers=_resolve_max_workers())


def _warn_if_queue_deep() -> None:
    raw = os.getenv("JOBS_QUEUE_WARN", "0")
    try:
        threshold = int(raw)
    except ValueError:
        _LOGGER.warning("Invalid JOBS_QUEUE_WARN=%r; disabling queue warnings", raw)
        return
    if threshold <= 0:
        return
    queue = getattr(_EXECUTOR, "_work_queue", None)
    if queue is None:
        return
    # _work_queue is an internal attribute; guard against missing/unsupported versions.
    try:
        size = queue.qsize()
    except Exception:  # noqa: BLE001
        return
    if size >= threshold:
        _LOGGER.warning("Job queue depth %s exceeds warning threshold %s", size, threshold)


def _shutdown_executor() -> None:
    _EXECUTOR.shutdown(wait=False)


atexit.register(_shutdown_executor)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_job(message: str | None = None) -> str:
    job_id = str(uuid4())
    now = _now_iso()
    db.execute(
        """
        INSERT INTO jobs (id, status, progress, message, result_path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (job_id, "queued", 0, message, None, now, now),
    )
    return job_id


def update_job(
    job_id: str,
    *,
    status: str | None = None,
    progress: int | None = None,
    message: str | None = None,
    result_path: str | None = None,
) -> None:
    fields = []
    params: list[Any] = []
    if status is not None:
        fields.append("status = ?")
        params.append(status)
    if progress is not None:
        fields.append("progress = ?")
        params.append(progress)
    if message is not None:
        fields.append("message = ?")
        params.append(message)
    if result_path is not None:
        fields.append("result_path = ?")
        params.append(result_path)
    fields.append("updated_at = ?")
    params.append(_now_iso())
    params.append(job_id)
    db.execute(f"UPDATE jobs SET {', '.join(fields)} WHERE id = ?", tuple(params))


def get_job(job_id: str) -> dict | None:
    row = db.fetch_one("SELECT * FROM jobs WHERE id = ?", (job_id,))
    if not row:
        return None
    return dict(row)


def enqueue_job(job_id: str, target: Callable[..., str], *args, **kwargs) -> None:
    def _run() -> None:
        update_job(job_id, status="in_progress", progress=0, message="Starting job...")

        def progress_cb(progress: int, message: str | None = None) -> None:
            update_job(job_id, progress=progress, message=message)

        try:
            result_path = target(*args, progress_cb=progress_cb, **kwargs)
            update_job(job_id, status="success", progress=100, message="Completed.", result_path=result_path)
        except Exception as exc:  # noqa: BLE001
            message = getattr(exc, "user_message", "Job failed.")
            update_job(job_id, status="error", message=message)
            _LOGGER.exception("Job %s failed: %s", job_id, exc)
            traceback.print_exc()

    if RUN_JOBS_INLINE:
        _run()
    else:
        _warn_if_queue_deep()
        _EXECUTOR.submit(_run)
