"""Fusión de señales y selección de candidatos a clip.

La regla de oro: un clip solo es válido si arranca y termina en límites de frase
de la transcripción. Eso es lo que evita frases cortadas y clips sin contexto.
Estructura exigida a cada candidato:
  - GANCHO: el momento pico queda a ≤ `hook_max_lead` segundos del inicio.
  - DESARROLLO: el clip se extiende por segmentos completos de la transcripción.
  - CIERRE: termina en un final de frase (puntuación o pausa real), dentro de 18–35s.
"""

from __future__ import annotations

import math
import re
import unicodedata
from dataclasses import dataclass, field

import numpy as np

from ..config import DetectConfig
from ..models import ClipCandidate, Marker, Transcript
from ..utils.log import get_logger
from .audio_energy import zscores_clipped

log = get_logger(__name__)

_SENTENCE_END_RE = re.compile(r"[.!?…]\s*$")
_WORD_CLEAN_RE = re.compile(r"[^\wáéíóúüñ]+", re.UNICODE)

# Padding de respiración al inicio/fin del corte
_LEAD_IN = 0.2
_LEAD_OUT = 0.25
# Una frase-gancho puede empezar hasta este margen extra antes del pico sin perder fuerza
_HOOK_SENTENCE_TOLERANCE = 4.0
# Pausa mínima tras una palabra para considerarla cierre válido sin puntuación
_MIN_CLOSING_GAP = 0.6


def _normalize_word(word: str) -> str:
    return _WORD_CLEAN_RE.sub("", word.lower())


def _strip_accents(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")


@dataclass
class SignalTracks:
    """Series por segundo del VOD. Se guardan en el clip para trazabilidad."""

    duration: float
    audio: np.ndarray
    keywords: np.ndarray
    laughter: np.ndarray
    wordrate: np.ndarray
    marker: np.ndarray
    keyword_hits: list[dict] = field(default_factory=list)
    laughter_hits: list[float] = field(default_factory=list)

    @property
    def n_seconds(self) -> int:
        return len(self.audio)


def build_tracks(
    duration: float,
    transcript: Transcript,
    audio_z: np.ndarray,
    markers: list[Marker],
    cfg: DetectConfig,
) -> SignalTracks:
    n = max(1, math.ceil(duration))

    def _track() -> np.ndarray:
        return np.zeros(n)

    audio = np.zeros(n)
    audio[: len(audio_z)] = audio_z[:n]

    keywords_track, laughter_track, wordcount = _track(), _track(), _track()
    keyword_hits: list[dict] = []
    laughter_hits: list[float] = []

    words = transcript.words
    norm_words = [(_normalize_word(w.text), w.start) for w in words]
    laughter_re = re.compile(cfg.laughter_pattern, re.IGNORECASE)

    for raw, start in norm_words:
        if not raw:
            continue
        second = min(int(start), n - 1)
        wordcount[second] += 1
        if laughter_re.search(raw):
            laughter_track[second] += 1.0
            laughter_hits.append(round(start, 2))

    # Frases gatillo: matching por tokens consecutivos, insensible a acentos
    keyword_tokens = {
        phrase: [_normalize_word(_strip_accents(t)) for t in phrase.split()]
        for phrase in cfg.keywords
    }
    stripped_words = [(_strip_accents(w), t) for w, t in norm_words]
    for phrase, tokens in keyword_tokens.items():
        if not tokens:
            continue
        for i in range(len(stripped_words) - len(tokens) + 1):
            if all(stripped_words[i + j][0] == tokens[j] for j in range(len(tokens))):
                hit_time = stripped_words[i][1]
                second = min(int(hit_time), n - 1)
                keywords_track[second] += cfg.keywords[phrase]
                keyword_hits.append({"phrase": phrase, "t": round(hit_time, 2)})

    marker_track = _track()
    for marker in markers:
        center = int(marker.time)
        for s in range(max(0, center - 2), min(n, center + 3)):
            marker_track[s] += 1.0

    return SignalTracks(
        duration=duration,
        audio=audio,
        keywords=keywords_track,
        laughter=laughter_track,
        wordrate=zscores_clipped(wordcount),
        marker=marker_track,
        keyword_hits=keyword_hits,
        laughter_hits=laughter_hits,
    )


def combined_score(tracks: SignalTracks, cfg: DetectConfig) -> np.ndarray:
    w = cfg.weights
    combined = (
        w.audio * tracks.audio
        + w.keywords * tracks.keywords
        + w.laughter * tracks.laughter
        + w.wordrate * tracks.wordrate
        + w.marker * tracks.marker
    )
    # Suavizado: un pico real dura varios segundos; el ruido de 1s no debe ganar
    if combined.size >= 3:
        kernel = np.array([0.25, 0.5, 0.25])
        combined = np.convolve(combined, kernel, mode="same")
    return combined


def find_peaks(combined: np.ndarray, cfg: DetectConfig) -> list[int]:
    """Segundos pico por encima del umbral, separados al menos `min_peak_separation`."""
    order = np.argsort(combined)[::-1]
    peaks: list[int] = []
    for idx in order:
        if combined[idx] < cfg.score_threshold:
            break
        if all(abs(int(idx) - p) >= cfg.min_peak_separation for p in peaks):
            peaks.append(int(idx))
    return sorted(peaks)


def snap_candidate(
    peak_t: float, transcript: Transcript, combined: np.ndarray, cfg: DetectConfig
) -> ClipCandidate | None:
    """Construye un candidato anclado a límites de frase alrededor de un pico. None si no hay corte coherente."""
    segments = transcript.segments
    if not segments:
        return None

    # --- Gancho: segmento que contiene (o sigue de inmediato a) el pico
    hook_seg = None
    for seg in segments:
        if seg.start <= peak_t <= seg.end:
            hook_seg = seg
            break
        if seg.start > peak_t:
            hook_seg = seg if seg.start - peak_t <= 3.0 else None
            break
    if hook_seg is None:
        return None

    earliest_start = peak_t - (cfg.hook_max_lead + _HOOK_SENTENCE_TOLERANCE)
    if hook_seg.start >= earliest_start:
        start = hook_seg.start
    else:
        # La frase del pico empezó hace demasiado: anclar a la palabra más cercana al lead deseado
        target = peak_t - cfg.hook_max_lead
        candidates = [w for w in hook_seg.words if w.start <= peak_t]
        if not candidates:
            return None
        start = min(candidates, key=lambda w: abs(w.start - target)).start
    start = max(0.0, start - _LEAD_IN)

    # --- Cierre: mejor final de frase dentro de la ventana de duración
    min_end, max_end = start + cfg.min_duration, start + cfg.max_duration
    best_end, best_quality = None, -1.0
    for i, seg in enumerate(segments):
        if seg.end < peak_t or seg.end < min_end:
            continue
        if seg.end > max_end:
            break
        gap_after = (segments[i + 1].start - seg.end) if i + 1 < len(segments) else 99.0
        quality = (
            min(gap_after, 2.0)
            + (1.0 if _SENTENCE_END_RE.search(seg.text) else 0.0)
            + 0.02 * (seg.end - start)  # con igual cierre, preferir más desarrollo
        )
        if quality > best_quality:
            best_end, best_quality = seg.end, quality

    if best_end is None:
        # Fallback: cortar en una palabra seguida de pausa real (silencio del streamer)
        words = transcript.words
        for i, word in enumerate(words):
            if not (min_end <= word.end <= max_end):
                continue
            gap = (words[i + 1].start - word.end) if i + 1 < len(words) else 99.0
            if gap >= _MIN_CLOSING_GAP:
                best_end = word.end
                break
    if best_end is None:
        return None  # no hay cierre coherente: mejor descartar que publicar una frase cortada

    end = min(best_end + _LEAD_OUT, transcript.segments[-1].end + 1.0)
    duration = end - start
    if not (cfg.min_duration - 1.0 <= duration <= cfg.max_duration + 1.0):
        return None

    lo, hi = int(start), min(int(math.ceil(end)), len(combined))
    window = combined[lo:hi] if hi > lo else combined[lo : lo + 1]
    score = float(window.max() + 0.1 * window.mean())

    hook_text = hook_seg.text.strip()
    return ClipCandidate(
        start=round(start, 2),
        end=round(end, 2),
        score=round(score, 3),
        hook_time=peak_t,
        hook_text=hook_text,
    )


def detect_candidates(
    duration: float,
    transcript: Transcript,
    audio_z: np.ndarray,
    markers: list[Marker],
    cfg: DetectConfig,
) -> list[ClipCandidate]:
    if cfg.require_transcript and not transcript.segments:
        log.warning("VOD sin transcripción utilizable: no se generan clips (require_transcript=true)")
        return []

    tracks = build_tracks(duration, transcript, audio_z, markers, cfg)
    combined = combined_score(tracks, cfg)

    candidates: list[ClipCandidate] = []
    for peak in find_peaks(combined, cfg):
        peak_t = float(peak) + 0.5
        candidate = snap_candidate(peak_t, transcript, combined, cfg)
        if candidate is None:
            continue
        candidate.signals = {
            "peak_t": peak_t,
            "combined_max": round(float(combined[peak]), 3),
            "audio_z": round(float(tracks.audio[peak]), 3),
            "keyword_hits": [h for h in tracks.keyword_hits if candidate.start <= h["t"] <= candidate.end],
            "laughter_hits": [t for t in tracks.laughter_hits if candidate.start <= t <= candidate.end],
            "markers": [
                {"t": m.time, "label": m.label} for m in markers if candidate.start <= m.time <= candidate.end
            ],
        }
        candidates.append(candidate)

    # Dedupe por solapamiento: gana el de mayor score
    candidates.sort(key=lambda c: c.score, reverse=True)
    kept: list[ClipCandidate] = []
    for cand in candidates:
        if all(cand.overlap_ratio(k) <= cfg.max_overlap for k in kept):
            kept.append(cand)
    kept = kept[: cfg.max_clips_per_vod]
    kept.sort(key=lambda c: c.start)
    log.info("Detección: %d picos → %d clips candidatos", len(candidates), len(kept))
    return kept
