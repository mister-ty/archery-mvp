from __future__ import annotations

import pytest

from stream_clipper.models import Segment, Transcript, Word


def make_segment(start: float, end: float, text: str) -> Segment:
    """Reparte las palabras del texto uniformemente en [start, end]."""
    tokens = text.split()
    step = (end - start) / max(len(tokens), 1)
    words = [
        Word(text=tok, start=round(start + i * step, 3), end=round(start + (i + 1) * step, 3))
        for i, tok in enumerate(tokens)
    ]
    return Segment(text=text, start=start, end=end, words=words)


@pytest.fixture
def sample_transcript() -> Transcript:
    """Transcripción sintética con un momento de hype entre 28 y 41s."""
    return Transcript(
        language="es",
        segments=[
            make_segment(5.0, 9.0, "Hoy estamos probando el mapa nuevo."),
            make_segment(12.0, 17.0, "El chat está muy tranquilo todavía."),
            make_segment(24.0, 27.5, "Espera espera qué está pasando aquí."),
            make_segment(28.0, 31.0, "¡No puede ser, esto es increíble!"),
            make_segment(32.0, 36.0, "Hermano acabo de ganar la partida más loca de mi vida."),
            make_segment(37.0, 41.0, "Esto es clip, lo juro que esto es clip."),
            make_segment(42.0, 46.0, "Bueno chat, vamos a calmarnos un poco."),
            make_segment(50.0, 55.0, "Sigamos con la siguiente ronda tranquilos."),
        ],
    )
