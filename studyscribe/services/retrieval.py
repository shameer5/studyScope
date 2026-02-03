"""Transcript chunking and lightweight retrieval helpers."""

from __future__ import annotations

import math
import re
from collections import Counter
from typing import Iterable


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-zA-Z0-9]+", text.lower())


def build_chunks(segments: Iterable[dict], max_chars: int = 1200, overlap: int = 1) -> list[dict]:
    chunks: list[dict] = []
    buffer: list[dict] = []
    buffer_chars = 0

    def flush() -> None:
        nonlocal buffer, buffer_chars
        if not buffer:
            return
        chunk_text = " ".join(seg["text"].strip() for seg in buffer if seg.get("text"))
        chunk = {
            "id": len(chunks),
            "text": chunk_text,
            "start": buffer[0]["start"],
            "end": buffer[-1]["end"],
            "segment_ids": [seg["segment_id"] for seg in buffer],
        }
        chunks.append(chunk)
        if overlap > 0:
            buffer = buffer[-overlap:]
            buffer_chars = sum(len(seg.get("text", "")) for seg in buffer)
        else:
            buffer = []
            buffer_chars = 0

    for segment in segments:
        if "start" not in segment or "end" not in segment or "segment_id" not in segment:
            raise ValueError("Segment missing required keys: start, end, segment_id")
        text = segment.get("text", "")
        buffer.append(segment)
        buffer_chars += len(text)
        if buffer_chars >= max_chars:
            flush()

    flush()
    return chunks


def retrieve_chunks(query: str, chunks: Iterable[dict], k: int = 8) -> list[dict]:
    tokens = _tokenize(query)
    if not tokens:
        return []
    scores = Counter(tokens)
    scored = []
    for chunk in chunks:
        text_tokens = _tokenize(chunk.get("text", ""))
        if not text_tokens:
            continue
        tf = Counter(text_tokens)
        score = sum(tf[t] * scores[t] for t in scores)
        if score > 0:
            scored.append((score, chunk))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [chunk for _, chunk in scored[:k]]
