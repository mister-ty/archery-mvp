from stream_clipper.config import AppConfig
from stream_clipper.metadata.generator import generate_metadata
from stream_clipper.models import ClipCandidate


def _candidate(hook: str) -> ClipCandidate:
    return ClipCandidate(start=10.0, end=35.0, score=3.2, hook_time=12.0, hook_text=hook)


def test_title_from_hook_with_cta_and_hashtags():
    cfg = AppConfig()
    cfg.metadata.kick_channel = "canalprueba"
    meta = generate_metadata(_candidate("¡No puede ser, esto es increíble!"), "...", cfg)
    assert meta["title"].startswith("¡No puede ser")
    assert "kick.com/canalprueba" in meta["description"]
    assert "#kick" in meta["hashtags"]


def test_title_truncates_at_word_boundary():
    cfg = AppConfig()
    cfg.metadata.title_max_len = 30
    long_hook = "esta es una frase larguísima que no cabe en un título de tiktok"
    meta = generate_metadata(_candidate(long_hook), "", cfg)
    assert len(meta["title"]) <= 30
    assert meta["title"].endswith("…")
    assert not meta["title"][:-1].endswith(" ")


def test_empty_hook_gets_fallback_title():
    meta = generate_metadata(_candidate("   "), "", AppConfig())
    assert meta["title"] == "Momento del stream"
