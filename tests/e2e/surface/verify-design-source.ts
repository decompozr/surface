import { chromium, webkit, expect } from '@playwright/test';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { startSurfaceApp as StartSurfaceApp } from '@decompozr/surface-app/server/host/host';
import { workspaceFixture } from './workspace-fixture.ts';

const directory = process.env.COMMENTS_E2E_APP_DIR;
if (!directory) throw new Error('Specify immutable COMMENTS_E2E_APP_DIR.');
const { startSurfaceApp }: { startSurfaceApp: typeof StartSurfaceApp } = await import(pathToFileURL(join(resolve(directory), 'src/lib/server/host/host.ts')).href);
const fixture = await workspaceFixture();
const source = join(fixture.main, 'ui');
rmSync(source, { recursive: true });
cpSync(resolve('design'), source, { recursive: true, filter: path => !path.split('/').includes('node_modules') });
const output = resolve(process.env.SURFACE_EDITOR_OUTPUT ?? '.decompozr/surface/design-source');
mkdirSync(output, { recursive: true });
const app = await startSurfaceApp({ ...fixture, port: 0 });
try {
  expect((await app.projectOperation({ operation: 'register', projectRoot: fixture.main })).ok).toBe(true);
  const mount = await app.projectOperation({ operation: 'mount', projectRoot: fixture.main, surfaceId: fixture.surfaceId });
  expect(mount.ok, JSON.stringify(mount)).toBe(true);
  const data: unknown = mount.data;
  if (!data || typeof data !== 'object' || !('previewUrl' in data) || typeof data.previewUrl !== 'string') throw new Error('Mount did not return a preview URL');
  const base = data.previewUrl.replace(/\/$/, '') + '/';
  const regression = Bun.spawn([process.execPath, 'tests/e2e/surface/verify-navigation-width.ts'], {
    env: { ...process.env, SURFACE_NAVIGATION_URL: base, SURFACE_NAVIGATION_OUTPUT: join(output, 'animation') }, stdout: 'inherit', stderr: 'inherit',
  });
  expect(await regression.exited).toBe(0);
  for (const [name, engine, width] of [['desktop', chromium, 1280], ['phone', webkit, 390]] as const) {
    const browser = await engine.launch();
    try {
      const page = await browser.newPage({ viewport: { width, height: 800 } });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const route of ['', 'controls', 'navigation', 'tabs', 'workbench']) {
        const response = await page.goto(base + route, { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);
        await expect(page.locator('#surface-page-content h1').first()).toBeVisible();
        await page.screenshot({ path: join(output, `${name}-${route || 'home'}.png`), fullPage: true });
      }
      expect(errors).toEqual([]);
      console.log(`${name}: Design source installed from frozen lock; all five routes rendered without page errors`);
    } finally { await browser.close(); }
  }
} finally { await app.stop(); rmSync(fixture.directory, { recursive: true, force: true }); }
