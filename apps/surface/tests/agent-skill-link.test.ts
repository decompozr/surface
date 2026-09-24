import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, realpathSync, rmSync, symlinkSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { linkSkill } from '../../installer/src/setup/skill-link.ts';

test('provider skill is a live idempotent link to the checkout, never a copy',()=>{
 const base=realpathSync(mkdtempSync('/tmp/surface-skill-'));
 try {
  const root=join(base,'checkout'),provider=join(base,'provider/skills');mkdirSync(join(root,'skills/surface'),{recursive:true});
  const file=join(root,'skills/surface/SKILL.md');writeFileSync(file,'first');
  const link=linkSkill(root,provider);expect(lstatSync(link.destination).isSymbolicLink()).toBe(true);
  expect(linkSkill(root,provider).source).toBe(link.source);
  writeFileSync(file,'refreshed');expect(readFileSync(join(link.destination,'SKILL.md'),'utf8')).toBe('refreshed');
 }finally{rmSync(base,{recursive:true,force:true});}
});
test('existing provider directories, foreign links and broken links are preserved',()=>{
 const base=realpathSync(mkdtempSync('/tmp/surface-skill-'));
 try {
  const root=join(base,'checkout');mkdirSync(join(root,'skills/surface'),{recursive:true});
  for(const kind of ['directory','foreign','broken']) {
   const dir=join(base,kind);mkdirSync(dir);const target=join(dir,'surface');
   if(kind==='directory')mkdirSync(target);else symlinkSync(kind==='foreign'?root:join(base,'missing'),target);
   expect(()=>linkSkill(root,dir)).toThrow('Preserving');expect(lstatSync(target)).toBeDefined();
  }
 }finally{rmSync(base,{recursive:true,force:true});}
});
