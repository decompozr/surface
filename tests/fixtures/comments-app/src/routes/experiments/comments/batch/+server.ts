import { UnsubmittedCommentError } from '../../../../lib/server/comments/delivery.ts';
import { authorize } from '$lib/server/comment-delivery';
import { env } from '$env/dynamic/private';
import { error, json } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import { allowsCommentOrigin } from '$lib/comments/access';
import { validateBatch } from '$lib/comments/validate';


// A deterministic local receipt, not an agent adapter or a real conversation.
export const POST = async ({ request, url }) => {
  if (env.SURFACE_COMMENTS_EXPERIMENT !== '1') error(404);
  if (!allowsCommentOrigin(url, env.SURFACE_COMMENTS_ORIGIN) || request.headers.get('origin') !== url.origin) error(403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) error(415);
  const reader = request.body?.getReader();
  if (!reader) error(400);
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8_000_000) { await reader.cancel(); error(413, 'Batch exceeds the experiment limit.'); }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  let batch: unknown;
  try { batch = JSON.parse(raw); } catch { error(400, 'Invalid JSON'); }
  if ((batch as { recipient?: string })?.recipient !== 'local-fixture') {
    const bridge = authorize(request);
    if (!validateBatch(batch, `codex:${bridge.connection.threadId}`)) error(400, 'Invalid comment batch');
    try { return json(await bridge.submit(batch)); }
    catch (cause) { return json({ message: cause instanceof Error ? cause.message : 'Delivery failed.', notSubmitted: cause instanceof UnsubmittedCommentError }, { status: 409 }); }
  }
  if (!validateBatch(batch)) error(400, 'Invalid comment batch');
  const receipt = createHash('sha256').update(raw).digest('hex').slice(0, 16);
  return json({ batchId: batch.id, receipt: `fixture-${receipt}`, received: batch.comments.length, destination: 'local-fixture', message: 'Local fixture received this batch. No real agent was contacted.' });
};


export const GET = async ({ request, url }) => {
  if (env.SURFACE_COMMENTS_EXPERIMENT !== '1') error(404);
  if (!allowsCommentOrigin(url, env.SURFACE_COMMENTS_ORIGIN)) error(403);
  const bridge = authorize(request);
  const batchId = url.searchParams.get('id');
  if (batchId) return json(bridge.view(batchId));
  try { return json({ available: true, ...await bridge.inspect(), recipient: `codex:${bridge.connection.threadId}` }); }
  catch { return json({ available: false, status: 'unavailable' }); }
};
