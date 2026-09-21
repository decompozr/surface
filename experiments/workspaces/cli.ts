import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { projectMain } from '../../src/cli/projects.ts';
import { workspaceDirectory } from './identity.ts';

export async function retire(stateDir: string, id: string) {
  const config = JSON.parse(readFileSync(join(stateDir, 'workspace-host.json'), 'utf8'));
  const directory = workspaceDirectory(stateDir, config.dataRoot), previous = directory.get(id);
  if (previous.status === 'retired') return { workspace: previous, runtimeRetired: true, dataPreserved: true };
  const connection = JSON.parse(readFileSync(join(stateDir, 'connection.json'), 'utf8'));
  const origin = new URL(connection.origin);
  if (origin.protocol !== 'http:' || origin.hostname !== '127.0.0.1' || origin.origin !== connection.origin || origin.username || origin.password) throw new Error('Invalid local connection.');
  const api = async (path: string, input?: unknown) => {
    const response = await fetch(origin.origin + path, { method: input === undefined ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(30_000), headers: { authorization: `Bearer ${connection.token}`, 'content-type': 'application/json' }, body: input === undefined ? undefined : JSON.stringify(input) });
    const data = await response.json(); if (!response.ok) throw new Error(JSON.stringify(data)); return data;
  };
  // Retiring blocks future resource admission before queued existing mounts are drained by unmount.
  const workspace = directory.transition(id, 'retiring');
  const mounts = await api('/api/mounts') as { namespace: string; name: string; status: string }[];
  for (const mount of mounts.filter(m => m.namespace === workspace.namespace && m.status !== 'unmounted')) {
    const result = await api('/api/unmount', { namespace: mount.namespace, name: mount.name });
    if (result.status !== 'unmounted') throw new Error('Workspace cleanup incomplete; retry after inspecting runtime failure.');
  }
  const requests = await api('/api/requests') as { previewScope?: { namespace: string }; response?: { status: string }; result?: unknown }[];
  if (requests.some(r => r.previewScope?.namespace === workspace.namespace && r.response && ['accepted', 'delivering', 'unknown'].includes(r.response.status) && r.result === undefined)) throw new Error('Unresolved workspace interaction; reconcile its original session before removing the worktree. Workspace remains retiring.');
  return { workspace: directory.transition(id, 'retired'), runtimeRetired: true, dataPreserved: true, sourceDeleted: false };
}
if (import.meta.main) {
  try {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: { 'state-dir': { type: 'string' }, project: { type: 'string' }, artifact: { type: 'string' }, source: { type: 'string' }, name: { type: 'string' }, workspace: { type: 'string' } } });
    const stateDir = resolve(values['state-dir'] ?? process.env.SURFACE_STATE_DIR ?? (() => { throw new Error('Select the shared service with --state-dir or SURFACE_STATE_DIR.'); })());
    if (positionals[0] === 'retire') { if (!values.workspace) throw new Error('Specify --workspace ID.'); console.log(JSON.stringify(await retire(stateDir, values.workspace), null, 2)); }
    else {
      const args = [positionals[0] ?? 'list', '--project', resolve(values.project ?? process.cwd()), '--state-dir', stateDir];
      for (const field of ['artifact', 'source', 'name'] as const) if (values[field]) args.push('--' + field, values[field]);
      await projectMain(args, stateDir);
    }
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
