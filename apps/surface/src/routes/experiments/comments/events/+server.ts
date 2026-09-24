import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import { authorize } from '$lib/server/comment-delivery';
import { allowsCommentOrigin } from '$lib/comment-experiment/access';


export const GET = async ({ request, url }) => {
  if (env.SURFACE_COMMENTS_EXPERIMENT !== '1') error(404);
  if (!allowsCommentOrigin(url, env.SURFACE_COMMENTS_ORIGIN)) error(403);
  const bridge = authorize(request);
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const close = () => { if (closed) return; closed = true; cleanup(); controller.close(); };
      const send = (text: string) => {
        if (closed) return;
        if ((controller.desiredSize ?? 0) <= 0) { close(); return; }
        controller.enqueue(encoder.encode(text));
      };
      const snapshot = () => {
        const batches = bridge.service.store.state.requests
          .filter(item => item.runtimeId?.startsWith('comments:') &&
            bridge.service.store.state.bindings.some(binding => binding.id === item.bindingId && binding.threadId === bridge.connection.threadId && binding.projectRoot === bridge.connection.projectRoot))
          .map(item => bridge.view(item.runtimeId!.slice(9)));
        send('event: snapshot\ndata: ' + JSON.stringify({ batches }) + '\n\n');
      };
      const unsubscribe = bridge.service.store.subscribe(snapshot);
      const heartbeat = setInterval(() => send(': heartbeat\n\n'), 15000);
      cleanup = () => { unsubscribe(); clearInterval(heartbeat); request.signal.removeEventListener('abort', close); };
      request.signal.addEventListener('abort', close, { once: true });
      if (request.signal.aborted) { close(); return; }
      snapshot();
    },
    cancel() { cleanup(); }
  });
  return new Response(stream, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', 'x-accel-buffering': 'no' } });
};
