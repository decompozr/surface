import { inspectReleaseArchive } from '@decompozr/surface-cli/installation/release-selection';
import { chromium, expect } from '@playwright/test';
import { mkdirSync, mkdtempSync, realpathSync, readFileSync, writeFileSync, copyFileSync, lstatSync, readlinkSync, symlinkSync, renameSync, existsSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { Database } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import { fixture, git, command } from '../../fixtures/workspaces/fixture.ts';


const assert: (v: unknown, message: string) => asserts v = (v:unknown,message:string):asserts v => {if(!v)throw new Error(message);};

const run = async (args:string[],cwd=base) => {const result=await command(args,cwd);assert(result.code===0,result.err+'\n'+result.out);return result.out;};

const cli = async (cwd:string,...args:string[]) => {return JSON.parse(await run([launcher,...args,'--home',home],cwd));};

const project = async (cwd:string,...args:string[]) => {const result=await cli(cwd,'project',...args);assert(result.ok,JSON.stringify(result));return result.data;};

const start = async (port?:number) => {
  // Model a terminal/tool session ending after the CLI returns. Its process group
  // must not own the long-lived host. Only signal this disposable launch group.
  const session=Bun.spawn(['sh','-c','"$@" & wait','surface-start-session',launcher,'start',...(port===undefined?[]:['--port',String(port)]),'--home',home],{cwd:base,detached:true,stdin:'ignore',stdout:'pipe',stderr:'pipe'});
  const [out,err,code]=await Promise.all([new Response(session.stdout).text(),new Response(session.stderr).text(),session.exited]);assert(code===0,err+'\n'+out);
  const status=JSON.parse(out);pids.push(status.pid);running=true;
  try{process.kill(-session.pid,'SIGTERM');}catch(error){if((error as NodeJS.ErrnoException).code!=='ESRCH')throw error;}
  await Bun.sleep(200);assert((await cli(base,'status')).status==='running','Host did not survive launching session teardown.');
  connection=JSON.parse(readFileSync(join(state,'connection.json'),'utf8'));return status;
};

const stop = async () => {await cli(base,'stop');running=false;assert(!existsSync(join(state,'server.lock')),'Host lock remains.');};

const root=process.cwd(),base=realpathSync(mkdtempSync('/tmp/surface-public-')),home=join(base,'Surface Home'),state=join(home,'state');
const evidence=join(root,'.decompozr/surface/public-entry-proof');mkdirSync(evidence,{recursive:true});
const f=await fixture(),observations:string[]=[],pids:number[]=[];
let prepared: Awaited<ReturnType<typeof inspectReleaseArchive>> | undefined;
let launcher=join(root,'apps/cli/src/index.ts'),running=false,passed=false,revision='',errorText='';
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,mcp:any;
let connection!:{origin:string;token:string};
const observed=(text:string)=>{observations.push(text);console.log(text);};
writeFileSync(join(evidence,'result.json'),JSON.stringify({passed:false,status:'running'}));
try {
  const archive = process.env.SURFACE_E2E_ARCHIVE;
  if (!archive) throw new Error('Set SURFACE_E2E_ARCHIVE to the already-built candidate archive.');
  prepared = await inspectReleaseArchive(archive);
  revision = prepared.bundle.commit;
  writeFileSync(join(evidence, 'source.json'), JSON.stringify({revision, archive, sha256: prepared.sha256}, null, 2));
  const installed=JSON.parse(await run([join(prepared.directory, 'install'), '--home', home]));assert(installed.host==='surface','Wrong installed host.');launcher=join(home,'bin/surface');
  const help=await run([launcher,'--help','--home',home],f.a);assert(help.includes('workspace list | current | retire'),'Installed executable did not expose public workspace commands.');
  renameSync(prepared.directory, prepared.directory + '-moved'); prepared.directory += '-moved';
  const reserve=createServer();await new Promise<void>(done=>reserve.listen(0,'127.0.0.1',done));const port=(reserve.address() as {port:number}).port;await new Promise<void>(done=>reserve.close(()=>done()));
  await start(port);const origin=connection.origin;assert((await cli(base,'status')).status==='running','Status failed.');
  observed('Pinned release installs the public surface executable; the shared workspace host survives launching session/process-group teardown after the extracted download moves, from an unrelated cwd and a home containing spaces.');
  const registrations=await Promise.all([project(f.main,'register'),project(f.a,'register'),project(f.b,'register')]);
  const [main,a,b]=registrations;assert(new Set(registrations.map(r=>r.workspaceId)).size===3,'Workspace identities collided.');
  assert((await project(join(f.a,'ui'),'list')).workspaceId===a.workspaceId,'Nested cwd resolved to wrong worktree.');
  const mounts=await Promise.all([f.main,f.a,f.b].map(cwd=>project(cwd,'mount','--surface',f.manifest.surfaces[0]!.id)));
  const workspaces=await cli(base,'workspace','list');assert(workspaces.projects.length===1&&workspaces.projects[0].workspaces.length===3,'Duplicated project in installed host.');
  for(const cwd of [f.main,f.a,f.b])assert(!existsSync(join(cwd,'.decompozr')),'Created per-worktree service state.');
  assert(!existsSync(join(home,'project-data')),'Mount eagerly allocated data.');
  browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();
  const entries=await cli(base,'access'),entry=entries.find((e:any)=>e.scope===`${mounts[1].namespace}/${mounts[1].name}`);assert(entry,'Missing A access.');
  await page.goto(`${mounts[1].previewUrl}#db=${entry.token}&scope=${entry.scope}`);
  await page.getByLabel('Scenario name',{exact:true}).fill('Installed workspace decision');assert(!existsSync(join(home,'project-data')),'Draft allocated SQLite.');
  await page.getByRole('button',{name:'Save scenario',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Saved to this project');
  await page.screenshot({path:join(evidence,'installed-workspace.png'),fullPage:true});
  const current=await cli(f.a,'workspace','current'),dbPath=join(current.dataDirectory,'scenarios.sqlite');assert(existsSync(dbPath),'First save did not acquire SQLite.');
  const mainWorkspace=workspaces.projects[0].workspaces.find((w:any)=>w.id===main.workspaceId),bWorkspace=workspaces.projects[0].workspaces.find((w:any)=>w.id===b.workspaceId);
  assert(!existsSync(mainWorkspace.dataDirectory)&&!existsSync(bWorkspace.dataDirectory),'Neighbor data allocated.');
  observed('The installed public project/workspace commands resolve cwd, register and mount main plus two worktrees on one service. Browser save acquires only A storage; local drafts and unused neighbors stay database-free.');
  const requireInstalled=createRequire(join(home,'releases',installed.release,'apps/surface/package.json'));
  const {Client}=requireInstalled('@modelcontextprotocol/client'),{StdioClientTransport}=requireInstalled('@modelcontextprotocol/client/stdio');
  mcp=new Client({name:'public-surface-fixture',version:'1.0'});
  const transport=new StdioClientTransport({command:launcher,args:['mcp','--home',home],stderr:'pipe'});await mcp.connect(transport);
  const tools=await mcp.listTools();assert(tools.tools.length===19,'Unexpected MCP tool contract.');
  const listed=await mcp.callTool({name:'surface_project_list',arguments:{projectRoot:f.a}});assert(listed.structuredContent.ok&&listed.structuredContent.data.workspaceId===a.workspaceId,'MCP and CLI disagree on workspace.');await mcp.close();mcp=undefined;
  observed('surface mcp exposes the existing 19 tools from the installed release; real stdio project listing agrees with the public CLI workspace identity. No live agent interaction is delivered.');
  const retired=await cli(f.a,'workspace','retire');assert(retired.runtimeRetired&&retired.dataPreserved,'Public retirement failed.');
  assert(await git(f.a,'status','--porcelain')==='','Disposable worktree contains WIP.');await git(f.main,'merge-base','--is-ancestor',await git(f.a,'rev-parse','HEAD'),'HEAD');await git(f.main,'worktree','remove',f.a);
  await stop();await start();assert(connection.origin===origin,'Restart changed selected port.');
  assert(!(await cli(base,'access')).some((e:any)=>e.scope.startsWith(current.namespace+'/')),'Retired workspace restored.');
  await stop();await cli(base,'uninstall');assert(existsSync(launcher)&&existsSync(dbPath),'Uninstall removed retained launcher/data.');
  if (!prepared) throw new Error('Prepared release is missing.');await run([join(prepared.directory, 'install'), '--home', home]);await start();assert(connection.origin===origin,'Reinstall changed endpoint.');
  assert((await cli(base,'workspace','list')).projects[0].workspaces.some((w:any)=>w.id===a.workspaceId&&w.status==='retired'),'Reinstall lost retired history.');
  const db=new Database(dbPath,{readonly:true});try{assert((db.query('SELECT title FROM scenarios').get() as any).title==='Installed workspace decision','Retained database lost data.');}finally{db.close(true);}
  assert(!existsSync(mainWorkspace.dataDirectory)&&!existsSync(bWorkspace.dataDirectory),'Lifecycle allocated unused data.');
  await cli(f.b,'workspace','retire');await git(f.main,'worktree','remove',f.b);await stop();
  for(const pid of pids){let alive=true;try{process.kill(pid,0);}catch{alive=false;}assert(!alive,`Owned host ${pid} remains.`);}
  observed('Public retirement, source cleanup, restart, uninstall and reinstall preserve retired A data/history and the fixed endpoint; unused databases remain absent. All three owned hosts exit, and both disposable fixture worktrees are removed.');
  passed=true;
}catch(error){errorText=error instanceof Error?error.stack??error.message:String(error);throw error;}
finally{await mcp?.close();await browser?.close();if(running)await stop();writeFileSync(join(evidence,'result.json'),JSON.stringify({passed,at:new Date().toISOString(),base,fixture:f.directory,revision,pids,observations,error:errorText||undefined},null,2));console.log('Evidence: '+evidence);if(!running){prepared?.cleanup();rmSync(base,{recursive:true,force:true});rmSync(f.directory,{recursive:true,force:true});}}
