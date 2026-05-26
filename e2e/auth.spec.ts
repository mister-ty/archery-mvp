import { test, expect } from '@playwright/test';
import { ADMIN, login } from './helpers';

test.describe('Auth', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Archery MVP' })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('admin login lands on a valid in-app route', async ({ page }) => {
    await login(page, ADMIN);
    // SUPER_ADMIN should land on /equipo per src/app/page.tsx
    await expect(page).toHaveURL(/\/(equipo|onboarding|mi-progreso)/);
    // Header shows the friendly display name (email local-part) or the
    // full email — either form is acceptable after the design refresh.
    await expect(
      page.getByText(ADMIN.email.split('@')[0]).first()
    ).toBeVisible();
  });

  test('wrong password keeps user on /login with error toast', async ({
    page
  }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', ADMIN.email);
    await page.fill('input[type="password"]', 'wrong-password-on-purpose');
    await page.click('button[type="submit"]');
    // Stays on /login
    await page.waitForTimeout(1500);
    expect(page.url()).toContain('/login');
    await expect(page.getByText(/Credenciales inválidas/i)).toBeVisible();
  });

  test('protected route redirects to /login when unauthenticated', async ({
    page
  }) => {
    await page.goto('/equipo');
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
  });

  test('logout (via context clear) sends user back to /login', async ({
    page,
    context
  }) => {
    await login(page, ADMIN);
    await context.clearCookies();
    await page.goto('/equipo');
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
  });
});
