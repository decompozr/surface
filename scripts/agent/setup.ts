import { parseArgs } from 'node:util';
import { resolve, join } from 'node:path';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline/promises';
import { requireCompatibleBun } from '../../src/installation/bun-version.ts';
import { installationHome } from '../../src/installation/paths.ts';
import { inspectSkillLink, linkSkill } from './skill-link.ts';
export async function agentSetup(args=process.argv.slice(2)) {
const {values,positionals}=parseArgs({args,allowPositionals:true,options:{home:{type:'string'},'skills-dir':{type:'string'},port:{type:'string'},ref:{type:'string'},help:{type:'boolean'}}});
const mode=positionals[0];
if(values.help){console.log('./bin/setup | ./bin/test | ./bin/refresh [--skills-dir PATH] [--home PATH] [--port PORT] [--ref COMMIT]\nSkills: explicit path, saved selection, CODEX_HOME/skills, or existing ~/.codex/skills; otherwise prompt in a terminal.');return;}
if(!['setup','test','refresh'].includes(mode??'')||positionals.length!==1)throw new Error('Specify setup, test or refresh.');
const root=resolve(import.meta.dir,'../..'),home=installationHome(values.home);
const configuration=join(home,'agent-setup.json');
const saved=existsSync(configuration)?JSON.parse(readFileSync(configuration,'utf8')):undefined;
let skillsPath=values['skills-dir']??saved?.skillsDirectory;
if(!skillsPath && process.env.CODEX_HOME)skillsPath=join(process.env.CODEX_HOME,'skills');
if(!skillsPath && existsSync(join(homedir(),'.codex/skills')))skillsPath=join(homedir(),'.codex/skills');
if(!skillsPath) {
  if(!process.stdin.isTTY)throw new Error('No provider skills directory found. Supply --skills-dir PATH.');
  const terminal=createInterface({input:process.stdin,output:process.stdout});
  try{skillsPath=(await terminal.question('Agent provider skills directory (absolute path): ')).trim();}finally{terminal.close();}
  if(!skillsPath)throw new Error('A provider skills directory is required.');
}
const skills=resolve(skillsPath);
console.log(`Surface ${mode}: ${home}\nSkill symlink: ${join(skills,'surface')} -> ${join(root,'skills/surface')}`);
const env: NodeJS.ProcessEnv={...process.env,SURFACE_HOME:home};delete env.SURFACE_STATE_DIR;
async function run(args:string[],cwd=root) {
  const child=Bun.spawn(args,{cwd,env,stdout:'pipe',stderr:'pipe'});
  const [code,out,err]=await Promise.all([child.exited,new Response(child.stdout).text(),new Response(child.stderr).text()]);
  if(code)throw new Error(err+out);return out.trim();
}
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
requireCompatibleBun(pkg.packageManager,Bun.version);
if(values.port!==undefined && (!Number.isInteger(Number(values.port)) || Number(values.port)<0 || Number(values.port)>65535))throw new Error('Invalid port.');
inspectSkillLink(root,skills); // Detect conflicts before touching the service.
const launcher=join(home,'bin/surface');
async function cli(...args:string[]){return JSON.parse(await run([launcher,...args,'--home',home]));}
async function verify() {
  const skill=inspectSkillLink(root,skills);if(!skill.linked)throw new Error('Provider skill link is missing. Run setup first.');
  const status=await cli('status');if(status.status!=='running')throw new Error('Selected Surface is stopped; run its start command first.');
  const checkoutCommit=await run(['git','rev-parse','HEAD']);
  if(status.lifecycle.commit!==checkoutCommit)throw new Error('Installed release differs from the linked checkout HEAD. Run refresh for this selected installation.');
  const doctor=await cli('doctor');
  const origin=status.lifecycle.origin;
  const response=await fetch(origin+'/health');
  const health=await response.json();
  if(!response.ok||health.runtime?.instanceId!==status.lifecycle.instanceId)throw new Error('Installed app health does not match the selected service.');
  console.log(JSON.stringify({status:'verified',home,launcher,origin,release:status.lifecycle.release,skill,doctor,agentDiscovery:'Restart/reload the provider if needed. Filesystem linking does not prove provider discovery or live conversation delivery.'},null,2));
}
if(mode==='test'){await verify();return;}
if(await run(['git','status','--porcelain']))throw new Error('Commit or preserve checkout changes before setup/refresh. Only committed source is installed.');
const commit=await run(['git','rev-parse','--verify',`${values.ref??'HEAD'}^{commit}`]);
// Skills stay linked to this checkout; keep the installed source and instructions aligned.
if(commit!==await run(['git','rev-parse','HEAD']))throw new Error('Check out the selected commit before setup so linked skills match the installed release.');
for(const folder of ['', 'experiments/singleton', 'experiments/mcp', 'apps/surface'])await run([process.execPath,'install','--frozen-lockfile','--ignore-scripts'],join(root,folder));
await run([process.execPath,'run','check']);
await run([process.execPath,'run','check'],join(root,'apps/surface'));
await run([process.execPath,'test','tests/release-bundle.test.ts','tests/agent-skill-link.test.ts']);
let wasRunning=false;
if(existsSync(launcher)) {
  wasRunning=(await cli('status')).status==='running';
  if(wasRunning&&mode==='setup')throw new Error('Selected installation is already running. Use test, or refresh to explicitly restart it.');
}
if(wasRunning)await cli('stop');
try {
  await run([process.execPath,join(root,'src/cli/index.ts'),'install','--repo',root,'--ref',commit,'--home',home]);
  linkSkill(root,skills);
  await cli('start',...(values.port?['--port',values.port]:[]));
  await verify();
  writeFileSync(configuration,JSON.stringify({version:1,skillsDirectory:skills},null,2)+'\n',{mode:0o600});
} catch(error) {
  // Installation activates last. Recover availability of the selected release when possible.
  if(wasRunning&&existsSync(launcher))try{if((await cli('status')).status==='stopped')await cli('start');}catch{}
  throw error;
}

}
if(import.meta.main)agentSetup().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
