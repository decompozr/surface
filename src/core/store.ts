import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { RuntimeDefinition } from './runtime.ts';
import type { Binding, Receipt } from '../adapters/codex.ts';

export type RequestRecord = {
  id: string; bindingId: string; title: string; token: string; schema: Record<string, unknown>;
  runtimeId?: string; previewPath?: string; createdAt: string; closed: boolean; response?: ResponseRecord; result?: Record<string, unknown>;
};
export type ResponseRecord = {
  id: string; data: Record<string, unknown>; createdAt: string;
  status: 'delivering' | 'accepted' | 'failed' | 'unknown';
  receipt?: Receipt; error?: string;
};
export type State = { version: 1; bindings: Binding[]; requests: RequestRecord[]; runtimes: RuntimeDefinition[] };

/** Single-server prototype store. The server holds an exclusive lock for this directory. */
export class Store {
  state: State;
  constructor(private file: string) {
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    try { this.state = JSON.parse(readFileSync(file, 'utf8')); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      this.state = { version: 1, bindings: [], requests: [], runtimes: [] };
    }
    if (this.state.version !== 1 || !Array.isArray(this.state.bindings) || !Array.isArray(this.state.requests)) {
      throw new Error('Unsupported or invalid Artifact state file.');
    }
    this.state.runtimes ??= [];
    if (!Array.isArray(this.state.runtimes)) throw new Error('Invalid runtime registry.');
    this.update(state => {
      for (const request of state.requests) {
        if (request.response?.status === 'delivering') {
          request.response.status = 'unknown';
          request.response.error = 'The service stopped during delivery. Do not retry without reconciling the agent session.';
        }
      }
    });
  }
  update<T>(operation: (state: State) => T): T {
    const next = structuredClone(this.state);
    const result = operation(next);
    const temporary = this.file + '.tmp';
    writeFileSync(temporary, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
    renameSync(temporary, this.file);
    this.state = next;
    return result;
  }
}
