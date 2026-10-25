# Personal demo presentation

## Intent and accepted requirements

Present Surface as a personal hobby experiment for an interview demo, ahead of a later repository transfer. The README must be minimal: a short positioning statement, a few current capabilities, getting-started and documentation links. Put the detailed core ideas in the existing canonical product vision at `docs/intent/vision.md`, rather than creating a competing source. That vision explains externalized knowledge and interactive tools, provider-independent architecture, feedback to the exact originating agent conversation, Git-versioned project sources, separate worktree identities, and optional private Tailscale access.

Describe current behavior separately from the adopted typed, templated, persisted-page direction. Provider independence is an adapter boundary, not a claim that every provider is already supported. Git versions source and declarations, not credentials or private runtime state.

## Privacy scope and observed gap

Remove organizational branding from the public introduction. The existing README focuses on runtime mechanics rather than the experiment's purpose. Additional organizational references exist in package identifiers, default installation paths, bundled provider metadata and historical documents. The user selected README and public-facing documentation only, with an inventory of remaining items. Runtime identifiers, installation defaults, executable skill references, immutable provider snapshots and historical evidence are outside this edit. The repository agent entry is shortened separately as requested, preserving its detailed policy by reference. Public setup examples may explicitly select a neutral home through the existing supported option; they must not claim that the runtime default changed. No repository transfer, visibility change or Git-history rewrite is part of this edit.

## Acceptance

The README communicates the accepted positioning in English, contains no organizational branding, links to existing setup/source documentation, and labels future work honestly. Audit the tracked tree for remaining references and disclose them; do not describe the repository as sanitized while references remain. A later transfer also needs a separate history/assets/dependency review.

## Delivery and remaining work

The README, installation guide, product vision and consumer requirement were updated. See [transfer readiness](../evaluations/personal-transfer-readiness.md) for the remaining categories and bounded checks. Runtime release/deployment is not applicable to this documentation-only change; existing installations and agent skill behavior are unchanged.

## README and agent-entry correction

The user asked for a typical minimal open-source README, with detailed concepts in the canonical vision, and a substantially shorter AGENTS entry. The agent entry now links task-specific guidance; its detailed rules remain in the development policy without a behavior change. Reference README structures were read from uv, FastAPI and Astro. No badges, license claims, provider support claims or public download URLs were invented.
