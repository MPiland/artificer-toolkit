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
- 9.3 authenticated shell, navigation, and authored list patterns: complete
- 9.4 frontend data runtime: complete
- 9.5 shared form runtime: complete
- 9.6 spell implementation: complete
- 9.6.1 node-map runtime resolver: complete
- 9.7 background implementation: complete
- 9.8 feat implementation: complete
- 9.8.1 draft/form persistence correction: complete
- 9.9 race implementation: complete
- 9.10 equipment implementation: complete
- 9.11 creature implementation: complete
- 9.12 vehicle implementation: complete
- 9.13 class implementation: complete
- 9.14 character builder: builder choice flow implemented
- 9.15 character sheet: implemented, closeout validation passed
- 9.16 supporting surfaces and final cleanup: implemented, validation in progress

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
- No bandaids. All code should be DRY and use best practices.
- Pass work to sub agents as needed for efficiency and parallel work. Don't abuse sub agents. Use only as necessary when it would increase efficiency.
- Do not blindly agree with my suggestions if they break best practices or don't make sense. Build for efficiency and correctness. Push back critically.

## Storybook MCP Rules

When working on UI components, stories, or design-system-backed props, use the Storybook MCP tools when they are available in the active tool list.

- Query the Storybook component/documentation surface before adding or changing props on shared UI, Mantine-backed wrappers, or story patterns.
- Do not assume component props from memory or naming conventions. Verify them through Storybook MCP documentation, existing stories, or source before using them.
- Use the Storybook MCP story instructions tool when creating or updating stories, if that tool is available.
- If Storybook MCP tools are not available in the current session, fall back to source inspection plus the normal local gates instead of guessing.
- Validate meaningful UI/story changes with the focused Storybook, Playwright, or test commands that cover the touched surface.

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
- 9.3 authenticated shell, navigation, and authored list patterns is complete.
- 9.8.1 draft/form persistence correction is complete.
- 9.9 race implementation is complete.
- 9.10 equipment implementation is complete.
- 9.11 creature implementation is complete.
- 9.12 vehicle implementation is complete.
- 9.13 class implementation is complete.
- 9.14 character builder has the builder choice flow implemented.
- 9.15 character sheet is implemented with closeout validation passed.
- 9.16 supporting surfaces and final cleanup is implemented with validation in progress.

Per-tranche expectations:

- add Storybook for reusable UI
- add Vitest/Testing Library for touched runtime logic
- add Playwright for route and component verification
- pause for review before moving to the next tranche

## Web Folder Organization

Phase 9 frontend code should use stable ownership folders instead of flat catch-all folders.

- `apps/web/src/ui/primitives`: low-level reusable controls such as select, link, spinner, collapse, rich text, and theme toggle.
- `apps/web/src/ui/overlays`: reusable modal, drawer, and overlay infrastructure.
- `apps/web/src/components`: app-level reusable composites and patterns such as authored lists.
- `apps/web/src/forms`: the canonical frontend authoring form platform, including app-form composition, field primitives, node-driven rendering, authoring layout, editor modal shell, validation, and hooks.
- `apps/web/src/domains`: active rebuilt authored domains only.
- `apps/web/src/auth`, `marketing`, `home`, and `shell`: top-level app features or app system areas.
- `apps/web/src/data`: frontend API/query adapters by domain.
- Do not reintroduce `apps/web/src/legacy`; deleted legacy should stay deleted unless a future tranche intentionally rebuilds a replacement.

Prefer colocated `components`, `hooks`, `utils`, `validation`, `stories`, and `tests` folders inside the owning feature or component package. For the form platform, use `apps/web/src/forms` as the canonical home and keep internal folders lowercase. Do not add new Phase 9 form hooks to the global `src/hooks` folder unless they are genuinely app-wide and not owned by a feature.

Deleted legacy pockets such as old global `src/hooks`, `src/store`, `components/Form`, and `src/legacy` must not be recreated as compatibility shims. Future stateful or form-heavy surfaces should be rebuilt intentionally in their owning phase.

Active Phase 9 authored forms are node-driven:

- Shared node maps plus backend node-runtime resolution define authored form `steps -> sections -> nodes`, including visibility, required state, options, hidden clearing, object groups, and array groups.
- Only top-level domain form containers and isolated Storybook/test harnesses should call `useAppForm`.
- Domain forms should stay thin: create the top-level TanStack form, load/save/activate through `apps/apis`, register authoring page state, and render `AuthoringFormLayout` plus a domain adapter created by `createAuthoringFormRenderer`.
- The shared renderer maps resolved nodes directly to real `form.AppField` controls. Domain adapters should only provide default values and item/object factories. Do not add separate resolved-field wrappers, duplicate section shells, generic array/object wrappers, or "just in case" props.
- Array/object group nodes should stay connected to TanStack Form state. Use TanStack field APIs directly in the renderer/editor path; do not create local Zustand draft state or nested local forms.
- `AuthoringEditorModal` is the one fullscreen editor shell for resolved group nodes. Do not create domain-local modal/form resolver stacks.
- Keep `ui/primitives` and `ui/overlays` as the canonical homes for primitive controls and overlay infrastructure. Do not add duplicate wrappers in `components`.
- Authored detail pages are reader/reference surfaces. Direct authored `/:id` routes should render shared `AuthoredDetail` pages, list view actions should navigate to detail, edit actions should navigate to `/edit`, and domain detail pages should use shared detail primitives plus domain-specific presenter mappers rather than authoring-form wrappers.
- Remove the word `runtime` from frontend names unless the name refers to the backend/API node-runtime contract.
- Component files should export React components only. Move helpers, constants, types, factories, and static models to separate non-component files to satisfy Fast Refresh.
- Do not call hooks conditionally, define React components inside React components, pass fake TanStack form/field objects as props, or use `AnyFieldApi`, `any`, `as never`, unused exports, dead code, or compatibility aliases in active form code.

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
- `yarn workspace @artificer-toolkit/web typecheck:app`
- `yarn workspace @artificer-toolkit/web typecheck:stories`
- `yarn workspace @artificer-toolkit/web typecheck:tests`
- `yarn workspace @artificer-toolkit/web typecheck:config`
- `yarn workspace @artificer-toolkit/web typecheck:diagnostics`
- `yarn workspace @artificer-toolkit/web storybook`
- `yarn workspace @artificer-toolkit/web test`
- `yarn workspace @artificer-toolkit/web test:e2e:app`
- `yarn workspace @artificer-toolkit/web test:e2e:storybook`

## Editing Guidance

- Prefer focused edits over broad refactors.
- Do not keep legacy compatibility shims in active code when the replacement route or form path is live.
- If you land architectural or phase-significant changes, update the relevant phase doc in the same change.
- Preserve existing user changes in a dirty worktree unless explicitly asked to revert them.

## TypeScript Quality Rules

- Do not introduce `any` in new or modified active code.
- Prefer `unknown`, generics, discriminated unions, or schema-derived types instead of `any`.
- If an existing legacy file already contains `any`, do not expand it. Quarantine it as legacy or replace it when touching that surface.
- Active Phase 9 code should use focused package imports instead of package root barrels: prefer `@artificer-toolkit/schema/api/...`, `@artificer-toolkit/schema/subjects/...`, `@artificer-toolkit/schema/grants/...`, `@artificer-toolkit/shared/core`, `@artificer-toolkit/shared/maps`, `@artificer-toolkit/shared/authored`, or other narrow subpaths over `@artificer-toolkit/schema` and `@artificer-toolkit/shared`.
- Root `@artificer-toolkit/schema` and `@artificer-toolkit/shared` imports remain compatibility surfaces only. Treat new root-barrel imports in active web/API/functions code as type-graph regressions unless there is a documented reason.
- Keep very large inferred DTOs localized at package boundaries. Prefer explicit exported DTO/input types for app-facing payloads when repeated `z.infer` expansion would spread through web, API, and function layers.
- Do not leave unused variables, unused imports, dead code, commented-out code, or temporary debug logging.
- Treat TypeScript, lint, and test warnings in touched active code as blockers unless they are already documented legacy non-blockers.

## When in Doubt

- Trust the repo docs over memory.
- Trust locked Figma work over stale placeholder frontend code.
- Trust explicit shared contracts over inferred behavior.
