# Navigation and screen hierarchy

Source-inspected at `7fceefc`: [shell](../../apps/surface/src/lib/components/SurfaceShell.svelte), [tree](../../apps/surface/src/lib/components/NavigationTree.svelte), [tree builder](../../apps/surface/src/lib/server/http/navigation.ts), [home](../../apps/surface/src/routes/+page.svelte), [page guide](../../skills/surface/references/pages.md). Existing verifier: [navigation fixture](../../tests/e2e/surface/verify-navigation.ts). No screenshot was captured in this task.

## D-01: information hierarchy and routes

The current shell orders global brand/navigation, location breadcrumbs, request recipient controls when applicable, then project-owned page content. Projects, workspaces and mounted source folders are grouping nodes. The mount root has a single Home page link; route segments link to declared pages or generated indexes. Workspace labels use the source directory name without appending Git branches or agent metadata. Only the actual page link is current. Identity comes from the ledger/mount, not the label. The tree includes only active registered workspaces with ready route mounts and pages; it does not expose arbitrary directories or legacy component catalogs.

| Surface | Entry and content | Primary action / boundary |
| --- | --- | --- |
| Home | `/`: “Pick up where you left off”, mounted-page guidance and Server health link | Choose a mounted route. No project create/archive/install UI is implemented here. |
| Health | `/health` | Inspect health data; this is not proof of page usability or delivery connectivity. |
| Mount root / route folder | Returned `/workspace/<project>/<worktree>/<folder>/...` alias | Render a declared page or a generated child-route index when the folder has no page. Use returned aliases rather than deriving identity from strings. |
| Project page | Declared `routes/.../+page.svelte` | View/interact with project content. Supported route files are client-rendered Svelte components, not a full mounted Kit app. |
| Interaction page | Returned request `previewUrl` with query and capability fragment; it may use a legacy component URL | Shared Agent recipient panel above the form. A clean browsing route does not confer submission capability. |
| Historical recipient lab | Retired implementation; see the dated [experiment package](../experiments/2026-09-23-agent-recipient.md) | Retired harness; not a current route or evidence of shared-panel draft persistence. |

Illustrative structure below describes source composition, not a rendered or approved wireframe:

```text
[Navigation toggle] Surface
[Project > worktree > folder > route] | Home / folder / page
                                    | Agent recipient (request URLs only)
                                    |   identity, observed status, delivery choice
                                    |   optional explicit recipient change
                                    | Project page: controls, submit, result
```

Navigation and breadcrumbs preserve query/fragment only for the current page. Unrelated page links remain clean; never forward a request capability to another page. Current source uses `data-sveltekit-reload`, so navigation can create a new document. Do not imply that form drafts persist across these links.

## D-02: navigation states

| State | Current behavior | Required review or proposed improvement |
| --- | --- | --- |
| Ready | Registered project > exact worktree > mounted source folder > nested route; current link has `aria-current="page"` | Confirm duplicate labels remain distinguishable by context; labels are not identity. |
| No navigable mounts | “No route pages are mounted yet.” | Current copy does not distinguish no registration, no route pages, failure or retired workspaces. Proposed: actionable diagnostic path without pretending the source directory is empty. |
| Initial load | Home navigation comes from parent server load; navigation remains closed through hydration and slides in on request, pushing content without compressing its width | No dedicated navigation-loading indicator. Verify no premature delivery action is enabled by a project form during hydration. |
| Mount failed/unmounted | Non-ready mounts are omitted on a rebuilt tree; old page access may fail | No continuous tree refresh is promised. Proposed: show a stale-page explanation and route to inspection without erasing project drafts. |
| Offline/service unavailable | Browser/network failure; no dedicated shared offline screen | Proposed: distinguish unreachable service from no mounts and from unavailable recipient. No automatic mutation replay. |
| Long/deep tree | Labels wrap; nested list indentation; route keys sorted within each mount | Project/workspace/mount order follows supplied records. Deep-tree overflow, duplicate labels and ordering are open design choices, not complete coverage. |
| Desktop collapsed / mobile closed | Navigation is hidden and inert; desktop preference stored in sessionStorage | See [mobile/accessibility](accessibility.md); no global persisted account preference. |

Pass/fail and evidence boundaries are [E-07](../evaluations/ui-eval.md#e-07-navigation-and-location) and [E-10](../evaluations/ui-eval.md#e-10-failure-and-freshness-presentation).
