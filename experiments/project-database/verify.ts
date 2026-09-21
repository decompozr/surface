import { chromium, expect } from '@playwright/test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, realpathSync, existsSync, rmSync, copyFileSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { createHash } from 'node:crypto';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const directory = realpathSync(mkdtempSync(join(tmpdir(), 'surface-project-db-')));
const stateDir = join(directory, 'state');
const evidenceDir = join(import.meta.dir, '../../.decompozr/surface/project-database-proof');
mkdirSync(evidenceDir, { recursive: true });
writeFileSync(join(evidenceDir, 'result.json'), JSON.stringify({ at: new Date().toISOString(), passed: false, status: 'running' }));
const observations: string[] = [], processIds: number[] = [];
const observed = (message: string) => { observations.push(message); console.log(message); };
const fixtures = join(import.meta.dir, 'fixtures');
function makeProject(label: string, backend = true) {
  const root = join(directory, label), source = join(root, 'ui');
  mkdirSync(join(source, 'src'), { recursive: true });
  if (backend) copyFileSync(join(fixtures, 'backend.ts'), join(root, 'backend.ts'));
  copyFileSync(join(fixtures, backend ? 'Scenarios.svelte' : 'Local.svelte'), join(source, 'src/Scenarios.svelte'));
  writeFileSync(join(source, 'package.json'), JSON.stringify({ name: `sqlite-${label}`, private: true, type: 'module', dependencies: { svelte: '5.57.1' } }));
  writeFileSync(join(source, 'artifact.json'), JSON.stringify({ framework: 'svelte', components: 'src', props: { 'src/Scenarios.svelte': { label } } }));
  return { root, source, backend, namespace: label, name: 'scenarios', db: join(root, 'data/scenarios.sqlite') };
}
const alpha = makeProject('alpha'), beta = makeProject('beta');
const unused = makeProject('unused'), plain = makeProject('plain', false);
const projects = [alpha, beta, unused, plain];
const config = join(directory, 'config.json');
writeFileSync(config, JSON.stringify({ stateDir, projects }));
let host: ReturnType<typeof Bun.spawn> | undefined, locker: ReturnType<typeof Bun.spawn> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let connection!: { origin: string; token: string; pid: number };
let hostLog = '', logTasks: Promise<void>[] = [];
let success = false;
async function start() {
  let ready = false;
  const child = Bun.spawn([process.execPath, join(import.meta.dir, 'host.ts'), config], { stdout: 'pipe', stderr: 'pipe' });
  host = child; processIds.push(child.pid);
  const collect = async (stream: ReadableStream<Uint8Array>) => {
    let pending = '';
    for await (const part of stream) {
      const text = new TextDecoder().decode(part); hostLog += text; pending += text;
      let end: number;
      while ((end = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, end); pending = pending.slice(end + 1);
        try { if (JSON.parse(line).ready === true) ready = true; } catch { /* compiler log */ }
      }
    }
  };
  logTasks.push(collect(child.stdout as ReadableStream<Uint8Array>), collect(child.stderr as ReadableStream<Uint8Array>));
  const until = Date.now() + 60_000;
  while (!ready && Date.now() < until && child.exitCode === null) await delay(50);
  assert(ready, 'Host failed to become ready: ' + hostLog.slice(-3000));
  connection = JSON.parse(readFileSync(join(stateDir, 'connection.json'), 'utf8'));
  assert(connection.pid === child.pid, 'Connection belongs to a different process.');
}
async function stop() {
  if (!host) return;
  const child = host; child.kill('SIGTERM');
  const result = await Promise.race([child.exited, delay(15_000).then(() => 'timeout' as const)]);
  if (result === 'timeout') { child.kill('SIGKILL'); await child.exited; throw new Error('Host did not stop cleanly.'); }
  host = undefined;
  assert(result === 0, 'Host stop failed: ' + hostLog.slice(-2000));
  assert(!existsSync(join(stateDir, 'server.lock')) && !existsSync(join(stateDir, 'connection.json')), 'Host ownership files remain after stop.');
}
async function admin(path: string, input?: unknown) {
  const response = await fetch(connection.origin + path, { method: input === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${connection.token}`, 'content-type': 'application/json' }, body: input === undefined ? undefined : JSON.stringify(input) });
  const value = await response.json(); assert(response.ok, `Management ${path} failed: ${JSON.stringify(value)}`); return value;
}
async function access() { return await admin('/project-db/access') as { scope: string; token: string; database: { databaseOpen: boolean; opens: number } }[]; }
function key(project: typeof alpha) { return `${project.namespace}/${project.name}`; }
async function mount(project: typeof alpha) {
  await admin('/api/namespaces', { name: project.namespace });
  const value = await admin('/api/mounts', { namespace: project.namespace, name: project.name, source: project.source, projectRoot: project.root });
  assert(value.status === 'ready', 'Mount failed: ' + value.error); return value;
}
async function token(project: typeof alpha) {
  const entry = (await access()).find(item => item.scope === key(project));
  assert(entry, 'Missing access for ' + key(project)); return entry.token;
}
function url(project: typeof alpha, capability: string) { return `${connection.origin}/n/${key(project)}/?component=src%2FScenarios.svelte#db=${capability}`; }
async function action(project: typeof alpha, capability: string, operation: string, input: unknown) {
  const response = await fetch(`${connection.origin}/project-db/${key(project)}/actions`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-project-capability': capability }, body: JSON.stringify({ operation, input }) });
  return { status: response.status, ...await response.json() };
}
const value = (title: string, angle: number, expectedRevision: number) => ({ id: 'shared-id', title, angle, expectedRevision });
async function rows(project: typeof alpha, capability: string) {
  const result = await action(project, capability, 'listScenarios', {}); assert(result.ok, JSON.stringify(result)); return result.data as { id: string; title: string; angle: number; revision: number }[];
}
async function openFiles() {
  const child = Bun.spawn(['/usr/sbin/lsof', '-nP', '-p', String(connection.pid), '-Fn'], { stdout: 'pipe', stderr: 'pipe' });
  const text = await new Response(child.stdout).text(); await child.exited;
  return text.split('\n').filter(line => line.startsWith('n')).map(line => line.slice(1));
}
async function unopened(selected: typeof projects, absent: boolean) {
  const files = await openFiles(), entries = await access();
  for (const project of selected) {
    if (absent) assert(!existsSync(join(project.root, 'data')), `${project.namespace} created data before demand.`);
    assert(!files.some(path => path === project.db || path.startsWith(project.db + '-')), `${project.namespace} has an unexpected database handle.`);
    const entry = entries.find(item => item.scope === key(project));
    assert(!entry || (!entry.database.databaseOpen && entry.database.opens === 0), `${project.namespace} acquired a connection without demand.`);
  }
}
try {
  await start();
  for (const project of projects) {
    for (const operation of ['init', 'register']) {
      const result = await admin('/api/v1/projects/operations', { operation, projectRoot: project.root });
      assert(result.ok, 'Project registration failed.');
    }
  }
  await unopened(projects, true);
  for (const project of projects) await mount(project);
  await unopened(projects, true);
  assert(!(await access()).some(entry => entry.scope === key(plain)), 'Backend-free project received a database capability.');
  const unusedToken = await token(unused);
  assert((await action(unused, unusedToken, 'describeProject', {})).ok, 'Non-database operation failed.');
  assert((await action(plain, '', 'listScenarios', {})).status === 404, 'Backend-free project accepted a database operation.');
  let aToken = await token(alpha), bToken = await token(beta);
  const initialPid = connection.pid;

  assert((await action(beta, aToken, 'listScenarios', {})).status === 403, 'Alpha capability accepted for beta.');
  assert((await action(alpha, '', 'listScenarios', {})).status === 403, 'Missing capability accepted.');
  assert((await action(alpha, aToken, 'sql', { sql: 'DELETE FROM scenarios' })).code === 'unknown_action', 'Raw SQL operation accepted.');
  assert((await action(alpha, aToken, 'saveScenario', { ...value('escape', 20, 0), databasePath: beta.db })).code === 'invalid_input', 'Browser database override accepted.');
  const external = await fetch(`${connection.origin}/project-db/${key(alpha)}/actions`, { method: 'POST', headers: { origin: 'https://example.com', 'content-type': 'application/json', 'x-project-capability': aToken }, body: JSON.stringify({ operation: 'listScenarios', input: {} }) });
  assert(external.status === 403, 'Foreign browser origin accepted.');
  assert((await action(alpha, aToken, 'listScenarios', { unexpected: true })).code === 'invalid_input', 'Invalid read was accepted.');
  await unopened(projects, true);
  observed('Registration, mounting, capability inspection, a non-database operation, and rejected requests created no database directory/files or handles across four projects.');

  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const pageA = await browser.newPage({ viewport: { width: 1024, height: 900 } }), pageB = await browser.newPage();
  const pageUnused = await browser.newPage(), pagePlain = await browser.newPage();
  const errors: string[] = [];
  for (const page of [pageA, pageB, pageUnused, pagePlain]) page.on('pageerror', error => errors.push(error.message));
  await pageA.goto(url(alpha, aToken)); await pageB.goto(url(beta, bToken));
  await pageUnused.goto(url(unused, unusedToken)); await pagePlain.goto(url(plain, ''));
  for (const page of [pageA, pageB, pageUnused]) await expect(page.getByRole('status')).toHaveText('Draft only. Load or save when you need stored data.');
  await pageUnused.getByLabel('Scenario name').fill('Temporary draft only');
  await pagePlain.getByRole('button', { name: 'Count 0', exact: true }).click();
  await expect(pagePlain.getByRole('button', { name: 'Count 1', exact: true })).toBeVisible();
  await unopened(projects, true);
  await pageUnused.screenshot({ path: join(evidenceDir, 'unused-draft.png'), fullPage: true });
  observed('Browser views and local draft/counter interactions remain usable without opening SQLite, including a project with no backend module.');
  // Two simultaneous first reads reuse the same synchronously acquired connection.
  const firstReads = await Promise.all([action(beta, bToken, 'listScenarios', {}), action(beta, bToken, 'listScenarios', {})]);
  assert(firstReads.every(result => result.ok && result.data.length === 0), 'Concurrent first reads failed.');
  assert((await access()).find(entry => entry.scope === key(beta))?.database.opens === 1, 'First requests opened multiple connections.');
  await unopened([alpha, unused, plain], true);
  await pageA.getByLabel('Scenario name').fill('Alpha camera'); await pageA.getByLabel('Camera angle').fill('42');
  await pageA.getByRole('button', { name: 'Save scenario', exact: true }).click();
  await expect(pageA.getByRole('status')).toHaveText('Saved to this project');
  await pageB.getByLabel('Scenario name').fill('Beta camera'); await pageB.getByLabel('Camera angle').fill('17');
  await pageB.getByRole('button', { name: 'Save scenario', exact: true }).click();
  await expect(pageB.getByRole('status')).toHaveText('Saved to this project');
  assert((await rows(alpha, aToken))[0]!.angle === 42 && (await rows(beta, bToken))[0]!.angle === 17, 'Project data crossed scopes.');
  const files = await openFiles();
  assert(files.includes(alpha.db) && files.includes(beta.db), 'Expected handles only after first data operations.');
  assert((await access()).filter(entry => entry.database.databaseOpen).length === 2, 'Unexpected connection count.');
  await unopened([unused, plain], true);
  for (const path of [alpha.db, beta.db, join(alpha.root, 'backend.ts')]) {
    assert((await fetch(connection.origin + '/@fs' + path)).status === 403, 'Private project file exposed: ' + path);
  }
  symlinkSync(alpha.db, join(alpha.source, 'leak.sqlite'));
  assert((await fetch(`${connection.origin}/mounts/${key(alpha)}/leak.sqlite`)).status === 403, 'Database exposed through source symlink.');
  unlinkSync(join(alpha.source, 'leak.sqlite'));
  observed('The first explicit save/read created each database on demand; simultaneous first reads reused one connection. Tested private-file and symlink routes remain rejected.');
  await pageA.reload(); await pageA.getByRole('button', { name: 'Load saved data', exact: true }).click(); await expect(pageA.getByRole('article')).toContainText('Alpha camera'); await expect(pageA.getByRole('article')).toContainText('42°');
  await pageA.evaluate(() => { (window as any).proofMarker = 'same-document'; });
  const component = join(alpha.source, 'src/Scenarios.svelte');
  writeFileSync(component, readFileSync(component, 'utf8').replace('<h1>{label} scenarios</h1>', '<h1>{label} saved scenarios</h1>'));
  await expect(pageA.getByRole('heading', { level: 1 })).toHaveText('alpha saved scenarios');
  assert(await pageA.evaluate(() => (window as any).proofMarker) === 'same-document', 'HMR reloaded the document.');
  await pageA.getByRole('button', { name: 'Load saved data', exact: true }).click();
  await expect(pageA.getByRole('article')).toContainText('42°');
  await expect(pageB.getByRole('article')).toContainText('17°');
  await pageA.screenshot({ path: join(evidenceDir, 'alpha-persisted.png'), fullPage: true });
  observed('Chrome saved identical row IDs in the two project schemas with distinct values; explicit reads after reload and same-document Svelte HMR recovered committed data; the neighboring view remained unchanged.');

  assert((await action(alpha, aToken, 'saveScenario', value('invalid', 999, 1))).code === 'invalid_input', 'Invalid input was not rejected.');
  assert((await action(alpha, aToken, 'failSaveForTest', value('must rollback', 66, 1))).code === 'operation_failed', 'Expected deliberate transaction failure.');
  assert((await rows(alpha, aToken))[0]!.angle === 42 && (await rows(alpha, aToken))[0]!.revision === 1, 'Failed transaction changed committed data.');
  const contested = await Promise.all([action(alpha, aToken, 'saveScenario', value('first contender', 43, 1)), action(alpha, aToken, 'saveScenario', value('second contender', 44, 1))]);
  assert(contested.filter(item => item.ok).length === 1 && contested.filter(item => item.code === 'revision_conflict').length === 1, 'Concurrent writes silently overwrote each other.');
  const alphaSaved = (await rows(alpha, aToken))[0]!;
  const lockScript = join(directory, 'writer-lock.ts'), lockReady = join(directory, 'writer.ready');
  writeFileSync(lockScript, `import { Database } from 'bun:sqlite'; import {writeFileSync} from 'node:fs'; const db=new Database(process.argv[2]!); db.exec('PRAGMA busy_timeout=0; BEGIN IMMEDIATE'); writeFileSync(process.argv[3]!, 'ready'); for await (const chunk of Bun.stdin.stream()) { break; } db.exec('ROLLBACK'); db.close(true);`);
  locker = Bun.spawn([process.execPath, lockScript, alpha.db, lockReady], { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' }); processIds.push(locker.pid);
  const deadline = Date.now() + 5000;
  while (!existsSync(lockReady) && Date.now() < deadline && locker.exitCode === null) await delay(20);
  assert(existsSync(lockReady), 'External SQLite writer lock failed.');
  const started = performance.now();
  const [busy, neighbor] = await Promise.all([action(alpha, aToken, 'saveScenario', value('locked write', 55, 2)), action(beta, bToken, 'saveScenario', value('Beta still working', 18, 1))]);
  const lockResponseMs = Number((performance.now() - started).toFixed(2));
  assert(busy.code === 'database_busy' && neighbor.ok && lockResponseMs < 2000, 'External lock blocked unrelated project or hid failure.');
  const stdin = locker.stdin as import('bun').FileSink; stdin.write('release\n'); stdin.end(); assert(await locker.exited === 0, 'Writer lock process did not exit cleanly.'); locker = undefined;
  assert((await rows(alpha, aToken))[0]!.angle === alphaSaved.angle, 'Busy write changed data.');
  observed(`Invalid input and transaction failure preserved data; concurrent revision checks admitted one writer; an external SQLite lock returned busy while beta saved successfully (${lockResponseMs} ms combined).`);

  // Begin a request body, unmount, then finish the body. It must not reach a closed backend.
  let finishBody!: () => void;
  const slowResponse = new Promise<number>((resolve, reject) => {
    const req = request(`${connection.origin}/project-db/${key(alpha)}/actions`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-project-capability': aToken } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode!)); });
    req.on('error', reject); req.write('{"operation":"saveScenario",');
    finishBody = () => req.end('"input":' + JSON.stringify(value('late body', 70, 2)) + '}');
  });
  await delay(50);
  await admin('/api/unmount', { namespace: alpha.namespace, name: alpha.name }); finishBody();
  assert([404, 409].includes(await slowResponse), 'Request crossed resource close during body acquisition.');
  assert((await action(alpha, aToken, 'listScenarios', {})).status === 404, 'Unmounted backend remains accessible.');
  const afterUnmount = await openFiles();
  assert(!afterUnmount.some(path => path === alpha.db || path.startsWith(alpha.db + '-')), 'Unmount retained alpha database handles.');
  assert(afterUnmount.includes(beta.db), 'Unmount closed beta database.');
  await pageB.getByRole('button', { name: 'Reload saved data' }).click(); await expect(pageB.getByRole('article')).toContainText('Beta still working');
  const oldToken = aToken;
  await mount(alpha); aToken = await token(alpha);
  assert(aToken !== oldToken && (await action(alpha, oldToken, 'listScenarios', {})).status === 403, 'Remount did not revoke old capability.');
  await unopened([alpha], false);
  assert((await rows(alpha, aToken))[0]!.revision === 2, 'Remount changed saved data.');
  await unopened([unused, plain], true);
  observed('Unmount revoked backend access, rejected an in-flight partial body, closed alpha file descriptors, and left beta open; remount restored data with a fresh capability.');

  for (const project of [unused, plain]) {
    await admin('/api/unmount', { namespace: project.namespace, name: project.name });
    await unopened([project], true);
    await mount(project);
  }
  await unopened([unused, plain], true);
  const oldA = aToken, oldB = bToken;
  await stop();
  for (const project of [alpha, beta]) {
    const child = Bun.spawn([process.execPath, join(project.root, 'backend.ts')], { stdout: 'pipe', stderr: 'pipe' });
    const [out, err, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    assert(code === 0, 'Standalone project read failed: ' + err);
    const result = JSON.parse(out); assert(result.integrity.integrity_check === 'ok' && result.rows[0].revision === 2, 'Standalone project data integrity failed.');
  }
  await start(); assert(connection.pid !== initialPid, 'Restart reused the old host process.');
  aToken = await token(alpha); bToken = await token(beta);
  await unopened([alpha, beta], false);
  await unopened([unused, plain], true);
  assert((await action(alpha, oldA, 'listScenarios', {})).status === 403 && (await action(beta, oldB, 'listScenarios', {})).status === 403, 'Restart retained stale capabilities.');
  await pageA.goto(url(alpha, aToken)); await pageB.goto(url(beta, bToken));
  await unopened([alpha, beta], false);
  await pageA.getByRole('button', { name: 'Load saved data', exact: true }).click();
  await pageB.getByRole('button', { name: 'Load saved data', exact: true }).click();
  await pageUnused.goto(url(unused, await token(unused))); await pagePlain.goto(url(plain, ''));
  await expect(pageUnused.getByRole('status')).toHaveText('Draft only. Load or save when you need stored data.');
  await expect(pagePlain.getByRole('heading')).toHaveText('Local interface');
  await unopened([unused, plain], true);
  await expect(pageA.getByRole('article')).toContainText(alphaSaved.title); await expect(pageB.getByRole('article')).toContainText('Beta still working');
  assert((await action(alpha, aToken, 'saveScenario', value('Alpha after restart', 45, 2))).ok, 'Write failed after restart.');
  const finalA = await rows(alpha, aToken), finalB = await rows(beta, bToken);
  assert(finalA[0]!.revision === 3 && finalB[0]!.revision === 2, 'Final project revisions are incorrect.');
  assert(errors.length === 0, 'Unexpected browser runtime errors: ' + errors.join('\n'));
  const listener = Bun.spawn(['/usr/sbin/lsof', '-nP', '-a', '-p', String(connection.pid), '-iTCP', '-sTCP:LISTEN', '-Fn'], { stdout: 'pipe', stderr: 'pipe' });
  const listeners = (await new Response(listener.stdout).text()).split('\n').filter(line => line.startsWith('n')); await listener.exited;
  assert(listeners.length === 1 && listeners[0] === 'n' + new URL(connection.origin).host, 'Expected one application TCP listener.');
  observed('Complete host process restart restored both databases and browser views; old capabilities were rejected, new writes succeeded, and the host retained one application TCP listener.');
  await stop();
  for (const project of [unused, plain]) assert(!existsSync(join(project.root, 'data')), 'Unused project created a database during shutdown.');
  observed('Remount and process restart kept existing databases closed until requested; unused and backend-free projects still had no data directory after final shutdown.');
  const snapshots = [];
  for (const project of [alpha, beta]) {
    const db = new Database(project.db, { readonly: true });
    try {
      const rows = db.query('SELECT * FROM scenarios ORDER BY id').all();
      assert((db.query('PRAGMA integrity_check').get() as any).integrity_check === 'ok', 'Final integrity check failed.');
      snapshots.push({ project: project.namespace, rows });
    } finally { db.close(true); }
  }
  const hashes = [alpha, beta].map(project => ({ project: project.namespace, backend: createHash('sha256').update(readFileSync(join(project.root, 'backend.ts'))).digest('hex') }));
  assert(hashes.every(item => item.backend === createHash('sha256').update(readFileSync(join(fixtures, 'backend.ts'))).digest('hex')), 'Surface modified project backend source.');
  observed('Both project-owned programs read their data independently while Surface was stopped; final integrity checks passed and backend source remained unchanged.');
  success = true;
  writeFileSync(join(evidenceDir, 'result.json'), JSON.stringify({ at: new Date().toISOString(), passed: true, liveAgent: false, bun: Bun.version, observations, lockResponseMs, snapshots, lazyAcquisition: { untouchedProjects: ['unused', 'plain'], firstReadCreates: true, firstWriteCreates: true, concurrentFirstReadConnections: 1, remountAndRestartLazy: true }, processes: processIds, backendHashes: hashes, limitations: ['trusted local code, not a sandbox', 'one mounted interface per project', 'synchronous named operations; slow-query isolation not established', 'no backend HMR, crash-durability, backup, migration compatibility or production release claim'] }, null, 2));
  console.log('PASS: project-owned SQLite browser and lifecycle experiment.');
} finally {
  if (locker) { locker.kill('SIGKILL'); await locker.exited; }
  try { await browser?.close(); }
  finally {
    try { await stop(); }
    finally {
      if (host) { host.kill('SIGKILL'); await host.exited; }
      await Promise.all(logTasks);
      writeFileSync(join(evidenceDir, 'host.log'), hostLog);
      const remainingLivePids = processIds.filter(pid => { try { process.kill(pid, 0); return true; } catch { return false; } });
      writeFileSync(join(evidenceDir, 'cleanup.json'), JSON.stringify({ at: new Date().toISOString(), verificationPassed: success, processIds, remainingLivePids }, null, 2));
      rmSync(directory, { recursive: true, force: true });
      assert(remainingLivePids.length === 0, 'Owned processes remain after verification cleanup.');
    }
  }
}
