import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'node:net';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DeliveryError, type AgentAdapter, type Binding } from '@decompozr/surface-app/server/agent-adapters/codex';
import { startSurfaceApp } from '@decompozr/surface-app/server/host/host';
import { workspaceFixture } from './workspace-fixture.ts';

const f = await workspaceFixture();
const socketPath = join(f.directory, 'fixture.sock');
const socket = createServer(client => client.end());
const deliveries: { binding: Binding; payload: { requestId: string; responseId: string; data: { label: string } } }[] = [];
const roots = new Map([['fixture-main', f.main], ['fixture-linked', f.linked]]);
const adapter: AgentAdapter = {
  async inspect(binding) {
    assert.equal(roots.get(binding.threadId), binding.projectRoot);
    return { status: 'idle' };
  },
  async deliver(binding, message) {
    await this.inspect(binding);
    const payload = JSON.parse(message.split('\n')[1]!);
    deliveries.push({ binding, payload });
    assert.ok(message.includes(f.stateDir));
    if (payload.data.label === 'uncertain') throw new DeliveryError('Fixture disconnect after send', 'unknown');
    return { mode: 'start', turnId: 'fixture-turn' };
  },
};
let app: Awaited<ReturnType<typeof startSurfaceApp>> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  await new Promise<void>((resolve, reject) => { socket.once('error', reject); socket.listen(socketPath, resolve); });
  app = await startSurfaceApp({ ...f, port: 0, adapter });
  async function raw(path: string, body?: unknown, capability?: string) {
    const { token } = JSON.parse(readFileSync(join(f.stateDir, 'connection.json'), 'utf8'));
    return fetch(app!.origin + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { authorization: `Bearer ${capability ?? token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  async function api(path: string, body?: unknown) {
    const response = await raw(path, body);
    const value = await response.json();
    assert.ok(response.ok, JSON.stringify(value)); return value;
  }
  async function project(projectRoot: string, operation: string) {
    const value = await api('/api/v1/projects/operations', {
      projectRoot, operation, ...(operation === 'register' ? {} : { artifactId: f.artifactId }),
    });
    assert.ok(value.ok, JSON.stringify(value)); return value.data;
  }
  await project(f.main, 'register'); await project(f.linked, 'register');
  const main = await project(f.main, 'mount'), linked = await project(f.linked, 'mount');
  const binding = await api('/api/bindings', { projectRoot: f.main, threadId: 'fixture-main', socketPath });
  const schema = JSON.parse(readFileSync(join(f.main, 'ui/feedback.schema.json'), 'utf8'));
  const requestInput = { bindingId: binding.id, namespace: main.namespace, name: main.name, component: 'routes/feedback/+page.svelte', title: 'Choose a label', schema };
  assert.equal((await raw('/api/requests', { ...requestInput, namespace: linked.namespace })).status, 400);
  const request = await api('/api/requests', requestInput);
  const scope = `/api/n/${main.namespace}/${main.name}/requests/${request.id}`;
  assert.equal((await raw(`/api/n/${linked.namespace}/${linked.name}/requests/${request.id}`, undefined, request.token)).status, 403);
  assert.equal((await raw(`/api/requests/${request.id}/result`, { message: 'forged' }, request.token)).status, 401);
  assert.equal((await raw(scope + '/responses', { responseId: 'invalid', data: { label: '' } }, request.token)).status, 400);
  assert.equal(deliveries.length, 0);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(request.previewUrl);
  await expect(page.getByRole('button', { name: 'Send feedback' })).toBeEnabled();
  await page.getByRole('textbox', { name: 'Feedback' }).fill('Review this choice');
  assert.equal(deliveries.length, 0);
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(page.getByRole('status')).toHaveText('accepted');
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0]!.binding.threadId, 'fixture-main');
  assert.equal(deliveries[0]!.binding.projectRoot, f.main);
  assert.equal(deliveries[0]!.payload.requestId, request.id);
  assert.equal(deliveries[0]!.payload.data.label, 'Review this choice');
  const record = await api(`/api/requests/${request.id}`);
  const retry = { responseId: record.response.id, data: record.response.data };
  assert.equal((await raw(scope + '/responses', retry, request.token)).status, 200);
  assert.equal(deliveries.length, 1);
  await api(`/api/requests/${request.id}/result`, { message: 'Choice recorded by the fixture agent' });
  await expect(page.getByTestId('result')).toHaveText('Choice recorded by the fixture agent');
  const closed = await api('/api/requests', requestInput);
  await api(`/api/requests/${closed.id}/close`, {});
  assert.equal((await raw(`/api/n/${main.namespace}/${main.name}/requests/${closed.id}/responses`, { responseId: 'late', data: { label: 'late' } }, closed.token)).status, 409);
  const uncertain = await api('/api/requests', requestInput);
  const uncertainPath = `/api/n/${main.namespace}/${main.name}/requests/${uncertain.id}/responses`;
  const uncertainInput = { responseId: 'uncertain-response', data: { label: 'uncertain' } };
  assert.equal((await (await raw(uncertainPath, uncertainInput, uncertain.token)).json()).response.status, 'unknown');
  await raw(uncertainPath, uncertainInput, uncertain.token);
  assert.equal(deliveries.length, 2);
  await page.close();
  await app.stop();
  app = await startSurfaceApp({ stateDir: f.stateDir, port: 0, adapter });
  assert.equal(deliveries.length, 2);
  const restored = await browser.newPage();
  const url = new URL(request.previewUrl);
  await restored.goto(app.origin + url.pathname + url.search + url.hash);
  await expect(restored.getByTestId('result')).toHaveText('Choice recorded by the fixture agent');
  assert.equal((await api(`/api/requests/${uncertain.id}`)).response.status, 'unknown');
  await project(f.main, 'unmount');
  assert.equal((await raw(scope, undefined, request.token)).status, 409);
  assert.equal((await api(`/api/requests/${request.id}`)).result.message, 'Choice recorded by the fixture agent');
  assert.equal((await fetch(app.origin + '/health')).status, 200);
  assert.equal(deliveries.length, 2);
  assert.equal(existsSync(f.dataRoot), false);
  assert.deepEqual(errors, []);
  console.log('PASS: browser response → exact fixture binding → published result; schema/scope/privilege guards, duplicate suppression, closed request, uncertain delivery, restart without replay, unmount and retained history. No live agent contacted.');
} finally {
  try { await browser?.close(); }
  finally {
    try { await app?.stop(); }
    finally {
      await new Promise<void>(resolve => socket.close(() => resolve()));
      rmSync(f.directory, { recursive: true, force: true });
    }
  }
}
