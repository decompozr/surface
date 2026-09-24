import { test, expect } from 'bun:test';
import { requireCompatibleBun } from '@decompozr/surface-installer/bun-version';
test('source releases allow compatible patch runtimes including cached releases',()=>{
 for(const runtime of ['1.4.0','1.4.2','1.4.20'])expect(()=>requireCompatibleBun('bun@1.4.0',runtime,'1.4.0')).not.toThrow();
 expect(()=>requireCompatibleBun('bun@1.4.0','1.4.0','1.4.2')).not.toThrow();
});
test('different minor/major, prerelease, malformed and below baseline runtimes fail',()=>{
 for(const runtime of ['1.3.9','1.5.0','2.4.0','1.4.2-canary','garbage'])expect(()=>requireCompatibleBun('bun@1.4.0',runtime)).toThrow();
 expect(()=>requireCompatibleBun('bun@1.4.2','1.4.1')).toThrow();
 expect(()=>requireCompatibleBun('bun@1.4.0','1.4.2','1.3.9')).toThrow();
 expect(()=>requireCompatibleBun(undefined,'1.4.2')).toThrow();
});
