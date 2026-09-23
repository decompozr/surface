import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { startSurfaceApp } from '../server/host.ts';
import { workspaceDirectory } from '../src/workspaces/identity.ts';
import { git, workspaceFixture } from './workspace-fixture.ts';

const f = await workspaceFixture();
let app: Awaited<ReturnType<typeof startSurfaceApp>> | undefined;
try {
  app = await startSurfaceApp({ ...f, port: 0 });
  async function project(projectRoot: string, operation: string) {
    const { token } = JSON.parse(readFileSync(join(f.stateDir, 'connection.json'), 'utf8'));
    const response = await fetch(app!.origin + '/api/v1/projects/operations', {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ projectRoot, operation, ...(['mount', 'unmount'].includes(operation) ? { artifactId: f.artifactId } : {}) }),
    });
    return response.json();
  }
  const main = await project(f.main, 'register'), linked = await project(f.linked, 'register');
  assert.equal(main.ok, true, JSON.stringify(main)); assert.equal(linked.ok, true, JSON.stringify(linked));
  assert.notEqual(main.data.workspaceId, linked.data.workspaceId);
  const ledger = workspaceDirectory(f.stateDir, f.dataRoot);
  assert.equal(ledger.snapshot().projects.length, 1);
  const a = ledger.get(main.data.workspaceId), b = ledger.get(linked.data.workspaceId);
  assert.notEqual(a.namespace, b.namespace);
  const mainMount = await project(f.main, 'mount');
  assert.equal(mainMount.ok, true);
  assert.equal(new URL(mainMount.data.previewUrl).pathname, '/workspace/app-fixture/main/ui/');
  const linkedMount = await project(f.linked, 'mount');
  assert.equal(linkedMount.ok, true);
  assert.equal(new URL(linkedMount.data.previewUrl).pathname, '/workspace/app-fixture/linked/ui/');
  await git(f.linked, 'branch', '-m', 'renamed-fixture');
  assert.equal((await project(f.linked, 'register')).data.workspaceId, b.id);
  await git(f.linked, 'checkout', '--detach', '-q');
  assert.equal((await project(f.linked, 'register')).data.workspaceId, b.id);
  const clone = join(f.directory, 'clone');
  await git(f.main, 'clone', '-q', f.main, clone);
  const conflict = await project(clone, 'register');
  assert.equal(conflict.ok, false);
  assert.match(conflict.error.message, /PROJECT_IDENTITY_CONFLICT/);
  for (const root of [f.main, f.linked]) assert.equal(existsSync(join(root, '.decompozr')), false);
  assert.equal(existsSync(f.dataRoot), false);
  assert.equal(existsSync(join(f.stateDir, 'project-bindings.json')), false);
  assert.equal((await project(f.linked, 'unmount')).ok, true);
  const name = `a-${f.artifactId}`;
  assert.equal((await fetch(`${app.origin}/n/${b.namespace}/${name}/`)).status, 404);
  assert.equal((await fetch(`${app.origin}/n/${a.namespace}/${name}/`)).status, 200);
  await app.stop();
  await assert.rejects(startSurfaceApp({ stateDir: f.stateDir, dataRoot: join(f.directory, 'other-data'), port: 0 }), /Data-root change/);
  app = await startSurfaceApp({ stateDir: f.stateDir, port: 0 });
  assert.equal((await project(f.main, 'register')).data.workspaceId, a.id);
  assert.equal((await project(f.linked, 'register')).data.workspaceId, b.id);
  assert.equal(existsSync(f.dataRoot), false);
  assert.equal((await fetch(app.origin + '/health')).status, 200);
  console.log('PASS: one project, isolated stable worktree namespaces, clone conflict, no duplicated state/database, scoped unmount, restart identity and data-root guard.');
} finally {
  try { await app?.stop(); }
  finally { rmSync(f.directory, { recursive: true, force: true }); }
}
