/**
 * Quick-start session templates the athlete picks from /mi-progreso/nueva-sesion.
 * Pure data — no Prisma. Editable in code only (no admin UI).
 */

import type { SessionType } from '@prisma/client';

export type AthleteTemplateKey = 'wa70' | 'indoor18' | 'cmp50' | 'tech30';

export type AthleteSessionTemplate = {
  key: AthleteTemplateKey;
  label: string;
  blurb: string;
  type: SessionType;
  indoor: boolean;
  scoreSets: Array<{
    distance: number;
    endsCount: number;
    arrowsPerEnd: number;
  }>;
};

export const ATHLETE_SESSION_TEMPLATES: readonly AthleteSessionTemplate[] = [
  {
    key: 'wa70',
    label: '70m WA Outdoor',
    blurb: 'Ronda completa olímpica · 6 ends × 6 flechas',
    type: 'SERIES',
    indoor: false,
    scoreSets: [{ distance: 70, endsCount: 6, arrowsPerEnd: 6 }]
  },
  {
    key: 'indoor18',
    label: '18m Indoor',
    blurb: 'Ronda indoor estándar · 10 ends × 3 flechas',
    type: 'SERIES',
    indoor: true,
    scoreSets: [{ distance: 18, endsCount: 10, arrowsPerEnd: 3 }]
  },
  {
    key: 'cmp50',
    label: '50m Compuesto',
    blurb: 'Distancia oficial de compuesto · 6 ends × 6 flechas',
    type: 'SERIES',
    indoor: false,
    scoreSets: [{ distance: 50, endsCount: 6, arrowsPerEnd: 6 }]
  },
  {
    key: 'tech30',
    label: 'Técnica corta (30m)',
    blurb: 'Sesión técnica breve · 4 ends × 3 flechas',
    type: 'TECHNICAL',
    indoor: false,
    scoreSets: [{ distance: 30, endsCount: 4, arrowsPerEnd: 3 }]
  }
] as const;

export function templateByKey(
  key: AthleteTemplateKey
): AthleteSessionTemplate | undefined {
  return ATHLETE_SESSION_TEMPLATES.find((t) => t.key === key);
}

export function totalArrows(t: AthleteSessionTemplate): number {
  return t.scoreSets.reduce(
    (sum, s) => sum + s.endsCount * s.arrowsPerEnd,
    0
  );
}
