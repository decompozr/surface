import {test,expect} from 'bun:test';
import {selectSkills} from '../scripts/agent/provider.ts';
const base={mode:'setup',userHome:'/user',env:{},exists:()=>false,interactive:false};
test('unique detection selects provider; two or none require a choice without a terminal',async()=>{
 expect(await selectSkills({...base,exists:p=>p==='/user/.claude'})).toBe('/user/.claude/skills');
 await expect(selectSkills(base)).rejects.toThrow('ambiguous');
 await expect(selectSkills({...base,exists:()=>true})).rejects.toThrow('ambiguous');
});
test('menu preselects detected Claude and saved selection wins detection',async()=>{
 let selected=-1;expect(await selectSkills({...base,interactive:true,exists:p=>p.endsWith('.claude'),choose:async(choices,index)=>{selected=index;expect(choices[index]!.label).toContain('✓ detected');return index;}})).toBe('/user/.claude/skills');
 expect(selected).toBe(1);
 expect(await selectSkills({...base,interactive:true,saved:'/user/.codex/skills',exists:()=>true,choose:async(_choices,index)=>index})).toBe('/user/.codex/skills');
});
test('explicit flags override saved selection and refresh reuses saved custom path',async()=>{
 expect(await selectSkills({...base,provider:'codex',env:{CODEX_HOME:'/custom'},saved:'/previous'})).toBe('/custom/skills');
 expect(await selectSkills({...base,mode:'refresh',saved:'/saved',interactive:true,ask:async()=>{throw Error('unexpected prompt');}})).toBe('/saved');
 await expect(selectSkills({...base,provider:'other'})).rejects.toThrow('codex or');
 await expect(selectSkills({...base,provider:'claude',explicit:'/custom'})).rejects.toThrow('not both');
});
test('menu can choose Claude or a custom directory',async()=>{
 expect(await selectSkills({...base,interactive:true,exists:()=>true,choose:async()=>1})).toBe('/user/.claude/skills');
 expect(await selectSkills({...base,interactive:true,choose:async()=>2,ask:async()=>'/custom/skills'})).toBe('/custom/skills');
});
