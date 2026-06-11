"""Escaneo de la carpeta inbox: archivos estables, firma de idempotencia y registro en DB."""

from __future__ import annotations

import sqlite3
from pathlib import Path

from .. import db
from ..config import AppConfig
from ..utils.fs import file_signature, free_gb, is_size_stable, safe_slug
from ..utils.log import get_logger

log = get_logger(__name__)


def scan_inbox(conn: sqlite3.Connection, config: AppConfig) -> list[sqlite3.Row]:
    """Registra los videos nuevos del inbox. Devuelve los VODs registrados en este escaneo."""
    inbox = config.paths.inbox
    if free_gb(config.paths.data_dir) < config.ingest.min_free_gb:
        raise RuntimeError(
            f"Espacio en disco insuficiente (<{config.ingest.min_free_gb} GB libres). Libera espacio antes de procesar."
        )

    registered: list[sqlite3.Row] = []
    extensions = {e.lower() for e in config.ingest.extensions}
    for path in sorted(inbox.iterdir()):
        if not path.is_file() or path.suffix.lower() not in extensions:
            continue
        if not is_size_stable(path, config.ingest.stable_check_seconds):
            log.info("Saltando %s: aún se está copiando", path.name)
            continue
        signature = file_signature(path)
        existing = conn.execute("SELECT * FROM vods WHERE hash = ?", (signature,)).fetchone()
        if existing:
            log.debug("Ya registrado: %s (vod %s)", path.name, existing["id"])
            continue
        slug = f"{safe_slug(path.name)}-{signature[:8]}"
        row = db.upsert_vod(
            conn,
            hash_=signature,
            src_path=str(path.resolve()),
            slug=slug,
            size_bytes=path.stat().st_size,
        )
        db.log_event(conn, "ingest", f"Registrado {path.name} como {slug}", vod_id=row["id"])
        log.info("Registrado VOD %s: %s", row["id"], path.name)
        registered.append(row)
    return registered
