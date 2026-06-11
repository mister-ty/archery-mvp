# Arquitectura

## Objetivo

Convertir transmisiones largas en clips cortos de alto rendimiento para TikTok que lleven audiencia a los directos de KICK, con calidad de edición consistente, métricas trazables y aprobación humana en el medio.

## Flujo completo (visión Fases 1–3)

```
[OBS grabación / VOD descargado]          [marcas en vivo: hotkey OBS / .markers]
        │                                           │
        ▼                                           ▼
┌─ INGESTA ──────────────────────────────────────────────────────────┐
│ inbox/ → tamaño estable → firma (idempotente) → ffprobe → SQLite   │
└────────────────────────────────────────────────────────────────────┘
        ▼
┌─ TRANSCRIPCIÓN ────────────────────────────────────────────────────┐
│ faster-whisper local (word timestamps + VAD), caché por hash       │
└────────────────────────────────────────────────────────────────────┘
        ▼
┌─ DETECCIÓN ────────────────────────────────────────────────────────┐
│ señales/seg: RMS audio · keywords · risas · word-rate · markers    │
│ [Fase 3: densidad de chat de KICK vía webhooks]                    │
│ → score combinado → picos → ventanas 18–35s ancladas a frases      │
└────────────────────────────────────────────────────────────────────┘
        ▼
┌─ EDICIÓN (FFmpeg, un solo encode) ─────────────────────────────────┐
│ corte preciso → 9:16 1080x1920 → zoom moderado del gancho →        │
│ subtítulos ASS quemados → barra de progreso → loudnorm -14 LUFS →  │
│ endcard CTA KICK → MP4 H.264/AAC +faststart                        │
└────────────────────────────────────────────────────────────────────┘
        ▼
┌─ METADATA ─────────────────────────────────────────────────────────┐
│ título gancho + hashtags + descripción con CTA                     │
│ (heurístico; LLM opcional: ollama gratis / anthropic Fase 3)       │
└────────────────────────────────────────────────────────────────────┘
        ▼
┌─ REVISIÓN HUMANA ──────────────────────────────────────────────────┐
│ F1: CLI list/show/approve/reject  ·  F2: dashboard web             │
└────────────────────────────────────────────────────────────────────┘
        ▼
┌─ PUBLICACIÓN ──────────────────────────────────────────────────────┐
│ F1–F2: manual (clip + sidecar .json listos para pegar)             │
│ F3: TikTok Content Posting API (solo tras auditoría aprobada)      │
│ KICK: NO hay API de subida de clips → CTA + webhooks de chat       │
└────────────────────────────────────────────────────────────────────┘
        ▼
┌─ MÉTRICAS (F3) ────────────────────────────────────────────────────┐
│ views/likes/shares/follows/retención por clip → recomendaciones    │
│ de formato (duración, tipo de gancho, horario)                     │
└────────────────────────────────────────────────────────────────────┘
```

## Modelo de datos (SQLite, `stream_clipper/db.py`)

| Tabla | Propósito |
|---|---|
| `vods` | un registro por grabación; `hash` único = idempotencia; estado del pipeline |
| `clips` | candidatos y su ciclo de vida `candidate → approved/rejected → published`; `signals_json` explica por qué existe |
| `events` | bitácora por etapa (probe/transcribe/detect/render/review) para depurar |
| `metrics` | Fase 3: rendimiento por clip y plataforma; el schema ya existe |

SQLite es suficiente hasta Fase 2; si el dashboard se despliega multi-usuario, migrar a Postgres es directo (el SQL es estándar).

## Decisiones clave

- **FFmpeg puro, sin MoviePy**: un solo proceso de encode por clip, filtergraph determinista, sin dependencias frágiles.
- **Transcripción local**: costo cero, sin subir VODs a terceros, sin límites de duración.
- **`require_transcript: true`**: sin palabras no hay clips. Un clip mudo de "pico de audio" suele ser ruido.
- **Estado por etapas en DB**: re-ejecutar `clipper process` continúa donde quedó; la transcripción se cachea por hash.
- **Aprobación humana**: ningún clip sale del sistema sin pasar por `approve`. Cuando exista historial de métricas (F3) se podrá evaluar si algún flujo merece auto-aprobación.

## Roadmap

### Fase 2 — Dashboard de revisión
- Web app (recomendado: Next.js + shadcn/ui) leyendo la misma DB vía API ligera (FastAPI o route handlers).
- Preview del clip en el navegador, editar título/descripción/hashtags, aprobar/rechazar con motivo, descargar.
- Mejoras de edición: modo split facecam+gameplay (dos crops apilados), recorte de silencios intra-clip, B-roll del juego.
- Cola de procesamiento (un worker, `process` como daemon con watchdog en inbox).

### Fase 3 — Publicación y aprendizaje
- **TikTok**: OAuth + Content Posting API Direct Post. Bloqueante: auditoría de TikTok (ver docs/tiktok-api.md). Hasta entonces los posts vía API quedan `SELF_ONLY`.
- **Métricas**: ingesta diaria a `metrics` (API de TikTok para cuentas autorizadas, o registro manual/CSV al inicio).
- **Señal de chat KICK**: webhook `chat.message.sent` durante el directo → densidad de mensajes/emotes por minuto como señal adicional del detector (la API de KICK sí permite esto).
- **Recomendaciones**: análisis sobre `metrics` × `signals_json` (qué tipo de gancho, duración y horario rinde mejor) → ajustar pesos de `detect.weights` con evidencia.
- **LLM**: activar `llm.provider: anthropic` para titulación A/B si el ROI lo justifica.

## Seguridad y robustez implementadas (F1)

- Nombres saneados (`safe_slug`): nunca se interpola el nombre original del archivo en comandos.
- `subprocess` con lista de argumentos, jamás `shell=True`; timeouts en todos los procesos externos.
- Archivos a medio copiar ignorados (doble lectura de tamaño); chequeo de espacio libre antes de procesar.
- Temporales por job en `data/work/<slug>/`, borrados en `finally` aunque el render falle.
- Fallos por VOD aislados: un VOD corrupto marca `failed` y el lote continúa.
- Logs a consola + archivo rotativo (`data/logs/clipper.log`, 5 MB × 3).
