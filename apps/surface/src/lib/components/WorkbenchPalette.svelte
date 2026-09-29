<script lang="ts">
 import {tick} from 'svelte';
 import {SurfaceCard,TextField,Button,Text} from '@decompozr/design-system';
 let {title,items,close,choose}:{title:string;items:{id:string;label:string;detail?:string}[];close:()=>void;choose:(id:string)=>void}=$props();
 let query=$state(''),index=$state(0);let input=$state<HTMLInputElement>();
 const matches=$derived(items.filter(x=>(x.label+' '+(x.detail??'')).toLowerCase().includes(query.toLowerCase())).slice(0,100));
 $effect(()=>{query;index=0;});$effect(()=>{void tick().then(()=>input?.focus());});
</script>
<div class="backdrop" role="presentation" onclick={e=>{if(e.target===e.currentTarget)close();}}>
 <div class="dialog" role="dialog" aria-modal="true" aria-label={title} onkeydown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();index=(index+(e.key==='ArrowDown'?1:-1)+matches.length)%Math.max(1,matches.length);}if(e.key==='Enter'&&matches[index]){e.preventDefault();choose(matches[index].id);}if(e.key==='Tab'){e.preventDefault();const closeButton=e.currentTarget.querySelector<HTMLButtonElement>('.close');if(document.activeElement===input)closeButton?.focus();else input?.focus();}}} tabindex="-1">
 <SurfaceCard padding="8px"><div class="close-row"><Button size="compact" class="close" aria-label="Close dialog" onclick={close}>Close</Button></div>
 <TextField size="compact" bind:element={input} bind:value={query} label={title} labelHidden placeholder={title} role="combobox" aria-expanded="true" aria-controls="workbench-results" aria-activedescendant={matches[index]?'result-'+index:undefined}/>
 <div id="workbench-results" role="listbox" aria-label="Results">{#each matches as item,i}<Button size="compact" appearance={index===i?'default':'quiet'} style="width:100%;justify-content:flex-start" id={'result-'+i} role="option" aria-selected={index===i} tabindex={-1} onclick={()=>choose(item.id)}><span class="result-content"><span class="result-label">{item.label}</span><span class="result-detail"><Text size="small" tone="muted">{item.detail??''}</Text></span></span></Button>{/each}{#if !matches.length}<p>No matching results</p>{/if}</div></SurfaceCard>
 </div>
</div>
<style>
.backdrop{position:fixed;inset:0;z-index:1000;display:flex;justify-content:center;align-items:flex-start;padding:60px 12px;box-sizing:border-box}.dialog{width:600px;max-width:100%}.result-content{display:flex;gap:.5rem;align-items:center;min-width:0;max-width:100%}.result-label{flex-shrink:0}.result-detail{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.close-row{display:flex;justify-content:flex-end;margin-bottom:6px}#workbench-results{max-height:55vh;overflow:auto;margin-top:6px;display:flex;flex-direction:column;gap:2px}
</style>
