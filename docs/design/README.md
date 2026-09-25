# Shared UI design

Surface helps a person locate a project/worktree/page, understand whom input will reach, choose delivery deliberately, and distinguish submitted input from completed work. Project pages own domain controls and meaning. Surface owns navigation, recipient controls and contextual comments.

This index assigns each design contract to one canonical document. Implementation and browser acceptance are separate: see [UI evaluations](../evaluations/ui-eval.md) for the required evidence and remaining limits.

| Design contract | Source of truth |
| --- | --- |
| D-01, D-02: hierarchy, routes and navigation states | [Navigation](navigation.md) |
| D-03, D-04: recipient transitions and recovery | [Interactions](interactions.md) |
| D-05, D-06: draft lifetime and results | [Draft ownership and results](interactions.md#d-05-draft-ownership) |
| D-07, D-08: mobile and accessibility | [Accessibility](accessibility.md) |
| D-09: freshness and discovery | [Freshness](interactions.md#d-09-freshness-and-discovery) |

## Design-system ownership

Surface consumes `@decompozr/design-system` for component appearance, control states, icons, typography and layout primitives. Application code owns route identity, recipient and delivery state, domain content, draft lifetime and selection coordinates. Avoid reimplementing package components in local wrappers.

Development uses a linked package. Release verification uses the exact package bytes pinned by `apps/surface/design-system.lock.json`; follow the [source workflow](../source-workflow.md) and [release distribution](../architecture/release-distribution.md) instead of relying on a developer's symlink. Updating or preparing Surface requires checking the provider's latest committed main. Provider changes and Surface browser acceptance remain separate evidence.

`SurfaceShell` composes AppShell, AppHeader, Brand, navigation and Breadcrumbs. Mounted pages retain responsive navigation and page identity. Comments use the package's Switch for Queue/Steer, selection outline, floating composer and side panel. Surface retains delivery semantics and automatic result monitoring.

## Mounted contextual comments

Comments are adopted for ordinary mounted pages under the [interaction requirement](../requirements/agent-interaction.md#mounted-page-contextual-comments-september-24-adoption). Selection, screenshot capture and review surround project content without replacing its form or response schema. Browsing a page does not grant submission credentials.

The comment shell reserves a 44px status row. Its compact connection indicator describes transport availability; it must not imply active model work. An interim acknowledgement remains distinct from a completed reply. Reconnection and reload recover durable status without resending input.

The selection toolbar uses a neutral compact surface, a short tag/ID label followed by parent, capture, comment and clear actions, and 16px icons. Do not fill the bar with the selection accent or concatenate content excerpts into its label. The accent is a thin element outline. Touch controls retain 44px hit areas while the visible toolbar surface stays 32px high; desktop controls are 32px. Full target context remains in the comment record and selector tooltip.

The composer follows the selected element and visible viewport, including keyboard resize and scrolling. It clamps to available space, scrolls its body when needed, and keeps editing/actions reachable. The relevant browser and physical-device gates are in [self-owned E2E](../evaluations/self-e2e.md) and [accessibility](accessibility.md).

The former study page now lives only in `tests/fixtures/comments-app`. It is built separately for component geometry and fixture delivery tests; ordinary mounted-page E2E uses the production build. Historical design iterations and limitations remain in the [element-comments study](../experiments/2026-09-23-element-comments.md) and [mounted integration evidence](../experiments/2026-09-24-mounted-comments.md).
