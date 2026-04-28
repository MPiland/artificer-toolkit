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
- The frontend should become lighter by deleting web-owned domain logic and using the backend stack correctly.
- Supabase Auth must stay compatible with the hosted free-tier posture unless explicitly changed:
  - do not assume custom SMTP is configured
  - avoid UX that requires high-volume auth email delivery
  - keep email confirmation and password recovery copy resilient when provider delivery is rate-limited or restricted
  - validate auth flows without depending on live email delivery in Playwright or Storybook

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
5. Shared form runtime and node-map sections
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
- Phase 9.4 is the next active tranche: frontend data runtime, REST-first adapter, SSR query hydration, and provenance/editability contracts.
- Latest closeout commands passed for 9.3 include focused authored-list tests, `build:web`, Storybook build, Storybook Playwright smoke, and browser component tests.

## Subplan Index

| # | Subplan | Focus | Status |
|---|---|---|---|
| 9.1 | [PHASE_9_1_FRONTEND_PLATFORM_AND_TESTING_SUBPLAN.md](PHASE_9_1_FRONTEND_PLATFORM_AND_TESTING_SUBPLAN.md) | Toolchain, SSR defaults, Storybook, Playwright, Vitest | Complete |
| 9.2 | [PHASE_9_2_PUBLIC_AUTH_AND_MARKETING_SUBPLAN.md](PHASE_9_2_PUBLIC_AUTH_AND_MARKETING_SUBPLAN.md) | Marketing page, logged-out shell, auth routes | Complete |
| 9.3 | [PHASE_9_3_APP_SHELL_NAV_AND_LIST_PATTERNS_SUBPLAN.md](PHASE_9_3_APP_SHELL_NAV_AND_LIST_PATTERNS_SUBPLAN.md) | Authenticated shell, navigation, canonical list pattern | Complete |
| 9.4 | [PHASE_9_4_FRONTEND_DATA_RUNTIME_SUBPLAN.md](PHASE_9_4_FRONTEND_DATA_RUNTIME_SUBPLAN.md) | REST-first adapter, SSR query hydration, provenance/editability | Next |
| 9.5 | [PHASE_9_5_SHARED_FORM_RUNTIME_SUBPLAN.md](PHASE_9_5_SHARED_FORM_RUNTIME_SUBPLAN.md) | Node-map sections, typed stores, field runtime | Not Started |
| 9.6 | [PHASE_9_6_CODE_SPELL_SUBPLAN.md](PHASE_9_6_CODE_SPELL_SUBPLAN.md) | Spell list and form implementation | Not Started |
| 9.7 | [PHASE_9_7_CODE_BACKGROUND_SUBPLAN.md](PHASE_9_7_CODE_BACKGROUND_SUBPLAN.md) | Background list and form implementation | Not Started |
| 9.8 | [PHASE_9_8_CODE_FEAT_SUBPLAN.md](PHASE_9_8_CODE_FEAT_SUBPLAN.md) | Feat list and form implementation | Not Started |
| 9.9 | [PHASE_9_9_CODE_RACE_SUBPLAN.md](PHASE_9_9_CODE_RACE_SUBPLAN.md) | Race list and form implementation | Not Started |
| 9.10 | [PHASE_9_10_CODE_EQUIPMENT_SUBPLAN.md](PHASE_9_10_CODE_EQUIPMENT_SUBPLAN.md) | Equipment list and form implementation | Not Started |
| 9.11 | [PHASE_9_11_CODE_CREATURE_SUBPLAN.md](PHASE_9_11_CODE_CREATURE_SUBPLAN.md) | Creature list and form implementation | Not Started |
| 9.12 | [PHASE_9_12_CODE_VEHICLE_SUBPLAN.md](PHASE_9_12_CODE_VEHICLE_SUBPLAN.md) | Vehicle list and form implementation | Not Started |
| 9.13 | [PHASE_9_13_CODE_CLASS_SUBPLAN.md](PHASE_9_13_CODE_CLASS_SUBPLAN.md) | Base class and subclass authoring implementation | Not Started |
| 9.14 | [PHASE_9_14_CHARACTER_BUILDER_SUBPLAN.md](PHASE_9_14_CHARACTER_BUILDER_SUBPLAN.md) | Engine-backed builder implementation | Not Started |
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
