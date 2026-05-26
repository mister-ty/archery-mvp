import { test, expect, type Page } from '@playwright/test';
import { ADMIN, login } from './helpers';

/**
 * F4 + offline persistence (Fase 1.4):
 *  - Verify the localStorage buffer is written on every tap.
 *  - Verify going offline switches the sync badge.
 *  - Verify the buffer correctly restores arrows after a reload.
 *  - Verify going back online flushes pending work (badge → "Sincronizado").
 *
 * Note: we test reload while ONLINE, because Playwright's
 * context.setOffline(true) also prevents page reloads. The buffer-restore
 * code path is the same regardless of why the page was reloaded.
 */
async function gotoFirstScoreSet(page: Page) {
  await page.goto('/equipo');
  const athleteHrefs = await page
    .locator('a[href^="/deportistas/"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));
  const athleteHref = athleteHrefs.find((h) => h.length > '/deportistas/'.length);
  if (!athleteHref) throw new Error('no athletes seeded');

  await page.goto(athleteHref);
  const sessionHrefs = await page
    .locator('a[href^="/sesion/"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));
  if (!sessionHrefs.length) throw new Error('no sessions for athlete');

  await page.goto(sessionHrefs[0]);
  const scoreSetHref = await page
    .locator('a[href*="/puntuacion?distance="]')
    .first()
    .getAttribute('href');
  if (!scoreSetHref) throw new Error('no score sets on this session');

  await page.goto(scoreSetHref);
  await expect(
    page.getByRole('button', { name: 'Puntaje 10' })
  ).toBeVisible();
}

async function readArrowCount(page: Page) {
  // Match by visible text content rather than CSS class, so the test
  // survives styling refactors of the ScoreCapture header.
  const headerText = await page
    .locator('p', { hasText: /\d+\/\d+\s+flechas/ })
    .first()
    .innerText();
  const m = headerText.match(/(\d+)\/(\d+)\s+flechas/);
  if (!m) throw new Error(`header missing count: ${headerText}`);
  return { current: Number(m[1]), total: Number(m[2]) };
}

test.describe('Scoring offline persistence (F4)', () => {
  test('arrow tap writes to localStorage and survives a reload', async ({
    page
  }) => {
    await login(page, ADMIN);
    await gotoFirstScoreSet(page);

    let { current, total } = await readArrowCount(page);
    if (current === total) {
      await page.getByRole('button', { name: /deshacer/i }).click();
      await page.waitForTimeout(2000); // let autosave flush
      ({ current, total } = await readArrowCount(page));
    }
    expect(current).toBeLessThan(total);
    const baseline = current;

    // Tap a new score (online). Auto-save will fire after 1.5s.
    await page.getByRole('button', { name: 'Puntaje 7' }).click();
    await page.waitForTimeout(300);
    expect((await readArrowCount(page)).current).toBe(baseline + 1);

    // Buffer should be in localStorage right away.
    const bufferRaw = await page.evaluate(() => {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k?.startsWith('archery:scoreSet:')) {
          return window.localStorage.getItem(k);
        }
      }
      return null;
    });
    expect(bufferRaw).not.toBeNull();
    const buf = JSON.parse(bufferRaw!);
    expect(buf.arrows).toHaveLength(baseline + 1);
    expect(buf.version).toBe(1);

    // Reload before auto-save fires → arrow is restored from localStorage.
    await page.reload();
    await expect(
      page.getByRole('button', { name: 'Puntaje 10' })
    ).toBeVisible();
    await page.waitForTimeout(500); // give mount useEffect time to setArrows
    expect((await readArrowCount(page)).current).toBe(baseline + 1);
  });

  test('going offline flips the badge and going back online flushes', async ({
    page,
    context
  }) => {
    await login(page, ADMIN);
    await gotoFirstScoreSet(page);

    // Make sure the set has room — if full, undo first.
    let { current, total } = await readArrowCount(page);
    if (current === total) {
      await page.getByRole('button', { name: /deshacer/i }).click();
      await page.waitForTimeout(2000);
      ({ current } = await readArrowCount(page));
    }

    // Flip offline before any new tap.
    await context.setOffline(true);

    await page.getByRole('button', { name: 'Puntaje 4' }).click();
    await expect(page.getByText(/Sin conexión/i)).toBeVisible({
      timeout: 5000
    });

    // Back online — autosave should fire and badge become synced.
    await context.setOffline(false);
    await expect(page.getByText(/Sincronizado/i)).toBeVisible({
      timeout: 15000
    });
  });
});
