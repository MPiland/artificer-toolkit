# Phase 9: Frontend Code - Execution Index

## Status: In Progress

## Objective

Implement the complete frontend rebuild against the locked Phase 8 Figma work and the current backend stack. Phase 9 is intentionally incremental: establish the platform and test harness first, then rebuild shells and shared runtime, then rebuild domains and character surfaces, pausing at each checkpoint for Storybook and Playwright review before moving to the next subplan.

## Source of Truth

1. Shared Figma file: [App Design v2](https://www.figma.com/design/go78XTRyvTifjh2HsA14qv/App-Design-v2)
2. [PHASE_8_FIGMA_OVERVIEW.md](PHASE_8_FIGMA_OVERVIEW.md)
3. [PHASE_8_12_FIGMA_CHARACTER_WIZARD_SUBPLAN.md](PHASE_8_12_FIGMA_CHARACTER_WIZARD_SUBPLAN.md)
4. [PHASE_8_13_FIGMA_CHARACTER_SHEET_SUBPLAN.md](PHASE_8_13_FIGMA_CHARACTER_SHEET_SUBPLAN.md)
5. Shared node maps and schema contracts in `packages/shared` and `packages/schema`
6. Older Phase 8 prose only where it still matches the locked Figma file

## Locked Stack and Architecture Rules

- Keep `TanStack Start` as the frontend framework.
- Preserve SSR where it helps:
  - marketing
  - logged-out auth
  - app shell
  - list pages
  - detail/edit shells with first payload
  - character builder shell and first draft payload
  - character sheet shell and first sheet payload
- Keep Mantine, vanilla-extract, and the current CSS layer override model.
- Use the Figma token system for color and theme decisions.
- `apps/apis` is the only product-data transport boundary for `apps/web`.
- REST is the Phase 9 baseline.
- tRPC remains additive, adapter-backed, and incremental.
- `packages/schema` owns frontend-facing transport DTOs.
- `packages/shared` owns node maps and authored model metadata.
- Active Phase 9 code should import schema/shared contracts from focused subpaths, not package root barrels:
  - schema examples: `@artificer-toolkit/schema/api/content`, `@artificer-toolkit/schema/api/characters`, `@artificer-toolkit/schema/subjects/equipment`
  - shared examples: `@artificer-toolkit/shared/core`, `@artificer-toolkit/shared/maps`, `@artificer-toolkit/shared/authored`, `@artificer-toolkit/shared/subjects/authored`
  - root `@artificer-toolkit/schema` and `@artificer-toolkit/shared` imports remain temporary compatibility surfaces and retirement targets
- The frontend should become lighter by deleting web-owned domain logic and using the backend stack correctly.
- Phase 9 authored forms use the draft sidecar persistence model:
  - TanStack Form owns local editor state.
  - `Save Draft` writes JSON to `authored_subject_drafts` through `apps/apis`.
  - `Activate` writes complete normalized domain rows only after node-runtime normalization and strict validation.
  - editing an active record keeps the active normalized version live until activation succeeds.
  - GraphQL remains out of MVP transport.
- Frontend form-platform code lives under `apps/web/src/forms`; reserve `runtime` for backend/API node-runtime contracts only.
- Phase 9 web folders follow the locked taxonomy:
  - `ui/primitives` for low-level reusable controls
  - `ui/overlays` for modal/drawer/overlay infrastructure
  - `components` for reusable app-level composites and patterns
  - `domains` for active rebuilt authored domains only
  - `auth`, `marketing`, `home`, and `shell` for top-level app feature/system areas
  - `data` for frontend API/query adapters
  - `legacy` for quarantined provisional code and old route/domain/form implementations
- Remaining global legacy pockets such as `src/hooks`, `src/store`, and the old `components/Form` monolith are compatibility surfaces only. Do not add new Phase 9 logic there; retire or move them as the dependent legacy routes are replaced.
- Rebuilt authored forms are node-driven:
  - shared node maps plus backend node-runtime responses define `steps -> sections -> nodes`
  - only top-level domain form containers and isolated Storybook/test harnesses should call `useAppForm`
  - domain forms create the top-level TanStack form, load/save/activate through `apps/apis`, register authoring page state, and render `AuthoringFormLayout` plus a domain adapter created by `createAuthoringFormRenderer`
  - the shared renderer maps resolved nodes directly to real `form.AppField` controls, while domain adapters only provide default values and item/object factories
  - `AuthoringEditorModal` is the single fullscreen editor shell for resolved group nodes
  - array/object groups stay connected to TanStack Form state and use TanStack field APIs directly
  - do not add duplicate section shells, resolved-field wrappers, generic array/object wrappers, local nested forms, "just in case" props, compatibility aliases, or domain-local modal/form resolver stacks
  - keep primitive controls in `ui/primitives` and overlays in `ui/overlays`, not duplicate wrappers in `components`
- Authored detail pages are reader/reference surfaces:
  - direct authored `/:id` URLs render shared `AuthoredDetail` pages
  - list view actions navigate to the detail route while explicit edit actions navigate to `/edit`
  - locked/master records are readable and can be duplicated into owned drafts when permissions allow
  - detail pages use domain-specific presenter mappers, not authoring-form wrappers or a fully node-driven renderer
- Fast Refresh and React hooks rules are blockers for active form code: component files export components only, hooks are not conditional, components are not defined inside components, and active code does not use fake TanStack form/field casts, `AnyFieldApi`, `any`, or `as never`.
- Supabase Auth must stay compatible with the hosted free-tier posture unless explicitly changed:
  - do not assume custom SMTP is configured
  - avoid UX that requires high-volume auth email delivery
  - keep email confirmation and password recovery copy resilient when provider delivery is rate-limited or restricted
  - validate auth flows without depending on live email delivery in Playwright or Storybook
- Supabase SSR session cookies are allowed for browser-to-`apps/web` session continuity, but product-data calls from `apps/web` to `apps/apis` must use the shared API adapter and `Authorization` headers.
- Before production launch, run an auth/session security hardening pass that verifies:
  - deployed session cookies use HTTPS-only `Secure` behavior
  - refresh/session token material is `HttpOnly` where supported by the Supabase SSR flow
  - `SameSite` behavior fits the app's auth routes
  - no long-lived token material is stored in `localStorage` or JavaScript-readable ad hoc cookies
  - local development cookie behavior is not mistaken for production posture

## Cross-Cutting Product Rules

- Do not treat the current `apps/web` UI as canonical.
- Do not reintroduce removed builder concepts such as `Species`, a standalone `Selections` screen, generic readiness dashboards, or sheet-first structural editing.
- Builder owns structural character changes.
- Sheet owns play-state interactions.
- Master or seeded records are locked from direct editing in the UI, but remain copyable into owned drafts.
- User-facing copy should avoid backend or schema wording where plain language is available.
- The `AppField` pattern stays, but the old global step store and legacy character hook graph do not.

## Execution Tranches

1. Platform and testing
2. Public shell, auth, and marketing
3. Authenticated shell, navigation, and list patterns
4. Frontend data runtime and API boundary cleanup
5. Shared form platform and node-map sections
6. Authored domains in rollout order
7. Character builder
8. Character sheet
9. Supporting surfaces and final cleanup
10. Incremental tRPC adoption behind the shared transport adapter

## Current Checkpoint

- Phase 9.1 and Phase 9.2 are complete.
- The active web build now runs the rebuilt public marketing page and auth routes from the new public/auth slices.
- Follow-up review fixes are landed for password recovery completion, router-aware test/story wrappers, and scoped Playwright web servers.
- Supabase free-tier auth constraints are now documented as a Phase 9 design constraint.
- Manual Storybook review accepted the public marketing and auth surfaces.
- Phase 9.3 is complete: authenticated shell, navigation, Storybook autodocs, and canonical authored list patterns are accepted for the current checkpoint.
- Phase 9.4 is complete: frontend data runtime, REST-first adapter, SSR query hydration, and provenance/editability contracts are accepted.
- Phase 9.5 is complete: shared TanStack Form platform, node-map sections, Mantine/Tiptap fields, section navigation, nested editor shells, and retained `form.AppField` ergonomics are accepted.
- Phase 9.6 is complete: Spell create/view/edit routes, REST-backed reference data, rebuilt Spell form, reusable full-screen EffectEditor, shared select controls, and authored form page-frame ownership are accepted.
- Phase 9.6.1 is complete: shared node maps now have a trusted `packages/functions` + `apps/apis` runtime resolver path for conditional visibility, requiredness, hidden behavior, data-backed option sources, and relationship filters instead of repeating Spell-style hand-wired reference-data and partial web-local node resolution.
- The 9.6.1 resolver exposes `POST /node-runtime/resolve` and `POST /node-runtime/normalize-values`, keeps relationship-plan execution server-side against a trusted map registry, and lets the web form runtime consume resolved section/node state and options through the Phase 9.4 adapter.
- Phase 9.7 is complete: Background list/form implementation, node-runtime-backed nested editors, locked-master behavior, shared authored-form layout consistency, and corrected Spell runtime alignment are accepted.
- Phase 9.8 is complete: Feat list/form implementation, node-runtime-backed requirements/mechanics, reusable EffectEditor integration, locked-master behavior, route coverage, and folder-organization cleanup are accepted.
- Phase 9.8.1 is complete: authored draft/form persistence now uses the generic `authored_subject_drafts` sidecar for Spell, Background, and Feat, with activation preserving strict normalized saves.
- Phase 9.9 is complete: Race routes, list, base-race form, subrace form, node-runtime metadata, draft sidecar persistence, category-aware filters, and Storybook/app validation are accepted on the Phase 9 stack.
- Phase 9.10 is complete: Equipment routes, list, base equipment form, variant equipment form, node-runtime metadata, draft sidecar persistence, category-aware filters, nested restrictions/modifiers/charges/contents editors, locked-master behavior, and Storybook/app validation are accepted on the Phase 9 stack.
- Phase 9.11 is implemented and ready for PR review: Creature routes, list, category-driven forms, node-runtime metadata, draft sidecar persistence, category-aware filters, nested profile/action editors, locked-master behavior, and Storybook/app validation are on the Phase 9 stack.
- The authoring-form architecture cleanup is now the active form baseline: authored forms use the canonical node-driven `steps -> sections -> nodes` renderer instead of domain-local wrapper stacks.
- Phase 9.x authored detail pages are complete: shared reader-first detail pages now unfreeze direct authored `/:id` routes for spells, backgrounds, feats, races, equipment, creatures, vehicles, and classes while `/edit` remains the authoring surface.
- Phase 9.12 is complete: Vehicle routes, list, shared vehicle form, node-runtime metadata, draft sidecar persistence, category-aware filters, locked-master behavior, and Storybook/app validation are on the Phase 9 stack.
- Phase 9.13 is complete: Class and Subclass are category-driven `CLASS` authored records in one node-driven authoring flow with shared detail routes.
- Phase 9.14 is active with the builder foundation implemented: Character Builder now uses route-loader create/edit pages, a `character_builder_drafts` sidecar, backend resolver view-model data, custom TanStack Form steps, save-draft/finalize flows, and a placeholder `/characters/:id` sheet route for the deferred 9.15 sheet tranche. Remaining work is focused on source-local choice editors for class/background choices and starting equipment.
- Type graph hygiene baseline before focused package imports and split web typecheck gates: web extended diagnostics reported 3,133 files, 5,728,915 symbols, 1,713,185 types, 19,507,870 instantiations, 5,405,784K memory, 86.52s check time, and 90.68s total time while still ending on the documented legacy `src/utils` blockers.
- Web typecheck gates are now split into app/runtime, stories, tests, config/e2e, and diagnostics commands so normal app work does not always instantiate Storybook and test surfaces.
- Type graph hygiene follow-up: the app/runtime gate now passes independently and no longer leaks the legacy `src/utils` graph through the stale web `#utils` alias. Focused app diagnostics reported 2,383 files, 5,562,862 symbols, 1,702,970 types, 19,490,017 instantiations, 5,190,407K memory, 97.08s check time, and 102.28s total time. File count and memory improved, but check time remains heavy and should be revisited during the Character Builder type-shaping pass.
- The new stories/config typecheck gates pass independently. The new tests typecheck gate currently exposes test-fixture drift (auth session mocks, draft-state literals, UUID-shaped mock IDs, and stricter fixture response shapes) and should be cleaned as its own test-hygiene pass instead of blocking app/runtime work.
- Phase 9.11 validation passed `build:schema`, `build:shared`, `build:db`, `build:functions`, `build:apis`, `test:schema`, `test:shared`, focused API authored-content tests, focused Creature web tests, full web unit tests, app Playwright smoke, Storybook build, static Storybook Playwright, and focused Creature Storybook Playwright. `build:web` remains blocked only by documented legacy `src/utils` failures.
- Phase 9.10 validation passed `build:schema`, `build:shared`, `build:functions`, `build:db`, `build:apis`, focused Equipment web tests, full web unit tests, app Playwright smoke, Storybook build, and Storybook Playwright smoke. `build:web` remains blocked only by documented legacy `src/utils` failures.
- Phase 9.8.1 validation passed `build:schema`, `build:db`, `build:functions`, `build:apis`, `test:schema`, focused API draft tests, focused web adapter/domain tests, full web unit tests, and Storybook build. `build:web` remains blocked only by documented legacy `src/utils` failures; `test:db` remains blocked by pre-existing repository expectation drift outside the draft sidecar path.
- Latest 9.8 implementation rebuilt Feat on the accepted stack: REST through `apps/apis`, SSR-aware TanStack Query helpers, shared authored list/form layouts, node-runtime-backed nested editors, reusable EffectEditor, locked-master duplicate-only behavior, and active `/feats` route coverage.
- Latest 9.7 closeout correction backfilled Spell onto the node-runtime resolver path for top-level field options, material-description visibility, and hidden-value clearing while preserving the accepted Figma-aligned Spell form and EffectEditor layout.
- Latest 9.7 authored-form consistency correction extracted shared authored-form layout components so Spell and Background use the same root, header, shell, section, section stack, and footer primitives while keeping their distinct domain flows.
- Phase 9.6 latest correction aligns the isolated Spell form and EffectEditor more closely to the Figma IF/Effects frames, including a no-sidebar `Spell Info` form page, source-aware breadcrumbs, read-only ExternalLink view actions, removal of destructive actions from read-only effect summaries, single-line multiselect overflow, consistent disabled/read-only field coloring, and reusable authored-form page framing.
- Phase 9.6 route correction is landed: `/spells/$spellId` is now a nested layout/data route with an `Outlet`, `/spells/$spellId` view content lives in the index child, and `/spells/$spellId/edit` mounts the dedicated edit child.
- Phase 9.4 landed authored content DTO provenance and permissions, REST response normalization, schema-parsed web adapter, SSR query client injection, and real REST-backed `/spells` list data.
- Full web typecheck is still expected to be constrained by known legacy `src/utils` alias/type failures until the later cleanup/form tranches retire those surfaces.
- 9.5 validation passed shared build/tests, web unit tests, Storybook build, Storybook Playwright, and manual Storybook review. `build:web` remains blocked only by the documented legacy `src/utils` failures.
- 9.6 validation passed `build:schema`, web unit tests, Storybook build, and Storybook Playwright. `build:web` remains blocked only by the documented legacy `src/utils` failures.
- Phase 9.7 Background follows the 9.6.1 node-map runtime resolver correction so Background does not become another hand-wired reference-data or web-local node-condition implementation.
- Phase 9.7 validation passed `build:schema`, `build:shared`, `build:functions`, `build:apis`, web unit tests, app Playwright smoke, Storybook build, and Storybook Playwright smoke. `build:web` remains blocked only by the documented legacy `src/utils` failures.
- Phase 9.8 validation passed `build:schema`, `build:shared`, `build:functions`, `build:apis`, `test:schema`, shared compiler/node tests, focused Feat web tests, full web unit tests, app Playwright smoke, Storybook build, and Storybook Playwright smoke. `build:web` remains blocked only by the documented legacy `src/utils` failures.
- 9.5 visual follow-up: token/radius tightening is deferred to 9.6 integrated Spell form polish instead of blocking the shared runtime closeout.
- Latest closeout commands passed for 9.4 include `build:schema`, `build:db`, `build:functions`, `build:apis`, `test:schema`, web unit tests, app Playwright smoke, Storybook build, and Storybook Playwright smoke.

## Subplan Index

| # | Subplan | Focus | Status |
|---|---|---|---|
| 9.1 | [PHASE_9_1_FRONTEND_PLATFORM_AND_TESTING_SUBPLAN.md](PHASE_9_1_FRONTEND_PLATFORM_AND_TESTING_SUBPLAN.md) | Toolchain, SSR defaults, Storybook, Playwright, Vitest | Complete |
| 9.2 | [PHASE_9_2_PUBLIC_AUTH_AND_MARKETING_SUBPLAN.md](PHASE_9_2_PUBLIC_AUTH_AND_MARKETING_SUBPLAN.md) | Marketing page, logged-out shell, auth routes | Complete |
| 9.3 | [PHASE_9_3_APP_SHELL_NAV_AND_LIST_PATTERNS_SUBPLAN.md](PHASE_9_3_APP_SHELL_NAV_AND_LIST_PATTERNS_SUBPLAN.md) | Authenticated shell, navigation, canonical list pattern | Complete |
| 9.4 | [PHASE_9_4_FRONTEND_DATA_RUNTIME_SUBPLAN.md](PHASE_9_4_FRONTEND_DATA_RUNTIME_SUBPLAN.md) | REST-first adapter, SSR query hydration, provenance/editability | Complete |
| 9.5 | [PHASE_9_5_SHARED_FORM_RUNTIME_SUBPLAN.md](PHASE_9_5_SHARED_FORM_RUNTIME_SUBPLAN.md) | TanStack Form platform, node-map sections, field composition | Complete |
| 9.6 | [PHASE_9_6_CODE_SPELL_SUBPLAN.md](PHASE_9_6_CODE_SPELL_SUBPLAN.md) | Spell list and form implementation | Complete |
| 9.6.1 | [PHASE_9_6_1_NODE_MAP_RESOLVER_SUBPLAN.md](PHASE_9_6_1_NODE_MAP_RESOLVER_SUBPLAN.md) | Trusted node-map runtime resolver and engine-backed form runtime correction | Complete |
| 9.7 | [PHASE_9_7_CODE_BACKGROUND_SUBPLAN.md](PHASE_9_7_CODE_BACKGROUND_SUBPLAN.md) | Background list and form implementation | Complete |
| 9.8 | [PHASE_9_8_CODE_FEAT_SUBPLAN.md](PHASE_9_8_CODE_FEAT_SUBPLAN.md) | Feat list and form implementation | Complete |
| 9.8.1 | [PHASE_9_8_1_DRAFT_FORM_PERSISTENCE_SUBPLAN.md](PHASE_9_8_1_DRAFT_FORM_PERSISTENCE_SUBPLAN.md) | Draft sidecar persistence and activation correction | Complete |
| 9.9 | [PHASE_9_9_CODE_RACE_SUBPLAN.md](PHASE_9_9_CODE_RACE_SUBPLAN.md) | Race list and form implementation | Complete |
| 9.10 | [PHASE_9_10_CODE_EQUIPMENT_SUBPLAN.md](PHASE_9_10_CODE_EQUIPMENT_SUBPLAN.md) | Equipment list and form implementation | Complete |
| 9.11 | [PHASE_9_11_CODE_CREATURE_SUBPLAN.md](PHASE_9_11_CODE_CREATURE_SUBPLAN.md) | Creature list and form implementation | Implemented - Ready for PR Review |
| 9.x | [PHASE_9_AUTHORED_DETAIL_PAGES_DEFERRED_SUBPLAN.md](PHASE_9_AUTHORED_DETAIL_PAGES_DEFERRED_SUBPLAN.md) | Shared authored detail pages and route unfreeze | Complete |
| 9.12 | [PHASE_9_12_CODE_VEHICLE_SUBPLAN.md](PHASE_9_12_CODE_VEHICLE_SUBPLAN.md) | Vehicle list and form implementation | Complete |
| 9.13 | [PHASE_9_13_CODE_CLASS_SUBPLAN.md](PHASE_9_13_CODE_CLASS_SUBPLAN.md) | Class and subclass authoring implementation | Complete |
| 9.14 | [PHASE_9_14_CHARACTER_BUILDER_SUBPLAN.md](PHASE_9_14_CHARACTER_BUILDER_SUBPLAN.md) | Engine-backed builder implementation | Active - Builder Foundation Implemented |
| 9.15 | [PHASE_9_15_CHARACTER_SHEET_SUBPLAN.md](PHASE_9_15_CHARACTER_SHEET_SUBPLAN.md) | Play-state character sheet implementation | Not Started |
| 9.16 | [PHASE_9_16_SUPPORTING_SURFACES_SUBPLAN.md](PHASE_9_16_SUPPORTING_SURFACES_SUBPLAN.md) | Features, feat grants, systems, cleanup | Not Started |

## Required Review Gate for Every Subplan

No subplan is considered complete until all of the following are true:

- Typecheck and build targets touched by the tranche are green.
- Storybook stories and docs/autodocs exist for every reusable component or shell pattern introduced in the tranche.
- Playwright covers:
  - Storybook component verification for reusable UI
  - app-route verification for real flows
- Vitest plus Testing Library cover touched stores, adapters, and rendering/runtime logic.
- A manual review pause happens in Storybook and Playwright before the next subplan begins.

## Retirement Targets

The following code is provisional and should be retired as Phase 9 cutovers land:

- `apps/web/src/server/domains/*`
- direct product-data imports from `@artificer-toolkit/db`
- direct product-data imports from `@artificer-toolkit/functions`
- legacy Supabase `upsert_*` writes from the web app
- the old monolithic `Form`, `List`, and `Detail` abstractions where they encode outdated product assumptions
- `useDomainForm`, `formStore`, and the old `FormDataType` / `Step` model
- `hooks/characterLogic/*` after builder and sheet cutover
- placeholder landing, home, and stale shell/navigation surfaces

## Superseded Planning Note

- [PHASE_9_3_CODE_SPELL_SUBPLAN.md](PHASE_9_3_CODE_SPELL_SUBPLAN.md) is now archival only and is superseded by [PHASE_9_6_CODE_SPELL_SUBPLAN.md](PHASE_9_6_CODE_SPELL_SUBPLAN.md).

## Exit Criteria

- All Phase 9 subplans have been executed in order or intentionally re-sequenced by an updated index.
- The frontend ships on the new shell, runtime, and transport model.
- Storybook, Playwright, and Vitest are part of the normal frontend review loop.
- The old provisional web architecture is no longer on the active route path.
