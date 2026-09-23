import {test,expect} from 'bun:test';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../../src/core/store';
import {Service} from '../../src/core/service';
import {DeliveryError,type AgentAdapter} from '../../src/adapters/codex';
import {RecipientWorkflow} from './workflow';
test('recipient lifecycle: load, disappearance, takeover, delivery, result, no replay',async()=>{
 const root=mkdtempSync(join(tmpdir(),'surface-recipient-'));try{
 const store=new Store(join(root,'state.json'));for(const id of ['a','b','foreign'])store.update(s=>s.bindings.push({id,threadId:id,projectRoot:id==='foreign'?'/other':root,socketPath:'/fixture'}));
 let available=true,unknown=false,count=0;
 const adapter:AgentAdapter={inspect:async()=>{if(!available)throw Error('offline');return {status:'idle'}},deliver:async()=>{count++;if(unknown)throw new DeliveryError('lost after write','unknown');return {mode:'start',turnId:'fixture-turn'}}};
 const service=new Service(store,adapter,'fixture'),flow=new RecipientWorkflow(service,adapter);
 const request=service.create({bindingId:'a',title:'Choose',schema:{type:'object'}});
 expect((await flow.recipient(request.id)).threadId).toBe('a');available=false;
 await expect(flow.submit(request.id,{responseId:'one',data:{choice:'A'}})).rejects.toThrow('unavailable');expect(service.get(request.id).response).toBeUndefined();expect(count).toBe(0);
 available=true;await expect(flow.takeOver(request.id,'foreign')).rejects.toThrow('exact worktree');
 const next=await flow.takeOver(request.id,'b');expect(service.get(request.id).closed).toBe(true);expect(next.request.token).not.toBe(request.token);expect(next.request.bindingId).toBe('b');expect(count).toBe(0);
 const payload={responseId:'one',data:{choice:'A'}};await flow.submit(next.request.id,payload);await flow.submit(next.request.id,payload);expect(count).toBe(1);
 service.result(next.request.id,{message:'Fixture result'});expect(service.view(next.request.id).result?.message).toBe('Fixture result');
 await expect(flow.takeOver(next.request.id,'a')).rejects.toThrow('Reconcile');
 unknown=true;const uncertain=service.create({bindingId:'b',title:'Unknown',schema:{type:'object'}});await flow.submit(uncertain.id,payload);await flow.submit(uncertain.id,payload);expect(service.get(uncertain.id).response?.status).toBe('unknown');expect(count).toBe(2);
 }finally{rmSync(root,{recursive:true,force:true});}
});
