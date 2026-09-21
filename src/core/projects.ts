import { readFileSync, writeFileSync, renameSync, realpathSync, lstatSync, mkdirSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { join, resolve, relative, sep, isAbsolute, basename, normalize } from 'node:path';
import type { ProjectArtifact, ProjectManifest, ProjectMount, ProjectOperation, ProjectOperationInput, ProjectOutcome, ProjectRuntime, ProjectScope } from './project-contract.ts';

export const projectManifestName = 'artifact.project.json';
type Ledger = { version: 1; projects: { projectId: string; root: string }[] };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const fields: Record<ProjectOperation, readonly string[]> = {
  init: ['name'], add: ['name', 'source'], list: [], register: [],
  mount: ['artifactId'], unmount: ['artifactId'], archive: ['artifactId'], restore: ['artifactId'],
};
class ProjectError extends Error {
  constructor(readonly code: string, message: string, readonly status: 'rejected' | 'failed' = 'rejected', readonly data?: unknown) { super(message); }
}
function reject(code: string, message: string): never { throw new ProjectError(code, message); }
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function inside(root: string, path: string) { const part = relative(root, path); return part === '' || (!part.startsWith('..' + sep) && part !== '..' && !isAbsolute(part)); }
function validName(value: unknown): value is string { return typeof value === 'string' && !!value.trim() && value.length <= 80 && !value.includes('\0'); }
function validSource(value: unknown): value is string { return typeof value === 'string' && value.length > 0 && value.length <= 4096 && !isAbsolute(value) && !value.split(/[\\/]/).includes('..') && !value.includes('\\') && !value.includes('\0'); }
function exactKeys(value: Record<string, unknown>, allowed: readonly string[]) { return Object.keys(value).every(key => allowed.includes(key)); }
function parseInput(input: unknown): ProjectOperationInput {
  if (!object(input) || typeof input.operation !== 'string' || !Object.hasOwn(fields, input.operation)) reject('INVALID_INPUT', 'Expected a supported project operation.');
  const operation = input.operation as ProjectOperation;
  if (!exactKeys(input, ['operation', 'projectRoot', ...fields[operation]])) reject('INVALID_INPUT', 'Unknown or inappropriate field for this project operation.');
  if (typeof input.projectRoot !== 'string' || !isAbsolute(input.projectRoot) || input.projectRoot.includes('\0')) reject('INVALID_PROJECT_ROOT', 'projectRoot must be an absolute directory path.');
  if (Object.hasOwn(input, 'name') && !validName(input.name)) reject('INVALID_INPUT', 'name must be nonempty text up to 80 characters.');
  if (operation === 'add' && (!validName(input.name) || !validSource(input.source))) reject('INVALID_INPUT', 'add requires name and a project-relative source without parent traversal.');
  if (fields[operation].includes('artifactId') && (typeof input.artifactId !== 'string' || !uuid.test(input.artifactId))) reject('INVALID_INPUT', 'This operation requires a valid artifactId.');
  return input as ProjectOperationInput;
}
function canonicalRoot(path: string) {
  try { const root = realpathSync(path); if (!lstatSync(root).isDirectory()) reject('INVALID_PROJECT_ROOT', 'projectRoot must identify an existing directory.'); return root; }
  catch (error) { if (error instanceof ProjectError) throw error; reject('INVALID_PROJECT_ROOT', 'projectRoot must identify an accessible existing directory.'); }
}
export function projectArtifactScope(projectId: string, artifactId: string): ProjectScope { return { namespace: `p-${projectId}`, name: `a-${artifactId}` }; }
function readManifest(root: string): ProjectManifest {
  const file = join(root, projectManifestName), stat = lstatSync(file, { throwIfNoEntry: false });
  if (!stat) reject('MANIFEST_MISSING', 'Project manifest is missing. Initialize it explicitly.');
  if (!stat.isFile()) reject('INVALID_MANIFEST', 'Project manifest must be a regular project-owned file, not a symlink.');
  let value: unknown;
  try { value = JSON.parse(readFileSync(file, 'utf8')); } catch (error) { if (error instanceof SyntaxError) reject('INVALID_MANIFEST', 'Project manifest contains invalid JSON.'); throw error; }
  if (!object(value) || !exactKeys(value, ['version', 'projectId', 'name', 'artifacts']) || value.version !== 1 || typeof value.projectId !== 'string' || !uuid.test(value.projectId) || !validName(value.name) || !Array.isArray(value.artifacts)) reject('INVALID_MANIFEST', 'Unsupported or invalid project manifest.');
  const ids = new Set<string>(), names = new Set<string>(), sources: string[] = [];
  for (const artifact of value.artifacts) {
    if (!object(artifact) || !exactKeys(artifact, ['id', 'name', 'source', 'archived']) || typeof artifact.id !== 'string' || !uuid.test(artifact.id) || !validName(artifact.name) || !validSource(artifact.source) || typeof artifact.archived !== 'boolean') reject('INVALID_MANIFEST', 'Invalid artifact definition in project manifest.');
    const source = normalize(artifact.source).split(sep).join('/');
    if (source !== artifact.source || ids.has(artifact.id) || names.has(artifact.name) || sources.some(prior => inside(resolve(root, prior), resolve(root, source)) || inside(resolve(root, source), resolve(root, prior)))) reject('INVALID_MANIFEST', 'Duplicate identities, names, overlapping sources, or non-normalized source paths in manifest.');
    ids.add(artifact.id); names.add(artifact.name); sources.push(source);
  }
  return value as ProjectManifest;
}
function atomic(file: string, value: unknown) {
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try { writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' }); renameSync(temporary, file); }
  finally { try { unlinkSync(temporary); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; } }
}
async function withLock<T>(path: string, task: () => T | Promise<T>): Promise<T> {
  let fd: number;
  try { fd = openSync(path, 'wx', 0o600); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') reject('OWNERSHIP_CONFLICT', `Ownership lock exists: ${path}. Inspect its PID before recovering a stale lock.`);
    throw error;
  }
  try { writeFileSync(fd, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })); return await task(); }
  finally { closeSync(fd); unlinkSync(path); }
}
function resolveSource(root: string, source: string) {
  if (!validSource(source)) reject('INVALID_SOURCE', 'Source must be project-relative without parent traversal.');
  let canonical: string;
  try { canonical = realpathSync(resolve(root, source)); }
  catch { reject('SOURCE_UNAVAILABLE', 'Artifact source is missing or inaccessible.'); }
  if (!inside(root, canonical)) reject('INVALID_SOURCE', 'Source resolves outside the canonical project root.');
  if (!lstatSync(canonical).isDirectory()) reject('INVALID_SOURCE', 'Artifact source must be a directory.');
  const pkg = lstatSync(join(canonical, 'package.json'), { throwIfNoEntry: false });
  if (!pkg?.isFile()) reject('INVALID_SOURCE', 'Artifact source needs a regular project-owned package.json.');
  return canonical;
}
function sourceStatus(root: string, artifact: ProjectArtifact) {
  try { return { sourceStatus: 'available', canonicalSource: resolveSource(root, artifact.source) }; }
  catch (error) { if (!(error instanceof ProjectError)) throw error; return { sourceStatus: 'unavailable', sourceError: { code: error.code, message: error.message } }; }
}
function selected(manifest: ProjectManifest, id: string) { const artifact = manifest.artifacts.find(item => item.id === id); if (!artifact) reject('ARTIFACT_NOT_FOUND', 'Unknown artifactId. List the project to obtain its stable IDs.'); return artifact; }
function outcome(error: unknown): ProjectOutcome {
  if (error instanceof ProjectError) return { version: 1, ok: false, status: error.status, error: { code: error.code, message: error.message }, ...(error.data === undefined ? {} : { data: error.data }) };
  return { version: 1, ok: false, status: 'failed', error: { code: 'IO_ERROR', message: error instanceof Error ? error.message : 'Project operation failed.' } };
}

/** Factory is inert. Filesystem ownership and runtime work begin only on execute after transport authorization. */
export function createProjectService(options: { stateDir: string; runtime: ProjectRuntime }) {
  async function runtime<T>(action: () => Promise<T>): Promise<T> {
    try { return await action(); } catch (error) { throw new ProjectError('RUNTIME_ERROR', error instanceof Error ? error.message : 'Runtime operation failed.', 'failed'); }
  }
  async function bind(root: string, manifest: ProjectManifest) {
    mkdirSync(options.stateDir, { recursive: true, mode: 0o700 });
    const file = join(options.stateDir, 'project-bindings.json');
    // Every mutating execute owns its project first, then this short-lived shared ledger lock.
    await withLock(join(options.stateDir, 'project-bindings.lock'), () => {
      let ledger: Ledger = { version: 1, projects: [] };
      const stat = lstatSync(file, { throwIfNoEntry: false });
      if (stat) {
        if (!stat.isFile()) throw new ProjectError('INVALID_LEDGER', 'Project binding ledger must be a regular state-owned file.', 'failed');
        try { ledger = JSON.parse(readFileSync(file, 'utf8')); } catch (error) { if (error instanceof SyntaxError) throw new ProjectError('INVALID_LEDGER', 'Project binding ledger contains invalid JSON.', 'failed'); throw error; }
      }
      if (!object(ledger) || !exactKeys(ledger, ['version', 'projects']) || ledger.version !== 1 || !Array.isArray(ledger.projects)) throw new ProjectError('INVALID_LEDGER', 'Unsupported project binding ledger.', 'failed');
      const ids = new Set<string>(), roots = new Set<string>();
      for (const item of ledger.projects) {
        if (!object(item) || !exactKeys(item, ['projectId', 'root']) || typeof item.projectId !== 'string' || !uuid.test(item.projectId) || typeof item.root !== 'string' || !isAbsolute(item.root) || ids.has(item.projectId) || roots.has(item.root)) throw new ProjectError('INVALID_LEDGER', 'Invalid or duplicate project binding.', 'failed');
        ids.add(item.projectId); roots.add(item.root);
      }
      const prior = ledger.projects.find(item => item.projectId === manifest.projectId);
      if (prior && prior.root !== root) reject('PROJECT_IDENTITY_CONFLICT', 'Project identity is bound to another canonical root. Relocation/copy adoption requires explicit reconciliation.');
      if (ledger.projects.some(item => item.root === root && item.projectId !== manifest.projectId)) reject('PROJECT_IDENTITY_CONFLICT', 'Canonical root is bound to a different project identity.');
      if (!prior) { ledger.projects.push({ projectId: manifest.projectId, root }); atomic(file, ledger); }
    });
  }
  function findRuntime(mounts: ProjectMount[], scope: ProjectScope) {
    const matches = mounts.filter(item => item.namespace === scope.namespace && item.name === scope.name);
    if (matches.length > 1) throw new ProjectError('INVALID_RUNTIME_STATE', 'Runtime contains duplicate mount identities.', 'failed');
    return matches[0] ?? null;
  }
  function checkRuntime(mount: ProjectMount | null, root: string, source: string) {
    if (mount && (mount.projectRoot !== root || mount.source !== source)) reject('RUNTIME_IDENTITY_CONFLICT', 'Runtime mount identity differs from the project manifest. Reconcile it explicitly.');
  }
  async function observedRuntime(root: string, manifest: ProjectManifest, artifact: ProjectArtifact, source = resolve(root, artifact.source)) {
    const scope = projectArtifactScope(manifest.projectId, artifact.id);
    const found = findRuntime(await runtime(() => options.runtime.listMounts()), scope);
    checkRuntime(found, root, source); return found;
  }
  async function stop(root: string, manifest: ProjectManifest, artifact: ProjectArtifact) {
    await bind(root, manifest);
    const prior = await observedRuntime(root, manifest, artifact);
    if (!prior || prior.status === 'unmounted') return prior;
    const scope = projectArtifactScope(manifest.projectId, artifact.id);
    const stopped = await runtime(() => options.runtime.unmount(scope));
    if (stopped.namespace !== scope.namespace || stopped.name !== scope.name) throw new ProjectError('INVALID_RUNTIME_STATE', 'Runtime confirmed a different unmount scope.', 'failed');
    checkRuntime(stopped, root, resolve(root, artifact.source));
    if (stopped.status !== 'unmounted') throw new ProjectError('RUNTIME_UNMOUNT_FAILED', stopped.error ?? 'Runtime did not confirm unmount.', 'failed', { runtime: stopped });
    return stopped;
  }
  async function perform(root: string, input: ProjectOperationInput): Promise<unknown> {
    const file = join(root, projectManifestName);
    if (input.operation === 'init') {
      if (lstatSync(file, { throwIfNoEntry: false })) reject('MANIFEST_EXISTS', 'Project manifest already exists; refusing to overwrite it.');
      const name = input.name ?? basename(root);
      if (!validName(name)) reject('INVALID_INPUT', 'Supply a project name for this root.');
      const manifest: ProjectManifest = { version: 1, projectId: crypto.randomUUID(), name, artifacts: [] };
      atomic(file, manifest); return { ...manifest, projectRoot: root };
    }
    const manifest = readManifest(root);
    if (input.operation === 'list') {
      const mounts = await runtime(() => options.runtime.listMounts());
      return { ...manifest, projectRoot: root, artifacts: manifest.artifacts.map(artifact => {
        const route = projectArtifactScope(manifest.projectId, artifact.id), observed = findRuntime(mounts, route);
        return { ...artifact, route, ...sourceStatus(root, artifact), runtime: observed, runtimeIdentityMatches: observed === null ? null : observed.projectRoot === root && observed.source === resolve(root, artifact.source) };
      }) };
    }
    if (input.operation === 'add') {
      const canonical = resolveSource(root, input.source!);
      if (manifest.artifacts.some(item => item.name === input.name)) reject('NAME_CONFLICT', 'Artifact name already exists in this project.');
      if (manifest.artifacts.some(item => inside(resolve(root, item.source), canonical) || inside(canonical, resolve(root, item.source)))) reject('SOURCE_CONFLICT', 'Artifact source duplicates or overlaps an existing definition.');
      const artifact: ProjectArtifact = { id: crypto.randomUUID(), name: input.name!, source: relative(root, canonical).split(sep).join('/') || '.', archived: false };
      manifest.artifacts.push(artifact); atomic(file, manifest); return { ...artifact, route: projectArtifactScope(manifest.projectId, artifact.id), projectRoot: root };
    }
    if (input.operation === 'register') { await bind(root, manifest); return { projectId: manifest.projectId, projectRoot: root, registered: true }; }
    const artifact = selected(manifest, input.artifactId!);
    if (input.operation === 'mount') {
      if (artifact.archived) reject('ARTIFACT_ARCHIVED', 'Artifact is archived. Restore it explicitly before mounting.');
      const source = resolveSource(root, artifact.source);
      // A replaced source symlink must not silently move a manifest's previously canonical path.
      if (source !== resolve(root, artifact.source)) reject('SOURCE_IDENTITY_CONFLICT', 'Stored artifact source now resolves to another path. Reconcile it explicitly.');
      await bind(root, manifest); await observedRuntime(root, manifest, artifact, source);
      const scope = projectArtifactScope(manifest.projectId, artifact.id);
      await runtime(() => options.runtime.namespace(scope.namespace));
      const mounted = await runtime(() => options.runtime.mount({ ...scope, source, projectRoot: root }));
      checkRuntime(mounted, root, source);
      if (mounted.namespace !== scope.namespace || mounted.name !== scope.name) throw new ProjectError('INVALID_RUNTIME_STATE', 'Runtime returned a different mount scope.', 'failed');
      if (mounted.status !== 'ready') throw new ProjectError('RUNTIME_MOUNT_FAILED', mounted.error ?? 'Mount did not become ready.', 'failed', { artifactId: artifact.id, runtime: mounted });
      return { artifactId: artifact.id, label: artifact.name, ...mounted };
    }
    if (input.operation === 'unmount') return { artifactId: artifact.id, runtime: await stop(root, manifest, artifact) };
    if (input.operation === 'archive') {
      const stopped = await stop(root, manifest, artifact);
      artifact.archived = true;
      try { atomic(file, manifest); }
      catch (error) { throw new ProjectError('ARCHIVE_SAVE_FAILED', error instanceof Error ? error.message : 'Archive flag could not be saved.', 'failed', { artifactId: artifact.id, runtime: stopped, reconciliationRequired: true }); }
      return { ...artifact, runtime: stopped, sourceDeleted: false };
    }
    if (!artifact.archived) reject('ARTIFACT_NOT_ARCHIVED', 'Artifact is not archived. Its runtime state is unchanged.');
    const source = resolveSource(root, artifact.source);
    if (source !== resolve(root, artifact.source)) reject('SOURCE_IDENTITY_CONFLICT', 'Stored artifact source now resolves to another path. Reconcile it explicitly.');
    const observed = await observedRuntime(root, manifest, artifact, source);
    artifact.archived = false; atomic(file, manifest);
    return { ...artifact, runtime: observed, runtimeChanged: false, next: observed?.status === 'ready' ? 'The existing runtime remains ready.' : 'Mount explicitly when ready.' };
  }
  return { async execute(input: ProjectOperationInput): Promise<ProjectOutcome> {
    try {
      const parsed = parseInput(input), root = canonicalRoot(parsed.projectRoot);
      const data = parsed.operation === 'list' ? await perform(root, parsed) : await withLock(join(root, '.artifact-project.lock'), () => perform(root, parsed));
      return { version: 1, ok: true, status: 'ok', data };
    } catch (error) { return outcome(error); }
  } };
}
