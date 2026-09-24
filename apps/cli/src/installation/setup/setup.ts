import { selectAccess, reconcileAccess } from './tailscale.ts';
import { parseArgs } from 'node:util';
import { resolve, join } from 'node:path';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { loadPrompts } from './prompts.ts';
import { selectSkills } from './provider.ts';
import { requireCompatibleBun } from '../bun-version.ts';
import { installationHome } from '../paths.ts';
import { inspectSkillLink, linkSkill } from './skill-link.ts';

export const agentSetup = async (args=process.argv.slice(2)) => {

const run = async (args:string[],cwd=root) => {
  const child=Bun.spawn(args,{cwd,env,stdout:'pipe',stderr:'pipe'});
  const [code,out,err]=await Promise.all([child.exited,new Response(child.stdout).text(),new Response(child.stderr).text()]);
  if(code)throw new Error(err+out);return out.trim();
};

const cli = async (...args:string[]) => {return JSON.parse(await run([launcher,...args,'--home',home]));};

const verify = async () => {
  const skillLinks=skills.map(directory=>inspectSkillLink(root,directory));if(skillLinks.some(skill=>!skill.linked))throw new Error('Provider skill link is missing. Run setup first.');
  const status=await cli('status');if(status.status!=='running')throw new Error('Selected Surface is stopped; run its start command first.');
  const checkoutCommit=await run(['git','rev-parse','HEAD']);
  if(status.lifecycle.commit!==checkoutCommit)throw new Error('Installed release differs from the linked checkout HEAD. Run ./bin/setup for this selected installation.');
  const doctor=await cli('doctor');
  const origin=status.lifecycle.origin;
  const response=await fetch(origin+'/health');
  const health=await response.json();
  if(!response.ok||health.runtime?.instanceId!==status.lifecycle.instanceId)throw new Error('Installed app health does not match the selected service.');
  const network=await reconcileAccess(access,origin,mode==='test');
  access=network.access;
  if(mode!=='test')saveSelection();
  if(status.lifecycle.browserOrigin!==network.url) {
    if(mode==='test')throw new Error('Running host does not accept the configured Tailscale origin. Run ./bin/setup.');
    step('Applying the private browser hostname');
    await cli('stop');
    await cli('start','--port',new URL(origin).port);
    await verify();return;
  }
  if(network.url) {
    const remoteHost=await fetch(origin+'/health',{headers:{host:new URL(network.url).host,origin:network.url},signal:AbortSignal.timeout(5000)});
    if(!remoteHost.ok)throw new Error('Configured Tailscale hostname was rejected by the installed host.');
  }
  if(ui){ui.note(`Open     ${origin}${network.url?'\nTailscale '+network.url:''}\n\nSkills   ${skillLinks.length} linked to this checkout\nManage   ${launcher} status\n\nReload your agent to discover the skill.`, 'Ready');ui.outro('Surface is running.');}
  else console.log(JSON.stringify({status:'verified',home,launcher,origin,tailscale:network.url,release:status.lifecycle.release,skillLinks,doctor,agentDiscovery:'Restart/reload the provider if needed. Filesystem linking does not prove provider discovery or live conversation delivery.'},null,2));
};

const saveSelection = () => {
  const content=JSON.stringify({version:3,skillsDirectories:skills,access},null,2)+'\n';
  if(!existsSync(configuration)||readFileSync(configuration,'utf8')!==content)writeFileSync(configuration,content,{mode:0o600});
};

const {values,positionals}=parseArgs({args,allowPositionals:true,options:{home:{type:'string'},'skills-dir':{type:'string',multiple:true},provider:{type:'string',multiple:true},port:{type:'string'},tailscale:{type:'string'},ref:{type:'string'},help:{type:'boolean'}}});
const mode=positionals[0];
if(values.help){console.log('./bin/setup | ./bin/test [--provider codex|claude | --skills-dir PATH] [--home PATH] [--port PORT] [--tailscale on|off] [--ref COMMIT]\nSetup shows a Codex / Claude Code menu; saved choices or all detected providers are preselected. Space toggles; Enter confirms. Repeat --provider or --skills-dir for multiple destinations.');return;}
if(!['setup','test'].includes(mode??'')||positionals.length!==1)throw new Error('Specify setup or test.');
const root=resolve(import.meta.dir,'../../../../..'),home=installationHome(values.home);
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
requireCompatibleBun(pkg.packageManager,Bun.version);
if(values.port!==undefined && (!Number.isInteger(Number(values.port)) || Number(values.port)<0 || Number(values.port)>65535))throw new Error('Invalid port.');
const interactive=!!process.stdin.isTTY&&!!process.stdout.isTTY;
const ui=interactive?await loadPrompts(mode!=='test'):undefined;
ui?.intro('Surface · '+mode);
const step=(message:string)=>{if(ui)ui.log.step(message);};
const configuration=join(home,'agent-setup.json');
const saved=existsSync(configuration)?JSON.parse(readFileSync(configuration,'utf8')):undefined;
if(saved && (saved.version!==3 || !Array.isArray(saved.skillsDirectories)))throw new Error('Unsupported setup selection format. Preserve the selection file and choose provider directories explicitly.');
let access=mode==='test' ? saved?.access??{enabled:false} : await selectAccess(saved?.access,values.tailscale,interactive);
const skills=await selectSkills({explicit:values['skills-dir'],provider:values.provider,saved:saved?.skillsDirectories,mode});
if(ui)ui.note(`Install  ${home}\n\n`+skills.map(directory=>`Link     ${join(directory,'surface')}`).join('\n'),'Your setup');
else {console.log(`Surface ${mode}: ${home}`);for(const directory of skills)console.log(`Skill symlink: ${join(directory,'surface')} -> ${join(root,'skills/surface')}`);}
const env: NodeJS.ProcessEnv={...process.env,SURFACE_HOME:home};delete env.SURFACE_STATE_DIR;
for(const directory of skills)inspectSkillLink(root,directory); // Detect conflicts before touching the service.
const launcher=join(home,'bin/surface');
if(mode==='test'){await verify();return;}
if(await run(['git','status','--porcelain']))throw new Error('Commit or preserve checkout changes before setup. Only committed source is installed.');
const commit=await run(['git','rev-parse','--verify',`${values.ref??'HEAD'}^{commit}`]);
// Skills stay linked to this checkout; keep the installed source and instructions aligned.
if(commit!==await run(['git','rev-parse','HEAD']))throw new Error('Check out the selected commit before setup so linked skills match the installed release.');
let wasRunning=false;
let installedCommit:string|undefined;
let portChanged=false;
if(existsSync(launcher)) {
  const status=await cli('status');
  wasRunning=status.status==='running';
  const activePath=join(home,'active.json');
  const active=existsSync(activePath)?JSON.parse(readFileSync(activePath,'utf8')):undefined;
  installedCommit=wasRunning?status.lifecycle.commit:active?.commit;
  const port=existsSync(join(home,'settings.json'))?JSON.parse(readFileSync(join(home,'settings.json'),'utf8')).port:undefined;
  portChanged=values.port!==undefined&&Number(values.port)!==port;
}
if(installedCommit===commit) {
  for(const directory of skills)linkSkill(root,directory);
  if(wasRunning&&portChanged){step('Applying the requested port change');await cli('stop');}
  if(!wasRunning||portChanged){step('Starting the existing installation');await cli('start',...(values.port!==undefined?['--port',values.port]:[]));}
  else step('Reusing the running installation');
  await verify();return;
}
step('Preparing project dependencies');
for(const folder of [''])await run([process.execPath,'install','--frozen-lockfile','--ignore-scripts'],join(root,folder));
step('Checking source and installation contracts');
await run([process.execPath,'run','check']);
await run([process.execPath,'run','check'],join(root,'apps/surface'));
await run([process.execPath,'test','apps/cli/src/installation/bundle.test.ts','apps/cli/src/installation/setup/skill-link.test.ts']);
if(wasRunning){step('Stopping the selected service for update');await cli('stop');}
try {
  step('Building and installing Surface');
  await run([process.execPath,join(root,'apps/cli/src/index.ts'),'install','--repo',root,'--ref',commit,'--home',home]);
  step('Linking agent skills and starting the service');
  for(const directory of skills)linkSkill(root,directory);
  await cli('start',...(values.port?['--port',values.port]:[]));
  await verify();
} catch(error) {
  // Installation activates last. Recover availability of the selected release when possible.
  if(wasRunning&&existsSync(launcher))try{if((await cli('status')).status==='stopped')await cli('start');}catch{}
  throw error;
}

};

if(import.meta.main)agentSetup().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
