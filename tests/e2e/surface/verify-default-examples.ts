import assert from 'node:assert/strict';
import { cpSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectOperation } from '@decompozr/surface-app/server/http/project-client';
import { startProjectApp } from '@decompozr/surface-app/server/host/project-app';
import { workspaceFixture } from './workspace-fixture.ts';
const f = await workspaceFixture();
let app: Awaited<ReturnType<typeof startProjectApp>> | undefined;
try {
  renameSync(join(f.main, 'ui'), join(f.main, 'examples'));
  const file = join(f.main, 'surface.project.json');
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  manifest.surfaces[0].source = 'examples';
  writeFileSync(file, JSON.stringify(manifest));
  app = await startProjectApp({ ...f, projectRoot: f.main, port: 0 });
  assert.equal((await fetch(app.previewUrl)).status, 200);
  assert.equal(new URL(app.previewUrl).pathname, '/workspace/app-fixture/main/examples/');
  assert.equal((await fetch(app.previewUrl + 'counter')).status, 200);
  assert.equal((await fetch(app.previewUrl + 'missing')).status, 404);
  assert.equal((await fetch(app.previewUrl + 'counter/extra')).status, 404);
  const firstURL = new URL(app.previewUrl).pathname;
  await app.stop();
  app = await startProjectApp({ ...f, projectRoot: f.main, port: 0 });
  assert.equal(new URL(app.previewUrl).pathname, firstURL);
  assert.equal((await fetch(app.previewUrl)).status, 200);
  const ledger = JSON.parse(readFileSync(join(f.stateDir, 'workspaces.json'), 'utf8'));
  assert.equal(ledger.projects.length, 1);
  assert.equal(ledger.projects[0].workspaces.length, 1);
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).projectId, f.projectId);
  mkdirSync(join(f.main, 'other'));
  cpSync(join(f.main, 'examples'), join(f.main, 'other/examples'), { recursive: true, filter: path => !path.split('/').includes('node_modules') });
  const added = await projectOperation(f.stateDir, { operation: 'add', projectRoot: f.main, source: 'other/examples', name: 'Collision' });
  assert.equal(added.ok, true);
  const collision = await projectOperation(f.stateDir, { operation: 'mount', projectRoot: f.main, surfaceId: (added.data as { id: string }).id });
  assert.equal(collision.ok, false);
  assert.match(collision.error!.message, /already belongs/);
  assert.equal((await fetch(app.previewUrl + 'counter')).status, 200);
  console.log('PASS: default project registration and example mount; restart reuses identity and mount.');
} finally {
  try { await app?.stop(); } finally { rmSync(f.directory, { recursive: true, force: true }); }
}
