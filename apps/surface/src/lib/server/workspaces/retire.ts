import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { workspaceDirectory } from './identity.ts';


export const retire = async (stateDir: string, id: string) => {
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
};
