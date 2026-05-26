import { test, expect } from '@playwright/test';
import { ADMIN, login } from './helpers';

/**
 * Dark mode toggle (Fase 4.1):
 *  - Toggle cycles light → dark → system from a "system" start.
 *  - Choice persists across reloads (localStorage `theme`).
 *  - <html> class reflects the resolved theme.
 */
test.describe('Theme toggle (Fase 4.1)', () => {
  test('ThemeInit applies dark from localStorage and survives reload', async ({
    page,
    context
  }) => {
    await context.clearCookies();
    // Pre-set theme to dark BEFORE the first navigation. ThemeInit
    // inline script in <head> should pick this up before first paint,
    // preventing FOUC and ensuring the dark class is present.
    await context.addInitScript(() => {
      try {
        localStorage.setItem('theme', 'dark');
      } catch {
        /* ignore */
      }
    });

    await login(page, ADMIN);
    await page.waitForURL(/\/equipo|\/onboarding|\/mi-progreso/);

    // After ThemeInit runs in <head>, html must already have `dark`.
    expect(
      await page.evaluate(() =>
        document.documentElement.classList.contains('dark')
      )
    ).toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.style.colorScheme)
    ).toBe('dark');

    // The toggle button reflects the dark state.
    const themeBtn = page.getByRole('button', { name: /^Tema oscuro/i });
    await expect(themeBtn).toBeVisible();

    // localStorage value is intact after navigation.
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');

    // Reload — must remain dark.
    await page.reload();
    expect(
      await page.evaluate(() =>
        document.documentElement.classList.contains('dark')
      )
    ).toBe(true);
  });

  test('ThemeInit applies light by default when localStorage is empty', async ({
    page,
    context
  }) => {
    await context.clearCookies();
    await context.addInitScript(() => {
      try {
        localStorage.removeItem('theme');
      } catch {
        /* ignore */
      }
    });

    await page.goto('/login');
    expect(
      await page.evaluate(() =>
        document.documentElement.classList.contains('dark')
      )
    ).toBe(false);
  });

  test('login page exposes a theme toggle even when unauthenticated', async ({
    page,
    context
  }) => {
    await context.clearCookies();
    await page.goto('/login');
    const themeBtn = page.getByRole('button', { name: /^Tema/i });
    await expect(themeBtn).toBeVisible();
  });
});
