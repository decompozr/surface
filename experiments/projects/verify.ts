import { chromium } from '@playwright/test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, realpathSync, renameSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startSingleton } from '../../apps/surface/runtime/server.ts';
import { manifestName, withLock } from './project.ts';

const directory = realpathSync(mkdtempSync(join(tmpdir(), 'surface-projects-'))), stateDir = join(directory, 'server');
const evidenceDir = join(import.meta.dir, '../../.decompozr/surface/project-management-proof');
mkdirSync(evidenceDir, { recursive: true });
const observations: string[] = [];
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function observed(message: string) { observations.push(message); console.log(message); }
function project(name: string) {
  const root = join(directory, name), source = join(root, 'artifacts/panel');
  mkdirSync(join(source, 'src'), { recursive: true });
  writeFileSync(join(root, 'README.md'), `User-owned ${name} repository.\n`);
  writeFileSync(join(source, 'package.json'), JSON.stringify({ name, private: true, type: 'module', dependencies: { svelte: '5.57.1' } }));
  writeFileSync(join(source, 'src/Panel.svelte'), '<script lang="ts">let count = $state(0); let draft = $state("");</script><h1>Project-owned panel</h1><input aria-label="Draft" bind:value={draft}/><button onclick={() => count++}>Count {count}</button>');
  return { root, source };
}
const alpha = project('alpha'), beta = project('beta');
const originalReadme = readFileSync(join(alpha.root, 'README.md'), 'utf8');
const originalSource = readFileSync(join(alpha.source, 'src/Panel.svelte'), 'utf8');
const originalPackage = readFileSync(join(alpha.source, 'package.json'), 'utf8');
async function call(project: string, ...args: string[]) {
  const child = Bun.spawn([process.execPath, join(import.meta.dir, 'cli.ts'), ...args, '--project', project, '--state-dir', stateDir], { stdout: 'pipe', stderr: 'pipe' });
  const [output, error, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  return { code, error, data: code === 0 ? JSON.parse(output) : undefined };
}
async function cli(project: string, ...args: string[]) { const result = await call(project, ...args); assert(result.code === 0, `${args[0]}: ${result.error}`); return result.data; }
async function rejects(project: string, text: string, ...args: string[]) { const result = await call(project, ...args); assert(result.code !== 0 && result.error.includes(text), `Expected ${text}, received ${JSON.stringify(result)}`); }
let app: Awaited<ReturnType<typeof startSingleton>> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  const aProject = await cli(alpha.root, 'init', '--name', 'Design project'), bProject = await cli(beta.root, 'init', '--name', 'Analysis project');
  await rejects(alpha.root, 'refusing to overwrite', 'init');
  const a = await cli(alpha.root, 'add', '--source', 'artifacts/panel', '--name', 'Controls');
  const b = await cli(beta.root, 'add', '--source', 'artifacts/panel', '--name', 'Controls');
  assert(a.name === 'Controls' && b.name === 'Controls' && a.route.namespace !== b.route.namespace && a.id !== b.id, 'Display labels became cross-project identity.');
  const manifest = JSON.parse(readFileSync(join(alpha.root, manifestName), 'utf8'));
  assert(manifest.artifacts[0].source === 'artifacts/panel' && !JSON.stringify(manifest).includes(directory), 'Versionable manifest embeds absolute local paths.');
  await rejects(alpha.root, 'name already exists', 'add', '--source', 'artifacts/panel', '--name', 'Controls');
  await rejects(alpha.root, 'duplicates or overlaps', 'add', '--source', 'artifacts/panel', '--name', 'Alias');
  await rejects(alpha.root, 'parent traversal', 'add', '--source', '../beta/artifacts/panel', '--name', 'Escape');
  symlinkSync(beta.source, join(alpha.root, 'outside'), 'dir');
  await rejects(alpha.root, 'outside the canonical project', 'add', '--source', 'outside', '--name', 'Symlink escape');
  observed('Project-owned relative-path manifests preserve stable UUID identities; identical display labels across projects remain independent, and overwrite/duplicate/traversal/symlink escapes are rejected.');

  app = await startSingleton({ stateDir, port: 0 });
  await cli(alpha.root, 'register'); await cli(beta.root, 'register');
  const mountA = await cli(alpha.root, 'mount', '--artifact', a.id), mountB = await cli(beta.root, 'mount', '--artifact', b.id);
  assert(mountA.projectRoot === alpha.root && mountA.source === alpha.source && mountA.label === 'Controls', 'Nested source/project binding is wrong.');
  assert(mountA.namespace !== mountB.namespace, 'Cross-project routes collided.');
  assert(existsSync(join(alpha.source, 'bun.lock')) && existsSync(join(alpha.source, 'node_modules')), 'Mount did not prepare project-owned dependencies.');
  const lockfile = readFileSync(join(alpha.source, 'bun.lock'), 'utf8');
  const vite = app.vite;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  await page.goto(mountA.previewUrl + '?component=src%2FPanel.svelte');
  await page.getByRole('heading', { name: 'Project-owned panel' }).waitFor();
  await page.getByRole('textbox').fill('Project draft');
  await page.getByRole('button', { name: 'Count 0' }).click();
  await page.getByRole('button', { name: 'Count 1' }).waitFor();
  await page.screenshot({ path: join(evidenceDir, 'project-panel.png'), fullPage: true });
  observed('The project CLI mounts nested project-owned Svelte sources through the existing singleton; the browser renders an interactive form, with source-local Bun lockfile/node_modules.');

  const renamed = JSON.parse(readFileSync(join(alpha.root, manifestName), 'utf8'));
  renamed.artifacts[0].name = 'Renamed controls';
  writeFileSync(join(alpha.root, manifestName), JSON.stringify(renamed, null, 2));
  const relisted = await cli(alpha.root, 'list');
  assert(relisted.artifacts[0].id === a.id && relisted.artifacts[0].route.name === a.route.name && relisted.artifacts[0].name === 'Renamed controls', 'Renaming label altered stable identity.');
  await rejects(alpha.root, 'not archived', 'restore', '--artifact', a.id);
  await cli(alpha.root, 'archive', '--artifact', a.id);
  assert((await fetch(mountA.previewUrl)).status === 404, 'Archived preview remained available.');
  assert((await cli(alpha.root, 'list')).artifacts[0].archived === true, 'Archive flag missing.');
  await rejects(alpha.root, 'archived', 'mount', '--artifact', a.id);
  assert(existsSync(join(alpha.source, 'node_modules')) && readFileSync(join(alpha.source, 'bun.lock'), 'utf8') === lockfile, 'Archive changed dependency state.');
  await cli(alpha.root, 'restore', '--artifact', a.id);
  assert((await fetch(mountA.previewUrl)).status === 404, 'Restore implicitly mounted the source.');
  const restored = await cli(alpha.root, 'mount', '--artifact', a.id);
  assert(restored.previewUrl === mountA.previewUrl && app.vite === vite, 'Restore changed stable route/shared compiler.');
  observed('Labels can change without changing identity. Archive unmounts and retains sources/dependencies; restore only changes metadata, and explicit remount restores the stable route.');

  await cli(alpha.root, 'unmount', '--artifact', a.id);
  renameSync(alpha.source, alpha.source + '-missing');
  const missing = await cli(alpha.root, 'list');
  assert(missing.artifacts[0].sourceStatus === 'unavailable', 'Missing source was presented as healthy.');
  await rejects(alpha.root, 'ENOENT', 'mount', '--artifact', a.id);
  await cli(alpha.root, 'archive', '--artifact', a.id); // Missing source can be unmounted/archived without deleting records.
  await rejects(alpha.root, 'ENOENT', 'restore', '--artifact', a.id);
  renameSync(alpha.source + '-missing', alpha.source);
  await cli(alpha.root, 'restore', '--artifact', a.id);
  await cli(alpha.root, 'mount', '--artifact', a.id);
  const moved = project('copied-alpha');
  writeFileSync(join(moved.root, manifestName), readFileSync(join(alpha.root, manifestName)));
  await rejects(moved.root, 'already bound to another canonical root', 'register');
  await rejects(moved.root, 'already bound to another canonical root', 'mount', '--artifact', a.id);
  observed('Missing sources remain visible and block mount/restore until returned. Copying a manifest to another canonical root is explicitly rejected by the server-local identity ledger.');

  // A held real lock deterministically rejects a competing CLI writer without lost updates.
  await withLock(join(alpha.root, '.artifact-project.lock'), async () => {
    await rejects(alpha.root, 'Ownership lock exists', 'archive', '--artifact', a.id);
  });
  const beforeLock = readFileSync(join(alpha.root, manifestName), 'utf8');
  await withLock(join(stateDir, 'project-bindings.lock'), async () => {
    await rejects(beta.root, 'Ownership lock exists', 'register');
  });
  assert(readFileSync(join(alpha.root, manifestName), 'utf8') === beforeLock, 'Competing operation corrupted project manifest.');
  // Different project locks cannot protect a shared copied UUID; the ledger lock must.
  const raceA = project('race-a'), raceB = project('race-b');
  const raceIdentity = await cli(raceA.root, 'init');
  writeFileSync(join(raceB.root, manifestName), readFileSync(join(raceA.root, manifestName)));
  const registrations = await Promise.all([call(raceA.root, 'register'), call(raceB.root, 'register')]);
  assert(registrations.filter(result => result.code === 0).length === 1, 'Concurrent copied identities were registered twice.');
  const ledger = JSON.parse(readFileSync(join(stateDir, 'project-bindings.json'), 'utf8'));
  assert(ledger.projects.filter((entry: any) => entry.projectId === raceIdentity.projectId).length === 1, 'Concurrent ledger writes duplicated/lost identity ownership.');
  const loser = registrations[0]!.code === 0 ? raceB.root : raceA.root;
  await rejects(loser, 'already bound to another canonical root', 'register');
  observed('Project manifest and singleton binding ledger each enforce exclusive writers; concurrent copied UUID registrations yield exactly one owner without silent rebinding.');

  await app.stop(); app = await startSingleton({ stateDir, port: 0 });
  const afterRestart = await cli(alpha.root, 'mount', '--artifact', a.id);
  assert(afterRestart.namespace === a.route.namespace && afterRestart.name === a.route.name, 'Restart changed stable artifact route identity.');
  await page.goto(afterRestart.previewUrl + '?component=src%2FPanel.svelte');
  await page.getByRole('heading', { name: 'Project-owned panel' }).waitFor();
  assert(readFileSync(join(alpha.root, 'README.md'), 'utf8') === originalReadme && readFileSync(join(alpha.source, 'src/Panel.svelte'), 'utf8') === originalSource && readFileSync(join(alpha.source, 'package.json'), 'utf8') === originalPackage, 'Management changed normal user files.');
  assert(readFileSync(join(alpha.source, 'bun.lock'), 'utf8') === lockfile, 'Restart changed the existing frozen source lockfile.');
  assert((await cli(alpha.root, 'list')).projectId === aProject.projectId && (await cli(beta.root, 'list')).projectId === bProject.projectId, 'Restart changed project IDs.');
  observed('Explicit singleton restart restores mounted project artifacts and ledger identity; user README/component/package files and existing Bun lockfile remain byte-for-byte unchanged.');
  writeFileSync(join(evidenceDir, 'result.json'), JSON.stringify({ at: new Date().toISOString(), observations, liveAgent: false, manifestsVersion: 1 }, null, 2));
  console.log('PASS: project artifact management experiment.');
} finally { await browser?.close(); await app?.stop(); rmSync(directory, { recursive: true, force: true }); }
