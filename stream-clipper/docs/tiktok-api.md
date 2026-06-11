# TikTok Content Posting API — realidad verificada (junio 2026)

Fuente: [developers.tiktok.com — Content Posting API](https://developers.tiktok.com/doc/content-posting-api-get-started) y [guidelines](https://developers.tiktok.com/doc/content-sharing-guidelines).

## Lo que hay que saber antes de prometer "publicación automática"

1. **Clientes NO auditados** (estado inicial de cualquier app):
   - Solo pueden publicar con visibilidad **`SELF_ONLY`** (privado). Para hacer público un post hay que entrar a TikTok y cambiarlo a mano, post por post.
   - Máximo **5 usuarios** publicando por ventana de 24h por cliente API.
   - Las cuentas deben estar en privado al momento de postear.
   - Conclusión: **inútil para crecimiento** hasta pasar auditoría.

2. **Auditoría**: evaluación de cumplimiento de 2–4 semanas, con varias rondas de feedback. Hay que solicitar el scope `video.publish`, justificar el caso de uso y pasar revisión de UX.

3. **Requisitos de UX verificados por TikTok** (Direct Post):
   - Antes de cada publicación la app debe mostrar **username y avatar** del creador que va a publicar.
   - El creador debe poder configurar visibilidad, comentarios, duet, stitch — no se pueden hardcodear.
   - Límite de posts por cuenta en 24h (cap según lo declarado en la auditoría).

4. **OAuth**: Login Kit con scopes `user.info.basic` + `video.publish` (y `video.upload` para borradores). Tokens de refresco gestionados server-side; nunca en el cliente.

## Estrategia del proyecto

| Fase | Publicación |
|---|---|
| F1–F2 | **Manual**: el sistema deja el MP4 + título/descripción/hashtags en un sidecar `.json`. Subir a mano tarda <1 min/clip y no tiene riesgo de cuenta. |
| F3 (pre-auditoría) | Opcional: Direct Post en `SELF_ONLY` como "borradores remotos", revisión y publicación manual desde la app de TikTok. |
| F3 (auditada) | Direct Post completo con pantalla de confirmación (username/avatar + opciones de visibilidad), registro en `events` y caps respetados. |

> Alternativa intermedia sin auditoría: **Upload (Draft) API** — envía el video a la bandeja de borradores del creador, que lo publica desde la app. Menos fricción que subir el archivo a mano y sin el bloqueo de `SELF_ONLY` en el resultado final, porque la publicación la hace el humano en TikTok.

## Anti-patrones que evitamos

- Subir el mismo clip a varias cuentas (spam según ToS).
- Publicar sin intervención humana antes de tener historial de precisión.
- Guardar tokens en el repo o en la DB sin cifrar (F3: usar variables de entorno/secret manager).
