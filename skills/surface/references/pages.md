# Project pages and readable URLs

Route-based pages are the only supported authoring workflow for new or updated user-facing Surface previews. Do not create component-catalog previews. Keep sources inside the user's Git project; do not convert its existing application or package manager implicitly. Surface mounts trusted Svelte source, not an arbitrary existing Vite app or a full SvelteKit application.

## Minimal source

Create a source folder such as `surfaces/review` containing:

```text
surfaces/review/
  package.json
  artifact.json
  routes/
    +page.svelte
    history/
      +page.svelte
```

Declare the shared compiler version in `package.json`:

```json
{"private":true,"type":"module","dependencies":{"svelte":"5.57.1"}}
```

Use this `artifact.json`:

```json
{"framework":"svelte","components":"routes","routes":"routes"}
```

Each `+page.svelte` is an ordinary Svelte component. A page may import existing project-owned components rather than duplicate them. Keep a source-scoped dependency lockfile. See the [dependency contract](../../../packages/page-runtime/README.md) for additional packages and supported prebundling. The filename convention does not imply support for SvelteKit layouts, load functions, server actions, SSR or dynamic route parameters.

From the project worktree, using the selected installed CLI:

```sh
surface project init --name "Project name"  # only if artifact.project.json is absent
surface project register
surface project add --source surfaces/review --name "Review"
surface project list
surface project mount --artifact ARTIFACT_ID
```

Read the artifact ID from the command result, not from this example. `add` registers existing source; it does not scaffold files. Use `project list` to inspect `runtime.publicPath`, `runtime.pages` and `runtime.previewUrl` after mounting.

The installed workspace host produces:

```text
/workspace/<project-name>/<worktree-name>/<source-folder>/
/workspace/<project-name>/<worktree-name>/<source-folder>/history
```

Project names and folder names are normalized to lowercase slugs. The canonical Git checkout is called `main` regardless of its current branch; linked worktrees use their directory basename. The last segment comes from the mounted source folder basename, not the artifact display name. Names are captured when the readable alias is assigned; UUIDs remain authoritative. Do not fabricate URLs or rename identities to resolve collisions: use the returned mount metadata.

`routes/+page.svelte` supplies the mount index; `routes/history/+page.svelte` supplies `/history`. Use only these clean URLs for browsing. For historical compatibility, the runtime still serves sources without `routes` through the legacy `/n/.../?component=...` catalog. Existing mounts are not automatically migrated by documentation changes; add route wrappers and remount only within an authorized project task, retaining its artifact ID. Verify the resulting URL and rendering.

## Interaction requests

Read-only browsing needs no conversation binding or request. For agent submission, use the exact discovered source-relative component (for example `routes/history/+page.svelte`) with `surface request --component`, plus the returned namespace/mount and explicit schema. Open the exact request `previewUrl`, including its query and capability fragment; do not replace it with a clean browsing URL or strip credentials. Current interaction URLs can retain the legacy component form. Binding, actual delivery and result rendering must be verified separately.

## Remote browser access

Run the installed service and CLI on the machine owning the project. In source setup, `./bin/setup --tailscale on` configures private Serve access and the exact accepted browser origin; it never enables Funnel. Setup remembers the selection, protects other mappings and displays both URLs. Use `surface status` for `lifecycle.origin` (loopback) and `lifecycle.browserOrigin` (configured HTTPS), and use the preview URL returned by the service. Do not assume a fixed Tailscale port or substitute a hostname without configuring the service.

`./bin/test` checks the installed host and mapping. Check the actual HTTPS page from the host, then verify browser rendering and access from the intended second device separately. The other device must be connected to the appropriate tailnet. This provides browser access, not remote CLI management or automatic agent conversation connectivity. An Invalid Host response means the accepted browser origin needs inspection; rerun current setup rather than disabling Host/Origin checks.


## Shared navigation and recipients

The installed home page and mounted route pages share the Surface shell. The parent server load supplies the home navigation from the registered workspace ledger and ready mounts; mounted pages use the same server-built tree and component. The sidebar groups projects, exact worktrees, mounted source folders, and page routes. It never browses arbitrary filesystem directories. Intermediate route folders have an index even without their own `+page.svelte`. The desktop sidebar collapses per tab; on mobile it opens as a drawer with Escape/backdrop dismissal. Breadcrumbs and the current-page link retain that page's request query and capability fragment.

Pages with a request URL also show the recipient state and delivery choice. Active recipients offer queue and steer. Recipient changes require a request explicitly created with `--allow-recipient-selection`; the user confirms the new recipient before reviewing and submitting a fresh interaction. Discovery is read-only, and other worktrees cannot receive this request. Do not enable selection or send test data to another conversation merely to verify the UI.

## Contextual comments on mounted pages

Mounted component pages provide shared selection, element capture and comment review tools. They start in normal interaction mode so project controls work immediately. Select an element with the header tool, optionally capture its visible rectangle, add a comment to the draft, then review and explicitly send the batch. Keep domain forms and schemas project-owned.

Sending uses the existing exact page request URL and its `#token` capability. A plain readable page can retain a draft but cannot send until opened with an explicitly bound request. Drafts are separate for each page/request; an unbound draft is not silently transferred to a newly bound request. For an active recipient the Switch selects Steer (on) or Queue (off); results arrive automatically without resending. Comment batches do not consume the original form submission.

Reply to the typed `surface.comments` event using its exact `requestId` and `replyTo`, as described in the Surface skill. The callback directory is specific to that parent request. Never select another page's latest record. Component-file revision and observed element text help identify stale context; HMR is marked unverified until reload. These tools do not guarantee canvas, cross-origin image, iframe, shadow-root or native-device capture fidelity.
