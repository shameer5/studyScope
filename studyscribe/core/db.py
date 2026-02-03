"""SQLite helpers and schema for StudyScribe."""

from __future__ import annotations

import sqlite3
from contextlib import closing
from typing import Iterable

from .config import DB_PATH


SCHEMA: Iterable[str] = (
    """
    CREATE TABLE IF NOT EXISTS modules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        module_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(module_id) REFERENCES modules(id)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        progress INTEGER NOT NULL,
        message TEXT,
        result_path TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS session_summaries (
        session_id TEXT PRIMARY KEY,
        content_hash TEXT NOT NULL,
        summary TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(session_id) REFERENCES sessions(id)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS module_summaries (
        module_id TEXT PRIMARY KEY,
        content_hash TEXT NOT NULL,
        summary TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(module_id) REFERENCES modules(id)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS ai_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(session_id) REFERENCES sessions(id)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS ai_message_sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER NOT NULL,
        source_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        label TEXT NOT NULL,
        snippet TEXT,
        session_name TEXT,
        url TEXT,
        source_json TEXT,
        FOREIGN KEY(message_id) REFERENCES ai_messages(id)
    );
    """,
)


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with closing(get_connection()) as conn:
        for statement in SCHEMA:
            conn.execute(statement)
        conn.commit()


def execute(query: str, params: tuple | list = ()) -> None:
    with closing(get_connection()) as conn:
        conn.execute(query, params)
        conn.commit()


def execute_returning_id(query: str, params: tuple | list = ()) -> int:
    with closing(get_connection()) as conn:
        cursor = conn.execute(query, params)
        conn.commit()
        if cursor.lastrowid is None:
            raise ValueError("No row was inserted; cannot return lastrowid")
        return int(cursor.lastrowid)


def fetch_one(query: str, params: tuple | list = ()) -> sqlite3.Row | None:
    with closing(get_connection()) as conn:
        cursor = conn.execute(query, params)
        return cursor.fetchone()


def fetch_all(query: str, params: tuple | list = ()) -> list[sqlite3.Row]:
    with closing(get_connection()) as conn:
        cursor = conn.execute(query, params)
        return list(cursor.fetchall())
