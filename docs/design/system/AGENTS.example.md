# Connect a project to the design system

Copy the following section into the consuming project's root `AGENTS.md`, preserving its existing instructions. If the UI workspace is nested, name it explicitly. Resolve the installed dependency from that workspace, not from a global checkout.

```markdown
## DecompozR UI design

Before UI work, read `DESIGN.md` and `DESIGN-REVIEW.md` shipped with the installed `@decompozr/design-system` package, plus its README for public APIs. Record the package version; use the guide matching that version. Resolve the files from the UI workspace's dependency installation. If unavailable, report the missing guide or use this project's explicitly pinned local guidance; do not silently use an arbitrary latest version.

Use the package's components and tokens. Keep black/white/gray dominant and approved accents purposeful. Preserve the documented control proportions, mobile hit targets and spacing relationships. Consumer CSS owns layout; do not override private component internals or create replacement primitives. Record any accepted exception and its removal condition.

Before delivery, apply the shipped review checklist to the actual page: desktop/mobile, enlarged text, keyboard/touch, states and recovery. Record engineering checks, rendered findings and human acceptance separately in the project's docs. Preserve this project's product requirements, workflow and authorization boundaries.
```

For Node with ESM resolution, run from the workspace that declares the dependency:

```sh
node --input-type=module -e "console.log(import.meta.resolve('@decompozr/design-system/DESIGN.md')); console.log(import.meta.resolve('@decompozr/design-system/DESIGN-REVIEW.md'))"
```

Read those resolved files using the agent's file tools. They are documentation exports, not JavaScript modules to import into the app bundle. With other package managers, use their installed dependency resolver rather than guessing a machine-specific path.

For offline agent access or an older runtime package, a project may vendor an exact copy of both documents. Record the guide's package version, immutable release/source, checksums and runtime-version mismatch beside the copies; link them from AGENTS.md. Preserve the provider text and keep consumer-specific decisions in a separate document. Refresh the copies deliberately when adopting a new guide. This does not install new components or change application behavior.
