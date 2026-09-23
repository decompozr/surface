import assert from 'node:assert/strict';
const origin = process.env.COMMENTS_ORIGIN ?? 'http://127.0.0.1:4387';
const batch = { id: 'automated-fixture-check', createdAt: '2026-09-23T00:00:00Z', page: '/experiments/comments', revision: 'comment-playground-v1', recipient: 'local-fixture', status: 'pending', comments: [{ id: 'test-comment', target: { id: 'headline', label: 'Heading', selector: '#headline', text: 'Example', revision: 'comment-playground-v1' }, text: 'Automated local fixture check.' }] };
const send = (data: unknown, requestOrigin = origin) => fetch(`${origin}/experiments/comments/batch`, { method: 'POST', headers: { origin: requestOrigin, 'content-type': 'application/json' }, body: JSON.stringify(data) });
assert.equal((await fetch(`${origin}/experiments/comments`)).status, 200);
const first = await send(batch); assert.equal(first.status, 200); const receipt = await first.json();
assert.equal(receipt.destination, 'local-fixture'); assert.equal(receipt.received, 1);
assert.deepEqual(await (await send(batch)).json(), receipt);
assert.equal((await send(batch, 'https://unrelated.invalid')).status, 403);
assert.ok([400, 401, 404].includes((await send({ ...batch, recipient: 'real-agent' })).status)); // Invalid/unauthorized recipients never reach an adapter.
assert.equal((await send({ ...batch, comments: [] })).status, 400);
assert.equal((await send({ padding: 'x'.repeat(8_000_001) })).status, 413);
console.log('PASS: page, fixture receipt, deterministic retry, origin, recipient, empty batch, body limit. No agent contacted.');
