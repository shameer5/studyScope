import io
import json
from pathlib import Path

import studyscribe.app as app_module
from studyscribe.core import config
from studyscribe.services import jobs


def _create_module(client, name="Golden Module"):
    response = client.post("/modules", data={"name": name})
    assert response.status_code == 302
    return response.headers["Location"].split("/")[-1]


def _create_session(client, module_id, name="Golden Session"):
    response = client.post(f"/modules/{module_id}/sessions", data={"name": name})
    assert response.status_code == 302
    return response.headers["Location"].split("/")[-1].split("?")[0]


def test_golden_path_sprint1(app_client, sample_wav_bytes, monkeypatch):
    module_id = _create_module(app_client)
    session_id = _create_session(app_client, module_id)

    response = app_client.post(
        f"/modules/{module_id}/sessions/{session_id}/upload-audio",
        data={"audio": (io.BytesIO(sample_wav_bytes), "lecture.wav")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 302

    def fake_transcribe(audio_path, session_dir, progress_cb=None):
        transcript_dir = Path(session_dir) / "transcript"
        transcript_dir.mkdir(parents=True, exist_ok=True)
        transcript_path = transcript_dir / "transcript.json"
        transcript_path.write_text(
            json.dumps(
                [
                    {
                        "segment_id": 0,
                        "start": 0.0,
                        "end": 1.0,
                        "text": "hello",
                        "tags": [],
                    }
                ]
            )
        )
        return str(transcript_path)

    monkeypatch.setattr(app_module, "transcribe_audio", fake_transcribe)
    monkeypatch.setattr(jobs, "RUN_JOBS_INLINE", True)

    response = app_client.post(f"/modules/{module_id}/sessions/{session_id}/transcribe")
    assert response.status_code == 302
    job_id = response.headers["Location"].split("job_id=")[-1]

    job_response = app_client.get(f"/jobs/{job_id}")
    assert job_response.status_code == 200
    job_payload = job_response.get_json()
    assert set(job_payload.keys()) == {"id", "status", "progress", "message", "result"}
    assert job_payload["status"] == "success"

    transcript_response = app_client.get(
        f"/modules/{module_id}/sessions/{session_id}/transcript"
    )
    assert transcript_response.status_code == 200
    transcript_payload = transcript_response.get_json()
    assert transcript_payload["has_transcript"] is True
    assert "html" in transcript_payload

    transcript_path = (
        config.DATA_DIR
        / "modules"
        / module_id
        / "sessions"
        / session_id
        / "transcript"
        / "transcript.json"
    )
    assert transcript_path.exists()
