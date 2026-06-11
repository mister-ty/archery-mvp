# Reglas de detección de highlights

Implementación: `stream_clipper/detect/scorer.py`. Todos los valores son configurables en `clipper.yaml → detect`.

## Señales (series por segundo del VOD)

| Señal | Cómo se calcula | Peso default | Qué captura |
|---|---|---|---|
| `audio` | z-score del RMS por segundo (negativos → 0) | 1.0 | gritos, reacciones, hype del juego |
| `keywords` | frases gatillo en la transcripción (multi-palabra, insensible a acentos), peso por frase | 1.2 | "no puede ser", "esto es clip", "gané"… |
| `laughter` | regex sobre palabras del transcript (`jaja/jeje/xd/lol`) | 0.9 | risas del streamer |
| `wordrate` | z-score de palabras/segundo | 0.4 | hablar acelerado = excitación |
| `marker` | marcas manuales (sidecar `.markers` + capítulos OBS), ±2s | **3.0** | criterio humano en vivo: manda |

`score(t) = Σ peso_señal × señal(t)`, suavizado con kernel [0.25, 0.5, 0.25] para que el ruido de 1 segundo no gane.

## De pico a clip (anti "frases cortadas")

1. **Picos**: segundos con `score ≥ score_threshold` (1.6), separados ≥ `min_peak_separation` (12s), de mayor a menor score.
2. **Gancho**: el clip arranca en el inicio de la frase que contiene el pico. Si esa frase empezó hace más de `hook_max_lead + 4s`, se ancla a la palabra más cercana a `pico − hook_max_lead`. Lead-in de 0.2s. **El espectador ve el momento fuerte en ≤2–6s.**
3. **Cierre**: se elige el final de segmento dentro de `[start+18, start+35]` que maximice `pausa posterior + puntuación final + desarrollo`. Si ninguna frase cierra en la ventana, fallback a una palabra seguida de ≥0.6s de silencio. **Si no hay cierre coherente, el candidato se descarta** — preferimos no generar el clip a publicar uno sin sentido.
4. **Dedupe**: candidatos con solapamiento > `max_overlap` (40%) compiten; gana el de mayor score. Máximo `max_clips_per_vod` (8).
5. **Sin transcripción no hay clips** (`require_transcript: true`).

## Trazabilidad

Cada clip guarda en `clips.signals_json`: el instante del pico, score combinado, z de audio, keywords encontradas (con timestamps), risas y markers dentro del rango. `clipper show <id>` lo muestra. Esto permite:

- auditar por qué el detector eligió algo (y corregir pesos cuando se equivoca);
- correlacionar en Fase 3 qué señales producen los clips con mejor retención.

## Cómo afinar con tus rechazos

`clipper reject <id> -r "motivo"` guarda el motivo. Revisa periódicamente:

```sql
SELECT rejected_reason, COUNT(*) FROM clips WHERE status='rejected' GROUP BY 1;
```

- Muchos "no pasa nada interesante" → subir `score_threshold` o bajar peso de `wordrate`.
- Muchos "empieza tarde/corta el momento" → revisar `hook_max_lead`.
- Momentos buenos que no detecta → añadir keywords de tu juego/jerga y usar más las marcas en vivo (señal más fuerte y barata que cualquier heurística).
