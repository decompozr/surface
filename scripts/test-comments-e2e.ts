/** Run from the repository root. Builds a disposable immutable snapshot; never touches the live preview. */
import { cpSync, mkdirSync, symlinkSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { resolve, join } from 'node:path';
import { verifyBundle } from '../apps/surface/src/installation/bundle';
const root = process.cwd();
const output = resolve(process.env.COMMENTS_E2E_OUTPUT ?? `.decompozr/surface/comments-e2e/${Date.now()}`);
mkdirSync(output, { recursive: true });
async function run(args: string[], env: Record<string, string> = {}) {
  const child = Bun.spawn(args, { cwd: root, env: { ...process.env, ...env }, stdout: 'inherit', stderr: 'inherit' });
  if (await child.exited !== 0) throw new Error(`Failed: ${args.join(' ')}. Evidence: ${output}`);
}
await run(['bun', 'test', 'apps/surface/comments/delivery.test.ts', 'apps/surface/comments/mounted.test.ts']);
const prepared = process.env.COMMENTS_E2E_PREPARED_RELEASE && resolve(process.env.COMMENTS_E2E_PREPARED_RELEASE);
const bundle = prepared ? verifyBundle(prepared) : undefined;
let snapshot: string, appSnapshot: string;
const manifest: { path: string; sha256: string }[] = [];
if (prepared && bundle) {
  // Validate a packaged release without rebuilding or changing its dependencies.
  snapshot = join(prepared, 'apps/surface'); appSnapshot = snapshot;
  for (const [path, sha256] of Object.entries(bundle.files)) manifest.push({ path, sha256 });
  writeFileSync(join(output, 'prepared-release.json'), JSON.stringify({ directory: prepared, commit: bundle.commit, version: bundle.version }, null, 2));
} else {
await run(['bun', 'run', '--cwd', 'apps/surface', 'check']);
await run(['bun', 'run', '--cwd', 'apps/surface', 'build']);
snapshot = join(output, 'release'); mkdirSync(snapshot);
cpSync(resolve('apps/surface/build'), join(snapshot, 'build'), { recursive: true });
writeFileSync(join(snapshot, 'package.json'), '{"type":"module"}\n');
symlinkSync(resolve('apps/surface/node_modules'), join(snapshot, 'node_modules'), 'dir');
appSnapshot = join(snapshot, 'app'); mkdirSync(appSnapshot);
for (const directory of ['src', 'server', 'runtime', 'comments', 'templates']) cpSync(resolve('apps/surface', directory), join(appSnapshot, directory), { recursive: true, filter: path => !path.split('/').some(part => ['node_modules', '.vite'].includes(part)) });
cpSync(resolve('apps/surface/build'), join(appSnapshot, 'build'), { recursive: true });
cpSync(resolve('apps/surface/package.json'), join(appSnapshot, 'package.json'));
symlinkSync(resolve('apps/surface/node_modules'), join(appSnapshot, 'node_modules'), 'dir');
symlinkSync(resolve('apps/surface/runtime/node_modules'), join(appSnapshot, 'runtime/node_modules'), 'dir');
function hashTree(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) hashTree(path);
    else if (entry.isFile()) manifest.push({ path: path.slice(snapshot.length + 1), sha256: createHash('sha256').update(readFileSync(path)).digest('hex') });
  }
}
hashTree(snapshot);
}
writeFileSync(join(output, 'snapshot-manifest.json'), JSON.stringify(manifest, null, 2));
for (const scenario of ['idle', 'active']) {
  await run(['bun', 'apps/surface/comments/full-loop.e2e.ts'], {
    COMMENTS_E2E_BUILD_DIR: snapshot,
    COMMENTS_E2E_OUTPUT: join(output, scenario),
    COMMENTS_E2E_ACTIVE: scenario === 'idle' ? '0' : '1',
  });
}
for (const scenario of ['idle', 'active']) {
  await run(['bun', 'apps/surface/comments/mounted.e2e.ts'], {
    COMMENTS_E2E_APP_DIR: appSnapshot,
    COMMENTS_E2E_OUTPUT: join(output, `mounted-${scenario}`),
    COMMENTS_E2E_ACTIVE: scenario === 'idle' ? '0' : '1',
  });
}
// Geometry tests use the same build with a local-only recipient and no real state.
const reservation = createServer();
await new Promise<void>(resolve => reservation.listen(0, '127.0.0.1', resolve));
const port = (reservation.address() as { port: number }).port;
await new Promise<void>(resolve => reservation.close(() => resolve()));
const origin = `http://127.0.0.1:${port}`;
const environment: Record<string, string | undefined> = { ...process.env, HOST: '127.0.0.1', PORT: String(port), ORIGIN: origin, SURFACE_COMMENTS_ORIGIN: origin, SURFACE_COMMENTS_EXPERIMENT: '1' };
delete environment.SURFACE_COMMENTS_STATE_DIR;
const server = Bun.spawn(['bun', 'build/index.js'], { cwd: snapshot, env: environment, stdout: Bun.file(join(output, 'geometry-server.log')), stderr: 'inherit' });
try {
  let healthy = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { healthy = (await fetch(origin + '/experiments/comments')).ok; } catch {}
    if (healthy) break;
    await Bun.sleep(100);
  }
  if (!healthy) throw new Error('Isolated geometry server did not become ready');
  await run(['bun', 'apps/surface/comments/toolbar-scroll.e2e.ts'], { COMMENTS_E2E_ORIGIN: origin, COMMENTS_E2E_OUTPUT: join(output, 'toolbar') });
  await run(['bun', 'apps/surface/comments/mobile-desktop.e2e.ts'], { COMMENTS_E2E_ORIGIN: origin, COMMENTS_E2E_OUTPUT: join(output, 'interaction-audit') });
  await run(['bun', 'apps/surface/comments/viewport.e2e.ts'], { COMMENTS_E2E_ORIGIN: origin, COMMENTS_E2E_OUTPUT: join(output, 'viewport-audit') });
} finally { server.kill(); await server.exited; }
const git = Bun.spawn(['git', 'rev-parse', 'HEAD'], { stdout: 'pipe' });
const worktreeHead = (await new Response(git.stdout).text()).trim(); await git.exited;
const head = bundle?.commit ?? worktreeHead;
if (prepared) verifyBundle(prepared); // The verifier must leave the package immutable.
writeFileSync(join(output, 'report.json'), JSON.stringify({ status: 'passed', head, source: prepared ? 'verified prepared release' : 'current worktree including WIP', snapshot, scenarios: ['idle', 'active'], profiles: ['Chromium desktop', 'WebKit iPhone 13 emulation'], provider: 'isolated local protocol fixture', physicalDevice: false, snapshotManifestSha256: createHash('sha256').update(JSON.stringify(manifest)).digest('hex'), reports: ['idle','active','mounted-idle','mounted-active'].map(name => JSON.parse(readFileSync(join(output, name, 'report.json'), 'utf8'))) }, null, 2));
console.log(`Comments E2E matrix passed. Evidence: ${output}`);
