#!/usr/bin/env bun
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { join, resolve, dirname } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { cliOptions } from './options.ts';
import { projectMain } from './projects.ts';
import { installationHome, serviceState } from '../installation/paths.ts';
import { lifecycleCommands, lifecycleMain } from '../installation/launcher.ts';
import { workspaceDirectory } from '../workspaces/identity.ts';
import { retire } from '../workspaces/retire.ts';
import { planMigration, publicPlan, migrate, rollbackMigration } from '../workspaces/migrate.ts';

export const root=fileURLToPath(new URL('../../',import.meta.url));
async function currentProject(explicit?:string) {
  if(explicit)return resolve(explicit);
  const env=Object.fromEntries(Object.entries(process.env).filter(([name])=>!name.startsWith('GIT_')));
  const child=Bun.spawn(['git','rev-parse','--show-toplevel'],{cwd:process.cwd(),env,stdout:'pipe',stderr:'pipe'});
  const [code,out]=await Promise.all([child.exited,new Response(child.stdout).text(),new Response(child.stderr).text()]);
  if(code!==0)throw new Error('Run from a Git worktree or specify --project ROOT.');return resolve(out.trim());
}
async function api(stateDir:string,path:string,data?:unknown) {
  const connection=JSON.parse(readFileSync(join(stateDir,'connection.json'),'utf8')),url=new URL(connection.origin);
  if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.href!==url.origin+'/'||url.username||url.password||typeof connection.token!=='string')throw new Error('Expected a local Surface connection.');
  const response=await fetch(new URL(path,url),{method:data===undefined?'GET':'POST',redirect:'error',headers:{authorization:`Bearer ${connection.token}`,'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(120_000)});
  const value=await response.json();if(!response.ok)throw new Error(typeof value.error==='string'?value.error:JSON.stringify(value));
  if(value.status==='failed'||['failed','unknown'].includes(value.response?.status))process.exitCode=1;return value;
}
export async function main(args=process.argv.slice(2)) {
  const {values,positionals,tokens}=parseArgs({args,allowPositionals:true,tokens:true,options:cliOptions});
  const command=positionals[0],stateDir=serviceState(values);
  const print=(value:unknown)=>console.log(JSON.stringify(value,null,2));
  const required=(key:keyof typeof values)=>{const value=values[key];if(typeof value!=='string'||!value)throw new Error(`Missing --${key}.`);return value;};
  if(values.help||!command) {
    console.log(`Surface — shared local service for Git projects and worktrees

  install --bundle DIRECTORY         Install a prepared release
  install --repo PATH --ref COMMIT    Developer source installation
  start [--port 4319]                 Start the owned shared service
  status | stop | restart | recover
  upgrade --repo PATH --ref COMMIT
  rollback --release ID | uninstall  Preserve service/project data
  serve [--data-root PATH]           Foreground workspace service
  project init|register|list|add|mount|unmount|archive|restore
    [--project ROOT] [--artifact ID --source PATH --name LABEL]
  workspace list | current | retire [--workspace ID]
  workspace migrate [--data-root PATH --storage-map FILE --apply]
  workspace migration-rollback --backup ID
  access                             Private backend mount capabilities
  bind [--project ROOT] --thread ID --socket PATH
  request --binding ID --namespace NAME --name NAME --component PATH --title TEXT --schema-file FILE
  requests | inspect --request ID | result --request ID --data JSON
  send --request ID --response-id ID --data JSON | close --request ID
  mcp                                Stdio tools for the selected service
  doctor
  legacy COMMAND                     Earlier per-runtime prototype commands

Select one shared installation with --home PATH or SURFACE_HOME.
Client/foreground commands also accept --state-dir PATH or SURFACE_STATE_DIR.
Project roots default to the current Git worktree, including when invoked from a subdirectory.
Register before mounting. No per-worktree service state or automatic database allocation.
Migration without --apply prints a plan. Existing data requires explicit project-owned storage mapping.`);return;
  }
  if(command==='legacy') {
    const index=tokens.find(t=>t.kind==='positional')!.index;
    return (await import('./legacy.ts')).main(args.filter((_,i)=>i!==index));
  }
  // Preserve old explicit per-runtime invocations; new service operations have distinct flags.
  if(['init','register','runtimes','runtime','logs'].includes(command)||(values.runtime&&['mount','stop','request'].includes(command))||(command==='serve'&&values.dev))return (await import('./legacy.ts')).main(args);
  if(lifecycleCommands.has(command)) {print(await lifecycleMain(args));return;}
  if(command==='project') {
    const operation=positionals[1];if(!operation||positionals.length!==2)throw new Error('Expected one project operation.');
    const forwarded=[operation,'--project',await currentProject(values.project),'--state-dir',stateDir];
    for(const field of ['artifact','source','name'] as const)if(values[field]!==undefined)forwarded.push('--'+field,values[field]);
    return projectMain(forwarded,stateDir);
  }
  if(command==='workspace') {
    const operation=positionals[1];if(positionals.length!==2)throw new Error('Expected one workspace operation.');
    if(operation==='migrate') {
      const dataRoot=resolve(values['data-root']??join(dirname(stateDir),'project-data'));
      const map=values['storage-map']?JSON.parse(readFileSync(resolve(values['storage-map']),'utf8')):{};
      print(values.apply?await migrate(stateDir,dataRoot,map):publicPlan(await planMigration(stateDir,dataRoot,map)));return;
    }
    if(operation==='migration-rollback') {print(rollbackMigration(stateDir,required('backup')));return;}
    const config=JSON.parse(readFileSync(join(stateDir,'workspace-host.json'),'utf8')),directory=workspaceDirectory(stateDir,config.dataRoot);
    if(operation==='list'){print(directory.snapshot());return;}
    let id=values.workspace;
    if(!id){const projectRoot=await currentProject(values.project),w=directory.snapshot().projects.flatMap(p=>p.workspaces).find(w=>w.root===projectRoot&&w.status!=='retired');if(!w)throw new Error('Register this workspace first.');id=w.id;}
    if(operation==='current'){print(directory.get(id));return;}
    if(operation==='retire'){print(await retire(stateDir,id));return;}
    throw new Error('Use workspace list, current, retire, migrate, or migration-rollback.');
  }
  if(command==='serve') {
    const port=Number(values.port??4319);if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid port.');
    const app=await (await import('../server/surface.ts')).startSurface({stateDir,port,dataRoot:values['data-root']});
    print({status:'ready',origin:app.origin,pid:app.pid,stateDir});
    for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>void app.stop().then(()=>process.exit(0)));return;
  }
  if(command==='mcp') {
    const child=Bun.spawn([process.execPath,join(root,'experiments/mcp/server.ts'),'--state-dir',stateDir],{stdin:'inherit',stdout:'inherit',stderr:'inherit'});for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>child.kill(signal));process.exitCode=await child.exited;return;
  }
  switch(command) {
    case 'doctor': print({bun:Bun.version,home:installationHome(values.home),stateDir,service:await api(stateDir,'/api/health')});break;
    case 'access': print(await api(stateDir,'/project-db/access'));break;
    case 'bind': print(await api(stateDir,'/api/bindings',{projectRoot:await currentProject(values.project),threadId:required('thread'),socketPath:resolve(required('socket'))}));break;
    case 'request': print(await api(stateDir,'/api/requests',{recipientSelection:values['allow-recipient-selection']===true,bindingId:required('binding'),namespace:required('namespace'),name:required('name'),component:required('component'),title:required('title'),schema:JSON.parse(readFileSync(resolve(required('schema-file')),'utf8'))}));break;
    case 'list':case 'requests':print(await api(stateDir,'/api/requests'));break;
    case 'inspect': print(await api(stateDir,`/api/requests/${encodeURIComponent(required('request'))}`));break;
    case 'result':print(await api(stateDir,`/api/requests/${encodeURIComponent(required('request'))}/result`,JSON.parse(required('data'))));break;
    case 'send':print(await api(stateDir,`/api/requests/${encodeURIComponent(required('request'))}/responses`,{responseId:required('response-id'),data:JSON.parse(required('data'))}));break;
    case 'close':print(await api(stateDir,`/api/requests/${encodeURIComponent(required('request'))}/close`,{}));break;
    default:throw new Error('Unknown command. Use surface --help.');
  }
}
if(import.meta.main)main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
