"""Normalización de audio: loudnorm (EBU R128) en dos pasadas hacia el target LUFS."""

from __future__ import annotations

import json
from pathlib import Path

from ..utils.ffmpeg import run_ffmpeg
from ..utils.log import get_logger

log = get_logger(__name__)

_TP = -1.5
_LRA = 11


def measure_loudnorm(src: Path, t_start: float, duration: float, target_lufs: float) -> dict | None:
    """Primera pasada: mide la sonoridad real del segmento. None si no se pudo medir."""
    try:
        stderr = run_ffmpeg(
            [
                "-ss", f"{t_start:.3f}", "-t", f"{duration:.3f}", "-i", str(src),
                "-vn", "-af",
                f"loudnorm=I={target_lufs}:TP={_TP}:LRA={_LRA}:print_format=json",
                "-f", "null", "-",
            ]
        )
    except Exception as exc:
        log.warning("Medición loudnorm falló (%s); se usará una sola pasada", exc)
        return None
    # El JSON de loudnorm es el último bloque {...} del stderr
    start = stderr.rfind("{")
    end = stderr.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        return json.loads(stderr[start : end + 1])
    except json.JSONDecodeError:
        return None


def loudnorm_filter(measured: dict | None, target_lufs: float) -> str:
    base = f"loudnorm=I={target_lufs}:TP={_TP}:LRA={_LRA}"
    if not measured:
        return base
    return (
        f"{base}:measured_I={measured['input_i']}:measured_TP={measured['input_tp']}"
        f":measured_LRA={measured['input_lra']}:measured_thresh={measured['input_thresh']}"
        f":offset={measured['target_offset']}:linear=true"
    )
