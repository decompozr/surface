import { test, expect } from 'bun:test';
import { Replica, type Cursor, type Snapshot } from './fixtures/sync.ts';
const cursor=(sequence:number,epoch='a'):Cursor=>({epoch,sequence});
const snapshot=(sequence:number,epoch='a'):Snapshot<number>=>({data:sequence,cursor:cursor(sequence,epoch)});
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve};}
function fixture(read:(signal:AbortSignal)=>Promise<Snapshot<number>>){
  const applied:number[]=[],errors:string[]=[];let dirty=false,stale=0;
  const replica=new Replica({read,dirty:()=>dirty,apply:value=>applied.push(value),stale:()=>stale++,error:message=>errors.push(message)});
  return{replica,applied,errors,setDirty:(value:boolean)=>dirty=value,stale:()=>stale};
}
test('subscriptions do not read; an explicit first load opts into updates and duplicates do not reread',async()=>{
  let reads=0,current=2;const f=fixture(async()=>{reads++;return snapshot(current);});
  f.replica.connected(cursor(0));f.replica.notify(cursor(2));expect(reads).toBe(0);
  await f.replica.load();expect(f.applied).toEqual([2]);expect(reads).toBe(1);
  f.replica.notify(cursor(2));f.replica.notify(cursor(1));await f.replica.settled();expect(reads).toBe(1);
  current=3;f.replica.notify(cursor(3));await f.replica.settled();expect(f.applied).toEqual([2,3]);f.replica.stop();
});
test('delayed snapshots are discarded and multiple notifications coalesce into one fresh read',async()=>{
  const first=deferred<Snapshot<number>>();let reads=0;
  const f=fixture(async()=>++reads===1?first.promise:snapshot(4));f.replica.connected(cursor(1));
  const loading=f.replica.load();f.replica.notify(cursor(2));f.replica.notify(cursor(4));f.replica.notify(cursor(3));
  first.resolve(snapshot(1));await loading;expect(reads).toBe(2);expect(f.applied).toEqual([4]);f.replica.stop();
});
test('draft edits during a read and later invalidations never overwrite the draft',async()=>{
  const first=deferred<Snapshot<number>>();let reads=0;const f=fixture(async()=>++reads===1?first.promise:snapshot(2));
  f.replica.connected(cursor(1));const loading=f.replica.load();f.setDirty(true);first.resolve(snapshot(1));await loading;
  expect(f.applied).toEqual([]);expect(f.stale()).toBe(1);
  f.replica.notify(cursor(2));await f.replica.settled();expect(reads).toBe(1);expect(f.stale()).toBe(2);
  f.setDirty(false);await f.replica.load();expect(f.applied).toEqual([2]);f.replica.stop();
});
test('reconnection refreshes without replay and ignores old-generation notifications',async()=>{
  let next=snapshot(7),reads=0;const f=fixture(async()=>{reads++;return next;});
  f.replica.connected(cursor(7));await f.replica.load();f.replica.connected(cursor(7));await f.replica.settled();expect(reads).toBe(2);
  next=snapshot(0,'new');f.replica.connected(cursor(0,'new'));await f.replica.settled();
  f.replica.notify(cursor(99,'a'));await f.replica.settled();expect(reads).toBe(3);expect(f.applied).toEqual([7,7,0]);f.replica.stop();
});
test('closed replicas abort reads and reject late responses or notifications',async()=>{
  const pending=deferred<Snapshot<number>>();let signal:AbortSignal|undefined;const f=fixture(async value=>{signal=value;return pending.promise;});
  f.replica.connected(cursor(1));const loading=f.replica.load();f.replica.stop();expect(signal?.aborted).toBe(true);
  pending.resolve(snapshot(1));await loading;f.replica.notify(cursor(2));expect(f.applied).toEqual([]);expect(f.errors).toEqual([]);
});
test('failed reads do not loop and recover on an explicit reconnect',async()=>{
  let reads=0;const f=fixture(async()=>{if(++reads===1)throw new Error('offline');return snapshot(3);});
  f.replica.connected(cursor(1));await f.replica.load();expect(reads).toBe(1);expect(f.errors).toHaveLength(1);
  f.replica.connected(cursor(3));await f.replica.settled();expect(reads).toBe(2);expect(f.applied).toEqual([3]);f.replica.stop();
});
test('notification arriving while a completed read releases its single-flight slot is not lost',async()=>{
  const applied:number[]=[];let reads=0;
  const replica=new Replica<number>({read:async()=>snapshot(++reads),dirty:()=>false,error:message=>{throw new Error(message);},stale(){},apply(value){applied.push(value);if(value===1)queueMicrotask(()=>replica.notify(cursor(2)));}});
  replica.connected(cursor(1));await replica.load();await replica.settled();expect(applied).toEqual([1,2]);replica.stop();
});
