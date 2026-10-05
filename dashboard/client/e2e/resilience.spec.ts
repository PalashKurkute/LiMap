import { test, expect, type Page } from '@playwright/test';

// The 3D view, Map Inspector and Evidence page load on demand. When a chunk cannot be fetched (a stale tab after a new
// deploy, a dropped connection) that one view says so and offers a reload; the header, the scene picker and the other
// views keep working, and nothing throws an uncaught error.

async function start(page: Page, blocked: RegExp) {
  await page.addInitScript(() => localStorage.setItem('limap.welcomeSeen', '1'));
  const uncaught: string[] = [];
  page.on('pageerror', (e) => uncaught.push(e.message));
  await page.route(blocked, (route) => route.abort());
  return uncaught;
}

const alert = (page: Page) => page.getByRole('alert');

test('a failed Evidence chunk: the idle prefetch stays silent, opening it shows a message, the rest keeps working', async ({ page }) => {
  const uncaught = await start(page, /\/assets\/EvidenceView-[^/]*\.js$/);
  const prefetchFailed = page.waitForEvent('requestfailed', { predicate: (r) => /EvidenceView-/.test(r.url()), timeout: 30_000 });
  await page.goto('/dashboard/');
  await expect(page.locator('[data-region="provenance"]')).toBeVisible();
  await prefetchFailed; // the browser went idle, tried the chunk, and it failed
  expect(uncaught, 'a failed prefetch must not raise an uncaught error').toEqual([]);

  await page.getByRole('button', { name: 'Evidence', exact: true }).click();
  await expect(alert(page)).toContainText('could not be loaded');
  await expect(alert(page).getByRole('button', { name: 'Reload' })).toBeVisible();

  // Header and the other views are unaffected, and the message clears when the view changes.
  await page.getByRole('button', { name: 'Map Inspector', exact: true }).click();
  await page.waitForSelector('html[data-ready~="inspector-drawn"]', { timeout: 30_000 });
  await expect(alert(page)).toHaveCount(0);
  await page.getByRole('button', { name: '3D Explore', exact: true }).click();
  await expect(page.locator('[data-region="provenance"]')).toBeVisible();
  expect(uncaught).toEqual([]);
});

test('a failed 3D chunk: the scene picker and the other views stay usable', async ({ page }) => {
  const uncaught = await start(page, /\/assets\/ThreeViewport-[^/]*\.js$/);
  await page.goto('/dashboard/');
  await expect(alert(page)).toContainText('could not be loaded');

  // The scene picker is part of the page, not of the 3D chunk.
  const scenes = page.getByRole('group', { name: 'Scenes' });
  await expect(scenes).toBeVisible();
  await page.keyboard.press('2');
  await expect(scenes.getByRole('button', { name: /^Potholes/ })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Map Inspector', exact: true }).click();
  await page.waitForSelector('html[data-ready~="inspector-drawn"]', { timeout: 30_000 });
  await expect(alert(page)).toHaveCount(0);
  expect(uncaught).toEqual([]);
});
