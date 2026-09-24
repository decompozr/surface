import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { commentEvent, type StoredComment } from './event.ts';
import { Service, InputError } from '../core/service.ts';
import { Store } from '../core/store.ts';
import { CodexAdapter, type AgentAdapter, type Binding } from '@decompozr/surface-agent-adapters/codex';
import type { Batch } from '../../comment-experiment/model.ts';

export type Connection = { threadId: string; projectRoot: string; socketPath: string; label: string; token: string; callbackToken: string; origin: string; resultCli: string; resultPath?: string };
export class UnsubmittedCommentError extends Error {}
export class CommentDelivery {
  readonly service: Service;
  private binding?: Binding;
  private initializing?: Promise<Binding>;
  private submissions = new Map<string, { data: unknown; operation: Promise<unknown> }>();
  constructor(readonly directory: string, readonly connection: Connection, private adapter: AgentAdapter = new CodexAdapter()) {
    this.service = new Service(new Store(join(directory, 'interactions.json')), adapter, connection.resultCli, directory, undefined,
      ({ requestId, data }) => JSON.stringify(commentEvent(requestId, data.comments as StoredComment[], directory, connection.projectRoot)));
  }
  async bind() {
    this.initializing ??= this.service.bind(this.connection).then(binding => { this.binding = binding; return binding; }).catch(error => { this.initializing = undefined; throw error; });
    return this.initializing;
  }
  async inspect() {
    const binding = await this.bind();
    return this.adapter.inspect(binding);
  }
  async submit(batch: Batch, beforeSubmit?: () => void) {
    const binding = await this.bind();
    if (batch.recipient !== `codex:${binding.threadId}`) throw new Error('The batch recipient differs from the bound conversation.');
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
    let data: Record<string, unknown> = { batchId: batch.id, page: batch.page, revision: batch.revision, createdAt: batch.createdAt, comments };
    let request = this.service.store.state.requests.find(item => item.runtimeId === `comments:${batch.id}`);
    if (!request) request = this.service.create({ bindingId: binding.id, title: 'Surface element comments', runtimeId: `comments:${batch.id}`, schema: { type: 'object' } });
    // Older records retain their original verbose data for audit/deduplication.
    // An identical old submission can be inspected, never re-delivered.
    if (request.response) {
      const { handling: _handling, handlingPreference: _preference, imageInstructions: _images, ...original } = request.response.data;
      if (isDeepStrictEqual(original, data)) data = request.response.data;
    }
    const identity = { data, delivery: batch.delivery };
    const pending = this.submissions.get(batch.id);
    if (pending) {
      if (!isDeepStrictEqual(pending.data, identity)) throw new Error('This batch already has a submission with different data.');
      await pending.operation;
      return this.view(batch.id);
    }
    const operation = this.service.submit(request.id, { responseId: batch.id, data, delivery: batch.delivery }, beforeSubmit);
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
