import { test, expect } from 'bun:test';
import { mkdtempSync, realpathSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { inventory, verifyBundle } from '../src/installation/bundle.ts';

test('prepared bundles reject changed bytes, extra files and foreign platform before installation',()=>{
  const directory=realpathSync(mkdtempSync('/tmp/surface-bundle-test-'));
  try {
    writeFileSync(join(directory,'app.js'),'original');
    const value={format:1,version:'0.1.0-test.1',commit:'a'.repeat(40),platform:process.platform,arch:String(process.arch),bun:Bun.version,files:inventory(directory)};
    const save=()=>writeFileSync(join(directory,'surface-release.json'),JSON.stringify(value));save();
    expect(verifyBundle(directory).version).toBe(value.version);
    writeFileSync(join(directory,'app.js'),'changed');expect(()=>verifyBundle(directory)).toThrow('integrity');
    writeFileSync(join(directory,'app.js'),'original');writeFileSync(join(directory,'extra'),'unlisted');expect(()=>verifyBundle(directory)).toThrow('integrity');
    rmSync(join(directory,'extra'));value.arch='unsupported';save();expect(()=>verifyBundle(directory)).toThrow('architecture');
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test('inventory allows internal relative links but rejects external links',()=>{
  const directory=realpathSync(mkdtempSync('/tmp/surface-bundle-test-'));
  try {
    writeFileSync(join(directory,'file'),'data');symlinkSync('file',join(directory,'internal'));
    expect(inventory(directory).internal).toBe('link:file');
    symlinkSync('/etc/hosts',join(directory,'external'));expect(()=>inventory(directory)).toThrow('escapes');
  }finally{rmSync(directory,{recursive:true,force:true});}
});
