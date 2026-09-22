import {test,expect} from 'bun:test';
import {selectSkills} from '../scripts/agent/provider.ts';
const base={mode:'setup',userHome:'/user',env:{},exists:()=>false,interactive:false};
test('unique detection selects provider; two or none require a choice without a terminal',async()=>{
 expect(await selectSkills({...base,exists:p=>p==='/user/.claude'})).toBe('/user/.claude/skills');
 await expect(selectSkills(base)).rejects.toThrow('ambiguous');
 await expect(selectSkills({...base,exists:()=>true})).rejects.toThrow('ambiguous');
});
test('menu preselects detected Claude and Enter accepts; saved selection wins detection',async()=>{
 let prompt='';expect(await selectSkills({...base,interactive:true,exists:p=>p.endsWith('.claude'),ask:async q=>{prompt=q;return '';}})).toBe('/user/.claude/skills');
 expect(prompt).toContain('Claude Code (detected) [selected]');
 expect(await selectSkills({...base,interactive:true,saved:'/user/.codex/skills',exists:()=>true,ask:async()=>''})).toBe('/user/.codex/skills');
});
test('explicit flags override saved selection and refresh reuses saved custom path',async()=>{
 expect(await selectSkills({...base,provider:'codex',env:{CODEX_HOME:'/custom'},saved:'/previous'})).toBe('/custom/skills');
 expect(await selectSkills({...base,mode:'refresh',saved:'/saved',interactive:true,ask:async()=>{throw Error('unexpected prompt');}})).toBe('/saved');
 await expect(selectSkills({...base,provider:'other'})).rejects.toThrow('codex or');
 await expect(selectSkills({...base,provider:'claude',explicit:'/custom'})).rejects.toThrow('not both');
});
test('menu can select Claude when both detected and retries invalid input',async()=>{
 const replies=['x','2'];expect(await selectSkills({...base,interactive:true,exists:()=>true,ask:async()=>replies.shift()!})).toBe('/user/.claude/skills');
});
