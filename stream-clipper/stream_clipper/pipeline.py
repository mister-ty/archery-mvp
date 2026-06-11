"""Orquestador: ejecuta las etapas por VOD con estado en DB (re-ejecutable sin repetir trabajo).

Etapas: probe → transcribe (con caché) → detect → render por candidato.
Cada etapa registra eventos; los fallos marcan el VOD como `failed` sin tumbar el lote.
Los temporales viven en data/work/<slug>/ y se limpian siempre (finally).
"""

from __future__ import annotations

import json
import shutil
import sqlite3
from pathlib import Path

import numpy as np

from . import db
from .config import AppConfig
from .detect.audio_energy import audio_energy_zscores
from .detect.markers import load_sidecar_markers
from .detect.scorer import detect_candidates
from .edit.renderer import render_clip
from .ingest.intake import scan_inbox
from .ingest.probe import probe_video
from .metadata.generator import generate_metadata
from .models import ClipCandidate, Marker, Transcript
from .transcribe.engines import transcribe
from .utils.fs import ensure_dirs, write_json_atomic
from .utils.log import get_logger

log = get_logger(__name__)


class Pipeline:
    def __init__(self, config: AppConfig, conn: sqlite3.Connection):
        self.config = config
        self.conn = conn
        ensure_dirs(config.paths.all_dirs())

    def scan(self) -> list[sqlite3.Row]:
        return scan_inbox(self.conn, self.config)

    def process_all(self, force: bool = False) -> None:
        vods = db.list_vods(self.conn)
        if not vods:
            log.info("No hay VODs registrados. Copia videos a %s y ejecuta `clipper scan`.", self.config.paths.inbox)
        for vod in vods:
            if vod["status"] == "done" and not force:
                log.info("VOD %s ya procesado (usa --force para repetir)", vod["id"])
                continue
            self.process_vod(vod, force=force)

    def process_vod(self, vod: sqlite3.Row, force: bool = False) -> None:
        vod_id, slug = vod["id"], vod["slug"]
        src = Path(vod["src_path"])
        work_dir = self.config.paths.work / slug
        log.info("Procesando VOD %s (%s)…", vod_id, src.name)
        try:
            if not src.is_file():
                raise FileNotFoundError(f"El archivo de origen ya no existe: {src}")

            probe = probe_video(src)
            db.update_vod(
                self.conn, vod_id,
                duration=probe.duration, width=probe.width, height=probe.height,
                fps=probe.fps, probe_json=json.dumps(probe.raw),
            )
            db.log_event(self.conn, "probe", f"{probe.duration:.0f}s {probe.width}x{probe.height}", vod_id=vod_id)

            transcript = transcribe(src, vod["hash"], self.config)
            db.update_vod(self.conn, vod_id, status="transcribed")
            db.log_event(self.conn, "transcribe", f"{len(transcript.segments)} segmentos", vod_id=vod_id)

            markers: list[Marker] = [*load_sidecar_markers(src), *probe.chapters]
            audio_z = (
                audio_energy_zscores(src, probe.duration) if probe.has_audio
                else np.zeros(max(1, int(probe.duration)))
            )

            db.delete_clips_for_vod(self.conn, vod_id)  # re-detección limpia solo candidatos
            candidates = detect_candidates(probe.duration, transcript, audio_z, markers, self.config.detect)
            db.update_vod(self.conn, vod_id, status="detected")
            db.log_event(self.conn, "detect", f"{len(candidates)} candidatos", vod_id=vod_id)

            for rank, candidate in enumerate(candidates, start=1):
                self._render_candidate(vod_id, slug, src, candidate, transcript, rank, probe.has_audio, work_dir)

            db.update_vod(self.conn, vod_id, status="done")
            log.info("VOD %s listo: %d clips candidatos en %s", vod_id, len(candidates), self.config.paths.clips / slug)
        except Exception as exc:
            log.exception("VOD %s falló: %s", vod_id, exc)
            db.update_vod(self.conn, vod_id, status="failed")
            db.log_event(self.conn, "pipeline", str(exc), vod_id=vod_id, level="error")
        finally:
            shutil.rmtree(work_dir, ignore_errors=True)

    def _render_candidate(
        self,
        vod_id: int,
        slug: str,
        src: Path,
        candidate: ClipCandidate,
        transcript: Transcript,
        rank: int,
        has_audio: bool,
        work_dir: Path,
    ) -> None:
        clip_text = " ".join(
            seg.text for seg in transcript.segments if seg.start >= candidate.start and seg.end <= candidate.end
        )
        meta = generate_metadata(candidate, clip_text, self.config)
        clip_id = db.insert_clip(
            self.conn,
            vod_id=vod_id,
            t_start=candidate.start,
            t_end=candidate.end,
            score=candidate.score,
            rank=rank,
            signals=candidate.signals,
            hook_text=candidate.hook_text,
            title=meta["title"],
            description=meta["description"],
            hashtags=meta["hashtags"],
        )
        out_path = self.config.paths.clips / slug / f"clip_{clip_id:03d}_{int(candidate.start)}s.mp4"
        try:
            render_clip(
                src=src,
                candidate=candidate,
                transcript=transcript,
                out_path=out_path,
                work_dir=work_dir / f"clip_{clip_id}",
                edit_cfg=self.config.edit,
                meta_cfg=self.config.metadata,
                has_audio=has_audio,
            )
        except Exception as exc:
            db.log_event(self.conn, "render", str(exc), vod_id=vod_id, clip_id=clip_id, level="error")
            raise
        db.update_clip(self.conn, clip_id, output_path=str(out_path))
        write_json_atomic(
            out_path.with_suffix(".json"),
            {
                "clip_id": clip_id,
                "vod_id": vod_id,
                "t_start": candidate.start,
                "t_end": candidate.end,
                "score": candidate.score,
                "title": meta["title"],
                "description": meta["description"],
                "hashtags": meta["hashtags"],
                "signals": candidate.signals,
            },
        )
        db.log_event(self.conn, "render", f"OK {out_path.name}", vod_id=vod_id, clip_id=clip_id)
