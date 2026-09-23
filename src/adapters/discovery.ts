import {realpathSync} from 'node:fs';
import {basename} from 'node:path';
import {inspectGit} from '../workspaces/identity';
import {CodexRpc,type Rpc} from './rpc';
export type AgentRow={id:string;title:string;provider:string;workspaceId:string;projectRoot:string;status:string};
type Thread={id:string;name?:string;cwd:string;status?:{type:string};archived?:boolean};
export async function discoverAgents(root:string,socket:string,connect:(p:string)=>Promise<Rpc>=CodexRpc.connect) {
 const git=await inspectGit(root),roots=new Map<string,string>();
 for(const candidate of git.roots)try{const verified=await inspectGit(candidate);if(verified.commonDir===git.commonDir)roots.set(verified.root,verified.gitDir===git.commonDir?'main':basename(verified.root));}catch{}
 const rpc=await connect(socket),worktree:AgentRow[]=[],project:AgentRow[]=[];const seen=new Set<string>(),cursors=new Set<string>();
 try {
  let cursor:string|undefined;
  for(let page=0;page<20;page++) {
   const reply=await rpc.call<{data:Thread[];nextCursor?:string|null}>('thread/list',{cwd:[...roots.keys()],archived:false,useStateDbOnly:true,limit:100,cursor});
   for(const thread of reply.data){
    let cwd:string;try{cwd=realpathSync(thread.cwd);}catch{continue;}
    if(!roots.has(cwd)||thread.archived||seen.has(thread.id))continue;
    seen.add(thread.id);
    const row={id:thread.id,title:thread.name||'Untitled conversation',provider:'Codex',workspaceId:cwd,projectRoot:cwd,status:thread.status?.type??'unknown'};
    (cwd===git.root?worktree:project).push(row);
   }
   if(!reply.nextCursor){const rank=(x:AgentRow)=>x.status==='active'?0:x.status==='idle'?1:2;worktree.sort((a,b)=>rank(a)-rank(b));project.sort((a,b)=>rank(a)-rank(b));return {available:true,worktree,project,checkedAt:new Date().toISOString()};}
   if(cursors.has(reply.nextCursor))throw Error('Provider pagination repeated.');cursors.add(reply.nextCursor);cursor=reply.nextCursor;
  }
  throw Error('Provider directory exceeded the bounded page limit.');
 }finally{rpc.close();}
}
