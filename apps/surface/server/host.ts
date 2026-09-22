import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { startSingleton } from '../../../experiments/singleton/server.ts';
import { workspaceDirectory } from '../../../src/workspaces/identity.ts';
import type { AgentAdapter } from '../../../src/adapters/codex.ts';
import type { RuntimeStatus } from '../src/lib/runtime-status.ts';

import { readableMountPath } from './mount-path.ts';

type Handler = (request: IncomingMessage, response: ServerResponse) => void;

/** Integration slice: the built app and the existing component compiler share one listener. */
export async function startSurfaceApp(options: { stateDir: string; port?: number; dataRoot?: string; adapter?: AgentAdapter; browserOrigin?: string; application?: Parameters<typeof startSingleton>[0]['application']; openMountResource?: Parameters<typeof startSingleton>[0]['openMountResource'] }) {
  const port = options.port ?? 4319;
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port.');
  if (!options.stateDir) throw new Error('Specify an isolated state directory.');
  const build = join(import.meta.dir, '../build/handler.js');
  if (!existsSync(build)) throw new Error('Build the app first: bun run build');
  const { handler } = await import(pathToFileURL(build).href) as { handler: Handler };
  const stateDir = resolve(options.stateDir);
  if (existsSync(join(stateDir, 'workspace-migration.pending.json'))) throw new Error('Workspace migration is incomplete.');
  if (existsSync(join(stateDir, 'server.lock'))) throw new Error('Surface state is locked.');
  if (existsSync(join(stateDir, 'project-bindings.json'))) throw new Error('Legacy project bindings require explicit workspace migration.');
  const configuration = join(stateDir, 'workspace-host.json');
  const saved = existsSync(configuration) ? JSON.parse(readFileSync(configuration, 'utf8')) : undefined;
  const dataRoot = resolve(options.dataRoot ?? saved?.dataRoot ?? join(dirname(stateDir), 'project-data'));
  if (saved && saved.dataRoot !== dataRoot) throw new Error('Data-root change requires explicit migration.');
  const directory = workspaceDirectory(stateDir, dataRoot);
  let status: RuntimeStatus | undefined;

  const runtime = await startSingleton({
    stateDir, port, openMountResource: options.openMountResource, resolveMountPath: readableMountPath, browserOrigin: options.browserOrigin, adapter: options.adapter, projectIdentity: directory.identity,
    async application(request, response) {
      if (await options.application?.(request, response)) return true;
      const path = new URL(request.url!, 'http://127.0.0.1').pathname;
      if (path !== '/' && path !== '/health' && !path.startsWith('/_app/')) return false;
      (request as IncomingMessage & { surfaceRuntime?: RuntimeStatus }).surfaceRuntime = status;
      handler(request, response);
      return true;
    },
  });
  status = { pid: runtime.pid, instanceId: runtime.instanceId, compiler: 'vite-development' };
  try { writeFileSync(configuration, JSON.stringify({ version: 1, dataRoot }), { mode: 0o600 }); }
  catch (error) { await runtime.stop(); throw error; }
  return runtime;
}
