# Plantilla visual de clips

Implementación: `stream_clipper/edit/renderer.py` + `subtitles.py`. Estilo consistente = marca reconocible en el feed.

## Lienzo 1080×1920 (9:16)

```
┌─────────────────────────┐ 0
│   zona segura superior  │   ~250px: ahí va el caption flotante de TikTok
│                         │
│        VIDEO            │   crop centrado del VOD (offset X configurable
│      (gameplay /        │   con edit.crop_x_offset para encuadrar facecam)
│       facecam)          │
│                         │
│    SUBTÍTULOS AQUÍ      │   ~1360px de altura (margin_v 560 desde abajo):
│   (2-3 palabras, bold)  │   visibles sin chocar con UI inferior de TikTok
│                         │
│  username / desc UI ⚠   │   ~420px inferiores: TikTok dibuja encima
├─────────────────────────┤
│ ▓▓▓▓▓▓▓░░░░░░░░░░░░░░░ │   barra de progreso 12px, verde KICK #53FC18
└─────────────────────────┘ 1920
```

## Elementos

| Elemento | Spec | Por qué |
|---|---|---|
| **Crop 9:16** | `scale` cubriendo + `crop` centrado con offset X | funciona con cualquier resolución de origen |
| **Zoom dinámico** | 1.00 → 1.08 en los primeros 1.2s, luego fijo | energía en el gancho sin marear |
| **Subtítulos** | DejaVu Sans Bold 64px, MAYÚSCULAS, borde negro 4px, 2-3 palabras por línea, sincronizados por palabra, fade 60/40ms | legibles sin audio (la mayoría del feed se ve en silencio) |
| **Barra de progreso** | 12px, #53FC18, llena de izq→der durante todo el clip | retención: el cerebro quiere ver la barra llegar al final |
| **Endcard CTA** | 1.6s, fondo #0F0F0F, "EN VIVO EN KICK" blanco 96px + "kick.com/<canal>" verde 64px | cierre consistente; el CTA es la razón de negocio del clip |
| **Audio** | loudnorm 2 pasadas a −14 LUFS, TP −1.5 | volumen parejo entre clips; estándar short-form |
| **Export** | H.264 yuv420p CRF 19, AAC 192k 48kHz, `+faststart`, 30fps | compatibilidad máxima + re-encode amable de TikTok |

## Personalización

Todo en `clipper.yaml → edit`. Para cambiar la identidad visual:

- `subtitles.primary_color` / `outline_color` (RRGGBB)
- `progress_bar.color` — verde KICK por defecto, alinea con tu marca
- `endcard.text` / `subtext` / `bg_color`
- Fase 2: layout split facecam arriba + gameplay abajo (dos crops del mismo frame apilados), logo/watermark PNG con `overlay`.

## Frame de verificación (test de integración)

El test e2e (`tests/test_integration.py`) valida con ffprobe: 1080×1920, h264+aac, duración = clip + endcard. Para inspección visual rápida:

```bash
ffmpeg -ss 2 -i data/clips/<vod>/clip_001_31s.mp4 -frames:v 1 check.png
```
