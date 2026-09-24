import { chromium, expect } from '@playwright/test';
import { cpSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { startSurfaceApp } from '@decompozr/surface-app/server/host/host';

// Edit only a disposable copy; never alter the checked-in fixture or shared installation.
const temporary = realpathSync(mkdtempSync(join(tmpdir(), 'surface-app-fixture-')));
const stateDir = join(temporary, 'state');
const source = join(temporary, 'counter');
cpSync(join(import.meta.dir, '../../../examples'), source, {
  recursive: true, filter: path => !path.split('/').includes('node_modules'),
});
let app: Awaited<ReturnType<typeof startSurfaceApp>> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  app = await startSurfaceApp({ stateDir, port: 0 });
  const instanceId = app.instanceId;
  const vite = app.vite;
  const { token } = JSON.parse(readFileSync(join(stateDir, 'connection.json'), 'utf8'));
  async function management(path: string, body: unknown) {
    const response = await fetch(app!.origin + path, {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(120_000),
    });
    assert.equal(response.ok, true, `Management operation failed: ${path}`);
    return response.json();
  }
  await management('/api/namespaces', { name: 'fixture' });
  const mount = await management('/api/mounts', { namespace: 'fixture', name: 'counter', source });
  assert.equal(mount.status, 'ready');
  assert.equal(new URL(mount.previewUrl).origin, app.origin);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const shell = await browser.newPage();
  const page = await browser.newPage();
  const errors: string[] = [];
  shell.on('pageerror', error => errors.push(error.message));
  page.on('pageerror', error => errors.push(error.message));
  await shell.goto(app.origin);
  await expect(shell.getByRole('heading', { name: 'Surface', exact: true })).toBeVisible();
  await page.goto(mount.previewUrl);
  await page.getByRole('link', { name: 'routes/counter/+page.svelte' }).click();
  await expect(page.getByRole('heading', { name: 'Shared runtime counter', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Count 0', exact: true }).click();
  await page.getByRole('textbox', { name: 'Draft' }).fill('Keep my draft');
  const marker = await page.evaluate(() => {
    const marker = crypto.randomUUID();
    Object.assign(window, { fixtureDocument: marker });
    return marker;
  });
  const file = join(source, 'routes/counter/+page.svelte');
  writeFileSync(file, readFileSync(file, 'utf8').replace('Shared runtime counter', 'Updated runtime counter'));
  await expect(page.getByRole('heading', { name: 'Updated runtime counter', exact: true })).toBeVisible();
  assert.equal(await page.evaluate(() => (window as unknown as { fixtureDocument: string }).fixtureDocument), marker);
  await expect(page.getByRole('button', { name: 'Count 1', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Draft' })).toHaveValue('Keep my draft');
  assert.deepEqual(errors, []);
  const sourceURL = app.origin + '/@fs' + file;
  assert.equal((await fetch(sourceURL)).status, 200);
  await management('/api/unmount', { namespace: 'fixture', name: 'counter' });
  assert.equal((await fetch(mount.previewUrl)).status, 404);
  assert.equal((await fetch(sourceURL)).status, 403);
  assert.equal(existsSync(join(stateDir, 'workspace/mounts/fixture/counter')), false);
  assert.equal(readFileSync(file, 'utf8').includes('Updated runtime counter'), true);
  const health = await fetch(app.origin + '/health').then(response => response.json());
  assert.equal(health.runtime.instanceId, instanceId);
  assert.equal(app.vite, vite);
  await shell.reload();
  await expect(shell.getByRole('heading', { name: 'Surface', exact: true })).toBeVisible();
  console.log('PASS: same-origin shell and fixture, interactive counter, HMR without reload, retained draft/count, unmount revocation, preserved source, healthy host.');
} finally {
  try { await browser?.close(); }
  finally {
    try { await app?.stop(); }
    finally { rmSync(temporary, { recursive: true, force: true }); }
  }
}
