import { commentReply } from '$lib/server/comments/result';
import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { authorize } from '$lib/server/comment-delivery';

export const POST = async ({ request }) => {
  if (env.SURFACE_COMMENTS_EXPERIMENT !== '1') error(404);
  const bridge = authorize(request, true);
  const text = await request.text();
  if (text.length > 50000) error(413);
  let reply;
  try { reply = commentReply(JSON.parse(text)); }
  catch { error(400, 'Invalid comment reply.'); }
  return json(bridge.service.result(reply.requestId, reply.result));
};
