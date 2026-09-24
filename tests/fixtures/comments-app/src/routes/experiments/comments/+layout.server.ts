import { env } from '$env/dynamic/private';
import { delivery } from '$lib/server/comment-delivery';
import { error } from '@sveltejs/kit';
import { allowsCommentOrigin } from '$lib/comments/access';

export const load = ({ url }) => {
  if (env.SURFACE_COMMENTS_EXPERIMENT !== '1') error(404);
  if (!allowsCommentOrigin(url, env.SURFACE_COMMENTS_ORIGIN)) error(403, 'Experiment origin is not enabled.');
  const bridge = delivery();
  return { recipient: bridge ? `codex:${bridge.connection.threadId}` : 'local-fixture', label: bridge?.connection.label ?? 'Local test', live: !!bridge }; 
};
