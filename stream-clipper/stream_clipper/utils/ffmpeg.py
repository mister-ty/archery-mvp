"""Wrapper de ffmpeg/ffprobe: subprocess con lista de args (nunca shell), timeouts y errores legibles."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

from .log import get_logger

log = get_logger(__name__)

DEFAULT_TIMEOUT = 60 * 30  # 30 min por comando; los VODs largos tardan


class FfmpegError(RuntimeError):
    def __init__(self, args: list[str], stderr: str):
        tail = "\n".join(stderr.strip().splitlines()[-15:])
        super().__init__(f"ffmpeg falló: {' '.join(args[:8])}…\n--- stderr (final) ---\n{tail}")
        self.stderr = stderr


def run_ffmpeg(args: list[str], timeout: int = DEFAULT_TIMEOUT) -> str:
    """Ejecuta ffmpeg con -y -hide_banner. Devuelve stderr (ffmpeg loguea ahí)."""
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "info", *args]
    log.debug("ffmpeg: %s", " ".join(cmd))
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if proc.returncode != 0:
        raise FfmpegError(cmd, proc.stderr)
    return proc.stderr


def run_ffmpeg_raw_audio(args: list[str], timeout: int = DEFAULT_TIMEOUT) -> bytes:
    """Ejecuta ffmpeg y devuelve stdout binario (para extraer PCM crudo)."""
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", *args]
    proc = subprocess.run(cmd, capture_output=True, timeout=timeout)
    if proc.returncode != 0:
        raise FfmpegError(cmd, proc.stderr.decode(errors="replace"))
    return proc.stdout


def ffprobe_json(path: Path) -> dict[str, Any]:
    """Metadata del contenedor: streams, formato y capítulos (marcas de OBS)."""
    cmd = [
        "ffprobe", "-v", "error", "-print_format", "json",
        "-show_format", "-show_streams", "-show_chapters", str(path),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if proc.returncode != 0:
        raise FfmpegError(cmd, proc.stderr)
    return json.loads(proc.stdout)
