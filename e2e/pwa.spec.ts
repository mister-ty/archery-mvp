import { test, expect } from '@playwright/test';

/**
 * PWA basics (Fase 4.5):
 *  - manifest.json served with correct content + start_url.
 *  - PWA icons reachable.
 *  - /offline page renders the offline UI.
 *  - <link rel="manifest"> present on the document.
 *
 * Service worker registration itself is dev-guarded (only runs in
 * production build) — we skip asserting `navigator.serviceWorker.ready`
 * here so the spec works against `next dev`.
 */
test.describe('PWA basics', () => {
  test('manifest.json is served and well-formed', async ({ request }) => {
    const resp = await request.get('/manifest.json');
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.name).toBe('Archery MVP');
    expect(body.short_name).toBe('Archery');
    expect(body.start_url).toBe('/');
    expect(body.display).toBe('standalone');
    expect(body.theme_color).toBe('#1a8a3f');
    expect(Array.isArray(body.icons)).toBe(true);
    expect(body.icons.length).toBeGreaterThanOrEqual(2);
  });

  test('PWA icons are reachable', async ({ request }) => {
    for (const path of [
      '/icons/icon-192.png',
      '/icons/icon-512.png',
      '/icons/icon-512-maskable.png'
    ]) {
      const resp = await request.get(path);
      expect.soft(resp.status(), `${path} should 200`).toBe(200);
      expect.soft(resp.headers()['content-type']).toContain('image/png');
    }
  });

  test('offline page renders the offline UI', async ({ page }) => {
    await page.goto('/offline');
    await expect(
      page.getByRole('heading', { name: /Sin conexión/i })
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Reintentar/i })).toBeVisible();
  });

  test('root document advertises the manifest link', async ({ page }) => {
    await page.goto('/login');
    const href = await page
      .locator('link[rel="manifest"]')
      .getAttribute('href');
    expect(href).toBe('/manifest.json');
  });
});
