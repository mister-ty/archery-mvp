import { test, expect } from '@playwright/test';

const APP = 'http://localhost:3002';

test.describe('Athlete self-session (Fase 5.3)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${APP}/login`);
    await page.fill('input[type="email"]', 'sofia@archery.local');
    await page.fill('input[type="password"]', 'Athlete123!');
    await Promise.all([
      page.waitForURL((u) => !u.toString().includes('/login')),
      page.click('button[type="submit"]')
    ]);
  });

  test('Sofia sees "Mis sesiones" section on /mi-progreso', async ({ page }) => {
    await page.goto(`${APP}/mi-progreso`);
    await expect(page.getByText('Mis sesiones', { exact: false })).toBeVisible();
  });

  test('Sofia can start a self-session from a template and lands on capture', async ({
    page
  }) => {
    await page.goto(`${APP}/mi-progreso/nueva-sesion`);
    await expect(page.getByText('Plantillas rápidas', { exact: false })).toBeVisible();

    await Promise.all([
      page.waitForURL((u) => /\/sesion\/[a-z0-9]+\/puntuacion/.test(u.toString())),
      page.getByRole('button', { name: /70m WA Outdoor/i }).click()
    ]);

    await expect(page).toHaveURL(/\/sesion\/[a-z0-9]+\/puntuacion/);
  });

  test('Non-athlete cannot reach /mi-progreso/nueva-sesion', async ({ browser }) => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto(`${APP}/login`);
    await p.fill('input[type="email"]', 'coach@archery.local');
    await p.fill('input[type="password"]', 'Coach123!');
    await Promise.all([
      p.waitForURL((u) => !u.toString().includes('/login')),
      p.click('button[type="submit"]')
    ]);
    await p.goto(`${APP}/mi-progreso/nueva-sesion`);
    await expect(p).toHaveURL(/\/equipo$/);
    await ctx.close();
  });
});
