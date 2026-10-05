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
    await expect(product).toHaveAttribute('src', new RegExp(`limap-mark-${theme}\\.svg$`));
    // Both really loaded (a broken image has no natural width).
    expect(await team.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
    expect(await product.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
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
  for (const f of ['team-abhedya-dark.png', 'team-abhedya-light.png', 'team-abhedya-mark-dark.png', 'team-abhedya-mark-light.png', 'limap-logo-light.svg', 'limap-logo-dark.svg', 'limap-mark-light.svg', 'limap-mark-dark.svg']) {
    const res = await page.request.get(`/brand/${f}`);
    expect(res.status(), f).toBe(200);
  }
  expect((await page.request.get('/favicon.svg')).status()).toBe(200);
});

// "How it fits a robot": four stages (scan in, grid, costmap, planner) and the honest gaps, below the hero.

const SECTION_ID = 'how-it-fits-a-robot';
const section = (page: Page) => page.locator(`section#${SECTION_ID}`);
const scroller = (page: Page) => page.locator('[data-region="home"]');
const STAGES = ['Scan in', 'Grid', 'Costmap', 'Planner'];

for (const theme of ['light', 'dark'] as const) {
  test(`${theme}: the "How it fits a robot" section shows four stages in order and the gaps`, async ({ page }) => {
    await openHome(page, theme);
    const h2 = page.getByRole('heading', { level: 2, name: 'How it fits a robot' });
    // Scroll the heading, not the section: when the section's top edge already peeks in at the bottom of the window, the
    // browser counts the section as visible and does not scroll, leaving the heading below the fold.
    await h2.scrollIntoViewIfNeeded();
    await expect(h2).toBeVisible();
    await expect(h2).toBeInViewport();
    // The stages are in the documented order, left to right.
    await expect(section(page).locator('[data-stage] h3')).toHaveText(STAGES);
    const boxes = await section(page).locator('[data-stage]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().left));
    expect(boxes).toEqual([...boxes].sort((a, b) => a - b)); // 1440 px wide: one row, ascending
    expect(new Set(boxes.map((b) => Math.round(b))).size).toBe(4);
  });
}

test('every stage and every gap has real text, and each stage says what is real and what is only described', async ({ page }) => {
  await openHome(page);
  const stages = section(page).locator('[data-stage]');
  await expect(stages).toHaveCount(4);
  for (let i = 0; i < 4; i++) {
    const s = stages.nth(i);
    await expect(s.getByText(`Stage ${i + 1}`, { exact: true })).toHaveCount(1);
    await expect(s.getByText('In this repo', { exact: true })).toHaveCount(1);
    await expect(s.getByText('Only described', { exact: true })).toHaveCount(1);
    // What it is, what is real, what is only described: three non-empty sentences.
    const paragraphs = [await s.locator(':scope > p').innerText(), ...(await s.locator('dd').allInnerTexts())];
    expect(paragraphs).toHaveLength(3);
    for (const p of paragraphs) expect(p.trim().length, `stage ${i + 1}: ${p}`).toBeGreaterThan(20);
  }
  await expect(section(page).getByRole('heading', { level: 3, name: 'What is not done yet' })).toBeVisible();
  const gaps = section(page).locator('[data-gap]');
  expect(await gaps.count()).toBeGreaterThanOrEqual(4);
  for (const g of await gaps.allInnerTexts()) expect(g.trim().length, g).toBeGreaterThan(40);
  // The honest gaps named in the plan are all present.
  const text = await section(page).innerText();
  for (const re of [/Jetson|embedded/, /ROS 2/, /Nav2/, /bridge underpass/, /segmentation model/]) expect(text).toMatch(re);
});

test('headings run h1, then h2, then h3 in page order, and the section is a named region inside the one main', async ({ page }) => {
  await openHome(page);
  const headings = await page.getByRole('heading').evaluateAll((els) => els.map((e) => [Number(e.tagName.slice(1)), (e.textContent ?? '').trim()] as const));
  expect(headings.map(([l]) => l)).toEqual([1, 2, 3, 3, 3, 3, 3]);
  expect(headings.map(([, t]) => t)).toEqual(['LiMap', 'How it fits a robot', ...STAGES, 'What is not done yet']);
  await expect(page.getByRole('region', { name: 'How it fits a robot' })).toHaveCount(1);
  await expect(page.getByRole('main').getByRole('region', { name: 'How it fits a robot' })).toHaveCount(1);
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('banner')).toHaveCount(1);
  await expect(page.getByRole('contentinfo')).toHaveCount(1);
});

for (const size of [
  { width: 1280, height: 720 },
  { width: 390, height: 800 },
]) {
  test(`no horizontal overflow at ${size.width}px with the robot-fit section, and nothing in it sticks out`, async ({ page }) => {
    await page.setViewportSize(size);
    await openHome(page);
    await section(page).scrollIntoViewIfNeeded();
    const m = await scroller(page).evaluate((root, id) => {
      const box = root.getBoundingClientRect();
      const out: string[] = [];
      for (const el of document.getElementById(id)!.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > box.right + 1 || r.left < box.left - 1)) out.push(`${el.tagName.toLowerCase()} ${Math.round(r.left)}..${Math.round(r.right)}`);
      }
      return { overflow: root.scrollWidth - root.clientWidth, out };
    }, SECTION_ID);
    expect(m.overflow).toBeLessThanOrEqual(1);
    expect(m.out).toEqual([]);
    // Stacked on a phone, side by side on a wide window.
    const lefts = await section(page).locator('[data-stage]').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
    expect(new Set(lefts).size).toBe(size.width >= 1280 ? 4 : 1);
  });
}

async function spyScroll(page: Page) {
  await page.addInitScript(() => {
    const orig = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element, arg?: boolean | ScrollIntoViewOptions) {
      (window as unknown as { __scroll: unknown }).__scroll = arg;
      return orig.call(this, arg as ScrollIntoViewOptions);
    };
  });
}
const lastScroll = (page: Page) => page.evaluate(() => (window as unknown as { __scroll?: { behavior?: string } }).__scroll?.behavior);

async function headingInScroller(page: Page) {
  return page.evaluate((id) => {
    const root = document.querySelector('[data-region="home"]')!.getBoundingClientRect();
    const h = document.querySelector(`#${id} h2`)!.getBoundingClientRect();
    return h.top >= root.top - 1 && h.bottom <= root.bottom + 1;
  }, SECTION_ID);
}

test('the "How it fits a robot" link scrolls the section into the home scroller, instantly under reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await spyScroll(page);
  await openHome(page);
  const link = page.getByRole('link', { name: 'How it fits a robot' });
  // The link sits under the two buttons, and the section starts below the first screen.
  const [buttons, linkBox] = await Promise.all([
    page.getByRole('link', { name: /Take the guided tour/ }).boundingBox(),
    link.boundingBox(),
  ]);
  expect(linkBox!.y).toBeGreaterThan(buttons!.y + buttons!.height - 1);
  await expect(page.getByRole('heading', { level: 2, name: 'How it fits a robot' })).not.toBeInViewport();
  expect(await scroller(page).evaluate((e) => e.scrollTop)).toBe(0);

  await link.click();
  await expect.poll(() => headingInScroller(page)).toBe(true);
  expect(await scroller(page).evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
  await expect(page.getByRole('heading', { level: 2, name: 'How it fits a robot' })).toBeInViewport();
  expect(await lastScroll(page)).toBe('auto'); // this project's tests run with reduced motion on
  await expect(page.getByRole('heading', { level: 2, name: 'How it fits a robot' })).toBeFocused();
  // The page itself did not scroll and did not navigate away.
  expect(await page.evaluate(() => document.scrollingElement!.scrollTop)).toBe(0);
  await expect(page).toHaveURL(/\/$/);
});

test.describe('with motion allowed', () => {
  test.use({ reducedMotion: 'no-preference' });
  test('the link scrolls smoothly and still ends with the section in view', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await spyScroll(page);
    await openHome(page);
    await page.getByRole('link', { name: 'How it fits a robot' }).click();
    await expect.poll(() => headingInScroller(page), { timeout: 15_000 }).toBe(true);
    expect(await lastScroll(page)).toBe('smooth');
  });
});

// The repo has no axe-core dependency, so this is the equivalent check on what the section renders: every piece of text reaches
// 4.5:1 against the surface it is drawn on (read from computed styles, in both themes), icons are hidden from assistive
// technology, lists hold only list items, and the controls are named.
for (const theme of ['light', 'dark'] as const) {
  test(`${theme}: text in the robot-fit section is readable, lists are well formed and icons are decorative`, async ({ page }) => {
    await openHome(page, theme);
    const result = await page.evaluate((id) => {
      type Rgba = [number, number, number, number];
      const parse = (c: string): Rgba | null => {
        const m = /rgba?\(([^)]+)\)/.exec(c);
        if (!m) return null;
        const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
      };
      const lin = (v: number) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      const lum = (c: Rgba) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
      const ratio = (a: Rgba, b: Rgba) => {
        const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
      };
      const surface = (el: Element): Rgba => {
        for (let n: Element | null = el; n; n = n.parentElement) {
          const c = parse(getComputedStyle(n).backgroundColor);
          if (c && c[3] === 1) return c;
        }
        return parse(getComputedStyle(document.body).backgroundColor) ?? [255, 255, 255, 1];
      };
      const root = document.getElementById(id)!;
      const low: string[] = [];
      let checked = 0;
      for (const el of root.querySelectorAll('*')) {
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim());
        if (!own) continue;
        const fg = parse(getComputedStyle(el).color);
        if (!fg) continue;
        checked++;
        const r = ratio(fg, surface(el));
        if (r < 4.5) low.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 30)}" ${r.toFixed(2)}`);
      }
      const svgs = [...root.querySelectorAll('svg')];
      return {
        checked,
        low,
        svgsHidden: svgs.every((s) => s.getAttribute('aria-hidden') === 'true'),
        svgCount: svgs.length,
        listChildren: [...root.querySelectorAll('ol, ul')].every((l) => [...l.children].every((c) => c.tagName === 'LI')),
        dlChildren: [...root.querySelectorAll('dl > div')].every((d) => [...d.children].map((c) => c.tagName).join() === 'DT,DD'),
        unnamedControls: [...document.querySelectorAll('a, button')].filter((e) => !(e.getAttribute('aria-label') || (e.textContent ?? '').trim())).length,
        labelledBy: document.getElementById(root.getAttribute('aria-labelledby')!)?.tagName,
      };
    }, SECTION_ID);
    expect(result.checked).toBeGreaterThan(30);
    expect(result.low).toEqual([]);
    expect(result.svgCount).toBeGreaterThan(8);
    expect(result.svgsHidden).toBe(true);
    expect(result.listChildren).toBe(true);
    expect(result.dlChildren).toBe(true);
    expect(result.unnamedControls).toBe(0);
    expect(result.labelledBy).toBe('H2');
  });
}
