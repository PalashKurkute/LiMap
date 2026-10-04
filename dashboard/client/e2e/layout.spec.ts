import { test, expect, type Page } from '@playwright/test';

// Laptop-at-the-table gate: at common laptop / projector sizes, floating UI must not overlap,
// must stay inside the viewport, and text must not overflow its container.

const SIZES = [
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
];

interface Box {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

async function boxes(page: Page, selectors: Record<string, string>): Promise<Box[]> {
  const out: Box[] = [];
  for (const [name, sel] of Object.entries(selectors)) {
    const loc = page.locator(sel).first();
    if (!(await loc.isVisible().catch(() => false))) continue;
    const b = await loc.boundingBox();
    if (b) out.push({ name, x: b.x, y: b.y, w: b.width, h: b.height });
  }
  return out;
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;
}

async function overflowing(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const bad: string[] = [];
    document.body.querySelectorAll('header *, footer *, [data-region="scene-card"] *, [data-region="dialog"] *').forEach((el) => {
      const h = el as HTMLElement;
      if (h.closest('svg')) return;
      const style = getComputedStyle(h);
      if (style.overflowX === 'auto' || style.overflowX === 'scroll' || style.textOverflow === 'ellipsis') return;
      if (h.scrollWidth > h.clientWidth + 2 && h.clientWidth > 0 && style.display !== 'inline') {
        bad.push(`${h.tagName.toLowerCase()}.${String(h.className).split(' ').slice(0, 3).join('.')} (${h.scrollWidth}>${h.clientWidth}): "${(h.textContent ?? '').trim().slice(0, 30)}"`);
      }
    });
    return bad;
  });
}

for (const size of SIZES) {
  test.describe(`${size.width}x${size.height}`, () => {
    test.use({ viewport: size });

    for (const drawer of [false, true]) {
      test(`3D view overlays do not collide${drawer ? ' (drawer open)' : ''}`, async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('limap.welcomeSeen', '1'));
        await page.goto('/');
        await page.waitForTimeout(600);
        if (drawer) {
          await page.keyboard.press('t');
          await page.waitForTimeout(450);
        }
        const found = await boxes(page, {
          header: '[data-region="header"]',
          scenes: '[role="group"][aria-label="Scenes"]',
          mode: '[role="group"][aria-label="What the 3D view shows"]',
          provenance: '[data-region="provenance"]',
          card: '[data-region="scene-card"]',
          replay: '[data-region="replay"]',
          legend: '[data-region="viewport-legend"]',
          statusbar: '[data-region="statusbar"]',
        });
        const names = found.map((b) => b.name);
        for (const n of ['header', 'scenes', 'mode', 'provenance', 'card', 'replay', 'legend', 'statusbar']) expect(names).toContain(n);

        for (let i = 0; i < found.length; i++) {
          for (let j = i + 1; j < found.length; j++) {
            expect(overlaps(found[i], found[j]), `${found[i].name} overlaps ${found[j].name}`).toBe(false);
          }
        }
        // All inside the viewport
        for (const b of found) {
          expect(b.x, `${b.name} left edge`).toBeGreaterThanOrEqual(-1);
          expect(b.y, `${b.name} top edge`).toBeGreaterThanOrEqual(-1);
          expect(b.x + b.w, `${b.name} right edge`).toBeLessThanOrEqual(size.width + 1);
          expect(b.y + b.h, `${b.name} bottom edge`).toBeLessThanOrEqual(size.height + 1);
        }
        expect(await overflowing(page)).toEqual([]);

        if (drawer) {
          // The drawer squeezes the viewport instead of pushing the layout sideways.
          const geo = await page.evaluate(() => {
            const d = document.querySelector('[data-region="drawer"]') as HTMLElement;
            const c = document.querySelector('[data-region="viewport-canvas"] canvas') as HTMLElement;
            return {
              drawerRight: d.getBoundingClientRect().right,
              drawerWidth: d.getBoundingClientRect().width,
              canvasWidth: c.getBoundingClientRect().width,
              scrollLeft: d.parentElement!.scrollLeft,
              docOverflow: document.documentElement.scrollWidth - window.innerWidth,
            };
          });
          expect(geo.scrollLeft, 'workspace must not be scrolled sideways').toBe(0);
          expect(geo.docOverflow).toBeLessThanOrEqual(0);
          expect(geo.drawerRight).toBeLessThanOrEqual(size.width + 1);
          expect(geo.canvasWidth, '3D canvas shrinks to make room for the drawer').toBeLessThanOrEqual(size.width - geo.drawerWidth + 2);
        }
      });
    }

    test('map inspector has no horizontal overflow and keeps its controls on screen', async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('limap.welcomeSeen', '1'));
      await page.goto('/');
      await page.getByRole('button', { name: 'Map Inspector', exact: true }).click();
      await page.waitForTimeout(400);
      const docOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(docOverflow).toBeLessThanOrEqual(0);
      for (const sel of ['button:has-text("Back to 3D")', 'button:has-text("Overhang")', 'button[aria-label="Reset view"]']) {
        const b = await page.locator(sel).first().boundingBox();
        expect(b, sel).not.toBeNull();
        expect(b!.x + b!.width).toBeLessThanOrEqual(size.width + 1);
        expect(b!.y + b!.height).toBeLessThanOrEqual(size.height + 1);
      }
    });

    test('first-visit tour callout fits the viewport and covers none of the 3D overlays', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(600);
      const found = await boxes(page, {
        nudge: '[data-region="tour-nudge"]',
        header: '[data-region="header"]',
        scenes: '[role="group"][aria-label="Scenes"]',
        mode: '[role="group"][aria-label="What the 3D view shows"]',
        card: '[data-region="scene-card"]',
        replay: '[data-region="replay"]',
        legend: '[data-region="viewport-legend"]',
      });
      const by = (n: string) => found.find((b) => b.name === n)!;
      const nudge = by('nudge');
      expect(nudge).toBeTruthy();
      expect(nudge.x + nudge.w).toBeLessThanOrEqual(size.width + 1);
      expect(nudge.y + nudge.h).toBeLessThanOrEqual(size.height + 1);
      for (const other of ['header', 'scenes', 'mode', 'card', 'replay', 'legend']) {
        expect(overlaps(nudge, by(other)), `callout overlaps ${other}`).toBe(false);
      }
      expect(await overflowing(page)).toEqual([]);
    });
  });
}
