// A fresh fixture process: input is a durable checkpoint path, never parent memory.
// Produces a read-only disposition, not a generic recovery algorithm or retry.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2]!);
const read = (name: string) => JSON.parse(readFileSync(join(root, name), 'utf8'));
assert.equal(read('fixture.json').kind, 'surface-interrupted-delivery');
const checkpoint = read('checkpoint.json');
const connection = read('state/connection.json');
const url = new URL(connection.origin);
assert.equal(url.protocol, 'http:'); assert.equal(url.hostname, '127.0.0.1');
const response = await fetch(new URL(`/api/requests/${checkpoint.requestId}`, url), {
  headers: { authorization: `Bearer ${connection.token}` }, signal: AbortSignal.timeout(5000),
});
assert.ok(response.ok);
const record = await response.json();
const store = read('state/interactions.json');
const binding = store.bindings.find((item: { id: string }) => item.id === record.bindingId);
assert.equal(record.id, checkpoint.requestId);
assert.equal(binding.threadId, checkpoint.threadId);
assert.equal(binding.projectRoot, checkpoint.projectRoot);
assert.equal(record.response.id, checkpoint.submission.responseId);
assert.deepEqual(record.response.data, checkpoint.submission.data);
assert.deepEqual(record.response.delivery, checkpoint.submission.delivery);
assert.equal(record.response.status, 'unknown');
assert.equal(record.result, undefined);

const events = existsSync(join(root, 'provider.jsonl'))
  ? readFileSync(join(root, 'provider.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
for (const event of events) {
  assert.equal(event.requestId, checkpoint.requestId, 'Foreign request evidence');
  assert.equal(event.responseId, checkpoint.submission.responseId, 'Foreign response evidence');
  assert.equal(event.threadId, checkpoint.threadId, 'Foreign recipient evidence');
  assert.equal(event.payloadHash, createHash('sha256').update(JSON.stringify(checkpoint.submission.data)).digest('hex'));
}
const accepted = events.find(event => event.stage === 'accepted');
const completed = events.find(event => event.stage === 'completed');
let disposition = accepted ? 'unresolved-accepted-without-completion' : 'unresolved-no-provider-evidence';
if (completed) {
  assert.ok(accepted, 'Completion without an acceptance record');
  const bytes = readFileSync(join(checkpoint.projectRoot, 'applied.json'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), completed.outputHash);
  assert.deepEqual(JSON.parse(bytes.toString()), {
    requestId: checkpoint.requestId, responseId: checkpoint.submission.responseId, data: checkpoint.submission.data,
  });
  disposition = 'completed-with-matching-output';
}
console.log(JSON.stringify({ requestId: record.id, responseId: record.response.id,
  deliveryStatus: record.response.status, disposition, replayAllowed: false,
  resultPublicationSupported: Boolean(completed), providerAccepted: Boolean(accepted),
}));
