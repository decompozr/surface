import { test, expect } from 'bun:test';
import { mkdtempSync, realpathSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { backendRuntime } from './backends.ts';


const fixture = async (failClose = false) => {
  const root = realpathSync(mkdtempSync('/tmp/surface-multi-unit-')), source = join(root, 'ui'); mkdirSync(source);
  const path = join(root, 'backend.ts');
  writeFileSync(path, `export const apiVersion=1; export const counts={created:0,closed:0,attempts:0};
    export const createProjectBackend = () => {counts.created++;return {invoke(){return {ok:true,data:null}},async close(){counts.attempts++;await Bun.sleep(10);if(${failClose}&&counts.attempts===1)throw new Error('injected close failure');counts.closed++;}}}`);
  writeFileSync(join(root, 'surface.backend.json'), JSON.stringify({ version:1,api:1,entry:'backend.ts',operations:['read'] }));
  const identity = { projectId:'project-id',workspaceId:'workspace-id',dataDirectory:join(root,'external-fixture-data') };
  const runtime = backendRuntime(root, async () => { await Bun.sleep(1); return identity; });
  const mount = { projectRoot:root, source, namespace:'project', name:'editor' };
  const {counts} = await import(path);
  return { root, path, runtime, mount, counts, identity, clean:()=>rmSync(root,{recursive:true,force:true}) };
};

test('concurrent mounts share one factory; independent and repeated closes release only the last member', async () => {
  const f=await fixture();
  try {
    const [editor,compare]=await Promise.all([f.runtime.openMountResource(f.mount),f.runtime.openMountResource({...f.mount,name:'compare'})]);
    expect(f.counts.created).toBe(1);
    await expect(f.runtime.openMountResource(f.mount)).rejects.toThrow('scope');
    await editor.close(); await editor.close(); expect(f.counts.closed).toBe(0);
    const remounted=await f.runtime.openMountResource(f.mount); expect(f.counts.created).toBe(1);
    await Promise.all([compare.close(),remounted.close(),remounted.close()]); expect(f.counts.closed).toBe(1);
    const next=await f.runtime.openMountResource(f.mount);expect(f.counts.created).toBe(2);
    await editor.close();expect(f.counts.closed).toBe(1);await next.close();expect(f.counts.closed).toBe(2);
  } finally {f.clean();}
});
test('last-close failure retains ownership, denies joins and duplicate scope, and permits explicit retry',async()=>{
  const f=await fixture(true);
  try {
    const handle=await f.runtime.openMountResource(f.mount);
    await expect(handle.close()).rejects.toThrow('injected');
    await expect(f.runtime.openMountResource({...f.mount,name:'compare'})).rejects.toThrow('closing');
    await expect(f.runtime.openMountResource(f.mount)).rejects.toThrow('scope');
    expect(f.counts.created).toBe(1);expect(f.counts.closed).toBe(0);
    await handle.close();expect(f.counts.closed).toBe(1);
    const next=await f.runtime.openMountResource(f.mount);await handle.close();expect(f.counts.closed).toBe(1);
    await next.close();expect(f.counts.closed).toBe(2);
  }finally{f.clean();}
});
test('changed backend code or storage context cannot join an active owner',async()=>{
  const f=await fixture();
  try {
    const handle=await f.runtime.openMountResource(f.mount);
    const original=readFileSync(f.path,'utf8');writeFileSync(f.path,original+'\n// changed');
    await expect(f.runtime.openMountResource({...f.mount,name:'compare'})).rejects.toThrow('changed');
    writeFileSync(f.path,original);
    f.identity.dataDirectory+='/changed';
    await expect(f.runtime.openMountResource({...f.mount,name:'compare'})).rejects.toThrow('changed');
    await handle.close();
    writeFileSync(f.path,original+'\n// changed after last unmount');
    await expect(f.runtime.openMountResource(f.mount)).rejects.toThrow('restart');
  }finally{f.clean();}
});
