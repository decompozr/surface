import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { startSingleton } from '../../apps/surface/runtime/server.ts';

type Handler = (req: IncomingMessage, res: ServerResponse, next?: () => void) => void;
/** Built Kit application handler + one live Vite component compiler, sharing one listener. */
export async function startKitFoundation(options: Parameters<typeof startSingleton>[0]) {
  const build = join(import.meta.dir, 'build/handler.js');
  if (!existsSync(build)) throw new Error('Build the SvelteKit shell first: bun run --cwd experiments/sveltekit build');
  const { handler } = await import(pathToFileURL(build).href) as { handler: Handler };
  return startSingleton({ ...options, async application(req, res) {
    if (await options.application?.(req, res)) return true;
    const path = new URL(req.url!, 'http://127.0.0.1').pathname;
    if (path !== '/' && !/^\/(manage|kit-api)(\/|$)/.test(path) && !path.startsWith('/_app/')) return false;
    (req as IncomingMessage & { artifactStateDir: string }).artifactStateDir = resolve(options.stateDir);
    handler(req, res);
    return true;
  } });
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { 'state-dir': { type: 'string' }, port: { type: 'string' } } });
  const port = Number(values.port ?? 4319);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port.');
  const app = await startKitFoundation({ stateDir: resolve(values['state-dir'] ?? join(import.meta.dir, '../../.decompozr/surface/sveltekit')), port });
  console.log(JSON.stringify({ status: 'ready', origin: app.origin, pid: app.pid, instanceId: app.instanceId, application: 'built-sveltekit', compiler: 'vite-development' }));
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void app.stop().then(() => process.exit(0)); });
}
