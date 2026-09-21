import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, symlinkSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installationHome } from './launcher.ts';
import { migrate, restore, validateRelease, preferencesFile } from './compatibility.ts';
import { declaration, backendRuntime } from './server.ts';

function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'surface-contract-unit-'))), state = join(root, 'state'), release = join(root, 'release'), source = join(root, 'ui');
  mkdirSync(state); mkdirSync(source); mkdirSync(join(release, 'experiments/server-contract'), { recursive: true });
  writeFileSync(join(release, 'experiments/server-contract/compatibility.json'), JSON.stringify({ version: 1, preferencesReadVersions: [1, 2] }));
  return { root, state, release, source, clean: () => rmSync(root, { recursive: true, force: true }) };
}
test('installation home precedence and platform paths without creating default homes', () => {
  expect(installationHome('/explicit', { SURFACE_HOME: '/environment' }, 'darwin', '/user')).toBe('/explicit');
  expect(installationHome(undefined, { SURFACE_HOME: '/environment' }, 'darwin', '/user')).toBe('/environment');
  expect(installationHome(undefined, {}, 'darwin', '/user')).toBe('/user/Library/Application Support/Surface');
  expect(installationHome(undefined, { XDG_DATA_HOME: '/xdg' }, 'linux', '/user')).toBe('/xdg/surface');
  expect(installationHome(undefined, { XDG_DATA_HOME: 'relative' }, 'linux', '/user')).toBe('/user/.local/share/surface');
});
test('migration failure preserves bytes; incompatible reads and divergent restore fail closed', async () => {
  const f = fixture();
  try {
    const path = join(f.state, preferencesFile), before = '{"version":1,"workspaceLabel":"My workspace"}\n';
    writeFileSync(path, before);
    await expect(migrate(f.state, f.release, () => { throw new Error('injected replacement failure'); })).rejects.toThrow('injected');
    expect(readFileSync(path, 'utf8')).toBe(before);
    const result = await migrate(f.state, f.release), after = readFileSync(path, 'utf8');
    expect(JSON.parse(after).workspace.label).toBe('My workspace');
    writeFileSync(join(f.release, 'experiments/server-contract/compatibility.json'), JSON.stringify({ version: 1, preferencesReadVersions: [1] }));
    await expect(validateRelease(f.release, f.state)).rejects.toThrow('cannot read');
    expect(readFileSync(path, 'utf8')).toBe(after);
    writeFileSync(path, after + '\n');
    await expect(restore(f.state, f.release, result.id)).rejects.toThrow('newer data');
    writeFileSync(path, after); await restore(f.state, f.release, result.id);
    expect(readFileSync(path, 'utf8')).toBe(before);
    writeFileSync(path, '{"version":99}');
    await expect(validateRelease(f.release, f.state)).rejects.toThrow('schema');
  } finally { f.clean(); }
});
test('backend declarations reject unsupported APIs and paths before evaluating code', () => {
  const f = fixture();
  try {
    expect(declaration(f.root, f.source)).toBeUndefined();
    writeFileSync(join(f.root, 'backend.ts'), 'throw new Error("must not evaluate")');
    const candidate = { version: 1, api: 1, entry: 'backend.ts', operations: ['read'] };
    const set = (value: unknown) => writeFileSync(join(f.root, 'surface.backend.json'), JSON.stringify(value));
    set(candidate); expect(declaration(f.root, f.source)?.modulePath).toBe(join(f.root, 'backend.ts'));
    for (const change of [{ api: 2 }, { version: 2 }, { operations: ['read', 'read'] }, { entry: '../outside.ts' }, { entry: '/outside.ts' }, { extra: true }]) {
      set({ ...candidate, ...change }); expect(() => declaration(f.root, f.source)).toThrow();
    }
    writeFileSync(join(f.source, 'backend.ts'), ''); set({ ...candidate, entry: 'ui/backend.ts' }); expect(() => declaration(f.root, f.source)).toThrow('outside browser');
    symlinkSync(join(f.root, 'backend.ts'), join(f.root, 'link.ts')); set({ ...candidate, entry: 'link.ts' }); expect(() => declaration(f.root, f.source)).toThrow('symlink');
    set(candidate); expect(() => declaration(f.root, f.root)).toThrow('outside browser');
  } finally { f.clean(); }
});
test('inert module factory and duplicate mount lifecycle; failed factory does not poison retry', async () => {
  const f = fixture();
  try {
    writeFileSync(join(f.root, 'backend.ts'), `export const apiVersion=1; export function createProjectBackend(){return {invoke(){return {ok:true,data:null}},close(){}}}`);
    const config = { version: 1, api: 1, entry: 'backend.ts', operations: ['read'] };
    writeFileSync(join(f.root, 'surface.backend.json'), JSON.stringify(config));
    const runtime = backendRuntime(f.state), mount = { projectRoot: f.root, source: f.source, namespace: 'project', name: 'view' };
    const first = await runtime.openMountResource(mount);
    expect(existsSync(join(f.root, 'data'))).toBe(false);
    await expect(runtime.openMountResource({ ...mount, name: 'other' })).rejects.toThrow('one active');
    await first.close(); const second = await runtime.openMountResource(mount); await second.close();
    writeFileSync(join(f.root, 'invalid.ts'), `export const apiVersion=1; export function createProjectBackend(){return {}}`);
    writeFileSync(join(f.root, 'surface.backend.json'), JSON.stringify({ ...config, entry: 'invalid.ts' }));
    await expect(runtime.openMountResource(mount)).rejects.toThrow('factory');
    writeFileSync(join(f.root, 'surface.backend.json'), JSON.stringify(config));
    const retry = await runtime.openMountResource(mount); await retry.close();
  } finally { f.clean(); }
});
test('failed asynchronous close keeps project ownership until a successful retry', async () => {
  const f = fixture();
  try {
    writeFileSync(join(f.root, 'backend.ts'), `export const apiVersion=1; export function createProjectBackend(){let attempts=0;return {invoke(){return {ok:true,data:null}},async close(){if(++attempts===1) throw new Error('close failed')}}}`);
    writeFileSync(join(f.root, 'surface.backend.json'), JSON.stringify({ version: 1, api: 1, entry: 'backend.ts', operations: ['read'] }));
    const runtime = backendRuntime(f.state), mount = { projectRoot: f.root, source: f.source, namespace: 'project', name: 'view' };
    const first = await runtime.openMountResource(mount);
    await expect(first.close()).rejects.toThrow('close failed');
    await expect(runtime.openMountResource({ ...mount, name: 'other' })).rejects.toThrow('one active');
    await first.close(); const next = await runtime.openMountResource(mount);
    await first.close();
    await expect(runtime.openMountResource({ ...mount, name: 'other' })).rejects.toThrow('one active');
    await expect(next.close()).rejects.toThrow('close failed'); await next.close();
  } finally { f.clean(); }
});
