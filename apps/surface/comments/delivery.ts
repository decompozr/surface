import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { shortRequestId } from './reply-id';
import { Service, InputError } from '../src/core/service';
import { Store } from '../src/core/store';
import { CodexAdapter, type AgentAdapter, type Binding } from '../src/adapters/codex';
import type { Batch } from '../src/lib/comment-experiment/model';

export type Connection = { threadId: string; projectRoot: string; socketPath: string; label: string; token: string; callbackToken: string; origin: string; resultCli: string };
export class UnsubmittedCommentError extends Error {}
export class CommentDelivery {
  readonly service: Service;
  private binding?: Binding;
  private initializing?: Promise<Binding>;
  private submissions = new Map<string, { data: unknown; operation: Promise<unknown> }>();
  constructor(readonly directory: string, readonly connection: Connection, private adapter: AgentAdapter = new CodexAdapter()) {
    this.service = new Service(new Store(join(directory, 'interactions.json')), adapter, connection.resultCli, directory, id => {
      const request = this.service.store.state.requests.find(item => item.id === id);
      if (!request?.response?.data.handling) return `bun run reply ${shortRequestId(id, this.service.store.state.requests)} 'Your response'`;
      const quote = (value: string) => "'" + value.replaceAll("'", "'\"'\"'") + "'";
      return `bun ${quote(connection.resultCli)} result --state-dir ${quote(directory)} --request ${id} --data '${JSON.stringify({ stage: 'acknowledged', message: 'Your acknowledgement and next action', next: 'continue-original' })}'`;
    });
  }
  async bind() {
    this.initializing ??= this.service.bind(this.connection).then(binding => { this.binding = binding; return binding; }).catch(error => { this.initializing = undefined; throw error; });
    return this.initializing;
  }
  async inspect() {
    const binding = await this.bind();
    return this.adapter.inspect(binding);
  }
  async submit(batch: Batch) {
    const binding = await this.bind();
    if (batch.recipient !== `codex:${binding.threadId}`) throw new Error('The batch recipient differs from the bound conversation.');
    if (batch.handling && (!batch.delivery || (batch.delivery.mode !== 'start' && batch.delivery.mode !== (batch.handling === 'by-the-way' ? 'steer' : 'queue')))) throw new Error('Refresh and confirm comment delivery mode.');
    const comments = batch.comments.map(comment => {
      if (!comment.capture) return comment;
      const { png, ...capture } = comment.capture;
      const bytes = Buffer.from(png.split(',')[1], 'base64');
      if (!bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('The screenshot is not a PNG.');
      const images = join(this.directory, 'images'); mkdirSync(images, { recursive: true, mode: 0o700 });
      const imagePath = join(images, `${createHash('sha256').update(bytes).digest('hex')}.png`);
      writeFileSync(imagePath, bytes, { mode: 0o600 });
      return { ...comment, capture: { ...capture, imagePath } };
    });
    const data = { ...(batch.handling ? { handling: batch.handling, handlingPreference: batch.handling === 'by-the-way'
      ? 'This is by-the-way feedback. Briefly acknowledge receipt and say whether you will continue the original task, address this now, or handle it later. Preserve the original objective unless the user explicitly replaces or cancels it. Publish an initial acknowledgement with stage=acknowledged, message, and next=continue-original|address-now|later using the exact reply command, then publish stage=completed with the actual outcome when done.'
      : 'Handle this feedback after the current task. Preserve the existing objective. When you begin, acknowledge the feedback through the exact reply command with stage=acknowledged and message, then publish stage=completed with the actual outcome when done.' } : {}), batchId: batch.id, page: batch.page, revision: batch.revision, createdAt: batch.createdAt, comments,
      imageInstructions: 'Attached capture.imagePath values identify local PNG files. Inspect them with the image tool before interpreting visual feedback.' };
    let request = this.service.store.state.requests.find(item => item.runtimeId === `comments:${batch.id}`);
    if (!request) request = this.service.create({ bindingId: binding.id, title: 'Surface element comments', runtimeId: `comments:${batch.id}`, schema: { type: 'object' } });
    const identity = { data, delivery: batch.delivery };
    const pending = this.submissions.get(batch.id);
    if (pending) {
      if (!isDeepStrictEqual(pending.data, identity)) throw new Error('This batch already has a submission with different data.');
      await pending.operation;
      return this.view(batch.id);
    }
    const operation = this.service.submit(request.id, { responseId: batch.id, data, delivery: batch.delivery });
    this.submissions.set(batch.id, { data: identity, operation });
    try { await operation; return this.view(batch.id); }
    catch (cause) {
      // Only positively identified preflight rejection permits restoring an unsent draft.
      if (!request.response && cause instanceof InputError && /^(Recipient unavailable\.|Recipient state changed\.|Choose queue or steer explicitly|Confirm delivery mode)/.test(cause.message)) throw new UnsubmittedCommentError(cause.message);
      throw cause;
    }
    finally { this.submissions.delete(batch.id); }
  }
  view(batchId: string) {
    const request = this.service.store.state.requests.find(item => item.runtimeId === `comments:${batchId}`);
    if (!request) return null;
    return { batchId, requestId: request.id, destination: `codex:${this.connection.threadId}`, status: request.response?.status ?? 'pending',
      receipt: request.response?.receipt?.turnId ?? request.response?.receipt?.queuedSubmissionId, deliveryMode: request.response?.receipt?.mode, queuedSubmissionId: request.response?.receipt?.queuedSubmissionId, error: request.response?.error, result: request.result };
  }
}
