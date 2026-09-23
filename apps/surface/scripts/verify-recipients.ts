import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { readFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AgentAdapter, DeliveryIntent } from '../../../src/adapters/codex';
import { startSurfaceApp } from '../server/host';
import { workspaceFixture } from './workspace-fixture';
const f = await workspaceFixture();
const socketPath = join(f.directory, 'fixture.sock');
const socket = createServer(client => client.end());
const deliveries: { threadId: string; intent?: DeliveryIntent }[] = [];
let active = true;
const adapter: AgentAdapter = {
  async inspect(binding) { assert.equal(binding.projectRoot, f.main); return { status: active ? 'active' : 'idle', turnId: active ? 'fixture-turn' : undefined }; },
  async deliver(binding, _message, intent) { deliveries.push({ threadId: binding.threadId, intent }); return intent?.mode === 'queue' ? { mode: 'queue', queuedSubmissionId: 'fixture-queue' } : { mode: intent?.mode ?? 'start', turnId: 'fixture-turn' }; },
};
let app: Awaited<ReturnType<typeof startSurfaceApp>> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  await new Promise<void>(resolve => socket.listen(socketPath, resolve));
  app = await startSurfaceApp({ ...f, port: 0, adapter });
  const { token } = JSON.parse(readFileSync(join(f.stateDir, 'connection.json'), 'utf8'));
  async function raw(path: string, body?: unknown, capability = token) {
    return fetch(app!.origin + path, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${capability}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  }
  async function api(path: string, body?: unknown) { const response = await raw(path, body); const value = await response.json(); assert.ok(response.ok, JSON.stringify(value)); return value; }
  for (const operation of ['register', 'mount']) await api('/api/v1/projects/operations', { projectRoot: f.main, operation, ...(operation === 'mount' ? { artifactId: f.artifactId } : {}) });
  const mount = (await api('/api/mounts'))[0];
  const bindings = [];
  for (const threadId of ['fixture-a', 'fixture-b']) bindings.push(await api('/api/bindings', { projectRoot: f.main, threadId, socketPath }));
  const input = { bindingId: bindings[0].id, namespace: mount.namespace, name: mount.name, component: 'routes/feedback/+page.svelte', title: 'Fixture recipient', schema: { type: 'object', required: ['label'], properties: { label: { type: 'string' } } }, recipientSelection: true };
  const request = await api('/api/requests', input);
  const scope = `/api/n/${mount.namespace}/${mount.name}/requests/${request.id}`;
  assert.equal((await raw(scope + '/recipients', undefined, 'wrong-token')).status, 401);
  assert.equal((await raw(scope + '/takeover', { threadId: 'foreign' }, request.token)).status, 409);
  const fixed = await api('/api/requests', { ...input, recipientSelection: false });
  assert.equal((await raw(`/api/n/${mount.namespace}/${mount.name}/requests/${fixed.id}/recipients`, undefined, fixed.token)).status, 403);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage(); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const traces: unknown[] = [];
  page.on('response', async response => { if (response.url().endsWith('/responses')) traces.push({ sent: response.request().postData(), status: response.status(), body: await response.text() }); });
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) traces.push({ navigation: 'main-frame' }); });
  page.on('console', msg => { if (msg.text().includes('reload')) traces.push({ console: msg.text() }); });
  await page.goto(request.previewUrl);
  await expect(page.getByLabel('Delivery mode')).toBeEnabled();
  await page.getByLabel('Delivery mode').selectOption('queue');
  const second = await browser.newPage(); await second.goto(request.previewUrl);
  await expect(second.getByLabel('Delivery mode')).toHaveValue('');
  await page.getByRole('textbox', { name: 'Feedback' }).fill('Fixture queue');
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(page.getByRole('status')).toHaveText('accepted').catch(async error => { console.log(JSON.stringify(traces)); console.log('mode', await page.getByLabel('Delivery mode').inputValue()); console.log(await page.locator('body').innerText()); throw error; });
  assert.equal(deliveries[0].intent?.mode, 'queue');
  const nextRequest = await api('/api/requests', input); await page.goto(nextRequest.previewUrl);
  await expect(page.getByLabel('Conversation in this worktree')).toBeEnabled();
  await page.getByLabel('Conversation in this worktree').selectOption('fixture-b');
  await page.getByRole('button', { name: 'Confirm recipient change' }).click();
  await expect(page.locator('code')).toHaveText('fixture-b');
  assert.equal(deliveries.length, 1);
  assert.equal((await api(`/api/requests/${nextRequest.id}`)).closed, true);
  await page.getByLabel('Delivery mode').selectOption('steer');
  active = false;
  await page.getByRole('textbox', { name: 'Feedback' }).fill('State changed');
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(page.getByRole('alert')).toContainText('state changed');
  assert.equal(deliveries.length, 1);
  const current = new URL(page.url()).searchParams.get('request');
  assert.equal((await api(`/api/requests/${current}`)).response, undefined);
  mkdirSync('.decompozr/surface/screenshots', { recursive: true });
  await page.screenshot({ path: '.decompozr/surface/screenshots/recipient-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: '.decompozr/surface/screenshots/recipient-mobile.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('Recipient fixture passed: queue, per-tab choice, explicit takeover, no replay, state-change rejection, desktop/mobile.');
} finally { await browser?.close(); await app?.stop(); socket.close(); rmSync(f.directory, { recursive: true, force: true }); }
