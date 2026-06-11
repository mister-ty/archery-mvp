"""Manejo seguro de archivos: nombres saneados, firmas rápidas, chequeos de estabilidad y espacio."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import time
import unicodedata
from pathlib import Path
from typing import Any

_SLUG_RE = re.compile(r"[^a-z0-9]+")

# Para VODs de varios GB un sha256 completo es lento; firmamos con
# tamaño + primeros/últimos MB, suficiente para idempotencia de ingesta.
_SIGNATURE_CHUNK = 16 * 1024 * 1024


def safe_slug(name: str, max_len: int = 60) -> str:
    """Convierte cualquier nombre de archivo en un slug seguro para rutas y comandos."""
    stem = Path(name).stem
    normalized = unicodedata.normalize("NFKD", stem).encode("ascii", "ignore").decode("ascii")
    slug = _SLUG_RE.sub("-", normalized.lower()).strip("-")
    slug = slug[:max_len].strip("-")
    return slug or "video"


def file_signature(path: Path) -> str:
    """Firma rápida y estable de un archivo grande: sha256(tamaño + cabeza + cola)."""
    size = path.stat().st_size
    digest = hashlib.sha256(str(size).encode())
    with path.open("rb") as fh:
        digest.update(fh.read(_SIGNATURE_CHUNK))
        if size > 2 * _SIGNATURE_CHUNK:
            fh.seek(-_SIGNATURE_CHUNK, os.SEEK_END)
            digest.update(fh.read(_SIGNATURE_CHUNK))
    return digest.hexdigest()[:24]


def is_size_stable(path: Path, wait_seconds: float) -> bool:
    """True si el tamaño no cambia entre dos lecturas (el archivo terminó de copiarse)."""
    first = path.stat().st_size
    if wait_seconds > 0:
        time.sleep(wait_seconds)
    return path.stat().st_size == first and first > 0


def free_gb(path: Path) -> float:
    usage = shutil.disk_usage(path)
    return usage.free / 1024**3


def ensure_dirs(dirs: list[Path]) -> None:
    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)


def write_json_atomic(path: Path, data: Any) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))
