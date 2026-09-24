# Page runtime

Shared mounted-page compiler, HMR, scoped dependencies and mount lifecycle. The Surface app injects project/interaction handlers and browser presentation through `RuntimeIntegration`; this package does not import application code.

Install with the root frozen workspace lockfile. Tests live under `tests/e2e/runtime`. Historical observations are retained in `docs/experiments/legacy-page-runtime.md`.
