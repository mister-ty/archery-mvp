"""Render del clip final: corte preciso + vertical 9:16 + subtítulos + plantilla, en un solo encode.

Cadena de video: crop/scale 9:16 → zoom dinámico del gancho → subtítulos ASS →
barra de progreso → endcard CTA (concat). Audio: loudnorm 2 pasadas → AAC.
Salida: MP4 H.264 yuv420p 1080x1920, +faststart (lista para subir).
"""

from __future__ import annotations

from pathlib import Path

from ..config import EditConfig, MetadataConfig
from ..models import ClipCandidate, Transcript
from ..utils.ffmpeg import run_ffmpeg
from ..utils.log import get_logger
from .audio import loudnorm_filter, measure_loudnorm
from .subtitles import build_ass

log = get_logger(__name__)


def _filter_path(path: Path) -> str:
    """Escapa una ruta para usarla como argumento de filtro (subtitles=...)."""
    return str(path).replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")


def _drawtext_escape(text: str) -> str:
    out = text.replace("\\", "\\\\")
    for ch in ("'", ":", "%", ","):
        out = out.replace(ch, f"\\{ch}")
    return out


def build_video_chain(cfg: EditConfig, duration: float, ass_path: Path | None) -> str:
    """Cadena de filtros de la rama principal de video ([0:v] → [vmain])."""
    w, h, fps = cfg.width, cfg.height, cfg.fps
    # Escala cubriendo el frame y crop al centro con offset horizontal configurable
    xoff = max(-1.0, min(1.0, cfg.crop_x_offset))
    filters = [
        f"scale={w}:{h}:force_original_aspect_ratio=increase",
        f"crop={w}:{h}:x='(iw-{w})/2*(1+{xoff})':y='(ih-{h})/2'",
        f"fps={fps}",
    ]
    if cfg.zoom.enabled and cfg.zoom.max > 1.0:
        z = (
            f"zoompan=z='min(1+({cfg.zoom.max}-1)*it/{cfg.zoom.duration},{cfg.zoom.max})'"
            f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={w}x{h}:fps={fps}"
        )
        filters.append(z)
    if ass_path is not None:
        filters.append(f"subtitles=filename='{_filter_path(ass_path)}'")
    filters.append("setsar=1,format=yuv420p")
    return ",".join(filters)


def build_endcard_chain(cfg: EditConfig, meta: MetadataConfig) -> tuple[str, str]:
    """Genera las cadenas [vec]/[aec] del endcard CTA hacia KICK."""
    ec = cfg.endcard
    subtext = ec.subtext.format(channel=meta.kick_channel)
    font = _drawtext_escape(cfg.subtitles.font)
    video = (
        f"color=c=0x{ec.bg_color}:s={cfg.width}x{cfg.height}:r={cfg.fps}:d={ec.duration},"
        f"drawtext=font='{font}':text='{_drawtext_escape(ec.text)}':fontsize=96:fontcolor=white"
        f":x=(w-text_w)/2:y=h/2-140,"
        f"drawtext=font='{font}':text='{_drawtext_escape(subtext)}':fontsize=64:fontcolor=0x53FC18"
        f":x=(w-text_w)/2:y=h/2+20,"
        f"setsar=1,format=yuv420p"
    )
    audio = f"anullsrc=channel_layout=stereo:sample_rate=48000:d={ec.duration},aformat=sample_fmts=fltp"
    return video, audio


def render_clip(
    *,
    src: Path,
    candidate: ClipCandidate,
    transcript: Transcript,
    out_path: Path,
    work_dir: Path,
    edit_cfg: EditConfig,
    meta_cfg: MetadataConfig,
    has_audio: bool = True,
) -> None:
    duration = candidate.duration
    out_path.parent.mkdir(parents=True, exist_ok=True)
    work_dir.mkdir(parents=True, exist_ok=True)

    ass_path: Path | None = None
    if edit_cfg.subtitles.enabled:
        ass_content = build_ass(transcript, candidate.start, candidate.end, edit_cfg.subtitles)
        ass_path = work_dir / "subs.ass"
        ass_path.write_text(ass_content, encoding="utf-8")

    measured = None
    if has_audio:
        measured = measure_loudnorm(src, candidate.start, duration, edit_cfg.target_lufs)

    graph: list[str] = []
    graph.append(f"[0:v]{build_video_chain(edit_cfg, duration, ass_path)}[vmain]")

    if has_audio:
        audio_chain = (
            f"[0:a]{loudnorm_filter(measured, edit_cfg.target_lufs)},"
            f"aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[amain]"
        )
    else:
        audio_chain = (
            f"anullsrc=channel_layout=stereo:sample_rate=48000:d={duration:.3f},"
            f"aformat=sample_fmts=fltp[amain]"
        )
    graph.append(audio_chain)

    last_v = "vmain"
    if edit_cfg.progress_bar.enabled:
        bar = edit_cfg.progress_bar
        graph.append(
            f"color=c=0x{bar.color}:s={edit_cfg.width}x{bar.height}:r={edit_cfg.fps}:d={duration:.3f}[bar]"
        )
        graph.append(
            f"[{last_v}][bar]overlay=x='-W+W*t/{duration:.3f}':y=H-{bar.height}:eof_action=pass[vbar]"
        )
        last_v = "vbar"

    if edit_cfg.endcard.enabled:
        ec_v, ec_a = build_endcard_chain(edit_cfg, meta_cfg)
        graph.append(f"{ec_v}[vec]")
        graph.append(f"{ec_a}[aec]")
        graph.append(f"[{last_v}][amain][vec][aec]concat=n=2:v=1:a=1[vout][aout]")
    else:
        graph.append(f"[{last_v}]null[vout]")
        graph.append("[amain]anull[aout]")

    args = [
        "-ss", f"{candidate.start:.3f}", "-t", f"{duration:.3f}", "-i", str(src),
        "-filter_complex", ";".join(graph),
        "-map", "[vout]", "-map", "[aout]",
        "-c:v", "libx264", "-preset", edit_cfg.preset, "-crf", str(edit_cfg.crf),
        "-c:a", "aac", "-b:a", edit_cfg.audio_bitrate,
        "-movflags", "+faststart",
        str(out_path),
    ]
    log.info("Renderizando %s (%.1fs)…", out_path.name, duration)
    run_ffmpeg(args)
