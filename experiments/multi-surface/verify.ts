import { chromium, expect } from '@playwright/test';
import { mkdirSync, mkdtempSync, realpathSync, readFileSync, writeFileSync, copyFileSync, lstatSync, readlinkSync, symlinkSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { Database } from 'bun:sqlite';
import { Installation } from '../../apps/surface/src/installation/manager.ts';
import { command, git } from '../workspaces/fixture.ts';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const root = resolve(import.meta.dir, '../..'), base = realpathSync(mkdtempSync('/tmp/surface-multi-'));
const home = join(base, 'Experimental Home'), state = join(home, 'state'), data = join(home, 'project-data');
const repo = join(base, 'release-source'), main = join(base, 'project'), branch = join(base, 'worktree-a');
const evidence = join(root, '.decompozr/surface/multi-surface-proof'); mkdirSync(evidence, { recursive: true });
const observations: string[] = [], hashes: Record<string,string> = {}, pids: number[] = [];
const manifest = { version:1, projectId:crypto.randomUUID(), name:'Multi-surface experiment', artifacts:[
  { id:crypto.randomUUID(), name:'Editor', source:'editor', archived:false },
  { id:crypto.randomUUID(), name:'Comparison', source:'compare', archived:false },
] };
let installed: { release:string } | undefined;
let connection!: { origin:string; token:string };
let host: ReturnType<typeof Bun.spawn> | undefined, hostLog: Promise<string> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined, passed = false, errorText = '';
const observed = (message: string) => { observations.push(message); console.log(message); };
// Compare private metadata by hash only; do not expose management credentials.
function sharedFingerprint() {
  const shared = '/Users/scottchu/Library/Application Support/Surface', entries: Record<string,string> = {};
  function visit(path: string) {
    if (!existsSync(path)) { entries[path] = 'absent'; return; }
    const stat = lstatSync(path);
    if (stat.isDirectory()) { for (const name of readdirSync(path).sort()) visit(join(path,name)); }
    else entries[path] = createHash('sha256').update(stat.isSymbolicLink() ? readlinkSync(path) : readFileSync(path)).digest('hex');
  }
  for (const path of ['active.json','settings.json','state','run','bin']) visit(join(shared,path));
  visit('/Users/scottchu/.bun/bin/surface');
  return createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}
const sharedBefore = sharedFingerprint();
async function run(args: string[], cwd = base) { const result = await command(args,cwd); assert(result.code === 0, result.err+'\n'+result.out); return result.out; }
async function cli(cwd: string, ...args: string[]) {
  return JSON.parse(await run([process.execPath,join(home,'releases',installed!.release,'apps/surface/src/cli/index.ts'),...args,'--state-dir',state],cwd));
}
async function project(cwd: string, ...args: string[]) { const result = await cli(cwd,'project',...args); assert(result.ok,JSON.stringify(result)); return result.data; }
async function access() { return cli(base,'access'); }
async function entry(mount: any) { const result = (await access()).find((item:any)=>item.scope===`${mount.namespace}/${mount.name}`); assert(result,'Missing capability'); return result; }
async function action(mount: any, token: string, operation: string, input: unknown) {
  const response = await fetch(`${connection.origin}/project-db/${mount.namespace}/${mount.name}/actions`,{method:'POST',headers:{'content-type':'application/json','x-project-capability':token},body:JSON.stringify({operation,input})});
  return { status:response.status, value:await response.json() as any };
}
async function handles(path: string) {
  const result = await command(['/usr/sbin/lsof','-nP','-p',String(host!.pid),'-Fn']); assert(result.code===0,'Cannot inspect owned host handles: '+result.err);
  return result.out.split('\n').filter(line=>line==='n'+path||line.startsWith('n'+path+'-'));
}
async function start() {
  const release = join(home,'releases',installed!.release);
  const child = Bun.spawn([process.execPath,join(release,'experiments/multi-surface/host.ts'),'--state-dir',state,'--data-root',data,'--port','0'],{cwd:base,stdin:'ignore',stdout:'pipe',stderr:'pipe'});
  host=child; pids.push(child.pid);
  hostLog=Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text()]).then(parts=>parts.join('\n'));
  const deadline=Date.now()+60000;
  while(Date.now()<deadline) {
    if(child.exitCode!==null) throw new Error('Experimental host exited: '+await hostLog);
    const path=join(state,'connection.json');
    if(existsSync(path)) {
      const candidate=JSON.parse(readFileSync(path,'utf8'));
      if(candidate.pid===child.pid) { try { const response=await fetch(candidate.origin+'/api/health'); if(response.ok){connection=candidate;return;} } catch {} }
    }
    await Bun.sleep(50);
  }
  throw new Error('Experimental host startup timeout');
}
async function stop() {
  if(!host)return;const child=host;
  child.kill('SIGTERM');
  const code=await Promise.race([child.exited,Bun.sleep(15000).then(()=>{throw new Error('Owned experiment host did not stop');})]);
  writeFileSync(join(evidence,`host-${child.pid}.log`),await hostLog!);assert(code===0,'Host shutdown failed');host=undefined;
  assert(!existsSync(join(state,'server.lock')),'Host lock remains');
}
async function snapshot() {
  mkdirSync(repo);
  const files=new Set((await run(['git','-C',root,'ls-files','-z'])).split('\0').concat((await run(['git','-C',root,'ls-files','--others','--exclude-standard','-z'])).split('\0')).filter(Boolean));
  for(const path of files) {const from=join(root,path),to=join(repo,path);if(!existsSync(from))continue;mkdirSync(dirname(to),{recursive:true});const content=lstatSync(from).isSymbolicLink()?readlinkSync(from):readFileSync(from);if(typeof content==='string')symlinkSync(content,to);else copyFileSync(from,to);hashes[path]=createHash('sha256').update(content).digest('hex');}
  await git(repo,'init','-q');await git(repo,'config','commit.gpgsign','false');await git(repo,'add','.');await git(repo,'commit','-qm','Isolated multi-surface experiment snapshot');
  return git(repo,'rev-parse','HEAD');
}
async function fixture() {
  for(const [folder,component] of [['editor','Editor'],['compare','Compare']]) {
    const dir=join(main,folder!);mkdirSync(join(dir,'src'),{recursive:true});
    writeFileSync(join(dir,'package.json'),JSON.stringify({name:'multi-surface-'+folder,private:true,type:'module',dependencies:{svelte:'5.57.1'}}));
    writeFileSync(join(dir,'artifact.json'),JSON.stringify({framework:'svelte',components:'src'}));
    copyFileSync(join(import.meta.dir,`fixtures/${component}.svelte`),join(dir,`src/${component}.svelte`));
  }
  writeFileSync(join(main,'artifact.project.json'),JSON.stringify(manifest,null,2)+'\n');
  writeFileSync(join(main,'.gitignore'),'node_modules/\neditor/bun.lock\ncompare/bun.lock\n.artifact-project.lock\n');
  const backend=readFileSync(join(root,'experiments/project-database/fixtures/backend.ts'),'utf8').replace('export function createProjectBackend','function createStoreBackend');
  writeFileSync(join(main,'backend.ts'),backend+`\nexport const apiVersion=1;\nlet factories=0,closes=0;\nexport function createProjectBackend(context){const backend=createStoreBackend(context),instance=++factories;let closed=false;return {...backend,inspect(){return {...backend.inspect(),instance,factories,closes}},close(){backend.close();if(!closed){closed=true;closes++;}}};}\n`);
  writeFileSync(join(main,'surface.backend.json'),JSON.stringify({version:1,api:1,entry:'backend.ts',operations:['describeProject','listScenarios','saveScenario']}));
  await git(main,'init','-q','-b','main');await git(main,'config','commit.gpgsign','false');await git(main,'add','.');await git(main,'commit','-qm','Editor and comparison experiment app');
  await git(main,'worktree','add','-qb','experiment-a',branch);
}
writeFileSync(join(evidence,'result.json'),JSON.stringify({passed:false,status:'running',base}));
try {
  await fixture();const revision=await snapshot();
  writeFileSync(join(evidence,'source.json'),JSON.stringify({revision,sourceHead:await git(root,'rev-parse','HEAD'),hashes},null,2));
  installed=await new Installation(home).install(repo,revision,'surface');
  await start();
  await project(main,'register');await project(branch,'register');
  const mount=async(cwd:string,index:number)=>project(cwd,'mount','--artifact',manifest.artifacts[index]!.id);
  const unmount=async(cwd:string,index:number)=>project(cwd,'unmount','--artifact',manifest.artifacts[index]!.id);
  let editor=await mount(main,0),comparison=await mount(main,1);
  const neighborEditor=await mount(branch,0),neighborComparison=await mount(branch,1);
  const workspace=await cli(main,'workspace','current'),neighbor=await cli(branch,'workspace','current');
  const database=join(workspace.dataDirectory,'scenarios.sqlite'),neighborDatabase=join(neighbor.dataDirectory,'scenarios.sqlite');
  assert(workspace.id!==neighbor.id&&workspace.namespace!==neighbor.namespace,'Workspaces collided');
  assert(!existsSync(data),'Mounts allocated project storage');
  for(const item of await access())assert(item.database.opens===0&&item.database.factories===1,'Mount acquired storage or duplicated factory');
  let editorEntry=await entry(editor),compareEntry=await entry(comparison);
  assert(editorEntry.token!==compareEntry.token,'Capabilities shared across mounts');
  assert((await action(comparison,editorEntry.token,'listScenarios',{})).status===403,'Cross-mount token accepted');
  assert((await action(editor,editorEntry.token,'saveScenario',{})).value.code==='invalid_input','Invalid input accepted');
  assert((await action(editor,editorEntry.token,'describeProject',{})).value.ok,'Non-data operation failed');
  assert(!existsSync(data),'Rejected or non-data operation allocated storage');
  browser=await chromium.launch({channel:'chrome',headless:true});
  const editPage=await browser.newPage({viewport:{width:1000,height:850}}),comparePage=await browser.newPage({viewport:{width:1100,height:750}});
  async function visit(page:any,mount:any,component:string){await page.goto('about:blank');await page.goto(`${mount.previewUrl}?component=src%2F${component}.svelte#db=${(await entry(mount)).token}`);}
  await visit(editPage,editor,'Editor');await visit(comparePage,comparison,'Compare');
  await editPage.getByLabel('Scenario name',{exact:true}).fill('Near view');assert(!existsSync(data),'Browser draft allocated storage');
  await expect(comparePage.getByRole('status')).toHaveText('Saved scenarios have not been loaded.');
  observed('Four mounts across main and a linked worktree use one backend per workspace with distinct mount capabilities. Mounting, local drafts, invalid input and non-data operations allocate no SQLite.');
  await editPage.getByRole('button',{name:'Save scenario',exact:true}).click();await expect(editPage.getByRole('status')).toHaveText('Saved Near view · revision 1');
  await editPage.getByLabel('Scenario ID',{exact:true}).fill('wide');await editPage.getByLabel('Scenario name',{exact:true}).fill('Wide view');await editPage.getByLabel('Camera angle',{exact:true}).fill('60');
  await editPage.getByRole('button',{name:'Save scenario',exact:true}).click();await expect(editPage.getByRole('status')).toHaveText('Saved Wide view · revision 1');
  await expect(comparePage.getByRole('status')).toHaveText('Saved scenarios have not been loaded.');
  await comparePage.getByRole('button',{name:'Load scenarios',exact:true}).click();await expect(comparePage.getByRole('status')).toHaveText('Loaded 2 scenarios');
  await expect(comparePage.getByRole('cell',{name:'Near view',exact:true})).toBeVisible();await expect(comparePage.getByRole('cell',{name:'Wide view',exact:true})).toBeVisible();
  await editPage.screenshot({path:join(evidence,'editor.png'),fullPage:true});await comparePage.screenshot({path:join(evidence,'comparison.png'),fullPage:true});
  editorEntry=await entry(editor);compareEntry=await entry(comparison);
  assert(editorEntry.database.instance===compareEntry.database.instance&&editorEntry.database.opens===1&&compareEntry.database.factories===1,'Views do not share one acquired backend');
  assert((await handles(database)).length>0,'No actual SQLite descriptor observed');assert(!existsSync(neighbor.dataDirectory),'Neighbor eagerly acquired data');
  observed('Real Chrome saves two scenarios in the editor and explicitly loads both in comparison. Both mounts report the same single acquired backend; the host holds real SQLite descriptors.');
  const oldEditorToken=editorEntry.token;
  await unmount(main,0);
  assert((await action(editor,oldEditorToken,'listScenarios',{})).status===404,'Unmounted editor retained access');
  await comparePage.getByRole('button',{name:'Load scenarios',exact:true}).click();await expect(comparePage.getByRole('status')).toHaveText('Loaded 2 scenarios');
  assert((await entry(comparison)).database.closes===0&&(await handles(database)).length>0,'First unmount closed shared backend');
  editor=await mount(main,0);editorEntry=await entry(editor);
  assert(editorEntry.token!==oldEditorToken&&editorEntry.database.factories===1,'Rejoin reused token or duplicated backend');
  assert((await action(editor,oldEditorToken,'listScenarios',{})).status===403,'Old editor capability revived');
  await visit(editPage,editor,'Editor');await editPage.getByRole('button',{name:'Save scenario',exact:true}).click();await expect(editPage.getByRole('status')).toContainText('revision_conflict');
  await unmount(main,1);
  assert((await action(comparison,compareEntry.token,'listScenarios',{})).status===404,'Unmounted comparison retained access');
  await editPage.getByLabel('Scenario ID',{exact:true}).fill('detail');await editPage.getByLabel('Scenario name',{exact:true}).fill('Detail view');
  await editPage.getByRole('button',{name:'Save scenario',exact:true}).click();await expect(editPage.getByRole('status')).toHaveText('Saved Detail view · revision 1');
  await unmount(main,0);assert((await handles(database)).length===0,'Last unmount retained database descriptors');assert(existsSync(database),'Last unmount removed data');
  observed('Either view can unmount first without closing its neighbor. Revoked capabilities stay invalid after remount, stale edits conflict, and final unmount releases actual SQLite descriptors while preserving rows.');
  editor=await mount(main,0);comparison=await mount(main,1);compareEntry=await entry(comparison);
  assert(compareEntry.database.factories===2&&compareEntry.database.closes===1&&compareEntry.database.opens===0,'New cohort did not remain lazy or previous owner closed incorrectly');
  assert((await handles(database)).length===0,'Remount opened existing database');
  await visit(comparePage,comparison,'Compare');await comparePage.getByRole('button',{name:'Load scenarios',exact:true}).click();await expect(comparePage.getByRole('status')).toHaveText('Loaded 3 scenarios');
  const neighborEntry=await entry(neighborComparison);
  const empty=await action(neighborComparison,neighborEntry.token,'listScenarios',{});assert(empty.value.ok&&empty.value.data.length===0,'Neighbor read main data');
  const own=await action(neighborEditor,(await entry(neighborEditor)).token,'saveScenario',{id:'near',title:'Worktree-only view',angle:80,expectedRevision:0});assert(own.value.ok,'Neighbor save failed');
  assert((await action(neighborComparison,(await entry(comparison)).token,'listScenarios',{})).status===403,'Cross-workspace capability accepted');
  const mainRows=(await action(comparison,(await entry(comparison)).token,'listScenarios',{})).value.data;
  assert(mainRows.length===3&&mainRows.find((row:any)=>row.id==='near').title==='Near view','Neighbor overwrote main');
  await unmount(branch,0);await unmount(branch,1);assert((await handles(neighborDatabase)).length===0,'Neighbor last close leaked');assert((await handles(database)).length>0,'Neighbor close disrupted main');
  observed('Remount creates a fresh inert backend and explicit Load restores committed rows. A linked worktree stores a different value under the same row ID, rejects main capabilities, and closes without affecting main.');
  await stop();await start();
  for(const item of await access())assert(item.database.opens===0&&item.database.factories===1,'Restart allocated storage or duplicate backend');
  assert((await handles(database)).length===0,'Restart opened existing SQLite');
  comparison.previewUrl=connection.origin+new URL(comparison.previewUrl).pathname;
  await visit(comparePage,comparison,'Compare');await comparePage.getByRole('button',{name:'Load scenarios',exact:true}).click();await expect(comparePage.getByRole('status')).toHaveText('Loaded 3 scenarios');
  await cli(branch,'workspace','retire');assert(await git(branch,'status','--porcelain')==='','Fixture worktree contains WIP');await git(main,'merge-base','--is-ancestor',await git(branch,'rev-parse','HEAD'),'HEAD');await git(main,'worktree','remove',branch);
  await stop();
  for(const path of [database,neighborDatabase]) {const db=new Database(path,{readonly:true});try{assert((db.query('PRAGMA integrity_check').get() as any).integrity_check==='ok','Database integrity failed');}finally{db.close(true);}}
  for(const pid of pids){let alive=true;try{process.kill(pid,0);}catch{alive=false;}assert(!alive,'Owned host remains alive');}
  assert(sharedFingerprint()===sharedBefore,'Existing shared installation metadata changed');
  observed('Host restart restores two views with one unopened backend; explicit Load restores data. Both owned hosts exit, both databases pass integrity checks, and the disposable worktree is retired/removed. Existing shared installation and global launcher are unchanged.');
  passed=true;
} catch(error) {errorText=error instanceof Error?error.stack??error.message:String(error);throw error;}
finally {
  await browser?.close();if(host)await stop();
  writeFileSync(join(evidence,'result.json'),JSON.stringify({passed,at:new Date().toISOString(),base,home,release:installed?.release,pids,observations,sharedInstallationUnchanged:sharedFingerprint()===sharedBefore,error:errorText||undefined},null,2));
  console.log('Evidence: '+evidence);
}
