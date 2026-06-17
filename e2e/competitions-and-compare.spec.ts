import { test, expect } from '@playwright/test';
import { ADMIN, login } from './helpers';

test.describe('Competitions + Compare (Fase 2.3 + 2.4)', () => {
  test('admin registers a competition for an athlete and sees it in the list', async ({
    page
  }) => {
    await login(page, ADMIN);

    // Pick the first athlete from the team list.
    await page.goto('/equipo');
    const athleteHrefs = await page
      .locator('a[href^="/deportistas/"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));
    const athleteHref = athleteHrefs.find(
      (h) => h.startsWith('/deportistas/') && !h.endsWith('/nuevo')
    );
    expect(athleteHref).toBeTruthy();
    await page.goto(athleteHref!);

    const uniqueName = `Test Cup ${Date.now()}`;

    await expect(page.getByText('Historial competitivo')).toBeVisible();
    await page.fill('#comp-name', uniqueName);
    await page.fill('#comp-score', '612');
    await page.fill('#comp-rank', '3');
    await page.getByRole('button', { name: /registrar competici/i }).click();

    await expect(page.getByText(/Competición registrada/i)).toBeVisible({
      timeout: 10000
    });
    await page.waitForTimeout(800);
    // Scope to the row created in this run — there can be other entries
    // from previous test runs with the same rank.
    const row = page
      .locator('li', { hasText: uniqueName })
      .first();
    await expect(row).toBeVisible();
    await expect(row.getByText('#3')).toBeVisible();
  });

  test('compare page rejects fewer than 2 ids', async ({ page }) => {
    await login(page, ADMIN);
    await page.goto('/equipo/comparar');
    await expect(
      page.getByText(/Selecciona al menos 2 deportistas/i)
    ).toBeVisible();
  });

  test('compare two athletes via the multi-select bar', async ({ page }) => {
    await login(page, ADMIN);
    await page.goto('/equipo');

    // Tick the first 2 athlete checkboxes in the table.
    const checkboxes = page.locator(
      'input[type="checkbox"][aria-label^="Seleccionar"]'
    );
    const count = await checkboxes.count();
    if (count < 2) test.skip();

    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();

    await expect(page.getByText(/2 seleccionados/i)).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/equipo\/comparar\?ids=/, { timeout: 15000 }),
      page.getByRole('button', { name: /^Comparar$/ }).click()
    ]);

    // Compare table renders the metric column + at least one athlete column.
    await expect(page.getByRole('heading', { name: /Comparar deportistas/i }))
      .toBeVisible();
    await expect(page.getByText(/Promedio 30d/i)).toBeVisible();
    await expect(page.getByText(/Consistencia 30d/i)).toBeVisible();
    await expect(page.getByText(/Carga \(ACWR\)/i)).toBeVisible();
  });
});
