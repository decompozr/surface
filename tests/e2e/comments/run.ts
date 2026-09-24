/** Run from the repository root. Builds a disposable immutable snapshot; never touches the live preview. */
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { resolve, join } from 'node:path';
import { materializeDesignSystem } from '@decompozr/surface-cli/installation/design-system';
import { verifyBundle } from '@decompozr/surface-cli/installation/bundle';

const run = async (args: string[], env: Record<string, string> = {}, cwd = root) => {
  const child = Bun.spawn(args, { cwd, env: { ...process.env, ...env }, stdout: 'inherit', stderr: 'inherit' });
  if (await child.exited !== 0) throw new Error(`Failed: ${args.join(' ')}. Evidence: ${output}`);
};

const root = process.cwd();
const output = resolve(process.env.COMMENTS_E2E_OUTPUT ?? `.decompozr/surface/comments-e2e/${Date.now()}`);
mkdirSync(output, { recursive: true });
await run(['bun', 'test', 'apps/surface/src/lib/server/comments/delivery.test.ts', 'apps/surface/src/lib/server/comments/mounted.test.ts']);
const prepared = process.env.COMMENTS_E2E_PREPARED_RELEASE && resolve(process.env.COMMENTS_E2E_PREPARED_RELEASE);
const bundle = prepared ? verifyBundle(prepared) : undefined;
const temporary = mkdtempSync(join(tmpdir(), 'surface-comments-verification-'));
try {
  const productionRoot = prepared ?? join(temporary, 'production');
  const copySource = (from: string, to: string) => {
    mkdirSync(to, { recursive: true });
    for (const directory of ['apps', 'node_modules']) {
      cpSync(join(from, directory), join(to, directory), {
        recursive: true, verbatimSymlinks: true,
        filter: path => !['apps/surface/.svelte-kit', 'apps/surface/build', 'apps/surface/node_modules/.vite', 'node_modules/.vite'].some(excluded => path === join(from, excluded) || path.startsWith(join(from, excluded) + '/')),
      });
    }
    for (const file of ['package.json', 'bun.lock']) cpSync(join(from, file), join(to, file));
  };
  if (!prepared) {
    copySource(root, productionRoot);
    materializeDesignSystem(root, productionRoot);
    await run(['bun', 'run', '--cwd', 'apps/surface', 'check'], {}, productionRoot);
    await run(['bun', 'run', '--cwd', 'apps/surface', 'build'], {}, productionRoot);
  }
  const appSnapshot = join(productionRoot, 'apps/surface');
  // Demo endpoints exist only in this separate test build, never in the release.
  const fixtureRoot = join(temporary, 'fixture');
  copySource(productionRoot, fixtureRoot);
  const snapshot = join(fixtureRoot, 'apps/surface');
  cpSync(join(root, 'tests/fixtures/comments-app/src'), join(snapshot, 'src'), { recursive: true });
  await run(['bun', 'run', '--cwd', 'apps/surface', 'check'], {}, fixtureRoot);
  await run(['bun', 'run', '--cwd', 'apps/surface', 'build'], {}, fixtureRoot);
  const manifest: { path: string; sha256: string }[] = [];
  const hashTree = (directory: string, prefix: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === 'node_modules' || entry.name === '.svelte-kit') continue;
      const path = join(directory, entry.name), name = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) hashTree(path, name);
      else if (entry.isFile()) manifest.push({ path: name, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') });
    }
  };
  hashTree(join(productionRoot, 'apps'), 'production/apps');
  hashTree(join(fixtureRoot, 'apps'), 'fixture/apps');
  writeFileSync(join(output, 'snapshot-manifest.json'), JSON.stringify(manifest, null, 2));
  if (prepared && bundle) writeFileSync(join(output, 'prepared-release.json'), JSON.stringify({ directory: prepared, commit: bundle.commit, version: bundle.version }, null, 2));
for (const scenario of ['idle', 'active']) {
  await run(['bun', 'tests/e2e/comments/full-loop.e2e.ts'], {
    COMMENTS_E2E_BUILD_DIR: snapshot,
    COMMENTS_E2E_OUTPUT: join(output, scenario),
    COMMENTS_E2E_ACTIVE: scenario === 'idle' ? '0' : '1',
  });
}
for (const scenario of ['idle', 'active']) {
  await run(['bun', 'tests/e2e/comments/mounted.e2e.ts'], {
    COMMENTS_E2E_APP_DIR: appSnapshot,
    COMMENTS_E2E_OUTPUT: join(output, `mounted-${scenario}`),
    COMMENTS_E2E_ACTIVE: scenario === 'idle' ? '0' : '1',
  });
}
// Geometry tests use the fixture build with a local-only recipient and no real state.
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
  await run(['bun', 'tests/e2e/comments/toolbar-scroll.e2e.ts'], { COMMENTS_E2E_ORIGIN: origin, COMMENTS_E2E_OUTPUT: join(output, 'toolbar') });
  await run(['bun', 'tests/e2e/comments/mobile-desktop.e2e.ts'], { COMMENTS_E2E_ORIGIN: origin, COMMENTS_E2E_OUTPUT: join(output, 'interaction-audit') });
  await run(['bun', 'tests/e2e/comments/viewport.e2e.ts'], { COMMENTS_E2E_ORIGIN: origin, COMMENTS_E2E_OUTPUT: join(output, 'viewport-audit') });
} finally { server.kill(); await server.exited; }
const git = Bun.spawn(['git', 'rev-parse', 'HEAD'], { cwd: root, stdout: 'pipe', stderr: 'pipe' });
const [revision, gitExit] = await Promise.all([new Response(git.stdout).text(), git.exited]);
const head = bundle?.commit ?? (gitExit === 0 ? revision.trim() : null);
if (prepared) verifyBundle(prepared); // The verifier must leave the package immutable.
writeFileSync(join(output, 'report.json'), JSON.stringify({ status: 'passed', head, source: prepared ? 'verified prepared release' : 'source snapshot including local changes; inventory identifies tested bytes', builds: { production: 'untouched production build', fixture: 'separate test-only source overlay' }, scenarios: ['idle', 'active'], profiles: ['Chromium desktop', 'WebKit iPhone 13 emulation'], provider: 'isolated local protocol fixture', physicalDevice: false, snapshotManifestSha256: createHash('sha256').update(JSON.stringify(manifest)).digest('hex'), reports: ['idle','active','mounted-idle','mounted-active'].map(name => JSON.parse(readFileSync(join(output, name, 'report.json'), 'utf8'))) }, null, 2));
console.log(`Comments E2E matrix passed. Evidence: ${output}`);

} finally {
  rmSync(temporary, { recursive: true, force: true });
}
