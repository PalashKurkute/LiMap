import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeProjection } from '../src/features/inspector/projection';

// Map Inspector features: isometric view, foveation presets (with outline) and the uniform-vs-FoveaGrid comparison.
// Numbers on screen are checked against the exported JSON files on disk, never against literals.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, '..', 'public', 'data');
const OUT = path.join(HERE, '__out__');

const variant = (scene: string, id: string) => JSON.parse(fs.readFileSync(path.join(DATA, 'variants', scene, `${id}.json`), 'utf8'));

async function openInspector(page: Page, sceneKey = '1') {
  await page.addInitScript(() => localStorage.setItem('limap.welcomeSeen', '1'));
  await page.goto('/dashboard/');
  await page.waitForSelector('html[data-ready~="scene-data"]', { timeout: 30_000 });
  if (sceneKey !== '1') {
    await page.keyboard.press(sceneKey);
    await expect(page.locator(`[role="group"][aria-label="Scenes"] button:has-text("${sceneKey}")`)).toHaveAttribute('aria-pressed', 'true');
    await page.waitForSelector('html[data-ready~="scene-data"]', { timeout: 30_000 });
  }
  await page.getByRole('button', { name: 'Map Inspector', exact: true }).click();
  await page.waitForSelector('html[data-ready~="inspector-drawn"]', { timeout: 30_000 });
}

const canvasOf = (page: Page) => page.locator('[data-region="inspector-canvas"] canvas');

async function canvasPixels(page: Page): Promise<number[]> {
  return canvasOf(page).evaluate((c: HTMLCanvasElement) => {
    const ctx = c.getContext('2d')!;
    return Array.from(ctx.getImageData(0, 0, c.width, c.height).data);
  });
}

test('projection: unproject inverts project on the ground plane in both modes', () => {
  for (const mode of ['2d', 'iso'] as const) {
    const p = makeProjection({ mode, zoom: 6, origin: { x: 400, y: 300 }, groundZ: -1.7 });
    for (const [x, y] of [[0, 0], [12, 0], [-8, 5], [30, -14], [55, 22]]) {
      const s = p.project(x, y);
      const w = p.unproject(s.x, s.y);
      expect(w.x).toBeCloseTo(x, 6);
      expect(w.y).toBeCloseTo(y, 6);
    }
  }
  // Heights lift points up the screen in the isometric view and are ignored top-down.
  const iso = makeProjection({ mode: 'iso', zoom: 6, origin: { x: 0, y: 0 }, groundZ: 0 });
  expect(iso.project(10, 0, 3).y).toBeLessThan(iso.project(10, 0, 0).y);
  const flat = makeProjection({ mode: '2d', zoom: 6, origin: { x: 0, y: 0 }, groundZ: 0 });
  expect(flat.project(10, 0, 3).y).toBe(flat.project(10, 0, 0).y);
});

test('isometric view redraws the map, and clicking selects a cell in both projections', async ({ page }) => {
  await openInspector(page);
  const box = (await canvasOf(page).boundingBox())!;
  const before = await canvasPixels(page);

  // Top-down: 12 m ahead of the vehicle at the default zoom.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 - 12 * 6);
  await expect(page.getByText(/ix: -?\d+, iy: -?\d+/)).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('radio', { name: 'Isometric' }).click();
  await expect(canvasOf(page)).toHaveAttribute('data-projection', 'iso');
  const after = await canvasPixels(page);
  let changed = 0;
  for (let i = 0; i < before.length; i += 4) if (Math.abs(before[i] - after[i]) + Math.abs(before[i + 1] - after[i + 1]) > 40) changed++;
  expect(changed / (before.length / 4), 'the isometric view must look different').toBeGreaterThan(0.1);

  // Isometric: the same ground point, projected with the view's own maths (ego sits lower in this view).
  const p = makeProjection({ mode: 'iso', zoom: 6, origin: { x: box.width / 2, y: box.height * 0.62 }, groundZ: -1.7 }).project(12, 0);
  await page.mouse.click(box.x + p.x, box.y + p.y);
  await expect(page.getByText(/ix: -?\d+, iy: -?\d+/)).toBeVisible();
});

test('cursor readout reports world position, distance and ring under the pointer', async ({ page }) => {
  await openInspector(page);
  const box = (await canvasOf(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const readout = page.locator('[data-region="inspector-readout"]');
  await expect(readout).toContainText(/X [+−]0\.\d m fwd/);
  await expect(readout).toContainText('R0 5 cm');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 18 * 6);
  await expect(readout).toContainText(/X \+18\.\d m fwd/);
  await expect(readout).toContainText('R1 10 cm');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 30 * 6);
  await expect(readout).toContainText('R2 25 cm');
});

test('guides toggle and per-scene hint are present', async ({ page }) => {
  await openInspector(page);
  await expect(page.locator('[data-region="inspector-hint"]')).toContainText('Minimum clearance here:');
  const guides = page.getByRole('button', { name: 'Guides', exact: true });
  await expect(guides).toHaveAttribute('aria-pressed', 'true');
  await guides.click();
  await expect(guides).toHaveAttribute('aria-pressed', 'false');
});

for (const [id, label] of [
  ['fovea_city_cruise', 'City'],
  ['fovea_highway_extended', 'Highway'],
  ['fovea_turning_left', 'Turn left'],
  ['fovea_turning_right', 'Turn right'],
] as const) {
  test(`preset ${label}: outline and statistics match the exported variant`, async ({ page }) => {
    await openInspector(page);
    const file = variant('scene_a_bridge', id);
    await page.getByRole('radio', { name: label, exact: true }).click();
    await page.waitForSelector('html[data-ready~="variant"]', { timeout: 30_000 });
    await expect(canvasOf(page)).toHaveAttribute('data-fovea-shift', `${file.meta.fovea.shift_x_m},${file.meta.fovea.shift_y_m}`);
    const card = page.locator('[data-region="fovea-card"]');
    await expect(card).toContainText(`${file.meta.stats.ring0_ahead.toLocaleString()} / ${file.meta.stats.ring0_behind.toLocaleString()}`);
    await expect(card).toContainText('CALCULATED');
    await expect(card).toContainText('MEASURED');
    await expect(page.getByText(`${file.meta.stats.active_cells.toLocaleString()} cells`)).toBeVisible();

    await page.getByRole('radio', { name: 'Stationary' }).click();
    await expect(canvasOf(page)).toHaveAttribute('data-fovea-shift', '0,0');
  });
}

test('uniform vs FoveaGrid: figures equal the exported grids and the divider is keyboard-operable', async ({ page }) => {
  await openInspector(page);
  const uniform = variant('scene_a_bridge', 'uniform_5cm');
  await page.getByRole('button', { name: /Compare with uniform 5 cm/ }).click();
  await page.waitForSelector('html[data-ready~="variant"]', { timeout: 30_000 });

  const card = page.locator('[data-region="compare-card"]');
  await expect(card).toContainText(uniform.meta.stats.active_cells.toLocaleString());
  await expect(card).toContainText(`${uniform.meta.uniform.theoretical_capacity_mb.toFixed(1)} MB`);
  await expect(card).toContainText('MEASURED');
  await expect(card).toContainText('CALCULATED');
  await expect(card).toContainText('Reserved memory is the fixed pool');

  const divider = page.locator('[data-region="compare-divider"]');
  await expect(divider).toHaveAttribute('aria-valuenow', '50');
  await divider.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(divider).toHaveAttribute('aria-valuenow', '45');

  // B toggles it off again.
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('b');
  await expect(divider).toHaveCount(0);
});

test('real scene comparison states that it is a sparse sample', async ({ page }) => {
  await openInspector(page, '5');
  await page.getByRole('button', { name: /Compare with uniform 5 cm/ }).click();
  await expect(page.locator('[data-region="compare-card"]')).toContainText('sparse sample', { timeout: 30_000 });
});

test('inspector state survives leaving and returning to the view', async ({ page }) => {
  await openInspector(page);
  await page.getByRole('radio', { name: 'Isometric' }).click();
  await page.getByRole('button', { name: 'Ring', exact: true }).click();
  await page.getByRole('button', { name: '3D Explore', exact: true }).click();
  await page.getByRole('button', { name: 'Map Inspector', exact: true }).click();
  await expect(canvasOf(page)).toHaveAttribute('data-projection', 'iso');
  await expect(page.getByRole('button', { name: 'Ring', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('review screenshots (isometric overhangs, presets, comparison)', async ({ page }) => {
  test.setTimeout(240_000);
  fs.mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await openInspector(page);
  await page.getByRole('radio', { name: 'Isometric' }).click();
  await page.getByRole('button', { name: 'Overhang', exact: true }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, 'insp_iso_overhang_bridge.png') });
  await page.getByRole('button', { name: 'Class', exact: true }).click();
  await page.getByRole('radio', { name: 'Turn left', exact: true }).click();
  await page.waitForSelector('html[data-ready~="variant"]', { timeout: 30_000 });
  await page.getByRole('radio', { name: 'Top-down' }).click();
  await page.getByRole('button', { name: 'Ring', exact: true }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, 'insp_preset_turn_left_ring.png') });
  await page.getByRole('radio', { name: 'Stationary' }).click();
  await page.getByRole('button', { name: /Compare with uniform 5 cm/ }).click();
  await page.waitForSelector('html[data-ready~="variant"]', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Class', exact: true }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, 'insp_compare_class.png') });
});
