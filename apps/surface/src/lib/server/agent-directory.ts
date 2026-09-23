export type Candidate = { id:string; title:string; provider:string; projectId:string; workspaceId:string; status:'active'|'idle'|'unavailable'; archived?:boolean };
export function groupAgents(records:Candidate[],projectId:string,workspaceId:string) {
  const visible=records.filter(r=>r.projectId===projectId&&!r.archived);
  const rank={active:0,idle:1,unavailable:2};
  visible.sort((a,b)=>rank[a.status]-rank[b.status]||a.title.localeCompare(b.title));
  const publicRow=({projectId:_,archived:__,...row}:Candidate)=>row;
  return {worktree:visible.filter(r=>r.workspaceId===workspaceId).map(publicRow),project:visible.filter(r=>r.workspaceId!==workspaceId).map(publicRow)};
}
// Explicit fixtures only: no provider discovery or conversation delivery is performed.
export function fixtureDirectory(scenario:string) {
  if(scenario==='offline')return {available:false,worktree:[],project:[]};
  const records:Candidate[]=[
    {id:'fixture-a',title:'Research review',provider:'Codex (fixture)',projectId:'demo',workspaceId:'main',status:'active'},
    {id:'fixture-b',title:'Evidence check',provider:'Codex (fixture)',projectId:'demo',workspaceId:'main',status:'idle'},
    {id:'fixture-c',title:'Alternative approach',provider:'Codex (fixture)',projectId:'demo',workspaceId:'exploration',status:'idle'},
    {id:'unrelated',title:'Other project',provider:'fixture',projectId:'other',workspaceId:'main',status:'active'},
  ];
  return {available:true,...groupAgents(records.filter(r=>scenario!=='deleted'||r.id!=='fixture-a'),'demo','main')};
}
