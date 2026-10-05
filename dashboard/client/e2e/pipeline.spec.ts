import { test, expect, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

// The 3D view's default content is the pipeline's own output (grid cells + raw returns), switchable to a labelled
// hand-built concept illustration.

async function open(page: Page, theme: 'light' | 'dark' = 'light') {
  await page.addInitScript((t) => {
    localStorage.setItem('limap.welcomeSeen', '1');
    localStorage.setItem('limap.theme', t);
  }, theme);
  await page.goto('/dashboard/');
  await expect(page.locator('[data-region="data-source"]')).toContainText('Snapshot');
}

/** Fraction of pixels in the central band of the 3D canvas that differ clearly from the scene background. */
async function nonBackgroundFraction(page: Page): Promise<number> {
  const bg = await page.evaluate(() => {
    const hex = getComputedStyle(document.documentElement).getPropertyValue('--scene-bg').trim();
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  });
  const box = (await page.locator('[data-region="viewport-canvas"] canvas').boundingBox())!;
  const clip = { x: box.x + box.width * 0.35, y: box.y + box.height * 0.55, width: box.width * 0.3, height: box.height * 0.3 };
  const png = PNG.sync.read(await page.screenshot({ clip }));
  let diff = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const d = Math.max(Math.abs(png.data[i] - bg[0]), Math.abs(png.data[i + 1] - bg[1]), Math.abs(png.data[i + 2] - bg[2]));
    if (d > 24) diff++;
  }
  return diff / (png.data.length / 4);
}

test('opens on the pipeline output with a synthetic-scan stamp and a legend', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('button', { name: 'Pipeline output' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-region="provenance"]')).toContainText('Synthetic scan · pipeline output');
  await expect(page.locator('[data-region="viewport-legend"]')).toContainText('Height above ground');
  await expect(page.locator('[data-region="replay"]')).toContainText('Single scan');
  await page.waitForTimeout(1200);
  expect(await nonBackgroundFraction(page), 'grid cells must actually be drawn').toBeGreaterThan(0.15);
});

test('colour modes change the legend', async ({ page }) => {
  await open(page);
  await page.waitForTimeout(1200);
  const legend = page.locator('[data-region="viewport-legend"]');
  const modes: [string, string][] = [
    ['Class', 'Class'],
    ['Ring', 'Resolution ring'],
    ['Variance', 'Welford variance'],
    ['Height', 'Height above ground'],
  ];
  for (const [button, title] of modes) {
    await page.getByRole('radio', { name: button, exact: true }).click();
    await expect(legend).toContainText(title);
  }
  // Ring colouring lists all four lattice rings.
  await page.getByRole('radio', { name: 'Ring', exact: true }).click();
  for (const r of ['R0 · 5 cm', 'R1 · 10 cm', 'R2 · 25 cm', 'R3 · 50 cm']) await expect(legend).toContainText(r);
});

test('concept view is clearly labelled, restores the illustrative replay, and can be left again', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Concept view' }).click();
  await expect(page.locator('[data-region="provenance"]')).toContainText('Concept illustration · hand-built');
  await expect(page.getByRole('button', { name: /^(Pause|Play)$/ })).toBeVisible();
  await expect(page.locator('[data-region="viewport-legend"]')).toContainText('Height');
  // colour options differ per mode
  await expect(page.getByRole('radio', { name: 'Slope', exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Class', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Pipeline output' }).click();
  await expect(page.locator('[data-region="replay"]')).toContainText('Single scan');
  await expect(page.getByRole('radio', { name: 'Class', exact: true })).toBeVisible();
});

test('real scene: no concept toggle, and it is stamped as a real recording', async ({ page }) => {
  await open(page);
  await page.keyboard.press('5');
  await expect(page.locator('[data-region="provenance"]')).toContainText('Real recording');
  await expect(page.locator('[role="group"][aria-label="What the 3D view shows"]')).toHaveCount(0);
});

test('every synthetic scene draws its own pipeline output', async ({ page }) => {
  test.setTimeout(300_000); // software-rendered WebGL in the test browser
  await open(page);
  for (const key of ['1', '2', '3', '4']) {
    await page.keyboard.press(key);
    await expect(page.locator('[data-region="provenance"]')).toContainText('Synthetic scan · pipeline output');
    await page.waitForTimeout(1500);
    expect(await nonBackgroundFraction(page), `scene ${key}`).toBeGreaterThan(0.1);
  }
});

test('theme toggle re-colours the drawn cells in place (no reload)', async ({ page }) => {
  test.setTimeout(300_000); // three full-canvas screenshots of software-rendered WebGL take ~2 min in the test browser
  await open(page, 'light');
  await page.waitForTimeout(1500);
  const shot = async () => PNG.sync.read(await page.locator('[data-region="viewport-canvas"] canvas').screenshot());
  const before = await shot();
  await page.getByRole('button', { name: /theme \(switch to/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.waitForTimeout(800);
  const after = await shot();
  // Same canvas, different pixels: background and cell colours both changed.
  let changed = 0;
  for (let i = 0; i < before.data.length; i += 4) {
    if (Math.abs(before.data[i] - after.data[i]) + Math.abs(before.data[i + 1] - after.data[i + 1]) > 40) changed++;
  }
  expect(changed / (before.data.length / 4)).toBeGreaterThan(0.5);
  expect(await nonBackgroundFraction(page), 'cells still drawn after the toggle').toBeGreaterThan(0.1);
});

test('dropout preview is available and reversible in pipeline mode', async ({ page }) => {
  await open(page);
  await page.keyboard.press('t');
  await page.getByRole('tab', { name: 'Stress', exact: true }).click();
  await page.getByRole('radio', { name: /Half the points hidden/ }).click();
  await expect(page.getByRole('radio', { name: /Half the points hidden/ })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: /All returns drawn/ }).click();
  await expect(page.getByRole('radio', { name: /All returns drawn/ })).toHaveAttribute('aria-checked', 'true');
});
