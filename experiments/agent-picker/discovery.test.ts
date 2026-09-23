import {test,expect} from 'bun:test';
import {discoverAgents} from './discovery';
import type {Rpc} from '../../src/adapters/rpc';
test('paginates, excludes foreign cwd and archive, preserves provider state, closes',async()=>{
 let page=0,closed=false;const root=process.cwd();
 const rpc:Rpc={async call<T>(method:string,params:any){expect(method).toBe('thread/list');expect(params.archived).toBe(false);page++;return (page===1?{data:[{id:'a',cwd:root,name:'A',status:{type:'idle'}},{id:'foreign',cwd:'/tmp',status:{type:'active'}}],nextCursor:'next'}:{data:[{id:'b',cwd:root,status:{type:'active'}},{id:'c',cwd:root,status:{type:'notLoaded'}},{id:'archived',cwd:root,archived:true}],nextCursor:null}) as T;},close(){closed=true;}};
 const d=await discoverAgents(root,'fixture',async()=>rpc);expect(d.worktree.map(x=>x.id)).toEqual(['b','a','c']);expect(d.worktree[2].status).toBe('notLoaded');expect(closed).toBe(true);
});
test('failed discovery closes transport and does not report an empty successful list',async()=>{let closed=false;await expect(discoverAgents(process.cwd(),'fixture',async()=>({call:async()=>{throw Error('offline')},close(){closed=true}}))).rejects.toThrow('offline');expect(closed).toBe(true);});
