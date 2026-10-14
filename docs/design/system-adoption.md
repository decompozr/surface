# Shared design guidelines in Surface

Root AGENTS.md directs UI work to the provider's DESIGN.md and DESIGN-REVIEW.md before Surface-specific design contracts.

## Source and applicability

The files under system/ are unmodified documentation snapshots from private @decompozr/design-system 0.2.0. [provenance.json](system/provenance.json) records the immutable release, source and SHA-256 of each copied file. README.md, AGENTS.example.md and package.json are included so the guide's local references resolve. That package.json is documentation provenance only: it is not a Surface dependency declaration or installable runtime package.

The guide is the shared direction for new or changed UI. Surface retains application meaning, navigation hierarchy, comments, drafts, persistence, service lifecycle and authorization. Consumer CSS owns layout and positioning; reusable appearance and behavior use public provider APIs.

Guidance adoption does not update the runtime package, apps/surface/design-system.lock.json, Bun lockfile, live service or mounted pages. Inspect that runtime pin and public APIs before assuming that the installed controls have the guide's current geometry. If they differ, record the mismatch and use the existing provider-upgrade/release process within the task's authorized scope. Do not emulate newer primitives with private-selector CSS. Existing navigation/composer compact API contracts remain in force until explicitly migrated; the foundation guide does not silently remove them.

## Review and updates

Use the provider checklist together with Surface's source-workflow and self-owned E2E requirements. Test the actual installed app for UI changes; guide installation itself is a documentation-only change, with no claimed runtime or physical-device acceptance.

When adopting another guide version, extract the same files from its verified release archive, compare hashes, replace this snapshot without editing provider prose, update provenance.json and review the change against Surface's local design contracts. Keep Surface-specific decisions here or in their existing owner documents. A newer guide is not automatically a newer runtime.

This increment validates snapshot byte identity, local guide links, agent entry links, and preservation of the runtime dependency pin. No Surface build, installation or release is required because runtime and shipped skill behavior are unchanged.

Validation at adoption: all five snapshots match the downloaded 0.2.0 release archive byte-for-byte; its SHA-256 matches the published checksum. All nine local links in the packaged Markdown and the agent/index entry links resolve. The runtime dependency lock is unchanged (package 0.0.0, provider c0863d99015cfd6b039755f2f2fb94ce5ee47aa7). This records guidance availability, not runtime conformance.

Independent review confirmed snapshot identity, recorded hashes, local links and unchanged runtime/lockfiles with no actionable findings.
