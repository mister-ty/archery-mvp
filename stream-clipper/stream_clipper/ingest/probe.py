"""Validación y metadata del VOD vía ffprobe (incluye capítulos = marcas de OBS)."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from ..models import Marker
from ..utils.ffmpeg import ffprobe_json


@dataclass
class ProbeResult:
    duration: float
    width: int
    height: int
    fps: float
    has_audio: bool
    chapters: list[Marker] = field(default_factory=list)
    raw: dict[str, Any] = field(default_factory=dict)


def _parse_fps(rate: str) -> float:
    if "/" in rate:
        num, den = rate.split("/")
        return float(num) / float(den) if float(den) else 0.0
    return float(rate or 0)


def probe_video(path: Path) -> ProbeResult:
    data = ffprobe_json(path)
    video = next((s for s in data.get("streams", []) if s.get("codec_type") == "video"), None)
    audio = next((s for s in data.get("streams", []) if s.get("codec_type") == "audio"), None)
    if video is None:
        raise ValueError(f"El archivo no tiene stream de video: {path}")
    duration = float(data.get("format", {}).get("duration") or video.get("duration") or 0)
    if duration <= 0:
        raise ValueError(f"Duración inválida ({duration}s): {path}")
    chapters = [
        Marker(time=float(ch.get("start_time", 0)), label=ch.get("tags", {}).get("title", ""))
        for ch in data.get("chapters", [])
    ]
    return ProbeResult(
        duration=duration,
        width=int(video.get("width", 0)),
        height=int(video.get("height", 0)),
        fps=_parse_fps(video.get("avg_frame_rate", "0/1")),
        has_audio=audio is not None,
        chapters=chapters,
        raw=data,
    )
