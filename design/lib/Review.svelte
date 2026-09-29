<script lang="ts">
 import type {Snippet} from 'svelte';
 let {title,description,children}:{title:string;description:string;children:Snippet}=$props();
 const base=location.pathname.split('/design')[0]+'/design';
</script>
<div class="review"><nav aria-label="Design pages"><a href={base+'/'}>Design</a><a href={base+'/workbench'}>Workbench</a><a href={base+'/controls'}>Controls</a><a href={base+'/tabs'}>Tabs</a><a href={base+'/navigation'}>Navigation</a></nav><h1>{title}</h1><p>{description}</p>{@render children()}</div>
<style>
.review{font:400 14px/1.5 system-ui,sans-serif;color:#202522;background:#fff;min-height:100%;box-sizing:border-box;padding:20px;max-width:1000px}nav{display:flex;gap:16px;border-bottom:1px solid #ddd;padding-bottom:12px;flex-wrap:wrap}a{color:inherit}h1{font-size:18px;font-weight:600;margin:20px 0 4px}p{margin:0 0 20px;color:#59615c}.review :global(section){border-top:1px solid #ddd;padding:16px 0}.review :global(h2){font-size:14px;font-weight:600;margin:0 0 12px}.review :global(.row){display:flex;align-items:center;gap:12px;flex-wrap:wrap}.review :global(.note){margin-top:12px;color:#59615c}
</style>
