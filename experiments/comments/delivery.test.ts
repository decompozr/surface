import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type Server } from 'node:net';
import { CommentDelivery, type Connection } from './delivery';
import { DeliveryError, type AgentAdapter } from '../../src/adapters/codex';
import type { Batch } from '../../apps/surface/src/lib/comment-experiment/model';
const cleanup: (() => void)[] = [];
afterEach(() => { for (const dispose of cleanup.splice(0)) dispose(); });
async function fixture(adapter: AgentAdapter) {
  const root = mkdtempSync(join(tmpdir(), 'surface-comments-'));
  const socketPath = join(root, 'control.sock');
  const server: Server = createServer();
  await new Promise<void>(resolve => server.listen(socketPath, resolve));
  cleanup.push(() => { server.close(); rmSync(root, { recursive: true, force: true }); });
  const config: Connection = { threadId: 'fixture-thread', projectRoot: root, socketPath, label: 'Fixture only', token: 'fixture', callbackToken: 'fixture-callback', origin: 'http://localhost', resultCli: '/fixture/result.ts' };
  return { root, config, bridge: new CommentDelivery(root, config, adapter) };
}
const batch = (): Batch => ({ id: 'batch-1', createdAt: '2026-09-23T00:00:00Z', page: '/experiments/comments', revision: 'v2', recipient: 'codex:fixture-thread', status: 'pending', comments: [{ id: 'comment-1', target: { id: 'heading', label: 'Heading', selector: '#heading', text: 'Title', revision: 'v2' }, text: 'Automated fixture only.' }] });
describe('exact conversation comment delivery using a fake adapter', () => {
  test('concurrent duplicates and restart do not deliver twice; callback result is separate', async () => {
    let calls = 0;
    const { bridge, root, config } = await fixture({ inspect: async () => ({ status: 'idle' }), deliver: async binding => { expect(binding.threadId).toBe('fixture-thread'); calls++; await new Promise(r => setTimeout(r, 10)); return { mode: 'start', turnId: 'fake-turn' }; } });
    await Promise.all([bridge.submit(batch()), bridge.submit(batch())]);
    expect(calls).toBe(1); expect(bridge.view('batch-1')?.status).toBe('accepted');
    const restored = new CommentDelivery(root, config, { inspect: async () => ({ status: 'idle' }), deliver: async () => { throw new Error('Must not replay'); } });
    expect((await restored.submit(batch()))?.receipt).toBe('fake-turn');
    const request = restored.view('batch-1')!.requestId;
    restored.service.result(request, { message: 'Actual fixture result' });
    expect(restored.view('batch-1')?.result).toEqual({ message: 'Actual fixture result' });
    const changed = batch(); changed.comments[0].text = 'Different payload';
    await expect(restored.submit(changed)).rejects.toThrow('already has a submission');
  });
  test('preflight shares identical pending batches but rejects changed payloads', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let inspected!: () => void;
    const entered = new Promise<void>(resolve => { inspected = resolve; });
    let calls = 0;
    let inspections = 0;
    const { bridge } = await fixture({ inspect: async () => { if (++inspections > 1) { inspected(); await gate; } return { status: 'idle' }; }, deliver: async () => { calls++; return { mode: 'start', turnId: 'fake-turn' }; } });
    const first = bridge.submit(batch());
    await entered;
    const duplicate = bridge.submit(batch());
    const changed = batch(); changed.comments[0].text = 'Changed while preflight is pending';
    await expect(bridge.submit(changed)).rejects.toThrow('already has a submission');
    release();
    await Promise.all([first, duplicate]);
    expect(calls).toBe(1);
  });
  test('active recipient requires explicit delivery choice and leaves the draft unsent', async () => {
    let calls = 0;
    const { bridge } = await fixture({ inspect: async () => ({ status: 'active', turnId: 'active-turn' }), deliver: async () => { calls++; return { mode: 'steer', turnId: 'active-turn' }; } });
    await expect(bridge.submit(batch())).rejects.toThrow('Choose queue or steer explicitly');
    expect(calls).toBe(0);
    expect(bridge.view('batch-1')?.status).toBe('pending');
  });
  test('uncertain acknowledgement is retained and never automatically replayed', async () => {
    let calls = 0;
    const { bridge } = await fixture({ inspect: async () => ({ status: 'idle' }), deliver: async () => { calls++; throw new DeliveryError('Lost acknowledgement', 'unknown'); } });
    expect((await bridge.submit(batch()))?.status).toBe('unknown');
    expect((await bridge.submit(batch()))?.status).toBe('unknown');
    expect(calls).toBe(1);
  });
  test('stores images for agent inspection without embedding base64 in the delivered prompt', async () => {
    let prompt = '';
    const { bridge } = await fixture({ inspect: async () => ({ status: 'idle' }), deliver: async (_, message) => { prompt = message; return { mode: 'start', turnId: 'fake-turn' }; } });
    const value = batch();
    value.comments[0].capture = { png: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC1kAAAAASUVORK5CYII=', width: 1, height: 1, capturedAt: value.createdAt, method: 'dom-render', bounds: { x: 0, y: 0, width: 1, height: 1 } };
    await bridge.submit(value);
    expect(prompt).not.toContain('data:image/png'); expect(prompt).toContain('imagePath');
    const record = bridge.service.store.state.requests[0].response!.data;
    const comments = record.comments as { capture: { imagePath: string } }[];
    expect(readFileSync(comments[0].capture.imagePath).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  });
  test('rejects recipient substitution before delivery', async () => {
    const { bridge } = await fixture({ inspect: async () => ({ status: 'idle' }), deliver: async () => { throw new Error('Must not deliver'); } });
    await expect(bridge.submit({ ...batch(), recipient: 'codex:other-thread' })).rejects.toThrow('recipient');
  });
});
