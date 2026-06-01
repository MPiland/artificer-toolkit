# AGENTS

## Purpose

This repository is `artificer-toolkit`, a monorepo for tabletop RPG content authoring, character building, character sheet play surfaces, and supporting campaign/reference workflows.

Agents working here should treat the repo as a long-running salvage-and-modernization effort, not a greenfield project.

## First Reads

Read these before making substantial changes:

1. [PRODUCT.md](/c:/Users/pilan/Desktop/artificer-toolkit/PRODUCT.md)
2. [DESIGN.md](/c:/Users/pilan/Desktop/artificer-toolkit/DESIGN.md)

If working on a specific domain, read the closest owning source, tests, and current product/design docs before editing.

## Workspace Shape

- `apps/web`: TanStack Start frontend
- `apps/apis`: transport layer, REST baseline, incremental tRPC scaffold
- `packages/functions`: server/application services
- `packages/shared`: domain models, node maps, engine logic, authored metadata
- `packages/schema`: transport and validation contracts
- `packages/db`: persistence and repositories

## Core Rules

- Do not treat current frontend code as canonical when newer product, design, or approved Figma guidance exists.
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

## Operating Principles

Keep it simple. Simple is better than complex.
Assume the user is a principal engineer.
Make the smallest maintainable change that solves the actual request.
Prefer existing patterns over new abstractions.
Avoid broad refactors, speculative helpers, and clever architecture unless clearly justified.
Use judgment. Read enough surrounding code to understand the existing pattern, then avoid unnecessary exploration.
Optimize for correctness, speed, judgment, and token efficiency.
Correct the user when appropriate.
Prefer FAANG-level code quality: clear naming, strong types, simple control flow, minimal mutation, focused functions, pure functions/components where practical, and no unnecessary abstraction.

## Context Discipline

Protect context aggressively.

Answer the narrow question first. Inspect the smallest relevant file, symbol, route, component, diff, log, or test output.

Prefer targeted searches, focused file sections, nearby call sites, capped logs, and scoped validation. Avoid running validation commands like `npm run build`, `npm run test`, or `npm run lint` unless absolutely necessary. Use normal scoped commands like `rg`, with a byte cap when needed.

Avoid dumping full files, full logs, unrelated directories, broad repo searches, large diffs, or generated output after the relevant code is found.

Do not byte-cap instruction files, skill files, tool docs, or agent policy files. Read the whole relevant file unless it is unexpectedly huge.

## Command Output

Protect context usage. **Any command with unknown or potentially large output must be scoped and byte-capped.**

Byte-cap unknown or potentially large output. Line caps alone are unsafe because a single line can be huge.

```bash
COMMAND 2>&1 | head -c 4000
COMMAND 2>&1 | tail -c 4000
```

### Good Byte Capping Examples

```bash
rg -n -m 20 'functionName|ComponentName|routeName' src 2>&1 | head -c 200
bash -o pipefail -c 'npm run type-check 2>&1 | tail -c 500'
bash -o pipefail -c 'npm run test 2>&1 | tail -c 2000'
bash -o pipefail -c 'npm run build 2>&1 | tail -c 500'
rg -l "SEARCH_TERM" src 2>&1 | head -c 4000
```

Do not rely on `head -n`, `tail -n`, or `sed -n` as the only cap.

Scope before printing content: list files first, search specific paths, count matches when useful, and avoid reading generated, binary, minified, database, or huge JSON/JSONL files unless required.

Preserve exit codes when needed:

```bash
tmp="$(mktemp)"
COMMAND >"$tmp" 2>&1
status=$?
tail -c 5000 "$tmp"
rm -f "$tmp"
exit "$status"
```

Avoid unbounded `cat`, broad `rg`, `find`, `ls -R`, `git diff`, tests, builds, and `select *`.

If capped output is insufficient, narrow the command before increasing the cap.

## Code Changes

Prefer direct edits with the available patch tool.
Patch the narrow failing path first.
Avoid unrelated cleanup.
Do not add helpers, wrappers, maps, files, abstractions, or validation layers unless they clearly reduce complexity.

## Patterns to Avoid

Avoid single-use abstractions.

Prefer inline types and direct logic when a helper, wrapper, map, or named type is used only once.

Avoid wrapper functions that simply call another function.

## Validation

Match validation to risk.

Skip validation for low-risk changes and say so plainly.
Use the cheapest useful check for risky changes.
Do not run full test suites or full builds unless risk justifies it or the user asks.

## Subagents

Use subagents only when they save context, save time, or materially improve output quality.

For research, review, and exploration tasks, avoid confirmation bias. Do not pass a preferred conclusion. Ask the subagent to investigate, compare, or verify, and require evidence, tradeoffs, uncertainty, and better alternatives.

Prefer subagents for:

- documentation/API checks
- web research
- non-trivial copywriting/content generation

Avoid subagents for trivial work the main agent can finish faster.

When using a subagent, assign a narrow task and require:

- findings
- files inspected
- files changed, if any
- validation run, if any
- risks or uncertainty

You own final judgment and integration.

## Communication

Before editing, state the approach only for non-trivial tasks.

During complex work, keep updates short:

- what was found
- what changed
- what risk remains

After work, summarize:

- what changed
- files touched
- validation run, or why skipped
- remaining risk

Keep summaries short. Do not explain obvious edits.

Oververbosity:low

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

## Web Folder Organization

- `apps/web/src/ui/primitives`: low-level reusable controls such as select, link, spinner, collapse, rich text, and theme toggle.
- `apps/web/src/ui/overlays`: reusable modal, drawer, and overlay infrastructure.
- `apps/web/src/components`: app-level reusable composites and patterns such as authored lists.
- `apps/web/src/forms`: the canonical frontend authoring form platform, including app-form composition, field primitives, node-driven rendering, authoring layout, editor modal shell, validation, and hooks.
- `apps/web/src/domains`: active rebuilt authored domains only.
- `apps/web/src/auth`, `marketing`, `home`, and `shell`: top-level app features or app system areas.
- `apps/web/src/data`: frontend API/query adapters by domain.
- Do not reintroduce `apps/web/src/legacy`; deleted legacy should stay deleted unless a future tranche intentionally rebuilds a replacement.

Prefer colocated `components`, `hooks`, `utils`, `validation`, `stories`, and `tests` folders inside the owning feature or component package. For the form platform, use `apps/web/src/forms` as the canonical home and keep internal folders lowercase. Do not add new form hooks to the global `src/hooks` folder unless they are genuinely app-wide and not owned by a feature.

Deleted legacy pockets such as old global `src/hooks`, `src/store`, `components/Form`, and `src/legacy` must not be recreated as compatibility shims. Future stateful or form-heavy surfaces should be rebuilt intentionally in their owning phase.

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
- `yarn db:reset:remote` (destructive; requires `DATABASE_URL` and `CONFIRM_REMOTE_PUBLIC_SCHEMA_RESET=reset-public-schema`)
- `yarn seed:owner`
- `yarn seed:srd`
- `yarn build:web`
- `yarn build:apis`
- `yarn build:shared`
- `yarn build:schema`
- `yarn build:db`
- `yarn test:web`
- `yarn test:web:browser`
- `yarn test:web:e2e`
- `yarn turbo:test:authoring`
- `yarn turbo:typecheck:web`
- `yarn turbo:affected:test`
- `yarn turbo:affected:typecheck`
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
- `yarn workspace @artificer-toolkit/web test:forms`
- `yarn workspace @artificer-toolkit/web test:authoring`
- `yarn workspace @artificer-toolkit/web test:e2e:app`
- `yarn workspace @artificer-toolkit/web test:e2e:authoring-storybook`
- `yarn workspace @artificer-toolkit/web test:e2e:storybook`

## TypeScript Quality Rules

- Do not introduce `any` in new or modified active code.
- Prefer `unknown`, generics, discriminated unions, or schema-derived types instead of `any`.
- If an existing legacy file already contains `any`, do not expand it. Quarantine it as legacy or replace it when touching that surface.
- Active frontend and API code should use focused package imports instead of package root barrels: prefer `@artificer-toolkit/schema/api/...`, `@artificer-toolkit/schema/subjects/...`, `@artificer-toolkit/schema/grants/...`, `@artificer-toolkit/shared/core`, `@artificer-toolkit/shared/maps`, `@artificer-toolkit/shared/authored`, or other narrow subpaths over `@artificer-toolkit/schema` and `@artificer-toolkit/shared`.
- Root `@artificer-toolkit/schema` and `@artificer-toolkit/shared` imports remain compatibility surfaces only. Treat new root-barrel imports in active web/API/functions code as type-graph regressions unless there is a documented reason.
- Keep very large inferred DTOs localized at package boundaries. Prefer explicit exported DTO/input types for app-facing payloads when repeated `z.infer` expansion would spread through web, API, and function layers.
- Do not leave unused variables, unused imports, dead code, commented-out code, or temporary debug logging.
- Treat TypeScript, lint, and test warnings in touched active code as blockers unless they are already documented legacy non-blockers.

## When in Doubt

- Trust the repo docs over memory.
- Trust locked Figma work over stale placeholder frontend code.
- Trust explicit shared contracts over inferred behavior.
