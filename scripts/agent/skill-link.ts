import { mkdirSync, lstatSync, realpathSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

export function inspectSkillLink(root: string, skillsDirectory: string) {
  const source=realpathSync(join(root,'skills/surface'));
  const destination=join(resolve(skillsDirectory),'surface');
  let entry;
  try {entry=lstatSync(destination);} catch(error) {if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  if(entry) {
    if(!entry.isSymbolicLink())throw new Error(`Preserving existing file/directory: ${destination}. Move it explicitly before linking.`);
    let target;try {target=realpathSync(destination);} catch {throw new Error(`Preserving broken skill link: ${destination}. Inspect it before replacing.`);}
    if(target!==source)throw new Error(`Preserving skill link to another source: ${destination} -> ${target}.`);
  }
  return {source,destination,linked:!!entry};
}
export function linkSkill(root:string,skillsDirectory:string) {
  const state=inspectSkillLink(root,skillsDirectory);
  if(!state.linked){mkdirSync(resolve(skillsDirectory),{recursive:true});symlinkSync(state.source,state.destination,'dir');}
  const checked=inspectSkillLink(root,skillsDirectory);
  if(!checked.linked)throw new Error('Skill link verification failed.');
  return checked;
}
