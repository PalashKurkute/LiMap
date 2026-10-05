import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// "Analyze your own scan". The backend is not part of the Playwright run, so /api/health and /api/analyze_scan are answered
// with page.route. The success body is a REAL committed snapshot (scene_b_potholes) with only the fields an upload changes
// swapped (meta.scene_id, meta.kind, meta.note) plus timing_ms, never a hand-typed one.

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BASE = JSON.parse(fs.readFileSync(path.join(DIR, '..', 'public', 'data', 'scenes', 'scene_b_potholes.json'), 'utf8'));

const MIB = 1024 * 1024;
const MAX_BYTES = 4 * MIB; // what the mocked /api/health publishes as max_scan_bytes
const TIMING_MS = 87.6;
const NOTE = 'Labels come from a geometric heuristic because no trained model is loaded.';
const BUTTON = 'Analyze your own scan';

const scanBody = (over: { label_source?: string; timing_ms?: number } = {}) => ({
  ...BASE,
  meta: { ...BASE.meta, scene_id: 'upload', kind: 'upload', note: NOTE, ...(over.label_source ? { label_source: over.label_source } : {}) },
  timing_ms: over.timing_ms ?? TIMING_MS,
});

/** A tiny but well-formed scan: whole points of x, y, z and intensity (4 floats each). */
const smallScan = (seed = 1) => Buffer.from(new Float32Array([seed, 2, 3, 0.5, 4, 5, 6, 0.25, 7, 8, 9, 0.75, 1, 1, 1, 1]).buffer);

interface Post {
  method: string;
  name: string | null;
  contentType: string | undefined;
  body: Buffer | null;
}

type Reply =
  | { kind: 'ok'; over?: Parameters<typeof scanBody>[0]; gate?: Promise<void> }
  | { kind: 'error'; status: number; code: string; message: string }
  | { kind: 'text'; status: number }
  | { kind: 'abort' };

interface Api {
  posts: Post[];
  /** Replies for the next analyses, in order; once empty, every analysis succeeds. */
  replies: Reply[];
}

/** Answers /api/health (online or not; `maxBytes: null` mimics an older server without the key) and /api/analyze_scan. */
async function mockApi(page: Page, opts: { online?: boolean; maxBytes?: number | null } = {}): Promise<Api> {
  const { online = true, maxBytes = MAX_BYTES } = opts;
  const api: Api = { posts: [], replies: [] };
  await page.route('**/api/health', (route) =>
    online
      ? route.fulfill({ json: { status: 'ONLINE', ...(maxBytes == null ? {} : { max_scan_bytes: maxBytes }) } })
      : route.abort('connectionrefused'),
  );
  await page.route('**/api/analyze_scan**', async (route: Route) => {
    const req = route.request();
    api.posts.push({
      method: req.method(),
      name: new URL(req.url()).searchParams.get('name'),
      contentType: req.headers()['content-type'],
      body: req.postDataBuffer(),
    });
    const reply: Reply = api.replies.shift() ?? { kind: 'ok' };
    if (reply.kind === 'abort') return route.abort('failed');
    if (reply.kind === 'text') return route.fulfill({ status: reply.status, contentType: 'text/plain', body: 'Internal Server Error' });
    if (reply.kind === 'error') {
      return route.fulfill({ status: reply.status, contentType: 'application/json', body: JSON.stringify({ detail: { code: reply.code, message: reply.message } }) });
    }
    await reply.gate;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(scanBody(reply.over)) });
  });
  return api;
}

/** Same rules as smoke.spec: any page error or console error fails. Resource errors from /api/ are the mocked failures. */
function watch(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const url = m.location().url ?? '';
    if (/\/api\//.test(url)) return;
    problems.push(`console.error: ${m.text()} (${url})`);
  });
  page.on('requestfailed', (r) => {
    if (/\/api\//.test(r.url())) return;
    problems.push(`requestfailed: ${r.url()}`);
  });
  return problems;
}

async function boot(page: Page, opts: { online?: boolean; maxBytes?: number | null; theme?: 'light' | 'dark' } = {}) {
  const { theme = 'light', ...apiOpts } = opts;
  const problems = watch(page);
  const api = await mockApi(page, apiOpts);
  await page.addInitScript((t) => {
    localStorage.setItem('limap.welcomeSeen', '1');
    localStorage.setItem('limap.theme', t);
  }, theme);
  await page.goto('/dashboard/');
  await page.waitForSelector('html[data-ready~="scene-data"]', { timeout: 60_000 });
  return { api, problems };
}

const analyzeButton = (page: Page) => page.getByRole('button', { name: BUTTON, exact: true });
const scenes = (page: Page) => page.getByRole('group', { name: 'Scenes' });
const yourScan = (page: Page) => scenes(page).getByRole('button', { name: /^Your scan/ });
const status = (page: Page) => page.locator('[data-region="upload-status"]');

/** Open the file dialog through the button (so the wiring is tested) and pick an in-memory file. */
async function choose(page: Page, name: string, buffer: Buffer) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), analyzeButton(page).click()]);
  await chooser.setFiles({ name, mimeType: 'application/octet-stream', buffer });
}

async function openYourScan(page: Page, name = 'my scan #1.bin') {
  await choose(page, name, smallScan());
  await expect(yourScan(page)).toHaveAttribute('aria-pressed', 'true', { timeout: 60_000 });
  await page.waitForSelector('html[data-ready~="viewport-built"]', { timeout: 60_000 });
}

const count = (n: number) => n.toLocaleString('en-US');

test('offline: the button is really disabled, says it needs the API, and the "?" still works', async ({ page }) => {
  const { api, problems } = await boot(page, { online: false });
  const button = analyzeButton(page);
  await expect(button).toBeVisible();
  await expect(button).toBeDisabled();
  await expect(page.getByText('Needs the local API running')).toBeVisible();
  await expect(button).toHaveAccessibleDescription('Needs the local API running');
  // The "?" sits outside anything disabled.
  const help = page.locator('button[data-help="upload"]');
  await expect(help).toBeVisible();
  await expect(help).toBeEnabled();
  await help.hover();
  await expect(page.locator('[data-region="help-tooltip"][data-help-for="upload"]')).toBeVisible();
  // The file input is hidden and out of the tab order, so nothing can be typed into it.
  await expect(page.locator('input[type="file"]')).toBeHidden();
  expect(api.posts).toEqual([]);
  expect(problems).toEqual([]);
});

test('online: the button is enabled with the API answering, and an older server without max_scan_bytes still works', async ({ page }) => {
  const { api, problems } = await boot(page, { maxBytes: null });
  await expect(analyzeButton(page)).toBeEnabled();
  await expect(page.getByText('Needs the local API running')).toBeHidden();
  await openYourScan(page, 'old_server.bin');
  expect(api.posts).toHaveLength(1);
  expect(problems).toEqual([]);
});

test('a chosen file is POSTed raw with its name and content type, and the result becomes "Your scan"', async ({ page }) => {
  const { api, problems } = await boot(page);
  // Start in the concept view: an upload has none, so it must land in pipeline output.
  await page.getByRole('button', { name: 'Concept view' }).click();

  let release!: () => void;
  api.replies.push({ kind: 'ok', gate: new Promise<void>((r) => (release = r)) });
  const name = 'my scan #1.bin';
  const file = smallScan();
  await choose(page, name, file);

  // While it runs: a polite status, and the button cannot be pressed again.
  await expect(status(page)).toHaveText('Analyzing...');
  await expect(status(page)).toHaveAttribute('aria-live', 'polite');
  await expect(analyzeButton(page)).toBeDisabled();
  release();

  await expect(yourScan(page)).toHaveAttribute('aria-pressed', 'true', { timeout: 60_000 });
  await page.waitForSelector('html[data-ready~="viewport-built"]', { timeout: 60_000 });

  // What went over the wire.
  expect(api.posts).toHaveLength(1);
  expect(api.posts[0].method).toBe('POST');
  expect(api.posts[0].name).toBe(name); // url-encoded on the way, decoded here
  expect(api.posts[0].contentType).toBe('application/octet-stream');
  expect(Buffer.compare(api.posts[0].body ?? Buffer.alloc(0), file)).toBe(0);

  // What the screen says, all of it read from the response.
  await expect(page.locator('[data-region="provenance"]')).toHaveText(`Your scan: pipeline output, labels: ${BASE.meta.label_source}`);
  const card = page.locator('[data-region="scene-card"]');
  await expect(card).toContainText('Your scan');
  await expect(card.locator('[data-region="upload-file"]')).toHaveText(name);
  await expect(card.locator('[data-metric="upload-time"]')).toHaveText(`${TIMING_MS.toFixed(1)} ms`);
  await expect(card.locator('[data-metric="upload-cells"]')).toHaveText(count(BASE.telemetry.telemetry.active_cells));
  await expect(card.locator('[data-metric="upload-points"]')).toHaveText(count(BASE.meta.points_raw));
  await expect(card).toContainText('measured on the machine running the API');
  await expect(card).toContainText(NOTE);
  await expect(page.locator('[data-region="header"]')).toContainText('Your upload');
  await expect(page.locator('[data-region="statusbar"]')).toContainText(`LABELS: ${BASE.meta.label_source}`);
  await expect(status(page)).toHaveText('Your scan is ready.');

  // No concept view for an upload.
  await expect(page.getByRole('group', { name: 'What the 3D view shows' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Concept view' })).toHaveCount(0);
  await expect(analyzeButton(page)).toBeEnabled();
  expect(problems).toEqual([]);
});

test('the stamp reads "Your scan: pipeline output, labels: heuristic" for a heuristic-labelled scan', async ({ page }) => {
  const { api, problems } = await boot(page);
  api.replies.push({ kind: 'ok', over: { label_source: 'heuristic' } });
  await openYourScan(page);
  await expect(page.locator('[data-region="provenance"]')).toHaveText('Your scan: pipeline output, labels: heuristic');
  await expect(page.locator('[data-region="statusbar"]')).toContainText('LABELS: heuristic');
  expect(problems).toEqual([]);
});

test('uploading again while "Your scan" is open replaces it', async ({ page }) => {
  const { api, problems } = await boot(page);
  await openYourScan(page);
  const time = page.locator('[data-region="scene-card"] [data-metric="upload-time"]');
  await expect(time).toHaveText(`${TIMING_MS.toFixed(1)} ms`);

  api.replies.push({ kind: 'ok', over: { timing_ms: 412 } });
  await choose(page, 'second.bin', smallScan(2));
  await expect(time).toHaveText('412 ms');
  await expect(page.locator('[data-region="scene-card"] [data-region="upload-file"]')).toHaveText('second.bin');
  await expect(yourScan(page)).toHaveCount(1);
  expect(api.posts).toHaveLength(2);
  expect(problems).toEqual([]);
});

test('a failed analysis shows the server message (or a generic one) and keeps the current scene', async ({ page }) => {
  const { api, problems } = await boot(page);
  const bridge = scenes(page).getByRole('button', { name: /^Bridge underpass/ });
  await expect(bridge).toHaveAttribute('aria-pressed', 'true');

  const cases: { reply: Reply; shown: string }[] = [
    { reply: { kind: 'error', status: 400, code: 'BAD_SCAN_SIZE', message: 'The file is not a whole number of points, so it is not a scan.' }, shown: 'The file is not a whole number of points, so it is not a scan.' },
    { reply: { kind: 'error', status: 413, code: 'SCAN_TOO_LARGE', message: 'That scan is larger than this server accepts.' }, shown: 'That scan is larger than this server accepts.' },
    { reply: { kind: 'text', status: 500 }, shown: 'Could not analyze this file.' },
    { reply: { kind: 'abort' }, shown: 'Could not analyze this file.' },
  ];
  for (const [i, c] of cases.entries()) {
    api.replies.push(c.reply);
    await choose(page, `bad_${i}.bin`, smallScan());
    await expect(status(page)).toContainText(c.shown);
    await expect(status(page)).toHaveAttribute('aria-live', 'polite');
    await expect(bridge).toHaveAttribute('aria-pressed', 'true');
    await expect(yourScan(page)).toHaveCount(0);
    await expect(analyzeButton(page)).toBeEnabled();
  }
  expect(api.posts).toHaveLength(cases.length);

  // The message can be dismissed.
  await page.getByRole('button', { name: 'Dismiss this message' }).click();
  await expect(page.getByRole('button', { name: 'Dismiss this message' })).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('a file above max_scan_bytes is rejected in words, with no request', async ({ page }) => {
  const { api, problems } = await boot(page);
  const big = Buffer.alloc(MAX_BYTES + 2 * MIB, 0);
  await choose(page, 'huge.bin', big);
  const limit = `${MAX_BYTES / MIB} MB`;
  const size = `${(MAX_BYTES + 2 * MIB) / MIB} MB`;
  await expect(status(page)).toContainText(`This file is ${size}, which is over the limit of ${limit} for one scan.`);
  await expect(scenes(page).getByRole('button', { name: /^Bridge underpass/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(yourScan(page)).toHaveCount(0);
  await expect(analyzeButton(page)).toBeEnabled();
  expect(api.posts).toEqual([]);
  expect(problems).toEqual([]);
});

test('for an upload, presets, comparison, the underpass and the fly-through are unavailable (and stay off)', async ({ page }) => {
  test.setTimeout(240_000);
  const { problems } = await boot(page);
  // Before the upload, turn the comparison on: it must not carry over into a scene that cannot show it.
  await expect(page.getByRole('button', { name: 'Fly under the bridge', exact: true })).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Map Inspector', exact: true }).click();
  await page.waitForSelector('html[data-ready~="inspector-drawn"]', { timeout: 60_000 });
  const compare = page.getByRole('button', { name: /^Compare with uniform/ });
  await compare.click();
  await expect(compare).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Back to 3D' }).click();
  await page.waitForSelector('html[data-ready~="viewport-built"]', { timeout: 60_000 });

  await openYourScan(page);
  await expect(page.getByRole('button', { name: 'Fly under the bridge', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-tour="fly"]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Map Inspector', exact: true }).click();
  await page.waitForSelector('html[data-ready~="inspector-drawn"]', { timeout: 60_000 });
  const presets = page.getByRole('radiogroup', { name: 'Foveation preset' });
  await expect(presets.getByRole('radio', { name: 'Stationary' })).toBeEnabled();
  await expect(presets.getByRole('radio', { name: 'Stationary' })).toHaveAttribute('aria-checked', 'true');
  for (const label of ['City', 'Highway', 'Turn left', 'Turn right']) {
    await expect(presets.getByRole('radio', { name: label, exact: true }), `${label} preset`).toBeDisabled();
  }
  await expect(compare).toBeDisabled();
  await expect(compare).toHaveAttribute('aria-pressed', 'false');
  await expect(compare).toHaveAttribute('title', /precomputed/);
  await expect(page.getByRole('button', { name: /^Underpass/ })).toBeDisabled();
  await page.keyboard.press('b'); // the comparison shortcut does nothing here
  await expect(compare).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-region="compare-card"]')).toHaveCount(0);

  // The inspector says what this is.
  await expect(page.getByText('YOUR UPLOAD', { exact: true })).toBeVisible();
  await expect(page.getByText(`YOUR SCAN (labels: ${BASE.meta.label_source})`, { exact: true })).toBeVisible();
  await expect(page.getByText('PRECOMPUTED SNAPSHOT', { exact: true })).toBeHidden();
  await expect(page.locator('[data-region="inspector-hint"]')).not.toContainText('SemanticKITTI');
  expect(problems).toEqual([]);
});

test('the scan lives in memory only: nothing is stored, and a reload drops it', async ({ page }) => {
  const { problems } = await boot(page);
  await openYourScan(page);

  const stored = () =>
    page.evaluate(async () => ({
      local: Object.fromEntries(Object.keys(localStorage).map((k) => [k, (localStorage.getItem(k) ?? '').length])),
      session: sessionStorage.length,
      idb: ((await indexedDB.databases?.()) ?? []).length,
    }));
  const before = await stored();
  expect(Object.keys(before.local).sort()).toEqual(['limap.theme', 'limap.welcomeSeen']);
  expect(before.session).toBe(0);
  expect(before.idb).toBe(0);

  await page.reload();
  await page.waitForSelector('html[data-ready~="scene-data"]', { timeout: 60_000 });
  await expect(yourScan(page)).toHaveCount(0);
  await expect(scenes(page).getByRole('button', { name: /^Bridge underpass/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(analyzeButton(page)).toBeEnabled();
  expect(problems).toEqual([]);
});

test('keys 1 to 5 still switch scenes with a scan loaded, and "Your scan" has no number', async ({ page }) => {
  const { problems } = await boot(page);
  await openYourScan(page);
  await expect(yourScan(page)).not.toHaveAttribute('aria-label', /\(key /);

  const expected: Record<string, RegExp> = {
    '2': /^Potholes and craters/,
    '3': /^Moving traffic/,
    '4': /^Thin poles/,
    '5': /^Real city scan/,
    '1': /^Bridge underpass/,
  };
  for (const [key, label] of Object.entries(expected)) {
    await page.locator('body').click({ position: { x: 700, y: 500 } });
    await page.keyboard.press(key);
    await expect(scenes(page).getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true');
    await expect(yourScan(page)).toHaveAttribute('aria-pressed', 'false');
    await page.waitForSelector('html[data-ready~="scene-data"]', { timeout: 60_000 });
  }
  // The scan is still there to go back to.
  await yourScan(page).click();
  await expect(yourScan(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-region="provenance"]')).toContainText('Your scan: pipeline output');

  // With the button focused, the scene keys still work and nothing is typed anywhere.
  await analyzeButton(page).focus();
  await page.keyboard.press('2');
  await expect(scenes(page).getByRole('button', { name: /^Potholes and craters/ })).toHaveAttribute('aria-pressed', 'true');
  expect(problems).toEqual([]);
});

test('the other panels cope with an upload: Controls tabs, the section slicer, Evidence', async ({ page }) => {
  test.setTimeout(240_000);
  const { problems } = await boot(page);
  await openYourScan(page);
  await page.locator('body').click({ position: { x: 700, y: 500 } });
  await page.keyboard.press('t');
  await expect(page.locator('[data-region="drawer"]')).toHaveClass(/open/);
  await page.getByRole('tab', { name: 'Vehicle' }).click();
  await expect(page.locator('[data-region="drawer"]')).toContainText(count(BASE.telemetry.telemetry.active_cells));
  await page.getByRole('tab', { name: 'Section' }).click();
  await expect(page.locator('[data-region="drawer"]').getByText('No grid cells are available')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Stress' }).click();
  await page.getByRole('tab', { name: 'Layers' }).click();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Evidence', exact: true }).click();
  await page.waitForSelector('html[data-ready~="evidence-loaded"]', { timeout: 60_000 });
  await page.getByRole('button', { name: '3D Explore', exact: true }).click();
  await expect(yourScan(page)).toHaveAttribute('aria-pressed', 'true');
  expect(problems).toEqual([]);
});

// ---- axe-core (not a dependency of this project: the test uses it when it is installed, or at AXE_CORE_JS) ----
const require = createRequire(import.meta.url);
function findAxe(): string | null {
  const fromEnv = process.env.AXE_CORE_JS;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  try {
    return require.resolve('axe-core/axe.min.js');
  } catch {
    return null;
  }
}
const AXE = findAxe();

async function axeViolations(page: Page): Promise<string[]> {
  await page.addScriptTag({ path: AXE! });
  return page.evaluate(async () => {
    const result = await (window as unknown as { axe: { run: (ctx: Document) => Promise<{ violations: { id: string; impact: string; nodes: { target: unknown[] }[] }[] }> } }).axe.run(document);
    return result.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).slice(0, 4).join(' | ')}`);
  });
}

for (const theme of ['light', 'dark'] as const) {
  test(`${theme}: axe finds no violations with a scan loaded, while analyzing, and on an error message`, async ({ page }) => {
    test.skip(!AXE, 'axe-core is not installed here; set AXE_CORE_JS to the path of axe.min.js');
    test.setTimeout(240_000);
    const { api, problems } = await boot(page, { theme });
    await openYourScan(page);
    expect(await axeViolations(page), 'with a scan loaded').toEqual([]);

    let release!: () => void;
    api.replies.push({ kind: 'ok', gate: new Promise<void>((r) => (release = r)) });
    await choose(page, 'again.bin', smallScan());
    await expect(status(page)).toHaveText('Analyzing...');
    expect(await axeViolations(page), 'while analyzing').toEqual([]);
    release();
    await expect(status(page)).toHaveText('Your scan is ready.');

    api.replies.push({ kind: 'error', status: 400, code: 'NO_VALID_POINTS', message: 'No usable points were found in this file.' });
    await choose(page, 'empty.bin', smallScan());
    await expect(status(page)).toContainText('No usable points were found in this file.');
    expect(await axeViolations(page), 'on an error message').toEqual([]);
    expect(problems).toEqual([]);
  });
}
