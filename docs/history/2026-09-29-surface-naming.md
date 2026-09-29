# Surface naming migration

Current source uses `surface.project.json` with a `surfaces` collection, `surface.json`, `surfaceId`, CLI `--surface`, ProjectSurface types, Surface runtime event/DOM/module names, and `.surface-release.json`. Current examples, templates, CLI/MCP contracts, tests, setup guides and skills use those names. Historical evidence retains its original terminology.

This is an explicit naming migration, not a re-registration. Existing project/surface UUIDs, opaque mount names (including historical a- prefixes), namespaces, URLs, component paths, interaction records and storage directories remain unchanged. Old manifests are refused with a migration instruction rather than silently initializing replacement identities. Old installed releases are retained as historical builds.

Before deployment, back up each live project manifest and source manifest, rename the project file and its collection field, and rename each source manifest without changing its contents. Refuse collisions. Update integration references in the mounted sources. Runtime registry and interaction data do not require schema changes for this rename. The source installation uses the committed new revision; verify every previous mount and identity afterward.

Validation: source/type checks, 105 existing module tests, isolated installed CLI/MCP/project lifecycle tests, browser navigation/drafts/HMR, and an additional refusal regression for legacy manifests. The live migration receipt is retained under the production installation alongside file backups.
