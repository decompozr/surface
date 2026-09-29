# Navigation and screen hierarchy

Source references: [shell](../../apps/surface/src/lib/components/SurfaceShell.svelte), [tree](../../apps/surface/src/lib/components/NavigationTree.svelte), [tree builder](../../apps/surface/src/lib/server/http/navigation.ts), [home](../../apps/surface/src/routes/+page.svelte), [page guide](../../skills/surface/references/pages.md). Existing verifier: [navigation fixture](../../tests/e2e/surface/verify-navigation.ts).

## D-01: information hierarchy and routes

The sidebar heading is **Workspaces**. Do not label it “Projects & workspaces”.

The current shell orders one header with the Surface icon as its navigation toggle (without an adjacent Surface wordmark or a second Home/breadcrumb bar), request recipient controls when applicable, then project-owned page content. Projects, workspaces and mounted source folders are grouping nodes. The mount root has a single Home page link; route segments link to declared pages or generated indexes. Workspace labels use the source directory name without appending Git branches or agent metadata. Only the actual page link is current. Identity comes from the ledger/mount, not the label. The tree includes only active registered workspaces with ready route mounts and pages; it does not expose arbitrary directories or legacy component catalogs.

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
[Surface icon / navigation toggle]
[Project > worktree > folder > route] | Project content
                                    | Agent recipient (request URLs only)
                                    |   identity, observed status, delivery choice
                                    |   optional explicit recipient change
                                    | Project page: controls, submit, result
```

Navigation links preserve query/fragment only for the current page. Unrelated page links remain clean; never forward a request capability to another page. Current source uses `data-sveltekit-reload`, so navigation can create a new document. Do not imply that form drafts persist across these links.

### Compact navigation and brand

The header uses the design-system `AppHeader density="compact"` at 36px, with 32px touch action targets, the `panel-left` IconButton on white, and `SurfaceTabs`. It contains no logo, adjacent wordmark or breadcrumb row. The sidebar is labeled Workspaces. NavigationLinks uses `typography="uniform"`: every group and link is 14px, weight 400, 20px line-height, with a 32px row and no group margin. Indentation conveys hierarchy; the current page uses background rather than bold type.

Selecting a mounted route opens or selects an editor tab. Each secondary surface stays mounted in its own same-origin frame; switching tabs keeps DOM, drafts and scroll positions. A frame hides its redundant shell header; the parent forwards comment-tool actions only to the active known frame with matching origin. Navigation from a frame opens a parent tab. Closing is immediate, without an unconditional confirmation; closing discards that page’s local state. Browser Back and Forward restore previous tab selections while other tabs remain mounted, preserving their drafts and scroll. Selecting an already active tab adds no history entry. Closing replaces the current selection entry; historical entries never reopen explicitly closed pages. Selection history keeps the outer document URL stable, so each embedded page retains its own route and capability URL. Tabs are session UI: a full browser reload still reloads content and does not promise draft recovery for arbitrary pages. The original deep link retains its capability; unrelated route opens never inherit it.

The September 28 spacing correction uses the public NavigationLinks `touchDensity="compact"` API for actual 32 CSS px touch rows for the dense navigation list, not a smaller painted label inside a 44px row. Consecutive leaf links have no extra vertical spacer; hierarchy comes from indentation and group labels. Hit regions must not overlap. Toolbar actions retain their separate larger touch targets. Validate real touch activation and visible keyboard focus as well as row geometry. The upstream implementation is tracked in [design-system issue #12](https://github.com/decompozr/design-system/issues/12).

## D-02: navigation states

| State | Current behavior | Required review or proposed improvement |
| --- | --- | --- |
| Ready | Registered project > exact worktree > mounted source folder > nested route; current link has `aria-current="page"` | Confirm duplicate labels remain distinguishable by context; labels are not identity. |
| No navigable mounts | “No route pages are mounted yet.” | Current copy does not distinguish no registration, no route pages, failure or retired workspaces. Proposed: actionable diagnostic path without pretending the source directory is empty. |
| Initial load | Home navigation comes from parent server load; navigation remains closed through hydration and slides in on request, pushing content without compressing its width | No dedicated navigation-loading indicator. Verify no premature delivery action is enabled by a project form during hydration. |
| Mount failed/unmounted | Non-ready mounts are omitted on a rebuilt tree; old page access may fail | No continuous tree refresh is promised. Proposed: show a stale-page explanation and route to inspection without erasing project drafts. |
| Offline/service unavailable | Browser/network failure; no dedicated shared offline screen | Proposed: distinguish unreachable service from no mounts and from unavailable recipient. No automatic mutation replay. |
| Long/deep tree | Labels wrap; nested list indentation; route keys sorted within each mount | Project/workspace/mount order follows supplied records. Deep-tree overflow, duplicate labels and ordering are open design choices, not complete coverage. |
| Desktop collapsed / mobile closed | Navigation is hidden and inert; it starts closed consistently through hydration | See [mobile/accessibility](accessibility.md); no global persisted account preference. |

Pass/fail and evidence boundaries are [E-07](../evaluations/ui-eval.md#e-07-navigation-and-location) and [E-10](../evaluations/ui-eval.md#e-10-failure-and-freshness-presentation).

## Compact path tabs

Tabs size to their full path and close control without expanding into spare space, and shrink to 120px before the strip scrolls. The complete readable route path is ordered ancestor-to-page and truncated from the left so the final page name remains visible. The title exposes the complete path. Revealing the selected tab scrolls only the tab strip, never the header or document.

Desktop and touch-phone verification checks 36px header height, fully contained controls, generous initial tab width, shrinkage under crowding, page-name suffix visibility, full-path titles, and fixed header controls. Draft, scroll, keyboard and close regressions remain covered.

Hover shortcuts: with the mouse over page content, C selects that element and opens the comment editor; S selects and captures it, then opens the editor for review. V toggles selection mode. Ignore shortcuts in editable fields, during composition/repeats, and with command/control/alt modifiers. Capturing never sends a comment.

Project/workspace roots show a workspace icon, Git worktree rows a branch icon, mounted folders a folder icon, and routes an HTML/code-page icon. Icons are decorative, aligned at 16px, and do not change the uniform label typography.

Selection-mode pointer activation releases button focus so a later global shortcut cannot turn a stale pointer focus into a keyboard ring. Keyboard traversal still retains native focus indication. Mode pressed state and page selection outline remain separate from focus.
