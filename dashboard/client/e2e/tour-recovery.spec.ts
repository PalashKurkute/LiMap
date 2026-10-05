import { test, expect, type Page } from '@playwright/test';
import { STEPS } from '../src/tour/steps';
import { N, appState, currentId, headerTour, next, popover, ready, seen, tour } from './tour-helpers';

// What the tour does when something goes wrong, and that Finish leaves nothing behind. The tour must never be able to
// take the rest of the product down with it.

const stepIndex = (id: string) => {
  const i = STEPS.findIndex((s) => s.id === id);
  expect(i, `no tour step called ${id}`).toBeGreaterThanOrEqual(0);
  return i;
};

/** Pre-seed saved progress, so "Resume tour" starts at this step and a test does not have to click through the earlier ones. */
async function resumeAt(page: Page, id: string) {
  await page.addInitScript(
    ([k, n]) => localStorage.setItem('limap.tour.v2', JSON.stringify({ lastStep: k, total: n, done: false })),
    [stepIndex(id), N],
  );
}

function collectUncaught(page: Page): string[] {
  const uncaught: string[] = [];
  page.on('pageerror', (e) => uncaught.push(e.message));
  return uncaught;
}

const alert = (page: Page) => page.getByRole('alert');
const TOUR_CHUNK = /\/assets\/TourRoot-[^/]*\.js$/;

test('if the tour code cannot be loaded, the tour does not start, the app says so and carries on', async ({ page }) => {
  const uncaught = collectUncaught(page);
  await seen(page);
  await page.route(TOUR_CHUNK, (route) => route.abort());
  await page.goto('/dashboard/');
  await expect(page.locator('[data-region="provenance"]')).toBeVisible();

  await headerTour(page).click();
  await expect(alert(page)).toContainText('could not be loaded');
  await expect(tour(page)).toHaveCount(0);

  // Everything else is unaffected: the scene picker, the other views, and the launcher itself.
  await page.keyboard.press('2');
  await expect(page.getByRole('group', { name: 'Scenes' }).getByRole('button', { name: /^Potholes/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Map Inspector', exact: true }).click();
  await page.waitForSelector('html[data-ready~="inspector-drawn"]', { timeout: 30_000 });
  await alert(page).getByRole('button', { name: 'Dismiss' }).click();
  await expect(alert(page)).toHaveCount(0);
  await expect(headerTour(page)).toBeVisible();
  expect(uncaught).toEqual([]);
});

test('?tour=1 with the tour code unavailable shows the same message and still clears the flag', async ({ page }) => {
  const uncaught = collectUncaught(page);
  await seen(page);
  await page.route(TOUR_CHUNK, (route) => route.abort());
  await page.goto('/dashboard/?tour=1');
  await expect(alert(page)).toContainText('could not be loaded');
  expect(page.url()).not.toContain('tour=1');
  await expect(page.locator('[data-region="provenance"]')).toBeVisible();
  expect(uncaught).toEqual([]);
});

test('a step whose data never arrives still shows, and the tour carries on and leaves cleanly', async ({ page }) => {
  test.setTimeout(300_000);
  const uncaught = collectUncaught(page);
  await seen(page);
  await resumeAt(page, 'presets');
  // Every foveation variant file fails to download; the manifest and scene snapshots are untouched.
  await page.route(/\/data\/variants\//, (route) => route.abort());
  await page.goto('/dashboard/');
  await page.waitForSelector('html[data-ready~="scene-data"]');
  await page.getByRole('button', { name: 'Evidence', exact: true }).click();
  const before = await appState(page);

  await headerTour(page).click();
  await page.getByRole('menuitem', { name: /Resume at step/ }).click();
  // The step waits for its data (up to 15 s), then shows anyway.
  await ready(page);
  expect(await currentId(page)).toBe('presets');
  await expect(popover(page)).toContainText('Foveation presets');
  expect(await page.evaluate(() => document.documentElement.dataset.ready ?? '')).not.toContain('variant');
  await expect(page.locator('[data-region="tour-spotlight"]')).toBeVisible();

  // Next still works, and the next failing step also shows.
  await next(page);
  expect(await currentId(page)).toBe('compare');
  await expect(popover(page)).toContainText('Uniform 5 cm versus FoveaGrid');

  // Leaving restores what the user had, failure or not.
  await page.keyboard.press('Escape');
  await expect(tour(page)).toHaveCount(0);
  await expect.poll(() => appState(page), { timeout: 60_000 }).toEqual(before);
  expect(uncaught).toEqual([]);
});

test('Finish restores the app exactly as it was, including an unsaved theme change', async ({ page }) => {
  test.setTimeout(300_000);
  await seen(page);
  await page.addInitScript(() => localStorage.setItem('limap.theme', 'light'));
  await resumeAt(page, 'finish');
  await page.goto('/dashboard/');
  await page.waitForSelector('html[data-ready~="scene-data"]');

  // A state that is not the tour's start state.
  await page.keyboard.press('2');
  await expect(page.getByRole('group', { name: 'Scenes' }).getByRole('button', { name: /^Potholes/ })).toHaveAttribute('aria-pressed', 'true');
  await page.waitForSelector('html[data-ready~="viewport-built"]');
  await page.getByRole('radio', { name: 'Class', exact: true }).click();
  const before = await appState(page);
  expect(before.theme).toBe('light');

  await headerTour(page).click();
  await page.getByRole('menuitem', { name: /Resume at step/ }).click();
  await ready(page);
  expect(await currentId(page)).toBe('finish');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark'); // switched for the step, not saved
  expect(await page.evaluate(() => localStorage.getItem('limap.theme'))).toBe('light');

  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(tour(page)).toHaveCount(0);

  await expect.poll(() => appState(page), { timeout: 60_000 }).toEqual(before);
  expect(await page.evaluate(() => localStorage.getItem('limap.theme'))).toBe('light');
  await expect(headerTour(page)).toBeFocused();
  // A finished tour offers a fresh start, not a resume.
  await expect(headerTour(page)).toContainText('Take the tour');
  const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('limap.tour.v2') ?? 'null'));
  expect(progress).toMatchObject({ done: true });
});
