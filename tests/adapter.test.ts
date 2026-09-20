import { expect, test } from 'bun:test';
import { CodexAdapter, DeliveryError, type Binding } from '../src/adapters/codex.ts';
import { RpcError, TransportError, type Rpc } from '../src/adapters/rpc.ts';
import { realpathSync } from 'node:fs';

const binding: Binding = { id: 'binding', projectRoot: realpathSync(process.cwd()), threadId: 'thread-exact', socketPath: '/test.sock' };
class FakeRpc implements Rpc {
  calls: { method: string; params: any }[] = [];
  closed = false;
  constructor(private handler: (method: string, params: any) => unknown) {}
  async call<T>(method: string, params: unknown): Promise<T> {
    this.calls.push({ method, params });
    return this.handler(method, params) as T;
  }
  close() { this.closed = true; }
}
function fixture(state: string, mutate?: (method: string) => unknown) {
  return new FakeRpc((method, params) => {
    if (method === 'thread/read') return { thread: { id: binding.threadId, cwd: binding.projectRoot, status: { type: state } } };
    if (method === 'thread/turns/list') return { data: [{ id: 'active-turn', status: 'inProgress' }] };
    if (method === 'turn/steer' || method === 'turn/start') {
      if (mutate) return mutate(method);
      return method === 'turn/steer' ? { turnId: params.expectedTurnId } : { turn: { id: 'new-turn' } };
    }
    throw new Error(`Unexpected method ${method}`);
  });
}
test('steers the exact active turn without starting a new one', async () => {
  const rpc = fixture('active');
  const receipt = await new CodexAdapter(async () => rpc).deliver(binding, 'choice B');
  expect(receipt).toEqual({ mode: 'steer', turnId: 'active-turn' });
  expect(rpc.calls.at(-1)).toMatchObject({ method: 'turn/steer', params: { threadId: 'thread-exact', expectedTurnId: 'active-turn' } });
  expect(rpc.calls.map(call => call.method)).not.toContain('turn/start');
  expect(rpc.closed).toBe(true);
});
test('starts a new turn in the same idle thread', async () => {
  const rpc = fixture('idle');
  expect(await new CodexAdapter(async () => rpc).deliver(binding, 'choice B')).toEqual({ mode: 'start', turnId: 'new-turn' });
  expect(rpc.calls.at(-1)?.params.threadId).toBe(binding.threadId);
  expect(rpc.calls.map(call => call.method)).not.toContain('thread/start');
});
test('an explicit turn-race rejection is failed and never falls back to another turn', async () => {
  const rpc = fixture('active', () => { throw new RpcError('Turn no longer active'); });
  try { await new CodexAdapter(async () => rpc).deliver(binding, 'choice B'); throw new Error('Expected failure'); }
  catch (error) { expect(error).toBeInstanceOf(DeliveryError); expect((error as DeliveryError).outcome).toBe('failed'); }
  expect(rpc.calls.filter(call => call.method.startsWith('turn/'))).toHaveLength(1);
});
test('a timeout after submitting is unknown, with no automatic retry', async () => {
  const rpc = fixture('idle', () => { throw new TransportError('timeout'); });
  try { await new CodexAdapter(async () => rpc).deliver(binding, 'choice B'); throw new Error('Expected failure'); }
  catch (error) { expect((error as DeliveryError).outcome).toBe('unknown'); }
  expect(rpc.calls.filter(call => call.method === 'turn/start')).toHaveLength(1);
});
test('refuses a thread from a different project before sending input', async () => {
  const rpc = new FakeRpc(() => ({ thread: { id: binding.threadId, cwd: '/tmp', status: { type: 'idle' } } }));
  await expect(new CodexAdapter(async () => rpc).deliver(binding, 'choice B')).rejects.toThrow('does not belong');
  expect(rpc.calls).toHaveLength(1);
});
test('reopens only the specified unloaded thread without configuration overrides', async () => {
  let loaded = false;
  const rpc = new FakeRpc((method, params) => {
    if (method === 'thread/read') return { thread: { id: binding.threadId, cwd: binding.projectRoot, status: { type: loaded ? 'idle' : 'notLoaded' } } };
    if (method === 'thread/resume') { expect(params).toEqual({ threadId: binding.threadId, excludeTurns: true }); loaded = true; return {}; }
    if (method === 'turn/start') return { turn: { id: 'resumed-turn' } };
    throw new Error(method);
  });
  expect(await new CodexAdapter(async () => rpc).deliver(binding, 'input')).toEqual({ mode: 'start', turnId: 'resumed-turn' });
});
