import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startSurfaceApp } from '@decompozr/surface-app/server/host/host';
import { workspaceFixture } from './workspace-fixture.ts';
const f = await workspaceFixture();
mkdirSync(join(f.main, 'ui/routes/review/detail'), { recursive: true });
writeFileSync(join(f.main, 'ui/routes/review/detail/+page.svelte'), '<h1>Nested review</h1><p>A route-owned page.</p><div style="width:900px">Wide project-owned content</div>');
let app: Awaited<ReturnType<typeof startSurfaceApp>> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  app = await startSurfaceApp({ ...f, port: 0 });
  const { token } = JSON.parse(readFileSync(join(f.stateDir, 'connection.json'), 'utf8'));
  for (const root of [f.main, f.linked]) for (const operation of ['register', 'mount']) {
    const response: Response = await fetch(app.origin + '/api/v1/projects/operations', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ projectRoot: root, operation, ...(operation === 'mount' ? { artifactId: f.artifactId } : {}) }) });
    assert.ok((await response.json()).ok);
  }
  const home = await (await fetch(app.origin)).text();
  assert.ok(home.includes('app fixture') && home.includes('linked · fixture-linked'), 'Parent server load must render registered worktrees.');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const failedAssets: string[] = [];
  page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) failedAssets.push(`${response.status()} ${response.url()}`); });
  await page.goto(app.origin);
  const nav = page.getByRole('complementary', { name: 'Workspace navigation' });
  await expect(nav).toBeVisible();
  await nav.getByRole('link', { name: 'detail', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nested review' })).toBeVisible().catch(async error => {
    console.error('Navigation failure', { url: page.url(), errors, failedAssets, body: await page.locator('body').innerText() });
    throw error;
  });
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('review');
  await page.evaluate(() => document.fonts.ready);
  assert.ok(await page.evaluate(() => document.fonts.check('14px "DecompozR Inter"')), 'Mounted shell loads the package font.');
  const designSystemRoot = realpathSync(join(process.cwd(), 'apps/surface/node_modules/@decompozr/design-system'));
  assert.equal((await fetch(app.origin + '/@fs' + designSystemRoot + '/src/lib/Button.svelte')).status, 403, 'Only published design-system assets are exposed, not its source checkout.');
  await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'review', exact: true }).click();
  await expect(page.locator('[data-artifact-catalog]')).toBeVisible();
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await expect(nav).toBeHidden();
  await page.reload(); await expect(nav).toBeHidden();
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await expect(nav).toBeVisible();
  const output = process.env.SURFACE_NAVIGATION_OUTPUT ?? '.decompozr/surface/screenshots';
  mkdirSync(output, { recursive: true });
  await page.screenshot({ path: join(output, 'navigation-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(nav).toBeHidden();
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await expect(nav).toBeVisible();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await expect.poll(async () => {
    const bounds = await nav.boundingBox();
    return !!bounds && Math.abs(bounds.x) <= 1 && bounds.width > 200;
  }).toBe(true);
  await expect(nav.getByRole('link', { name: 'detail', exact: true })).toBeInViewport();
  await page.screenshot({ path: join(output, 'navigation-mobile-drawer.png'), fullPage: true });
  await page.keyboard.press('Escape'); await expect(nav).toBeHidden();
  await expect(page.getByRole('button', { name: 'Toggle navigation' })).toBeFocused();
  await page.goto(app.origin + '/workspace/app-fixture/main/ui/review/detail');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.ok(await page.getByRole('region', { name: 'Page content' }).evaluate(element => element.scrollWidth > element.clientWidth), 'Wide source content stays scrollable within the shell.');
  assert.deepEqual(errors, []);
  assert.deepEqual(failedAssets, []);
  console.log('Navigation fixture passed: parent SSR, worktree separation, nested page/folder index, breadcrumbs, persistent desktop collapse, mobile drawer and Escape.');
} finally { await browser?.close(); await app?.stop(); rmSync(f.directory, { recursive: true, force: true }); }
