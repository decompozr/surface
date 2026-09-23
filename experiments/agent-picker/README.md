# Agent recipient picker experiment

Status: fixture-backed UI experiment, not production agent discovery or binding.

The app's `/experiments/agent-picker/+layout.server.ts` loads a server-owned directory snapshot. Candidates are scoped by project ID, grouped by workspace ID and sorted active before idle. Idle conversations remain selectable; archived and unrelated project records are excluded. The browser receives display metadata, not socket paths or management credentials.

Enable only in the standalone SvelteKit development server:

```sh
cd apps/surface
SURFACE_AGENT_PICKER_EXPERIMENT=1 bun --bun vite --host 127.0.0.1 --port 5198
```

Open `http://127.0.0.1:5198/experiments/agent-picker`. The route returns 404 without the flag and is not wired into the installed shared host. No live service restart or Tailscale mapping is needed.

Each tab keeps its selection and draft in sessionStorage scoped to this fixture project/workspace. Reload restores them. Duplicate tabs can copy initial storage and must not be interpreted as new requests. Offline directory status and a missing previously selected recipient both disable the simulation action while retaining the draft. Selection is explicit; no automatic fallback to another conversation occurs. Reconnection is demonstrated by the Connected link (server load reruns).

Validation: `bun test experiments/agent-picker/directory.test.ts`, app check, and `bun experiments/agent-picker/verify.ts` while the dev server is running. Browser checks cover two independent tabs, reload persistence, offline/deleted state, retained drafts and explicit cross-worktree selection. No message or binding is created. Screenshot inspected at `/tmp/surface-agent-picker.png` during this run.

Next acceptance gate: adapter-owned real directory discovery using verified Git project/worktree identities, pagination and bounded refresh; authenticated directory access; submit-time recipient validation; explicit creation of a new request binding (current delivery requires the conversation cwd to match the bound project root). Cross-worktree fixture selection is not proof that real cross-worktree delivery works. Keep existing submitted requests immutable and test deletion/transport races without sending fixture data to real conversations.
