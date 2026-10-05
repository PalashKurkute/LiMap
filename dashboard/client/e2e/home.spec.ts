import { test, expect, type Page } from '@playwright/test';
import { popover, ready, tour } from './tour-helpers';

// The home screen at / (logos, one paragraph, buttons into the dashboard at /dashboard/). It needs no backend and no scene data.

async function openHome(page: Page, theme: 'light' | 'dark' = 'light') {
  await page.addInitScript((t) => localStorage.setItem('limap.theme', t), theme);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'LiMap' })).toBeVisible();
}

for (const theme of ['light', 'dark'] as const) {
  test(`${theme}: both logos and the description are shown, and the team logo matches the theme`, async ({ page }) => {
    await openHome(page, theme);
    const product = page.getByRole('img', { name: 'LiMap logo' });
    const team = page.getByRole('img', { name: 'Team Abhedya logo' });
    await expect(product).toBeVisible();
    await expect(team).toBeVisible();
    await expect(team).toHaveAttribute('src', new RegExp(`team-abhedya-${theme}\\.png$`));
    // Both really loaded (a broken image has no natural width).
    expect(await team.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByText(/turns a LiDAR scan into a 2\.5D grid/)).toBeVisible();
    await expect(page.getByText('Built by')).toBeVisible();
  });
}

test('the page has one main landmark, one level-one heading, one banner and one footer', async ({ page }) => {
  await openHome(page);
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('banner')).toHaveCount(1);
  await expect(page.getByRole('contentinfo')).toHaveCount(1);
});

test('the theme toggle switches the page and the team logo', async ({ page }) => {
  await openHome(page, 'light');
  await page.getByRole('button', { name: /Light theme/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('img', { name: 'Team Abhedya logo' })).toHaveAttribute('src', /team-abhedya-dark\.png$/);
});

test('"Open the dashboard" reaches the dashboard, and the dashboard logo leads back home', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('limap.welcomeSeen', '1'));
  await openHome(page);
  await page.getByRole('link', { name: /Open the dashboard/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/$/);
  await page.waitForSelector('html[data-ready~="scene-data"]', { timeout: 30_000 });
  await expect(page.locator('[data-region="header"]')).toBeVisible();

  await page.getByRole('link', { name: 'LiMap home' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'LiMap' })).toBeVisible();
});

test('"Take the guided tour" starts the tour on the dashboard', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('limap.welcomeSeen', '1'));
  await openHome(page);
  await page.getByRole('link', { name: /Take the guided tour/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/(\?.*)?$/);
  await ready(page);
  await expect(popover(page)).toContainText('Step 1 of');
  await page.getByRole('button', { name: 'Exit tour' }).click();
  await expect(tour(page)).toHaveCount(0);
});

test('an old /?tour=1 link goes straight to the tour on the dashboard', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('limap.welcomeSeen', '1'));
  await page.goto('/?tour=1');
  await expect(page).toHaveURL(/\/dashboard\//);
  await ready(page);
  expect(page.url()).not.toContain('tour=1');
});

test('loading the home page makes no failed request and logs no error', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()}`));
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`http ${r.status()}: ${r.url()}`);
  });
  await openHome(page);
  await page.waitForLoadState('networkidle');
  expect(problems).toEqual([]);
});

for (const size of [
  { width: 1280, height: 720 },
  { width: 390, height: 800 },
]) {
  test(`no horizontal overflow at ${size.width}px, and the buttons and team logo are reachable`, async ({ page }) => {
    await page.setViewportSize(size);
    await openHome(page);
    const overflow = await page.locator('[data-region="home"]').evaluate((e) => e.scrollWidth - e.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    // On a small window the page scrolls inside itself; everything can still be brought into view.
    for (const target of [page.getByRole('link', { name: /Open the dashboard/ }), page.getByRole('img', { name: 'Team Abhedya logo' })]) {
      await target.scrollIntoViewIfNeeded();
      await expect(target).toBeInViewport();
    }
  });
}

test('the brand files are served', async ({ page }) => {
  for (const f of ['team-abhedya-dark.png', 'team-abhedya-light.png', 'team-abhedya-mark-dark.png', 'team-abhedya-mark-light.png', 'limap-logo.svg']) {
    const res = await page.request.get(`/brand/${f}`);
    expect(res.status(), f).toBe(200);
  }
  expect((await page.request.get('/favicon.svg')).status()).toBe(200);
});
