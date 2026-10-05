# Typed, templated, persisted pages

Status: adopted product direction on September 30, 2026, from the user's discussion of editable documents, visualizations, and small custom components. Implementation and runtime acceptance are pending. This document owns the intended page behavior; the [vision](../intent/vision.md#persistent-editable-pages) owns its product purpose.

## Page model

| Concept | Responsibility |
| --- | --- |
| Template | Reusable definition of typed content and component data, initial values, rendering, and supported editing operations. |
| Saved page | An independently identified instance with its own content, meaningful component data, and revision. Creating or editing one instance must not change another instance or its template. |
| View state | Selection, filters, sorting, expanded sections, and layout preferences, separate from authoritative content. Each field has a declared owner, scope, and persistence policy. |

Documents, visualizations, and custom components can be composed within a page. Persist the meaningful inputs and data needed to resume their use; derived displays can be recomputed. A template is a starting structure and contract, not shared mutable content across all its instances. Template evolution must not silently rewrite existing pages.

## Required properties

| Property | Intended behavior | Observable acceptance |
| --- | --- | --- |
| Typed | Explicit contracts cover page content, component data, edit requests, and results. Validate external and persisted values at runtime before trusting them. Projects own domain-specific validation. | Invalid data or edits produce an actionable failure without overwriting valid saved content. Unsupported persisted formats are rejected and preserved. |
| Templated | Create independent page instances from reusable definitions and defaults. | Two instances start with the intended defaults; editing either preserves the other and the template. |
| Persisted | Saved content and meaningful component data survive closing/reopening the browser and restarting the service. Report save success only after the persistence contract is satisfied; expose failures without discarding the user's pending edit. | Reopening after a reported successful save and service restart restores the saved values. A failed save remains visible and recoverable. |
| Explicit view state | Separate presentation choices from content. Declare what is transient, what survives reopening, and whether persisted choices belong to a person, session, or page. | Transient choices reset and persisted choices restore according to their declared policies; neither silently changes domain content. |
| Extensible | Projects can define additional page types, visualizations, components, and actions through explicit interfaces. Shared appearance and interaction use the design system's public primitives. | A concrete project extension composes with a page and participates in the same validation, persistence, and state-ownership contracts without adding its domain rules to Surface Core. |

### Human and agent edits

Direct human edits and agent edits use the same validated mutation and save contract. An edit identifies the page revision it was based on. Stale changes must be detected and surfaced for reconciliation, rather than silently overwriting intervening edits. The exact reconciliation UI and protocol remain implementation decisions.

Support changes to a specific part of a page while preserving unrelated content and meaningful component data. Distinguish a pending edit, a successfully saved edit, and an agent's completed work. Saving page content does not itself authorize agent actions; [interaction authority and delivery](agent-interaction.md) remain separate contracts.

### Ownership and lifecycle

Project source, template definitions, and authoritative page/domain data remain project-owned. Surface provides common runtime, validation coordination, identity, and state-exchange mechanisms; it does not acquire the meaning of project-specific calculations or actions. Saved page data, view state, service metadata, and interaction records have explicit, separate ownership.

Development and build workflows must preserve saved instances when template source changes; incompatibility requires a visible rejection rather than a destructive rewrite. Release and update compatibility must be checked against the declared persisted formats. Installation must keep project data separate from release payloads and service metadata. Unmounting and uninstalling preserve project-owned pages and data under the existing [lifecycle contract](../architecture/lifecycle.md). A migration, if needed, is separately scoped and explicit; no automatic migration policy is adopted here.

## Candidate first slice and acceptance

A project tracker is an illustrative first slice, not a selected implementation plan: editable title and notes, tasks and milestones, and a progress visualization derived from their status. It exercises document content, structured component data, and a visualization together.

The intended user story is:

> I create a tracker with an agent, change a task myself, close it, reopen it, and ask the agent to add a milestone without losing my edit.

Before implementation acceptance, verify that story with isolated data, including a service restart and an agent edit based on an older revision. Check each property above, inspect rendered phone and desktop states, and exercise save failures and conflict recovery under the [automatic visual and interaction gate](../source-workflow.md#uiux-completion-gate). Collect feedback on whether direct editing, save status, and conflict resolution are understandable. Record tested revisions, observations, failures, and limits; no such verification is claimed by this direction document.

## Boundaries and open choices

The current [mounted-page runtime](../architecture/page-runtime.md#compilation-and-browser-state) offers project-owned Svelte source and bounded HMR state retention. That temporary retention is not saved-page persistence or general draft restoration. Existing runtime and authoring contracts remain in force until implementation explicitly extends them.

Storage representation, contract/version encoding, template evolution, component extension interfaces, view-state scopes/defaults, and conflict-reconciliation UX need concrete design and experiments. This direction does not select a database, introduce a universal domain schema, require a schema framework or plugin marketplace, or establish multi-user synchronization or untrusted-code isolation. It also does not authorize installation, release, or data migration work.
