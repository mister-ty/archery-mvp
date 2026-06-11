"""Persistencia en SQLite (stdlib): VODs, clips, eventos de pipeline y métricas (Fase 3)."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCHEMA = """
CREATE TABLE IF NOT EXISTS vods (
    id INTEGER PRIMARY KEY,
    hash TEXT UNIQUE NOT NULL,
    src_path TEXT NOT NULL,
    slug TEXT NOT NULL,
    duration REAL,
    width INTEGER,
    height INTEGER,
    fps REAL,
    size_bytes INTEGER,
    status TEXT NOT NULL DEFAULT 'registered',  -- registered|transcribed|detected|done|failed
    probe_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clips (
    id INTEGER PRIMARY KEY,
    vod_id INTEGER NOT NULL REFERENCES vods(id),
    t_start REAL NOT NULL,
    t_end REAL NOT NULL,
    score REAL NOT NULL,
    rank INTEGER,
    status TEXT NOT NULL DEFAULT 'candidate',   -- candidate|approved|rejected|published
    signals_json TEXT,
    hook_text TEXT,
    title TEXT,
    description TEXT,
    hashtags TEXT,
    output_path TEXT,
    rejected_reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY,
    vod_id INTEGER,
    clip_id INTEGER,
    stage TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Fase 3: rendimiento por clip y plataforma; el schema existe desde ya para trazabilidad
CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY,
    clip_id INTEGER NOT NULL REFERENCES clips(id),
    platform TEXT NOT NULL DEFAULT 'tiktok',
    views INTEGER, likes INTEGER, comments INTEGER, shares INTEGER, follows INTEGER,
    avg_watch_pct REAL,
    collected_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_clips_vod ON clips(vod_id);
CREATE INDEX IF NOT EXISTS idx_clips_status ON clips(status);
CREATE INDEX IF NOT EXISTS idx_events_vod ON events(vod_id);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA)
    return conn


# --- VODs ---------------------------------------------------------------

def upsert_vod(conn: sqlite3.Connection, *, hash_: str, src_path: str, slug: str,
               size_bytes: int) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM vods WHERE hash = ?", (hash_,)).fetchone()
    if row:
        return row
    now = _now()
    conn.execute(
        "INSERT INTO vods (hash, src_path, slug, size_bytes, created_at, updated_at)"
        " VALUES (?, ?, ?, ?, ?, ?)",
        (hash_, src_path, slug, size_bytes, now, now),
    )
    conn.commit()
    return conn.execute("SELECT * FROM vods WHERE hash = ?", (hash_,)).fetchone()


def update_vod(conn: sqlite3.Connection, vod_id: int, **fields: Any) -> None:
    fields["updated_at"] = _now()
    cols = ", ".join(f"{k} = ?" for k in fields)
    conn.execute(f"UPDATE vods SET {cols} WHERE id = ?", (*fields.values(), vod_id))
    conn.commit()


def list_vods(conn: sqlite3.Connection, status: str | None = None) -> list[sqlite3.Row]:
    if status:
        return conn.execute("SELECT * FROM vods WHERE status = ? ORDER BY id", (status,)).fetchall()
    return conn.execute("SELECT * FROM vods ORDER BY id").fetchall()


def get_vod(conn: sqlite3.Connection, vod_id: int) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM vods WHERE id = ?", (vod_id,)).fetchone()


# --- Clips --------------------------------------------------------------

def insert_clip(conn: sqlite3.Connection, *, vod_id: int, t_start: float, t_end: float,
                score: float, rank: int, signals: dict[str, Any], hook_text: str,
                title: str, description: str, hashtags: str) -> int:
    now = _now()
    cur = conn.execute(
        "INSERT INTO clips (vod_id, t_start, t_end, score, rank, signals_json, hook_text,"
        " title, description, hashtags, created_at, updated_at)"
        " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (vod_id, t_start, t_end, score, rank, json.dumps(signals, ensure_ascii=False),
         hook_text, title, description, hashtags, now, now),
    )
    conn.commit()
    return int(cur.lastrowid)


def update_clip(conn: sqlite3.Connection, clip_id: int, **fields: Any) -> None:
    fields["updated_at"] = _now()
    cols = ", ".join(f"{k} = ?" for k in fields)
    conn.execute(f"UPDATE clips SET {cols} WHERE id = ?", (*fields.values(), clip_id))
    conn.commit()


def get_clip(conn: sqlite3.Connection, clip_id: int) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM clips WHERE id = ?", (clip_id,)).fetchone()


def list_clips(conn: sqlite3.Connection, status: str | None = None,
               vod_id: int | None = None) -> list[sqlite3.Row]:
    query = "SELECT * FROM clips"
    clauses, params = [], []
    if status:
        clauses.append("status = ?")
        params.append(status)
    if vod_id is not None:
        clauses.append("vod_id = ?")
        params.append(vod_id)
    if clauses:
        query += " WHERE " + " AND ".join(clauses)
    query += " ORDER BY vod_id, rank"
    return conn.execute(query, params).fetchall()


def delete_clips_for_vod(conn: sqlite3.Connection, vod_id: int, only_status: str = "candidate") -> None:
    conn.execute("DELETE FROM clips WHERE vod_id = ? AND status = ?", (vod_id, only_status))
    conn.commit()


# --- Eventos ------------------------------------------------------------

def log_event(conn: sqlite3.Connection, stage: str, message: str, *,
              vod_id: int | None = None, clip_id: int | None = None,
              level: str = "info") -> None:
    conn.execute(
        "INSERT INTO events (vod_id, clip_id, stage, level, message, created_at)"
        " VALUES (?, ?, ?, ?, ?, ?)",
        (vod_id, clip_id, stage, level, message, _now()),
    )
    conn.commit()
