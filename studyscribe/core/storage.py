"""Filesystem helpers for StudyScribe."""

from __future__ import annotations

import logging
import os
import shutil
from pathlib import Path


_LOGGER = logging.getLogger(__name__)
_DEFAULT_MIN_FREE_PERCENT = 5.0
_DEFAULT_MIN_FREE_MB = 0
_DEFAULT_WARN_PERCENT = 80.0
_WARNED_USAGE = False


class StorageError(RuntimeError):
    def __init__(self, message: str, user_message: str | None = None) -> None:
        super().__init__(message)
        self.user_message = user_message or message


def ensure_private_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)
    _set_private_permissions(path)


def _set_private_permissions(path: Path) -> None:
    if os.name != "posix":
        return
    try:
        path.chmod(0o700)
    except PermissionError:
        _LOGGER.warning("Unable to set permissions on %s", path)


def _parse_env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = float(raw)
    except ValueError:
        _LOGGER.warning("Invalid %s=%r; using default %.2f", name, raw, default)
        return default
    if value < 0:
        return 0.0
    return value


def _parse_env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError:
        _LOGGER.warning("Invalid %s=%r; using default %d", name, raw, default)
        return default
    if value < 0:
        return 0
    return value


def check_disk_space(path: Path) -> None:
    """Raise StorageError when disk space falls below configured thresholds."""
    global _WARNED_USAGE
    # Thresholds are environment-tunable to match deployment storage constraints.
    min_free_percent = _parse_env_float("DATA_DIR_MIN_FREE_PERCENT", _DEFAULT_MIN_FREE_PERCENT)
    min_free_mb = _parse_env_int("DATA_DIR_MIN_FREE_MB", _DEFAULT_MIN_FREE_MB)
    warn_percent = _parse_env_float("DATA_DIR_WARN_PERCENT", _DEFAULT_WARN_PERCENT)
    if min_free_percent <= 0 and min_free_mb <= 0:
        min_free_percent = 0.0
        min_free_mb = 0
    try:
        usage = shutil.disk_usage(path)
    except FileNotFoundError:
        return
    free_mb = usage.free / (1024 * 1024)
    free_percent = (usage.free / usage.total * 100) if usage.total else 0.0
    used_percent = 100.0 - free_percent
    # Warn once to avoid flooding logs on repeated uploads.
    if warn_percent > 0 and used_percent >= warn_percent and not _WARNED_USAGE:
        _LOGGER.warning(
            "DATA_DIR usage high: %.1f%% used (free %.0f MB).", used_percent, free_mb
        )
        _WARNED_USAGE = True
    if free_mb < min_free_mb or free_percent < min_free_percent:
        message = (
            f"Insufficient disk space in {path}. "
            f"Free {free_mb:.0f} MB ({free_percent:.1f}%)."
        )
        raise StorageError(
            message,
            user_message=(
                "Insufficient disk space to save files. "
                "Free up space or move DATA_DIR to a larger volume."
            ),
        )
