import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { resolveRequestId } from '@decompozr/surface-app/server/comments/reply-id';
import { replyEndpoint } from '@decompozr/surface-app/server/comments/reply-endpoint';

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    'state-dir': { type: 'string' },
    inspect: { type: 'boolean' },
    ack: { type: 'boolean' },
  },
});
const [reference, message, ...extra] = positionals;
if (!reference || extra.length || (values.inspect ? message !== undefined || values.ack : !message)) {
  throw new Error('Usage: bun run reply REQUEST "Reply" [--ack] [--state-dir PATH], or REQUEST --inspect');
}
// Resolve only against this checkout or the event's explicit replyTo.
const stateDir = values['state-dir']
  ? resolve(values['state-dir'])
  : resolve(import.meta.dir, '../../../.decompozr/surface/comments-preview');
const state = JSON.parse(readFileSync(join(stateDir, 'interactions.json'), 'utf8'));
const config = JSON.parse(readFileSync(join(stateDir, 'connection.json'), 'utf8'));
const requestId = resolveRequestId(reference, state.requests);
const request = state.requests.find((item: { id: string }) => item.id === requestId);
const binding = state.bindings.find((item: { id: string }) => item.id === request.bindingId);
if (!binding || binding.threadId !== config.threadId || binding.projectRoot !== config.projectRoot) {
  throw new Error('The request belongs to a different conversation or workspace.');
}
if (values.inspect) {
  console.log(JSON.stringify({
    requestId, title: request.title, responseId: request.response?.id,
    status: request.response?.status, delivery: request.response?.delivery,
    context: request.response?.data, result: request.result,
  }));
} else {
  if (values.ack && request.result && request.result.stage !== 'acknowledged') {
    throw new Error('This request already has a completed reply; do not acknowledge it again.');
  }
  const result = {
    message: message === '-' ? await Bun.stdin.text() : message,
    stage: values.ack ? 'acknowledged' : 'completed',
  };
  if (!result.message || result.message.length > 20_000) throw new Error('Reply must contain 1–20000 characters.');
  const response = await fetch(replyEndpoint(config), {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.callbackToken}` },
    body: JSON.stringify({ requestId, result }),
  });
  if (!response.ok) throw new Error(`Result publication failed (${response.status})`);
  const published = await response.json();
  console.log(JSON.stringify({ requestId: published.requestId, stage: published.result?.stage ?? 'completed' }));
}
