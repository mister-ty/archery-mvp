"""Generación de subtítulos ASS para quemar con libass.

Líneas cortas (2-4 palabras) sincronizadas con word timestamps, en mayúsculas,
fuente bold con borde grueso, posicionadas en zona segura (por encima de la UI
inferior de TikTok). Los tiempos son relativos al inicio del clip.
"""

from __future__ import annotations

from ..config import SubtitleConfig
from ..models import Transcript, Word

_ASS_HEADER = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Clip,{font},{size},{primary},{primary},{outline_color},&H7F000000,-1,0,0,0,100,100,0,0,1,{outline},0,2,60,60,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def _ass_color(rrggbb: str) -> str:
    """RRGGBB → formato ASS &HAABBGGRR (alpha 00 = opaco)."""
    rrggbb = rrggbb.strip().lstrip("#")
    r, g, b = rrggbb[0:2], rrggbb[2:4], rrggbb[4:6]
    return f"&H00{b}{g}{r}".upper()


def _ass_time(seconds: float) -> str:
    seconds = max(0.0, seconds)
    hours = int(seconds // 3600)
    minutes = int(seconds % 3600 // 60)
    secs = seconds % 60
    return f"{hours}:{minutes:02d}:{secs:05.2f}"


def _escape_text(text: str) -> str:
    # Llaves abren bloques de override en ASS: neutralizarlas
    return text.replace("{", "(").replace("}", ")").replace("\n", " ").strip()


def _clip_words(transcript: Transcript, clip_start: float, clip_end: float) -> list[Word]:
    return [w for w in transcript.words if w.start >= clip_start - 0.05 and w.end <= clip_end + 0.05]


def build_ass(transcript: Transcript, clip_start: float, clip_end: float, cfg: SubtitleConfig) -> str:
    """Devuelve el contenido del archivo .ass para el rango [clip_start, clip_end] del VOD."""
    header = _ASS_HEADER.format(
        font=cfg.font,
        size=cfg.font_size,
        primary=_ass_color(cfg.primary_color),
        outline_color=_ass_color(cfg.outline_color),
        outline=cfg.outline,
        margin_v=cfg.margin_v,
    )
    words = _clip_words(transcript, clip_start, clip_end)
    duration = clip_end - clip_start

    lines: list[tuple[float, float, str]] = []
    chunk: list[Word] = []
    for word in words:
        chunk.append(word)
        if len(chunk) >= cfg.words_per_line:
            lines.append(_chunk_to_line(chunk, clip_start))
            chunk = []
    if chunk:
        lines.append(_chunk_to_line(chunk, clip_start))

    events = []
    for i, (start, end, text) in enumerate(lines):
        if i + 1 < len(lines):
            end = min(end, lines[i + 1][0])  # nunca solapar con la línea siguiente
        end = min(end, duration)
        if end <= start:
            continue
        text = _escape_text(text)
        if cfg.uppercase:
            text = text.upper()
        events.append(
            f"Dialogue: 0,{_ass_time(start)},{_ass_time(end)},Clip,,0,0,0,,{{\\fad(60,40)}}{text}"
        )
    return header + "\n".join(events) + "\n"


def _chunk_to_line(chunk: list[Word], clip_start: float) -> tuple[float, float, str]:
    start = max(0.0, chunk[0].start - clip_start - 0.05)
    end = chunk[-1].end - clip_start + 0.18
    return start, end, " ".join(w.text for w in chunk)
