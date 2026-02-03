import io
import json
from pathlib import Path

import studyscribe.app as app_module
from studyscribe.core import config
from studyscribe.services import jobs


def _create_module(client, name="Test Module"):
    response = client.post("/modules", data={"name": name})
    assert response.status_code == 302
    module_id = response.headers["Location"].split("/")[-1]
    return module_id


def _create_session(client, module_id, name="Session 1"):
    response = client.post(f"/modules/{module_id}/sessions", data={"name": name})
    assert response.status_code == 302
    session_id = response.headers["Location"].split("/")[-1].split("?")[0]
    return session_id


def test_create_module_and_session(app_client):
    module_id = _create_module(app_client)
    session_id = _create_session(app_client, module_id)
    response = app_client.get(f"/sessions/{session_id}")
    assert response.status_code == 200
    assert b"Session 1" in response.data


def test_upload_audio(app_client, sample_wav_bytes):
    module_id = _create_module(app_client)
    session_id = _create_session(app_client, module_id)
    response = app_client.post(
        f"/modules/{module_id}/sessions/{session_id}/upload-audio",
        data={"audio": (io.BytesIO(sample_wav_bytes), "lecture.wav")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 302
    audio_path = config.DATA_DIR / "modules" / module_id / "sessions" / session_id / "audio" / "lecture.wav"
    assert audio_path.exists()


def test_start_transcription_job(app_client, sample_wav_bytes, monkeypatch):
    module_id = _create_module(app_client)
    session_id = _create_session(app_client, module_id)
    app_client.post(
        f"/modules/{module_id}/sessions/{session_id}/upload-audio",
        data={"audio": (io.BytesIO(sample_wav_bytes), "lecture.wav")},
        content_type="multipart/form-data",
    )

    def fake_transcribe(audio_path, session_dir, progress_cb=None):
        transcript_dir = Path(session_dir) / "transcript"
        transcript_dir.mkdir(parents=True, exist_ok=True)
        transcript_path = transcript_dir / "transcript.json"
        transcript_path.write_text(json.dumps([{"segment_id": 0, "start": 0.0, "end": 1.0, "text": "hello", "tags": []}]))
        return str(transcript_path)

    monkeypatch.setattr(app_module, "transcribe_audio", fake_transcribe)
    monkeypatch.setattr(jobs, "RUN_JOBS_INLINE", True)

    response = app_client.post(f"/modules/{module_id}/sessions/{session_id}/transcribe")
    assert response.status_code == 302
    location = response.headers["Location"]
    assert "job_id=" in location
    job_id = location.split("job_id=")[-1]

    job_response = app_client.get(f"/jobs/{job_id}")
    assert job_response.status_code == 200
    payload = job_response.get_json()
    assert payload["status"] == "success"
    assert payload["result"].endswith("transcript.json")
    transcript_path = config.DATA_DIR / "modules" / module_id / "sessions" / session_id / "transcript" / "transcript.json"
    assert transcript_path.exists()
