"""Transcription pipeline using local Whisper (faster_whisper)."""

from __future__ import annotations

import json
import math
import shutil
import subprocess
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from studyscribe.core.config import settings
from .retrieval import build_chunks


class TranscriptionError(RuntimeError):
    def __init__(self, message: str, user_message: str | None = None) -> None:
        super().__init__(message)
        self.user_message = user_message or message


def _ensure_wav(audio_path: Path, work_dir: Path) -> Path:
    work_dir.mkdir(parents=True, exist_ok=True)
    if audio_path.suffix.lower() == ".wav":
        return audio_path
    if not shutil.which("ffmpeg"):
        raise TranscriptionError(
            "ffmpeg not found",
            user_message="ffmpeg is required to convert audio. Install ffmpeg or upload a WAV file.",
        )
    output_path = work_dir / f"{audio_path.stem}.wav"
    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(audio_path),
        "-ac",
        "1",
        "-ar",
        "16000",
        str(output_path),
    ]
    try:
        subprocess.run(command, check=True, capture_output=True)
    except subprocess.CalledProcessError as exc:
        raise TranscriptionError(
            "ffmpeg conversion failed",
            user_message="Could not convert audio to WAV. Please try another file.",
        ) from exc
    return output_path


def _chunk_wav(wav_path: Path, work_dir: Path, chunk_seconds: int) -> list[Path]:
    work_dir.mkdir(parents=True, exist_ok=True)
    chunk_paths: list[Path] = []
    with wave.open(str(wav_path), "rb") as wav_file:
        frame_rate = wav_file.getframerate()
        total_frames = wav_file.getnframes()
        frames_per_chunk = int(frame_rate * chunk_seconds)
        total_chunks = int(math.ceil(total_frames / frames_per_chunk))
        for chunk_index in range(total_chunks):
            chunk_frames = wav_file.readframes(frames_per_chunk)
            if not chunk_frames:
                break
            chunk_path = work_dir / f"chunk_{chunk_index:03d}.wav"
            with wave.open(str(chunk_path), "wb") as chunk_file:
                chunk_file.setnchannels(wav_file.getnchannels())
                chunk_file.setsampwidth(wav_file.getsampwidth())
                chunk_file.setframerate(frame_rate)
                chunk_file.writeframes(chunk_frames)
            chunk_paths.append(chunk_path)
    return chunk_paths


def _load_model():
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise TranscriptionError(
            "faster_whisper not installed",
            user_message="Transcription engine missing. Install faster_whisper to run transcription.",
        ) from exc
    return WhisperModel("base", compute_type="int8")


def _write_transcript_files(transcript_dir: Path, segments: list[dict]) -> Path:
    transcript_dir.mkdir(parents=True, exist_ok=True)
    transcript_path = transcript_dir / "transcript.json"
    with transcript_path.open("w", encoding="utf-8") as handle:
        json.dump(segments, handle, indent=2)
    text_path = transcript_dir / "transcript.txt"
    with text_path.open("w", encoding="utf-8") as handle:
        for seg in segments:
            handle.write(f"[{seg['start']:.2f}-{seg['end']:.2f}] {seg['text']}\n")
    return transcript_path


def transcribe_audio(
    audio_path: Path,
    session_dir: Path,
    *,
    progress_cb=None,
) -> str:
    transcript_dir = session_dir / "transcript"
    work_dir = session_dir / "work" / "chunks"
    wav_path = _ensure_wav(audio_path, session_dir / "work")
    chunk_paths = _chunk_wav(wav_path, work_dir, settings.chunk_seconds)
    if not chunk_paths:
        raise TranscriptionError("No audio data found", user_message="Audio file was empty.")

    model = _load_model()
    segments: list[dict] = []
    segment_id = 0
    total_chunks = len(chunk_paths)
    for chunk_index, chunk_path in enumerate(chunk_paths):
        if progress_cb:
            progress = int(((chunk_index) / total_chunks) * 100)
            progress_cb(progress, f"Transcribing chunk {chunk_index + 1}/{total_chunks}")
        result_segments, _ = model.transcribe(str(chunk_path))
        offset = chunk_index * settings.chunk_seconds
        for seg in result_segments:
            segments.append(
                {
                    "segment_id": segment_id,
                    "start": float(seg.start) + offset,
                    "end": float(seg.end) + offset,
                    "text": seg.text.strip(),
                    "tags": [],
                }
            )
            segment_id += 1

    transcript_path = _write_transcript_files(transcript_dir, segments)
    chunks = build_chunks(segments)
    chunks_path = transcript_dir / "chunks.json"
    with chunks_path.open("w", encoding="utf-8") as handle:
        json.dump(chunks, handle, indent=2)
    if progress_cb:
        progress_cb(100, "Transcription complete.")
    return str(transcript_path)


def load_transcript(transcript_path: Path) -> list[dict]:
    if not transcript_path.exists():
        return []
    try:
        with transcript_path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
    except json.JSONDecodeError:
        return []
    if isinstance(data, list):
        return data
    return []
