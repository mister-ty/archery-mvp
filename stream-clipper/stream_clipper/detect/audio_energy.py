"""Señal de energía de audio: RMS por segundo normalizado (z-score).

Los picos de energía (gritos, reacciones, hype del juego) son la señal
más barata y fiable de que "algo pasó" aunque la transcripción no lo capture.
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np

from ..utils.ffmpeg import run_ffmpeg_raw_audio
from ..utils.log import get_logger

log = get_logger(__name__)

_SAMPLE_RATE = 16000


def audio_energy_zscores(video_path: Path, duration: float) -> np.ndarray:
    """Devuelve un array de z-scores de energía RMS, un valor por segundo del VOD.

    Valores negativos se truncan a 0: solo nos interesan los picos por encima
    de la media del propio stream (cada streamer tiene su baseline de volumen).
    """
    n_seconds = max(1, math.ceil(duration))
    try:
        pcm = run_ffmpeg_raw_audio(
            ["-i", str(video_path), "-vn", "-ac", "1", "-ar", str(_SAMPLE_RATE), "-f", "s16le", "pipe:1"]
        )
    except Exception as exc:
        log.warning("No se pudo extraer audio (%s); señal de audio = 0", exc)
        return np.zeros(n_seconds)

    samples = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0
    if samples.size == 0:
        return np.zeros(n_seconds)

    rms = np.zeros(n_seconds)
    for i in range(n_seconds):
        chunk = samples[i * _SAMPLE_RATE : (i + 1) * _SAMPLE_RATE]
        if chunk.size:
            rms[i] = float(np.sqrt(np.mean(chunk**2)))
    return zscores_clipped(rms)


def zscores_clipped(values: np.ndarray) -> np.ndarray:
    """z-score con negativos a 0. Si la señal es plana devuelve ceros (evita división por 0)."""
    std = float(values.std())
    if std < 1e-9:
        return np.zeros_like(values)
    return np.clip((values - values.mean()) / std, 0.0, None)
