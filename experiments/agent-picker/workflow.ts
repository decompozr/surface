import {Service,InputError} from '../../src/core/service';
import type {AgentAdapter} from '../../src/adapters/codex';
/** Isolated experiment wrapper: production endpoints are unchanged. */
export class RecipientWorkflow {
 private pending=new Set<string>();
 constructor(readonly service:Service,private adapter:AgentAdapter){}
 async recipient(id:string){
  const request=this.service.get(id),binding=this.service.store.state.bindings.find(b=>b.id===request.bindingId);
  if(!binding)return {threadId:null,status:'missing',canSubmit:false};
  try{const {status}=await this.adapter.inspect(binding);return {threadId:binding.threadId,status,canSubmit:!request.closed&&!request.response&&['active','idle','notLoaded'].includes(status)};}
  catch{return {threadId:binding.threadId,status:'unknown',canSubmit:false};}
 }
 async submit(id:string,input:unknown){
  if(this.pending.has(id))throw new InputError('Submission in progress. Inspect the existing request.',409);
  this.pending.add(id);
  try{
   // Existing submissions are reconciled by the service, never delivered twice.
   if(this.service.get(id).response)return await this.service.submit(id,input);
   if(!(await this.recipient(id)).canSubmit)throw new InputError('Recipient unavailable. Draft was not submitted.',409);
   return await this.service.submit(id,input);
  }finally{this.pending.delete(id);}
 }
 async takeOver(id:string,bindingId:string){
  if(this.pending.has(id))throw new InputError('Submission in progress.',409);
  this.pending.add(id);
  try{
   const old=this.service.get(id),binding=this.service.store.state.bindings.find(b=>b.id===bindingId);
   const previous=this.service.store.state.bindings.find(b=>b.id===old.bindingId);
   if(old.response)throw new InputError('Reconcile the submitted request before starting another interaction.',409);
   if(!binding||binding.projectRoot!==previous?.projectRoot)throw new InputError('Recipient must belong to this exact worktree.',409);
   const {status}=await this.adapter.inspect(binding);
   if(!['active','idle','notLoaded'].includes(status))throw new InputError('New recipient is unavailable.',409);
   // Copy the interaction definition, never its token, submission or result.
   const next=this.service.create({bindingId,title:old.title,schema:old.schema},old.previewScope);
   this.service.close(id);
   return {request:next,replaces:id};
  }finally{this.pending.delete(id);}
 }
}
