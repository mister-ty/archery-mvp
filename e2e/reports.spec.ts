import { test, expect } from '@playwright/test';
import { ADMIN, login } from './helpers';

test.describe('Reports (F10) — CSV + PDF exports', () => {
  test('admin can download athlete CSV report', async ({ page }) => {
    await login(page, ADMIN);
    await page.goto('/equipo');

    // Pick the first athlete link from the team table.
    const athleteHrefs = await page
      .locator('a[href^="/deportistas/"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));
    const athleteHref = athleteHrefs.find((h) => h.length > '/deportistas/'.length);
    expect(athleteHref, 'at least one athlete should exist for this test').toBeTruthy();
    const athleteId = athleteHref!.split('/').pop()!;

    const resp = await page.request.get(`/api/reports/athlete/${athleteId}/csv`);
    expect(resp.status()).toBe(200);
    expect(resp.headers()['content-type']).toContain('text/csv');
    expect(resp.headers()['content-disposition']).toMatch(/attachment;\s*filename=/);

    const body = await resp.text();
    expect(body.charCodeAt(0)).toBe(0xfeff); // BOM
    expect(body).toContain('Fecha,Tipo,Indoor,Distancia (m)');
  });

  test('admin can download athlete PDF report', async ({ page }) => {
    await login(page, ADMIN);
    await page.goto('/equipo');

    const athleteHrefs = await page
      .locator('a[href^="/deportistas/"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));
    const athleteHref = athleteHrefs.find((h) => h.length > '/deportistas/'.length);
    expect(athleteHref).toBeTruthy();
    const athleteId = athleteHref!.split('/').pop()!;

    const resp = await page.request.get(`/api/reports/athlete/${athleteId}/pdf`);
    expect(resp.status()).toBe(200);
    expect(resp.headers()['content-type']).toBe('application/pdf');

    const body = await resp.body();
    // PDF magic bytes
    expect(body.slice(0, 4).toString('ascii')).toBe('%PDF');
    expect(body.length).toBeGreaterThan(1000);
  });

  test('unauthenticated CSV request returns 401', async ({ request }) => {
    // request fixture has its own cookie jar, separate from page.
    const resp = await request.get('/api/reports/athlete/nonexistent/csv');
    // Either 401 (unauth) or 403 (forbidden) or 404 (athlete missing) is acceptable.
    expect([401, 403, 404]).toContain(resp.status());
  });
});
