from pathlib import Path

import pytest

from stream_clipper.config import AppConfig, load_config


def test_defaults_are_sane():
    cfg = AppConfig()
    assert cfg.detect.min_duration == 18
    assert cfg.detect.max_duration == 35
    assert cfg.edit.width == 1080 and cfg.edit.height == 1920
    assert cfg.llm.provider == "none"
    assert cfg.detect.require_transcript is True


def test_yaml_override_merges_deep(tmp_path: Path):
    yaml_file = tmp_path / "clipper.yaml"
    yaml_file.write_text(
        "detect:\n  max_duration: 30\nmetadata:\n  kick_channel: micanalreal\n",
        encoding="utf-8",
    )
    cfg = load_config(yaml_file)
    assert cfg.detect.max_duration == 30
    assert cfg.detect.min_duration == 18  # default intacto
    assert cfg.metadata.kick_channel == "micanalreal"


def test_missing_explicit_config_raises(tmp_path: Path):
    with pytest.raises(FileNotFoundError):
        load_config(tmp_path / "no-existe.yaml")


def test_default_yaml_in_repo_is_loadable():
    default = Path(__file__).resolve().parents[1] / "config" / "default.yaml"
    cfg = load_config(default)
    assert cfg.edit.endcard.enabled is True
