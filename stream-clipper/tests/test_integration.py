"""Integración end-to-end: VOD sintético → pipeline completo → MP4 vertical validado con ffprobe.

Requiere ffmpeg/ffprobe en PATH. Usa el motor `sidecar` (sin descargar modelos Whisper).
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from stream_clipper import db
from stream_clipper.config import AppConfig
from stream_clipper.models import Transcript
from stream_clipper.pipeline import Pipeline

from conftest import make_segment

pytestmark = pytest.mark.integration

if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
    pytest.skip("ffmpeg no disponible", allow_module_level=True)

_AUDIO_EXPR = "0.05*sin(440*2*PI*t)+if(between(t,28,40),0.8*sin(880*2*PI*t),0)"


def _make_vod(path: Path) -> None:
    subprocess.run(
        [
            "ffmpeg", "-y", "-v", "error",
            "-f", "lavfi", "-i", "testsrc2=duration=90:size=1280x720:rate=30",
            "-f", "lavfi", "-i", f"aevalsrc='{_AUDIO_EXPR}':s=44100:d=90",
            "-map", "0:v", "-map", "1:a",
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "30",
            "-c:a", "aac", str(path),
        ],
        check=True,
        timeout=300,
    )


def _transcript() -> Transcript:
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


def _ffprobe(path: Path) -> dict:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)],
        capture_output=True, text=True, check=True, timeout=60,
    )
    return json.loads(out.stdout)


@pytest.fixture(scope="module")
def workspace(tmp_path_factory: pytest.TempPathFactory) -> tuple[AppConfig, Path]:
    root = tmp_path_factory.mktemp("clipper-e2e")
    cfg = AppConfig()
    cfg.paths.data_dir = root / "data"
    cfg.transcribe.engine = "sidecar"
    cfg.ingest.stable_check_seconds = 0
    cfg.ingest.min_free_gb = 0.05
    cfg.edit.preset = "ultrafast"
    cfg.metadata.kick_channel = "canalprueba"

    inbox = cfg.paths.inbox
    inbox.mkdir(parents=True)
    vod_path = inbox / "Stream Épico (parte 1).mp4"
    _make_vod(vod_path)
    sidecar = inbox / (vod_path.name + ".transcript.json")
    sidecar.write_text(json.dumps(_transcript().to_dict(), ensure_ascii=False), encoding="utf-8")
    # marca manual además de las señales automáticas
    (inbox / (vod_path.name + ".markers")).write_text("33.0 momento clutch\n", encoding="utf-8")
    return cfg, vod_path


def test_full_pipeline_produces_valid_vertical_clip(workspace: tuple[AppConfig, Path]):
    cfg, _vod_path = workspace
    conn = db.connect(cfg.paths.db)
    pipeline = Pipeline(cfg, conn)

    registered = pipeline.scan()
    assert len(registered) == 1
    assert pipeline.scan() == []  # idempotente: segundo scan no duplica

    pipeline.process_all()

    vods = db.list_vods(conn)
    assert vods[0]["status"] == "done", "el VOD debe terminar en estado done"

    clips = db.list_clips(conn)
    assert clips, "el pico de audio + keywords + marker debe producir al menos un clip"

    for clip in clips:
        duration_src = clip["t_end"] - clip["t_start"]
        assert cfg.detect.min_duration - 1 <= duration_src <= cfg.detect.max_duration + 1
        signals = json.loads(clip["signals_json"])
        assert signals["keyword_hits"] or signals["markers"], "trazabilidad: el clip explica por qué existe"
        assert clip["title"], "metadata generada"
        assert "kick.com/canalprueba" in clip["description"]

        out = Path(clip["output_path"])
        assert out.is_file(), f"falta el MP4 renderizado: {out}"
        assert out.with_suffix(".json").is_file(), "falta el sidecar de metadata"

        probe = _ffprobe(out)
        video = next(s for s in probe["streams"] if s["codec_type"] == "video")
        audio = next(s for s in probe["streams"] if s["codec_type"] == "audio")
        assert (video["width"], video["height"]) == (1080, 1920)
        assert video["codec_name"] == "h264"
        assert audio["codec_name"] == "aac"
        total = float(probe["format"]["duration"])
        expected = duration_src + cfg.edit.endcard.duration
        assert abs(total - expected) < 1.5, f"duración {total}s vs esperada {expected}s"

    # la transcripción quedó cacheada: reprocesar no debe requerir el sidecar
    cached = list(cfg.paths.transcripts.glob("*.json"))
    assert len(cached) == 1


def test_reject_moves_file(workspace: tuple[AppConfig, Path]):
    cfg, _ = workspace
    conn = db.connect(cfg.paths.db)
    clip = db.list_clips(conn, status="candidate")[0]
    src = Path(clip["output_path"])

    dest = cfg.paths.rejected / src.name
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(src), dest)
    db.update_clip(conn, clip["id"], status="rejected", rejected_reason="frase cortada", output_path=str(dest))

    updated = db.get_clip(conn, clip["id"])
    assert updated["status"] == "rejected"
    assert Path(updated["output_path"]).is_file()
