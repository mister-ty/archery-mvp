import { test, expect } from '@playwright/test';
import { ADMIN, login, uniqueEmail } from './helpers';

test.describe('Invitation flow (F1.3)', () => {
  test('admin → create COACH invitation → accept → new coach can log in', async ({
    page,
    context
  }) => {
    const newCoachEmail = uniqueEmail('coach');
    const newCoachPassword = 'TestPass!1234';

    // 1. Admin creates an invitation
    await login(page, ADMIN);
    await page.goto('/admin/usuarios/nuevo');
    await page.fill('#invite-email', newCoachEmail);
    await page.selectOption('#invite-role', 'COACH');
    await page.getByRole('button', { name: /crear invitaci/i }).click();

    // Wait for the link to be visible
    const linkInput = page.locator('input[readonly]');
    await expect(linkInput).toBeVisible({ timeout: 15000 });
    const inviteLink = await linkInput.inputValue();
    expect(inviteLink).toMatch(/\/activar\/[a-f0-9]{64}$/);

    // 2. Switch session: clear cookies, visit activation link
    await context.clearCookies();
    await page.goto(inviteLink);

    // Activation page should show the invitee's email + the role
    await expect(page.getByText(newCoachEmail)).toBeVisible();
    await expect(page.getByText(/Coach/i).first()).toBeVisible();

    // 3. Fill the activation form (COACH requires firstName + lastName)
    await page.fill('#firstName', 'E2ECoach');
    await page.fill('#lastName', 'Tester');
    await page.fill('#password', newCoachPassword);
    await page.fill('#passwordConfirm', newCoachPassword);
    await page.getByRole('button', { name: /activar/i }).click();

    // 4. Redirected to /login after activation
    await page.waitForURL(/\/login/);
    await expect(page.getByText(/Cuenta activada/i)).toBeVisible();

    // 5. Log in as the new coach
    await login(page, { email: newCoachEmail, password: newCoachPassword });
    // Coach should land on /equipo (Coach profile was created in same txn)
    await expect(page).toHaveURL(/\/equipo/);
  });

  test('expired/invalid token shows error and does not allow activation', async ({
    page
  }) => {
    await page.goto('/activar/this-token-does-not-exist-and-is-invalid');
    await expect(
      page.getByText(/Invitación inválida o expirada/i)
    ).toBeVisible();
    // Form is not rendered for invalid tokens
    await expect(page.locator('#password')).toHaveCount(0);
  });

  test('admin can revoke a pending invitation', async ({ page }) => {
    const email = uniqueEmail('toRevoke');

    await login(page, ADMIN);
    await page.goto('/admin/usuarios/nuevo');
    await page.fill('#invite-email', email);
    await page.selectOption('#invite-role', 'ATHLETE');
    await page.getByRole('button', { name: /crear invitaci/i }).click();
    await expect(page.locator('input[readonly]')).toBeVisible({
      timeout: 15000
    });

    // Go back to list, revoke
    await page.goto('/admin/usuarios');
    await expect(page.getByText(email)).toBeVisible();

    // confirm() dialog is auto-accepted
    page.on('dialog', (d) => d.accept());

    await page
      .getByRole('button', { name: new RegExp(`Revocar invitación de ${email}`, 'i') })
      .click();

    await expect(page.getByText(/Invitación revocada/i)).toBeVisible();
    await expect(page.getByText(email)).toHaveCount(0);
  });
});
