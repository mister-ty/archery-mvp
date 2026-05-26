import { test, expect } from '@playwright/test';
import { ADMIN, login } from './helpers';

test.describe('Attendance (F9)', () => {
  test('admin can toggle attendance and the change persists after reload', async ({
    page
  }) => {
    await login(page, ADMIN);

    // Navigate to an athlete that has sessions (from test-data).
    await page.goto('/equipo');
    const athleteHrefs = await page
      .locator('a[href^="/deportistas/"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));
    const athleteHref = athleteHrefs.find((h) => h.length > '/deportistas/'.length);
    expect(athleteHref, 'need at least one athlete with sessions').toBeTruthy();

    await page.goto(athleteHref!);

    // Pick the first session of this athlete.
    const sessionHrefs = await page
      .locator('a[href^="/sesion/"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));
    expect(sessionHrefs.length, 'athlete has no sessions').toBeGreaterThan(0);
    await page.goto(sessionHrefs[0]);

    // Attendance section is visible for staff.
    await expect(page.getByRole('heading', { name: /asistencia/i })).toBeVisible();

    // Toggle to "Tarde" — reason textarea should appear.
    await page
      .locator('button[role="radio"]', { hasText: 'Tarde' })
      .first()
      .click();
    await expect(page.locator('textarea[placeholder*="Motivo"]')).toBeVisible();

    // Reload and verify "Tarde" is still selected.
    await page.reload();
    const activeStatus = await page
      .locator('button[role="radio"][aria-checked="true"]')
      .first()
      .innerText();
    expect(activeStatus).toBe('Tarde');

    // Toggle back to "Presente" for cleanup (idempotency of subsequent runs).
    await page
      .locator('button[role="radio"]', { hasText: 'Presente' })
      .first()
      .click();
    await page.waitForTimeout(500);
    await page.reload();
    const finalStatus = await page
      .locator('button[role="radio"][aria-checked="true"]')
      .first()
      .innerText();
    expect(finalStatus).toBe('Presente');
  });
});
