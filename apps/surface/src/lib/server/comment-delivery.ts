import { env } from '$env/dynamic/private';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { error } from '@sveltejs/kit';
import { CommentDelivery, type Connection } from '../../../../../experiments/comments/delivery';
let live: CommentDelivery | undefined;
export function delivery() {
  if (!env.SURFACE_COMMENTS_STATE_DIR) return undefined;
  live ??= new CommentDelivery(env.SURFACE_COMMENTS_STATE_DIR, JSON.parse(readFileSync(join(env.SURFACE_COMMENTS_STATE_DIR, 'connection.json'), 'utf8')) as Connection);
  return live;
}
export function authorize(request: Request, callback = false) {
  const bridge = delivery();
  if (!bridge) error(404);
  const supplied = Buffer.from(request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '');
  const expected = Buffer.from(callback ? bridge.connection.callbackToken : bridge.connection.token);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) error(401, 'Open the private connection link to send comments to this conversation.');
  return bridge;
}
