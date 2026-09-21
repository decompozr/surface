import { test, expect } from 'bun:test';
import { existsSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fixture, git } from './fixture.ts';
import { workspaceDirectory, inspectGit } from './identity.ts';

test('linked worktrees share project identity and keep stable independent workspace identities', async () => {
  const f = await fixture();
  try {
    const directory = workspaceDirectory(f.state, f.data);
    const main = await directory.identity(f.main, f.manifest, 'register'), a = await directory.identity(f.a, f.manifest, 'register'), b = await directory.identity(f.b, f.manifest, 'register');
    expect(new Set([main.namespace,a.namespace,b.namespace]).size).toBe(3);
    expect(directory.snapshot().projects.length).toBe(1);
    expect(directory.snapshot().projects[0]!.workspaces.length).toBe(3);
    expect(existsSync(f.data)).toBe(false);
    await git(f.a, 'branch', '-m', 'renamed'); expect(await directory.identity(f.a, f.manifest, 'register')).toEqual(a);
    await git(f.b, 'checkout', '--detach', '-q'); expect(await directory.identity(f.b, f.manifest, 'register')).toEqual(b);
    const reloaded = workspaceDirectory(f.state, f.data); expect(await reloaded.identity(f.main, f.manifest, 'list')).toEqual(main);
    directory.transition(a.workspaceId, 'retiring'); await expect(directory.identity(f.a, f.manifest, 'mount')).rejects.toThrow('retiring');
    expect(await directory.identity(f.a, f.manifest, 'unmount')).toEqual(a);
    directory.transition(a.workspaceId, 'retired'); await expect(directory.identity(f.a, f.manifest, 'register')).rejects.toThrow('Retired');
    expect(await directory.identity(f.main, f.manifest, 'mount')).toEqual(main);
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});
test('copied IDs, forged Git pointers and unsafe persistent roots are rejected without adoption', async () => {
  const f = await fixture();
  try {
    const directory = workspaceDirectory(f.state, f.data); await directory.identity(f.main, f.manifest, 'register');
    const before = readFileSync(join(f.state, 'workspaces.json'), 'utf8');
    const clone = join(f.directory, 'clone'); await git(f.main, 'clone', '-q', f.main, clone);
    await expect(directory.identity(clone, f.manifest, 'register')).rejects.toThrow('PROJECT_IDENTITY_CONFLICT');
    const copied = join(f.directory, 'copied'); mkdirSync(copied); cpSync(join(f.a, '.git'), join(copied, '.git'));
    await expect(inspectGit(copied)).rejects.toThrow('registered Git worktree');
    expect(readFileSync(join(f.state, 'workspaces.json'), 'utf8')).toBe(before);
    const unsafe = workspaceDirectory(join(f.directory, 'unsafe-state'), join(f.a, 'data'));
    await expect(unsafe.identity(f.main, f.manifest, 'register')).rejects.toThrow('outside every Git worktree');
    expect(existsSync(join(f.a, 'data'))).toBe(false);
    writeFileSync(join(f.state, 'workspaces.lock'), 'fixture owner');
    await expect(directory.identity(f.b, f.manifest, 'register')).rejects.toThrow('locked');
    expect(readFileSync(join(f.state, 'workspaces.lock'), 'utf8')).toBe('fixture owner');
    unlinkSync(join(f.state, 'workspaces.lock'));
    const admin = (await inspectGit(f.main)).gitDir;
    unlinkSync(join(admin, 'surface-workspace.json'));
    await expect(directory.identity(f.main, f.manifest, 'register')).rejects.toThrow('recreation');
    expect(readFileSync(join(f.state, 'workspaces.json'), 'utf8')).toBe(before);
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});
