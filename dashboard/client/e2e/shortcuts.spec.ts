import { test, expect, type Page } from '@playwright/test';

// The keyboard-shortcut sheet: opened with `?` or from the Controls panel, owns the keyboard while open, lists only
// keys the app really handles, and stays out of the way of the tour.

async function open(page: Page, url = '/dashboard/') {
  await page.addInitScript(() => localStorage.setItem('limap.welcomeSeen', '1'));
  await page.goto(url);
  await expect(page.locator('[data-region="provenance"]')).toBeVisible();
}

const sheet = (page: Page) => page.getByRole('dialog', { name: 'Keyboard shortcuts' });
const drawer = (page: Page) => page.locator('[data-region="drawer"]');

test('? opens the sheet, it holds focus, and nothing behind it reacts until it closes', async ({ page }) => {
  await open(page);
  await page.keyboard.press('?');
  await expect(sheet(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close keyboard shortcuts' })).toBeFocused();

  // App keys are inert behind the sheet.
  await page.keyboard.press('t');
  await expect(drawer(page)).not.toHaveClass(/open/);
  await page.keyboard.press('2');
  await expect(page.getByRole('button', { name: /^Bridge underpass/ })).toHaveAttribute('aria-pressed', 'true');

  // Tab stays inside the dialog.
  for (let i = 0; i < 3; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);

  await page.keyboard.press('Escape');
  await expect(sheet(page)).toHaveCount(0);
  // Keys work again.
  await page.keyboard.press('t');
  await expect(drawer(page)).toHaveClass(/open/);
});

test('the Controls panel has a Keyboard shortcuts button, and Esc closes only the sheet', async ({ page }) => {
  await open(page);
  await page.keyboard.press('t');
  await expect(drawer(page)).toHaveClass(/open/);
  await drawer(page).getByRole('button', { name: /Keyboard shortcuts/ }).click();
  await expect(sheet(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toHaveCount(0);
  await expect(drawer(page)).toHaveClass(/open/); // the panel behind it was not closed by the same Esc
  await expect(drawer(page).getByRole('button', { name: /Keyboard shortcuts/ })).toBeFocused(); // focus returns to the opener
});

test('every group is listed, and the keys named belong to this app', async ({ page }) => {
  await open(page);
  await page.keyboard.press('?');
  for (const g of ['Everywhere', 'Map Inspector', '3D Explore']) await expect(sheet(page).getByRole('region', { name: g })).toBeVisible();
  const text = await sheet(page).innerText();
  expect(text).not.toMatch(/\bCtrl\b|\bCmd\b|Command palette/i); // nothing the app does not do
});

test('the sheet is inert during the tour', async ({ page }) => {
  await open(page, '/dashboard/?tour=1');
  await expect(page.locator('[data-region="tour"]')).toHaveAttribute('data-tour-phase', 'ready', { timeout: 90_000 });
  await page.keyboard.press('?');
  await page.waitForTimeout(300);
  await expect(sheet(page)).toHaveCount(0);
});
