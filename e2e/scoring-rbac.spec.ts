import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const APP = 'http://localhost:3002';
const prisma = new PrismaClient();

const ATHLETE_EMAIL = 'sofia@archery.local';
const ATHLETE_PASSWORD = 'Athlete123!';
const COACH_EMAIL = 'coach@archery.local';
const COACH_PASSWORD = 'Coach123!';

async function loginAs(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto(`${APP}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForURL((u) => !u.toString().includes('/login')),
    page.click('button[type="submit"]')
  ]);
}

async function createFreshSessionFor(athleteEmail: string) {
  const athlete = await prisma.athlete.findFirst({
    where: { user: { email: athleteEmail }, active: true },
    select: { id: true, userId: true, clubId: true }
  });
  if (!athlete?.userId) throw new Error(`Athlete for ${athleteEmail} not found or has no user`);

  // Tiny session: one distance, 1 end × 3 arrows = 3 arrows total. The Zod
  // validation requires arrowsPerEnd >= 3, so we cannot go smaller.
  const ts = await prisma.trainingSession.create({
    data: {
      athleteId: athlete.id,
      date: new Date(),
      type: 'TECHNICAL',
      indoor: false,
      createdById: athlete.userId,
      scoreSets: { create: [{ distance: 70, endsCount: 1, arrowsPerEnd: 3 }] }
    },
    select: { id: true }
  });
  return ts.id;
}

async function deleteSession(id: string) {
  await prisma.trainingSession.delete({ where: { id } }).catch(() => {});
}

test.describe('Scoring RBAC (Fase 6)', () => {
  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('coach is redirected from /puntuacion while session is active', async ({ page }) => {
    const sessionId = await createFreshSessionFor(ATHLETE_EMAIL);
    try {
      await loginAs(page, COACH_EMAIL, COACH_PASSWORD);
      await page.goto(`${APP}/sesion/${sessionId}/puntuacion`);
      await page.waitForURL(new RegExp(`/sesion/${sessionId}$`));
      await expect(
        page.getByText(/Solo el deportista puede capturar/i)
      ).toBeVisible();
    } finally {
      await deleteSession(sessionId);
    }
  });

  test('athlete can capture; completedAt is set when last arrow saved', async ({ page }) => {
    const sessionId = await createFreshSessionFor(ATHLETE_EMAIL);
    try {
      await loginAs(page, ATHLETE_EMAIL, ATHLETE_PASSWORD);
      await page.goto(`${APP}/sesion/${sessionId}/puntuacion`);
      await expect(page.getByText(/70m/)).toBeVisible();

      // Tap 10, X, 9 — buttons use aria-label="Puntaje N". 3 arrows fill 1 end.
      await page.getByRole('button', { name: 'Puntaje 10', exact: true }).click();
      await page.waitForTimeout(200);
      await page.getByRole('button', { name: 'Puntaje X', exact: true }).click();
      await page.waitForTimeout(200);
      await page.getByRole('button', { name: 'Puntaje 9', exact: true }).click();

      // Trigger an explicit save through the manual button to bypass debounce.
      const saveBtn = page.getByRole('button', { name: /Guardar/i });
      await saveBtn.click({ timeout: 5000 }).catch(() => {});
      // Allow autosave debounce (1.5s) + server action round-trip to complete.
      await page.waitForTimeout(4000);

      const ts = await prisma.trainingSession.findUnique({
        where: { id: sessionId },
        select: { completedAt: true }
      });
      expect(ts?.completedAt).not.toBeNull();
    } finally {
      await deleteSession(sessionId);
    }
  });

  test('coach can correct within 24h window (mode: staff-correction)', async ({ page }) => {
    const sessionId = await createFreshSessionFor(ATHLETE_EMAIL);
    try {
      // Mark the session as just completed (within window).
      await prisma.trainingSession.update({
        where: { id: sessionId },
        data: { completedAt: new Date() }
      });

      await loginAs(page, COACH_EMAIL, COACH_PASSWORD);
      await page.goto(`${APP}/sesion/${sessionId}/puntuacion`);
      // Should NOT redirect this time; the staff-correction banner should appear.
      await expect(page).toHaveURL(new RegExp(`/sesion/${sessionId}/puntuacion`));
      await expect(page.getByText(/Modo corrección/i)).toBeVisible();
    } finally {
      await deleteSession(sessionId);
    }
  });

  test('coach blocked after 24h window (expired)', async ({ page }) => {
    const sessionId = await createFreshSessionFor(ATHLETE_EMAIL);
    try {
      // Backdate completion: 25h ago — outside the edit window.
      const expired = new Date(Date.now() - 25 * 60 * 60 * 1000);
      await prisma.trainingSession.update({
        where: { id: sessionId },
        data: { completedAt: expired }
      });

      await loginAs(page, COACH_EMAIL, COACH_PASSWORD);
      await page.goto(`${APP}/sesion/${sessionId}/puntuacion`);
      // Strict wrapper redirects denied requests back to the session detail.
      await page.waitForURL(new RegExp(`/sesion/${sessionId}$`));
      await expect(page.getByText(/Sesión cerrada/i)).toBeVisible();
    } finally {
      await deleteSession(sessionId);
    }
  });
});
