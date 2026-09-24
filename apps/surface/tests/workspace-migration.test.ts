import { test, expect } from 'bun:test';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fixture } from '../../../experiments/workspaces/fixture.ts';
import { inspectGit, workspaceDirectory } from '../src/lib/server/workspaces/identity.ts';
import { planMigration, migrate, rollbackMigration } from '../src/lib/server/workspaces/migrate.ts';
import { installationHome, serviceState } from '@decompozr/surface-installer/paths';

async function legacy() {
  const f=await fixture();mkdirSync(f.state);
  unlinkSync(join(f.main,'surface.backend.json'));
  const namespace=`p-${f.manifest.projectId}`,name=`a-${f.manifest.artifacts[0]!.id}`;
  const ledger=JSON.stringify({version:1,projects:[{projectId:f.manifest.projectId,root:f.main}]})+'\n';
  const registry=JSON.stringify({namespaces:[namespace],mounts:[{namespace,name,source:join(f.main,'ui'),projectRoot:f.main,status:'unmounted',components:[],props:{},history:[],log:''}]})+'\n';
  const interactions=JSON.stringify({version:1,bindings:[{id:'original-binding',projectRoot:f.main,threadId:'fixture-original'}],requests:[{id:crypto.randomUUID(),bindingId:'original-binding',closed:true,previewScope:{namespace,name,projectRoot:f.main,source:join(f.main,'ui'),component:'src/Form.svelte'},response:{status:'accepted'}}],runtimes:[]})+'\n';
  writeFileSync(join(f.state,'project-bindings.json'),ledger);writeFileSync(join(f.state,'registry.json'),registry);writeFileSync(join(f.state,'interactions.json'),interactions);
  return {...f,ledger,registry,interactions,namespace};
}
test('public service selection is shared and explicit selectors override environment',()=>{
  expect(serviceState({home:'/chosen'},{SURFACE_STATE_DIR:'/other'})).toBe('/chosen/state');
  expect(serviceState({'state-dir':'/chosen'},{SURFACE_HOME:'/other'})).toBe('/chosen');
  expect(serviceState({}, {SURFACE_STATE_DIR:'/shared'})).toBe('/shared');
  expect(()=>serviceState({home:'/a','state-dir':'/b'})).toThrow('either');
  expect(installationHome(undefined,{},'darwin','/user')).toBe('/user/.decompozr/surface');
  expect(installationHome(undefined,{XDG_DATA_HOME:'/elsewhere'},'linux','/user')).toBe('/user/.decompozr/surface');
});
test('migration retains legacy routes and accepted history, backs up bytes, and registers linked worktrees',async()=>{
  const f=await legacy();
  try {
    const plan=await planMigration(f.state,f.data);expect(plan.ledger.projects[0]!.workspaces[0]!.namespace).toBe(f.namespace);
    expect(existsSync(join(f.state,'workspaces.json'))).toBe(false);expect(existsSync(f.data)).toBe(false);
    const result=await migrate(f.state,f.data);
    expect(readFileSync(join(f.state,'registry.json'),'utf8')).toBe(f.registry);
    expect(readFileSync(join(f.state,'interactions.json'),'utf8')).toBe(f.interactions);
    expect(readFileSync(join(result.backup,'project-bindings.json'),'utf8')).toBe(f.ledger);
    expect(existsSync(join(f.state,'project-bindings.json'))).toBe(false);
    const directory=workspaceDirectory(f.state,f.data),main=await directory.identity(f.main,f.manifest,'list'),branch=await directory.identity(f.a,f.manifest,'register');
    expect(main.namespace).toBe(f.namespace);expect(branch.namespace).not.toBe(main.namespace);expect(existsSync(f.data)).toBe(false);
    expect(()=>rollbackMigration(f.state,result.id)).toThrow('newer data');
  }finally{rmSync(f.directory,{recursive:true,force:true});}
});
test('migration failure and explicit pre-use rollback restore exact metadata and identity markers',async()=>{
  const f=await legacy();
  try {
    const marker=join((await inspectGit(f.main)).gitDir,'surface-workspace.json');
    await expect(migrate(f.state,f.data,{},()=>{throw new Error('injected failure');})).rejects.toThrow('injected failure');
    expect(readFileSync(join(f.state,'project-bindings.json'),'utf8')).toBe(f.ledger);
    expect(existsSync(marker)).toBe(false);expect(existsSync(join(f.state,'workspaces.json'))).toBe(false);expect(existsSync(join(f.state,'server.lock'))).toBe(false);
    const result=await migrate(f.state,f.data);rollbackMigration(f.state,result.id);
    expect(readFileSync(join(f.state,'project-bindings.json'),'utf8')).toBe(f.ledger);expect(readFileSync(join(f.state,'interactions.json'),'utf8')).toBe(f.interactions);expect(existsSync(marker)).toBe(false);
  }finally{rmSync(f.directory,{recursive:true,force:true});}
});
test('migration refuses active stores and backend/data guessing; explicit external storage is retained',async()=>{
  const f=await legacy();
  try {
    writeFileSync(join(f.state,'server.lock'),'existing owner');await expect(planMigration(f.state,f.data)).rejects.toThrow('Stop');unlinkSync(join(f.state,'server.lock'));
    writeFileSync(join(f.main,'surface.backend.json'),'{}');await expect(planMigration(f.state,f.data)).rejects.toThrow('storage-map');
    const external=join(f.directory,'project-owned-storage');mkdirSync(external);writeFileSync(join(external,'domain-data'),'retained');
    await expect(planMigration(f.state,f.data,{[f.manifest.projectId]:f.main})).rejects.toThrow('overlaps');
    await migrate(f.state,f.data,{[f.manifest.projectId]:external});
    const directory=workspaceDirectory(f.state,f.data),current=await directory.locate(f.main,f.manifest);
    expect(current.dataDirectory).toBe(external);expect(current.storage).toBe('adopted');expect(readFileSync(join(external,'domain-data'),'utf8')).toBe('retained');expect(existsSync(f.data)).toBe(false);
  }finally{rmSync(f.directory,{recursive:true,force:true});}
});
test('interrupted migration recovery verifies its dead owner and restores the retained backup',async()=>{
  const f=await legacy();
  try {
    const result=await migrate(f.state,f.data),child=Bun.spawn([process.execPath,'-e','process.exit(0)'],{stdout:'ignore',stderr:'ignore'});await child.exited;
    writeFileSync(join(f.state,'workspace-migration.pending.json'),JSON.stringify({version:1,id:result.id}));
    writeFileSync(join(f.state,'server.lock'),JSON.stringify({pid:child.pid,operation:'workspace-migration'}));
    const {startSurface}=await import('../src/lib/server/http/surface.ts');
    await expect(startSurface({stateDir:f.state,dataRoot:f.data,port:0})).rejects.toThrow('incomplete');
    expect(rollbackMigration(f.state,result.id).status).toBe('restored');
    expect(readFileSync(join(f.state,'project-bindings.json'),'utf8')).toBe(f.ledger);
    expect(existsSync(join(f.state,'server.lock'))).toBe(false);expect(existsSync(join(f.state,'workspace-migration.pending.json'))).toBe(false);
  }finally{rmSync(f.directory,{recursive:true,force:true});}
});
test('migrated service mounts the original namespace and keeps its accepted interaction identity',async()=>{
  const f=await legacy();let app:Awaited<ReturnType<typeof import('../src/lib/server/http/surface.ts').startSurface>>|undefined;
  try {
    await migrate(f.state,f.data);const {startSurface}=await import('../src/lib/server/http/surface.ts');app=await startSurface({stateDir:f.state,dataRoot:f.data,port:0});
    const {token}=JSON.parse(readFileSync(join(f.state,'connection.json'),'utf8'));
    const response=await fetch(app.origin+'/api/v1/projects/operations',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({operation:'mount',projectRoot:f.main,artifactId:f.manifest.artifacts[0]!.id})});
    const mounted=await response.json();expect(mounted.ok).toBe(true);expect(mounted.data.namespace).toBe(f.namespace);
    const requests=await (await fetch(app.origin+'/api/requests',{headers:{authorization:`Bearer ${token}`}})).json();
    expect(requests[0].bindingId).toBe('original-binding');expect(requests[0].previewScope.namespace).toBe(f.namespace);expect(requests[0].response.status).toBe('accepted');
    expect(existsSync(f.data)).toBe(false);
  }finally{await app?.stop();rmSync(f.directory,{recursive:true,force:true});}
});
