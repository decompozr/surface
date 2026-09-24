import {test,expect} from 'bun:test';
import {selectSkills} from '../../src/installation/setup/provider.ts';
const base={mode:'setup',userHome:'/user',env:{},exists:()=>false,interactive:false};
test('detects both providers and selects both by default',async()=>{
 expect(await selectSkills({...base,exists:()=>true})).toEqual(['/user/.codex/skills','/user/.claude/skills']);
 await expect(selectSkills(base)).rejects.toThrow('no provider');
 expect(await selectSkills({...base,interactive:true,exists:()=>true,choose:async(_choices,initial)=>{expect(initial).toEqual([0,1]);return initial;}})).toEqual(['/user/.codex/skills','/user/.claude/skills']);
});
test('retains saved provider directories',async()=>{
 expect(await selectSkills({...base,mode:'setup',saved:['/saved']})).toEqual(['/saved']);
 expect(await selectSkills({...base,mode:'test',saved:['/one','/two']})).toEqual(['/one','/two']);
 expect(await selectSkills({...base,interactive:true,saved:['/user/.claude/skills'],exists:()=>true,choose:async(_c,initial)=>{expect(initial).toEqual([1]);return initial;}})).toEqual(['/user/.claude/skills']);
});
test('repeatable providers and paths deduplicate; conflicting flags fail',async()=>{
 expect(await selectSkills({...base,provider:['codex','claude','codex']})).toEqual(['/user/.codex/skills','/user/.claude/skills']);
 expect(await selectSkills({...base,explicit:['/one','/one','/two']})).toEqual(['/one','/two']);
 await expect(selectSkills({...base,provider:['other']})).rejects.toThrow('codex or');
 await expect(selectSkills({...base,provider:['claude'],explicit:['/custom']})).rejects.toThrow('not both');
});
test('custom directory can accompany providers; empty choice fails',async()=>{
 expect(await selectSkills({...base,interactive:true,choose:async()=>[0,2],ask:async()=>'/custom'})).toEqual(['/user/.codex/skills','/custom']);
 await expect(selectSkills({...base,interactive:true,choose:async()=>[]})).rejects.toThrow('at least one');
});
