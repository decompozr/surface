import { chromium, expect } from '@playwright/test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, realpathSync, existsSync, renameSync, lstatSync, readlinkSync, symlinkSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { createServer } from 'node:net';
import { hash, preferencesFile } from './compatibility.ts';


const assert: (value: unknown, message: string) => asserts value = (value: unknown, message: string): asserts value => { if (!value) throw new Error(message); };

const command = async (args: string[], cwd = unrelated) => {
  const child = Bun.spawn(args, { cwd, env: { ...process.env, SURFACE_HOME: join(directory, 'wrong-environment-home'), GIT_AUTHOR_NAME: 'Surface Experiment', GIT_AUTHOR_EMAIL: 'surface@example.invalid', GIT_COMMITTER_NAME: 'Surface Experiment', GIT_COMMITTER_EMAIL: 'surface@example.invalid' }, stdout: 'pipe', stderr: 'pipe' });
  const [code, out, err] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  return { code, out, err };
};

const must = async (args: string[], cwd?: string) => { const result = await command(args, cwd); assert(result.code === 0, `${args.slice(0,4).join(' ')} failed:\n${result.err}\n${result.out}`); return result.out.trim(); };

const cli = async (...args: string[]) => { return JSON.parse(await must([process.execPath, launcher, ...args, '--home', home])); };

const rejectCli = async (message: string, ...args: string[]) => {
  const result = await command([process.execPath, launcher, ...args, '--home', home]);
  assert(result.code !== 0 && result.err.includes(message), `Expected ${message}: ${result.out} ${result.err}`);
};

const git = async (...args: string[]) => { return must(['git', '-C', repo, ...args]); };

const snapshot = async () => {
  const paths = (await must(['git', '-C', source, 'ls-files', '-z'])).split('\0').filter(Boolean);
  const added = (await must(['git', '-C', source, 'ls-files', '--others', '--exclude-standard', '-z'])).split('\0').filter(path => path.startsWith('experiments/server-contract/'));
  for (const path of [...new Set([...paths, ...added])]) {
    const from = join(source, path), to = join(repo, path); if (!existsSync(from)) continue;
    mkdirSync(dirname(to), { recursive: true });
    if (lstatSync(from).isSymbolicLink()) { symlinkSync(readlinkSync(from), to); sourceHashes[path] = hash(readlinkSync(from)); }
    else { copyFileSync(from, to); sourceHashes[path] = hash(readFileSync(from)); }
  }
  await git('init', '-q'); await git('config', 'commit.gpgsign', 'false');
  const descriptor = join(repo, 'experiments/server-contract/compatibility.json');
  writeFileSync(descriptor, JSON.stringify({ version: 1, preferencesReadVersions: [1] }) + '\n');
  await git('add', '.'); await git('commit', '-qm', 'Experimental release A reads preferences schema 1');
  const a = await git('rev-parse', 'HEAD');
  writeFileSync(descriptor, JSON.stringify({ version: 1, preferencesReadVersions: [1, 2] }) + '\n');
  await git('add', '.'); await git('commit', '-qm', 'Experimental release B adds schema 2 reader and migration');
  const b = await git('rev-parse', 'HEAD');
  writeFileSync(descriptor, '{"version":1,"preferencesReadVersions":[99]}\n');
  await git('add', '.'); await git('commit', '-qm', 'Deliberately invalid compatibility candidate');
  const bad = await git('rev-parse', 'HEAD');
  writeFileSync(descriptor, JSON.stringify({ version: 1, preferencesReadVersions: [1, 2] }) + '\n');
  writeFileSync(join(repo, 'experiments/server-contract/launcher.ts'), 'deliberately invalid TypeScript {{{');
  await git('add', '.'); await git('commit', '-qm', 'Deliberately broken launcher bundle candidate');
  return { a, b, bad, badLauncher: await git('rev-parse', 'HEAD') };
};

const project = (label: string, backend = true) => {
  const root = join(directory, label), ui = join(root, 'ui'); mkdirSync(join(ui, 'src'), { recursive: true });
  copyFileSync(join(source, 'experiments/project-database/fixtures', backend ? 'Scenarios.svelte' : 'Local.svelte'), join(ui, 'src/Scenarios.svelte'));
  writeFileSync(join(ui, 'package.json'), JSON.stringify({ name: `contract-${label}`, private: true, type: 'module', dependencies: { svelte: '5.57.1' } }));
  writeFileSync(join(ui, 'artifact.json'), JSON.stringify({ framework: 'svelte', components: 'src', props: { 'src/Scenarios.svelte': { label } } }));
  if (backend) {
    writeFileSync(join(root, 'backend.ts'), readFileSync(join(source, 'experiments/project-database/fixtures/backend.ts'), 'utf8') + '\nexport const apiVersion = 1;\n');
    writeFileSync(join(root, 'surface.backend.json'), JSON.stringify({ version: 1, api: 1, entry: 'backend.ts', operations: ['describeProject', 'listScenarios', 'saveScenario'] }));
  }
  return { label, root, ui, backend, db: join(root, 'data/scenarios.sqlite'), id: '', scope: '', preview: '' };
};

const projectCli = async (p: typeof alpha, operation: string, ...args: string[]) => {
  const result = await cli('project', operation, '--project', p.root, ...args); assert(result.ok, JSON.stringify(result)); return result.data;
};

const mount = async (p: typeof alpha) => {
  const result = await projectCli(p, 'mount', '--artifact', p.id);
  assert(result.status === 'ready', JSON.stringify(result));
  p.scope = `${result.namespace}/${result.name}`; p.preview = result.previewUrl;
};

const start = async (port?: number) => {
  const result = await cli('start', ...(port === undefined ? [] : ['--port', String(port)]));
  running = true; pids.push(result.pid); connection = JSON.parse(readFileSync(join(state, 'connection.json'), 'utf8'));
  assert(connection.pid === result.pid, 'Connection/owner PID mismatch.');
  for (const p of projects.filter(p => p.id)) await mount(p);
};

const stop = async () => { await cli('stop'); running = false; assert(!existsSync(join(state, 'server.lock')), 'Server lock remains after stop.'); };

const access = async () => { return await cli('access') as { scope: string; token: string; database: { databaseOpen: boolean; opens: number } }[]; };

const capability = async (p: typeof alpha) => { const entry = (await access()).find(entry => entry.scope === p.scope); assert(entry, `Missing backend ${p.label}`); return entry.token; };

const action = async (p: typeof alpha, token: string, operation: string, input: unknown) => {
  const response = await fetch(`${connection.origin}/project-db/${p.scope}/actions`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-project-capability': token }, body: JSON.stringify({ operation, input }) });
  return { status: response.status, ...await response.json() };
};

const unopened = async (selected: typeof projects, absent = true) => {
  const files = (await must(['/usr/sbin/lsof', '-nP', '-p', String(connection.pid), '-Fn'])).split('\n');
  const entries = await access();
  for (const p of selected) {
    if (absent) assert(!existsSync(join(p.root, 'data')), `${p.label} created data without demand.`);
    assert(!files.some(file => file === 'n' + p.db || file.startsWith('n' + p.db + '-')), `${p.label} opened SQLite without demand.`);
    const entry = entries.find(entry => entry.scope === p.scope);
    assert(!entry || (!entry.database.databaseOpen && entry.database.opens === 0), `${p.label} has unexpected storage acquisition.`);
  }
};

const rows = async (p: typeof alpha) => { const result = await action(p, await capability(p), 'listScenarios', {}); assert(result.ok, JSON.stringify(result)); return result.data; };

const dbRows = (p: typeof alpha) => { const db = new Database(p.db, { readonly: true }); try { assert((db.query('PRAGMA integrity_check').get() as any).integrity_check === 'ok', 'SQLite integrity failure.'); return db.query('SELECT * FROM scenarios ORDER BY id').all(); } finally { db.close(); } };

const source = resolve(import.meta.dir, '../..'), directory = realpathSync(mkdtempSync('/tmp/surface-contract-'));
const home = join(directory, 'Surface Home'), state = join(home, 'state'), unrelated = join(directory, 'unrelated');
let repo = join(directory, 'fixture-source'); mkdirSync(repo); mkdirSync(unrelated);
const evidence = join(source, '.decompozr/surface/server-contract-proof'); mkdirSync(evidence, { recursive: true });
const observations: string[] = [], pids: number[] = [], sourceHashes: Record<string,string> = {};
const observed = (message: string) => { observations.push(message); console.log(message); };
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined, running = false, success = false;
let launcher = join(source, 'experiments/server-contract/launcher.ts');
let connection!: { origin: string; token: string; pid: number };
let releaseA = '', releaseB = '', lastError = '';
const alpha = project('alpha'), beta = project('beta'), unused = project('unused'), plain = project('plain', false), projects = [alpha, beta, unused, plain];
writeFileSync(join(evidence, 'result.json'), JSON.stringify({ passed: false, status: 'running', directory }));
try {
  const revisions = await snapshot();
  writeFileSync(join(evidence, 'source.json'), JSON.stringify({ originalHead: await must(['git', '-C', source, 'rev-parse', 'HEAD']), revisions, sourceHashes }, null, 2));
  observed('Snapshotted current task source into independent pinned fixture commits A, B, and invalid compatibility candidate.');
  const installed = await cli('install', '--repo', repo, '--ref', revisions.a); releaseA = installed.release;
  launcher = join(home, 'bin/surface'); assert(existsSync(launcher), 'Installed launcher missing.');
  assert(JSON.parse(await must([launcher, 'status', '--home', home])).status === 'stopped', 'Executable launcher entry failed.');
  renameSync(repo, repo + '-hidden'); repo += '-hidden';
  const reserve = createServer(); await new Promise<void>(done => reserve.listen(0, '127.0.0.1', done));
  const port = (reserve.address() as { port: number }).port;
  await rejectCli('did not become ready', 'start', '--port', String(port));
  assert(!existsSync(join(home, 'run/owner.json')) && !existsSync(join(state, 'server.lock')), 'Failed port bind left ownership.');
  await new Promise<void>(done => reserve.close(() => done()));
  await start(port); const origin = connection.origin, firstPid = connection.pid;
  assert(new URL(origin).port === String(port), 'Host silently changed port.');
  assert((await cli('status')).status === 'running', 'Installed status failed.');
  assert(!existsSync(join(directory, 'wrong-environment-home')), 'Explicit home did not override environment.');
  const listeners = (await must(['/usr/sbin/lsof', '-nP', '-a', '-p', String(connection.pid), '-iTCP', '-sTCP:LISTEN', '-Fn'])).split('\n').filter(line => line.startsWith('n'));
  assert(listeners.length === 1, 'Expected one application TCP listener.');
  observed('Installed bundled launcher works from unrelated cwd after fixture checkout move; explicit home with spaces wins over environment. Occupied fixed port fails without fallback; one HTTP listener.');
  for (const p of projects) {
    await projectCli(p, 'init'); const added = await projectCli(p, 'add', '--source', 'ui', '--name', 'Scenarios'); p.id = added.id;
    await projectCli(p, 'register'); await mount(p);
  }
  await unopened(projects); assert((await access()).length === 3, 'Plain project acquired a backend.');
  const unusedToken = await capability(unused), alphaToken = await capability(alpha);
  assert((await action(unused, unusedToken, 'describeProject', {})).ok, 'Non-data action failed.');
  assert((await action(unused, unusedToken, 'failSaveForTest', {})).code === 'undeclared_operation', 'Undeclared action reached backend.');
  assert((await action(unused, unusedToken, 'saveScenario', {})).code === 'invalid_input', 'Invalid data action was not rejected.');
  assert((await action(unused, alphaToken, 'listScenarios', {})).status === 403, 'Cross-project capability accepted.');
  await unopened(projects);
  browser = await chromium.launch({ channel: 'chrome', headless: true }); const page = await browser.newPage();
  const shell = await browser.newPage(); await shell.goto(origin + '/manage'); await expect(shell.getByRole('heading', { name: 'SvelteKit singleton foundation' })).toBeVisible();
  await shell.screenshot({ path: join(evidence, 'management.png'), fullPage: true });
  await page.goto(`${plain.preview}?component=src%2FScenarios.svelte`); await page.getByRole('button', { name: 'Count 0' }).click(); await expect(page.getByRole('button', { name: 'Count 1' })).toBeVisible();
  await page.goto(`${alpha.preview}?component=src%2FScenarios.svelte#db=${alphaToken}`);
  await page.getByLabel('Scenario name', { exact: true }).fill('Installed project decision'); await unopened(projects);
  await page.getByRole('button', { name: 'Save scenario', exact: true }).click(); await expect(page.getByRole('status')).toHaveText('Saved to this project');
  await page.screenshot({ path: join(evidence, 'installed-project.png'), fullPage: true });
  assert((await rows(alpha))[0].title === 'Installed project decision', 'Saved decision missing.');
  assert((await access()).find(entry => entry.scope === alpha.scope)?.database.opens === 1, 'More than one alpha connection.');
  assert((await rows(beta)).length === 0, 'Project databases leaked rows.');
  await unopened([unused, plain]);
  observed('Installed SvelteKit shell and mounted Svelte pages share the host. Four projects prove optional declarations, local drafts, allowlist/token rejection without acquisition, lazy first save/read, and project isolation.');
  await projectCli(alpha, 'unmount', '--artifact', alpha.id);
  assert((await action(alpha, alphaToken, 'listScenarios', {})).status === 404, 'Unmount did not revoke backend.');
  await mount(alpha); await unopened([alpha], false);
  assert((await action(alpha, alphaToken, 'listScenarios', {})).status === 403, 'Old capability survived remount.');
  await stop(); const prefsBefore = readFileSync(join(state, preferencesFile), 'utf8'), dataBefore = dbRows(alpha);
  await start(); assert(connection.origin === origin && connection.pid !== firstPid, 'Restart changed endpoint or reused PID.'); await unopened([alpha,beta], false); await unopened([unused,plain]);
  assert((await rows(alpha))[0].title === 'Installed project decision', 'Restart lost project data.');
  await rejectCli('ownership', 'migrate'); await stop();
  const upgraded = await cli('upgrade', '--repo', repo, '--ref', revisions.b); releaseB = upgraded.release;
  assert(readFileSync(join(state, preferencesFile), 'utf8') === prefsBefore, 'Upgrade silently migrated preferences.');
  const activeBefore = readFileSync(join(home, 'active.json'), 'utf8');
  await rejectCli('compatibility', 'upgrade', '--repo', repo, '--ref', revisions.bad);
  await rejectCli('Launcher bundle failed', 'upgrade', '--repo', repo, '--ref', revisions.badLauncher);
  assert(readFileSync(join(home, 'active.json'), 'utf8') === activeBefore, 'Invalid upgrade displaced selected release.');
  const migration = await cli('migrate'), migrated = readFileSync(join(state, preferencesFile), 'utf8');
  assert(JSON.parse(migrated).version === 2 && JSON.parse(migrated).workspace.label === JSON.parse(prefsBefore).workspaceLabel, 'Migration lost preference value.');
  await rejectCli('cannot read preferences schema 2', 'rollback', '--release', releaseA);
  assert(readFileSync(join(home, 'active.json'), 'utf8') === activeBefore && readFileSync(join(state, preferencesFile), 'utf8') === migrated, 'Rejected rollback mutated active/data.');
  await start(); await unopened([alpha,beta], false); await unopened([unused,plain]); await stop();
  writeFileSync(join(state, preferencesFile), migrated + '\n'); await rejectCli('newer data', 'restore', '--backup', migration.id); writeFileSync(join(state, preferencesFile), migrated);
  await cli('restore', '--backup', migration.id); assert(readFileSync(join(state, preferencesFile), 'utf8') === prefsBefore, 'Restore did not preserve exact original bytes.');
  await cli('rollback', '--release', releaseA); await start(); await unopened([alpha,beta], false); assert(JSON.stringify(dbRows(alpha)) === JSON.stringify(dataBefore), 'Service migration changed project DB.'); await stop();
  observed('Stopped-only upgrade preserves schema until explicit migration. Invalid candidate and incompatible rollback leave active/data unchanged; retained hash-checked backup restores exact bytes, then older release restarts at the same endpoint. Project databases are outside service migration.');
  const interactions = join(state, 'interactions.json'), originalInteractions = readFileSync(interactions, 'utf8'), blocked = JSON.parse(originalInteractions);
  blocked.requests.push({ status: 'closed', response: { status: 'accepted' } }); writeFileSync(interactions, JSON.stringify(blocked));
  await rejectCli('Unresolved agent callbacks', 'uninstall'); assert(existsSync(join(home, 'releases', releaseA)), 'Blocked uninstall removed callback release.'); writeFileSync(interactions, originalInteractions);
  const projectManifest = readFileSync(join(alpha.root, 'artifact.project.json'), 'utf8');
  await cli('uninstall'); assert(!existsSync(join(home, 'releases')) && existsSync(launcher), 'Uninstall payload/launcher ownership mismatch.');
  assert(readFileSync(join(state, preferencesFile), 'utf8') === prefsBefore && readFileSync(join(alpha.root, 'artifact.project.json'), 'utf8') === projectManifest, 'Uninstall changed retained state/source.');
  assert(JSON.stringify(dbRows(alpha)) === JSON.stringify(dataBefore), 'Uninstall lost project data.');
  await cli('install', '--repo', repo, '--ref', revisions.b); await start(); assert(connection.origin === origin, 'Reinstall changed configured endpoint.'); await unopened([alpha,beta], false); await unopened([unused,plain]); assert((await rows(alpha))[0].title === 'Installed project decision', 'Reinstall lost data.'); await stop();
  observed('Unresolved callback blocks uninstall. Successful uninstall preserves bundled launcher, service state, source and SQLite; reinstall works using that launcher and keeps the fixed endpoint. Never-used and backend-free projects never create data directories.');
  for (const pid of pids) { let alive = true; try { process.kill(pid, 0); } catch { alive = false; } assert(!alive, `Owned host ${pid} still alive.`); }
  observed(`All ${pids.length} successful owned hosts exited; no live agent callback or global installation change.`);
  success = true;
} catch (error) { lastError = error instanceof Error ? error.stack ?? error.message : String(error); throw error; }
finally {
  await browser?.close();
  if (running) { try { await stop(); } catch (error) { lastError += '\nCleanup: ' + String(error); success = false; } }
  writeFileSync(join(evidence, 'result.json'), JSON.stringify({ passed: success, at: new Date().toISOString(), directory, releaseA, releaseB, pids, observations, error: lastError || undefined }, null, 2));
  console.log(`Evidence: ${evidence}`);
}
