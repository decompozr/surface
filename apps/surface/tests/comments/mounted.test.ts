import { test, expect } from 'bun:test';
import { mkdtempSync, realpathSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Service, InputError } from '../../src/lib/server/services/service.ts';
import { Store } from '../../src/lib/server/services/store.ts';
import { mountedComments } from '../../src/lib/server/comments/mounted.ts';
import type { AgentAdapter } from '../../src/lib/server/agent-adapters/codex.ts';

for (const change of ['close', 'unmount'] as const) test(`mounted comments revalidate ${change} after asynchronous preflight`, async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'surface-mounted-guard-')));
  const socketPath = join(root, 'fixture.sock');
  const socket = Bun.listen({ unix: socketPath, socket: { data() {} } });
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>(resolve => release = resolve);
  const waiting = new Promise<void>(resolve => entered = resolve);
  let checks = 0, deliveries = 0, mounted = true;
  const adapter: AgentAdapter = {
    async inspect() { if (++checks === 3) { entered(); await gate; } return { status: 'idle' }; },
    async deliver() { deliveries++; return { mode: 'start', turnId: 'fixture' }; },
  };
  const service = new Service(new Store(join(root, 'interactions.json')), adapter, '/fixture/cli');
  const binding = await service.bind({ projectRoot: root, threadId: 'fixture', socketPath });
  const scope = { projectRoot: root, source: root, namespace: 'fixture', name: 'page', component: 'routes/+page.svelte' };
  const parent = service.create({ bindingId: binding.id, title: 'Fixture', schema: { type: 'object' } }, scope);
  const bridge = mountedComments(root, service, adapter);
  const batch = { id: 'batch', status: 'pending', recipient: 'codex:fixture', page: '/project/', revision: 'fixture', createdAt: 'fixture', delivery: { mode: 'start', expectedStatus: 'idle' }, comments: [{ id: 'comment', text: 'Fixture', target: { id: 'h', label: 'h1', selector: 'h1', text: 'Fixture', revision: 'fixture' } }] };
  const base = `/api/n/fixture/page/requests/${parent.id}/comments`;
  async function call(operation: string, data?: unknown, token = parent.token, path = base) {
    const req = Readable.from(data === undefined ? [] : [JSON.stringify(data)]) as IncomingMessage;
    req.method = data === undefined ? 'GET' : 'POST';
    req.headers = { authorization: `Bearer ${token}`, origin: 'http://localhost', 'content-type': 'application/json' };
    let result: any, status = 200;
    await bridge.route(req, {} as ServerResponse, new URL(`http://localhost${path}/${operation}`), (value, code) => { result = value; status = code ?? 200; }, () => {
      if (!mounted) throw new InputError('Unmounted.', 409);
      return { publicPath: '/project', pages: { '': scope.component } };
    });
    return { result, status };
  }
  try {
    await expect(call('batch', undefined, 'wrong')).rejects.toMatchObject({ status: 401 });
    await expect(call('batch', undefined, parent.token, base.replace('/fixture/page/', '/fixture/other/'))).rejects.toMatchObject({ status: 403 });
    await expect(call('batch', { ...batch, page: '/other' })).rejects.toMatchObject({ status: 403 });
    await expect(call('result', { requestId: 'fake', result: { message: 'forged' } })).rejects.toMatchObject({ status: 401 });
    const pending = call('batch', batch);
    await waiting;
    if (change === 'close') service.close(parent.id); else mounted = false;
    release();
    const rejected = await pending;
    expect(rejected.status).toBe(409); expect(rejected.result.notSubmitted).toBe(true);
    expect(deliveries).toBe(0);
    expect(service.get(parent.id).response).toBeUndefined();
    const state = JSON.parse(readFileSync(join(root, 'mounted-comments', parent.id, 'interactions.json'), 'utf8'));
    expect(state.requests.every((record: any) => !record.response)).toBe(true);
    // Restore only the isolated fixture and verify delivery/result use their own records.
    mounted = true;
    service.store.update(state => { state.requests.find(item => item.id === parent.id)!.closed = false; });
    const accepted = await call('batch', batch);
    expect(accepted.result.status).toBe('accepted');
    await call('batch', batch); expect(deliveries).toBe(1);
    service.close(parent.id);
    expect((await call('batch', batch)).result.status).toBe('accepted');
    expect(deliveries).toBe(1);
    mounted = false;
    const connection = JSON.parse(readFileSync(join(root, 'mounted-comments', parent.id, 'connection.json'), 'utf8'));
    const published = await call('result', { requestId: accepted.result.requestId, result: { message: 'Completed after unmount', stage: 'completed' } }, connection.callbackToken);
    expect(published.result.result.message).toBe('Completed after unmount');
    expect(service.get(parent.id).result).toBeUndefined();
    expect(deliveries).toBe(1);
  } finally { release(); bridge.stop(); socket.stop(true); }
});
