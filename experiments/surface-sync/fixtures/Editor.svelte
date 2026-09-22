<script lang="ts">
  import { onMount } from 'svelte';
  import { Replica, watch } from './sync';
  type Row = { id: string; title: string; angle: number; revision: number };
  let title=$state('Near view'),angle=$state(35),revision=$state(0),dirty=$state(false),edits=0;
  let status=$state('Unsaved draft'),connection=$state('Connecting…'),pending=$state(false);
  const scope=location.pathname.split('/').filter(Boolean).slice(1,3).join('/');
  const token=new URLSearchParams(location.hash.slice(1)).get('db')??'',base=`/project-db/${scope}`;
  async function action(operation:string,input:unknown,signal?:AbortSignal){
    const response=await fetch(base+'/actions',{method:'POST',signal,headers:{'content-type':'application/json','x-project-capability':token},body:JSON.stringify({operation,input})});
    const result=await response.json();if(!result.ok)throw new Error(result.code);return result;
  }
  const replica=new Replica<Row[]>({read:signal=>action('listScenarios',{},signal),dirty:()=>dirty,
    apply(rows){const row=rows.find(row=>row.id==='near');if(row){title=row.title;angle=row.angle;revision=row.revision;}else{title='Near view';angle=35;revision=0;}status=`Loaded revision ${revision}`;},
    stale(){status='Saved data changed. Your draft is preserved.';},error(message){status=message;},
  });
  function edit(){dirty=true;edits++;status='Unsaved changes';}
  async function save(){
    pending=true;const submitted=edits;
    try{const result=await action('saveScenario',{id:'near',title,angle,expectedRevision:revision});revision=result.data.revision;if(edits===submitted)dirty=false;status=`Saved revision ${revision}`;await replica.load();}
    catch(error){status=String(error);}
    finally{pending=false;}
  }
  function reload(){dirty=false;edits++;void replica.load();}
  onMount(()=>{const stream=watch(base+'/events',token,replica,text=>connection=text);return()=>{stream.stop();replica.stop();};});
</script>
<main>
  <p class="eyebrow">SURFACE EXPERIMENT · LIVE EDITOR</p><h1>Plan a scenario</h1>
  <p>Saved changes update clean views. Your draft stays yours until you save or discard it.</p>
  <section>
    <label>Scenario name <input bind:value={title} oninput={edit} /></label>
    <label>Camera angle <input type="number" min="0" max="90" bind:value={angle} oninput={edit} /></label>
    <button onclick={save} disabled={pending}>Save scenario</button>
    <button class="secondary" onclick={reload} disabled={pending}>{dirty?'Discard draft and reload':'Load saved scenario'}</button>
  </section>
  <p role="status">{status}</p><p aria-label="Connection status">{connection}</p>
</main>
<style>
  :global(body){margin:0;background:#f3f5f2;color:#213c33;font-family:system-ui,sans-serif}main{max-width:680px;margin:40px auto;padding:24px}.eyebrow{font-size:12px;letter-spacing:.1em}h1{font-size:36px}section{background:white;border:1px solid #dce3dc;border-radius:12px;padding:24px;margin-top:24px}label{display:block;margin-bottom:18px}input{display:block;width:100%;box-sizing:border-box;margin-top:7px;padding:10px;font:inherit;border:1px solid #aabbb1;border-radius:6px}button{background:#245b44;color:white;border:0;border-radius:6px;padding:12px 18px;font:inherit;margin:0 8px 8px 0}.secondary{background:#e8f0eb;color:#245b44}button:disabled{opacity:.6}[role=status]{min-height:24px}
</style>
