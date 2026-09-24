import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { readFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AgentAdapter, DeliveryIntent } from '@decompozr/surface-agent-adapters/codex';
import { startSurfaceApp } from '@decompozr/surface-app/server/host/host';
import { workspaceFixture } from './workspace-fixture.ts';
const f = await workspaceFixture();
const socketPath = join(f.directory, 'fixture.sock');
const socket = createServer(client => client.end());
const deliveries: { threadId: string; intent?: DeliveryIntent }[] = [];
let active = true, ambiguous = false;
const adapter: AgentAdapter = {
  async inspect(binding) { assert.equal(binding.projectRoot, f.main); return { status: active ? 'active' : 'idle', turnId: active ? 'fixture-turn' : undefined }; },
  async deliver(binding, _message, intent) { deliveries.push({ threadId: binding.threadId, intent }); if (ambiguous) throw new Error('Fixture provider acknowledgement lost'); return intent?.mode === 'queue' ? { mode: 'queue', queuedSubmissionId: 'fixture-queue' } : { mode: intent?.mode ?? 'start', turnId: 'fixture-turn' }; },
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
  page.on('response', async response => { if (response.url().endsWith('/responses')) traces.push({ sent: response.request().postData(), status: response.status(), body: await response.text().catch(() => '[acknowledgement unavailable]') }); });
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) traces.push({ navigation: 'main-frame' }); });
  page.on('console', msg => { if (msg.text().includes('reload')) traces.push({ console: msg.text() }); });
  await page.goto(request.previewUrl);
  await expect(page.getByLabel('Delivery mode')).toBeEnabled();
  const originalURL = page.url();
  await page.getByRole('complementary', { name: 'Workspace navigation' }).getByRole('link', { name: 'feedback', exact: true }).click();
  assert.equal(page.url(), originalURL, 'Current readable route must retain request credentials.');
  await page.getByLabel('Delivery mode').selectOption('queue');
  const second = await browser.newPage(); await second.goto(request.previewUrl);
  await expect(second.getByLabel('Delivery mode')).toHaveValue('');
  await page.getByRole('textbox', { name: 'Feedback' }).fill('Fixture queue');
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(page.getByRole('status')).toHaveText('accepted').catch(async error => { console.log(JSON.stringify(traces)); console.log('mode', await page.getByLabel('Delivery mode').inputValue()); console.log(await page.locator('body').innerText()); throw error; });
  assert.equal(deliveries[0].intent?.mode, 'queue');
  await expect(page.getByRole('region', { name: 'Agent recipient' })).toContainText('Delivery: accepted · queue');
  await expect(page.getByLabel('Delivery mode')).toHaveCount(0);
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
  await expect(page.getByRole('region', { name: 'Agent recipient' }).getByRole('alert')).toContainText('state changed');
  await expect(page.getByLabel('Delivery mode')).toHaveValue('');
  assert.equal(deliveries.length, 1);
  const current = new URL(page.url()).searchParams.get('request');
  assert.equal((await api(`/api/requests/${current}`)).response, undefined);
  await expect(page.getByLabel('Delivery mode')).toBeDisabled();
  await expect(page.getByLabel('Conversation in this worktree')).toBeDisabled();
  await page.getByRole('button', { name: 'Refresh recipient' }).click();
  await expect(page.getByLabel('Delivery mode')).toBeEnabled();

  // The provider accepts once, but the browser never receives the POST acknowledgement.
  const lost = await api('/api/requests', input);
  await page.goto(lost.previewUrl);
  await expect(page.getByLabel('Delivery mode')).toBeEnabled();
  let lostId = '', posts = 0;
  const lostPath = `**/requests/${lost.id}/responses`;
  await page.route(lostPath, async route => {
    posts++;
    lostId = route.request().postDataJSON().responseId;
    const accepted = await route.fetch(); assert.equal(accepted.status(), 200);
    await route.abort('connectionreset');
  });
  await page.getByRole('textbox', { name: 'Feedback' }).fill('Accepted but acknowledgement lost');
  await page.getByRole('button', { name: 'Send feedback' }).click();
  const panel = page.getByRole('region', { name: 'Agent recipient' });
  await expect(panel).toContainText('Submission outcome unconfirmed');
  await expect(panel).toContainText(lostId);
  await expect(page.getByLabel('Delivery mode')).toHaveCount(0);
  assert.equal(deliveries.length, 2);
  await page.getByRole('button', { name: 'Check submission' }).click();
  await expect(panel).toContainText('Accepted by the agent runtime; waiting for a published result.');
  await expect(panel).not.toContainText('Submission outcome unconfirmed');
  assert.equal(posts, 1);

  // Provider inspection can fail without hiding durable result/history.
  await page.route(`**/requests/${lost.id}/recipient`, route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Fixture recipient unavailable' }) }));
  await api(`/api/requests/${lost.id}/result`, { message: 'Fixture result after lost acknowledgement' });
  await page.getByRole('button', { name: 'Check submission' }).click();
  await expect(panel).toContainText('Result published.');
  await expect(panel).toContainText('Recipient status unavailable.');
  await expect(panel).not.toContainText('waiting for a published result');
  await page.reload();
  await expect(panel).toContainText('Result published.');
  await expect(panel).toContainText(lostId);
  assert.equal(posts, 1); assert.equal(deliveries.length, 2);
  mkdirSync('.decompozr/surface/screenshots', { recursive: true });
  await page.screenshot({ path: '.decompozr/surface/screenshots/recipient-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('complementary', { name: 'Workspace navigation' })).toBeHidden();
  await expect.poll(() => panel.evaluate(element => Math.round(element.getBoundingClientRect().width))).toBeGreaterThan(340);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: '.decompozr/surface/screenshots/recipient-mobile.png', fullPage: true });
  ambiguous = true;
  const unknown = await api('/api/requests', input);
  await page.goto(unknown.previewUrl);
  await expect(page.getByLabel('Delivery mode')).toBeEnabled();
  await page.getByRole('textbox', { name: 'Feedback' }).fill('Provider outcome unknown');
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(panel).toContainText('Delivery outcome is unknown.');
  await expect(page.getByLabel('Conversation in this worktree')).toHaveCount(0);
  await page.getByRole('button', { name: 'Check submission' }).click();
  await expect(panel).toContainText('Delivery outcome is unknown.');
  assert.equal(deliveries.length, 3);
  const unknownRecord = await api(`/api/requests/${unknown.id}`);
  assert.equal(unknownRecord.response.status, 'unknown'); assert.equal(unknownRecord.result, undefined);
  await page.screenshot({ path: '.decompozr/surface/screenshots/recipient-unknown-mobile.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('Recipient fixture passed: queue, per-tab choice, explicit takeover, no replay, state-change rejection, desktop/mobile, lost acknowledgement inspection, unavailable provider with durable result and reload.');
} finally { await browser?.close(); await app?.stop(); socket.close(); rmSync(f.directory, { recursive: true, force: true }); }
