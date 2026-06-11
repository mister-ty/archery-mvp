"""Configuración tipada. Valores por defecto = config/default.yaml; un YAML del usuario los sobreescribe."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field


class PathsConfig(BaseModel):
    data_dir: Path = Path("data")

    @property
    def inbox(self) -> Path:
        return self.data_dir / "inbox"

    @property
    def work(self) -> Path:
        return self.data_dir / "work"

    @property
    def clips(self) -> Path:
        return self.data_dir / "clips"

    @property
    def rejected(self) -> Path:
        return self.data_dir / "rejected"

    @property
    def published(self) -> Path:
        return self.data_dir / "published"

    @property
    def logs(self) -> Path:
        return self.data_dir / "logs"

    @property
    def transcripts(self) -> Path:
        return self.data_dir / "transcripts"

    @property
    def db(self) -> Path:
        return self.data_dir / "clipper.db"

    def all_dirs(self) -> list[Path]:
        return [self.inbox, self.work, self.clips, self.rejected, self.published, self.logs, self.transcripts]


class IngestConfig(BaseModel):
    extensions: list[str] = [".mp4", ".mkv", ".mov", ".flv", ".ts"]
    stable_check_seconds: float = 1.5
    min_free_gb: float = 5.0


class TranscribeConfig(BaseModel):
    engine: str = "whisper"  # whisper | sidecar
    model: str = "small"
    language: str = "es"
    device: str = "auto"
    compute_type: str = "auto"
    vad: bool = True


class DetectWeights(BaseModel):
    audio: float = 1.0
    keywords: float = 1.2
    laughter: float = 0.9
    wordrate: float = 0.4
    marker: float = 3.0


class DetectConfig(BaseModel):
    weights: DetectWeights = DetectWeights()
    score_threshold: float = 1.6
    min_peak_separation: float = 12.0
    min_duration: float = 18.0
    max_duration: float = 35.0
    hook_max_lead: float = 2.0
    max_overlap: float = 0.4
    max_clips_per_vod: int = 8
    require_transcript: bool = True
    keywords: dict[str, float] = Field(
        default_factory=lambda: {
            "no puede ser": 1.5,
            "no me lo creo": 1.5,
            "qué es esto": 1.2,
            "increíble": 1.2,
            "clip": 1.5,
            "gané": 1.4,
            "wtf": 1.3,
        }
    )
    laughter_pattern: str = r"(?:[jh]a){2,}|(?:[jh]e){2,}|(?:ji){2,}|\bxd+\b|\blol\b|\blmao\b"


class ZoomConfig(BaseModel):
    enabled: bool = True
    max: float = 1.08
    duration: float = 1.2


class SubtitleConfig(BaseModel):
    enabled: bool = True
    words_per_line: int = 3
    uppercase: bool = True
    font: str = "DejaVu Sans"
    font_size: int = 64
    outline: int = 4
    margin_v: int = 560
    primary_color: str = "FFFFFF"
    outline_color: str = "000000"


class ProgressBarConfig(BaseModel):
    enabled: bool = True
    height: int = 12
    color: str = "53FC18"


class EndcardConfig(BaseModel):
    enabled: bool = True
    duration: float = 1.6
    bg_color: str = "0F0F0F"
    text: str = "EN VIVO EN KICK"
    subtext: str = "kick.com/{channel}"


class EditConfig(BaseModel):
    width: int = 1080
    height: int = 1920
    fps: int = 30
    crf: int = 19
    preset: str = "veryfast"
    audio_bitrate: str = "192k"
    target_lufs: float = -14.0
    crop_x_offset: float = 0.0  # -1.0 .. 1.0
    zoom: ZoomConfig = ZoomConfig()
    subtitles: SubtitleConfig = SubtitleConfig()
    progress_bar: ProgressBarConfig = ProgressBarConfig()
    endcard: EndcardConfig = EndcardConfig()


class MetadataConfig(BaseModel):
    kick_channel: str = "micanal"
    title_max_len: int = 80
    title_templates: list[str] = ["{hook}"]
    hashtags_base: list[str] = ["#clips", "#stream", "#kick", "#parati", "#fyp"]
    hashtags_extra: list[str] = []
    cta: str = "🔴 Directos en KICK 👉 kick.com/{channel}"


class LlmConfig(BaseModel):
    provider: str = "none"  # none | ollama | anthropic
    model: str = "llama3.1"
    base_url: str = "http://localhost:11434"


class AppConfig(BaseModel):
    paths: PathsConfig = PathsConfig()
    ingest: IngestConfig = IngestConfig()
    transcribe: TranscribeConfig = TranscribeConfig()
    detect: DetectConfig = DetectConfig()
    edit: EditConfig = EditConfig()
    metadata: MetadataConfig = MetadataConfig()
    llm: LlmConfig = LlmConfig()


def _deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    out = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _deep_merge(out[key], value)
        else:
            out[key] = value
    return out


DEFAULT_CONFIG_NAMES = ("clipper.yaml", "clipper.yml")


def load_config(path: Path | None = None) -> AppConfig:
    """Carga la config: defaults del modelo + YAML del usuario si existe.

    Orden: `path` explícito > ./clipper.yaml > solo defaults.
    """
    data: dict[str, Any] = {}
    candidates = [path] if path else [Path(name) for name in DEFAULT_CONFIG_NAMES]
    for candidate in candidates:
        if candidate and candidate.is_file():
            loaded = yaml.safe_load(candidate.read_text(encoding="utf-8")) or {}
            if not isinstance(loaded, dict):
                raise ValueError(f"Config inválida (se esperaba un mapa YAML): {candidate}")
            data = _deep_merge(data, loaded)
            break
        if path and candidate == path:
            raise FileNotFoundError(f"No existe el archivo de config: {path}")
    return AppConfig.model_validate(data)
