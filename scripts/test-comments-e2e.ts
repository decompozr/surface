/** Run from the repository root. Builds a disposable immutable snapshot; never touches the live preview. */
import { cpSync, mkdirSync, symlinkSync, writeFileSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve, join } from 'node:path';
const root = process.cwd();
const output = resolve(process.env.COMMENTS_E2E_OUTPUT ?? `.decompozr/surface/comments-e2e/${Date.now()}`);
mkdirSync(output, { recursive: true });
async function run(args: string[], env: Record<string, string> = {}) {
  const child = Bun.spawn(args, { cwd: root, env: { ...process.env, ...env }, stdout: 'inherit', stderr: 'inherit' });
  if (await child.exited !== 0) throw new Error(`Failed: ${args.join(' ')}. Evidence: ${output}`);
}
await run(['bun', 'run', '--cwd', 'apps/surface', 'check']);
await run(['bun', 'test', 'apps/surface/comments/delivery.test.ts']);
await run(['bun', 'run', '--cwd', 'apps/surface', 'build']);
const snapshot = join(output, 'release'); mkdirSync(snapshot);
cpSync(resolve('apps/surface/build'), join(snapshot, 'build'), { recursive: true });
writeFileSync(join(snapshot, 'package.json'), '{"type":"module"}\n');
symlinkSync(resolve('apps/surface/node_modules'), join(snapshot, 'node_modules'), 'dir');
for (const scenario of ['idle', 'active']) {
  await run(['bun', 'apps/surface/comments/full-loop.e2e.ts'], {
    COMMENTS_E2E_BUILD_DIR: snapshot,
    COMMENTS_E2E_OUTPUT: join(output, scenario),
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
} finally { server.kill(); await server.exited; }
const git = Bun.spawn(['git', 'rev-parse', 'HEAD'], { stdout: 'pipe' });
const head = (await new Response(git.stdout).text()).trim(); await git.exited;
writeFileSync(join(output, 'report.json'), JSON.stringify({ status: 'passed', head, source: 'current worktree including WIP', snapshot, scenarios: ['idle', 'active'], profiles: ['Chromium desktop', 'WebKit iPhone 13 emulation'], provider: 'isolated local protocol fixture', physicalDevice: false, reports: ['idle','active'].map(name => JSON.parse(readFileSync(join(output, name, 'report.json'), 'utf8'))) }, null, 2));
console.log(`Comments E2E matrix passed. Evidence: ${output}`);
