import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { startSingleton } from '../../../experiments/singleton/server.ts';
import type { RuntimeStatus } from '../src/lib/runtime-status.ts';

type Handler = (request: IncomingMessage, response: ServerResponse) => void;

/** Integration slice: the built app and the existing component compiler share one listener. */
export async function startSurfaceApp(options: { stateDir: string; port?: number }) {
  const port = options.port ?? 4319;
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port.');
  if (!options.stateDir) throw new Error('Specify an isolated state directory.');
  const build = join(import.meta.dir, '../build/handler.js');
  if (!existsSync(build)) throw new Error('Build the app first: bun run build');
  const { handler } = await import(pathToFileURL(build).href) as { handler: Handler };
  let status: RuntimeStatus | undefined;

  const runtime = await startSingleton({
    stateDir: resolve(options.stateDir), port,
    async application(request, response) {
      const path = new URL(request.url!, 'http://127.0.0.1').pathname;
      if (path !== '/' && path !== '/health' && !path.startsWith('/_app/')) return false;
      (request as IncomingMessage & { surfaceRuntime?: RuntimeStatus }).surfaceRuntime = status;
      handler(request, response);
      return true;
    },
  });
  status = { pid: runtime.pid, instanceId: runtime.instanceId, compiler: 'vite-development' };
  return runtime;
}
