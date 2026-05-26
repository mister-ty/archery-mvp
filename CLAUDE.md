# Archery MVP — Contexto para Claude Code

Plataforma de seguimiento longitudinal de entrenamiento de tiro con arco. No es un gestor de torneos (Ianseo cubre eso); el diferencial es seguimiento de sesiones, evolución del rendimiento, herramientas para coaches y reportes por equipo.

## Stack

- **Next.js 14.2.15** App Router (server actions, route handlers, RSC).
- **TypeScript 5.6** estricto.
- **PostgreSQL 17** local en `localhost:5432`, base `archery_mvp`.
- **Prisma 5.x** ORM (cliente Prisma singleton en `src/lib/db.ts`).
- **Auth.js v5 beta** con Credentials provider; JWT sessions de 8h.
- **TailwindCSS 3.4** + **shadcn/ui** (`components.json` configurado).
- **Recharts 3** para gráficas, **Sonner** para toasts, **Lucide** para iconos.
- **@react-pdf/renderer** para PDFs (server-side, runtime `nodejs`).
- **Vitest 4** unit tests, **Playwright 1.60** E2E.

## Comandos esenciales

```bash
npm run dev          # dev server (puerto 3000 si libre, si no el siguiente)
npm run typecheck    # tsc --noEmit
npm run build        # prisma generate + next build
npm run db:migrate   # nueva migración en dev (requiere --name)
npm run db:seed      # tablas maestras + admin (idempotente)
npx vitest run       # tests unitarios
npx playwright test  # tests E2E (requiere dev server)
```

> **Credenciales seed:** `admin@archery.local` / `ChangeMe!ASAP123` (SUPER_ADMIN).
> **Datos demo extra** (en `prisma/test-data.ts`): coach Carlos Mendoza, atletas Sofía Ramírez (Recurvo) y Juan Torres (Compuesto).

## Patrones de código — mantener

- **Server Components** para queries y guards de auth. **Server Actions** (`'use server'`) para mutaciones. Las únicas Route Handlers son `/api/auth/*` (NextAuth), `/api/invite` (REST por conveniencia) y `/api/reports/athlete/[id]/{csv,pdf}` (descargas).
- **Client Components** solo cuando hay estado interactivo (formularios, charts, toggles).
- **Validación Zod en `src/lib/validation/`** — compartida entre cliente y server. Schemas exportan `type FooInput = z.infer<...>`.
- **`ActionResult<T>`** (definido en `src/server/actions/athletes.ts`) es el tipo de retorno de toda server action: `{ ok: true, data } | { ok: false, error, fieldErrors? }`.
- **RBAC**: `requireSession()` y `requireRole(allowed: Role[])` en `src/lib/rbac.ts`; `canManageClub(role, userClubId, targetClubId)` para chequeos por club.
- **Soft delete** via `active: boolean` en `User` y `Athlete`. Nunca `DELETE` físico.
- **`revalidatePath`** al final de cada mutación; las rutas afectadas más comunes son `/equipo`, `/mi-progreso`, `/deportistas`, `/sesion/[id]`.
- **shadcn/ui** para todos los componentes UI nuevos. Tokens Tailwind ya en uso: `bg-card`, `bg-muted/50`, `text-muted-foreground`, `border-primary`, `rounded-xl`, variantes `dark:`.

## Decisiones congeladas — no renegociar

- Sin signup público (usuarios creados por admin/coach).
- Sin scraping de Ianseo, sin registro de lesiones, sin gestión de torneos.
- Sin IA predictiva ni rankings externos.
- Sin Framer Motion (Tailwind + CSS keyframes son suficientes).
- Mobile-first real (bottom tab bar visible en `< sm`).

## Schema Prisma — entidades principales

| Tabla | Notas |
|---|---|
| `User` | id, email único, passwordHash bcrypt, role, clubId opcional |
| `Club` | sin unique natural (usar `findFirst` + `create`) |
| `Coach` | 1:1 con User (`userId` unique) |
| `Athlete` | `userId` opcional (puede no tener cuenta), `documentId` unique, FKs a `BowModality`, `Category`, `Club`, `Coach` |
| `TrainingSession` | FK a Athlete, opcional `sessionGroupId`; `type`, `indoor`, `weather` |
| `SessionGroup` | agrupa varias TrainingSessions del mismo día y coach |
| `ScoreSet` | unique `(sessionId, distance)` — un set por distancia |
| `Arrow` | unique `(scoreSetId, endNumber, arrowNumber)`; `isX`, `isMiss` |
| `Attendance` | unique `sessionId` — un registro por TrainingSession; default status PRESENT |
| `CoachObservation` | tags many-to-many; `editableUntil = createdAt + 24h` |

## Funcionalidades cubiertas (F1–F10)

- **F1** Auth con roles `ATHLETE | COACH | CLUB_ADMIN | SUPER_ADMIN`.
- **F2** CRUD deportistas.
- **F3** Creación de sesiones individuales y grupales (SessionGroup).
- **F4** Captura de puntuaciones por flecha (`ScoreCapture.tsx`, mobile-first).
- **F5** Dashboard deportista (`/mi-progreso`) — KPIs, evolución, sesiones, observaciones.
- **F6** Dashboard coach (`/equipo`) — alertas inactividad/caída, tabla con `attendancePct`.
- **F7** Gráfica de evolución por distancia (`EvolutionChart.tsx`, Recharts).
- **F8** Observaciones del coach con tags, ventana de edición 24h.
- **F9** Asistencia por TrainingSession (upsert), 4 estados, motivo opcional. UI en `/sesion/[id]` (staff only); grupales muestran todos los atletas del grupo.
- **F10** Exportación CSV (RFC 4180, BOM UTF-8 para Excel) y PDF (`@react-pdf/renderer`, server-side) por deportista. Botones en `/deportistas/[id]` y `/mi-progreso`.

## Endpoints de reportes (F10)

- `GET /api/reports/athlete/[id]/csv` → text/csv con `Content-Disposition: attachment`, BOM, summary lines al final con `#`.
- `GET /api/reports/athlete/[id]/pdf` → application/pdf streaming.

Ambos: runtime `nodejs`, `dynamic = 'force-dynamic'`, RBAC vía `getAthleteReport()` (`src/lib/reports/athlete-report-data.ts`).

## Pendientes (Fase 2 / no MVP)

- Flujo de invitación de usuarios — UI (`/admin/usuarios`, `/activar/[token]`). La route `POST /api/invite` existe.
- Onboarding wizard para coaches sin perfil.
- Rate limiting con Upstash (config en `src/lib/rate-limit.ts` requiere `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`; inoperativo sin ellas).
- Persistencia offline F4 (localStorage + retry).
- Tests E2E reales con Playwright (config lista, sin specs).
