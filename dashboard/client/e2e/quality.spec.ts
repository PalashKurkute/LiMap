import { test, expect, type Page } from '@playwright/test';
import { pollDelayMs } from '../src/lib/pollDelay';

// Page structure, badge contrast and the API-poll back-off: small guards for the accessibility pass.

async function boot(page: Page, theme: 'light' | 'dark' = 'light') {
  await page.addInitScript((t) => {
    localStorage.setItem('limap.welcomeSeen', '1');
    localStorage.setItem('limap.theme', t);
  }, theme);
  await page.goto('/');
  await page.waitForSelector('html[data-ready~="scene-data"]', { timeout: 30_000 });
}

test('every view has one main landmark, one level-one heading and one banner', async ({ page }) => {
  await boot(page);
  const check = async (heading: string) => {
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    await expect(page.getByRole('banner')).toHaveCount(1);
  };
  await check('3D Explore');
  await page.getByRole('button', { name: 'Map Inspector', exact: true }).click();
  await page.waitForSelector('html[data-ready~="inspector-drawn"]', { timeout: 30_000 });
  await check('Map Inspector');
  await page.getByRole('button', { name: 'Evidence', exact: true }).click();
  await page.waitForSelector('html[data-ready~="evidence-loaded"]', { timeout: 30_000 });
  await check('Evidence');
});

type Rgb = [number, number, number];
const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: Rgb) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const hex = (h: string): Rgb => {
  const n = parseInt(h.trim().slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const tint = (fg: Rgb, bg: Rgb, a: number): Rgb => [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)) as Rgb;

for (const theme of ['light', 'dark'] as const) {
  test(`${theme}: provenance badge text reaches 4.5:1 on its own tint, on every surface`, async ({ page }) => {
    await boot(page, theme);
    const tokens = await page.evaluate(() => {
      const css = getComputedStyle(document.documentElement);
      const get = (n: string) => css.getPropertyValue(n);
      return {
        badges: ['--prov-measured', '--prov-calculated', '--prov-estimate', '--prov-precomputed'].map((n) => [n, get(n)] as const),
        surfaces: ['--app', '--panel', '--subtle', '--elevated'].map((n) => get(n)).filter((v) => /^\s*#[0-9a-f]{6}\s*$/i.test(v)),
      };
    });
    expect(tokens.surfaces.length).toBeGreaterThan(1);
    for (const [name, value] of tokens.badges) {
      for (const surface of tokens.surfaces) {
        const text = hex(value);
        const ratio = contrast(text, tint(text, hex(surface), 0.1)); // the badge fill is the same colour at 10%
        expect(ratio, `${name} ${value} on ${surface.trim()}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
}

test('the API health ping backs off while the API is down, and stays at 10 s while it answers', () => {
  expect([0, 1].map(pollDelayMs)).toEqual([10_000, 10_000]);
  expect([2, 3, 4].map(pollDelayMs)).toEqual([20_000, 40_000, 60_000]);
  expect(pollDelayMs(50)).toBe(60_000);
});
