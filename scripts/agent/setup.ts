import { parseArgs } from 'node:util';
import { resolve, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { installationHome } from '../../src/installation/paths.ts';
import { inspectSkillLink, linkSkill } from './skill-link.ts';
const {values,positionals}=parseArgs({allowPositionals:true,options:{home:{type:'string'},'skills-dir':{type:'string'},port:{type:'string'},ref:{type:'string'},help:{type:'boolean'}}});
const mode=positionals[0];
if(values.help){console.log('bun scripts/agent/setup.ts setup|test|refresh --skills-dir PROVIDER_SKILLS_DIRECTORY [--home PATH] [--port PORT] [--ref COMMIT]');process.exit(0);}
if(!['setup','test','refresh'].includes(mode??'')||positionals.length!==1||!values['skills-dir'])throw new Error('Specify setup, test or refresh and --skills-dir for the intended provider.');
const root=resolve(import.meta.dir,'../..'),home=installationHome(values.home),skills=resolve(values['skills-dir']);
const env: NodeJS.ProcessEnv={...process.env,SURFACE_HOME:home};delete env.SURFACE_STATE_DIR;
async function run(args:string[],cwd=root) {
  const child=Bun.spawn(args,{cwd,env,stdout:'pipe',stderr:'pipe'});
  const [code,out,err]=await Promise.all([child.exited,new Response(child.stdout).text(),new Response(child.stderr).text()]);
  if(code)throw new Error(err+out);return out.trim();
}
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
if(pkg.packageManager!==`bun@${Bun.version}`)throw new Error(`Use ${pkg.packageManager}; current runtime is bun@${Bun.version}.`);
inspectSkillLink(root,skills); // Detect conflicts before touching the service.
const launcher=join(home,'bin/surface');
async function cli(...args:string[]){return JSON.parse(await run([launcher,...args,'--home',home]));}
async function verify() {
  const skill=inspectSkillLink(root,skills);if(!skill.linked)throw new Error('Provider skill link is missing. Run setup first.');
  const status=await cli('status');if(status.status!=='running')throw new Error('Selected Surface is stopped; run its start command first.');
  const doctor=await cli('doctor');
  const origin=status.lifecycle.origin;
  const response=await fetch(origin+'/health');
  const health=await response.json();
  if(!response.ok||health.runtime?.instanceId!==status.lifecycle.instanceId)throw new Error('Installed app health does not match the selected service.');
  console.log(JSON.stringify({status:'verified',home,launcher,origin,release:status.lifecycle.release,skill,doctor,agentDiscovery:'Restart/reload the provider if needed. Filesystem linking does not prove provider discovery or live conversation delivery.'},null,2));
}
if(mode==='test'){await verify();process.exit(0);}
if(await run(['git','status','--porcelain']))throw new Error('Commit or preserve checkout changes before setup/refresh. Only committed source is installed.');
const commit=await run(['git','rev-parse','--verify',`${values.ref??'HEAD'}^{commit}`]);
// Skills stay linked to this checkout; keep the installed source and instructions aligned.
if(commit!==await run(['git','rev-parse','HEAD']))throw new Error('Check out the selected commit before setup so linked skills match the installed release.');
await run([process.execPath,'install','--frozen-lockfile','--ignore-scripts']);
await run([process.execPath,'run','check']);
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
} catch(error) {
  // Installation activates last. Recover availability of the selected release when possible.
  if(wasRunning&&existsSync(launcher))try{if((await cli('status')).status==='stopped')await cli('start');}catch{}
  throw error;
}
