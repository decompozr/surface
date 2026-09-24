# cli

Command parsing and output over Surface operations. `src/installation` owns setup, release installation, activation, process lifecycle and rollback; it is an internal CLI module, not another app. Installation tests live beside their implementation as `*.test.ts`. Templates belong to apps/surface; scaffolding calls its local exported operation without starting HTTP.

See `docs/architecture/package-boundaries.md` for ownership and verification. Dependencies use the root Bun workspace lockfile.
