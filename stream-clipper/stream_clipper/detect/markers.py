"""Marcas manuales: archivo sidecar `<video>.markers` + capítulos del contenedor (OBS 30.2+).

Formato del sidecar (una marca por línea, `#` comenta):

    932.5 clutch increíble
    01:23:45 ace
    15:30 reacción del chat
"""

from __future__ import annotations

import re
from pathlib import Path

from ..models import Marker

MARKERS_SUFFIX = ".markers"

_TIME_RE = re.compile(r"^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$")


def parse_time(token: str) -> float | None:
    """Acepta segundos (932.5), MM:SS o HH:MM:SS(.ms)."""
    try:
        return float(token)
    except ValueError:
        pass
    match = _TIME_RE.match(token)
    if not match:
        return None
    hours = int(match.group(1) or 0)
    return hours * 3600 + int(match.group(2)) * 60 + float(match.group(3))


def parse_markers_text(text: str) -> list[Marker]:
    markers: list[Marker] = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        token, _, label = line.partition(" ")
        time = parse_time(token)
        if time is None:
            continue
        markers.append(Marker(time=time, label=label.strip()))
    return markers


def load_sidecar_markers(video_path: Path) -> list[Marker]:
    sidecar = video_path.with_name(video_path.name + MARKERS_SUFFIX)
    if not sidecar.is_file():
        return []
    return parse_markers_text(sidecar.read_text(encoding="utf-8"))
