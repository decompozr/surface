import { existsSync } from 'node:fs';
import { loadPrompts } from './prompts.ts';

export const tailscaleCLI = () => { return Bun.which('tailscale') ?? (existsSync('/Applications/Tailscale.app/Contents/MacOS/Tailscale')?'/Applications/Tailscale.app/Contents/MacOS/Tailscale':undefined); };

export const tsRun = async (args:string[]) => {
  const executable=tailscaleCLI();if(!executable)throw new Error('Install Tailscale from https://tailscale.com/download, connect, then rerun setup.');
  const p=Bun.spawn([executable,...args],{stdout:'pipe',stderr:'pipe'});
  const timer=setTimeout(()=>p.kill(),30_000);
  let result:[number,string,string];
  try { result=await Promise.all([p.exited,new Response(p.stdout).text(),new Response(p.stderr).text()]); } finally { clearTimeout(timer); }
  const [code,out,err]=result;
  if(code)throw new Error(`Tailscale: ${err || out}`);return out;
};

export const connectedHost = async (run:TSRun=tsRun) => {
  const status=JSON.parse(await run(['status','--json']));
  if(status.BackendState!=='Running'||!status.Self?.DNSName)throw new Error('Open Tailscale, sign in and connect, then rerun setup.');
  return String(status.Self.DNSName).replace(/\.$/,'');
};

export const selectAccess = async (saved:Access|undefined, explicit:string|undefined, interactive:boolean):Promise<Access> => {
  if(explicit && !['on','off'].includes(explicit))throw new Error('Use --tailscale on|off.');
  if(explicit)return {...saved,enabled:explicit==='on'};
  if(saved)return saved;
  if(!interactive)return {enabled:false};
  const ui=await loadPrompts();let ready=false;
  try { await connectedHost();ready=true; } catch {}
  const choice=await ui.select({message:'Access Surface',initialValue:ready?'on':'off',options:[
    {value:'on',label:'This device + Tailscale',hint:ready?'● connected · private HTTPS':'Connect Tailscale first'},
    {value:'off',label:'This device only',hint:'Localhost'},
    {value:'help',label:'Set up Tailscale',hint:'Installation / sign-in instructions'},
  ]});
  if(ui.isCancel(choice))throw new Error('Setup cancelled.');
  if(choice==='help') {
    ui.note('Install: https://tailscale.com/download\nOpen Tailscale, sign in and connect. Then rerun setup.\nSurface can continue locally now.','Tailscale setup');
    return {enabled:false};
  }
  if(choice==='on')await connectedHost();
  return {enabled:choice==='on'};
};

export const planAccess = (config:Config, access:Access, host:string, target:string) => {
  let port=access.port;
  if(port===undefined){port=8463;while(config.TCP?.[port]||Object.keys(config.Web??{}).some(k=>k.endsWith(':'+port)))port++;if(port>65535)throw new Error('No available Tailscale HTTPS port.');}
  const key=`${host}:${port}`, handlers=config.Web?.[key]?.Handlers;
  const occupied=!!config.TCP?.[port]||Object.keys(config.Web??{}).some(k=>k.endsWith(':'+port));
  const owned=access.host===host && access.target && handlers && Object.keys(handlers).length===1 && handlers['/']?.Proxy===access.target;
  if(config.AllowFunnel?.[key] || occupied&&!owned)throw new Error(`Tailscale port ${port} belongs to another configuration; it was left unchanged.`);
  return {port,key,needsChange:!occupied || handlers?.['/']?.Proxy!==target};
};

export const reconcileAccess = async (access:Access,target:string,readOnly=false,run:TSRun=tsRun):Promise<{access:Access;url?:string}> => {
  if(!access.enabled&&!access.target)return {access};
  const host=await connectedHost(run),config:Config=JSON.parse(await run(['serve','status','--json']));
  const plan=planAccess(config,access,host,target);
  if(!access.enabled) {
    if(readOnly)throw new Error('Tailscale configuration requires setup.');
    if(config.TCP?.[plan.port])await run(['serve',`--https=${plan.port}`,'off']);
    return {access:{enabled:false}};
  }
  if(plan.needsChange) {
    if(readOnly)throw new Error('Tailscale mapping is missing or outdated. Run setup.');
    await run(['serve','--bg',`--https=${plan.port}`,target]);
  }
  const result:Access={enabled:true,port:plan.port,host,target};
  const after:Config=JSON.parse(await run(['serve','status','--json']));
  if(after.AllowFunnel?.[plan.key]||after.Web?.[plan.key]?.Handlers?.['/']?.Proxy!==target)throw new Error('Tailscale private mapping verification failed.');
  return {access:result,url:`https://${plan.key}`};
};

export type Access = { enabled:boolean; port?:number; host?:string; target?:string };
type Config = { TCP?:Record<string,unknown>; Web?:Record<string,{Handlers?:Record<string,{Proxy?:string}>}>; AllowFunnel?:Record<string,boolean> };
export type TSRun = (args:string[])=>Promise<string>;
