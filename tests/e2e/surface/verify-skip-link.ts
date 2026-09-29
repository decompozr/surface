import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { chromium, expect } from '@playwright/test';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startSurfaceApp } from '@decompozr/surface-app/server/host/host';
import { workspaceFixture } from './workspace-fixture.ts';

// Disposable project and a rejecting adapter: never contact a real conversation.
const f = await workspaceFixture();
mkdirSync(join(f.main, 'ui/routes/review/detail'), { recursive: true });
writeFileSync(join(f.main, 'ui/routes/review/detail/+page.svelte'), '<h1>Skip link fixture</h1><button>Content action</button><div style="width:1800px">Wide fixture content</div>');
const screenshots = '.decompozr/surface/screenshots/ui-continuation';
mkdirSync(screenshots, { recursive: true });
const socketPath = join(f.directory, 'fixture.sock');
const socket = createServer(client => client.end());
let app: Awaited<ReturnType<typeof startSurfaceApp>> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {

  const api = async (path: string, body?: unknown) => {
    const response = await fetch(app!.origin + path, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    assert.ok(response.ok); return response.json();
  };

  await new Promise<void>(resolve => socket.listen(socketPath, resolve));
  app = await startSurfaceApp({ ...f, port: 0, adapter: {
    async inspect() { return { status: 'idle' }; },
    async deliver() { throw new Error('Fixture must never deliver'); },
  } });
  const { token } = JSON.parse(readFileSync(join(f.stateDir, 'connection.json'), 'utf8'));
  for (const operation of ['register', 'mount']) {
    const response: Response = await fetch(app.origin + '/api/v1/projects/operations', {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ projectRoot: f.main, operation, ...(operation === 'mount' ? { surfaceId: f.surfaceId } : {}) }),
    });
    assert.ok(response.ok); assert.ok((await response.json()).ok);
  }
  const mount = (await api('/api/mounts'))[0];
  const binding = await api('/api/bindings', { projectRoot: f.main, threadId: 'skip-fixture', socketPath });
  const request = await api('/api/requests', { bindingId: binding.id, namespace: mount.namespace, name: mount.name, component: 'routes/review/detail/+page.svelte', title: 'Skip fixture', schema: { type: 'object' } });
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [1440, 390, 320]) for (const [name, path] of [
    ['home', '/'], ['nested', '/workspace/app-fixture/main/ui/review/detail'],
  ]) {

    const activateSkip = async () => {
      await page.keyboard.press('Enter');
      await expect(region).toBeFocused();
      assert.equal(page.url(), url);
      assert.equal(await page.evaluate(() => (window as unknown as { skipDocument: string }).skipDocument), marker);
    };

    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    // Real disposable fixture capability; rejecting adapter prevents delivery.
    const response = await page.goto(app.origin + path + new URL(request.previewUrl).search + new URL(request.previewUrl).hash + '&retained=fixture');
    assert.ok(response?.ok(), 'Fixture route must render successfully');
    const skip = page.getByRole('link', { name: 'Skip to content', exact: true });
    const region = page.getByRole('region', { name: 'Page content', exact: true });
    const toggle = page.getByRole('button', { name: 'Toggle navigation' });
    const nav = page.getByRole('complementary', { name: 'Workspace navigation' });
    await expect(skip).toHaveCount(1);
    await expect(page.locator('#surface-page-content')).toHaveCount(1);
    // SSR already matches desktop expanded state; wait for hydrated recipient
    // initialization as well so initial client navigation cannot reset first-Tab focus.
    await expect(page.getByRole('button', { name: 'Refresh recipient', exact: true })).toBeEnabled();
    // Wait for the onMount media-query state before exercising keyboard input.
    await expect(toggle).toHaveAttribute('aria-expanded', String(width > 760));
    await page.keyboard.press('Tab');
    await expect(skip).toBeFocused();
    const box = await skip.boundingBox();
    assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width, 'Focused skip link is in the viewport');
    await page.screenshot({ path: join(screenshots, `${name}-${width}-skip.png`), fullPage: true });
    const url = page.url();
    const marker = await page.evaluate(() => { const value = crypto.randomUUID(); Object.assign(window, { skipDocument: value }); return value; });
    await activateSkip();
    await page.screenshot({ path: join(screenshots, `${name}-${width}-content.png`), fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Shell must not overflow');
    if (name === 'nested') {
      assert.ok(await region.evaluate(element => element.scrollWidth > element.clientWidth), 'Wide content remains contained');
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Content action' })).toBeFocused();
    }
    if (width <= 760) {
      // Return to the shell through keyboard traversal, then open the drawer.
      for (let attempts = 0; attempts < 20 && !await toggle.evaluate(element => element === document.activeElement); attempts++) {
        await page.keyboard.press('Shift+Tab');
      }
      await expect(toggle).toBeFocused();
      await page.keyboard.press('Enter'); await expect(nav).toBeVisible();
      for (let attempts = 0; attempts < 80 && !await skip.evaluate(element => element === document.activeElement); attempts++) await page.keyboard.press('Shift+Tab');
      await expect(skip).toBeFocused();
      await page.screenshot({ path: join(screenshots, `${name}-${width}-drawer-skip.png`), fullPage: true });
      await activateSkip();
      await expect(nav).toBeHidden();
      await expect(page.getByRole('button', { name: 'Close Workspace navigation' })).toHaveCount(0);
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    }
  }
  assert.deepEqual(errors, []);
  console.log('PASS: keyboard skip on home/nested routes at 1440/390/320px, visible focus, exact URL/document retention, drawer dismissal, content tab continuation and contained overflow. Disposable fixture capability only; no assistive-technology or physical-device acceptance.');
} finally {
  try { await browser?.close(); }
  finally { try { await app?.stop(); } finally { socket.close(); rmSync(f.directory, { recursive: true, force: true }); } }
}
