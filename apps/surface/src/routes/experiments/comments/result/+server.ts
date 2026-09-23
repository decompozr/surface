import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { authorize } from '$lib/server/comment-delivery';
export async function POST({ request }) {
  if (env.SURFACE_COMMENTS_EXPERIMENT !== '1') error(404);
  const bridge = authorize(request, true);
  const text = await request.text();
  if (text.length > 50000) error(413);
  const body = JSON.parse(text);
  if (typeof body.requestId !== 'string' || typeof body.result?.message !== 'string' || body.result.message.length > 20000) error(400);
  return json(bridge.service.result(body.requestId, { message: body.result.message }));
}
