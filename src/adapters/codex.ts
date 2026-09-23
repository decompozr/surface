import { discoverAgents } from './discovery.ts';
import { realpathSync } from 'node:fs';
import { CodexRpc, RpcError, type Rpc } from './rpc.ts';

export type Binding = { id: string; projectRoot: string; threadId: string; socketPath: string };
export type DeliveryIntent = { mode: 'queue' | 'steer' | 'start'; expectedStatus: string; expectedTurnId?: string };
export type Receipt = { mode: 'queue' | 'steer' | 'start'; turnId?: string; queuedSubmissionId?: string };
export type RecipientState = { status: string; turnId?: string };
export class DeliveryError extends Error {
  constructor(message: string, public outcome: 'failed' | 'unknown') { super(message); }
}
export interface AgentAdapter {
  discover?(binding: Binding): ReturnType<typeof discoverAgents>;
  inspect(binding: Binding): Promise<RecipientState>;
  deliver(binding: Binding, message: string, intent?: DeliveryIntent, responseId?: string): Promise<Receipt>;
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
  discover(binding: Binding) { return discoverAgents(binding.projectRoot, binding.socketPath, this.connect); }
  async inspect(binding: Binding) {
    const rpc = await this.connect(binding.socketPath);
    try {
      const thread = await this.read(rpc, binding);
      if (thread.status.type !== 'active') return { status: thread.status.type };
      const { data } = await rpc.call<{ data: Turn[] }>('thread/turns/list', { threadId: binding.threadId, limit: 5, sortDirection: 'desc', itemsView: 'summary' });
      return { status: 'active', turnId: data.find(turn => turn.status === 'inProgress')?.id };
    }
    finally { rpc.close(); }
  }
  async deliver(binding: Binding, message: string, intent?: DeliveryIntent, responseId?: string): Promise<Receipt> {
    let rpc: Rpc | undefined;
    let submitted = false;
    try {
      rpc = await this.connect(binding.socketPath);
      let thread = await this.read(rpc, binding);
      if (intent && thread.status.type !== intent.expectedStatus) throw new Error('Recipient state changed. Refresh and confirm delivery mode again.');
      if (!intent && thread.status.type === 'active') throw new Error('Choose queue or steer explicitly for an active recipient.');
      if (intent && ((thread.status.type === 'active') !== (intent.mode !== 'start'))) throw new Error('Delivery mode does not match recipient state.');
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
        if (!active || (intent?.expectedTurnId && active.id !== intent.expectedTurnId)) throw new Error('The active turn changed before delivery. Inspect the session before retrying.');
        if (intent?.mode === 'queue') {
          submitted = true;
          const result = await rpc.call<{ queuedSubmission: { id: string } }>('thread/queue/add', {
            threadId: binding.threadId, input, clientUserMessageId: responseId ?? crypto.randomUUID(),
          });
          if (!result.queuedSubmission?.id) throw new Error('Codex did not return a queue identity.');
          return { mode: 'queue', queuedSubmissionId: result.queuedSubmission.id };
        }
        if (intent?.mode !== 'steer' || !intent.expectedTurnId) throw new Error('Confirm the exact active turn before steering.');
        submitted = true;
        const result = await rpc.call<{ turnId: string }>('turn/steer', {
          threadId: binding.threadId, expectedTurnId: active.id, input,
        });
        if (result.turnId !== active.id) throw new Error('Codex returned an unexpected turn identity.');
        return { mode: 'steer', turnId: result.turnId };
      }
      if (thread.status.type !== 'idle') throw new Error(`Cannot deliver to a session in state ${thread.status.type}.`);
      submitted = true;
      const result = await rpc.call<{ turn: Turn }>('turn/start', { threadId: binding.threadId, input, clientUserMessageId: responseId });
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
