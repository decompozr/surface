import {test,expect} from 'bun:test';
import {planAccess,reconcileAccess,selectAccess,type TSRun} from './tailscale.ts';
const host='fixture.example.ts.net',target='http://127.0.0.1:4319';
test('new installation avoids all occupied ports, including Funnel',()=>{
 const config={TCP:{8463:{HTTPS:true}},AllowFunnel:{[host+':8463']:true}};
 expect(planAccess(config,{enabled:true},host,target).port).toBe(8464);
});
test('owned mapping repeats without mutation; refresh updates only its target',async()=>{
 let config:any={TCP:{8463:{HTTPS:true}},Web:{[host+':8463']:{Handlers:{'/':{Proxy:target}}}}};
 const mutations:string[][]=[];
 const run:TSRun=async args=>{
  if(args[0]==='status')return JSON.stringify({BackendState:'Running',Self:{DNSName:host+'.'}});
  if(args[1]==='status')return JSON.stringify(config);
  mutations.push(args);config.Web[host+':8463'].Handlers['/'].Proxy=args.at(-1);return '';
 };
 const access={enabled:true,port:8463,host,target};
 expect((await reconcileAccess(access,target,false,run)).url).toBe('https://'+host+':8463');
 expect(mutations).toHaveLength(0);
 await reconcileAccess(access,'http://127.0.0.1:4320',false,run);
 expect(mutations).toEqual([['serve','--bg','--https=8463','http://127.0.0.1:4320']]);
});
test('foreign handlers and public Funnel are preserved',()=>{
 const access={enabled:true,port:8463,host,target};
 const config={TCP:{8463:{}},Web:{[host+':8463']:{Handlers:{'/':{Proxy:target},'/other':{Proxy:target}}}}};
 expect(()=>planAccess(config,access,host,target)).toThrow('left unchanged');
 expect(()=>planAccess({AllowFunnel:{[host+':8463']:true}},access,host,target)).toThrow('left unchanged');
});
test('read-only verification never repairs missing mappings',async()=>{
 const calls:string[][]=[];
 const run:TSRun=async args=>{calls.push(args);return args[0]==='status'?JSON.stringify({BackendState:'Running',Self:{DNSName:host}}):'{}';};
 await expect(reconcileAccess({enabled:true,port:8463,host,target},target,true,run)).rejects.toThrow('missing or outdated');
 expect(calls).toHaveLength(2);
});
test('headless default is local and saved choices persist',async()=>{
 expect(await selectAccess(undefined,undefined,false)).toEqual({enabled:false});
 expect(await selectAccess({enabled:true,port:8464},undefined,false)).toEqual({enabled:true,port:8464});
 expect(await selectAccess(undefined,'on',false)).toEqual({enabled:true});
});
test('turning off removes only recorded owned endpoint',async()=>{
 const calls:string[][]=[];
 const run:TSRun=async args=>{calls.push(args);if(args[0]==='status')return JSON.stringify({BackendState:'Running',Self:{DNSName:host}});if(args[1]==='status')return JSON.stringify({TCP:{8463:{}},Web:{[host+':8463']:{Handlers:{'/':{Proxy:target}}}}});return '';};
 expect((await reconcileAccess({enabled:false,port:8463,host,target},target,false,run)).access).toEqual({enabled:false});
 expect(calls.at(-1)).toEqual(['serve','--https=8463','off']);
});
