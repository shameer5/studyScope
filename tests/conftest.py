import io
import sys
import wave
from pathlib import Path

import pytest

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from studyscribe import app as app_module  # noqa: E402


def _make_wav_bytes(duration_seconds: int = 1, frame_rate: int = 16000) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(frame_rate)
        frames = b"\x00\x00" * frame_rate * duration_seconds
        wav_file.writeframes(frames)
    return buffer.getvalue()


@pytest.fixture()
def app_client(tmp_path):
    data_dir = tmp_path / "data"
    db_path = tmp_path / "studyscribe.db"
    app = app_module.create_app(testing=True, data_dir=data_dir, db_path=db_path)
    with app.test_client() as client:
        yield client


@pytest.fixture()
def sample_wav_bytes():
    return _make_wav_bytes()
