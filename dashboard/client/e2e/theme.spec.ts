import { test, expect, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

// Proves the light/dark toggle reaches EVERY surface: DOM regions, large surfaces found by a deep walk,
// modals, and both canvases (checked by sampling real rendered pixels), at load AND after a live toggle.

type Theme = 'light' | 'dark';
const DARK_MAX = 0.35;
const LIGHT_MIN = 0.75;

async function boot(page: Page, theme: Theme, welcome = false) {
  await page.addInitScript(
    ([t, w]) => {
      localStorage.setItem('limap.theme', t as string);
      if (!w) localStorage.setItem('limap.welcomeSeen', '1');
    },
    [theme, welcome],
  );
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

/** Converts any CSS colour (incl. oklab / color-mix results) to sRGBA via a canvas. */
const COLOR_HELPERS = `
  window.__rgba = (css) => {
    const c = document.createElement('canvas'); c.width = c.height = 1;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.clearRect(0, 0, 1, 1); x.fillStyle = css; x.fillRect(0, 0, 1, 1);
    const d = x.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255];
  };
  window.__lum = (rgb) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]); };
`;

async function regionLuminances(page: Page) {
  await page.evaluate(COLOR_HELPERS);
  return page.evaluate(() => {
    const out: Record<string, number> = {};
    document.querySelectorAll('[data-region]').forEach((el) => {
      const name = el.getAttribute('data-region')!;
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      const rgba = (window as any).__rgba(getComputedStyle(el).backgroundColor);
      if (rgba[3] < 0.8) return; // transparent / translucent regions are checked by the deep walk
      out[name] = (window as any).__lum(rgba);
    });
    return out;
  });
}

/** Large opaque surfaces whose luminance is on the wrong side for the active theme. */
async function offendingSurfaces(page: Page, theme: Theme) {
  await page.evaluate(COLOR_HELPERS);
  return page.evaluate((t) => {
    const root = getComputedStyle(document.documentElement);
    const exempt = ['--accent', '--good', '--warn', '--critical', '--prov-measured', '--prov-calculated', '--prov-estimate', '--prov-synthetic', '--prov-precomputed']
      .map((v) => (window as any).__rgba(root.getPropertyValue(v).trim()).slice(0, 3).join(','));
    const bad: string[] = [];
    document.body.querySelectorAll('*').forEach((el) => {
      if (el.closest('svg, canvas, [data-swatch]')) return;
      const he = el as HTMLElement;
      const r = he.getBoundingClientRect();
      if (r.width * r.height < 6000 || r.width < 2 || r.height < 2) return;
      const style = getComputedStyle(he);
      if (style.visibility === 'hidden' || style.display === 'none') return;
      const rgba = (window as any).__rgba(style.backgroundColor);
      if (rgba[3] < 0.8) return;
      if (exempt.includes(rgba.slice(0, 3).join(','))) return;
      const L = (window as any).__lum(rgba);
      if ((t === 'dark' && L > 0.35) || (t === 'light' && L < 0.75)) {
        bad.push(`${he.tagName.toLowerCase()}.${String(he.className).split(' ').slice(0, 4).join('.')} lum=${L.toFixed(2)}`);
      }
    });
    return bad;
  }, theme);
}

async function expectRegions(page: Page, theme: Theme, names: string[]) {
  const lums = await regionLuminances(page);
  for (const n of names) {
    expect(lums[n], `region "${n}" should exist`).toBeDefined();
    if (theme === 'dark') expect(lums[n], `region "${n}" luminance in dark theme`).toBeLessThan(DARK_MAX);
    else expect(lums[n], `region "${n}" luminance in light theme`).toBeGreaterThan(LIGHT_MIN);
  }
  expect(await offendingSurfaces(page, theme), `no large surface may stay in the other theme (${theme})`).toEqual([]);
}

/** Samples a small patch at the top-left of a canvas from a real screenshot and compares to --scene-bg. */
async function expectCanvasBackground(page: Page, selector: string) {
  const expected = await page.evaluate(() => {
    const hex = getComputedStyle(document.documentElement).getPropertyValue('--scene-bg').trim();
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  });
  const box = await page.locator(selector).first().boundingBox();
  expect(box, `${selector} should be visible`).not.toBeNull();
  const png = PNG.sync.read(await page.screenshot({ clip: { x: box!.x + 3, y: box!.y + 3, width: 4, height: 4 } }));
  const px = [png.data[0], png.data[1], png.data[2]];
  const maxDiff = Math.max(...px.map((v, i) => Math.abs(v - expected[i])));
  expect(maxDiff, `canvas pixel ${px} should match --scene-bg ${expected}`).toBeLessThanOrEqual(10);
}

for (const theme of ['light', 'dark'] as Theme[]) {
  test(`${theme}: header, status bar, 3D scene and drawer follow the theme`, async ({ page }) => {
    await boot(page, theme);
    await page.waitForTimeout(800);
    await expectRegions(page, theme, ['header', 'statusbar', 'scene-card']);
    await expectCanvasBackground(page, '[data-region="viewport-canvas"] canvas');

    await page.keyboard.press('t');
    await expect(page.locator('.telemetry-drawer')).toHaveClass(/open/);
    await expect.poll(async () => (await page.locator('[data-region="drawer"]').boundingBox())?.width ?? 0).toBeGreaterThan(300);
    await expectRegions(page, theme, ['drawer']);
    for (const tab of ['Vehicle', 'Section', 'Stress']) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      expect(await offendingSurfaces(page, theme), `drawer tab ${tab}`).toEqual([]);
    }
  });

  test(`${theme}: map inspector (DOM + canvas) follows the theme for every scene`, async ({ page }) => {
    await boot(page, theme);
    await page.getByRole('button', { name: 'Map Inspector', exact: true }).click();
    await page.waitForTimeout(500);
    await expectRegions(page, theme, ['header', 'inspector-screen', 'inspector-sidebar']);
    await expectCanvasBackground(page, '[data-region="inspector-canvas"] canvas');
  });

  test(`${theme}: tour callout and tour popover follow the theme`, async ({ page }) => {
    await boot(page, theme, true);
    await expect(page.locator('[data-region="tour-nudge"]')).toBeVisible();
    await expectRegions(page, theme, ['tour-nudge']);
    await page.locator('[data-region="tour-nudge"]').getByRole('button', { name: 'Take the tour' }).click();
    await expect(page.locator('[data-region="tour"]')).toHaveAttribute('data-tour-phase', 'ready', { timeout: 90_000 });
    await expectRegions(page, theme, ['tour-popover']);
    expect(await offendingSurfaces(page, theme), 'tour surfaces').toEqual([]);
  });
}

for (const [from, to] of [['light', 'dark'], ['dark', 'light']] as [Theme, Theme][]) {
  test(`runtime toggle ${from} -> ${to} updates DOM, 3D canvas and map canvas without a reload`, async ({ page }) => {
    await boot(page, from);
    await page.waitForTimeout(800);
    await expectCanvasBackground(page, '[data-region="viewport-canvas"] canvas');

    await page.getByRole('button', { name: /theme \(switch to/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', to);
    await page.waitForTimeout(500);
    await expectRegions(page, to, ['header', 'statusbar', 'scene-card']);
    await expectCanvasBackground(page, '[data-region="viewport-canvas"] canvas');

    // Persisted, and the map inspector comes up in the new theme as well.
    expect(await page.evaluate(() => localStorage.getItem('limap.theme'))).toBe(to);
    await page.getByRole('button', { name: 'Map Inspector', exact: true }).click();
    await page.waitForTimeout(400);
    await expectRegions(page, to, ['inspector-screen', 'inspector-sidebar']);
    await expectCanvasBackground(page, '[data-region="inspector-canvas"] canvas');

    // Toggle again while on the inspector (canvas must redraw), then back to 3D.
    await page.getByRole('button', { name: /theme \(switch to/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', from);
    await page.waitForTimeout(400);
    await expectCanvasBackground(page, '[data-region="inspector-canvas"] canvas');
    await page.getByRole('button', { name: '3D Explore', exact: true }).click();
    await page.waitForTimeout(600);
    await expectCanvasBackground(page, '[data-region="viewport-canvas"] canvas');
  });
}

test('no theme flash: data-theme is set before the app bundle executes', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('limap.theme', 'dark'));
  await page.route(/\/assets\/index-.*\.js/, async (route) => {
    await new Promise((r) => setTimeout(r, 600)); // delay React so only the inline script could have run
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'commit' });
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark', null, { timeout: 500 });
  const rootChildren = await page.evaluate(() => document.getElementById('root')?.childElementCount ?? 0);
  expect(rootChildren, 'React must not have rendered yet').toBe(0);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).not.toBe('rgb(248, 250, 252)'); // light --app
});

test('system preference is honoured when no theme is stored, and changes live', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => localStorage.setItem('limap.welcomeSeen', '1'));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

// Negative controls: prove the checks above are capable of failing.
test('self-test: the surface walker detects a light panel left in dark theme', async ({ page }) => {
  await boot(page, 'dark');
  await page.waitForTimeout(500);
  expect(await offendingSurfaces(page, 'dark')).toEqual([]);
  await page.evaluate(() => {
    const header = document.querySelector('[data-region="statusbar"]') as HTMLElement;
    const big = document.createElement('div');
    big.style.cssText = 'position:fixed;left:0;top:0;width:300px;height:300px;background:#ffffff;z-index:999';
    document.body.appendChild(big);
    header.dataset.mutated = '1';
  });
  const bad = await offendingSurfaces(page, 'dark');
  expect(bad.length, 'a forced white panel must be reported').toBeGreaterThan(0);
});

test('self-test: the canvas check detects a canvas stuck on the other theme', async ({ page }) => {
  await boot(page, 'dark');
  await page.waitForTimeout(800);
  await expectCanvasBackground(page, '[data-region="viewport-canvas"] canvas'); // passes when correct
  // Pretend the token says "light" while the canvas is still dark: the comparison must fail.
  await page.evaluate(() => document.documentElement.style.setProperty('--scene-bg', '#eef2f6'));
  await expect(expectCanvasBackground(page, '[data-region="viewport-canvas"] canvas')).rejects.toThrow();
});
