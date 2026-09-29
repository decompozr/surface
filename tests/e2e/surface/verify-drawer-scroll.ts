import assert from 'node:assert/strict';
import { chromium, webkit, expect } from '@playwright/test';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startSurfaceApp } from '@decompozr/surface-app/server/host/host';
import { workspaceFixture } from './workspace-fixture.ts';

const fixture = await workspaceFixture();
const evidence = '.decompozr/surface/screenshots/drawer-scroll';
mkdirSync(evidence, { recursive: true });
for (let index = 0; index < 35; index++) {
  const route = join(fixture.main, `ui/routes/long-menu-${String(index).padStart(2, '0')}`);
  mkdirSync(route, { recursive: true });
  writeFileSync(join(route, '+page.svelte'), '<h1>Scroll fixture</h1><div style="height:2600px">Tall project content</div>');
}
let app: Awaited<ReturnType<typeof startSurfaceApp>> | undefined;
try {
  app = await startSurfaceApp({ ...fixture, port: 0 });
  const { token } = JSON.parse(readFileSync(join(fixture.stateDir, 'connection.json'), 'utf8'));
  for (const operation of ['register', 'mount']) {
    const response: Response = await fetch(app.origin + '/api/v1/projects/operations', {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ projectRoot: fixture.main, operation, ...(operation === 'mount' ? { surfaceId: fixture.surfaceId } : {}) }),
    });
    assert.ok(response.ok); assert.ok((await response.json()).ok);
  }
  for (const engine of ['chromium', 'webkit'] as const) {
    const browser = await (engine === 'chromium' ? chromium.launch({ channel: 'chrome' }) : webkit.launch());
    try {
      // Playwright cannot send wheel input in mobile WebKit. Use a narrow
      // desktop WebKit viewport for real wheel/default-scroll behavior; this
      // is not physical iPhone touch acceptance.
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: engine === 'chromium', hasTouch: true });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(app.origin + '/workspace/app-fixture/main/ui/long-menu-00');
      const toggle = page.getByRole('button', { name: 'Toggle navigation', exact: true });
      const nav = page.getByRole('complementary', { name: 'Workspace navigation' });
      const main = page.getByRole('main');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      // Verify restoration of preexisting inline values as well as a nonzero offset.
      await page.evaluate(() => { document.body.style.setProperty('overflow', 'visible'); document.documentElement.style.scrollBehavior = 'smooth'; document.querySelector('main')!.scrollTop = 350; });
      await expect.poll(() => main.evaluate(element => element.scrollTop)).toBe(350);
      const originalTop = await page.locator('h1').evaluate(element => element.getBoundingClientRect().top);
      // Open without forcing another scroll position; AppShell owns main scrolling.
      await toggle.evaluate(element => (element as HTMLButtonElement).click());
      await expect(nav).toBeVisible();
      await expect.poll(() => nav.evaluate(element => Math.round(element.getBoundingClientRect().x))).toBe(0);
      await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).position)).toBe('fixed');
      const assertFrozen = async () => {
        expect(await page.locator('h1').evaluate(element => element.getBoundingClientRect().top)).toBe(originalTop);
        expect(await page.evaluate(() => getComputedStyle(document.body).top)).toBe('0px');
        expect(await main.evaluate(element => element.scrollTop)).toBe(350);
        expect(await main.evaluate(element => getComputedStyle(element).overflowY)).toBe('hidden');
      };
      await page.mouse.move(365, 450);
      await page.mouse.wheel(0, 650);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await assertFrozen();
      if (engine === 'chromium') {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 365, y: 650 }] });
        for (const y of [590, 520, 450, 380, 300]) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 365, y }] });
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await assertFrozen();
      }
      await page.mouse.move(130, 400);
      await page.mouse.wheel(0, 450);
      await expect.poll(() => nav.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
      await assertFrozen();
      await nav.evaluate(element => { element.scrollTop = element.scrollHeight; });
      await page.mouse.wheel(0, 500);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await assertFrozen();
      await page.screenshot({ path: join(evidence, `${engine}-open.png`) });
      await page.keyboard.press('Escape');
      await expect(nav).toBeHidden();
      await expect.poll(() => main.evaluate(element => element.scrollTop)).toBe(350);
      expect(await page.evaluate(() => [document.body.style.position, document.body.style.overflow, document.documentElement.style.scrollBehavior])).toEqual(['', 'visible', 'smooth']);
      await toggle.evaluate(element => (element as HTMLButtonElement).click());
      await expect(nav).toBeVisible();
      await page.getByRole('button', { name: 'Close Workspace navigation', exact: true }).click({ position: { x: 360, y: 200 } });
      await expect(nav).toBeHidden();
      await expect.poll(() => main.evaluate(element => element.scrollTop)).toBe(350);
      await toggle.evaluate(element => (element as HTMLButtonElement).click());
      await expect(nav).toBeVisible();
      await page.setViewportSize({ width: 1440, height: 1000 });
      await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe('');
      await page.mouse.move(1100, 700); await page.mouse.wheel(0, 400);
      await expect.poll(() => main.evaluate(element => element.scrollTop)).toBeGreaterThan(350);
      assert.deepEqual(errors, []);
      console.log(`PASS ${engine}: background frozen, long navigation scrolls without chaining, Escape/backdrop restore offset/styles, desktop resize releases lock.`);
    } finally { await browser.close(); }
  }
} finally { await app?.stop(); rmSync(fixture.directory, { recursive: true, force: true }); }
