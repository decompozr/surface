import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startSurfaceApp } from '../server/host';
import { workspaceFixture } from './workspace-fixture';
const f = await workspaceFixture();
mkdirSync(join(f.main, 'ui/routes/review/detail'), { recursive: true });
writeFileSync(join(f.main, 'ui/routes/review/detail/+page.svelte'), '<h1>Nested review</h1><p>A route-owned page.</p>');
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
  await page.goto(app.origin);
  const nav = page.getByRole('complementary', { name: 'Workspace navigation' });
  await expect(nav).toBeVisible();
  await nav.getByRole('link', { name: 'detail', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nested review' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('review');
  await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'review', exact: true }).click();
  await expect(page.locator('[data-artifact-catalog]')).toBeVisible();
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await expect(nav).toBeHidden();
  await page.reload(); await expect(nav).toBeHidden();
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await expect(nav).toBeVisible();
  mkdirSync('.decompozr/surface/screenshots', { recursive: true });
  await page.screenshot({ path: '.decompozr/surface/screenshots/navigation-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(nav).toBeHidden();
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await expect(nav).toBeVisible();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: '.decompozr/surface/screenshots/navigation-mobile-drawer.png', fullPage: true });
  await page.keyboard.press('Escape'); await expect(nav).toBeHidden();
  await expect(page.getByRole('button', { name: 'Toggle navigation' })).toBeFocused();
  assert.deepEqual(errors, []);
  console.log('Navigation fixture passed: parent SSR, worktree separation, nested page/folder index, breadcrumbs, persistent desktop collapse, mobile drawer and Escape.');
} finally { await browser?.close(); await app?.stop(); rmSync(f.directory, { recursive: true, force: true }); }
