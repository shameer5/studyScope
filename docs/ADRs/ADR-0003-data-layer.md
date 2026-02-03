# ADR-0003: Data Persistence Architecture (SQLite + Local Filesystem)

Date: 2024-01-15  
Status: Accepted  
Deciders: Architecture Team  

## Context

StudyScribe must store two categories of data:
1. **Relational state**: modules, sessions, jobs, AI messages, summaries.
2. **Artifacts**: audio files, transcripts, notes, attachments.

Key requirements:
- Zero external infrastructure (no database server).
- Fast read/write for session metadata.
- Large file support (audio files, PDFs).
- Local inspection and backup.
- Simple schema evolution (early product stages).

## Decision

**Use SQLite for relational state and local filesystem for artifacts. Store both under a single `DATA_DIR` for co-location and easy backup.**

### Rationale:
- **SQLite**: single-file, zero-config, ACID semantics, suitable for local deployments. No separate DB server process needed.
- **Filesystem**: native support for large files; filesystem permissions provide basic access control; easy to inspect/backup.
- **Co-location**: `DATA_DIR` in `studyscribe/core/config.py` houses both `studyscribe.db` (`DB_PATH`) and per-module/session directories under `modules/<module_id>/sessions/<session_id>/`. Simplifies backup: `tar czvf backup.tar.gz $DATA_DIR`.

## Evidence in Codebase

- Database schema: `studyscribe/core/db.py` defines `SCHEMA` with tables: `modules`, `sessions`, `jobs`, `ai_messages`, `ai_message_sources`, `session_summaries`, `module_summaries`.
- DB helpers: `studyscribe/core/db.py` implements `init_db()`, `get_connection()`, `execute()`, `fetch_all()`, `fetch_one()`, `execute_returning_id()`.
- File paths: `studyscribe/core/config.py` defines `DATA_DIR` and `DB_PATH`; `studyscribe/app.py` helpers `_module_dir()` and `_session_dir()` construct session paths.
- Artifact storage: `studyscribe/services/audio.py` `save_audio()` writes to `session_dir/audio/`.
- Transcripts: `studyscribe/services/transcribe.py` `transcribe_audio()` writes `session_dir/transcript/transcript.json` and `session_dir/transcript/chunks.json`.
- Notes: `studyscribe/services/export.py` expects `session_dir/notes/` directory.

## Alternatives Considered

1. **PostgreSQL + S3**
   - Pros: scalable, distributed, managed cloud options available.
   - Cons: requires external infrastructure, network latency, API costs, vendor lock-in, complex backup/restore.
   - Rejected: violates local-first design; adds deployment complexity.

2. **MongoDB (document DB)**
   - Pros: schema-flexible, good for nested data.
   - Cons: requires separate server or Atlas; not local-first; less suitable for relational queries (modules ↔ sessions).
   - Rejected: relational model is a good fit; local-first precludes managed MongoDB.

3. **File-based state (JSON/YAML)**
   - Pros: human-readable, versionable.
   - Cons: no ACID guarantees; concurrent writes unsafe; difficult queries (filtering modules, counting jobs); schema versioning complex.
   - Rejected: poor for concurrent reads/writes and complex queries.

4. **Hybrid: embedded DB (RocksDB, LMDB)**
   - Pros: high-performance key-value; local.
   - Cons: no SQL interface; schema changes require code updates; less mature than SQLite.
   - Rejected: SQLite is more battle-tested and has SQL/transaction support needed.

## Consequences

### Positive:
- **Simplicity**: single `DATA_DIR` for complete backup/restore. No external DB credentials or network calls needed.
- **Local inspection**: `sqlite3 studyscribe.db` allows direct SQL queries for debugging.
- **Fast iteration**: schema changes via `_ensure_column()` in `studyscribe/core/db.py` (simple add-column migrations).
- **Privacy**: all data stays on user's machine; no cloud dependencies.

### Negative:
- **Scaling**: SQLite is single-writer; concurrent app instances require shared DB (PostgreSQL). See `docs/10-Deployment-and-Ops.md` scaling limitations.
- **File storage limitations**: no built-in replication, no distributed file system support for HA deployments.
- **Large files**: filesystem I/O for audio/transcripts is slower than streaming from object storage (S3, GCS); not optimized for concurrent reads.
- **Backup**: requires external backup job or manual tar/rsync; no built-in disaster recovery.

## Schema Evolution Strategy

- **Versions**: `SCHEMA` in `studyscribe/core/db.py` is the source of truth; `init_db()` idempotently initializes on app startup.
- **Migrations**: `_ensure_column()` handles simple column additions (e.g., `source_json` in `ai_message_sources`).
- **Complex migrations**: for renames, drops, or major rewrites, manual SQL steps required (stop app, run ALTER TABLE, restart).

## Migration Path (if needed in future)

To migrate to PostgreSQL or cloud storage:
1. Implement a database abstraction layer in `studyscribe/core/db.py` (interface-based design).
2. Add PostgreSQL backend as an alternative implementation.
3. Implement S3-backed file storage (for `DATA_DIR` artifacts).
4. Add data migration tools (export from local SQLite → PostgreSQL, upload artifacts to S3).

## Recommendations

- **Backup discipline**: implement cron job to snapshot `DATA_DIR` daily (see `docs/10-Deployment-and-Ops.md`).
- **Monitoring**: track `DATA_DIR` disk usage and alert at 80% full (to avoid transcription failures).
- **Access control**: ensure file permissions on `DATA_DIR` are restrictive (700: owner only).
- **Archival**: consider periodic `tar.gz` exports for long-term storage; include `manifest.json` for metadata.
