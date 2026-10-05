import { test, expect, type Page } from '@playwright/test';
import { HELP, type HelpId } from '../src/help/topics';

// The "?" help icons: every tool or feature group has one, hovering or focusing it explains the thing, and it stays on screen.
// The words come from src/help/topics.ts; the tests read them from there rather than retyping them.

const covered = new Set<HelpId>();

async function open(page: Page, theme: 'light' | 'dark' = 'light') {
  await page.addInitScript((t) => {
    localStorage.setItem('limap.welcomeSeen', '1');
    localStorage.setItem('limap.theme', t);
  }, theme);
  await page.goto('/dashboard/');
  await page.waitForSelector('html[data-ready~="scene-data"]', { timeout: 60_000 });
}

const inspector = async (page: Page) => {
  await page.getByRole('button', { name: 'Map Inspector', exact: true }).click();
  await page.waitForSelector('html[data-ready~="inspector-drawn"]', { timeout: 60_000 });
};

/** Hover each icon: its tooltip appears with the topic's words, fits the window, and goes away when the pointer leaves. */
async function hoverEach(page: Page, ids: HelpId[]) {
  const vp = page.viewportSize()!;
  for (const id of ids) {
    const btn = page.locator(`button[data-help="${id}"]`);
    await expect(btn, `a "?" for ${id}`).toHaveCount(1);
    await expect(btn).toHaveAttribute('aria-label', `About ${HELP[id].title}`);
    await btn.scrollIntoViewIfNeeded();
    await btn.hover();
    const tip = page.locator(`[data-region="help-tooltip"][data-help-for="${id}"]`);
    await expect(tip, `tooltip for ${id}`).toBeVisible();
    await expect(tip).toHaveAttribute('role', 'tooltip');
    await expect(tip).toContainText(HELP[id].title);
    await expect(tip).toContainText(HELP[id].text);
    await expect(btn).toHaveAttribute('aria-describedby', (await tip.getAttribute('id'))!);
    const b = (await tip.boundingBox())!;
    expect(b.x, `${id} tooltip left`).toBeGreaterThanOrEqual(0);
    expect(b.y, `${id} tooltip top`).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, `${id} tooltip right`).toBeLessThanOrEqual(vp.width + 1);
    expect(b.y + b.height, `${id} tooltip bottom`).toBeLessThanOrEqual(vp.height + 1);
    await page.mouse.move(vp.width / 2, vp.height / 2);
    await expect(tip, `tooltip for ${id} closes`).toBeHidden();
    covered.add(id);
  }
}

test('3D view: scene picker, upload, view toggle, stamp, scene card, camera, colour, fly, legend and the data source', async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  await page.waitForSelector('html[data-ready~="viewport-built"]', { timeout: 60_000 });
  await hoverEach(page, ['data-source', 'scenes', 'upload', 'view-mode', 'stamp', 'scene-card', 'camera', 'colour', 'fly', 'legend']);
});

test('Concept view: playback', async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  await page.getByRole('button', { name: 'Concept view' }).click();
  await expect(page.locator('[data-region="replay"]')).toBeVisible();
  await hoverEach(page, ['playback']);
});

test('Controls panel: what to draw, overlays, vehicle model, memory, slicer and the dropout preview', async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  await page.keyboard.press('t');
  await expect(page.locator('[data-region="drawer"]')).toHaveClass(/open/);
  await hoverEach(page, ['draw-mode', 'overlays']);
  await page.getByRole('tab', { name: 'Vehicle' }).click();
  await hoverEach(page, ['vehicle-model', 'memory']);
  await page.getByRole('tab', { name: 'Section' }).click();
  await hoverEach(page, ['slicer']);
  await page.getByRole('tab', { name: 'Stress' }).click();
  await hoverEach(page, ['stress']);
});

test('Map Inspector: colour, view, presets, comparison, underpass, guides, ring filter and the side panels', async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  await inspector(page);
  await hoverEach(page, [
    'inspector-colour',
    'projection',
    'fovea-presets',
    'compare',
    'underpass',
    'guides',
    'ring-filter',
    'cell-inspector',
    'fovea-card',
    'scene-stats',
  ]);
});

test('Evidence: the tag legend', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Evidence', exact: true }).click();
  await page.waitForSelector('html[data-ready~="evidence-loaded"]', { timeout: 60_000 });
  await hoverEach(page, ['evidence-tags']);
});

test('the icons work from the keyboard: focus opens the tip, Escape closes just the tip, and the app keeps its shortcuts', async ({ page }) => {
  await open(page);
  const btn = page.locator('button[data-help="scenes"]');
  const tip = page.locator('[data-region="help-tooltip"][data-help-for="scenes"]');
  await btn.focus();
  await expect(tip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
  await expect(page.locator('[data-region="drawer"]')).not.toHaveClass(/open/); // Esc did not reach the app

  // A tap or click pins the tip; clicking elsewhere closes it.
  await btn.click();
  await page.mouse.move(5, 5);
  await expect(tip).toBeVisible();
  await page.mouse.click(700, 500);
  await expect(tip).toBeHidden();

  // With nothing focused, the app's own keys still work.
  await page.locator('body').click({ position: { x: 700, y: 500 } });
  await page.keyboard.press('2');
  await expect(page.getByRole('group', { name: 'Scenes' }).getByRole('button', { name: /^Potholes/ })).toHaveAttribute('aria-pressed', 'true');
});

test('every help topic is used somewhere in the app', async () => {
  // Runs after the view tests above (the suite is serial), so the set is filled; running this test alone checks nothing.
  test.skip(covered.size === 0, 'run together with the view tests');
  expect([...covered].sort()).toEqual((Object.keys(HELP) as HelpId[]).sort());
});
