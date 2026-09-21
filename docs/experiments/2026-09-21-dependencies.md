# Scoped browser dependency experiment — 2026-09-21

Status: implemented and browser-verified exploratory hypothesis. It extends the shared Svelte component host with explicit, source-scoped JavaScript dependency prebundles. It does not establish arbitrary npm package or framework compatibility.

## Question and baseline

Can one running Vite instance render two mounted sources that use different versions of a CommonJS package, including an ESM package that imports that CommonJS dependency, without replacing the server or refreshing unrelated pages?

The original configuration disables Vite dependency discovery and prebundling. A mounted Svelte component importing lodash reported `ready`, but Chrome failed before rendering: the unbundled lodash module did not export `default`. This demonstrates that transformed component readiness is weaker than successful browser execution. The earlier nanoid experiment proved browser-ready ESM compatibility only.

This baseline is consistent with [Vite's dependency prebundling documentation](https://vite.dev/guide/dep-pre-bundling): development serves ESM, so CommonJS dependencies need conversion. A global optimizer also has discovery and reload behavior that must be evaluated carefully for dynamically mounted, independently versioned sources. [Vite's optimization options](https://vite.dev/config/dep-optimization-options) explicitly state that `noDiscovery` requires CommonJS entries to be selected for optimization.

## Bounded implementation

A source opts package entry points into preprocessing in its own `artifact.json`:

```json
{
  "framework": "svelte",
  "components": "src",
  "prebundle": ["lodash", "mixed-entry"]
}
```

The host still installs source-local dependencies using `bun install --ignore-scripts`, freezing an existing Bun lockfile. It then prepares each selected entry before making the mount ready:

1. Vite resolves the selected import using its browser resolution from an importer inside the canonical source folder.
2. The entry must resolve to a JavaScript package file inside that source's `node_modules`.
3. `Bun.build()` converts the entry and its dependency graph to one browser-targeted ESM bundle. Svelte imports remain external to preserve the host's shared framework runtime.
4. A Vite virtual module serves the result. Its identity includes canonical source identity, resolved entry, lockfile contents, and generated code; it is not keyed by the bare package name alone.
5. Remount rebuilds the selected entries. Unmount and failed preparation release source-local aliases and retained bundle strings. Requests for obsolete or unmounted virtual module URLs are rejected before Vite serves a cached transform.

The normal browser-ready ESM path remains unchanged. There is no global optimization restart, additional Vite instance, dependency development server, or subprocess for bundling. Installation can still use short-lived Bun subprocesses.

The implementation uses [Vite virtual module hooks](https://vite.dev/guide/api-plugin) and [Bun's browser-targeted bundler](https://bun.com/docs/bundler). It is a narrow compatibility adapter, not a replacement for Vite's full optimizer.

## Browser observations

The repeatable script creates clean temporary sources, invokes the real singleton CLI, and controls Chrome:

- Baseline lodash import fails in the browser with prebundling disabled.
- Alpha executes lodash **4.17.20** and Beta executes **4.17.21**. Both expose their actual `VERSION` and execute `chunk`, so the evidence checks behavior and version rather than package metadata alone.
- A local ESM package imports lodash transitively and executes its function. Each source produces its own correct version and result.
- Alpha and Beta request disjoint virtual dependency URLs.
- Beta mounts after Alpha is open. Alpha's document marker and opted-in counter remain intact.
- A third mount introduces **slugify 1.6.6**, a new CommonJS entry, while both existing pages are open. It renders without replacing the server/Vite instance or refreshing Alpha.
- A missing package entry, a Node builtin import, and an entry that emits CSS fail preparation. The failed mount has no usable preview; healthy mounted pages remain interactive.
- Correcting the same failed mount's selected entries restores browser rendering using its existing frozen dependencies.
- Unmount revokes previously loaded virtual dependency URLs, while another source's bundle remains readable. Remount resolves the original package version again.

The experiment additionally exposed a pre-existing lifecycle defect: sending Vite `full-reload` with a non-HTML namespace path refreshes every connected page. Vite 8.3.0's client only applies path matching to `.html` reload paths. The fix sends an `artifact:unmounted` custom event; each preview reloads only when its namespace and mount match. The regression checks the removed page becomes unavailable while its neighbor retains its document marker and counter. Earlier tests checked neighbor content/readiness after unmount but did not check document identity. Merely providing `path: '/n/.../'` is insufficient.

## Reproduction and evidence

```sh
bun install --cwd experiments/singleton --frozen-lockfile
bun experiments/singleton/verify-dependencies.ts --baseline
bun experiments/singleton/verify-dependencies.ts
bun run --cwd experiments/singleton check
```

Validation passed on 2026-09-21 with Bun 1.4.0, Vite 8.3.0, Svelte 5.57.1, and installed Chrome. The full verification repeats the failing baseline before testing the opt-in adapter. Ignored evidence is written to `.artifact/dependency-proof/baseline.json`, `result.json`, `alpha.png`, and `beta.png`. Temporary source folders, installed packages, browser sessions, and servers are removed after the run. No live model call is made.

## Limits and next gates

- Selection is explicit. The experiment does not infer every CommonJS import, package subpath, or transitive optimization need automatically.
- Only a single JavaScript output is accepted. CSS, extra assets, workers, native addons, and Node builtin imports are outside this pilot. Node builtin imports are explicitly rejected: browser-targeted bundling alone did not reject the tested `node:fs` entry reliably.
- This does not promise browser polyfills for `process`, `Buffer`, `global`, filesystem APIs, or dynamic `require` expressions.
- The tested CommonJS imports use default objects/functions. Arbitrary named CommonJS export synthesis is not established.
- Selected entries are bundled independently. Selecting a package root and subpath, or two entries with a common dependency, may duplicate module singleton state. Shared dependency identity inside one source needs a separate experiment before stateful packages can be promised.
- Vite resolves the root entry, while Bun resolves its bundled transitive graph. Browser conditions, package export maps, environment substitutions, side effects, and framework packages need their own coverage.
- Dependencies are rebuilt on explicit remount. Live editing installed dependencies or `prebundle` configuration is not an automatic install/rebuild workflow.
- This is development rendering, not deployment, server-side rendering, or production build compatibility. Source namespaces remain trusted organizational scopes rather than browser security sandboxes.
- Bundle registry cleanup is implemented; bounded long-running measurement is still needed for Vite module graph, watcher, process, and memory retention across many source identities.
