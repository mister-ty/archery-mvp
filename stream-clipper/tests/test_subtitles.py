from stream_clipper.config import SubtitleConfig
from stream_clipper.edit.subtitles import _ass_color, _ass_time, build_ass
from stream_clipper.models import Transcript

from conftest import make_segment


def test_ass_time_and_color_formats():
    assert _ass_time(0) == "0:00:00.00"
    assert _ass_time(75.5) == "0:01:15.50"
    assert _ass_time(3661.25) == "1:01:01.25"
    assert _ass_color("53FC18") == "&H0018FC53"


def test_build_ass_relative_times_and_uppercase(sample_transcript: Transcript):
    cfg = SubtitleConfig(words_per_line=3, uppercase=True)
    ass = build_ass(sample_transcript, clip_start=28.0, clip_end=41.0, cfg=cfg)
    assert "[Script Info]" in ass and "PlayResY: 1920" in ass
    assert "Dialogue:" in ass
    assert "NO PUEDE SER," in ass.upper()
    # ninguna línea empieza después del final del clip (tiempos relativos)
    for line in ass.splitlines():
        if line.startswith("Dialogue:"):
            start = line.split(",")[1]
            assert start < "0:00:13.50"


def test_build_ass_escapes_override_braces():
    seg = make_segment(0.0, 2.0, "texto {malicioso} aquí")
    transcript = Transcript(language="es", segments=[seg])
    ass = build_ass(transcript, 0.0, 2.0, SubtitleConfig(uppercase=False))
    assert "{malicioso}" not in ass
    assert "(malicioso)" in ass


def test_lines_never_overlap(sample_transcript: Transcript):
    cfg = SubtitleConfig(words_per_line=2)
    ass = build_ass(sample_transcript, 28.0, 41.0, cfg)
    dialogues = [l for l in ass.splitlines() if l.startswith("Dialogue:")]
    times = [(l.split(",")[1], l.split(",")[2]) for l in dialogues]
    for (_start, end), (next_start, _end) in zip(times, times[1:]):
        assert end <= next_start
