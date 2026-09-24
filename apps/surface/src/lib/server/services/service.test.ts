import { afterEach, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from './store.ts';
import { Service } from './service.ts';
import { DeliveryError, type AgentAdapter, type Binding } from '../agent-adapters/codex.ts';

const feedbackSchema = {
  type: 'object', additionalProperties: false, required: ['option', 'width', 'comment'],
  properties: {
    option: { type: 'string', enum: ['A', 'B'] },
    width: { type: 'integer', minimum: 80, maximum: 240 },
    comment: { type: 'string', maxLength: 1000 },
  },
};

const fixture = (deliver?: AgentAdapter['deliver']) => {
  const dir = mkdtempSync(join(tmpdir(), 'surface-service-')); directories.push(dir);
  const file = join(dir, 'state.json');
  const store = new Store(file);
  const binding: Binding = { id: 'bound-session', threadId: 'exact-thread', projectRoot: realpathSync(dir), socketPath: '/test.sock' };
  store.update(state => { state.bindings.push(binding); });
  const calls: Binding[] = [];
  const service = new Service(store, {
    inspect: async () => ({ status: 'idle' }),
    deliver: async (...args) => { calls.push(args[0]); return deliver ? deliver(...args) : { mode: 'start', turnId: 'one-turn' }; },
  }, submission => JSON.stringify(submission));
  const request = service.create({ bindingId: binding.id, title: 'Choose an option', schema: feedbackSchema });
  return { service, store, request, calls, file };
};


const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });
const payload = { responseId: 'one-response', data: { option: 'B', width: 160, comment: 'Please use this' } };
test('persists accepted delivery and routes only to the bound session', async () => {
  const { service, request, calls, file } = fixture();
  const view = await service.submit(request.id, payload);
  expect(view.response?.status).toBe('accepted');
  expect(calls.map(item => item.threadId)).toEqual(['exact-thread']);
  expect(new Store(file).state.requests[0]?.response?.receipt?.turnId).toBe('one-turn');
  expect(view).not.toHaveProperty('token');
});
test('deduplicates concurrent retries, and rejects reused IDs with changed data', async () => {
  let finish!: () => void;
  const wait = new Promise<void>(resolve => { finish = resolve; });
  const { service, request, calls } = fixture(async () => { await wait; return { mode: 'start', turnId: 'turn' }; });
  const original = service.submit(request.id, payload);
  await expect(service.submit(request.id, payload)).rejects.toThrow('operation in progress');
  await new Promise(resolve => setTimeout(resolve, 0));
  expect((await service.submit(request.id, payload)).response?.status).toBe('delivering');
  await expect(service.submit(request.id, { ...payload, data: { ...payload.data, width: 180 } })).rejects.toThrow('already has a submission');
  finish(); await original;
  await service.submit(request.id, payload);
  expect(calls).toHaveLength(1);
});
test('rejects invalid input and closed requests before delivery', async () => {
  const { service, request, calls } = fixture();
  await expect(service.submit(request.id, { ...payload, data: { ...payload.data, width: 900 } })).rejects.toThrow('schema');
  service.close(request.id);
  await expect(service.submit(request.id, payload)).rejects.toThrow('closed');
  expect(calls).toHaveLength(0);
});
test('retains an unknown outcome and never silently retries it', async () => {
  const { service, request, calls, file } = fixture(async () => { throw new DeliveryError('Connection lost after write', 'unknown'); });
  await service.submit(request.id, payload);
  await service.submit(request.id, payload);
  expect(calls).toHaveLength(1);
  expect(new Store(file).state.requests[0]?.response?.status).toBe('unknown');
});
test('marks a delivery interrupted by restart as unknown', () => {
  const { store, file } = fixture();
  store.update(state => { state.requests[0]!.response = { id: 'r', data: {}, createdAt: 'now', status: 'delivering' }; });
  expect(new Store(file).state.requests[0]?.response?.status).toBe('unknown');
});
test('records a published result separately from delivery acceptance', async () => {
  const { service, request } = fixture();
  await service.submit(request.id, payload);
  service.result(request.id, { message: 'Updated', option: 'B', width: 160 });
  expect(service.view(request.id)).toMatchObject({ response: { status: 'accepted' }, result: { width: 160 } });
});

test('duplicate reconciliation cannot silently change delivery mode', async () => {
  const { service, request, calls } = fixture();
  const delivery = { mode: 'start', expectedStatus: 'idle' };
  await service.submit(request.id, { ...payload, delivery });
  await service.submit(request.id, { ...payload, delivery });
  await expect(service.submit(request.id, { ...payload, delivery: { mode: 'queue', expectedStatus: 'active' } })).rejects.toThrow('already has a submission');
  expect(calls).toHaveLength(1);
});

test('takeover is opt-in, exact-worktree, atomic and never replays submissions', async () => {
  const { service, store, request, calls } = fixture();
  store.update(state => state.bindings.push({ ...state.bindings[0]!, id: 'next-binding', threadId: 'next-thread' }));
  await expect(service.takeOver(request.id, { threadId: 'next-thread' })).rejects.toThrow('not enabled');
  const enabled = service.create({ bindingId: request.bindingId, title: 'Select', schema: feedbackSchema, recipientSelection: true });
  await expect(service.takeOver(enabled.id, { threadId: 'foreign' })).rejects.toThrow('exact worktree');
  const next = await service.takeOver(enabled.id, { threadId: 'next-thread' });
  expect(service.get(enabled.id)).toMatchObject({ closed: true, replacedBy: next.id });
  expect(next).toMatchObject({ replaces: enabled.id, bindingId: 'next-binding' });
  expect(next.token).not.toBe(enabled.token);
  expect(next.response).toBeUndefined();
  expect(calls).toHaveLength(0);
  await service.submit(next.id, payload);
  await expect(service.takeOver(next.id, { threadId: 'exact-thread' })).rejects.toThrow('Reconcile');
});
test('preflight blocks close and takeover and revalidates the mount before reserving data', async () => {
  const { service, request, calls } = fixture();
  const pending = service.submit(request.id, payload, () => { throw Error('mount unavailable'); });
  expect(() => service.close(request.id)).toThrow('operation in progress');
  await expect(service.takeOver(request.id, { threadId: 'next' })).rejects.toThrow('operation in progress');
  await expect(pending).rejects.toThrow('mount unavailable');
  expect(service.get(request.id).response).toBeUndefined();
  expect(calls).toHaveLength(0);
});

test('requests require an explicit page-owned schema', () => {
  const { service, request } = fixture();
  expect(() => service.create({ bindingId: request.bindingId, title: 'Missing schema' })).toThrow('Expected a JSON object');
});
