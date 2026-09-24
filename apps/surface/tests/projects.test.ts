import { afterEach, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, realpathSync, renameSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProjectService, projectManifestName, projectArtifactScope } from '../src/lib/server/services/projects.ts';
import { projectOperations, type ProjectRuntime, type ProjectMount, type ProjectOperationInput, type ProjectOutcome } from '../src/lib/contracts/projects.ts';

const directories: string[] = [];
afterEach(() => { for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true }); });
function assertOK(outcome: ProjectOutcome): any { expect(outcome).toMatchObject({ version: 1, ok: true, status: 'ok' }); return outcome.data; }
function fixture() {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'surface-project-core-'))); directories.push(directory);
  const root = join(directory, 'project'), stateDir = join(directory, 'state'), source = join(root, 'artifacts/panel');
  mkdirSync(source, { recursive: true });
  writeFileSync(join(root, 'README.md'), 'User-owned project\n');
  writeFileSync(join(source, 'package.json'), '{"private":true}\n');
  writeFileSync(join(source, 'source.txt'), 'Preserve source\n');
  const mounts: ProjectMount[] = [], calls: string[] = [];
  const runtime: ProjectRuntime = {
    async namespace(name) { calls.push('namespace:' + name); return {}; },
    async mount(input) { calls.push('mount'); let mount = mounts.find(item => item.namespace === input.namespace && item.name === input.name); if (!mount) { mount = { ...input, status: 'ready' }; mounts.push(mount); } else mount.status = 'ready'; return { ...mount }; },
    async listMounts() { calls.push('list'); return mounts.map(item => ({ ...item })); },
    async unmount(scope) { calls.push('unmount'); const mount = mounts.find(item => item.namespace === scope.namespace && item.name === scope.name)!; mount.status = 'unmounted'; return { ...mount }; },
  };
  const service = createProjectService({ stateDir, runtime });
  const execute = (input: Omit<ProjectOperationInput, 'projectRoot'> & { projectRoot?: string }) => service.execute({ projectRoot: root, ...input });
  async function setup() { const manifest = assertOK(await execute({ operation: 'init' })); const artifact = assertOK(await execute({ operation: 'add', source: 'artifacts/panel', name: 'Controls' })); return { manifest, artifact }; }
  return { directory, root, stateDir, source, runtime, mounts, calls, service, execute, setup, manifestFile: join(root, projectManifestName) };
}

test('factory is inert and invalid operations reject before filesystem or runtime work', async () => {
  const f = fixture();
  expect(existsSync(f.stateDir)).toBe(false);
  const cases: unknown[] = [null, [], {}, { operation: 'toString', projectRoot: f.root }, { operation: 'list', projectRoot: 'relative' }, { operation: 'init', projectRoot: f.root, artifactId: crypto.randomUUID() }, { operation: 'add', projectRoot: f.root, source: 'artifacts/panel' }, { operation: 'add', projectRoot: f.root, source: '../outside', name: 'Bad' }, { operation: 'register', projectRoot: f.root, unknown: true }, { operation: 'mount', projectRoot: f.root, artifactId: 'wrong' }, { operation: 'init', projectRoot: f.root, name: undefined }];
  for (const input of cases) expect(await f.service.execute(input as ProjectOperationInput)).toMatchObject({ version: 1, ok: false, status: 'rejected' });
  expect(f.calls).toHaveLength(0); expect(existsSync(f.manifestFile)).toBe(false); expect(existsSync(f.stateDir)).toBe(false);
  expect(projectOperations).toHaveLength(8);
});

test('canonical aliases share project identity; manifests retain relative source definitions', async () => {
  const f = fixture(), alias = join(f.directory, 'alias'); symlinkSync(f.root, alias, 'dir');
  const manifest = assertOK(await f.execute({ operation: 'init', projectRoot: alias, name: 'Chosen label' }));
  expect(manifest.projectRoot).toBe(f.root);
  const artifact = assertOK(await f.execute({ operation: 'add', source: 'artifacts/panel', name: 'Controls' }));
  assertOK(await f.execute({ operation: 'register', projectRoot: alias }));
  assertOK(await f.execute({ operation: 'register' }));
  const ledger = JSON.parse(readFileSync(join(f.stateDir, 'project-bindings.json'), 'utf8'));
  expect(ledger.projects).toEqual([{ projectId: manifest.projectId, root: f.root }]);
  expect(readFileSync(f.manifestFile, 'utf8')).not.toContain(f.root);
  expect(artifact.source).toBe('artifacts/panel'); expect(artifact.route).toEqual(projectArtifactScope(manifest.projectId, artifact.id));
});

test('init refuses existing/dangling manifest links and reads reject symlink ownership', async () => {
  const f = fixture(); symlinkSync(join(f.directory, 'missing.json'), f.manifestFile);
  expect(await f.execute({ operation: 'init' })).toMatchObject({ status: 'rejected', error: { code: 'MANIFEST_EXISTS' } });
  expect(await f.execute({ operation: 'list' })).toMatchObject({ status: 'rejected', error: { code: 'INVALID_MANIFEST' } });
  expect(f.calls).toHaveLength(0);
});

test('source paths cannot escape, duplicate or overlap and labels remain independent from route identity', async () => {
  const f = fixture(), { artifact } = await f.setup();
  const outside = join(f.directory, 'outside'); mkdirSync(outside); writeFileSync(join(outside, 'package.json'), '{}'); symlinkSync(outside, join(f.root, 'escape'), 'dir');
  expect(await f.execute({ operation: 'add', source: 'escape', name: 'Escape' })).toMatchObject({ status: 'rejected', error: { code: 'INVALID_SOURCE' } });
  expect(await f.execute({ operation: 'add', source: 'artifacts/panel', name: 'Other' })).toMatchObject({ status: 'rejected', error: { code: 'SOURCE_CONFLICT' } });
  expect(await f.execute({ operation: 'add', source: 'artifacts/panel', name: 'Controls' })).toMatchObject({ status: 'rejected', error: { code: 'NAME_CONFLICT' } });
  mkdirSync(join(f.source, 'nested')); writeFileSync(join(f.source, 'nested/package.json'), '{}');
  expect(await f.execute({ operation: 'add', source: 'artifacts/panel/nested', name: 'Nested' })).toMatchObject({ status: 'rejected', error: { code: 'SOURCE_CONFLICT' } });
  const manifest = JSON.parse(readFileSync(f.manifestFile, 'utf8')); manifest.artifacts[0].name = 'Renamed'; writeFileSync(f.manifestFile, JSON.stringify(manifest));
  const listed = assertOK(await f.execute({ operation: 'list' }));
  expect(listed.artifacts[0]).toMatchObject({ id: artifact.id, name: 'Renamed', route: artifact.route, archived: false, runtime: null, sourceStatus: 'available' });
});

test('list keeps source availability, archive flag, and observed runtime independent', async () => {
  const f = fixture(), { artifact } = await f.setup();
  assertOK(await f.execute({ operation: 'mount', artifactId: artifact.id }));
  renameSync(f.source, f.source + '-missing');
  const listed = assertOK(await f.execute({ operation: 'list' }));
  expect(listed.artifacts[0]).toMatchObject({ archived: false, sourceStatus: 'unavailable', sourceError: { code: 'SOURCE_UNAVAILABLE' }, runtime: { status: 'ready' } });
  f.runtime.listMounts = async () => { throw new Error('Runtime unavailable'); };
  expect(await f.execute({ operation: 'list' })).toMatchObject({ status: 'failed', error: { code: 'RUNTIME_ERROR' } });
});

test('mount failures retain observed runtime data and never claim a ready preview', async () => {
  const f = fixture(), { artifact } = await f.setup();
  f.runtime.mount = async input => ({ ...input, status: 'failed', error: 'Compile rejected' });
  expect(await f.execute({ operation: 'mount', artifactId: artifact.id })).toMatchObject({ ok: false, status: 'failed', error: { code: 'RUNTIME_MOUNT_FAILED' }, data: { artifactId: artifact.id, runtime: { status: 'failed' } } });
  expect(JSON.parse(readFileSync(f.manifestFile, 'utf8')).artifacts[0].archived).toBe(false);
});

test('archive checks runtime confirmation before writing and preserves definition on failure', async () => {
  const f = fixture(), { artifact } = await f.setup(); assertOK(await f.execute({ operation: 'mount', artifactId: artifact.id }));
  const before = readFileSync(f.manifestFile, 'utf8');
  f.runtime.unmount = async () => ({ ...f.mounts[0]!, status: 'failed', error: 'Still owned' });
  expect(await f.execute({ operation: 'archive', artifactId: artifact.id })).toMatchObject({ status: 'failed', error: { code: 'RUNTIME_UNMOUNT_FAILED' }, data: { runtime: { status: 'failed' } } });
  expect(readFileSync(f.manifestFile, 'utf8')).toBe(before); expect(f.mounts[0]!.status).toBe('ready');
  f.runtime.unmount = async () => ({ ...f.mounts[0]!, name: 'wrong-scope', status: 'unmounted' });
  expect(await f.execute({ operation: 'archive', artifactId: artifact.id })).toMatchObject({ status: 'failed', error: { code: 'INVALID_RUNTIME_STATE' } });
  expect(readFileSync(f.manifestFile, 'utf8')).toBe(before);
  f.runtime.unmount = async () => { throw new Error('Unmount transport failed'); };
  expect(await f.execute({ operation: 'archive', artifactId: artifact.id })).toMatchObject({ status: 'failed', error: { code: 'RUNTIME_ERROR' } });
  expect(readFileSync(f.manifestFile, 'utf8')).toBe(before); expect(existsSync(join(f.root, '.artifact-project.lock'))).toBe(false);
});

test('archive/restore preserve source and report runtime without an implicit mount', async () => {
  const f = fixture(), { artifact } = await f.setup(); assertOK(await f.execute({ operation: 'mount', artifactId: artifact.id }));
  const archived = assertOK(await f.execute({ operation: 'archive', artifactId: artifact.id }));
  expect(archived).toMatchObject({ archived: true, runtime: { status: 'unmounted' }, sourceDeleted: false });
  expect(await f.execute({ operation: 'mount', artifactId: artifact.id })).toMatchObject({ status: 'rejected', error: { code: 'ARTIFACT_ARCHIVED' } });
  const count = f.calls.filter(value => value === 'mount').length;
  const restored = assertOK(await f.execute({ operation: 'restore', artifactId: artifact.id }));
  expect(restored).toMatchObject({ archived: false, runtime: { status: 'unmounted' }, runtimeChanged: false });
  expect(f.calls.filter(value => value === 'mount')).toHaveLength(count);
  expect(readFileSync(join(f.source, 'source.txt'), 'utf8')).toBe('Preserve source\n');
  expect(readFileSync(join(f.root, 'README.md'), 'utf8')).toBe('User-owned project\n');
  expect(await f.execute({ operation: 'restore', artifactId: artifact.id })).toMatchObject({ status: 'rejected', error: { code: 'ARTIFACT_NOT_ARCHIVED' } });
});

test('restore truthfully reports a runtime independently remounted by an administrator', async () => {
  const f = fixture(), { artifact } = await f.setup(); assertOK(await f.execute({ operation: 'mount', artifactId: artifact.id })); assertOK(await f.execute({ operation: 'archive', artifactId: artifact.id }));
  f.mounts[0]!.status = 'ready'; // Direct runtime administration is a distinct authority from manifest state.
  expect(assertOK(await f.execute({ operation: 'list' })).artifacts[0]).toMatchObject({ archived: true, runtime: { status: 'ready' } });
  const before = f.calls.filter(value => value === 'mount').length;
  const restored = assertOK(await f.execute({ operation: 'restore', artifactId: artifact.id }));
  expect(restored).toMatchObject({ archived: false, runtime: { status: 'ready' }, runtimeChanged: false });
  expect(restored).not.toHaveProperty('mounted'); expect(f.calls.filter(value => value === 'mount')).toHaveLength(before);
});

test('route identity mismatches and retargeted stored source links never silently rebind', async () => {
  const f = fixture(), { artifact } = await f.setup(); assertOK(await f.execute({ operation: 'mount', artifactId: artifact.id }));
  const prior = { ...f.mounts[0]! }; f.mounts[0]!.projectRoot = join(f.directory, 'different');
  for (const operation of ['mount', 'unmount', 'archive'] as const) expect(await f.execute({ operation, artifactId: artifact.id })).toMatchObject({ status: 'rejected', error: { code: 'RUNTIME_IDENTITY_CONFLICT' } });
  expect(assertOK(await f.execute({ operation: 'list' })).artifacts[0].runtimeIdentityMatches).toBe(false);
  Object.assign(f.mounts[0]!, prior);
  const moved = join(f.root, 'moved'); renameSync(f.source, moved); symlinkSync(moved, f.source, 'dir');
  expect(await f.execute({ operation: 'mount', artifactId: artifact.id })).toMatchObject({ status: 'rejected', error: { code: 'SOURCE_IDENTITY_CONFLICT' } });
  expect(f.calls.filter(value => value === 'mount')).toHaveLength(1);
});

test('project writer ownership blocks mutation but list can report admitted runtime work', async () => {
  const f = fixture(), { artifact } = await f.setup();
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; }), pending = new Promise<void>(resolve => { release = resolve; });
  f.runtime.mount = async input => { const mount = { ...input, status: 'installing' }; f.mounts.push(mount); entered(); await pending; mount.status = 'ready'; return mount; };
  const mounting = f.execute({ operation: 'mount', artifactId: artifact.id }); await started;
  expect(await f.execute({ operation: 'archive', artifactId: artifact.id })).toMatchObject({ status: 'rejected', error: { code: 'OWNERSHIP_CONFLICT' } });
  expect(assertOK(await f.execute({ operation: 'list' })).artifacts[0]).toMatchObject({ archived: false, runtime: { status: 'installing' } });
  release(); assertOK(await mounting); expect(existsSync(join(f.root, '.artifact-project.lock'))).toBe(false);
});

test('shared ledger ownership prevents concurrent copied UUID roots from rebinding', async () => {
  const f = fixture(); await f.setup();
  const other = join(f.directory, 'copied'); mkdirSync(other); writeFileSync(join(other, projectManifestName), readFileSync(f.manifestFile));
  const outcomes = await Promise.all([f.execute({ operation: 'register' }), f.execute({ operation: 'register', projectRoot: other })]);
  expect(outcomes.filter(value => value.ok)).toHaveLength(1);
  expect(outcomes.filter(value => !value.ok)[0]).toMatchObject({ status: 'rejected' });
  const ledger = JSON.parse(readFileSync(join(f.stateDir, 'project-bindings.json'), 'utf8'));
  expect(ledger.projects).toHaveLength(1);
  const loser = ledger.projects[0].root === f.root ? other : f.root;
  expect(await f.execute({ operation: 'register', projectRoot: loser })).toMatchObject({ status: 'rejected', error: { code: 'PROJECT_IDENTITY_CONFLICT' } });
});

test('pre-existing ledger lock remains owned and corrupt ledger is not overwritten', async () => {
  const f = fixture(); await f.setup(); mkdirSync(f.stateDir);
  const lock = join(f.stateDir, 'project-bindings.lock'); writeFileSync(lock, 'other owner');
  expect(await f.execute({ operation: 'register' })).toMatchObject({ status: 'rejected', error: { code: 'OWNERSHIP_CONFLICT' } });
  expect(readFileSync(lock, 'utf8')).toBe('other owner'); rmSync(lock);
  const ledger = join(f.stateDir, 'project-bindings.json'); writeFileSync(ledger, '{broken');
  expect(await f.execute({ operation: 'register' })).toMatchObject({ status: 'failed', error: { code: 'INVALID_LEDGER' } });
  expect(readFileSync(ledger, 'utf8')).toBe('{broken'); expect(existsSync(lock)).toBe(false);
});

test('malformed manifests and unavailable sources fail without destructive recovery', async () => {
  const f = fixture(), { artifact } = await f.setup();
  renameSync(f.source, f.source + '-missing');
  expect(await f.execute({ operation: 'mount', artifactId: artifact.id })).toMatchObject({ status: 'rejected', error: { code: 'SOURCE_UNAVAILABLE' } });
  assertOK(await f.execute({ operation: 'archive', artifactId: artifact.id }));
  expect(await f.execute({ operation: 'restore', artifactId: artifact.id })).toMatchObject({ status: 'rejected', error: { code: 'SOURCE_UNAVAILABLE' } });
  expect(JSON.parse(readFileSync(f.manifestFile, 'utf8')).artifacts[0].archived).toBe(true);
  writeFileSync(f.manifestFile, '{broken');
  expect(await f.execute({ operation: 'list' })).toMatchObject({ status: 'rejected', error: { code: 'INVALID_MANIFEST' } });
  expect(readFileSync(f.manifestFile, 'utf8')).toBe('{broken');
});
