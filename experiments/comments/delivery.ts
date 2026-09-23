import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { shortRequestId } from './reply-id';
import { Service } from '../../src/core/service';
import { Store } from '../../src/core/store';
import { CodexAdapter, type AgentAdapter, type Binding } from '../../src/adapters/codex';
import type { Batch } from '../../apps/surface/src/lib/comment-experiment/model';

export type Connection = { threadId: string; projectRoot: string; socketPath: string; label: string; token: string; callbackToken: string; origin: string; resultCli: string };
export class CommentDelivery {
  readonly service: Service;
  private binding?: Binding;
  private initializing?: Promise<Binding>;
  constructor(readonly directory: string, readonly connection: Connection, private adapter: AgentAdapter = new CodexAdapter()) {
    this.service = new Service(new Store(join(directory, 'interactions.json')), adapter, connection.resultCli, directory, id => `bun run reply ${shortRequestId(id, this.service.store.state.requests)} 'Your response'`);
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
    const data = { batchId: batch.id, page: batch.page, revision: batch.revision, createdAt: batch.createdAt, comments,
      imageInstructions: 'Attached capture.imagePath values identify local PNG files. Inspect them with the image tool before interpreting visual feedback.' };
    let request = this.service.store.state.requests.find(item => item.runtimeId === `comments:${batch.id}`);
    if (!request) request = this.service.create({ bindingId: binding.id, title: 'Surface element comments', runtimeId: `comments:${batch.id}`, schema: { type: 'object' } });
    await this.service.submit(request.id, { responseId: batch.id, data });
    return this.view(batch.id);
  }
  view(batchId: string) {
    const request = this.service.store.state.requests.find(item => item.runtimeId === `comments:${batchId}`);
    if (!request) return null;
    return { batchId, requestId: request.id, destination: `codex:${this.connection.threadId}`, status: request.response?.status ?? 'pending',
      receipt: request.response?.receipt?.turnId, error: request.response?.error, result: request.result };
  }
}
