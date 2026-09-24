import { chromium, expect } from '@playwright/test';
import { Database } from 'bun:sqlite';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { fixture, git, command } from './fixture.ts';
import { startWorkspaceHost } from './host.ts';
import { workspaceDirectory, type Workspace } from './identity.ts';
import type { AgentAdapter } from '@decompozr/surface-agent-adapters/codex';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const publicCli = process.argv.includes('--public-cli');
const f = await fixture(), evidence = resolve(import.meta.dir, publicCli ? '../../.decompozr/surface/public-workspaces-proof' : '../../.decompozr/surface/workspaces-proof'); mkdirSync(evidence, { recursive: true });
const observations: string[] = [], deliveries: { thread: string; root: string; requestId: string }[] = [];
const observed = (value: string) => { observations.push(value); console.log(value); };
let app: Awaited<ReturnType<typeof startWorkspaceHost>> | undefined, browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let connection: { origin: string; token: string }, success = false, errorText = '';
const socketPath = join(f.directory, 'fixture.sock'), socket = createServer(client => client.end());
await new Promise<void>(done => socket.listen(socketPath, done));
const bindings = new Map<string,string>([['fixture-main',f.main], ['fixture-a',f.a], ['fixture-b',f.b]]);
const adapter: AgentAdapter = {
  async inspect(binding) { if (bindings.get(binding.threadId) !== binding.projectRoot) throw new Error('Wrong fixture session/root.'); return { status: 'idle' }; },
  async deliver(binding, message) { await this.inspect(binding); const data = JSON.parse(message.split('\n')[1]!); deliveries.push({ thread: binding.threadId, root: binding.projectRoot, requestId: data.requestId }); return { mode: 'start', turnId: 'fixture-turn' }; },
};
const directory = workspaceDirectory(f.state, f.data);
let main!: Workspace, a!: Workspace, b!: Workspace;
async function start() { app = await startWorkspaceHost({ stateDir: f.state, dataRoot: f.data, port: 0, adapter }); connection = JSON.parse(readFileSync(join(f.state, 'connection.json'), 'utf8')); }
async function stop() { const origin = app!.origin; await app!.stop(); app = undefined; assert(!existsSync(join(f.state, 'server.lock')), 'Server lock remains.'); let reachable = true; try { await fetch(origin + '/api/health'); } catch { reachable = false; } assert(!reachable, 'Host listener remains.'); }
async function raw(path: string, input?: unknown, token = connection.token) {
  const response = await fetch(connection.origin + path, { method: input === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: input === undefined ? undefined : JSON.stringify(input) });
  return { status: response.status, data: await response.json() };
}
async function api(path: string, input?: unknown) { const result = await raw(path,input); assert(result.status < 300, JSON.stringify(result)); return result.data; }
async function cli(root: string, ...args: string[]) { const forwarded = publicCli ? (args[0] === 'retire' ? ['workspace', ...args] : ['project', ...args]) : args; return command([process.execPath, join(import.meta.dir, publicCli ? '../../apps/cli/src/index.ts' : 'cli.ts'), ...forwarded], root, { SURFACE_STATE_DIR: f.state }); }
async function project(root: string, ...args: string[]) { const result = await cli(root,...args); assert(result.code === 0, result.err + result.out); const value = JSON.parse(result.out); assert(value.ok, result.out); return value.data; }
async function register(root: string) { const result = await project(root,'register'); return directory.get(result.workspaceId); }
async function mount(w: Workspace) { return project(w.root,'mount','--artifact',f.manifest.artifacts[0]!.id); }
const name = `a-${f.manifest.artifacts[0]!.id}`;
async function access() { return await api('/project-db/access') as { scope: string; token: string; database: { databaseOpen: boolean; opens: number } }[]; }
async function token(w: Workspace) { const entry = (await access()).find(e => e.scope === `${w.namespace}/${name}`); assert(entry,'Backend missing.'); return entry.token; }
async function action(w: Workspace, operation: string, input: unknown, capability?: string) {
  const response = await fetch(`${connection.origin}/project-db/${w.namespace}/${name}/actions`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-project-capability': capability ?? await token(w) }, body: JSON.stringify({ operation,input }) });
  return { status: response.status, ...await response.json() };
}
async function unopened(workspaces: Workspace[], absent = true) {
  const entries = await access(), files = await command(['/usr/sbin/lsof','-nP','-p',String(process.pid),'-Fn']); assert(files.code === 0,'lsof failed.');
  for (const w of workspaces) {
    if (absent) assert(!existsSync(w.dataDirectory),'Unneeded project storage appeared.');
    assert(!files.out.includes(w.dataDirectory + '/scenarios.sqlite'),'Unexpected SQLite handle.');
    const entry = entries.find(e => e.scope === `${w.namespace}/${name}`); assert(!entry || (!entry.database.databaseOpen && entry.database.opens === 0),'Backend acquired storage without demand.');
  }
}
function readRows(w: Workspace) { const db = new Database(join(w.dataDirectory,'scenarios.sqlite'), { readonly: true }); try { assert((db.query('PRAGMA integrity_check').get() as any).integrity_check === 'ok','Database damaged.'); return db.query<{ title: string; revision: number },[]>('SELECT title,revision FROM scenarios').all(); } finally { db.close(true); } }
async function request(w: Workspace, thread: string) {
  const binding = await api('/api/bindings',{ projectRoot: w.root, threadId: thread, socketPath });
  return api('/api/requests',{ bindingId: binding.id, namespace: w.namespace, name, component: 'src/Form.svelte', title: 'Workspace choice', schema: { type: 'object', additionalProperties: false, required: ['label'], properties: { label: { type: 'string' } } } });
}
writeFileSync(join(evidence,'result.json'),JSON.stringify({ passed:false,status:'running',fixture:f.directory }));
try {
  await start();
  main = await register(f.main); a = await register(f.a); b = await register(f.b);
  if(publicCli) assert((await project(join(f.a,'ui'),'list')).workspaceId === a.id,'Public CLI did not infer the containing worktree.');
  const mounts = await Promise.all([mount(main),mount(a),mount(b)]);
  assert(new Set(mounts.map(m=>m.namespace)).size === 3,'Namespaces collided.');
  assert(directory.snapshot().projects.length === 1,'Duplicated logical project.');
  for (const w of [main,a,b]) assert(!existsSync(join(w.root,'.decompozr')),'Worktree received local service state.');
  assert(!existsSync(join(f.state,'project-bindings.json')),'Legacy binding ledger was duplicated.');
  await unopened([main,a,b]); assert(!existsSync(f.data),'Register/mount created persistent data root.');
  const listeners = await command(['/usr/sbin/lsof','-nP','-a','-p',String(process.pid),'-iTCP','-sTCP:LISTEN','-Fn']);
  assert(listeners.out.split('\n').filter(line=>line.startsWith('n')).length === 1,'Expected one HTTP listener.');
  observed('Main plus two real linked worktrees share one service/project manifest identity and one HTTP listener; each has a distinct stable namespace. Cwd-based CLI uses shared state, with no per-worktree .decompozr directory or database allocation.');
  await git(f.a,'branch','-m','renamed-a'); assert((await register(f.a)).id === a.id,'Branch rename changed workspace ID.');
  const detachedHead = await git(f.b,'rev-parse','HEAD'); await git(f.b,'checkout','--detach','-q',detachedHead); assert((await register(f.b)).id === b.id,'Detached HEAD changed workspace ID.'); await git(f.b,'checkout','-q','experiment-b');
  const clone = join(f.directory,'independent-clone'); await git(f.main,'clone','-q',f.main,clone);
  const copied = await cli(clone,'register'); assert(copied.code !== 0 && copied.out.includes('PROJECT_IDENTITY_CONFLICT'),'Copied project adopted.');
  assert((await access()).length === 3,'Copy disturbed live resources.');
  const aToken = await token(a);
  assert((await action(b,'listScenarios',{},aToken)).status === 403,'Backend token crossed workspace.');
  assert((await action(b,'describeProject',{})).ok,'Non-storage action failed.');
  assert((await action(b,'saveScenario',{})).code === 'invalid_input','Invalid request accepted.'); await unopened([main,a,b]);
  browser = await chromium.launch({ channel:'chrome',headless:true }); const mainPage = await browser.newPage(), aPage = await browser.newPage(), bPage = await browser.newPage();
  for (const [page,w,m] of [[mainPage,main,mounts[0]],[aPage,a,mounts[1]],[bPage,b,mounts[2]]] as const) {
    await page.goto(`${m.previewUrl}?component=src%2FScenarios.svelte#db=${await token(w)}`); await expect(page.getByRole('heading',{name:'Workspace scenarios',exact:true})).toBeVisible();
  }
  await bPage.getByLabel('Scenario name',{exact:true}).fill('Unsaved B draft'); await unopened([main,a,b]);
  await mainPage.getByLabel('Scenario name',{exact:true}).fill('Main decision'); await mainPage.getByRole('button',{name:'Save scenario',exact:true}).click(); await expect(mainPage.getByRole('status')).toHaveText('Saved to this project');
  await aPage.getByLabel('Scenario name',{exact:true}).fill('Worktree A decision'); await aPage.getByRole('button',{name:'Save scenario',exact:true}).click(); await expect(aPage.getByRole('status')).toHaveText('Saved to this project');
  assert(readRows(main)[0]?.title === 'Main decision' && readRows(a)[0]?.title === 'Worktree A decision','Workspace writes contaminated another database.'); await unopened([b]);
  await aPage.screenshot({ path:join(evidence,'worktree-a.png'),fullPage:true });
  observed('Branch rename and detached HEAD preserve workspace IDs. Independent clone with copied project UUID is refused. Scoped browser saves isolate the same row ID in main/A; B drafts, invalid requests, and non-data actions stay database-free.');
  const reqA = await request(a,'fixture-a'), reqB = await request(b,'fixture-b');
  const cross = await raw(`/api/n/${b.namespace}/${name}/requests/${reqA.id}`,undefined,reqA.token); assert(cross.status === 403,'Interaction crossed workspace namespace.');
  const submitted = await raw(`/api/n/${a.namespace}/${name}/requests/${reqA.id}/responses`,{ responseId:crypto.randomUUID(),data:{label:'A choice'} },reqA.token);
  assert(submitted.status === 200 && submitted.data.response.status === 'accepted','Fixture delivery was not accepted.');
  assert(deliveries.length === 1 && deliveries[0]!.root === f.a && deliveries[0]!.thread === 'fixture-a','Input went to another workspace session.');
  await api(`/api/requests/${reqA.id}/close`,{});
  const blocked = await cli(f.main,'retire','--workspace',a.id); assert(blocked.code !== 0 && blocked.err.includes('Unresolved workspace interaction'),'Unresolved accepted interaction permitted cleanup.');
  assert(directory.get(a.id).status === 'retiring' && existsSync(f.a),'Blocked cleanup deleted source.');
  assert((await cli(f.a,'mount','--artifact',f.manifest.artifacts[0]!.id)).code !== 0,'Retiring workspace remounted.');
  assert((await action(main,'listScenarios',{})).data[0].title === 'Main decision','Main stopped during neighbor retirement.');
  assert((await api(`/api/requests/${reqB.id}`)).previewScope.projectRoot === f.b,'Other interaction changed.');
  await api(`/api/requests/${reqA.id}/result`,{ message:'Fixture result published to original A interaction' });
  const component = join(f.a,'ui/src/Scenarios.svelte'); writeFileSync(component,readFileSync(component,'utf8').replace('<h1>{label} scenarios</h1>','<h1>{label} merged scenarios</h1>'));
  await git(f.a,'add','ui/src/Scenarios.svelte'); await git(f.a,'commit','-qm','Add reviewed workspace interface change'); const aCommit = await git(f.a,'rev-parse','HEAD');
  await git(f.main,'merge','--ff-only','renamed-a');
  const retired = await cli(f.main,'retire','--workspace',a.id); assert(retired.code === 0 && JSON.parse(retired.out).runtimeRetired,'Retirement failed after reconciliation.');
  assert((await action(a,'listScenarios',{},aToken)).status === 404,'Retired backend still callable.');
  assert(await git(f.a,'status','--porcelain') === '','Fixture worktree A contains unmerged WIP.');
  await git(f.main,'merge-base','--is-ancestor',aCommit,'HEAD'); await git(f.main,'worktree','remove',f.a);
  assert(!existsSync(f.a) && existsSync(join(a.dataDirectory,'scenarios.sqlite')),'Worktree removal lost persistent data.');
  assert(readRows(main)[0]!.title === 'Main decision' && readRows(a)[0]!.title === 'Worktree A decision','Cleanup merged or lost domain data.');
  const retained = await api(`/api/requests/${reqA.id}`); assert(retained.previewScope.projectRoot === f.a && retained.bindingId === reqA.bindingId && retained.result.message.includes('original A'),'History was retargeted to main.');
  await mainPage.reload(); await expect(mainPage.getByRole('heading',{name:'Workspace merged scenarios',exact:true})).toBeVisible(); await mainPage.getByRole('button',{name:'Load saved data',exact:true}).click(); await expect(mainPage.getByRole('heading',{name:'Main decision',exact:true})).toBeVisible();
  await mainPage.screenshot({ path:join(evidence,'main-after-merge.png'),fullPage:true });
  observed('A scoped interaction reaches its exact fixture session. Retirement unmounts A while main/B remain usable, blocks unresolved accepted work even when closed, then succeeds after explicit result reconciliation. Git merges source only; removal preserves A SQLite and original interaction identity without migration into main.');
  await api(`/api/requests/${reqB.id}/close`,{}); const bRetired = await cli(f.main,'retire','--workspace',b.id); assert(bRetired.code === 0,bRetired.err); assert(await git(f.b,'status','--porcelain') === '','B contains WIP.');
  await git(f.main,'merge-base','--is-ancestor',await git(f.b,'rev-parse','HEAD'),'HEAD'); await git(f.main,'worktree','remove',f.b); assert(!existsSync(b.dataDirectory),'Unused B allocated data at cleanup.');
  await stop(); await start();
  assert(directory.get(main.id).status === 'active' && directory.get(a.id).status === 'retired','Restart changed workspace lifecycles.'); await mount(main); await unopened([main],false);
  assert(readRows(a)[0]!.title === 'Worktree A decision','Archived A data unavailable independently.');
  assert((await action(main,'listScenarios',{})).data[0].title === 'Main decision','Main persistence lost after restart.');
  assert(!(await api('/project-db/access')).some((e:any)=>e.scope.startsWith(a.namespace+'/') || e.scope.startsWith(b.namespace+'/')),'Retired workspace restored on restart.');
  assert(!existsSync(b.dataDirectory),'Restart created retired unused data.');
  const worktrees = await git(f.main,'worktree','list','--porcelain'); assert(worktrees.split('\n').filter(l=>l.startsWith('worktree ')).length === 1,'Disposable fixture worktrees remain.');
  await stop();
  observed('Both disposable linked worktrees were removed after runtime retirement and Git ancestry/clean checks. Restart restores only main with lazy acquisition; retired history and A data remain, B never gets a database, and the shared listener shuts down.');
  success = true;
} catch(error) { errorText = error instanceof Error ? error.stack ?? error.message : String(error); throw error; }
finally {
  await browser?.close(); if(app) await stop(); await new Promise<void>(done=>socket.close(()=>done()));
  writeFileSync(join(evidence,'result.json'),JSON.stringify({ passed:success,at:new Date().toISOString(),fixture:f.directory,pid:process.pid,projectId:f.manifest.projectId,workspaces:directory.snapshot(),observations,deliveries,liveAgent:false,error:errorText || undefined },null,2));
  console.log('Evidence: '+evidence);
}
