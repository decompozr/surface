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
  const [reference, message, ...extra] = process.argv.slice(2);
  if (!reference || !message || extra.length) throw new Error('Usage: bun run reply REQUEST "Your response" (use - to read text from stdin)');
  // Resolve against this checkout, never a global default or the latest request.
  stateDir = resolve(import.meta.dir, '../../../.decompozr/surface/comments-preview');
  const state = JSON.parse(readFileSync(join(stateDir, 'interactions.json'), 'utf8'));
  const config = JSON.parse(readFileSync(join(stateDir, 'connection.json'), 'utf8'));
  requestId = resolveRequestId(reference, state.requests);
  const request = state.requests.find((r: { id: string }) => r.id === requestId);
  const binding = state.bindings.find((b: { id: string }) => b.id === request.bindingId);
  if (!binding || binding.threadId !== config.threadId || binding.projectRoot !== config.projectRoot) throw new Error('The request belongs to a different conversation or workspace.');
  result = { message: message === '-' ? await Bun.stdin.text() : message };
}
const config = JSON.parse(readFileSync(join(stateDir, 'connection.json'), 'utf8'));
const response = await fetch(`${config.origin}/experiments/comments/result`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${config.callbackToken}` }, body: JSON.stringify({ requestId, result }) });
if (!response.ok) throw new Error(`Result publication failed (${response.status})`);
console.log(await response.text());
