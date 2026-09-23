<script lang="ts">
  import {onMount} from 'svelte';
  let {data}=$props();
  let selected=$state(''),draft=$state(''),notice=$state('');
  const key='surface:experiment:demo:main:agent-picker';
  let ready=$state(false);
  onMount(()=>{try{const saved=JSON.parse(sessionStorage.getItem(key)??'{}');selected=saved.selected??'';draft=saved.draft??'';}catch{}ready=true;});
  $effect(()=>{if(ready)try{sessionStorage.setItem(key,JSON.stringify({selected,draft}));}catch{}});
  const recipient=$derived([...data.agents.worktree,...data.agents.project].find(a=>a.id===selected));
</script>
<svelte:head><title>Surface · Recipient experiment</title></svelte:head>
<main>
  <p class="eyebrow">Surface / Interaction experiment</p>
  <h1>Who receives this?</h1>
  <p>{data.scenario==='live-readonly'?'Real conversation directory · read-only.':'Simulated conversations.'} No message is sent, and no real binding is created.</p>
  {#if data.scenario!=='live-readonly'}<nav aria-label="Failure scenarios"><a href="?scenario=normal">Connected</a><a href="?scenario=offline">Provider offline</a><a href="?scenario=deleted">Selected agent deleted</a></nav>{:else}<a href="?refresh=1" data-sveltekit-reload>Refresh conversations</a>{/if}
  <section>
    <h2>Reply to</h2>
    {#if !data.agents.available}<p role="status">Cannot check conversations. Your draft is retained. Reconnect before continuing.</p>{/if}
    <label for="recipient">Agent conversation</label>
    <select id="recipient" bind:value={selected} disabled={!data.agents.available}>
      <option value="">Choose a conversation</option>
      {#if selected&&!recipient}<option value={selected}>Previously selected conversation — unavailable</option>{/if}
      <optgroup label="This worktree · main">{#each data.agents.worktree as agent}<option value={agent.id}>{agent.title} · {agent.status}</option>{/each}</optgroup>
      <optgroup label="Other worktrees in this project">{#each data.agents.project as agent}<option value={agent.id}>{agent.title} · {agent.workspaceId} · {agent.status}</option>{/each}</optgroup>
    </select>
    <p class="recipient">{recipient?`${recipient.provider} → ${recipient.title} (${recipient.workspaceId})`:selected?'The previous selection is unavailable. Choose a recipient explicitly.':'No recipient selected.'}</p>
    <label for="draft">Your draft</label><textarea id="draft" bind:value={draft} placeholder="Compare these two approaches…"></textarea>
    <button disabled={!recipient||!data.agents.available} onclick={()=>notice=`Local simulation only: ${recipient?.title} would receive this draft. No request was created.`}>Preview recipient</button>
    <p role="status">{notice}</p>
  </section>
  <aside>Open this URL in another tab to choose independently. Reload preserves each tab’s draft. Duplicating a tab may copy its initial selection; it does not create a new request.</aside>
</main>
<style>
:global(body){margin:0;background:#faf9f7;color:#303849;font-family:system-ui,sans-serif}main{max-width:760px;margin:60px auto;padding:24px}h1{font-size:44px;letter-spacing:-.04em;margin:14px 0}.eyebrow{color:#69758e;text-transform:uppercase;font-size:12px;letter-spacing:.14em}p,aside{line-height:1.65}nav{display:flex;gap:20px;flex-wrap:wrap;margin:28px 0}a{color:#526a95}section{background:white;border:1px solid #dddfe5;border-radius:18px;padding:28px;box-shadow:0 12px 35px #33445508}label{display:block;margin:20px 0 8px}select,textarea{box-sizing:border-box;width:100%;padding:13px;border:1px solid #bbc3d1;border-radius:8px;background:white;color:inherit;font:inherit}textarea{min-height:130px}button{margin-top:20px;padding:12px 20px;border:0;border-radius:8px;background:#576c91;color:white;font:inherit}button:disabled{opacity:.4}.recipient{background:#eeeaf3;padding:12px;border-radius:8px}aside{margin-top:24px;color:#6a6e78}
</style>
