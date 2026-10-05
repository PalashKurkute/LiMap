import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

// Underpass comparison (Map Inspector): the bridge scene's planner run, shown as two costmaps side by side. Every figure
// and every pane is checked against public/data/planner/scene_a_bridge.json on disk, never against typed numbers.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, '..', 'public', 'data');
const OUT = path.join(HERE, '__out__');
const planner = JSON.parse(fs.readFileSync(path.join(DATA, 'planner', 'scene_a_bridge.json'), 'utf8'));

const BANNED = [/collision-free/i, /\bguarantee/i, /Kalman/i, /\bPROVED\b/, /Bayesian/i, /SAFE TO PASS/i];

async function openInspector(page: Page, theme: 'light' | 'dark' = 'light') {
  await page.addInitScript((t) => {
    localStorage.setItem('limap.welcomeSeen', '1');
    localStorage.setItem('limap.theme', t);
  }, theme);
  await page.goto('/');
  await page.waitForSelector('html[data-ready~="scene-data"]', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Map Inspector', exact: true }).click();
  await page.waitForSelector('html[data-ready~="inspector-drawn"]', { timeout: 30_000 });
}

const toggle = (page: Page) => page.getByRole('button', { name: /Underpass: one height vs 2\.5D/ });
const canvas = (page: Page) => page.locator('[data-region="inspector-canvas"] canvas');
const card = (page: Page) => page.locator('[data-region="underpass-card"]');
const zoomLabel = (page: Page) => page.getByText(/^\d+\.\d px\/m$/);

async function enable(page: Page) {
  await toggle(page).click();
  await page.waitForSelector('html[data-ready~="planner"]', { timeout: 30_000 });
  await expect(canvas(page)).toHaveAttribute('data-underpass', 'on');
  await page.waitForTimeout(400); // the fit-to-view request lands a frame or two after the data
}

type Rgb = [number, number, number];
const hex = (h: string): Rgb => {
  const n = parseInt(h.trim().slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const blend = (fg: Rgb, bg: Rgb, a: number): Rgb => [0, 1, 2].map((i) => Math.round(fg[i] * a + bg[i] * (1 - a))) as Rgb;

async function token(page: Page, name: string): Promise<Rgb> {
  return hex(await page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n), name));
}

/** Pixels of the canvas within `tol` (sum of channel differences) of `rgb`, in screen columns [x0, x1), plus their column extent. */
function near(png: PNG, rgb: Rgb, tol: number, x0: number, x1: number) {
  let count = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  for (let y = 0; y < png.height; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * png.width + x) * 4;
      if (Math.abs(png.data[i] - rgb[0]) + Math.abs(png.data[i + 1] - rgb[1]) + Math.abs(png.data[i + 2] - rgb[2]) <= tol) {
        count++;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    }
  }
  return { count, minX, maxX };
}

for (const theme of ['light', 'dark'] as const) {
  test(`${theme}: the two panes draw the two exported costmaps and the planner's path`, async ({ page }) => {
    await openInspector(page, theme);
    await enable(page);
    await expect(canvas(page)).toHaveAttribute('data-projection', '2d');

    const png = PNG.sync.read(await canvas(page).screenshot());
    const half = Math.floor(png.width / 2);
    const bg = await token(page, '--scene-bg');
    const lethal = blend(await token(page, '--scene-cost-lethal'), bg, 0.9);
    const pathColor = await token(page, '--scene-path');

    const leftWall = near(png, lethal, 60, 0, half - 2);
    const rightWall = near(png, lethal, 60, half + 2, png.width);
    // The one-height grid's map is dominated by impassable cells; the 2.5D grid's holds far fewer.
    expect(leftWall.count, 'impassable pixels in the one-height pane').toBeGreaterThan(1000);
    expect(rightWall.count, 'the 2.5D pane still shows its few impassable cells').toBeGreaterThan(0);
    expect(leftWall.count).toBeGreaterThan(5 * rightWall.count);
    // The view is fitted from the data: the wall reaches across most of its pane instead of being clipped or tiny.
    expect(leftWall.maxX - leftWall.minX).toBeGreaterThan(0.6 * half);

    // Only the 2.5D pane has a planned path.
    expect(near(png, pathColor, 30, half + 2, png.width).count).toBeGreaterThan(100);
    expect(near(png, pathColor, 30, 0, half - 2).count).toBeLessThan(20);

    if (theme === 'dark') {
      fs.mkdirSync(OUT, { recursive: true });
      await page.screenshot({ path: path.join(OUT, 'underpass_dark.png') });
    } else {
      fs.mkdirSync(OUT, { recursive: true });
      await page.screenshot({ path: path.join(OUT, 'underpass_light.png') });
    }
  });
}

test('the card and pane labels state what the planner file records, with provenance tags', async ({ page }) => {
  await openInspector(page);
  await enable(page);
  const r = planner.results;
  const g = planner.meta.grids;

  for (const id of ['naive', 'aware'] as const) {
    const label = page.locator(`[data-region="underpass-pane-${id}"]`);
    await expect(label).toContainText(g[id].label);
    await expect(label).toContainText(r[id].traversable ? `Path found · cost ${r[id].cost.toFixed(2)}` : 'No path found');
  }

  await expect(card(page)).toContainText(r.reference.cost.toFixed(2));
  await expect(card(page)).toContainText(`${g.naive.lethal_cells.toLocaleString()} vs ${g.aware.lethal_cells.toLocaleString()}`);
  if (r.aware.traversable) await expect(card(page)).toContainText(`${r.aware.waypoints} waypoints`);
  await expect(card(page)).toContainText(`${planner.meta.costmap.vehicle_height_m} m`);
  await expect(card(page)).toContainText('MEASURED');
  await expect(card(page)).toContainText("this project's own naive baseline");
  const text = await card(page).innerText();
  for (const re of BANNED) expect(text, `card copy must not match ${re}`).not.toMatch(re);
  await expect(page.locator('[data-region="underpass-legend"]')).toContainText('Impassable');
  await expect(page.locator('[data-region="inspector-hint"]')).toContainText('one-height grid');
});

test('it excludes the uniform comparison, ends with Isometric, and only the bridge scene offers it', async ({ page }) => {
  await openInspector(page);
  const uniform = page.getByRole('button', { name: /Compare with uniform 5 cm/ });
  await expect(toggle(page)).toBeEnabled();

  await uniform.click();
  await expect(page.locator('[data-region="compare-divider"]')).toBeVisible();
  await enable(page);
  await expect(uniform).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-region="compare-divider"]')).toHaveCount(0);
  await expect(page.locator('[data-region="compare-card"]')).toHaveCount(0);

  await uniform.click();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(canvas(page)).toHaveAttribute('data-underpass', 'off');

  await toggle(page).click();
  await page.getByRole('radio', { name: 'Isometric' }).click();
  await expect(canvas(page)).toHaveAttribute('data-projection', 'iso');
  await expect(canvas(page)).toHaveAttribute('data-underpass', 'off');

  // A scene with no planner run cannot be compared; moving to one while it is on switches it off.
  await toggle(page).click();
  await page.waitForSelector('html[data-ready~="planner"]', { timeout: 30_000 });
  await page.keyboard.press('2');
  await expect(canvas(page)).toHaveAttribute('data-underpass', 'off');
  await expect(toggle(page)).toBeDisabled();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
});

test('cell controls are inert while it is on, the map still zooms, and the normal view returns afterwards', async ({ page }) => {
  await openInspector(page);
  await expect(zoomLabel(page)).toHaveText('6.0 px/m');
  await enable(page);
  await expect(zoomLabel(page)).not.toHaveText('6.0 px/m'); // fitted to the underpass
  await expect(page.getByRole('group', { name: 'Colour cells by' })).toHaveAttribute('inert', '');
  await expect(page.locator('[data-tour="fovea-presets"]')).toHaveAttribute('inert', '');

  const before = parseFloat((await zoomLabel(page).innerText()).split(' ')[0]);
  const box = (await canvas(page).boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2);
  await page.mouse.wheel(0, -400);
  await expect.poll(async () => parseFloat((await zoomLabel(page).innerText()).split(' ')[0])).toBeGreaterThan(before);

  await toggle(page).click();
  await expect(canvas(page)).toHaveAttribute('data-underpass', 'off');
  await expect(zoomLabel(page)).toHaveText('6.0 px/m');
  await expect(page.getByRole('group', { name: 'Colour cells by' })).not.toHaveAttribute('inert', '');
});

test('if the planner file cannot be fetched the map stays usable and says so', async ({ page }) => {
  const uncaught: string[] = [];
  page.on('pageerror', (e) => uncaught.push(e.message));
  await page.route(/\/data\/planner\//, (route) => route.abort());
  await openInspector(page);
  await toggle(page).click();
  await expect(card(page)).toContainText('No planner run was exported for this scene');
  await expect(canvas(page)).toHaveAttribute('data-underpass', 'off'); // the normal map is still drawn
  await page.getByRole('button', { name: 'Evidence', exact: true }).click();
  await expect(page.locator('[data-region="evidence"]')).toBeVisible();
  expect(uncaught).toEqual([]);
});
