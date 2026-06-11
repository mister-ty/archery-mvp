"""Motores de transcripción.

- `whisper`: faster-whisper local con word timestamps (instalar con `pip install -e ".[whisper]"`).
- `sidecar`: lee `<video>.transcript.json` ya existente (tests, imports de otros ASR).

El resultado siempre se cachea en data/transcripts/<hash>.json: re-procesar un VOD nunca
vuelve a transcribir.
"""

from __future__ import annotations

from pathlib import Path

from ..config import AppConfig
from ..models import Segment, Transcript, Word
from ..utils.fs import read_json, write_json_atomic
from ..utils.log import get_logger

log = get_logger(__name__)

SIDECAR_SUFFIX = ".transcript.json"


def transcribe(video_path: Path, vod_hash: str, config: AppConfig) -> Transcript:
    cache_path = config.paths.transcripts / f"{vod_hash}.json"
    if cache_path.is_file():
        log.info("Transcripción en caché: %s", cache_path.name)
        return Transcript.from_dict(read_json(cache_path))

    engine = config.transcribe.engine
    if engine == "sidecar":
        transcript = _from_sidecar(video_path)
    elif engine == "whisper":
        transcript = _from_whisper(video_path, config)
    else:
        raise ValueError(f"Motor de transcripción desconocido: {engine}")

    write_json_atomic(cache_path, transcript.to_dict())
    return transcript


def _from_sidecar(video_path: Path) -> Transcript:
    sidecar = video_path.with_name(video_path.name + SIDECAR_SUFFIX)
    if not sidecar.is_file():
        raise FileNotFoundError(
            f"engine=sidecar pero no existe {sidecar.name} junto al video"
        )
    return Transcript.from_dict(read_json(sidecar))


def _from_whisper(video_path: Path, config: AppConfig) -> Transcript:
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:  # pragma: no cover - depende del entorno
        raise RuntimeError(
            "faster-whisper no está instalado. Ejecuta: pip install -e \".[whisper]\""
        ) from exc

    cfg = config.transcribe
    log.info("Transcribiendo con faster-whisper (%s, device=%s)…", cfg.model, cfg.device)
    model = WhisperModel(cfg.model, device=cfg.device, compute_type=cfg.compute_type)
    raw_segments, info = model.transcribe(
        str(video_path),
        language=cfg.language or None,
        word_timestamps=True,
        vad_filter=cfg.vad,
    )
    segments: list[Segment] = []
    for seg in raw_segments:
        words = [
            Word(text=w.word.strip(), start=float(w.start), end=float(w.end))
            for w in (seg.words or [])
            if w.word.strip()
        ]
        segments.append(Segment(text=seg.text.strip(), start=float(seg.start), end=float(seg.end), words=words))
    log.info("Transcripción lista: %d segmentos (idioma=%s)", len(segments), info.language)
    return Transcript(language=info.language, segments=segments)
