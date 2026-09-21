import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { startKitFoundation } from '../sveltekit/server.ts';
import { backendRuntime } from '../server-contract/server.ts';
import { workspaceDirectory } from './identity.ts';
import { parseArgs } from 'node:util';

export async function startWorkspaceHost(options: Parameters<typeof startKitFoundation>[0] & { dataRoot: string }) {
  if (existsSync(join(options.stateDir, 'project-bindings.json'))) throw new Error('Existing single-root project bindings require an explicit workspace migration; use isolated experiment state.');
  const directory = workspaceDirectory(options.stateDir, options.dataRoot);
  async function context(mount: { projectRoot: string; namespace: string }) {
    const manifest = JSON.parse(readFileSync(join(mount.projectRoot, 'artifact.project.json'), 'utf8'));
    const workspace = await directory.locate(mount.projectRoot, manifest);
    if (workspace.namespace !== mount.namespace) throw new Error('Mount namespace does not belong to the registered workspace.');
    return { dataDirectory: workspace.dataDirectory, workspaceId: workspace.id, projectId: manifest.projectId };
  }
  const backend = backendRuntime(options.stateDir, context);
  const config = join(options.stateDir, 'workspace-host.json');
  if (existsSync(config) && JSON.parse(readFileSync(config, 'utf8')).dataRoot !== resolve(options.dataRoot)) throw new Error('Data-root change requires explicit migration.');
  const app = await startKitFoundation({ ...options, projectIdentity: directory.identity, application: backend.application,
    async openMountResource(mount) { await context(mount); return backend.openMountResource(mount); },
  });
  try { writeFileSync(config, JSON.stringify({ version: 1, dataRoot: resolve(options.dataRoot) }), { mode: 0o600 }); }
  catch (error) { await app.stop(); throw error; }
  return app;
}
if (import.meta.main) {
  const { values } = parseArgs({ options: { 'state-dir': { type: 'string' }, 'data-root': { type: 'string' }, port: { type: 'string' } } });
  if (!values['state-dir'] || !values['data-root']) throw new Error('Specify shared --state-dir and persistent project --data-root.');
  const app = await startWorkspaceHost({ stateDir: resolve(values['state-dir']), dataRoot: resolve(values['data-root']), port: Number(values.port ?? 0) });
  console.log(JSON.stringify({ origin: app.origin, pid: app.pid }));
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => void app.stop().then(() => process.exit(0)));
}
