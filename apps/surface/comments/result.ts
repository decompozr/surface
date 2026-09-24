import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { resolveRequestId } from './reply-id';

let stateDir: string, requestId: string, result: unknown;
if (process.argv[2] === 'result') {
  // Retain already-issued callback commands.
  const { values } = parseArgs({ args: process.argv.slice(3), options: { 'state-dir': { type: 'string' }, request: { type: 'string' }, data: { type: 'string' } } });
  if (!values['state-dir'] || !values.request || !values.data) throw new Error('Use result --state-dir PATH --request ID --data JSON');
  stateDir = values['state-dir']; requestId = values.request; result = JSON.parse(values.data);
} else {
  const { values, positionals } = parseArgs({ args: process.argv.slice(2), allowPositionals: true,
    options: { 'state-dir': { type: 'string' }, inspect: { type: 'boolean' }, ack: { type: 'boolean' } } });
  const [reference, message, ...extra] = positionals;
  if (!reference || extra.length || (values.inspect ? message !== undefined || values.ack : !message)) throw new Error('Usage: bun run reply REQUEST "Reply" [--ack] [--state-dir PATH], or REQUEST --inspect');
  // Resolve against this checkout or the event's explicit replyTo, never the latest request.
  stateDir = values['state-dir'] ? resolve(values['state-dir']) : resolve(import.meta.dir, '../../../.decompozr/surface/comments-preview');
  const state = JSON.parse(readFileSync(join(stateDir, 'interactions.json'), 'utf8'));
  const config = JSON.parse(readFileSync(join(stateDir, 'connection.json'), 'utf8'));
  requestId = resolveRequestId(reference, state.requests);
  const request = state.requests.find((r: { id: string }) => r.id === requestId);
  const binding = state.bindings.find((b: { id: string }) => b.id === request.bindingId);
  if (!binding || binding.threadId !== config.threadId || binding.projectRoot !== config.projectRoot) throw new Error('The request belongs to a different conversation or workspace.');
  if (values.inspect) {
    console.log(JSON.stringify({ requestId, title: request.title, responseId: request.response?.id, status: request.response?.status,
      delivery: request.response?.delivery, context: request.response?.data, result: request.result }));
    process.exit(0);
  }
  if (values.ack && request.result && request.result.stage !== 'acknowledged') throw new Error('This request already has a completed reply; do not acknowledge it again.');
  result = { message: message === '-' ? await Bun.stdin.text() : message, stage: values.ack ? 'acknowledged' : 'completed' };
}
const config = JSON.parse(readFileSync(join(stateDir, 'connection.json'), 'utf8'));
const response = await fetch(`${config.origin}${config.resultPath ?? '/experiments/comments/result'}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${config.callbackToken}` }, body: JSON.stringify({ requestId, result }) });
if (!response.ok) throw new Error(`Result publication failed (${response.status})`);
const published = await response.json();
console.log(JSON.stringify({ requestId: published.requestId, stage: published.result?.stage ?? 'completed' }));
