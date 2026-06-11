"""CLI de stream-clipper (Typer).

Flujo Fase 1:
    clipper init → copiar VODs a data/inbox/ → clipper scan → clipper process
    → clipper list → clipper show/approve/reject → subir manualmente los aprobados.
"""

from __future__ import annotations

import json
import shutil
import sqlite3
from pathlib import Path
from typing import Annotated, Optional

import typer
from rich.console import Console
from rich.table import Table

from . import db
from .config import AppConfig, load_config
from .pipeline import Pipeline
from .utils.fs import ensure_dirs
from .utils.log import get_logger, setup_logging

app = typer.Typer(help="De VODs de stream a clips verticales 9:16 con revisión humana.", no_args_is_help=True)
console = Console()
log = get_logger(__name__)

ConfigOption = Annotated[
    Optional[Path], typer.Option("--config", "-c", help="Ruta a un clipper.yaml alternativo")
]


def _bootstrap(config_path: Path | None) -> tuple[AppConfig, sqlite3.Connection]:
    config = load_config(config_path)
    ensure_dirs(config.paths.all_dirs())
    setup_logging(config.paths.logs)
    return config, db.connect(config.paths.db)


@app.command()
def init(config: ConfigOption = None) -> None:
    """Crea data/ y un clipper.yaml editable a partir de la config por defecto."""
    cfg, _ = _bootstrap(config)
    target = Path("clipper.yaml")
    if not target.exists():
        template = Path(__file__).resolve().parents[1] / "config" / "default.yaml"
        if template.is_file():
            shutil.copy(template, target)
        else:
            import yaml

            target.write_text(yaml.safe_dump(cfg.model_dump(mode="json"), allow_unicode=True), encoding="utf-8")
        console.print(f"[green]Creado {target}[/green] — edita al menos metadata.kick_channel")
    console.print(f"Carpetas listas en [bold]{cfg.paths.data_dir}/[/bold]. Copia tus VODs a {cfg.paths.inbox}/")


@app.command()
def scan(config: ConfigOption = None) -> None:
    """Registra los videos nuevos de la carpeta inbox."""
    cfg, conn = _bootstrap(config)
    registered = Pipeline(cfg, conn).scan()
    console.print(f"{len(registered)} VOD(s) nuevo(s) registrado(s).")


@app.command()
def process(
    config: ConfigOption = None,
    vod: Annotated[Optional[int], typer.Option(help="Procesar solo este VOD")] = None,
    force: Annotated[bool, typer.Option(help="Reprocesar aunque ya esté hecho")] = False,
) -> None:
    """Ejecuta el pipeline completo: transcribir, detectar y renderizar clips candidatos."""
    cfg, conn = _bootstrap(config)
    pipeline = Pipeline(cfg, conn)
    pipeline.scan()
    if vod is not None:
        row = db.get_vod(conn, vod)
        if row is None:
            raise typer.BadParameter(f"No existe el VOD {vod}")
        pipeline.process_vod(row, force=force)
    else:
        pipeline.process_all(force=force)


@app.command("list")
def list_clips(
    config: ConfigOption = None,
    status: Annotated[Optional[str], typer.Option(help="candidate|approved|rejected|published")] = None,
) -> None:
    """Tabla de clips con score, estado y ruta."""
    _, conn = _bootstrap(config)
    rows = db.list_clips(conn, status=status)
    table = Table(title="Clips")
    for col in ("id", "vod", "rango", "dur", "score", "estado", "título", "archivo"):
        table.add_column(col)
    for r in rows:
        table.add_row(
            str(r["id"]), str(r["vod_id"]),
            f"{r['t_start']:.0f}–{r['t_end']:.0f}s",
            f"{r['t_end'] - r['t_start']:.0f}s",
            f"{r['score']:.2f}", r["status"],
            (r["title"] or "")[:40],
            Path(r["output_path"]).name if r["output_path"] else "—",
        )
    console.print(table)


@app.command()
def show(clip_id: int, config: ConfigOption = None) -> None:
    """Detalle de un clip: metadata completa y señales que lo justifican."""
    _, conn = _bootstrap(config)
    row = db.get_clip(conn, clip_id)
    if row is None:
        raise typer.BadParameter(f"No existe el clip {clip_id}")
    console.print_json(json.dumps(dict(row), ensure_ascii=False))


@app.command()
def approve(clip_id: int, config: ConfigOption = None) -> None:
    """Marca un clip como aprobado (listo para subir manualmente a TikTok)."""
    _, conn = _bootstrap(config)
    row = db.get_clip(conn, clip_id)
    if row is None:
        raise typer.BadParameter(f"No existe el clip {clip_id}")
    db.update_clip(conn, clip_id, status="approved")
    db.log_event(conn, "review", "aprobado", clip_id=clip_id)
    console.print(f"[green]Clip {clip_id} aprobado[/green] → {row['output_path']}")


@app.command()
def reject(
    clip_id: int,
    reason: Annotated[str, typer.Option("--reason", "-r", help="Por qué se rechaza (alimenta mejoras de detección)")] = "",
    config: ConfigOption = None,
) -> None:
    """Rechaza un clip y mueve el archivo a data/rejected/."""
    cfg, conn = _bootstrap(config)
    row = db.get_clip(conn, clip_id)
    if row is None:
        raise typer.BadParameter(f"No existe el clip {clip_id}")
    new_path = row["output_path"]
    if row["output_path"]:
        src = Path(row["output_path"])
        if src.is_file():
            dest = cfg.paths.rejected / src.name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(src), dest)
            sidecar = src.with_suffix(".json")
            if sidecar.is_file():
                shutil.move(str(sidecar), dest.with_suffix(".json"))
            new_path = str(dest)
    db.update_clip(conn, clip_id, status="rejected", rejected_reason=reason, output_path=new_path)
    db.log_event(conn, "review", f"rechazado: {reason}", clip_id=clip_id)
    console.print(f"[yellow]Clip {clip_id} rechazado[/yellow] ({reason or 'sin motivo'})")


@app.command()
def status(config: ConfigOption = None) -> None:
    """Resumen: VODs por estado y clips por estado."""
    _, conn = _bootstrap(config)
    vods = conn.execute("SELECT status, COUNT(*) AS n FROM vods GROUP BY status").fetchall()
    clips = conn.execute("SELECT status, COUNT(*) AS n FROM clips GROUP BY status").fetchall()
    console.print("[bold]VODs[/bold]:", {r["status"]: r["n"] for r in vods} or "ninguno")
    console.print("[bold]Clips[/bold]:", {r["status"]: r["n"] for r in clips} or "ninguno")


if __name__ == "__main__":
    app()
