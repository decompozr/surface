import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';


export const loadPrompts = async (bootstrap=false) => {
 const root=resolve(import.meta.dir,'../../../..');
 if(!existsSync(join(root,'node_modules/@clack/prompts/package.json'))) {
  if(!bootstrap)throw new Error('Setup UI dependencies are missing. Run ./bin/setup or bun install --frozen-lockfile --ignore-scripts.');
  console.log('Preparing Surface setup…');
  const child=Bun.spawn([process.execPath,'install','--frozen-lockfile','--ignore-scripts'],{cwd:root,stdout:'pipe',stderr:'pipe'});
  const [code,out,err]=await Promise.all([child.exited,new Response(child.stdout).text(),new Response(child.stderr).text()]);
  if(code)throw new Error('Could not prepare setup dependencies.\n'+err+out);
 }
 return import('@clack/prompts');
};
