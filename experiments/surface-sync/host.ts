import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { startKitFoundation } from '../sveltekit/server.ts';
import { backendRuntime } from './backends.ts';
import { workspaceDirectory } from '@decompozr/surface-app/server/workspaces/identity';
import { parseArgs } from 'node:util';


export const startSyncExperiment = async (options: Parameters<typeof startKitFoundation>[0] & { dataRoot?: string }) => {

  const context = async (mount: { projectRoot: string; namespace: string }) => {
    const manifest = JSON.parse(readFileSync(join(mount.projectRoot, 'artifact.project.json'), 'utf8'));
    const workspace = await directory.locate(mount.projectRoot, manifest);
    if (workspace.namespace !== mount.namespace) throw new Error('Mount namespace does not belong to the registered workspace.');
    return { dataDirectory: workspace.dataDirectory, workspaceId: workspace.id, projectId: manifest.projectId };
  };

  options.stateDir = resolve(options.stateDir);
  if (existsSync(join(options.stateDir, 'workspace-migration.pending.json'))) throw new Error('Workspace migration is incomplete; inspect and restore its backup before starting.');
  if (existsSync(join(options.stateDir, 'server.lock'))) throw new Error('Surface state is locked by a host or migration.');
  const saved = join(options.stateDir, 'workspace-host.json');
  const dataRoot = resolve(options.dataRoot ?? (existsSync(saved) ? JSON.parse(readFileSync(saved,'utf8')).dataRoot : join(dirname(options.stateDir),'project-data')));
  if (existsSync(join(options.stateDir, 'project-bindings.json'))) throw new Error('Existing single-root project bindings require migration: run surface workspace migrate, review its plan, then apply it explicitly.');
  const directory = workspaceDirectory(options.stateDir, dataRoot);
  const backend = backendRuntime(options.stateDir, context);
  const config = join(options.stateDir, 'workspace-host.json');
  if (existsSync(config) && JSON.parse(readFileSync(config, 'utf8')).dataRoot !== dataRoot) throw new Error('Data-root change requires explicit migration.');
  const app = await startKitFoundation({ ...options, projectIdentity: directory.identity, application: backend.application,
    async openMountResource(mount) { await context(mount); return backend.openMountResource(mount); },
  });
  try { writeFileSync(config, JSON.stringify({ version: 1, dataRoot: dataRoot }), { mode: 0o600 }); }
  catch (error) { await app.stop(); throw error; }
  return app;
};

if (import.meta.main) {
  const { values } = parseArgs({ options: { 'state-dir': { type: 'string' }, 'data-root': { type: 'string' }, port: { type: 'string' } } });
  if (!values['state-dir'] || !values['data-root']) throw new Error('Specify shared --state-dir and persistent project --data-root.');
  const app = await startSyncExperiment({ stateDir: resolve(values['state-dir']), dataRoot: resolve(values['data-root']), port: Number(values.port ?? 0) });
  console.log(JSON.stringify({ origin: app.origin, pid: app.pid }));
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => void app.stop().then(() => process.exit(0)));
}
