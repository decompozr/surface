import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync, realpathSync, lstatSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { join, resolve, relative, isAbsolute, dirname } from 'node:path';
import type { ProjectIdentityResolver, ProjectManifest } from '@decompozr/surface-contracts/projects';

export type Workspace = { id: string; root: string; gitDir: string; namespace: string; status: 'active' | 'retiring' | 'retired'; branch: string; dataDirectory: string; storage?: 'adopted' };
type Project = { id: string; commonDir: string; workspaces: Workspace[] };
type Ledger = { version: 1; dataRoot: string; projects: Project[] };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const inside = (parent: string, child: string) => { const path = relative(parent, child); return !path || (path !== '..' && !path.startsWith('..') && !isAbsolute(path)); };
function canonicalCandidate(path: string) {
  path = resolve(path); let ancestor = path;
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  if (realpathSync(ancestor) !== ancestor) throw new Error('Data root must use a canonical path without symlink indirection.');
  return path;
}
import { inspectGit } from '@decompozr/surface-agent-adapters/git';
export { inspectGit } from '@decompozr/surface-agent-adapters/git';
export function workspaceDirectory(stateDir: string, suppliedDataRoot: string) {
  stateDir = resolve(stateDir); const dataRoot = canonicalCandidate(suppliedDataRoot), file = join(stateDir, 'workspaces.json');
  function read(): Ledger {
    if (!existsSync(file)) return { version: 1, dataRoot, projects: [] };
    if (!lstatSync(file).isFile()) throw new Error('Workspace ledger must be a regular file.');
    const value: Ledger = JSON.parse(readFileSync(file, 'utf8'));
    if (value.version !== 1 || value.dataRoot !== dataRoot || !Array.isArray(value.projects)) throw new Error('Workspace ledger format or data-root mismatch.');
    const ids = new Set<string>(), namespaces = new Set<string>(), projectIds = new Set<string>();
    for (const p of value.projects) {
      if (!uuid.test(p.id) || projectIds.has(p.id) || !isAbsolute(p.commonDir) || !Array.isArray(p.workspaces)) throw new Error('Invalid project workspace ledger.');
      projectIds.add(p.id);
      for (const w of p.workspaces) {
        if (!uuid.test(w.id) || ids.has(w.id) || namespaces.has(w.namespace) || !/^[a-z0-9-]{1,64}$/.test(w.namespace) || !isAbsolute(w.root) || !isAbsolute(w.gitDir) || !['active','retiring','retired'].includes(w.status) || (w.storage === 'adopted' ? !isAbsolute(w.dataDirectory) : w.storage !== undefined || w.dataDirectory !== join(dataRoot, p.id, w.id))) throw new Error('Invalid workspace binding.');
        ids.add(w.id); namespaces.add(w.namespace);
      }
    }
    return value;
  }
  function update<T>(action: (ledger: Ledger) => T): T {
    mkdirSync(stateDir, { recursive: true, mode: 0o700 });
    const lock = join(stateDir, 'workspaces.lock'); let fd: number;
    try { fd = openSync(lock, 'wx', 0o600); } catch { throw new Error('Workspace ledger is locked; inspect its owner before recovery.'); }
    writeFileSync(fd, JSON.stringify({ pid: process.pid }));
    const temporary = file + '.' + crypto.randomUUID() + '.tmp';
    try { const ledger = read(), result = action(ledger); writeFileSync(temporary, JSON.stringify(ledger, null, 2) + '\n', { mode: 0o600, flag: 'wx' }); renameSync(temporary, file); return result; }
    finally { if (existsSync(temporary)) unlinkSync(temporary); closeSync(fd); unlinkSync(lock); }
  }
  async function locate(root: string, manifest: ProjectManifest, register = false, allowRetiring = false): Promise<Workspace> {
    const git = await inspectGit(root);
    if (git.roots.some(path => inside(existsSync(path) ? realpathSync(path) : resolve(path), dataRoot)) || inside(dataRoot, git.root)) throw new Error('Persistent project data root must be outside every Git worktree and cannot contain a worktree.');
    const inspect = (ledger: Ledger) => {
      let project = ledger.projects.find(p => p.id === manifest.projectId);
      if (project && project.commonDir !== git.commonDir) throw new Error('PROJECT_IDENTITY_CONFLICT: copied project UUID belongs to another Git repository.');
      if (ledger.projects.some(p => p.id !== manifest.projectId && p.workspaces.some(w => w.root === git.root && w.status !== 'retired'))) throw new Error('Project identity changed at an existing workspace root.');
      if (!project) { if (!register) throw new Error('Register this project workspace first.'); project = { id: manifest.projectId, commonDir: git.commonDir, workspaces: [] }; ledger.projects.push(project); }
      let workspace = project.workspaces.find(w => w.gitDir === git.gitDir && w.status !== 'retired');
      if (workspace && workspace.root !== git.root) throw new Error('Workspace relocation requires explicit reconciliation.');
      const markerPath = join(git.gitDir, 'surface-workspace.json'), markerStat = lstatSync(markerPath, { throwIfNoEntry: false });
      if (markerStat && !markerStat.isFile()) throw new Error('Workspace identity marker must be a regular Git-admin file.');
      const marker = markerStat ? JSON.parse(readFileSync(markerPath, 'utf8')) : undefined;
      if (workspace && (marker?.version !== 1 || marker.workspaceId !== workspace.id || marker.projectId !== project.id)) throw new Error('Workspace identity marker changed or vanished; recreation requires explicit reconciliation.');
      if (workspace && workspace.status !== 'active' && !allowRetiring) throw new Error('Workspace is retiring; new operations are blocked.');
      if (!workspace) {
        if (!register) throw new Error('Register this workspace first; retired identities are never implicitly revived.');
        if (project.workspaces.some(w => w.root === git.root && w.gitDir === git.gitDir && w.status === 'retired') && existsSync(git.root)) throw new Error('Retired workspace path requires explicit replacement reconciliation.');
        if (marker) throw new Error('Unbound workspace identity marker requires explicit reconciliation.');
        const id = crypto.randomUUID(), namespace = `p-${manifest.projectId.replaceAll('-', '')}-w-${id.replaceAll('-', '').slice(0,24)}`;
        if (ledger.projects.some(p => p.workspaces.some(w => w.namespace === namespace))) throw new Error('Workspace namespace collision.');
        workspace = { id, root: git.root, gitDir: git.gitDir, namespace, branch: git.branch, status: 'active', dataDirectory: join(dataRoot, manifest.projectId, id) };
        // A tiny identity marker distinguishes deletion/recreation of the same Git-admin path.
        // It is outside versioned source and contains no service state or capability.
        writeFileSync(markerPath, JSON.stringify({ version: 1, projectId: project.id, workspaceId: id }) + '\n', { mode: 0o600, flag: 'wx' });
        project.workspaces.push(workspace);
      }
      if (workspace.storage === 'adopted') {
        canonicalCandidate(workspace.dataDirectory);
        if (git.roots.some(path => inside(existsSync(path) ? realpathSync(path) : resolve(path), workspace!.dataDirectory))) throw new Error('Adopted data directory must stay outside worktrees.');
      }
      if (register) workspace.branch = git.branch;
      return workspace;
    };
    return register ? update(inspect) : inspect(read());
  }
  const identity: ProjectIdentityResolver = async (root, manifest, operation) => {
    const w = await locate(root, manifest, operation === 'register', operation === 'unmount' || operation === 'list');
    return { namespace: w.namespace, workspaceId: w.id };
  };
  return {
    identity, locate, snapshot: read,
    get(id: string) { const w = read().projects.flatMap(p => p.workspaces).find(w => w.id === id); if (!w) throw new Error('Unknown workspace identity.'); return w; },
    transition(id: string, status: 'retiring' | 'retired') {
      return update(ledger => {
        const w = ledger.projects.flatMap(p => p.workspaces).find(w => w.id === id); if (!w) throw new Error('Unknown workspace identity.');
        if (w.status === 'retired') { if (status !== 'retired') throw new Error('Workspace already retired.'); return w; }
        if (status === 'retired' && w.status !== 'retiring') throw new Error('Begin retirement before completing it.');
        w.status = status; return w;
      });
    },
  };
}
