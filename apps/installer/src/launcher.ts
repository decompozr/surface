import { mkdirSync, readFileSync, copyFileSync, chmodSync, symlinkSync, renameSync, existsSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { Installation } from './manager.ts';
import { installationHome } from './paths.ts';
import { validateRelease } from './compatibility.ts';

export const prepareLauncher = async (home: string, release: string) => {
  const source = join(home,'releases',release), directory = join(home,'tooling',release);
  for (const path of [join(home,'tooling'),join(home,'bin')]) {
    if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new Error('Owned launcher directories must not be symlinks.');
    mkdirSync(path,{recursive:true,mode:0o700});
  }
  mkdirSync(directory,{recursive:true,mode:0o700});
  if (existsSync(join(source,'.distribution/launcher.js'))) {
    for (const name of ['launcher.js','bun','runner.ts']) copyFileSync(join(source,'.distribution',name),join(directory,name));
    chmodSync(join(directory,'bun'),0o700);
    const quote=(value:string)=>"'"+value.replaceAll("'","'\"'\"'")+"'";
    const temporary=join(home,'bin',`.surface-${crypto.randomUUID()}`);
    const script='#!/bin/sh\nexport SURFACE_HOME="${SURFACE_HOME:-'+home.replaceAll('\\','\\\\').replaceAll('\"','\\\"').replaceAll('$','\\$').replaceAll('`','\\`')+'}"\nexec '+quote(join(directory,'bun'))+' '+quote(join(directory,'launcher.js'))+' "$@"\n';
    const {writeFileSync}=await import('node:fs');
    writeFileSync(temporary,script,{mode:0o700});renameSync(temporary,join(home,'bin/surface'));return;
  }
  const result = await Bun.build({ entrypoints:[join(source,'apps/installer/src/launcher.ts')],target:'bun',format:'esm',outdir:directory,banner:'#!/usr/bin/env bun',naming:'launcher.js' });
  if (!result.success) throw new Error('Surface launcher build failed.');
  copyFileSync(join(source,'apps/installer/src/runner.ts'),join(directory,'runner.ts')); chmodSync(join(directory,'launcher.js'),0o700);
  const temporary = join(home,'bin',`.surface-${crypto.randomUUID()}`); symlinkSync(join(directory,'launcher.js'),temporary); renameSync(temporary,join(home,'bin/surface'));
};

export const lifecycleMain = async (args: string[]) => {
  const {values,positionals} = parseArgs({args,allowPositionals:true,options:{home:{type:'string'},repo:{type:'string'},ref:{type:'string'},port:{type:'string'},release:{type:'string'},bundle:{type:'string'}}});
  if (positionals.length !== 1) throw new Error('Expected one lifecycle command.');
  const home=installationHome(values.home), manager=new Installation(home,validateRelease);
  const start = async () => {
    const state=join(home,'state');
    if(existsSync(join(state,'workspace-migration.pending.json')))throw new Error('Migration is incomplete. Use surface workspace migration-rollback with its backup ID.');
    if(existsSync(join(state,'project-bindings.json')))throw new Error('Migrate legacy project bindings first: surface workspace migrate (review), then --apply.');
    return (await manager.start(values.port === undefined ? (existsSync(join(home,'settings.json')) ? undefined : 4319) : Number(values.port))).status;
  };
  switch(positionals[0]) {
    case 'install': case 'upgrade': {
      if(values.bundle) {
        if(values.repo||values.ref)throw new Error('Select --bundle or --repo/--ref, not both.');
        const release=await manager.installPrepared(values.bundle,async(_directory,id)=>prepareLauncher(home,id));
        return {...release,home,launcher:join(home,'bin/surface')};
      }
      if(!values.repo || !values.ref) throw new Error('Use --repo PATH --ref COMMIT to select a pinned release.');
      const release=await manager.install(values.repo,values.ref,'surface',async(_directory,id)=>prepareLauncher(home,id));
      return {...release,home,launcher:join(home,'bin/surface')};
    }
    case 'start': return start();
    case 'status': return manager.health();
    case 'stop': return manager.stop();
    case 'restart': await manager.stop(); return start();
    case 'rollback': if(!values.release) throw new Error('Specify --release ID.'); return manager.activate(values.release);
    case 'recover': return manager.recover();
    case 'uninstall': return manager.uninstall();
    default: throw new Error('Unknown lifecycle command.');
  }
};


export const lifecycleCommands = new Set(['install','upgrade','start','status','stop','restart','rollback','recover','uninstall']);
if(import.meta.main) {
  try {
    const args=process.argv.slice(2);
    // Bootstrap only lifecycle. All other commands run the selected release's actual CLI,
    // preserving its dependency/source paths without embedding the compiler in this bundle.
    const parsed=parseArgs({args,allowPositionals:true,strict:false,options:{home:{type:'string'},runtime:{type:'boolean'}}});
    const command=parsed.positionals[0];
    if(lifecycleCommands.has(command ?? '') && !args.includes('--runtime')) console.log(JSON.stringify(await lifecycleMain(args),null,2));
    else {
      const home=installationHome(parsed.values.home as string|undefined), active=JSON.parse(readFileSync(join(home,'active.json'),'utf8'));
      if(!/^[a-f0-9]{40}-surface$/.test(active.release)) throw new Error('Select an installed Surface workspace release.');
      const releaseRoot=join(home,'releases',active.release);
      const currentCLI=join(releaseRoot,'apps/cli/src/index.ts');
      const previousCLI=join(releaseRoot,'apps/surface/src/cli/index.ts');
      const cli=existsSync(currentCLI)?currentCLI:existsSync(previousCLI)?previousCLI:join(releaseRoot,'src/cli/index.ts');
      const child=Bun.spawn([process.execPath,cli,...args],{stdin:'inherit',stdout:'inherit',stderr:'inherit',env:{...process.env,SURFACE_HOME:home}});
      for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>child.kill(signal));
      process.exitCode=await child.exited;
    }
  } catch(error) {console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
}
