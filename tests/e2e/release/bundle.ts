import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, copyFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const command = async (args:string[],cwd=base) => {
  const child=Bun.spawn(args,{cwd,env,stdout:'pipe',stderr:'pipe'});
  const [code,out,err]=await Promise.all([child.exited,new Response(child.stdout).text(),new Response(child.stderr).text()]);
  if(code)throw new Error(err+out);return out.trim();
};

const cli = async (...args:string[]) => {return JSON.parse(await command([cliPath,...args],project));};

const archive=resolve(process.argv[2]??'');
assert(archive.endsWith('.tar.gz'),'Pass the downloaded release archive.');
const checksum=readFileSync(archive+'.sha256','utf8').split(/\s/)[0];
assert.equal(createHash('sha256').update(readFileSync(archive)).digest('hex'),checksum);
const defaultHome=process.argv[3]==='--default-home';
const base=realpathSync(mkdtempSync('/tmp/surface-release-')),home=defaultHome?join(base,'.decompozr/surface'):join(base,'Preview Home'),project=join(base,'user-project');
const env: Record<string,string|undefined>={...process.env,PATH:'/usr/bin:/bin:/usr/sbin:/sbin',SURFACE_HOME:home};
delete env.SURFACE_STATE_DIR;
if(defaultHome){env.HOME=base;delete env.SURFACE_HOME;}
let running=false;
const cliPath=join(home,'bin/surface');
try {
  await command(['tar','-xzf',archive,'-C',base]);
  let bundle=join(base,archive.split('/').at(-1)!.replace(/\.tar\.gz$/,''));
  const installed=JSON.parse(await command([join(bundle,'install'),...(defaultHome?[]:['--home',home])]));
  assert.equal(installed.home,home);
  const payload=join(home,'releases',installed.release);
  renameSync(bundle,bundle+'-moved');bundle+='-moved';
  mkdirSync(join(project,'ui/routes'),{recursive:true});
  writeFileSync(join(project,'.gitignore'),'node_modules/\n');
  writeFileSync(join(project,'ui/package.json'),JSON.stringify({private:true,type:'module',dependencies:{svelte:'5.57.1'}}));
  writeFileSync(join(project,'ui/artifact.json'),JSON.stringify({framework:'svelte',components:'routes',routes:'routes'}));
  copyFileSync(join(payload,'examples/routes/counter/+page.svelte'),join(project,'ui/routes/+page.svelte'));
  await command(['git','init','-q','-b','main'],project);
  const started=await cli('start','--port','0');running=true;
  assert.equal((await fetch(started.origin+'/health')).status,200);
  assert((await command([cliPath,'--help'])).includes('install --bundle'));
  assert.equal((await cli('status')).status,'running');
  await cli('project','init','--name','Release user');
  const registration=await cli('project','register');assert(registration.ok);
  const added=await cli('project','add','--source','ui','--name','Controls');assert(added.ok);
  const manifest=JSON.parse(readFileSync(join(project,'artifact.project.json'),'utf8'));
  const mounted=await cli('project','mount','--artifact',manifest.artifacts[0].id);assert(mounted.ok);
  assert.equal((await fetch(mounted.data.previewUrl)).status,200);
  assert(mounted.data.previewUrl.includes('/workspace/release-user/main/ui/'));
  assert(!existsSync(join(home,'project-data')));
  const requireInstalled=createRequire(join(payload,'apps/surface/src/lib/server/mcp/package.json'));
  const {Client}=requireInstalled('@modelcontextprotocol/client');
  const {StdioClientTransport}=requireInstalled('@modelcontextprotocol/client/stdio');
  const client=new Client({name:'release-user-fixture',version:'1.0'});
  try {
    await client.connect(new StdioClientTransport({command:cliPath,args:['mcp'],env,stderr:'pipe'}));
    const result=await client.callTool({name:'surface_project_list',arguments:{projectRoot:project}});
    assert(result.structuredContent.ok);
    assert.equal(result.structuredContent.data.workspaceId,registration.data.workspaceId);
  } finally {await client.close();}
  const before=await cli('workspace','list');
  await cli('stop');running=false;
  await cli('start');running=true;
  assert.deepEqual(await cli('workspace','list'),before);
  await cli('stop');running=false;
  await cli('uninstall');
  assert(existsSync(join(home,'state/workspaces.json')));
  assert(existsSync(join(project,'ui/routes/+page.svelte')));
  await command([join(bundle,'install'),...(defaultHome?[]:['--home',home])]);
  await cli('start');running=true;
  assert.deepEqual(await cli('workspace','list'),before);
  const state=JSON.parse(readFileSync(join(home,'state/connection.json'),'utf8'));
  const previewUrl=state.origin+new URL(mounted.data.previewUrl).pathname;
  await cli('stop');running=false;
  const result={passed:true,base,home,project,archive,checksum,release:installed.release,previewPath:new URL(previewUrl).pathname,observations:['archive checksum',defaultHome?'default ~/.decompozr/surface with isolated user home':'explicit installation home','bundled runtime with system-only PATH','install without checkout/build/dependency install','download directory moved','current app health','separate Git project and readable page mount','real installed stdio MCP project listing','lazy database remains absent','restart preserves workspace identity','uninstall/reinstall preserves source and registry'],limitations:['No real agent conversation delivery in this fixture','No human onboarding acceptance','No cross-version upgrade in this run']};
  const evidence=resolve(import.meta.dir,'../../.decompozr/surface/release-proof');mkdirSync(evidence,{recursive:true});writeFileSync(join(evidence,'result.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
} finally {if(running)await cli('stop');}
