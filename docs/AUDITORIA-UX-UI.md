# Auditoría UX/UI — Archery MVP (2026-06-11)

Auditoría realizada sobre el estado real del proyecto (Fase 6.0 cerrada: 173 unit + 31 E2E verdes).
Fuente de verdad: `.claude/CONTINUACION.md`, memoria del proyecto y lectura directa del código.

**Criterio:** cada hallazgo se justifica por utilidad, claridad, estética deportiva o reducción de
fricción — no por gusto. Las Fases 3.0–5.5 ya cubrieron design system, dark mode, charts con tokens,
ScoreCapture con diana interactiva y PWA; esta auditoría se concentra en lo que quedó por debajo de
ese estándar.

## Restricciones detectadas (no romper)

- E2E dependen de: heading `Archery MVP` (login), botón `Registrar competición` visible en
  `/deportistas/[id]` (coach), botones `Puntaje N`, texto `Mis sesiones`, `Plantillas rápidas`,
  `Historial competitivo`, botón `Tema…`, radios de asistencia, `input[aria-label^="Seleccionar"]`,
  texto del local-part del email en el header.
- Sin Framer Motion; sin cambios de schema, auth, RBAC, contratos analíticos.

---

## Matriz por pantalla

### 1. App shell / Navegación — `src/app/(app)/layout.tsx`

| # | Problema | Impacto | Prioridad | Solución propuesta | Archivos | Riesgo |
|---|---|---|---|---|---|---|
| 1.1 | **FAB “+” del atleta es un callejón sin salida**: apunta a `/sesion/nueva`, que le responde “Solo coaches y administradores pueden crear sesiones”. El atleta sí puede crear sesión en `/mi-progreso/nueva-sesion`. | El CTA principal de la app falla para el rol principal. Percepción de producto roto. | **Alta** | FAB condicionado por rol: atleta → `/mi-progreso/nueva-sesion`. | `(app)/layout.tsx` | Bajo (ningún E2E usa el FAB) |
| 1.2 | **Tabs del atleta degeneradas**: 4 de 5 tabs (Inicio, Progreso, Yo y Torneos-anchor) llevan a `/mi-progreso`. Navegación “de relleno”. | El atleta percibe una app sin contenido; tabs que “no hacen nada”. | **Alta** | Tabs por rol: atleta → Inicio / FAB / Torneos (3 cols); staff → Equipo / Deportistas / FAB / Usuarios (sin “Yo”, que para staff muestra un empty state). | `(app)/layout.tsx`, nuevo `components/nav/BottomNav.tsx` | Bajo |
| 1.3 | **Sin estado activo en tabs**: `TabLink` no marca la ruta actual (sin `aria-current`, sin color). | El usuario no sabe dónde está; estándar básico de tab bars móviles. | **Alta** | `BottomNav` client component con `usePathname`, color primary + `aria-current="page"` en tab activa. | `components/nav/BottomNav.tsx` | Bajo |
| 1.4 | **Desktop sin navegación primaria**: en ≥sm la bottom bar desaparece y el header solo tiene logo + “Usuarios”. No hay forma directa de ir a Equipo/Deportistas/Mi progreso. | Usuarios de escritorio (coaches en club) navegan a ciegas o vía logo→redirect. | **Alta** | Nav horizontal por rol en el header (≥sm) con estado activo. | `(app)/layout.tsx`, nuevo `components/nav/MainNav.tsx` | Bajo (se conserva avatar + nombre que usa el E2E) |

### 2. Dashboard del deportista — `/mi-progreso`

| # | Problema | Impacto | Prioridad | Solución | Archivos | Riesgo |
|---|---|---|---|---|---|---|
| 2.1 | **KPIs sin contexto visual**: `KpiCard` soporta `icon` y `hint` pero la página no los usa. Seis números secos, difíciles de escanear y sin identidad deportiva. | Las métricas protagonistas no se leen rápido; el dashboard parece tabla. | **Alta** | Pasar iconos Lucide (Target, Trophy, Crosshair, Calendar) + hints de contexto (“por flecha”, “mejor 30d”, …). | `mi-progreso/page.tsx`, `deportistas/[id]/page.tsx` | Nulo (props ya existentes) |
| 2.2 | **Tres charts apilados a ancho completo** → scroll muy largo en desktop; lectura secuencial innecesaria. | Lectura lenta del “performance overview”; la página se siente lista, no dashboard. | **Alta** | Mantener Evolución a ancho completo; Consistencia + Volumen en `lg:grid-cols-2`. | `mi-progreso/page.tsx`, `deportistas/[id]/page.tsx` | Bajo (ResponsiveContainer se adapta) |
| 2.3 | **Form de competición siempre expandido** empuja la lista del historial y alarga la página. | Fricción/ruido para el caso común (consultar, no registrar). | Media | Colapsar en `<details>` nativo **solo en `/mi-progreso`** (el lado coach lo exige un E2E). | `mi-progreso/page.tsx` | Bajo |
| 2.4 | Empty states de fallback (`No se encontraron datos`) sin icono ni acción. | Estado pobre en un camino raro pero visible. | Baja | Icono + descripción. | `mi-progreso/page.tsx` | Nulo |

### 3. Dashboard del coach — `/equipo` + `TeamRoster`

| # | Problema | Impacto | Prioridad | Solución | Archivos | Riesgo |
|---|---|---|---|---|---|---|
| 3.1 | **Filas del roster sin avatar** (la lista de `/deportistas` sí los tiene) y **delta sin indicador de tendencia** (solo signo + color). | Escaneo lento de la tabla principal del coach; inconsistencia visual entre listas. | **Alta** | Avatar `xs` junto al nombre; iconos TrendingUp/Down en delta; “Última sesión” relativa (`hace 3d`). | `components/team/TeamRoster.tsx` | Bajo (checkbox `aria-label` intacto) |
| 3.2 | **Banner de alertas con amarillo hardcodeado** (`border-yellow-400 bg-yellow-50`) en vez de tokens `warning` del design system. | Inconsistencia con el resto del sistema; dark mode a medias. | Media | Tokens `border-warning/40 bg-warning/10 text-warning`. | `TeamRoster.tsx` | Bajo |
| 3.3 | **Checkboxes de comparación de 16px** en móvil — por debajo del target táctil mínimo. | Fricción real en mobile-first; toques fallidos. | Media | `h-5 w-5` + área de toque con padding. | `TeamRoster.tsx` | Bajo |
| 3.4 | Empty state del roster es un `div` plano, no el componente `EmptyState`. | Inconsistencia. | Baja | Usar `EmptyState` con icono Users + CTA. | `TeamRoster.tsx` | Nulo |
| 3.5 | KPIs del `TeamSummaryBand` sin iconos (las celdas son solo texto). | Lectura más lenta del overview. | Baja | Opcional: iconos discretos por celda. Se pospone — la banda ya es legible. | `TeamSummaryBand.tsx` | — |

### 4. Perfil del deportista — `/deportistas/[id]`

| # | Problema | Impacto | Prioridad | Solución | Archivos | Riesgo |
|---|---|---|---|---|---|---|
| 4.1 | **Hero sin identidad deportiva**: no muestra modalidad, categoría ni coach — los tres datos que definen al atleta. | El coach debe recordar de memoria quién es quién; hero desaprovechado. | **Alta** | Chips de modalidad/categoría en el hero. Requiere extender el `select` de `getAthleteDashboard` con `bowModality.name` y `category.name` (**cambio aditivo**, sin tocar lógica ni queries extra). | `server/actions/dashboard.ts`, `deportistas/[id]/page.tsx` | Bajo (campos nuevos, ninguno eliminado) |
| 4.2 | `SESSION_TYPE_LABEL` duplicado localmente (ya existe `src/lib/session-labels.ts`). | Deuda DRY: riesgo de divergencia de labels. | Media | Importar de `session-labels.ts` aquí y en `sesion/[id]`. | `deportistas/[id]/page.tsx`, `sesion/[id]/page.tsx` | Nulo |
| 4.3 | Mismos hallazgos 2.1/2.2 (KPIs sin contexto, charts apilados). | Ídem. | **Alta** | Ídem 2.1/2.2. | `deportistas/[id]/page.tsx` | Bajo |

### 5. Comparativos — `/equipo/comparar`

| # | Problema | Impacto | Prioridad | Solución | Archivos | Riesgo |
|---|---|---|---|---|---|---|
| 5.1 | El resaltado verde de “mejor del grupo” **no se explica en ningún lado**. | El coach debe adivinar la semántica (¿mejor? ¿seleccionado?). | Media | Leyenda corta bajo el header (“■ mejor del grupo por métrica”). | `equipo/comparar/page.tsx` | Nulo |
| 5.2 | Highlight con `bg-green-50` hardcoded en vez de token `success`. | Consistencia dark mode. | Baja | `bg-success/10` (+ texto). | `equipo/comparar/page.tsx` | Bajo (E2E solo valida textos de filas) |

### 6. Sesiones — `/sesion/nueva` + `SessionForm`

| # | Problema | Impacto | Prioridad | Solución | Archivos | Riesgo |
|---|---|---|---|---|---|---|
| 6.1 | **`SessionForm` inyecta un `<style>` global no-scoped que redefine `.input` para toda la app mientras está montado** (altura 3rem, sin focus glow del design system). | Bug real de CSS: pisa el `.input` global; inconsistencia de inputs en la misma pantalla. | **Alta** | Eliminar el `<style>`; usar la clase `.input` del design system (`globals.css`). | `components/sessions/SessionForm.tsx` | Bajo (solo estilos) |
| 6.2 | `/sesion/nueva` sin `PageHeader` ni breadcrumb — único título `h1` plano; rompe el patrón eyebrow+título del resto de la app. | Pantalla clave (la abre el FAB) se siente de otra app. | Media | `PageHeader` con eyebrow “Sesión” + descripción. | `sesion/nueva/page.tsx` | Nulo |
| 6.3 | El mensaje de “solo coaches” para atletas es un dead-end sin CTA. | Ídem 1.1; queda mitigado al arreglar el FAB, pero el guard debería redirigir. | Media | Redirect del atleta a `/mi-progreso/nueva-sesion` en vez de mensaje. | `sesion/nueva/page.tsx` | Bajo |

### 7. Captura de puntuación — `/sesion/[id]/puntuacion` + `ScoreCapture`

Ya recibió dos pasadas de polish (Fase 4.4: pills, pulse del slot activo, progress gradient;
Fase 5.5: diana interactiva WA con toggle persistente). **Sin hallazgos accionables** — es la
pantalla más cuidada de la app y los E2E la cubren densamente. No tocar.

### 8. Asistencia, observaciones, sesión detalle — `/sesion/[id]`

| # | Problema | Impacto | Prioridad | Solución | Archivos | Riesgo |
|---|---|---|---|---|---|---|
| 8.1 | `SESSION_TYPE_LABEL` duplicado (ver 4.2). | DRY. | Media | Importar de `session-labels.ts`. | `sesion/[id]/page.tsx` | Nulo |
| 8.2 | Banners de estado (en progreso / corrección / cerrada) bien resueltos con tokens warning/info. | — | — | Sin cambios. | — | — |

### 9. Charts compartidos — `EvolutionChart`, `ConsistencyChart`, `WeeklyVolumeChart`, `ClubTrendChart`

| # | Problema | Impacto | Prioridad | Solución | Archivos | Riesgo |
|---|---|---|---|---|---|---|
| 9.1 | **Empty states planos** (`<div>Sin sesiones registradas aún.</div>`) mientras el resto de la app usa `EmptyState` con icono. | Inconsistencia visible justo en cuentas nuevas (primera impresión). | **Alta** | `EmptyState` compact con icono (LineChart/BarChart3) y copy accionable. | los 4 charts | Nulo |
| 9.2 | Pills de distancia en `EvolutionChart` usan `text-white` fijo; con la serie ámbar el contraste es pobre. | Accesibilidad (contraste) en un control interactivo. | Baja | Texto oscuro cuando la serie es ámbar, o `text-white` + `font-semibold` con sombra. Documentado como pendiente. | `EvolutionChart.tsx` | — |

### 10. Invitaciones y onboarding — `/admin/usuarios`, `/admin/usuarios/nuevo`, `/activar/[token]`, `/onboarding`

| # | Problema | Impacto | Prioridad | Solución | Archivos | Riesgo |
|---|---|---|---|---|---|---|
| 10.1 | `/admin/usuarios/nuevo` con `h1` plano y breadcrumb hand-rolled (`← Usuarios`); `/deportistas/nuevo` igual (sin header de patrón). | Inconsistencia en flujo de administración. | Media | `PageHeader` + breadcrumb con ChevronLeft (patrón de `sesion/[id]`). | `admin/usuarios/nuevo/page.tsx`, `deportistas/nuevo/page.tsx` | Bajo (E2E solo usa botones del form) |
| 10.2 | `/admin/usuarios` bien resuelta (avatares, badges de rol, EmptyState, counts). | — | — | Sin cambios estructurales. | — | — |
| 10.3 | Onboarding y activación ya comparten lenguaje hero de auth (Fase 3.0). | — | — | Sin cambios. | — | — |

### 11. Login — `/login`

| # | Problema | Impacto | Prioridad | Solución | Archivos | Riesgo |
|---|---|---|---|---|---|---|
| 11.1 | El producto se presenta como **“Archery MVP”** — “MVP” es jerga interna y resta percepción profesional. | Primera impresión institucional débil. | Media | **Decisión de marca del usuario** (renombrar afecta logo, manifest, E2E `auth.spec.ts:7`). Documentado como pendiente, no se cambia unilateralmente. | `login/page.tsx`, `logo.tsx`, `manifest.json`, E2E | Medio |
| 11.2 | Hero auth, focus glow, estados de loading: bien resueltos. | — | — | Sin cambios. | — | — |

---

## Plan de implementación (Etapa 2)

**Bloque ALTA (se implementa ahora):**
1. Navegación: `BottomNav` por rol con estado activo + FAB correcto por rol + `MainNav` desktop (1.1–1.4).
2. KPIs con icono + hint y grid de charts 2-col en lg (2.1, 2.2, 4.3).
3. Hero del atleta con chips de modalidad/categoría (4.1 — select aditivo).
4. Empty states de los 4 charts con `EmptyState` (9.1).
5. Fix del `<style>` global en `SessionForm` (6.1).
6. Roster: avatares + iconos de tendencia + fecha relativa + tokens warning + checkbox táctil (3.1–3.4).

**Bloque MEDIA (se implementa ahora):**
7. `PageHeader`/breadcrumb en `/sesion/nueva`, `/deportistas/nuevo`, `/admin/usuarios/nuevo` + redirect del atleta (6.2, 6.3, 10.1).
8. Form de competición colapsable en `/mi-progreso` (2.3).
9. Leyenda de “mejor del grupo” en comparar + token success (5.1, 5.2).
10. DRY de `SESSION_TYPE_LABEL` (4.2, 8.1).

**Pendientes recomendados (no implementados, requieren decisión o más alcance):**
- Renombrar marca “Archery MVP” (11.1) — decisión de producto.
- Contraste de pill ámbar en `EvolutionChart` (9.2).
- Iconos en `TeamSummaryBand` (3.5).
- Selector de fecha en `SessionForm` (hoy siempre crea “ahora”) — cambio de lógica, fuera de alcance UX.
