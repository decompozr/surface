# Bounded singleton lifecycle and resource experiment — 2026-09-21

This experiment measures a single running component host while repeatedly mounting, editing, and unmounting sources. It separates released runtime resources from intentionally retained definitions and library metadata. A finite soak is evidence about its measured window, not proof of indefinite stability.

## Test design

`bun experiments/singleton/verify-soak.ts` runs 30 complete mount/edit/unmount cycles over at least three minutes. The first 15 cycles reuse one source identity; the remaining 15 introduce distinct source identities. Every source has Svelte 5.57.1 and a scoped lodash 4.17.21 prebundle. Each cycle executes an HMR edit with an opted-in counter, then unmounts the page.

A separate neighbor remains mounted throughout. Its document marker must remain unchanged, its page must remain interactive, and its counter advances once per cycle. The suite also tests an initially broken component, recovery from that failure, an invalid lockfile and recovery, and a compiler error introduced into an already open page.

Samples record the server process's RSS and JavaScript heap after explicit full GC, Vite module/URL/file-map cardinalities, retained transformed code bytes, Chokidar directory metadata, active watcher closers, filesystem allow entries, registry entries, and descendant processes. Chrome runs as a separate owned child tree; it is counted separately from install/server children. Concurrent processes outside that tree are not included. This is diagnostic instrumentation, not a timing benchmark.

The active watcher-closer observation reads the installed Vite 8.3.0/Chokidar implementation's internal `_closers` map without modifying it. `getWatched()` alone is insufficient: it retains directory metadata after a path is unwatched. Future library upgrades must revalidate that diagnostic.

## Failure discovered and correction

Before cleanup changes, an initially invalid Svelte component reached the preparation phase, acquired a source watcher and filesystem allow entry, and then failed compilation. The catch path removed its symlink but retained the allow entry and watcher state. Earlier invalid-lockfile tests failed before this phase and could not detect the defect.

The cleanup path now handles both failed preparation and ordinary unmount:

- Mark the mount unavailable before asynchronous cleanup.
- Release source-local dependency bundle strings and aliases.
- Enumerate watched descendants and unwatch them along with the source and mount symlink paths. Chokidar's root `unwatch` closes only the exact path's closer, so descendants need explicit treatment.
- Remove the symlink and source filesystem allow entry.
- Invalidate source-local Vite transforms.

Paths explicitly ignored by unwatch are remembered and added back on remount, preserving HMR and discovery. Cleanup uses public watcher APIs; it does not delete Vite's module maps or Chokidar's private maps. The corrected initial-failure gate verifies no source allow entry or active closer remains, while separately acknowledging retained directory metadata.

## Measured result

The full run passed on 2026-09-21. The 30-cycle loop took **180.115 seconds**, excluding initial preparation and failure probes. Every cycle preserved the neighbor's document, all 30 neighbor clicks succeeded, and shutdown left zero owned descendant processes.

| Post-cleanup checkpoint | Vite module IDs | Vite URL IDs | Retained transform bytes | Watch directory metadata | Active watcher closers | Mount definitions / active |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Warm neighbor | 112 | 113 | 844,875 | 9 | 7 | 1 / 1 |
| First repeated-source cycle, after failure/recovery gates | 119 | 122 | 844,875 | 21 | 7 | 4 / 1 |
| Fifteenth repeated-source cycle | 119 | 122 | 844,875 | 21 | 7 | 4 / 1 |
| Fifteenth distinct-source cycle | 164 | 197 | 844,875 | 81 | 7 | 19 / 1 |

Post-unmount samples had no non-browser child process. There were nine owned Chrome descendants during the two-page loop; all disappeared after closing the browser. The only remaining source allow entry and active source watcher belonged to the healthy neighbor. The failed preparation and unmounted sources had neither.

Least-squares slopes over post-unmount samples make the distinction explicit:

- Repeated-source phase: module IDs, URL IDs, watcher directory metadata, active watcher closers, and retained transform bytes all had a zero-per-cycle slope.
- Distinct-source phase: module IDs grew by **3 per cycle**, URL IDs by **5 per cycle**, and watcher directory metadata by **4 per cycle**. Active watcher closers and retained transform bytes still had zero slope.
- After forced GC, repeated-source JavaScript heap samples ranged from **67.92–86.27 MiB** and distinct-source samples from **68.15–74.27 MiB**. Their fitted slopes were **−0.447 MiB/cycle** and **+0.144 MiB/cycle**, respectively. The positive distinct-source slope is not a promise of bounded indefinite memory use.
- RSS varied substantially with allocator/GC reclamation: **255.41–471.05 MiB** in the repeated-source samples and **227.00–347.33 MiB** in the distinct-source samples. Fitted slopes were **−11.251 MiB/cycle** and **−6.564 MiB/cycle**. Those short-window negative slopes must not be extrapolated as a long-term trend.

The final neighbor-only sample retained **69.43 MiB** JavaScript heap and **238.22 MiB** RSS. Explicit GC and the browser-driving harness influence these numbers; they are local diagnostic observations, not deployment memory requirements.

The dependency browser suite, original singleton browser suite, singleton interaction browser suite, the three lifecycle tests with 22 assertions, and experiment TypeScript check also passed with the cleanup changes. The neighbor screenshot was visually reviewed at counter 30.

## Interpretation and operating boundary

Repeated identity reuse should stabilize module identity counts and return transformed code to the still-mounted neighbor's level. Distinct source identities can increase Vite's retained module/URL/file metadata and Chokidar's directory metadata even after active resources and transform strings are released. Saved mount definitions and remount watch-path lists also persist intentionally for inspection and remount; registry cardinality is not itself a leaked watcher or subprocess.

Vite invalidation clears transformed output but is not a complete module eviction API. Deleting only exposed maps would ignore unresolved URL caches and importer relationships. This experiment therefore reports retained metadata rather than inventing an unsupported cache eviction mechanism.

The current host is suitable for bounded local exploration under this measured workload. Unbounded source-identity churn in an indefinitely running daemon remains an open readiness constraint. A supported resource budget and eviction/recreation policy, longer-duration measurement, varying package sizes, and simultaneous users are needed before making that operational promise. No namespace security isolation or production deployment claim follows from these results.

## Evidence and reproduction

```sh
bun install --cwd experiments/singleton --frozen-lockfile
bun experiments/singleton/verify-soak.ts --probe
bun experiments/singleton/verify-soak.ts
```

`--probe` records the initial compile-failure cleanup gate only; it is not a substitute for the full soak. The full script writes ignored `.artifact/soak-proof/samples.json`, `result.json`, and `neighbor-after.png`, then stops its own server and browser and removes its temporary sources. The baseline probe is retained separately as `baseline-probe.json`.

## Integration review: retired mount ownership

Cross-track review reproduced another lifecycle defect: after unmounting A and mounting the same source under B, unmounting A again released B's watcher, filesystem allowance, and scoped dependency bundle. Repeated unmount is now idempotent for a retired definition. Failed cleanup remains visibly failed and retryable. A regression transfers ownership A → B → A, checks the new owner's dependency remains accessible, rejects stale remount while another owner is active, and confirms actual unmount revokes access. The four singleton lifecycle tests passed with 44 assertions after this correction.
