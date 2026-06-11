# KICK Dev API — capacidades reales verificadas (junio 2026)

Fuentes: [dev.kick.com](https://dev.kick.com/), [KickEngineering/KickDevDocs](https://github.com/KickEngineering/KickDevDocs), [Help Center — Developers & API](https://help.kick.com/en/collections/5494074-developers-api).

## Lo que la API oficial SÍ ofrece

- **OAuth** (apps creadas desde el tab "developer" de la cuenta) con scopes y refresh tokens.
- **Lectura**: canales por slug, livestreams (`broadcaster_user_id`), metadata del directo (título, categoría, viewers, thumbnail), leaderboard de kicks.
- **Chat**: enviar y borrar mensajes, respuestas.
- **Webhooks**: `chat.message.sent`, eventos de moderación, kicks regalados, metadata del livestream.

## Lo que NO existe (verificado en la documentación oficial)

- ❌ **Subir o crear clips por API.**
- ❌ Subir videos/VODs.
- ❌ Publicar contenido de ningún tipo.

**Consecuencia de diseño:** este sistema NUNCA promete auto-publicación en KICK. Cualquier herramienta que lo prometa está usando endpoints no oficiales (riesgo de ban) o mintiendo.

## Cómo usamos KICK en este proyecto

1. **Destino del CTA** (Fase 1, ya implementado): endcard "EN VIVO EN KICK → kick.com/<canal>" en cada clip + CTA en la descripción de TikTok. El objetivo del clip es llevar tráfico al directo.
2. **Fuente de señales** (Fase 3): suscripción al webhook `chat.message.sent` durante el directo → densidad de mensajes y emotes por minuto se vuelve una señal más del detector de highlights (cuando el chat explota, algo pasó). Guardar `(timestamp, count)` y alinearlo con el VOD por hora de inicio del stream.
3. **Métricas indirectas** (Fase 3): viewers del directo antes/después de publicar clips (endpoint de livestreams) para estimar conversión TikTok → KICK, junto con UTM en el link de bio.

## Revisar periódicamente

KICK publica su roadmap en el repositorio de docs. Si algún día exponen creación de clips (la función de clips existe en la plataforma web), se integraría en la etapa de publicación con el mismo flujo de aprobación humana.
