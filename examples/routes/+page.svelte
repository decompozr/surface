<script lang="ts">
 import Guide from '../lib/Guide.svelte';
 const base = window.location.pathname.split('/examples')[0] + '/examples';
</script>
<Guide>
 <p class="eyebrow">Meet Surface</p>
 <h1>Give your project<br />a place to interact.</h1>
 <p class="lead">Surface is a shared runtime for interfaces owned by your project. Mount a graph, a form or an editor, open it in a browser, and turn interaction into structured input for your tools and agents.</p>
 <a class="button" href={base + '/setup'}>Set up your first Surface →</a><a class="button secondary" href={base + '/counter'}>Try the live example</a>
 <div class="grid"><article class="card"><h3>Your project owns the source</h3><p>Pages, schemas and dependencies live beside your project. Surface mounts them where they are.</p></article><article class="card"><h3>One runtime, many workspaces</h3><p>A shared server and compiler serve multiple mounts. Each Git worktree keeps its own stable identity.</p></article><article class="card"><h3>Interaction goes somewhere</h3><p>A bound form sends schema-validated data to its originating agent conversation. The agent can publish a result back.</p></article></div>
 <section class="section"><p class="eyebrow">The loop</p><h2>From project source to a shared decision.</h2><div class="flow"><span>Create a page</span>→<span>Mount the folder</span>→<span>Interact</span>→<span>Return structured data</span></div></section>
 <section class="section"><h2>Independent of the project that uses it.</h2><p class="lead">Surface does not need to understand your domain. Your project defines what an action means; Surface provides the place to render, interact and connect it to the right consumer.</p><p class="note">Today’s implementation supports local Svelte pages, static page routes, live editing and scoped agent interactions. It is a development runtime; complete SvelteKit application hosting and production deployment are not implemented.</p></section>
</Guide>
