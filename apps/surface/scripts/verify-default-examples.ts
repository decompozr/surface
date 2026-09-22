import assert from 'node:assert/strict';
import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startProjectApp } from '../server/project-app.ts';
import { workspaceFixture } from './workspace-fixture.ts';
const f = await workspaceFixture();
let app: Awaited<ReturnType<typeof startProjectApp>> | undefined;
try {
  renameSync(join(f.main, 'ui'), join(f.main, 'examples'));
  const file = join(f.main, 'artifact.project.json');
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  manifest.artifacts[0].source = 'examples';
  writeFileSync(file, JSON.stringify(manifest));
  app = await startProjectApp({ ...f, projectRoot: f.main, port: 0 });
  assert.equal((await fetch(app.previewUrl)).status, 200);
  const firstURL = new URL(app.previewUrl).pathname;
  await app.stop();
  app = await startProjectApp({ ...f, projectRoot: f.main, port: 0 });
  assert.equal(new URL(app.previewUrl).pathname, firstURL);
  assert.equal((await fetch(app.previewUrl)).status, 200);
  const ledger = JSON.parse(readFileSync(join(f.stateDir, 'workspaces.json'), 'utf8'));
  assert.equal(ledger.projects.length, 1);
  assert.equal(ledger.projects[0].workspaces.length, 1);
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).projectId, f.projectId);
  console.log('PASS: default project registration and example mount; restart reuses identity and mount.');
} finally {
  try { await app?.stop(); } finally { rmSync(f.directory, { recursive: true, force: true }); }
}
