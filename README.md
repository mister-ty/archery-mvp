# Archery MVP — Fase 1 (F1–F4)

Plataforma de seguimiento longitudinal de entrenamiento de tiro con arco.
**Esta fase implementa F1 (auth + roles), F2 (CRUD deportistas), F3 (creación de sesiones) y F4 (captura de puntuaciones).** Los dashboards F5–F10 quedan como placeholders y se construyen en la siguiente fase, una vez F1–F4 estén estables.

## Requisitos previos

- Node.js 20+
- PostgreSQL 15+ corriendo localmente
- npm 10+ (o pnpm/yarn equivalentes)

## Setup

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Edita .env: ajusta DATABASE_URL, genera AUTH_SECRET con
#   openssl rand -base64 32
# y elige SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD

# 3. Crear la base de datos en Postgres
createdb archery_mvp

# 4. Generar cliente Prisma + correr migraciones
npm run db:generate
npm run db:migrate -- --name init

# 5. Cargar datos maestros + admin inicial (idempotente)
npm run db:seed

# 6. Levantar la app
npm run dev
```

Abre http://localhost:3000 y entra con las credenciales del admin definidas en `.env`.

## Scripts útiles

| Comando | Acción |
|---|---|
| `npm run dev` | Dev server (Next.js) |
| `npm run build` | Build de producción |
| `npm run typecheck` | Verifica tipos sin emitir |
| `npm run db:migrate` | Crea/aplica migración en dev |
| `npm run db:seed` | Carga seeds (re-ejecutable) |
| `npm run db:studio` | Abre Prisma Studio |
| `npm run db:reset` | **DESTRUCTIVO** — recrea BD y re-aplica seeds |

## Flujo de prueba end-to-end

1. Login como admin (credenciales del `.env`).
2. Ir a **Deportistas → Nuevo** y crear un deportista (sin coach por ahora).
3. Ir a **+ (FAB)** o `/sesion/nueva`, seleccionar al deportista, una distancia (ej. 18m), tipo "Técnica", crear sesión.
4. Serás redirigido a la pantalla de **captura de puntuaciones (F4)**.
5. Tocar puntajes; al completar las flechas, "Guardar score set completo".

> Nota: para sesiones grupales (multi-deportista) el creador debe tener perfil de `Coach`. El admin sembrado es `SUPER_ADMIN` y aún no tiene `Coach` asociado — eso se cubre en la Fase 1.2 con el flujo de invitación.

## Roles y permisos (resumen)

| Rol | Crear sesión | Crear deportista | Cargar puntuaciones | Login |
|---|---|---|---|---|
| `SUPER_ADMIN` | sí (individual) | sí | sí | sí |
| `CLUB_ADMIN` | sí (de su club) | sí (de su club) | sí | sí |
| `COACH` | sí (de su club, individual y grupal) | sí | sí | sí |
| `ATHLETE` | no | no | solo en su propia sesión | sí |

## Decisiones técnicas tomadas en esta fase

1. **Sin signup público.** `POST /api/auth/signup` no existe; los usuarios se crean via seed o por flujo de invitación (pendiente Fase 1.2).
2. **`Athlete.userId` opcional** — un coach puede tener deportistas que aún no tienen cuenta.
3. **`ScoreSet` se crea automáticamente** al crear una sesión, uno por distancia. Evita un paso de UX redundante en F4.
4. **`@@unique([sessionId, distance])`** en `ScoreSet` — previene duplicados imposibles deportivamente.
5. **Save de scores = delete + insert** dentro de transacción. Volumen pequeño (≤120 flechas), simplicidad gana.
6. **Service Worker / offline** queda fuera de esta fase. F4 funciona online; el riesgo de pérdida de captura por caída de red se mitiga en Fase 1.2.
7. **No Framer Motion.** Tailwind keyframes + transitions cubren toda la animación necesaria del MVP F1–F4.

## Pendientes explícitos para Fase 1.2

- Flujo de invitación de usuarios (crear COACH y ATHLETE desde admin) — actualmente solo el seed crea SUPER_ADMIN.
- Vista de detalle de deportista con su historial.
- Persistencia parcial offline para F4 (localStorage + retry).
- Tests E2E con Playwright del flujo F1→F4.
- Componentes shadcn/ui formales (ahora son inputs manuales con `.input`).

## Riesgos detectados

| Riesgo | Mitigación actual | Acción Fase 1.2 |
|---|---|---|
| Pérdida de conexión durante captura F4 | Estado en memoria; el usuario re-toca si refresca | Persistencia local + sync diferido |
| Admin sin perfil de Coach no puede crear sesiones grupales | Mensaje claro de error | Flujo de creación de Coach desde admin |
| Sin rate limiting en `/login` | Auth.js gestiona sesión, pero no throttling | Middleware con limitador en memoria o Upstash |
| Sin tests automatizados | Validación manual | Vitest para utils + Playwright para F4 |
