import io
import json
from pathlib import Path
from zipfile import ZipFile

import studyscribe.app as app_module
from studyscribe.core import config
from studyscribe.services import jobs
from studyscribe.services.gemini import AnswerOutput, NotesOutput


def _create_module(client, name="Sprint2 Module"):
    response = client.post("/modules", data={"name": name})
    assert response.status_code == 302
    return response.headers["Location"].split("/")[-1]


def _create_session(client, module_id, name="Sprint2 Session"):
    response = client.post(f"/modules/{module_id}/sessions", data={"name": name})
    assert response.status_code == 302
    return response.headers["Location"].split("/")[-1].split("?")[0]


def test_generate_notes_flow(app_client, monkeypatch):
    module_id = _create_module(app_client)
    session_id = _create_session(app_client, module_id)
    session_dir = config.DATA_DIR / "modules" / module_id / "sessions" / session_id
    transcript_dir = session_dir / "transcript"
    transcript_dir.mkdir(parents=True, exist_ok=True)
    transcript_path = transcript_dir / "transcript.json"
    transcript_path.write_text(
        json.dumps([{"segment_id": 0, "start": 0.0, "end": 1.0, "text": "hello", "tags": []}])
    )

    def fake_generate(prompt):
        return NotesOutput(
            summary="Summary",
            suggested_tags=["EXAM-SIGNAL"],
            notes_markdown="# Notes\n\n- Point",
        )

    monkeypatch.setattr(app_module, "generate_notes", fake_generate)
    monkeypatch.setattr(jobs, "RUN_JOBS_INLINE", True)

    response = app_client.post(
        f"/modules/{module_id}/sessions/{session_id}/generate-notes",
        headers={"Accept": "application/json"},
    )
    assert response.status_code == 200
    payload = response.get_json()
    assert "job_id" in payload

    notes_response = app_client.get(
        f"/modules/{module_id}/sessions/{session_id}/ai-notes", headers={"Accept": "application/json"}
    )
    assert notes_response.status_code == 200
    notes_payload = notes_response.get_json()
    assert "Notes" in notes_payload["notes"]


def test_api_ai_ask_flow(app_client, monkeypatch):
    module_id = _create_module(app_client)
    session_id = _create_session(app_client, module_id)
    session_dir = config.DATA_DIR / "modules" / module_id / "sessions" / session_id
    transcript_dir = session_dir / "transcript"
    transcript_dir.mkdir(parents=True, exist_ok=True)
    transcript_path = transcript_dir / "transcript.json"
    transcript_path.write_text(
        json.dumps([{"segment_id": 0, "start": 0.0, "end": 1.0, "text": "hello", "tags": []}])
    )

    def fake_answer(prompt, sources):
        return AnswerOutput(answer="Answer", answer_markdown="Answer", sources=sources)

    monkeypatch.setattr(app_module, "answer_question", fake_answer)

    response = app_client.post(
        "/api/ai/ask",
        json={"session_id": session_id, "question": "What?", "scope": "session"},
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data["answer"] == "Answer"
    assert "sources" in data

    messages = app_client.get(f"/api/sessions/{session_id}/ai/messages")
    assert messages.status_code == 200
    messages_payload = messages.get_json()
    assert len(messages_payload["messages"]) == 2


def test_export_pack(app_client):
    module_id = _create_module(app_client)
    session_id = _create_session(app_client, module_id)
    session_dir = config.DATA_DIR / "modules" / module_id / "sessions" / session_id
    transcript_dir = session_dir / "transcript"
    transcript_dir.mkdir(parents=True, exist_ok=True)
    (transcript_dir / "transcript.txt").write_text("hello")
    audio_dir = session_dir / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    (audio_dir / "lecture.wav").write_text("audio")

    response = app_client.post(
        f"/modules/{module_id}/sessions/{session_id}/export",
        data={"include_transcript": "1", "include_audio": "1"},
    )
    assert response.status_code == 200
    assert response.mimetype == "application/zip"
    zip_bytes = io.BytesIO(response.data)
    with ZipFile(zip_bytes) as zip_file:
        names = zip_file.namelist()
        assert any(name.endswith("manifest.json") for name in names)
