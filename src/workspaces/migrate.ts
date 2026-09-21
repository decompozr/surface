import { existsSync, lstatSync, readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync, openSync, closeSync, realpathSync, readdirSync } from 'node:fs';
import { join, resolve, relative, isAbsolute, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { inspectGit, type Workspace } from './identity.ts';
import { readProjectManifest } from '../core/projects.ts';

const digest=(text:string)=>createHash('sha256').update(text).digest('hex');
const names=['project-bindings.json','registry.json','interactions.json','workspaces.json','workspace-host.json'];
const inside=(parent:string,child:string)=>{const p=relative(parent,child);return !p || (p!=='..'&&!p.startsWith('../')&&!isAbsolute(p));};
function regular(path:string) {if(!lstatSync(path).isFile()) throw new Error('Migration inputs must be regular files: '+path);return readFileSync(path,'utf8');}
function canonical(path:string) {path=resolve(path);let ancestor=path;while(!existsSync(ancestor)) ancestor=dirname(ancestor);if(realpathSync(ancestor)!==ancestor) throw new Error('Use canonical data paths without symlinks.');return path;}
export async function planMigration(stateDir:string,dataRoot:string,storageMap:Record<string,string>={}) {
  stateDir=resolve(stateDir);dataRoot=canonical(dataRoot);
  if(existsSync(join(stateDir,'server.lock'))) throw new Error('Stop the selected host before planning its workspace migration.');
  if(existsSync(join(stateDir,'workspace-migration.pending.json'))) throw new Error('A migration is incomplete; restore its backup first.');
  if(existsSync(join(stateDir,'workspaces.json')) || existsSync(join(stateDir,'workspace-host.json'))) throw new Error('Workspace state already exists; refusing to replace it.');
  if(existsSync(join(stateDir,'state.json'))) throw new Error('Per-runtime prototype state is not supported by this singleton migration.');
  const inputs=Object.fromEntries(names.filter(n=>existsSync(join(stateDir,n))).map(n=>[n,regular(join(stateDir,n))]));
  if(!inputs['project-bindings.json']) throw new Error('No legacy project binding ledger to migrate.');
  const legacy=JSON.parse(inputs['project-bindings.json']);
  if(legacy.version!==1 || !Array.isArray(legacy.projects) || !legacy.projects.length) throw new Error('Expected a nonempty version-1 project binding ledger.');
  const projects:{id:string;commonDir:string;workspaces:Workspace[]}[]=[], markers:{path:string;contents:string}[]=[];
  for(const item of legacy.projects) {
    if(typeof item.root!=='string'||!isAbsolute(item.root)) throw new Error('Invalid legacy root.');
    const git=await inspectGit(item.root),manifest=readProjectManifest(git.root);
    if(manifest.projectId!==item.projectId || projects.some(p=>p.id===manifest.projectId || p.workspaces.some(w=>w.root===git.root))) throw new Error('Legacy project identity mismatch or duplicate.');
    if(git.roots.some(root=>inside(existsSync(root)?realpathSync(root):resolve(root),dataRoot)) || inside(dataRoot,git.root)) throw new Error('Persistent data root overlaps a worktree.');
    const marker=join(git.gitDir,'surface-workspace.json'); if(existsSync(marker)) throw new Error('Existing Git workspace marker requires explicit reconciliation.');
    const id=crypto.randomUUID(),namespace=`p-${manifest.projectId}`;
    let dataDirectory=join(dataRoot,manifest.projectId,id),storage: 'adopted'|undefined;
    const mapped=storageMap[manifest.projectId];
    if(mapped!==undefined) {
      if(typeof mapped!=='string'||!isAbsolute(mapped)||!existsSync(mapped)||!lstatSync(mapped).isDirectory()) throw new Error('Storage map entries must name existing persistent directories.');
      dataDirectory=canonical(mapped);storage='adopted';
      if(git.roots.some(root=>inside(existsSync(root)?realpathSync(root):resolve(root),dataDirectory)) || inside(dataDirectory,git.root)) throw new Error('Adopted project storage overlaps a worktree.');
    } else if(existsSync(join(git.root,'surface.backend.json')) || (existsSync(join(git.root,'data')) && readdirSync(join(git.root,'data')).length)) {
      throw new Error('Project '+manifest.projectId+' has a backend or existing data. Prepare its project-owned persistent data directory and provide --storage-map; migration never guesses or copies a database.');
    }
    if(projects.some(p=>p.workspaces.some(w=>inside(w.dataDirectory,dataDirectory)||inside(dataDirectory,w.dataDirectory))))throw new Error('Project storage mappings overlap.');
    const workspace:Workspace={id,root:git.root,gitDir:git.gitDir,namespace,branch:git.branch,status:'active',dataDirectory,...(storage?{storage}:{})};
    projects.push({id:manifest.projectId,commonDir:git.commonDir,workspaces:[workspace]});
    markers.push({path:marker,contents:JSON.stringify({version:1,projectId:manifest.projectId,workspaceId:id})+'\n'});
  }
  if(Object.keys(storageMap).some(id=>!projects.some(p=>p.id===id))) throw new Error('Storage map contains an unknown project ID.');
  const mounts=inputs['registry.json']?JSON.parse(inputs['registry.json']).mounts:[];
  if(!Array.isArray(mounts)) throw new Error('Invalid runtime registry.');
  for(const mount of mounts) {
    if(!projects.some(p=>p.workspaces.some(w=>w.namespace===mount.namespace&&w.root===mount.projectRoot))) throw new Error('Legacy mount is not owned by a mapped project scope; reconcile it before migration.');
  }
  const interactions=inputs['interactions.json']?JSON.parse(inputs['interactions.json']):{version:1,requests:[],bindings:[]};
  if(interactions.version!==1||!Array.isArray(interactions.requests)||!Array.isArray(interactions.bindings)) throw new Error('Invalid interaction store.');
  const scopeMap=projects.flatMap(p=>p.workspaces);
  for(const request of interactions.requests) {
    if(request.previewScope&&!scopeMap.some(w=>w.namespace===request.previewScope.namespace&&w.root===request.previewScope.projectRoot)) throw new Error('Interaction scope is outside the mapped legacy projects.');
  }
  return {version:1 as const,stateDir,dataRoot,inputs,markers,ledger:{version:1,dataRoot,projects},preserveNamespaces:true,preserveInteractions:true,copyProjectData:false};
}
function atomic(path:string,text:string) {const tmp=path+'.'+crypto.randomUUID()+'.tmp';try{writeFileSync(tmp,text,{mode:0o600,flag:'wx'});renameSync(tmp,path);}finally{if(existsSync(tmp))unlinkSync(tmp);}}
function lock(stateDir:string,recoveryId?:string) {
  const path=join(stateDir,'server.lock');
  if(recoveryId&&existsSync(path)) {
    const bytes=regular(path),owner=JSON.parse(bytes),pending=JSON.parse(regular(join(stateDir,'workspace-migration.pending.json')));
    if(owner.operation!=='workspace-migration'||!Number.isInteger(owner.pid)||owner.pid<1||pending.id!==recoveryId)throw new Error('Lock is not owned by this interrupted migration.');
    try{process.kill(owner.pid,0);throw new Error('Migration owner is still alive; no lock was removed.');}
    catch(error){if((error as NodeJS.ErrnoException).code!=='ESRCH')throw error;}
    if(regular(path)!==bytes)throw new Error('Migration ownership changed.');
    renameSync(path,join(stateDir,'workspace-migrations',recoveryId,'abandoned-lock-'+crypto.randomUUID()+'.json'));
  }
  const fd=openSync(path,'wx',0o600);writeFileSync(fd,JSON.stringify({pid:process.pid,operation:'workspace-migration'}));return()=>{closeSync(fd);unlinkSync(path);};
}
export async function migrate(stateDir:string,dataRoot:string,storageMap:Record<string,string>={},failBeforeCommit?:()=>void) {
  const plan=await planMigration(stateDir,dataRoot,storageMap),unlock=lock(plan.stateDir);
  const id=crypto.randomUUID(),backup=join(plan.stateDir,'workspace-migrations',id),pending=join(plan.stateDir,'workspace-migration.pending.json');
  const output={'workspaces.json':JSON.stringify(plan.ledger,null,2)+'\n','workspace-host.json':JSON.stringify({version:1,dataRoot:plan.dataRoot})+'\n'};
  const journal={version:1,id,inputs:plan.inputs,output,markers:plan.markers};
  let journalWritten=false;
  try {
    for(const name of names) {
      const path=join(plan.stateDir,name),before=plan.inputs[name];
      if((existsSync(path)?regular(path):undefined)!==before) throw new Error('State changed while planning migration.');
    }
    mkdirSync(backup,{recursive:true,mode:0o700});
    for(const [name,text] of Object.entries(plan.inputs)) writeFileSync(join(backup,name),text,{mode:0o600,flag:'wx'});
    writeFileSync(join(backup,'receipt.json'),JSON.stringify(journal,null,2),{mode:0o600,flag:'wx'});
    atomic(pending,JSON.stringify({version:1,id}));journalWritten=true;
    for(const marker of plan.markers) writeFileSync(marker.path,marker.contents,{mode:0o600,flag:'wx'});
    for(const [name,text] of Object.entries(output)) atomic(join(plan.stateDir,name),text);
    failBeforeCommit?.();
    // Preserve every old route/record byte. Only retire the obsolete single-root ledger.
    unlinkSync(join(plan.stateDir,'project-bindings.json'));
    unlinkSync(pending);journalWritten=false;
    return {status:'migrated',backup,id,projects:plan.ledger.projects.length,preserveNamespaces:true,preserveInteractions:true,projectDataMoved:false};
  } catch(error) {
    if(journalWritten) restoreJournal(plan.stateDir,journal);
    throw error;
  } finally {unlock();}
}
function restoreJournal(stateDir:string,journal:any) {
  for(const name of names) {
    const path=join(stateDir,name),current=existsSync(path)?regular(path):undefined,before=journal.inputs[name],after=journal.output[name];
    if(current!==before&&current!==after&&!(name==='project-bindings.json'&&current===undefined)) throw new Error('Migration state changed; refusing to overwrite newer data: '+name);
  }
  for(const marker of journal.markers) if(existsSync(marker.path)&&regular(marker.path)!==marker.contents) throw new Error('Git identity marker changed; refusing rollback.');
  for(const name of names) {
    const path=join(stateDir,name),before=journal.inputs[name];
    if(before!==undefined) atomic(path,before); else if(existsSync(path))unlinkSync(path);
  }
  for(const marker of journal.markers) if(existsSync(marker.path))unlinkSync(marker.path);
  const pending=join(stateDir,'workspace-migration.pending.json');if(existsSync(pending))unlinkSync(pending);
}
export function rollbackMigration(stateDir:string,id:string) {
  if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('Invalid migration backup identity.');
  const unlock=lock(stateDir,id);
  try {
    const journal=JSON.parse(regular(join(stateDir,'workspace-migrations',id,'receipt.json')));
    if(journal.version!==1||journal.id!==id||!journal.inputs||!journal.output||!Array.isArray(journal.markers))throw new Error('Invalid migration receipt.');
    restoreJournal(stateDir,journal);return {status:'restored',id};
  } finally{unlock();}
}
export function publicPlan(plan:Awaited<ReturnType<typeof planMigration>>) {
  return {stateDir:plan.stateDir,dataRoot:plan.dataRoot,projects:plan.ledger.projects.map(p=>({projectId:p.id,commonDir:p.commonDir,root:p.workspaces[0]!.root,namespace:p.workspaces[0]!.namespace,dataDirectory:p.workspaces[0]!.storage==='adopted'?p.workspaces[0]!.dataDirectory:join(plan.dataRoot,p.id,'<new-workspace-id>')})),preserveNamespaces:true,preserveInteractions:true,projectDataMoved:false,inputHashes:Object.fromEntries(Object.entries(plan.inputs).map(([name,text])=>[name,digest(text)]))};
}
