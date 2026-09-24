import {test,expect,beforeAll,afterAll} from 'bun:test';
import {mkdtempSync,realpathSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {discoverAgents} from '../../src/lib/server/agent-adapters/discovery.ts';
import type {Rpc} from '@decompozr/surface-app/server/agent-adapters/rpc';
const root=realpathSync(mkdtempSync(join(tmpdir(),'surface-discovery-test-')));
beforeAll(()=>{execFileSync('git',['init','-q'],{cwd:root});});
afterAll(()=>{rmSync(root,{recursive:true,force:true});});
test('paginates, excludes foreign cwd and archive, preserves provider state, closes',async()=>{
 let page=0,closed=false;
 const rpc:Rpc={async call<T>(method:string,params:any){expect(method).toBe('thread/list');expect(params.archived).toBe(false);page++;return (page===1?{data:[{id:'a',cwd:root,name:'A',status:{type:'idle'}},{id:'foreign',cwd:'/tmp',status:{type:'active'}}],nextCursor:'next'}:{data:[{id:'b',cwd:root,status:{type:'active'}},{id:'c',cwd:root,status:{type:'notLoaded'}},{id:'archived',cwd:root,archived:true}],nextCursor:null}) as T;},close(){closed=true;}};
 const d=await discoverAgents(root,'fixture',async()=>rpc);expect(d.worktree.map(x=>x.id)).toEqual(['b','a','c']);expect(d.worktree[2].status).toBe('notLoaded');expect(closed).toBe(true);
});
test('failed discovery closes transport and does not report an empty successful list',async()=>{let closed=false;await expect(discoverAgents(root,'fixture',async()=>({call:async()=>{throw Error('offline')},close(){closed=true}}))).rejects.toThrow('offline');expect(closed).toBe(true);});
