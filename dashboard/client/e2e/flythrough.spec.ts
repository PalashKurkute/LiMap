import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { FLIGHT_FOV_DEG, planFlight, poseAt, poseNearX } from '../src/features/viewport/flythrough';

// "Fly under the bridge": a scripted camera shot along the route the 2.5D planner found. The camera pose lives inside
// three.js, so the tests read it through the picture (canvas pixels) and through the button's state.

const planner = JSON.parse(
  fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'planner', 'scene_a_bridge.json'), 'utf8'),
);

const FLY = (page: Page) => page.getByRole('button', { name: 'Fly under the bridge', exact: true }); // exact: the "?" beside it is "About Fly under the bridge"
const STOP = (page: Page) => page.getByRole('button', { name: 'Stop the fly-through' });
const view = (page: Page) => page.locator('[data-region="viewport-canvas"] canvas');

async function openBridge(page: Page) {
  await page.addInitScript(() => localStorage.setItem('limap.welcomeSeen', '1'));
  await page.goto('/dashboard/');
  await page.waitForSelector('html[data-ready~="viewport-built"]', { timeout: 60_000 });
  await expect(FLY(page)).toBeVisible();
}

async function shot(page: Page): Promise<PNG> {
  return PNG.sync.read(await view(page).screenshot());
}

/**
 * The picture once the camera has stopped moving. The view eases into its opening pose, and when the browser renders in
 * software the first frames arrive seconds apart, so two identical shots do not prove it has arrived. Hence a fixed
 * minimum wait first, then two stable comparisons in a row.
 */
async function settled(page: Page): Promise<PNG> {
  await page.waitForTimeout(20_000);
  let prev = await shot(page);
  let stable = 0;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1500);
    const cur = await shot(page);
    stable = diff(prev, cur) < 0.001 ? stable + 1 : 0;
    if (stable >= 2) return cur;
    prev = cur;
  }
  throw new Error('the 3D view never settled');
}

/**
 * How different two pictures of the 3D view are, as the fraction of 16 px blocks whose average colour differs clearly.
 * The scene is thousands of 1-2 px features, so a camera that settles a hair off (well under a centimetre) moves them
 * by a fraction of a pixel and flips a large share of the raw pixels. Averaging over blocks ignores that and still
 * sees a real change of pose. Measured: the same still pose scores 0.00, an orbited camera about 0.56.
 */
function diff(a: PNG, b: PNG, block = 16, tol = 12): number {
  const bw = Math.floor(a.width / block);
  const bh = Math.floor(a.height / block);
  let changed = 0;
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      const sum = [0, 0, 0, 0, 0, 0];
      for (let y = 0; y < block; y++) {
        for (let x = 0; x < block; x++) {
          const i = ((by * block + y) * a.width + bx * block + x) * 4;
          for (let c = 0; c < 3; c++) {
            sum[c] += a.data[i + c];
            sum[3 + c] += b.data[i + c];
          }
        }
      }
      const n = block * block;
      if (Math.abs(sum[0] - sum[3]) / n + Math.abs(sum[1] - sum[4]) / n + Math.abs(sum[2] - sum[5]) / n > tol) changed++;
    }
  }
  return changed / (bw * bh);
}

// ---- the route maths, on its own (pure functions) -------------------------------------------------------------------

test('the camera route: eased, continuous, level at eye height, looking along the path', () => {
  const path: [number, number, number][] = [
    [5, 0, 0],
    [10, 0.5, 0],
    [15, 1.5, 0],
    [20, 2, 0],
  ];
  const plan = planFlight(path, -1.7)!;
  expect(planFlight([[0, 0, 0]], 0)).toBeNull();
  // Starts before the first point and ends after the last, along the route.
  const start = poseAt(plan, 0);
  const end = poseAt(plan, plan.durationS + 5);
  expect(start.pos[0]).toBeLessThan(path[0][0]);
  expect(end.pos[0]).toBeGreaterThan(path[path.length - 1][0]);
  expect(start.done).toBe(false);
  expect(end.done).toBe(true);
  // Eye height is above the ground, below the vehicle height the planner used (so the camera fits where it fits), and
  // the same all the way; the look target is a little higher and ahead.
  expect(plan.eyeZ - -1.7).toBeGreaterThan(0);
  expect(plan.eyeZ - -1.7).toBeLessThan(planner.meta.costmap.vehicle_height_m);
  for (const t of [0, 0.3, 0.6, 1]) {
    const p = poseAt(plan, plan.durationS * t);
    expect(p.pos[2]).toBeCloseTo(plan.eyeZ, 9);
    expect(p.look[2]).toBeGreaterThan(p.pos[2]);
    expect(p.look[0]).toBeGreaterThan(p.pos[0] - 1e-9);
  }
  // Eased: slower at the ends than in the middle, and never going backwards.
  const at = (u: number) => poseAt(plan, plan.durationS * u).pos[0];
  expect(at(0.1) - at(0)).toBeLessThan(at(0.55) - at(0.45));
  let last = -Infinity;
  for (let i = 0; i <= 50; i++) {
    const x = at(i / 50);
    expect(x).toBeGreaterThanOrEqual(last - 1e-9);
    last = x;
  }
  // The still pose for reduced motion sits just before the requested forward position.
  expect(poseNearX(plan, 14).pos[0]).toBeCloseTo(14, 0);
  expect(poseNearX(plan, null).pos[0]).toBeGreaterThan(path[0][0]);
  expect(FLIGHT_FOV_DEG).toBeGreaterThan(45); // wider than the normal view, so the deck overhead stays in frame
});

// ---- in the app -----------------------------------------------------------------------------------------------------

test('the button is on the bridge scene only, and only in the pipeline view', async ({ page }) => {
  await openBridge(page);
  await page.keyboard.press('2');
  await expect(page.getByRole('button', { name: /^Potholes/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(FLY(page)).toHaveCount(0);
  await page.keyboard.press('1');
  await expect(FLY(page)).toBeVisible();
  await page.getByRole('button', { name: 'Concept view' }).click();
  await expect(FLY(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Pipeline output' }).click();
  await expect(FLY(page)).toBeVisible();
});

test('reduced motion: the shot is a still pose under the deck, and Stop glides back to the normal view', async ({ page }) => {
  test.setTimeout(300_000);
  await openBridge(page);
  const normal = await settled(page);

  await FLY(page).click();
  await expect(STOP(page)).toBeVisible();
  await page.waitForTimeout(1500);
  const under = await shot(page);
  expect(diff(normal, under), 'the camera must have moved under the deck').toBeGreaterThan(0.2);

  await STOP(page).click();
  await expect(FLY(page)).toBeVisible();
  // The camera eases back to where it was; poll because software-rendered frames are slow.
  await expect
    .poll(async () => diff(normal, await shot(page)), { timeout: 150_000, intervals: [3000] })
    .toBeLessThan(0.02);
});

test.describe('with animations on', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('it flies the route by itself, then returns to the normal view; dragging takes the camera back at once', async ({ page }) => {
    test.setTimeout(300_000);
    await openBridge(page);

    await FLY(page).click();
    await expect(STOP(page)).toBeVisible();
    // The script is time-based, so it ends on its own whatever the frame rate; the button goes back to "Fly".
    await expect(FLY(page)).toBeVisible({ timeout: 90_000 });

    // Second shot: a drag on the canvas hands the camera back immediately.
    await FLY(page).click();
    await expect(STOP(page)).toBeVisible();
    const box = (await view(page).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 20, { steps: 4 });
    await page.mouse.up();
    await expect(FLY(page)).toBeVisible({ timeout: 10_000 });
  });
});

test('R puts an orbited camera back (it used to reset only the hidden vehicle)', async ({ page }) => {
  test.setTimeout(300_000);
  await openBridge(page);
  const normal = await settled(page);

  const box = (await view(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 220, box.y + box.height / 2 - 90, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(2500);
  expect(diff(normal, await shot(page)), 'dragging must have moved the camera').toBeGreaterThan(0.2);

  await page.locator('body').click({ position: { x: 3, y: 3 } }); // focus off the canvas, so the key reaches the app
  await page.keyboard.press('r');
  await expect
    .poll(async () => diff(normal, await shot(page)), { timeout: 150_000, intervals: [3000] })
    .toBeLessThan(0.02);
});
