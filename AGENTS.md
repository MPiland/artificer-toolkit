# AGENTS

## Purpose

This repository is `artificer-toolkit`, a monorepo for tabletop RPG content authoring, character building, character sheet play surfaces, and supporting campaign/reference workflows.

Agents working here should treat the repo as a long-running salvage-and-modernization effort, not a greenfield project.

## First Reads

Read these before making substantial changes:

1. [REBUILD_PLAN.md](/c:/Users/pilan/Desktop/artificer-toolkit/REBUILD_PLAN.md)
2. [PHASE_9_CODE_OVERVIEW.md](/c:/Users/pilan/Desktop/artificer-toolkit/PHASE_9_CODE_OVERVIEW.md) for active frontend work
3. [PRODUCT.md](/c:/Users/pilan/Desktop/artificer-toolkit/PRODUCT.md)
4. [DESIGN.md](/c:/Users/pilan/Desktop/artificer-toolkit/DESIGN.md)

If working on a specific phase or domain, read the corresponding phase subplan before editing.

## Current Focus

Current default focus is Phase 9 frontend modernization.

- 9.1 platform/testing: complete
- 9.2 public/auth/marketing: complete
- 9.3 authenticated shell, navigation, and authored list patterns: active

Before starting a new frontend task, confirm the active tranche in [PHASE_9_CODE_OVERVIEW.md](/c:/Users/pilan/Desktop/artificer-toolkit/PHASE_9_CODE_OVERVIEW.md).

## Workspace Shape

- `apps/web`: TanStack Start frontend
- `apps/apis`: transport layer, REST baseline, incremental tRPC scaffold
- `packages/functions`: server/application services
- `packages/shared`: domain models, node maps, engine logic, authored metadata
- `packages/schema`: transport and validation contracts
- `packages/db`: persistence and repositories

## Core Rules

- Do not treat current frontend code as canonical when a newer Phase 8 Figma screen or Phase 9 plan exists.
- `apps/apis` is the only product-data boundary for `apps/web`.
- Do not do full-file rewrites; instead, do surgical updates.
- Use only shared contracts from `packages/schema` and no ad-hoc local shapes.
- If a contract shape is missing, create it in a reusable manner.
- Keep `apps/apis` thin. Reuse `packages/functions`, `packages/shared`, and `packages/schema`.
- Builder owns structural character changes.
- Sheet owns play-state interaction.
- Master or seeded records are locked from direct edit in the UI, but copyable into owned drafts.
- Preserve Mantine, vanilla-extract, TanStack Start, SSR where appropriate, and the existing CSS layer override model.

## Design Context

The default product register is `product`.

Key design principles in [PRODUCT.md](/c:/Users/pilan/Desktop/artificer-toolkit/PRODUCT.md).
Visual system guidance lives in [DESIGN.md](/c:/Users/pilan/Desktop/artificer-toolkit/DESIGN.md).

- Reference both of these whenever doing UI/UX work.

## Frontend Delivery Rules

For current frontend work, follow [PHASE_9_CODE_OVERVIEW.md](/c:/Users/pilan/Desktop/artificer-toolkit/PHASE_9_CODE_OVERVIEW.md) and the active subplan.

Current frontend posture:

- Phase 9 is incremental and gated.
- 9.1 platform/testing is complete.
- 9.2 public/auth/marketing is complete.
- 9.3 authenticated shell, navigation, and authored list patterns is the next active tranche.

Per-tranche expectations:

- add Storybook for reusable UI
- add Vitest/Testing Library for touched runtime logic
- add Playwright for route and component verification
- pause for review before moving to the next tranche

## Commands

Common repo commands:

- `yarn dev`
- `yarn build:web`
- `yarn build:apis`
- `yarn build:shared`
- `yarn build:schema`
- `yarn build:db`
- `yarn test:web`
- `yarn test:web:browser`
- `yarn test:web:e2e`
- `yarn storybook:web`

Web workspace commands:

- `yarn workspace @artificer-toolkit/web generate:routes`
- `yarn workspace @artificer-toolkit/web storybook`
- `yarn workspace @artificer-toolkit/web test`
- `yarn workspace @artificer-toolkit/web test:e2e:app`
- `yarn workspace @artificer-toolkit/web test:e2e:storybook`

## Editing Guidance

- Prefer focused edits over broad refactors.
- Do not delete legacy code until the replacement route or runtime is actually live.
- If you land architectural or phase-significant changes, update the relevant phase doc in the same change.
- Preserve existing user changes in a dirty worktree unless explicitly asked to revert them.

## TypeScript Quality Rules

- Do not introduce `any` in new or modified active code.
- Prefer `unknown`, generics, discriminated unions, or schema-derived types instead of `any`.
- If an existing legacy file already contains `any`, do not expand it. Quarantine it as legacy or replace it when touching that surface.
- Do not leave unused variables, unused imports, dead code, commented-out code, or temporary debug logging.
- Treat TypeScript, lint, and test warnings in touched active code as blockers unless they are already documented legacy non-blockers.

## When in Doubt

- Trust the repo docs over memory.
- Trust locked Figma work over stale placeholder frontend code.
- Trust explicit shared contracts over inferred behavior.
