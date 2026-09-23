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

## Live read-only directory

Set `SURFACE_AGENT_DIRECTORY_SOCKET` to the existing provider control socket and `SURFACE_AGENT_DIRECTORY_ROOT` to the intended Git worktree root, alongside the experiment flag. The parent load then uses real Codex `thread/list`, paginates up to 20 pages, excludes archives and foreign roots, and retains `notLoaded` separately from idle. Git common-directory identity defines the project. No thread is resumed or sent input. Live mode remains loopback-only and the action remains a simulation. Transport failure is unavailable, not an empty successful directory. The provider socket and filesystem roots stay on the server.

Read-only discovery on September 23 found the actual current Surface conversation as active. No model turn was started. Protocol reference: https://learn.chatgpt.com/docs/app-server (thread/list and thread/read).

## Lifecycle acceptance results

The isolated lifecycle lab uses the real Surface Store and Service with a fake adapter. Its own tab-local fixture request starts at agent A; the directory picker above remains a separate selection experiment. Operations inspect before submitting, serialize concurrent operations per request, refuse unavailable recipients without consuming the response slot, and delegate final deduplication/outcome persistence to Service. Explicit takeover creates a new request/token and closes the old unsent request; it never copies a submission. Submitted requests require reconciliation before takeover. Exact worktree identity remains required by the delivery contract, even though other worktrees are visible in the directory.

The lab endpoint is gated by the experiment flag, loopback hostname, same-origin POST and a random per-tab fixture token. It is disabled entirely in live-directory mode. Fixture stores are temporary, expire after one hour on subsequent access, and can be explicitly removed with Reset fixture. No live provider delivery or production endpoint was modified.

Acceptance completed: 11 directory/lifecycle/service tests (42 assertions); app check with zero errors/warnings; real browser two-tab, offline/deleted, takeover, accepted/result and unknown-outcome flows; live parent-load browser rendering of the current actual Surface task. A hydration race found by browser testing was fixed by disabling inputs until tab state restores. Use `bun experiments/agent-picker/verify-lifecycle.ts` for the lifecycle browser suite.

These complete the bounded experiment gates. Production adoption is separate: shared-shell navigation/auth integration, scoped live-directory access, authorized actual binding controls and a user-driven end-to-end live submission. No fake data was submitted to a real task, and no real task was deleted to simulate failure.
