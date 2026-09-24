<script lang="ts">
 import Guide from '../../lib/Guide.svelte';
 const base = window.location.pathname.split('/examples')[0] + '/examples';
 const prepare = `# From the Surface repository root. Follow SETUP.md to prepare dependencies.
# Requires Git and Bun >=1.4.0 <1.5.0.
bun run surface serve --state-dir "$HOME/.surface-development/state"`;
 const structure = `my-project/
├── artifact.project.json     # Created by project init
└── panels/
    ├── package.json
    ├── artifact.json
    └── routes/
        └── hello/
            └── +page.svelte`;
 const pkg = `{"name":"my-panels","private":true,"type":"module","dependencies":{"svelte":"5.57.1"}}`;
 const manifest = `{"framework":"svelte","components":"routes","routes":"routes"}`;
 const page = `<h1>Hello from my project</h1>\n<p>This page is mounted by Surface.</p>`;
 const mount = `# Run from your Git project's root. Replace /path/to/surface.
export SURFACE_STATE_DIR="$HOME/.surface-development/state"
bun /path/to/surface/apps/cli/src/index.ts project init --name "My project"
bun /path/to/surface/apps/cli/src/index.ts project register
bun /path/to/surface/apps/cli/src/index.ts project add --source panels --name "Panels"
bun /path/to/surface/apps/cli/src/index.ts project list
bun /path/to/surface/apps/cli/src/index.ts project mount --artifact ARTIFACT_UUID`;
 const cleanup = `bun /path/to/surface/apps/cli/src/index.ts project unmount --artifact ARTIFACT_UUID`;
</script>
<Guide section="Setup & use">
 <p class="eyebrow">A practical walkthrough</p><h1>Your source.<br />Your first Surface.</h1><p class="lead">Start a development host, register your Git project, then mount a folder of pages. Keep the same state directory throughout the workflow.</p>
 <section class="step"><span class="number">01</span><div><h2>Start the host</h2><p>If you are reading this page, a Surface host is already serving it. To run your own development instance from a Surface checkout:</p><pre><code>{prepare}</code></pre><p>The host uses port 4319 and prints its URL. Add <code>--port 4320</code> if that port is occupied. It automatically registers its own checkout and mounts these examples. Use one state directory per running host.</p></div></section>
 <section class="step"><span class="number">02</span><div><h2>Create a page in your project</h2><p>Use an existing Git project. Create this source folder and the three files below:</p><pre><code>{structure}</code></pre><h3>panels/package.json</h3><pre><code>{pkg}</code></pre><h3>panels/artifact.json</h3><pre><code>{manifest}</code></pre><h3>panels/routes/hello/+page.svelte</h3><pre><code>{page}</code></pre><p>Mounting installs the pinned dependencies and creates a Bun lockfile if needed. Keep that lockfile with your source.</p></div></section>
 <section class="step"><span class="number">03</span><div><h2>Register the project and mount the folder</h2><pre><code>{mount}</code></pre><p>Run <code>init</code> only when the project manifest is absent. Replace <code>ARTIFACT_UUID</code> with the ID returned by <code>add</code> or <code>list</code>. Open the returned preview URL and choose <strong>hello</strong>.</p><p class="note">The route is <code>/workspace/my-project/main/panels/hello</code>. A linked worktree uses its folder name instead of <code>main</code>. UUIDs stay internal; the readable route remains stable across branch switches.</p></div></section>
 <section class="step"><span class="number">04</span><div><h2>Edit, interact and see the update</h2><p>Save a change to your page and the shared Vite compiler updates the browser. State you explicitly store with <code>previewState</code> can survive component replacement.</p><a class="button secondary" href={base + '/counter'}>Try the counter and draft →</a><p style="margin-top:20px">The counter is a local interaction. Sending input to an agent additionally requires an exact conversation binding, a request schema and its private preview URL. Merely opening a page does not bind a conversation or send a message.</p></div></section>
 <section class="step"><span class="number">05</span><div><h2>Unmount when you are done</h2><pre><code>{cleanup}</code></pre><p>Use the same state directory and artifact ID. Unmounting removes access to the page; your source and interaction records remain. Registration and mounting do not create a project SQLite database.</p></div></section>
 <section class="section"><h2>Opening it on another device</h2><p>A loopback URL works only on the host computer. For a configured private Tailscale HTTPS endpoint, connect the other device to the same tailnet and use the returned HTTPS URL. For a new host, configure Tailscale Serve and the host’s explicit <code>--browser-origin</code>; follow <code>SETUP.md</code> and the Surface skill’s page guide.</p><p class="note">Supported page routes are static <code>+page.svelte</code> files. Layouts, dynamic route parameters, server load functions and form actions are not part of this mounted-page runtime yet.</p></section>
</Guide>
