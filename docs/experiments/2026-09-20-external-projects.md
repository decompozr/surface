# External project and agent workflow experiment

Status: executable exploration, not a finalized product design. Run on September 20, 2026 (America/Toronto).

## Questions

1. Can one local Artifact service mount ordinary frontend source outside its own checkout while preserving project-owned dependencies?
2. Can a custom form share the existing interaction/delivery model without the bundled A/B UI?
3. Can another agent use a skill and CLI to build, mount, inspect, and complete the workflow?
4. Can owned preview processes be cleaned up on normal shutdown and an unexpected manager exit?

## Implemented hypotheses

- A Bun management service stores runtime definitions alongside interaction records in local JSON.
- Each runtime has a canonical project root, frontend directory, and explicit command argument array.
- A supervised process group supplies direct loopback preview URLs; it does not proxy framework traffic.
- A browser client carries a request-scoped capability. Custom JSON schemas describe input independently of the rendered framework.
- The CLI provides the executable contract; a linked skill teaches creation, binding, verification, recovery, and reporting.

These choices make the experiment runnable. They do not adopt JSON storage, process topology, command names, or capability URLs as permanent architecture.

## Observations

`bun run verify:external` creates temporary Svelte and vanilla projects outside this checkout, installs each starter's declared dependencies, and runs type checks and production builds. Chrome submits custom message data through the real HTTP service; a fixture adapter records delivery acceptance. The CLI publishes a separate result, which appears in the browser. Reloading restores the persisted submission/result without generating another delivery.

Svelte source changes appeared in the browser. An intentionally introduced compilation error appeared in Vite's overlay; correcting the source recovered the page and its saved result. Both previews stopped, refused connections on their old endpoints, and restarted from the same source. Two project runtimes coexisted. Desktop and 390 px viewport checks passed.

Lifecycle tests also cover concurrent mounting, stop/remount ordering, failed executable startup, directory boundaries, changed symlinks, and a forcibly killed manager. The manager-crash test observes its preview endpoint becoming unreachable. HTTP checks reject cross-project interaction access and management attempts from project origins.

Local screenshots and machine-readable receipts are under ignored `.artifact/verification/`. They include private local context and are not committed. The reproducible verification script is versioned.

## Independent skill trial

A separate agent received the skill, an isolated project, and a supplied fixture binding. It created a preferred-label Svelte page and matching schema, installed dependencies, type-checked, mounted the project, submitted an explicitly automated label through Chrome, inspected the receipt, published the actual label through the CLI, and observed the confirmation in the browser. It then stopped its runtime. No blocking skill gap was reported, and no live Codex conversation was contacted.

The trial used an earlier template snapshot and did not test restoration on page load. The final starter adds that restoration, separately exercised by the external-project script. This distinction preserves which observations belong to which run. Local independent-trial reports and screenshots remain under ignored `.artifact/skill-proof/`.

## Validation checkpoint

- TypeScript check passed for core, CLI, tests, and the external verification script.
- Bundled Svelte check passed with zero errors or warnings; its production build passed.
- Automated suite: 25 tests passed, 78 assertions, zero failures.
- Both external starters passed their own type checks/builds and browser/CLI loop.
- The skill frontmatter validator passed; the independent trial established basic workflow usability.
- The local CLI was registered with `bun link`; the skill was linked into the local Codex skills directory. These are development links to this checkout, not a published package or a background service installation.

## Interpretation and limits

The evidence supports external mounting and custom browser/CLI interaction on this macOS/Bun setup. These new automated runs use an explicit fixture adapter: they do not establish a new live model turn. The prior dedicated Codex experiment separately established active steering and idle continuation; see [that evidence](../prototype.md#validation-on-2026-09-20).

Two projects with separately installed dependencies are not yet evidence for conflicting versions of the same dependency. Deliberate process detachment by untrusted code is not covered. Windows, OS-managed background service installation, remote access, arbitrary framework compatibility, and MCP remain untested or unimplemented.

Automated form submissions are experiment inputs, not personal user choices or acceptance. A published result is distinct from model authorship and browser observation.

## Next experiment

Subsequent user clarification selected singleton namespace/symlink mounting as the preferred direction. The [singleton experiment](2026-09-20-singleton-namespaces.md) supersedes expanding the per-project process topology.

Mount two projects that intentionally require different versions of the same package. Verify module resolution and failure independence, then expose the stable operations through a thin MCP adapter and test CLI/MCP interoperability. Reconsider the API and storage design using those observations before treating them as stable contracts.
