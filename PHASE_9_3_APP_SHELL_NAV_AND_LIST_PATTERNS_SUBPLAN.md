# Phase 9.3 - App Shell, Navigation, and Authored List Patterns

## Status: Complete

## Objective

Build the production authenticated shell and the canonical authored-domain list pattern before any domain forms are rebuilt. The Figma spell list is the visual source of truth for non-character domain indexes. `apps/web/src/components/AuthoredList` is the canonical shared authored-list home; the older generic list implementation is isolated under `apps/web/src/legacy/components/List` as salvage reference only.

## Inputs

- [PHASE_9_2_PUBLIC_AUTH_AND_MARKETING_SUBPLAN.md](PHASE_9_2_PUBLIC_AUTH_AND_MARKETING_SUBPLAN.md)
- Figma authenticated shell and spell list screens
- `apps/web/src/shell/*`
- `apps/web/src/components/AuthoredList/*`
- `apps/web/src/legacy/components/List/*`
- `apps/web/src/domains/spells/Spells.tsx`
- `apps/web/src/legacy/routes/_authed/*`

## Locked Decisions

- Start with shell, wrappers, and list views before forms.
- The spell list visual pattern becomes the list pattern for authored content domains and supporting/admin surfaces.
- Authored lists support table and card views: table is the default dense scanning view, while cards support browsing and mobile readability. The switcher uses compact icon actions with tooltips to reduce toolbar noise.
- Character is excluded from the canonical authored-domain list pattern and will receive a separate index/presentation in the character builder and sheet tranches.
- Master or seeded records are visible in lists, locked from direct edit, and copyable.
- Do not infer locked master state from `userId === 'master'`; 9.3 stories and fixtures should use explicit `provenance` and `permissions` fields so 9.4 can wire the transport contract cleanly.
- Use virtualization for authored lists instead of pagination. Lists should render the full filtered set through TanStack Virtual rather than page controls or "show more" pagination.
- Card view is virtualized by rows and is the intended narrow-screen presentation; mobile card actions collapse into a permission-aware `More` menu. Card rows use fixed column slots rather than `auto-fit` stretching so short rows do not become oversized generic cards.
- Do not rebuild the old monolithic `List` component. Reuse behavior ideas, not the old implementation shape.
- Adjust existing component homes before creating new top-level folders. New top-level `src/*` folders are reserved for true feature/page domains, not reusable UI patterns.
- Shared component folders use PascalCase when the folder represents an exported component family, such as `AuthoredList`, `Form`, `Modal`, or `RichTextEditor`.
- Keep legacy list code out of the active authored-list barrel. If old provisional pages still need it during migration, keep it isolated under `src/legacy` until that page is rebuilt.
- The desktop sidebar does not expand in 9.3. Figma shows a compact rail, so desktop navigation stays stable and mobile uses the drawer treatment.
- Prefer Mantine components where they provide accessible behavior, focus management, keyboard interaction, or overlay/control semantics. Keep vanilla-extract and the current CSS layer strategy for product styling.
- Do not show user-facing implementation statuses such as `Queued`, `Next`, or `Later` in the app shell. Active app navigation enables real destinations only; Storybook may show disabled future destinations for review.
- `apps/web/src/Layout` has been retired after the Mantine `AppShell` behavior was carried into the active shell. Do not add new code there.

## Scope

- Authenticated shell:
  - desktop sidebar
  - mobile navigation
  - app header
  - user menu
  - page headers
  - footer action bar pattern
- Canonical authored-domain list pattern:
  - search
  - filters
  - sort
  - loading state
  - empty state
  - error state
  - virtualized long-list behavior
  - table/card view switching
  - list item actions
- Locked-master list behavior:
  - provenance badge
  - view allowed
  - no edit action rendered
  - copy enabled
  - delete hidden
- Representative active route:
  - spells index using fixture data until the 9.4 transport runtime lands

## Out of Scope

- Character index, character builder, and character sheet list patterns
- Final REST/tRPC transport wiring
- Domain forms
- Backend endpoint changes
- Deleting the legacy `src/legacy/components/List` implementation before its routes are no longer active
- Re-exporting legacy list code through the active `components/AuthoredList` entrypoint

## Deliverables

- Reusable authenticated shell components.
- A shell navigation model that supports grouped navigation, active matching, and mobile/desktop reuse.
- A single list-page composition model for spells, backgrounds, feats, races, equipment, creatures, vehicles, classes, features, feat grants, and systems.
- A representative spells list route on the active authed route tree.
- Storybook states for:
  - authenticated shell desktop and mobile
  - page header
  - footer action bar
  - filter/search/sort toolbar
  - loading, empty, and error list states
  - owned row
  - locked-master row
  - card view
  - mobile card action menu
- Storybook autodocs for reusable 9.3 shell and authored-list component families.

## Implementation Plan

1. Replace the placeholder authenticated shell with a token-backed shell that supports desktop and mobile navigation.
2. Replace placeholder navigation with a typed navigation config that only enables live destinations and keeps future destinations out of the user-facing app.
3. Update `/home` so it is a real, light authenticated landing surface rather than a Phase 9.1 checkpoint page.
4. Extract the spell-list visual pattern into `components/AuthoredList` primitives that receive already-shaped display items.
5. Keep search, filter, sort, and list action state at the route/composition layer instead of inside shared row primitives.
6. Add a fixture-backed `/spells` route to validate the shell and list pattern without depending on 9.4 transport work.
7. Add Storybook coverage for the shell and list state matrix.
8. Add focused Vitest coverage for shell rendering, navigation active state, list state rendering, and permission-based actions.
9. Add Playwright coverage for shell navigation and the representative spells list route when the app can run that route cleanly.

## Review Gate

- Authenticated shell is visually approved in Storybook.
- Shared authored-list pattern is visually approved before domain-specific index pages are built.
- The active `/home` and `/spells` routes render on the new shell.
- Locked-master and owned states are demonstrated in Storybook.
- The desktop shell matches the Figma 48px header and compact navigation rail direction, with no expanding sidebar behavior.
- The list pattern matches the Figma Spells list structure in table mode and provides a virtualized card mode for browsing/mobile, with owned edit/delete/duplicate actions and locked-master duplicate-only actions.
- Storybook docs are enabled for the reusable shell/list components through `@storybook/addon-docs` and `tags: ['autodocs']`.
- Build and focused web tests are green.
- Manual Storybook and Playwright review was accepted before Phase 9.4 begins.

## Exit Criteria

- The app has a production-grade authenticated shell ready for domain rollout.
- There is one approved list pattern for non-character authored domains.
- Later domain subplans can focus on domain behavior instead of rebuilding shells and indexes.
- Character remains intentionally deferred to the character-specific tranches.
