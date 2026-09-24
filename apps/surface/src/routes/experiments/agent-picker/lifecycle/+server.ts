import {env} from '$env/dynamic/private';
import {json,error} from '@sveltejs/kit';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../../../../lib/server/services/store.ts';
import {Service} from '../../../../lib/server/services/service.ts';
import {DeliveryError,type AgentAdapter} from '../../../../lib/server/agent-adapters/codex.ts';
import {RecipientWorkflow} from '../../../../lib/server/services/recipient-workflow.ts';

export const POST = async ({request,url}) => {
 if(env.SURFACE_AGENT_PICKER_EXPERIMENT!=='1'||env.SURFACE_AGENT_DIRECTORY_SOCKET)error(404);
 if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||request.headers.get('origin')!==url.origin)error(403);
 for(const [id,s] of sessions)if(s.expires<Date.now()){sessions.delete(id);rmSync(s.root,{recursive:true,force:true});}
 const body=await request.json();
 if(body.operation==='create'){
  if(sessions.size>=50)error(429);
  const root=mkdtempSync(join(tmpdir(),'surface-picker-')),store=new Store(join(root,'state.json'));
  for(const id of ['a','b'])store.update(s=>s.bindings.push({id,threadId:`fixture-${id}`,projectRoot:root,socketPath:'/fixture'}));
  let session:ReturnType<typeof sessions.get>;
  const adapter:AgentAdapter={inspect:async()=>{if(session?.offline)throw Error('Fixture provider offline');return {status:'idle'}},deliver:async()=>{if(session?.uncertain)throw new DeliveryError('Fixture connection lost after write','unknown');return {mode:'start',turnId:'fixture-turn'}}};
  const service=new Service(store,adapter,'fixture-only');const first=service.create({bindingId:'a',title:'Lifecycle fixture',schema:{type:'object'}});
  session={root,flow:new RecipientWorkflow(service,adapter),request:first.id,offline:false,uncertain:false,expires:Date.now()+3600000};
  const token=crypto.randomUUID();sessions.set(token,session);return json({token,request:first.id});
 }
 const token=request.headers.get('authorization')?.replace(/^Bearer /,'')??'',session=sessions.get(token);if(!session)error(401);
 if(body.operation==='reset'){sessions.delete(token);rmSync(session.root,{recursive:true,force:true});return json({reset:true});}
 try{
  if(body.operation==='offline')session.offline=true;
  else if(body.operation==='online')session.offline=false;
  else if(body.operation==='uncertain')session.uncertain=true;
  else if(body.operation==='takeover'){session.request=(await session.flow.takeOver(session.request,'b')).request.id;}
  else if(body.operation==='submit')await session.flow.submit(session.request,{responseId:body.responseId,data:{draft:body.draft}});
  else if(body.operation==='result')session.flow.service.result(session.request,{message:'Fixture agent processed the choice.'});
  else if(body.operation!=='read')error(400);
  return json({request:session.flow.service.view(session.request),recipient:await session.flow.recipient(session.request)});
 }catch(e){return json({error:e instanceof Error?e.message:'Fixture operation failed'}, {status:409});}
};

const sessions=new Map<string,{root:string;flow:RecipientWorkflow;request:string;offline:boolean;uncertain:boolean;expires:number}>();
