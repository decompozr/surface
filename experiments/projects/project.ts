import { readFileSync, writeFileSync, renameSync, realpathSync, lstatSync, existsSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { join, resolve, relative, sep, isAbsolute, basename } from 'node:path';

const inside = (root: string, path: string) => { const part = relative(root, path); return part === '' || (!part.startsWith('..' + sep) && part !== '..' && !isAbsolute(part)); };

const label = (value: unknown): string => { if (typeof value !== 'string' || !value.trim() || value.length > 80) throw new Error('Name must be nonempty text up to 80 characters.'); return value; };

const sourcePath = (value: unknown): string => {
  if (typeof value !== 'string' || !value || isAbsolute(value) || value.split(/[\\/]/).includes('..') || value.includes('\\')) throw new Error('Source must be a project-relative path without parent traversal.');
  return value;
};

export const identity = (projectId: string, artifactId: string) => { return { namespace: `p-${projectId}`, name: `a-${artifactId}` }; };

const projectRoot = (path: string) => { const root = realpathSync(path); if (!lstatSync(root).isDirectory()) throw new Error('Project root must be a directory.'); return root; };

const readManifest = (root: string): Manifest => {
  const file = join(root, manifestName);
  if (!lstatSync(file).isFile()) throw new Error('Project manifest must be a regular project-owned file, not a symlink.');
  const manifest = JSON.parse(readFileSync(file, 'utf8')) as Manifest;
  if (manifest.version !== 1 || !uuid.test(manifest.projectId) || !Array.isArray(manifest.artifacts)) throw new Error('Unsupported or invalid project manifest.');
  label(manifest.name);
  const ids = new Set<string>(), names = new Set<string>(), sources = new Set<string>();
  for (const artifact of manifest.artifacts) {
    if (!uuid.test(artifact.id) || typeof artifact.archived !== 'boolean' || ids.has(artifact.id) || names.has(artifact.name) || sources.has(artifact.source)) throw new Error('Invalid or duplicate artifact identity/name/source in manifest.');
    label(artifact.name); sourcePath(artifact.source);
    ids.add(artifact.id); names.add(artifact.name); sources.add(artifact.source);
  }
  return manifest;
};

const atomic = (file: string, data: unknown) => {
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try { writeFileSync(temporary, JSON.stringify(data, null, 2) + '\n', { mode: 0o600, flag: 'wx' }); renameSync(temporary, file); }
  finally { try { unlinkSync(temporary); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; } }
};

/** Fail explicitly on competing ownership. Never remove another process's lock automatically. */
export const withLock = async <T>(path: string, task: () => T | Promise<T>): Promise<T> => {
  let descriptor: number;
  try { descriptor = openSync(path, 'wx', 0o600); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error(`Ownership lock exists: ${path}. Inspect its PID before recovering a stale lock.`);
    throw error;
  }
  try { writeFileSync(descriptor, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })); return await task(); }
  finally { closeSync(descriptor); unlinkSync(path); }
};

const resolveSource = (root: string, source: string) => {
  const path = realpathSync(resolve(root, sourcePath(source)));
  if (!inside(root, path)) throw new Error('Source resolves outside the canonical project root.');
  if (!lstatSync(path).isDirectory()) throw new Error('Artifact source must be a directory.');
  if (!existsSync(join(path, 'package.json'))) throw new Error('Artifact source needs its project-owned package.json.');
  return path;
};

const sourceStatus = (root: string, artifact: Artifact) => {
  try { return { sourceStatus: 'available', canonicalSource: resolveSource(root, artifact.source) }; }
  catch (error) { return { sourceStatus: 'unavailable', error: error instanceof Error ? error.message : String(error) }; }
};

const selected = (manifest: Manifest, id: string | undefined) => { const artifact = manifest.artifacts.find(item => item.id === id); if (!artifact) throw new Error('Unknown artifact ID. Use list to obtain its stable ID.'); return artifact; };


export const manifestName = 'artifact.project.json';
export type Artifact = { id: string; name: string; source: string; archived: boolean };
export type Manifest = { version: 1; projectId: string; name: string; artifacts: Artifact[] };
type Ledger = { version: 1; projects: { projectId: string; root: string }[] };
type Mount = { namespace: string; name: string; source: string; projectRoot: string; status: string; error?: string; previewUrl?: string };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

export class ProjectManager {
  root: string;
  constructor(root: string, private stateDir?: string) { this.root = projectRoot(root); }
  private locked<T>(task: () => T | Promise<T>) { return withLock(join(this.root, '.artifact-project.lock'), task); }
  private save(manifest: Manifest) { atomic(join(this.root, manifestName), manifest); }
  private connection() {
    if (!this.stateDir) throw new Error('This operation requires --state-dir for an existing singleton.');
    const connection = JSON.parse(readFileSync(join(this.stateDir, 'connection.json'), 'utf8')) as { origin: string; token: string };
    const origin = new URL(connection.origin);
    if (origin.protocol !== 'http:' || origin.hostname !== '127.0.0.1' || origin.username || origin.password || !connection.token) throw new Error('Expected a local singleton connection.');
    return { origin, token: connection.token };
  }
  private async api<T>(path: string, data?: unknown): Promise<T> {
    const connection = this.connection();
    const response = await fetch(new URL(path, connection.origin), { method: data === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${connection.token}`, 'content-type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(120_000) });
    const output = await response.json() as { error?: string };
    if (!response.ok) throw new Error(output.error ?? `Singleton returned ${response.status}.`);
    return output as T;
  }
  // Order is always project lock -> short-lived ledger lock. No reverse acquisition path.
  private async bind(manifest: Manifest) {
    await this.api('/api/health');
    const file = join(this.stateDir!, 'project-bindings.json');
    await withLock(join(this.stateDir!, 'project-bindings.lock'), () => {
      const ledger: Ledger = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { version: 1, projects: [] };
      if (ledger.version !== 1 || !Array.isArray(ledger.projects)) throw new Error('Invalid local project binding ledger.');
      const prior = ledger.projects.find(item => item.projectId === manifest.projectId);
      if (prior && prior.root !== this.root) throw new Error('Project identity is already bound to another canonical root. Relocation/copy adoption is unsupported; do not silently rebind it.');
      if (ledger.projects.some(item => item.root === this.root && item.projectId !== manifest.projectId)) throw new Error('Canonical root is already bound to a different project identity.');
      if (!prior) { ledger.projects.push({ projectId: manifest.projectId, root: this.root }); atomic(file, ledger); }
    });
  }
  init(name?: string) { return this.locked(() => {
    if (lstatSync(join(this.root, manifestName), { throwIfNoEntry: false })) throw new Error('Project manifest already exists; refusing to overwrite it.');
    const manifest: Manifest = { version: 1, projectId: crypto.randomUUID(), name: label(name ?? basename(this.root)), artifacts: [] };
    this.save(manifest); return manifest;
  }); }
  add(source: string, name: string) { return this.locked(() => {
    const manifest = readManifest(this.root), canonical = resolveSource(this.root, source);
    if (manifest.artifacts.some(item => item.name === name)) throw new Error('Artifact name already exists in this project.');
    const relativeSource = relative(this.root, canonical).split(sep).join('/') || '.';
    for (const item of manifest.artifacts) {
      const prior = resolve(this.root, item.source);
      if (inside(prior, canonical) || inside(canonical, prior)) throw new Error('Artifact source duplicates or overlaps an existing artifact.');
    }
    const artifact: Artifact = { id: crypto.randomUUID(), name: label(name), source: relativeSource, archived: false };
    manifest.artifacts.push(artifact); this.save(manifest); return { ...artifact, route: identity(manifest.projectId, artifact.id) };
  }); }
  list() {
    const manifest = readManifest(this.root);
    return { ...manifest, projectRoot: this.root, artifacts: manifest.artifacts.map(artifact => ({ ...artifact, route: identity(manifest.projectId, artifact.id), ...sourceStatus(this.root, artifact) })) };
  }
  register() { return this.locked(async () => { const manifest = readManifest(this.root); await this.bind(manifest); return { projectId: manifest.projectId, projectRoot: this.root, registered: true }; }); }
  mount(id?: string) { return this.locked(async () => {
    const manifest = readManifest(this.root), artifact = selected(manifest, id);
    if (artifact.archived) throw new Error('Artifact is archived. Restore it explicitly before mounting.');
    const source = resolveSource(this.root, artifact.source);
    await this.bind(manifest);
    const scope = identity(manifest.projectId, artifact.id);
    await this.api('/api/namespaces', { name: scope.namespace });
    const mounted = await this.api<Mount>('/api/mounts', { ...scope, source, projectRoot: this.root });
    if (mounted.status !== 'ready') throw new Error(`Mount failed: ${mounted.error ?? mounted.status}`);
    return { artifactId: artifact.id, label: artifact.name, ...mounted };
  }); }
  private async stop(manifest: Manifest, artifact: Artifact) {
    await this.bind(manifest);
    const scope = identity(manifest.projectId, artifact.id), mounts = await this.api<Mount[]>('/api/mounts');
    const prior = mounts.find(item => item.namespace === scope.namespace && item.name === scope.name);
    // Even unmount must not act on a route whose identity was rebound outside this manager.
    if (prior && (prior.projectRoot !== this.root || prior.source !== resolve(this.root, artifact.source))) throw new Error('Server mount identity differs from the manifest. Reconcile it explicitly.');
    return prior && prior.status !== 'unmounted' ? this.api<Mount>('/api/unmount', scope) : { ...scope, status: 'unmounted' };
  }
  unmount(id?: string) { return this.locked(async () => { const manifest = readManifest(this.root), artifact = selected(manifest, id); return this.stop(manifest, artifact); }); }
  archive(id?: string) { return this.locked(async () => {
    const manifest = readManifest(this.root), artifact = selected(manifest, id);
    await this.stop(manifest, artifact);
    artifact.archived = true; this.save(manifest);
    return { ...artifact, sourcePreserved: true, mounted: false };
  }); }
  restore(id?: string) { return this.locked(() => {
    const manifest = readManifest(this.root), artifact = selected(manifest, id);
    if (!artifact.archived) throw new Error('Artifact is not archived. Its runtime state is unchanged.');
    resolveSource(this.root, artifact.source);
    artifact.archived = false; this.save(manifest);
    return { ...artifact, mounted: false, next: 'Mount explicitly when ready.' };
  }); }
}
