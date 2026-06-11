# stream-clipper

Sistema para transformar grabaciones de streams (OBS / VOD) en **clips verticales 9:16 de 18–35s** editados profesionalmente, con **revisión humana** antes de publicarlos en TikTok y CTA hacia tus directos en **KICK**.

No es un cortador de videos al azar: cada clip existe porque una combinación de señales lo justifica (picos de audio, frases gatillo, risas, marcas manuales), arranca con gancho, se corta en límites de frase y termina con cierre + endcard CTA. Toda la trazabilidad queda en SQLite.

## Estado actual: Fase 1 (pipeline local funcional)

```
VOD en data/inbox/ ──► ingesta ──► transcripción ──► detección de highlights
        ──► clips candidatos ──► render 9:16 + subtítulos + plantilla ──► revisión humana (CLI)
```

- **Fase 2** (siguiente): dashboard web de revisión/aprobación. Ver [docs/architecture.md](docs/architecture.md).
- **Fase 3**: publicación TikTok vía Content Posting API (requiere auditoría de TikTok, ver [docs/tiktok-api.md](docs/tiktok-api.md)) y métricas. **KICK no permite subir clips por API** — verificado, ver [docs/kick-api.md](docs/kick-api.md).

## Requisitos

- Python 3.11+
- FFmpeg 6+ con libass (`apt install ffmpeg` / `brew install ffmpeg`)
- ~2 GB de disco libre por hora de VOD procesado (temporales + clips)

## Instalación

```bash
pip install -e ".[dev]"          # pipeline + tests (sin transcripción real)
pip install -e ".[whisper,dev]"  # + faster-whisper (transcripción local GRATIS)
```

> La primera transcripción descarga el modelo Whisper (~500 MB para `small`). Todo corre local: cero costos de API.

## Uso

```bash
clipper init                 # crea data/ y un clipper.yaml editable
# edita clipper.yaml → metadata.kick_channel: TU canal

cp mi-stream.mp4 data/inbox/ # copia tus grabaciones
clipper scan                 # registra los videos nuevos
clipper process              # transcribe, detecta y renderiza clips candidatos
clipper list                 # tabla de candidatos con score
clipper show 3               # por qué existe el clip 3 (señales, metadata)
clipper approve 3            # listo para subir manualmente a TikTok
clipper reject 5 -r "frase cortada"   # alimenta la mejora de reglas
clipper status               # resumen general
```

Los clips quedan en `data/clips/<vod>/clip_XXX_NNs.mp4` con un `.json` al lado (título, descripción, hashtags, señales) listo para copiar/pegar al subir.

### Marcas manuales durante el directo

Dos opciones, ambas con peso máximo en la detección:

1. **Capítulos de OBS** (30.2+): hotkey "Add chapter marker" grabando en Hybrid MP4 — se leen automáticamente.
2. **Archivo sidecar** `mi-stream.mp4.markers` junto al video:

```
# segundos o HH:MM:SS + etiqueta opcional
932.5 clutch increíble
01:23:45 reacción del chat
```

## Configuración

Todo vive en `clipper.yaml` (ver [config/default.yaml](config/default.yaml) comentado): pesos de señales, frases gatillo, duración objetivo, estilo de subtítulos, colores, endcard, canal de KICK, hashtags, proveedor LLM opcional (`none` | `ollama` gratis | `anthropic` en Fase 3).

## Tests

```bash
python -m pytest -m "not integration"   # unitarios (rápidos, sin ffmpeg)
python -m pytest -m integration         # end-to-end: VOD sintético → MP4 validado
python -m pytest                        # todo
```

## Documentación

| Doc | Contenido |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Arquitectura completa y roadmap Fases 1–3 |
| [docs/highlight-rules.md](docs/highlight-rules.md) | Señales, pesos y reglas de corte |
| [docs/visual-template.md](docs/visual-template.md) | Plantilla visual: zonas seguras, subtítulos, endcard |
| [docs/tiktok-api.md](docs/tiktok-api.md) | Realidad de la Content Posting API (auditoría, límites) |
| [docs/kick-api.md](docs/kick-api.md) | Capacidades reales de la API de KICK y estrategia CTA |

## Principios de diseño

- **Revisión humana obligatoria** antes de publicar, hasta que la precisión del detector lo amerite.
- **Nunca clips sin sentido**: sin transcripción no hay clips; los cortes se anclan a límites de frase.
- **Trazabilidad total**: cada clip guarda las señales que lo justifican y cada decisión queda en `events`.
- **Gratis primero**: Whisper local + heurísticas; el LLM es opcional y degradable.
- **Robustez**: nombres saneados, archivos a medio copiar ignorados, temporales siempre limpiados, subprocess sin shell, logs rotativos.
