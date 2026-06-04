/**
 * Tip templates per (RuleKey, Audience).
 *
 * Two strict goals:
 *  1. Every number in the rendered string came from the rule's `data` —
 *     never invent. If a value is null the template either omits it or
 *     uses a safe fallback ("σ").
 *  2. Tone is calibrated per audience. Athlete: first person, supportive.
 *     Coach: third person, technical, actionable.
 *
 * Functions receive `data: Record<string, unknown>` (typed loosely on
 * purpose — rules guarantee shape via the registry below).
 */

import type { Audience, RuleKey } from './types';

type Data = Record<string, number | string | null | undefined>;
type Template = (data: Data) => { title: string; detail: string };
type TemplateMap = Record<Audience, Template>;

function n(v: unknown, digits = 1): string {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—';
  return v.toFixed(digits);
}

function int(v: unknown): string {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—';
  return String(Math.round(v));
}

export const TIP_TEMPLATES: Record<RuleKey, TemplateMap> = {
  // ── Cold start ─────────────────────────────────────────────────────────
  'noData.cold': {
    athlete: () => ({
      title: 'Aún no tienes flechas registradas',
      detail:
        'Empieza una sesión rápida desde "Nueva sesión" — cuando captures unas cuantas, verás métricas y recomendaciones aquí.'
    }),
    coach: (d) => ({
      title: `${d.athleteName ?? 'Este atleta'} no tiene actividad`,
      detail:
        'Sin flechas en los últimos 30 días no hay nada que analizar. Verifica si su perfil ya tiene cuenta activada y asígnale una sesión inicial.'
    })
  },

  // ── ACWR ───────────────────────────────────────────────────────────────
  'acwr.overload': {
    athlete: (d) => ({
      title: 'Estás en sobrecarga',
      detail: `Tu carga aguda está muy alta (ACWR ${n(d.ratio, 2)}). Considera bajar volumen esta semana o tomar un día de descanso para evitar lesiones.`
    }),
    coach: (d) => ({
      title: `${d.athleteName ?? 'Atleta'} en sobrecarga`,
      detail: `ACWR ${n(d.ratio, 2)} (>1.5). Recomendación: reducir volumen 30-40% esta semana o sustituir por sesión técnica corta.`
    })
  },
  'acwr.caution': {
    athlete: (d) => ({
      title: 'Carga elevada',
      detail: `Tu ACWR está en ${n(d.ratio, 2)}. Estás en zona de precaución — vigila la fatiga y considera una semana de transición.`
    }),
    coach: (d) => ({
      title: `${d.athleteName ?? 'Atleta'} en precaución`,
      detail: `ACWR ${n(d.ratio, 2)} (1.3-1.5). Mantén el volumen sin subirlo y monitorea técnica.`
    })
  },
  'acwr.inactive': {
    athlete: (d) => ({
      title: `Llevas ${int(d.daysSince)} días sin entrenar`,
      detail:
        'Retoma con una sesión corta y volumen bajo. Tu carga crónica está cayendo rápido — ejercicios técnicos a distancia corta son una buena entrada.'
    }),
    coach: (d) => ({
      title: `${d.athleteName ?? 'Atleta'} inactivo (${int(d.daysSince)}d)`,
      detail:
        'Hace más de 14 días sin sesión. Contáctalo y planifica un retorno progresivo (50% del volumen habitual la primera semana).'
    })
  },
  'acwr.lowReturn': {
    athlete: (d) => ({
      title: 'Retomando entrenamiento',
      detail: `Estuviste ${int(d.daysSince)} días sin sesión. Tu carga aguda subió pero la crónica sigue baja — incrementa volumen gradualmente.`
    }),
    coach: (d) => ({
      title: `${d.athleteName ?? 'Atleta'} retomando`,
      detail: `Inactividad ${int(d.daysSince)}d con sesión reciente. Progresión segura: +10-15% volumen por semana hasta normalizar.`
    })
  },

  // ── Evolución (promedio por arrow) ─────────────────────────────────────
  'evolution.dropVsPrev30': {
    athlete: (d) => ({
      title: 'Tu promedio bajó',
      detail: `Promedio ${n(d.avgLast30, 1)} pts (eras ${n(d.avgPrev30, 1)}). Considera revisar técnica de release o anclaje antes de subir volumen.`
    }),
    coach: (d) => ({
      title: `${d.athleteName ?? 'Atleta'} cayó ${n(Math.abs((d.delta as number) || 0), 1)} pts`,
      detail: `Promedio 30d: ${n(d.avgLast30, 1)} vs ${n(d.avgPrev30, 1)} previos. Sugerido: sesión técnica enfocada en release o ajuste de equipo.`
    })
  },
  'evolution.improvedVsPrev30': {
    athlete: (d) => ({
      title: 'Tu promedio mejoró',
      detail: `Pasaste de ${n(d.avgPrev30, 1)} a ${n(d.avgLast30, 1)} pts. ¡Mantén la rutina actual!`
    }),
    coach: (d) => ({
      title: `${d.athleteName ?? 'Atleta'} mejoró +${n(d.delta, 1)} pts`,
      detail: `Promedio 30d ${n(d.avgLast30, 1)} (era ${n(d.avgPrev30, 1)}). Buen momento para introducir variantes o subir distancia.`
    })
  },
  'evolution.bestRound': {
    athlete: (d) => ({
      title: `¡Nueva mejor ronda: ${int(d.bestRound)} pts!`,
      detail: 'Marca personal de los últimos 30 días. Documenta qué hiciste diferente para replicarlo.'
    }),
    coach: () => ({
      title: 'Marca personal nueva',
      detail: 'Considera registrar una observación con lo que funcionó en esta sesión.'
    })
  },

  // ── Consistencia (stddev) ──────────────────────────────────────────────
  'consistency.improving': {
    athlete: (d) => ({
      title: 'Tu agrupación mejoró',
      detail: `σ pasó de ${n(d.stddevPrev30, 2)} a ${n(d.stddevLast30, 2)}. Estás disparando más consistente — mantén la respiración y cadencia.`
    }),
    coach: (d) => ({
      title: `${d.athleteName ?? 'Atleta'} más consistente`,
      detail: `σ 30d ${n(d.stddevLast30, 2)} (era ${n(d.stddevPrev30, 2)}). La técnica está más estable.`
    })
  },
  'consistency.worsening': {
    athlete: (d) => ({
      title: 'Tu consistencia está cayendo',
      detail: `σ subió de ${n(d.stddevPrev30, 2)} a ${n(d.stddevLast30, 2)}. Trabaja agrupación a distancia corta antes de volver a la distancia completa.`
    }),
    coach: (d) => ({
      title: `${d.athleteName ?? 'Atleta'} pierde consistencia`,
      detail: `σ subió a ${n(d.stddevLast30, 2)} (era ${n(d.stddevPrev30, 2)}). Posible fatiga o cambio reciente — revisar.`
    })
  },

  // ── Asistencia ─────────────────────────────────────────────────────────
  'attendance.low': {
    athlete: () => ({ title: '', detail: '' }), // coach-only
    coach: (d) => ({
      title: `${d.athleteName ?? 'Atleta'} con asistencia baja`,
      detail: `Asistencia ${int(d.attendancePct)}%. Vale la pena hablar con el atleta y entender el motivo.`
    })
  },

  // ── Observaciones del coach ────────────────────────────────────────────
  'coachObs.stale': {
    athlete: () => ({ title: '', detail: '' }), // coach-only
    coach: (d) => ({
      title: `${d.athleteName ?? 'Atleta'} sin feedback escrito`,
      detail:
        d.daysSinceLast === null
          ? 'Aún no tiene observaciones registradas. Una nota concreta ayuda a anclar el progreso técnico.'
          : `Hace ${int(d.daysSinceLast)} días sin observaciones nuevas. Un comentario corto ahora vale mucho.`
    })
  },

  // ── Sesión recién cerrada ──────────────────────────────────────────────
  'session.aboveAvg': {
    athlete: (d) => ({
      title: 'Excelente sesión',
      detail: `Hoy promediaste ${n(d.sessionAvg, 1)} pts (${n(d.delta, 1)} por encima de tu media de 30 días). Reproduce las condiciones que tuviste.`
    }),
    coach: () => ({ title: '', detail: '' })
  },
  'session.belowAvg': {
    athlete: (d) => ({
      title: 'Sesión por debajo de tu promedio',
      detail: `Promediaste ${n(d.sessionAvg, 1)} pts (${n(d.delta, 1)} vs media 30d). Anota factores externos (viento, cansancio) — un mal día no define la tendencia.`
    }),
    coach: () => ({ title: '', detail: '' })
  },

  // ── Volumen semanal ────────────────────────────────────────────────────
  'volume.dropoffWeek': {
    athlete: (d) => ({
      title: 'Bajaste el volumen semanal',
      detail: `Esta semana: ${int(d.arrowsThisWeek)} flechas (eran ${int(d.arrowsPrevWeek)}). Si fue planeado, OK; si no, retoma con sesión corta.`
    }),
    coach: (d) => ({
      title: `${d.athleteName ?? 'Atleta'} bajó volumen 50%+`,
      detail: `Semana: ${int(d.arrowsThisWeek)} flechas vs ${int(d.arrowsPrevWeek)} previa. Verifica el motivo.`
    })
  }
};
