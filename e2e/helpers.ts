import type { Page } from '@playwright/test';

export const ADMIN = {
  email: 'admin@archery.local',
  password: 'ChangeMe!ASAP123'
};

export const COACH = {
  email: 'coach@archery.local',
  password: 'Coach123!'
};

export async function login(
  page: Page,
  creds: { email: string; password: string }
) {
  await page.goto('/login');
  await page.fill('input[type="email"]', creds.email);
  await page.fill('input[type="password"]', creds.password);
  await Promise.all([
    page.waitForURL((u) => !u.toString().includes('/login'), {
      timeout: 30000
    }),
    page.click('button[type="submit"]')
  ]);
  await page.waitForLoadState('networkidle').catch(() => {
    // networkidle is best-effort; some background requests may keep it busy.
  });
}

export async function logout(page: Page) {
  await page.context().clearCookies();
}

export function uniqueEmail(prefix = 'test'): string {
  return `${prefix}-${Date.now()}@archery.local`;
}
