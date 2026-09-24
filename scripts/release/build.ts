import { mkdtempSync, mkdirSync, realpathSync, copyFileSync, chmodSync, writeFileSync, cpSync, rmSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { Installation } from '../../apps/surface/src/installation/manager.ts';
import { validateRelease } from '../../apps/surface/src/installation/compatibility.ts';
import { inventory } from '../../apps/surface/src/installation/bundle.ts';
const {values}=parseArgs({options:{version:{type:'string'},ref:{type:'string'},out:{type:'string'},'design-system-package':{type:'string'}}});
const version=values.version;
if(!version||!/^\d+\.\d+\.\d+-[a-z0-9.-]+$/.test(version))throw new Error('Specify an experimental --version, e.g. 0.1.0-experiment.1');
if(process.platform!=='darwin'||process.arch!=='arm64')throw new Error('This first release experiment only supports native macOS arm64 builds.');
const root=resolve(import.meta.dir,'../..'),out=resolve(values.out??join(root,'dist'));
const temp=realpathSync(mkdtempSync('/tmp/surface-build-'));
async function command(args:string[],cwd?:string) {
  const child=Bun.spawn(args,{cwd,stdout:'pipe',stderr:'pipe'});
  const [code,stdout,stderr]=await Promise.all([child.exited,new Response(child.stdout).text(),new Response(child.stderr).text()]);
  if(code)throw new Error(stderr+stdout);return stdout.trim();
}
try {
  const manifest=await new Installation(join(temp,'prepare'),validateRelease, {
    designSystemPackage: values['design-system-package'] && resolve(values['design-system-package']),
  }).install(root,values.ref??'HEAD','surface');
  const name=`surface-${version}-${process.platform}-${process.arch}`,folder=join(temp,name);
  cpSync(join(temp,'prepare/releases',manifest.release),folder,{recursive:true,verbatimSymlinks:true});
  const assets=join(folder,'.distribution');mkdirSync(assets);
  copyFileSync(process.execPath,join(assets,'bun'));chmodSync(join(assets,'bun'),0o755);
  copyFileSync(join(folder,'apps/surface/src/installation/runner.ts'),join(assets,'runner.ts'));
  const result=await Bun.build({entrypoints:[join(folder,'apps/surface/src/installation/launcher.ts')],target:'bun',format:'esm',outdir:assets,naming:'launcher.js'});
  if(!result.success)throw new Error(String(result.logs));
  writeFileSync(join(folder,'install'),`#!/bin/sh\nset -eu\nrelease_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\nexec "$release_dir/.distribution/bun" "$release_dir/.distribution/launcher.js" install --bundle "$release_dir" "$@"\n`,{mode:0o755});
  writeFileSync(join(folder,'surface-release.json'),JSON.stringify({format:1,version,commit:manifest.commit,platform:process.platform,arch:process.arch,bun:Bun.version,files:inventory(folder)},null,2)+'\n');
  mkdirSync(out,{recursive:true});
  const archive=join(out,name+'.tar.gz');
  if(await Bun.file(archive).exists())throw new Error('Refusing to overwrite an existing versioned archive.');
  await command(['tar','-czf',archive,'-C',temp,name]);
  const checksum=createHash('sha256').update(readFileSync(archive)).digest('hex');
  writeFileSync(archive+'.sha256',checksum+'  '+name+'.tar.gz\n');
  console.log(JSON.stringify({archive,checksum,version,commit:manifest.commit,platform:process.platform,arch:process.arch}));
} finally {rmSync(temp,{recursive:true,force:true});}
