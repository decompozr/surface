import { expect, test } from 'bun:test';
import { chromium } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../src/server/index.ts';

test('real page submits selected data, disables repeats, and displays a separately published result', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'artifact-browser-'));
  let message = '';
  const app = startServer({ stateDir: dir, cliPath: '/cli', uiDir: join(process.cwd(), 'examples/svelte-feedback/dist'), port: 0,
    adapter: { inspect: async () => ({ status: 'idle' }), deliver: async (_binding, input) => { message = input; return { mode: 'start', turnId: 'test-turn' }; } },
  });
  app.service.store.update(state => state.bindings.push({ id: 'fixture', projectRoot: dir, socketPath: '/fixture', threadId: 'fixture' }));
  const request = app.service.create({ bindingId: 'fixture', title: 'Choose the next direction.' });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(`${app.origin}/?request=${request.id}#token=${request.token}`);
    await page.getByRole('radio', { name: 'Option B' }).check();
    await page.getByLabel('02 / Width').fill('180');
    await page.getByLabel('03 / Anything to add?').fill('Use this width.');
    await page.getByRole('button', { name: 'Send to agent' }).click();
    await page.getByRole('heading', { name: 'Accepted by the agent runtime.' }).waitFor();
    expect(app.service.get(request.id).response?.data).toEqual({ option: 'B', width: 180, comment: 'Use this width.' });
    expect(message).toContain('"requestId":"' + request.id + '"');
    expect(await page.getByRole('button', { name: 'Response submitted' }).isDisabled()).toBe(true);
    // Explicit test fixture publication; this is not a live agent proof.
    app.service.result(request.id, { message: 'Option B is ready at 180 px.', option: 'B', width: 180 });
    await page.getByRole('heading', { name: 'Option B is ready at 180 px.' }).waitFor();
    mkdirSync('.decompozr/artifact/screenshots', { recursive: true });
    await page.screenshot({ path: '.decompozr/artifact/screenshots/desktop-fixture.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: '.decompozr/artifact/screenshots/mobile-fixture.png', fullPage: true });
    expect(errors).toEqual([]);
  } finally { await browser.close(); await app.stop(); rmSync(dir, { recursive: true, force: true }); }
}, 20_000);
