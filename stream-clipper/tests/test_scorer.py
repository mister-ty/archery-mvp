import numpy as np

from stream_clipper.config import DetectConfig
from stream_clipper.detect.scorer import build_tracks, combined_score, detect_candidates
from stream_clipper.models import Marker, Transcript


def _audio_with_burst(duration: int = 90, burst: tuple[int, int] = (28, 40)) -> np.ndarray:
    z = np.zeros(duration)
    z[burst[0] : burst[1]] = 2.5
    return z


def test_candidate_snaps_to_sentence_boundaries(sample_transcript: Transcript):
    cfg = DetectConfig()
    candidates = detect_candidates(90.0, sample_transcript, _audio_with_burst(), [], cfg)
    assert candidates, "el pico de audio + keywords debe producir al menos un candidato"
    starts = {seg.start for seg in sample_transcript.segments}
    word_starts = {w.start for w in sample_transcript.words}
    for cand in candidates:
        # el inicio cae en el comienzo de una frase (o palabra) con el lead-in de 0.2s
        assert any(abs(cand.start + 0.2 - s) < 0.05 for s in starts | word_starts)
        assert cfg.min_duration - 1 <= cand.duration <= cfg.max_duration + 1


def test_no_transcript_means_no_clips():
    cfg = DetectConfig()
    empty = Transcript(language="es", segments=[])
    assert detect_candidates(90.0, empty, _audio_with_burst(), [], cfg) == []


def test_candidates_do_not_overlap_beyond_limit(sample_transcript: Transcript):
    cfg = DetectConfig(min_peak_separation=1, score_threshold=0.5)
    z = np.zeros(90)
    z[25:45] = 3.0  # zona caliente amplia: varios picos potenciales
    candidates = detect_candidates(90.0, sample_transcript, z, [], cfg)
    for i, a in enumerate(candidates):
        for b in candidates[i + 1 :]:
            assert a.overlap_ratio(b) <= cfg.max_overlap


def test_keyword_and_laughter_tracks(sample_transcript: Transcript):
    cfg = DetectConfig()
    tracks = build_tracks(90.0, sample_transcript, np.zeros(90), [], cfg)
    phrases = {hit["phrase"] for hit in tracks.keyword_hits}
    assert "no puede ser" in phrases  # multi-palabra, con signos de exclamación en el texto
    assert "increíble" in phrases     # insensible a acentos
    assert "clip" in phrases

    laughing = Transcript(language="es", segments=[sample_transcript.segments[0]])
    laughing.segments[0].words[0].text = "jajajaja"
    tracks2 = build_tracks(90.0, laughing, np.zeros(90), [], cfg)
    assert tracks2.laughter_hits


def test_manual_marker_dominates_score(sample_transcript: Transcript):
    cfg = DetectConfig()
    quiet_audio = np.zeros(90)
    marker = [Marker(time=29.0, label="clutch")]
    with_marker = combined_score(build_tracks(90.0, sample_transcript, quiet_audio, marker, cfg), cfg)
    without = combined_score(build_tracks(90.0, sample_transcript, quiet_audio, [], cfg), cfg)
    assert with_marker[29] > without[29] + cfg.weights.marker * 0.5


def test_signals_traceability(sample_transcript: Transcript):
    cfg = DetectConfig()
    candidates = detect_candidates(90.0, sample_transcript, _audio_with_burst(), [Marker(time=30.0)], cfg)
    assert candidates
    signals = candidates[0].signals
    assert "peak_t" in signals and "combined_max" in signals
    assert signals["keyword_hits"], "las keywords dentro del clip deben quedar registradas"
    assert signals["markers"]
