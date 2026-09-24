import { chromium, expect } from '@playwright/test';
import { mkdirSync, mkdtempSync, realpathSync, readFileSync, writeFileSync, copyFileSync, lstatSync, readlinkSync, symlinkSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { Database } from 'bun:sqlite';
import { Installation } from '@decompozr/surface-installer/manager';
import { command, git } from '../workspaces/fixture.ts';

const fixture = async () => {
  for(const [folder,component] of [['editor','Editor'],['compare','Compare']]) {
    const dir=join(main,folder!);mkdirSync(join(dir,'src'),{recursive:true});
    writeFileSync(join(dir,'package.json'),JSON.stringify({name:'multi-surface-'+folder,private:true,type:'module',dependencies:{svelte:'5.57.1'}}));
    writeFileSync(join(dir,'artifact.json'),JSON.stringify({framework:'svelte',components:'src'}));
    copyFileSync(join(import.meta.dir,`fixtures/${component}.svelte`),join(dir,`src/${component}.svelte`));
    copyFileSync(join(import.meta.dir,'fixtures/sync.ts'),join(dir,'src/sync.ts'));
  }
  writeFileSync(join(main,'artifact.project.json'),JSON.stringify(manifest,null,2)+'\n');
  writeFileSync(join(main,'.gitignore'),'node_modules/\neditor/bun.lock\ncompare/bun.lock\n.artifact-project.lock\n');
  const backend=readFileSync(join(root,'experiments/project-database/fixtures/backend.ts'),'utf8').replace('export const createProjectBackend','const createStoreBackend');
  writeFileSync(join(main,'backend.ts'),backend+`\nexport const apiVersion=1;\nlet factories=0,closes=0,reads=0;\nexport const createProjectBackend = (context) => {const backend=createStoreBackend(context),instance=++factories;let closed=false;return {...backend,invoke(operation,input){if(operation==='listScenarios')reads++;const result=backend.invoke(operation,input);return result.ok&&operation==='saveScenario'?{...result,invalidates:true}:result;},inspect(){return {...backend.inspect(),instance,factories,closes,reads}},close(){backend.close();if(!closed){closed=true;closes++;}}};}\n`);
  writeFileSync(join(main,'surface.backend.json'),JSON.stringify({version:1,api:1,entry:'backend.ts',operations:['describeProject','listScenarios','saveScenario','failSaveForTest']}));
  await git(main,'init','-q','-b','main');await git(main,'config','commit.gpgsign','false');await git(main,'add','.');await git(main,'commit','-qm','Editor and comparison experiment app');
  await git(main,'worktree','add','-qb','experiment-a',branch);
};



const assert: (value: unknown, message: string) => asserts value = (value: unknown, message: string): asserts value => { if (!value) throw new Error(message); };

// Compare private metadata by hash only; do not expose management credentials.
const sharedFingerprint = () => {

  const visit = (path: string) => {
    if (!existsSync(path)) { entries[path] = 'absent'; return; }
    const stat = lstatSync(path);
    if (stat.isDirectory()) { for (const name of readdirSync(path).sort()) visit(join(path,name)); }
    else entries[path] = createHash('sha256').update(stat.isSymbolicLink() ? readlinkSync(path) : readFileSync(path)).digest('hex');
  };

  const shared = '/Users/scottchu/Library/Application Support/Surface', entries: Record<string,string> = {};
  for (const path of ['active.json','settings.json','state','run','bin']) visit(join(shared,path));
  visit('/Users/scottchu/.bun/bin/surface');
  return createHash('sha256').update(JSON.stringify(entries)).digest('hex');
};

const run = async (args: string[], cwd = base) => { const result = await command(args,cwd); assert(result.code === 0, result.err+'\n'+result.out); return result.out; };

const cli = async (cwd: string, ...args: string[]) => {
  return JSON.parse(await run([process.execPath,join(home,'releases',installed!.release,'apps/cli/src/index.ts'),...args,'--state-dir',state],cwd));
};

const project = async (cwd: string, ...args: string[]) => { const result = await cli(cwd,'project',...args); assert(result.ok,JSON.stringify(result)); return result.data; };

const access = async () => { return cli(base,'access'); };

const entry = async (mount: any) => { const result = (await access()).find((item:any)=>item.scope===`${mount.namespace}/${mount.name}`); assert(result,'Missing capability'); return result; };

const action = async (mount: any, token: string, operation: string, input: unknown) => {
  const response = await fetch(`${connection.origin}/project-db/${mount.namespace}/${mount.name}/actions`,{method:'POST',headers:{'content-type':'application/json','x-project-capability':token},body:JSON.stringify({operation,input})});
  return { status:response.status, value:await response.json() as any };
};

const handles = async (path: string) => {
  const result = await command(['/usr/sbin/lsof','-nP','-p',String(host!.pid),'-Fn']); assert(result.code===0,'Cannot inspect owned host handles: '+result.err);
  return result.out.split('\n').filter(line=>line==='n'+path||line.startsWith('n'+path+'-'));
};

const start = async () => {
  const release = join(home,'releases',installed!.release);
  const child = Bun.spawn([process.execPath,join(release,'experiments/surface-sync/host.ts'),'--state-dir',state,'--data-root',data,'--port','0'],{cwd:base,stdin:'ignore',stdout:'pipe',stderr:'pipe'});
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
};

const stop = async () => {
  if(!host)return;const child=host;
  child.kill('SIGTERM');
  const code=await Promise.race([child.exited,Bun.sleep(15000).then(()=>{throw new Error('Owned experiment host did not stop');})]);
  writeFileSync(join(evidence,`host-${child.pid}.log`),await hostLog!);assert(code===0,'Host shutdown failed');host=undefined;
  assert(!existsSync(join(state,'server.lock')),'Host lock remains');
};

const snapshot = async () => {
  mkdirSync(repo);
  const files=new Set((await run(['git','-C',root,'ls-files','-z'])).split('\0').concat((await run(['git','-C',root,'ls-files','--others','--exclude-standard','-z'])).split('\0')).filter(Boolean));
  for(const path of files) {const from=join(root,path),to=join(repo,path);if(!existsSync(from))continue;mkdirSync(dirname(to),{recursive:true});const content=lstatSync(from).isSymbolicLink()?readlinkSync(from):readFileSync(from);if(typeof content==='string')symlinkSync(content,to);else copyFileSync(from,to);hashes[path]=createHash('sha256').update(content).digest('hex');}
  await git(repo,'init','-q');await git(repo,'config','commit.gpgsign','false');await git(repo,'add','.');await git(repo,'commit','-qm','Isolated surface-sync experiment snapshot');
  return git(repo,'rev-parse','HEAD');
};

const deferred = () => {let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return{promise,resolve};};

const root = resolve(import.meta.dir, '../..'), base = realpathSync(mkdtempSync('/tmp/surface-sync-'));
const home = join(base, 'Experimental Home'), state = join(home, 'state'), data = join(home, 'project-data');
const repo = join(base, 'release-source'), main = join(base, 'project'), branch = join(base, 'worktree-a');
const evidence = join(root, '.decompozr/surface/surface-sync-proof'); mkdirSync(evidence, { recursive: true });
const observations: string[] = [], hashes: Record<string,string> = {}, pids: number[] = [];
const manifest = { version:1, projectId:crypto.randomUUID(), name:'Surface synchronization experiment', artifacts:[
  { id:crypto.randomUUID(), name:'Editor', source:'editor', archived:false },
  { id:crypto.randomUUID(), name:'Comparison', source:'compare', archived:false },
] };
let installed: { release:string } | undefined;
let connection!: { origin:string; token:string };
let host: ReturnType<typeof Bun.spawn> | undefined, hostLog: Promise<string> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined, passed = false, errorText = '';
const observed = (message: string) => { observations.push(message); console.log(message); };
const sharedBefore = sharedFingerprint();
writeFileSync(join(evidence,'result.json'),JSON.stringify({passed:false,status:'running',base}));
try {

  const visit = async (page:any,mount:any,component:string) => {await page.goto(`${mount.previewUrl}?component=src%2F${component}.svelte#db=${(await entry(mount)).token}`);await expect(page.getByLabel('Connection status')).toHaveText('Live updates connected');};

  const save = async (title:string,revision:number) => {await editPage.getByLabel('Scenario name',{exact:true}).fill(title);await editPage.getByRole('button',{name:'Save scenario',exact:true}).click();await expect(editPage.getByRole('status')).toHaveText(`Loaded revision ${revision}`);};

  await fixture();const revision=await snapshot();
  writeFileSync(join(evidence,'source.json'),JSON.stringify({revision,sourceHead:await git(root,'rev-parse','HEAD'),hashes},null,2));
  installed=await new Installation(home).install(repo,revision,'surface');await start();
  await project(main,'register');await project(branch,'register');
  const mount=async(cwd:string,index:number)=>project(cwd,'mount','--artifact',manifest.artifacts[index]!.id);
  const unmount=async(cwd:string,index:number)=>project(cwd,'unmount','--artifact',manifest.artifacts[index]!.id);
  const editor=await mount(main,0),comparison=await mount(main,1),neighborEditor=await mount(branch,0),neighborComparison=await mount(branch,1);
  const workspace=await cli(main,'workspace','current'),neighbor=await cli(branch,'workspace','current');
  const database=join(workspace.dataDirectory,'scenarios.sqlite');
  const editorEntry=await entry(editor),compareEntry=await entry(comparison);
  const unauthorized=await fetch(`${connection.origin}/project-db/${comparison.namespace}/${comparison.name}/events`,{headers:{'x-project-capability':editorEntry.token}});
  assert(unauthorized.status===403,'Cross-mount subscription accepted');await unauthorized.text();
  browser=await chromium.launch({channel:'chrome',headless:true});
  const editPage=await browser.newPage({viewport:{width:1000,height:850}}),draftPage=await browser.newPage({viewport:{width:1000,height:850}});
  const compareContext=await browser.newContext({viewport:{width:1100,height:800}}),comparePage=await compareContext.newPage();
  const dormantPage=await browser.newPage(),neighborPage=await browser.newPage();
  let dormantReads=0,neighborReads=0;
  dormantPage.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/actions'))dormantReads++;});
  neighborPage.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/actions'))neighborReads++;});
  await visit(editPage,editor,'Editor');await visit(draftPage,editor,'Editor');await visit(comparePage,comparison,'Compare');await visit(dormantPage,comparison,'Compare');await visit(neighborPage,neighborComparison,'Compare');
  await editPage.getByLabel('Scenario name',{exact:true}).fill('Initial view');
  assert(!existsSync(data),'Subscriptions, handshakes or drafts allocated SQLite');
  assert((await entry(comparison)).subscribers===2&&(await entry(editor)).subscribers===2,'Missing scoped subscriptions');
  for(const item of await access())assert(item.database.opens===0&&item.cursor.sequence===0,'Subscription touched data');
  observed('Five browser views subscribe using mount-specific headers; subscriptions, cursor heartbeats and local drafts create no SQLite. Another mount token cannot subscribe.');
  await save('Initial view',1);
  await expect(comparePage.getByRole('status')).toHaveText('Saved scenarios have not been loaded.');assert(dormantReads===0,'Unloaded view fetched after a notification');
  await comparePage.getByRole('button',{name:'Load scenarios',exact:true}).click();await expect(comparePage.getByRole('cell',{name:'Initial view',exact:true})).toBeVisible();
  await draftPage.getByRole('button',{name:'Load saved scenario',exact:true}).click();await expect(draftPage.getByRole('status')).toHaveText('Loaded revision 1');
  await draftPage.getByLabel('Scenario name',{exact:true}).fill('My private unsaved draft');
  await save('Live updated view',2);
  await expect(comparePage.getByRole('cell',{name:'Live updated view',exact:true})).toBeVisible();
  await expect(draftPage.getByRole('status')).toHaveText('Saved data changed. Your draft is preserved.');await expect(draftPage.getByLabel('Scenario name',{exact:true})).toHaveValue('My private unsaved draft');
  await comparePage.screenshot({path:join(evidence,'live-comparison.png'),fullPage:true});await draftPage.screenshot({path:join(evidence,'preserved-draft.png'),fullPage:true});
  const beforeFailure=(await entry(editor)).cursor.sequence;
  await draftPage.getByRole('button',{name:'Save scenario',exact:true}).click();await expect(draftPage.getByRole('status')).toContainText('revision_conflict');
  const rolledBack=await action(editor,editorEntry.token,'failSaveForTest',{id:'near',title:'Must roll back',angle:40,expectedRevision:2});assert(rolledBack.value.code==='operation_failed','Injected transaction did not fail');
  assert((await entry(editor)).cursor.sequence===beforeFailure,'Rejected or rolled-back save emitted an invalidation');
  await expect(draftPage.getByLabel('Scenario name',{exact:true})).toHaveValue('My private unsaved draft');
  await draftPage.getByRole('button',{name:'Discard draft and reload',exact:true}).click();await expect(draftPage.getByLabel('Scenario name',{exact:true})).toHaveValue('Live updated view');
  await expect(draftPage.getByRole('status')).toHaveText('Loaded revision 2');
  const settledReads=(await entry(editor)).database.reads;await Bun.sleep(1200);assert((await entry(editor)).database.reads===settledReads,'Duplicate cursor heartbeats caused reads');
  assert(dormantReads===0&&neighborReads===0&&!existsSync(neighbor.dataDirectory),'Unloaded or unrelated workspace acquired data');
  observed('After explicit Load, comparison follows a successful Save automatically. Dirty editor input survives invalidation; stale Save conflicts, rollback emits no event, and explicit discard/reload reconciles. Repeated heartbeat cursors do not reread.');
  await compareContext.setOffline(true);
  await expect(comparePage.getByLabel('Connection status')).toContainText('Disconnected');
  await save('First offline change',3);await save('Latest offline change',4);
  await expect(comparePage.getByRole('cell',{name:'Live updated view',exact:true})).toBeVisible();
  await compareContext.setOffline(false);await expect(comparePage.getByLabel('Connection status')).toHaveText('Live updates connected');
  await expect(comparePage.getByRole('cell',{name:'Latest offline change',exact:true})).toBeVisible();
  observed('Chrome loses its network connection while two saves occur. Reconnection needs no event replay or manual Load: it fetches the latest snapshot and skips the missed intermediate version.');
  const intercepted=deferred(),release=deferred();let delayed=false;
  await comparePage.evaluate(()=>{const seen:string[]=[];(window as any).__seenTitles=seen;new MutationObserver(()=>{const value=document.querySelector('tbody td')?.textContent;if(value)seen.push(value);}).observe(document.body,{subtree:true,childList:true,characterData:true});});
  await comparePage.route('**/actions',async route=>{
    if(!delayed&&route.request().postDataJSON()?.operation==='listScenarios'){
      delayed=true;const response=await route.fetch();intercepted.resolve();await release.promise;await route.fulfill({response});
    }else await route.continue();
  });
  await save('Delayed intermediate view',5);await Promise.race([intercepted.promise,Bun.sleep(10000).then(()=>{throw new Error('No delayed read observed');})]);
  await save('Newest view wins',6);release.resolve();
  await expect(comparePage.getByRole('cell',{name:'Newest view wins',exact:true})).toBeVisible();
  const seen=await comparePage.evaluate(()=>(window as any).__seenTitles as string[]);assert(!seen.includes('Delayed intermediate view'),'Delayed stale snapshot was rendered');await comparePage.unroute('**/actions');
  assert(dormantReads===0&&neighborReads===0,'Unused subscribers loaded domain data');
  assert((await entry(neighborComparison)).cursor.sequence===0,'Main changes crossed workspace boundary');
  const mainSequence=(await entry(comparison)).cursor.sequence;
  const neighborSave=await action(neighborEditor,(await entry(neighborEditor)).token,'saveScenario',{id:'near',title:'Separate workspace',angle:80,expectedRevision:0});assert(neighborSave.value.ok,'Neighbor save failed');
  assert((await entry(comparison)).cursor.sequence===mainSequence&&(await entry(neighborComparison)).cursor.sequence===1,'Neighbor invalidated main');
  await expect(neighborPage.getByRole('status')).toHaveText('Saved scenarios have not been loaded.');
  observed('A delayed snapshot is discarded after a newer notification; Chrome never renders the obsolete intermediate title. Dormant subscribers never fetch rows, and each workspace advances only its own invalidation cursor.');
  // Keep an independent HTTP subscriber alive so browser teardown cannot mask a server leak.
  const rawStream=await fetch(`${connection.origin}/project-db/${comparison.namespace}/${comparison.name}/events`,{headers:{'x-project-capability':compareEntry.token}});
  assert(rawStream.ok&&rawStream.body,'Independent stream unavailable');const reader=rawStream.body.getReader();await reader.read();
  await unmount(main,1);
  const ended=(async()=>{while(!(await reader.read()).done){}reader.releaseLock();})();
  await Promise.race([ended,Bun.sleep(3000).then(()=>{throw new Error('Unmount did not end independent HTTP stream');})]);
  const revoked=await fetch(`${connection.origin}/project-db/${comparison.namespace}/${comparison.name}/events`,{headers:{'x-project-capability':compareEntry.token}});assert(revoked.status===404,'Unmounted stream can reconnect');await revoked.text();
  assert(!(await access()).some((item:any)=>item.scope===compareEntry.scope),'Unmount retained comparison capability');
  await save('Editor survives comparison removal',7);
  const restored=await mount(main,1),newEntry=await entry(restored);assert(newEntry.token!==compareEntry.token&&newEntry.subscribers===0,'Remount retained old streams or token');
  const oldToken=await fetch(`${connection.origin}/project-db/${restored.namespace}/${restored.name}/events`,{headers:{'x-project-capability':compareEntry.token}});assert(oldToken.status===403,'Old stream capability revived');await oldToken.text();
  await unmount(main,1);await unmount(main,0);assert((await handles(database)).length===0,'Last unmount leaked SQLite handles');
  await cli(branch,'workspace','retire');assert(await git(branch,'status','--porcelain')==='','Fixture worktree contains WIP');await git(main,'merge-base','--is-ancestor',await git(branch,'rev-parse','HEAD'),'HEAD');await git(main,'worktree','remove',branch);
  assert((await access()).length===0,'Subscribers kept resources mounted');await stop();
  const db=new Database(database,{readonly:true});try{assert((db.query('PRAGMA integrity_check').get() as any).integrity_check==='ok','Database integrity failed');assert((db.query('SELECT revision FROM scenarios WHERE id=?').get('near') as any).revision===7,'Wrong final committed row');}finally{db.close(true);}
  for(const pid of pids){let alive=true;try{process.kill(pid,0);}catch{alive=false;}assert(!alive,'Owned host remains alive');}
  assert(sharedFingerprint()===sharedBefore,'Existing shared installation changed');
  observed('Unmount closes scoped streams, revokes old subscription tokens and leaves the editor operational. Final retirement releases SQLite, all owned host processes exit, and the shared installation/global launcher are unchanged.');
  passed=true;
}catch(error){errorText=error instanceof Error?error.stack??error.message:String(error);throw error;}
finally{await browser?.close();if(host)await stop();writeFileSync(join(evidence,'result.json'),JSON.stringify({passed,at:new Date().toISOString(),base,home,release:installed?.release,pids,observations,sharedInstallationUnchanged:sharedFingerprint()===sharedBefore,error:errorText||undefined},null,2));console.log('Evidence: '+evidence);}
