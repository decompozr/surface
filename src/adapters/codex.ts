import { realpathSync } from 'node:fs';
import { CodexRpc, RpcError, type Rpc } from './rpc.ts';

export type Binding = { id: string; projectRoot: string; threadId: string; socketPath: string };
export type Receipt = { mode: 'steer' | 'start'; turnId: string };
export class DeliveryError extends Error {
  constructor(message: string, public outcome: 'failed' | 'unknown') { super(message); }
}
export interface AgentAdapter {
  inspect(binding: Binding): Promise<{ status: string }>;
  deliver(binding: Binding, message: string): Promise<Receipt>;
}
type Thread = { id: string; cwd: string; status: { type: string } };
type Turn = { id: string; status: string };

export class CodexAdapter implements AgentAdapter {
  constructor(private connect: (path: string) => Promise<Rpc> = CodexRpc.connect) {}
  private async read(rpc: Rpc, binding: Binding): Promise<Thread> {
    const { thread } = await rpc.call<{ thread: Thread }>('thread/read', {
      threadId: binding.threadId, includeTurns: false,
    });
    if (thread.id !== binding.threadId || realpathSync(thread.cwd) !== binding.projectRoot) {
      throw new Error('The Codex thread does not belong to the registered project.');
    }
    return thread;
  }
  async inspect(binding: Binding) {
    const rpc = await this.connect(binding.socketPath);
    try { return { status: (await this.read(rpc, binding)).status.type }; }
    finally { rpc.close(); }
  }
  async deliver(binding: Binding, message: string): Promise<Receipt> {
    let rpc: Rpc | undefined;
    let submitted = false;
    try {
      rpc = await this.connect(binding.socketPath);
      let thread = await this.read(rpc, binding);
      if (thread.status.type === 'notLoaded') {
        await rpc.call('thread/resume', { threadId: binding.threadId, excludeTurns: true });
        thread = await this.read(rpc, binding);
      }
      const input = [{ type: 'text', text: message, text_elements: [] }];
      if (thread.status.type === 'active') {
        const { data } = await rpc.call<{ data: Turn[] }>('thread/turns/list', {
          threadId: binding.threadId, limit: 5, sortDirection: 'desc', itemsView: 'summary',
        });
        const active = data.find(turn => turn.status === 'inProgress');
        if (!active) throw new Error('The active turn changed before delivery. Inspect the session before retrying.');
        submitted = true;
        const result = await rpc.call<{ turnId: string }>('turn/steer', {
          threadId: binding.threadId, expectedTurnId: active.id, input,
        });
        if (result.turnId !== active.id) throw new Error('Codex returned an unexpected turn identity.');
        return { mode: 'steer', turnId: result.turnId };
      }
      if (thread.status.type !== 'idle') throw new Error(`Cannot deliver to a session in state ${thread.status.type}.`);
      submitted = true;
      const result = await rpc.call<{ turn: Turn }>('turn/start', { threadId: binding.threadId, input });
      if (!result.turn?.id) throw new Error('Codex did not return a turn identity.');
      return { mode: 'start', turnId: result.turn.id };
    } catch (error) {
      throw new DeliveryError(
        error instanceof Error ? error.message : 'Codex delivery failed.',
        submitted && !(error instanceof RpcError) ? 'unknown' : 'failed',
      );
    } finally { rpc?.close(); }
  }
}
