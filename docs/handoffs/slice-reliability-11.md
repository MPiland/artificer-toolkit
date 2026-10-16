# Slice workbook: RELIABILITY-11 (Convex infers real types for the senses panel and rule-evaluation speeds)

**Status:** DONE (merged `370210252`; closed by the main session 2026-10-14)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

RELIABILITY-5.T2 (merged `17daa954e`) found that a zod intersection in a Convex-returned DTO makes Convex codegen infer `Array<any>`. T2 fixed the movement `speeds` panel by making it a flat `discriminatedUnion('speedKind')` over a shared shape (`movementSpeedShape` in `packages/schema/src/api/characterSheetPanel.ts`). Two DTOs still have the defect at base:

1. The Sheet senses panel (`senses`, D111): `sensesPanelDtoSchema` in `characterSheetPanel.ts`. It is an intersection of a common object and a `rangeKind` union.
2. The rule-evaluation `movement.speeds` (`packages/schema/src/api/characterRules.ts`, or wherever the evaluation output is defined).

Make both flat discriminated unions, following T2's pattern, so `apps/apis/convex/_generated/api.d.ts` carries their real types. Find any other `Array<any>` or `any` in `api.d.ts` that comes from the same intersection pattern: grep `api.d.ts` for `any`, then trace each to its schema.

- Fix the ones that are this defect.
- List the others in the status log, with their cause.

No behavior change; the parsed values are identical.

Read first: T2's workbook ([slice-reliability-5-t2.md](slice-reliability-5-t2.md), status log); `characterSheetPanel.ts`; `characterRules.ts`; `api.d.ts` at base.

## Closes

- AC RELIABILITY-11.1.

## File scope

`packages/schema/src/api` (the two DTOs, plus any other instance of the same defect), `apps/apis/convex/_generated/api.d.ts` (codegen under the lock), and the tests that consume these DTOs. Consumers change only if a type that used to be `any` now exposes a real type error. Fix it in the consumer and list it in the status log.

## Red-first checklist

1. A type-level proof that fails on base, e.g. a `typecheck:convex`-checked file under `apps/apis/convex` that assigns a `FunctionReturnType` element to the expected DTO type with `expectTypeOf` or a `satisfies`, and fails while the element is `any`. Use the repo's existing type-test pattern if one exists.
2. The schema contract tests for both DTOs pass unchanged.
3. Codegen under the lock: `api.d.ts` no longer has `Array<any>` for these fields.
4. `yarn workspace @artificer-toolkit/apis typecheck:convex` and the Turbo affected typecheck are green.

## Status log

- 2026-10-14: workbook written.
- Premise correction: the rule-evaluation `movement.speeds` is not in `api.d.ts` (no Convex function returns it), and no Convex type was `any` for it. The `speeds: Array<any>` that T2 saw is the encounter stat block (`statBlock.speeds`, a `z.array(z.unknown())`); T2's note was wrong. Nothing to change for the evaluation output.
- Sweep of `api.d.ts` (every `any`, traced to its schema). Fixed, same defect (intersection, mapped to `VAny` by `zodToConvex`):
  - The senses panel row: `sensesPanelDtoSchema` is now a flat `discriminatedUnion('rangeKind')` over a shared `senseRowShape()`.
  - The Sheet adjustment: `characterSheetAdjustmentDtoSchema`, `characterSheetAdjustmentWriteDtoSchema` and the `UPSERT_SHEET_ADJUSTMENT` command DTOs were intersections of common fields with a family union, so every campaign adjustment read and write, and the Sheet command's `adjustment`, were `any`. They are flat unions built by `adjustmentMembers(fields)` / `adjustmentUnion(fields)`, with the common fields spread into every member. Four exported Value/Metadata schemas had no remaining user and were removed.
- Listed, not fixed (cause):
  - `encounterData` `statBlock.speeds: z.array(z.unknown())` — `ZodUnknown`, not an intersection. Typing it needs the stored creature speed shape (a contract decision).
  - Facet `restrictions: any | null` and effect `paths: Array<any>` (BASIC_ACTION) — the same defect, but through many intersections plus recursion in `packages/shared/src/facet.ts` and `effects/path.ts`; a large authoring-DTO refactor.
  - `jsonSchema` JSON values, node-runtime dynamic `values`, `doc` and `entry` — intentional recursive JSON or dynamic values (`z.json`-style).
  - Internal migration functions with no return validator — not a zod defect.
- Red (type proof `apps/apis/convex/generatedApiTypes.test.ts`, `api.d.ts` at base): `local-validation/reliability-11/red-tsc.log`, six `typecheck:convex` errors (each `expectTypeOf(...).not.toBeAny()` failed). Packages rebuilt first (`build.log`). Codegen under the lock (`codegen.log`, exit 0): `api.d.ts` regenerated, the fields carry real types.
- Consumer premise change: the real types exposed one error in `apps/apis/tests/developmentCampaignGmState.ts`. Two spreads, `{ ...hpRequest.adjustment, value: 6 }` and `{ ...input.hp.adjustment, value: 7 }`, took a union-typed adjustment and overwrote `value` with a number, which `any` had hidden (a `SAVING_THROW` `PROFICIENCY_OVERRIDE` takes a proficiency name, not a number). They now build the narrow `HIT_POINTS` / `MAXIMUM_MODIFIER` adjustment. Assertions unchanged.
- Green on the final tree (lock held; released):
  - `green-tsc.log` (before the consumer fix, 2 errors, exit 1) then `green-tsc2.log` apis `tsc -p convex/tsconfig.json` exit 0.
  - `typecheck.log` `turbo run typecheck --filter="[9bab2f37a]"` 10/10, exit 0; `typecheck-web.log` web `typecheck:app` + `typecheck:tests` forced, exit 0.
  - `green-schema.log` schema contract tests (panel, command, adjustment, rules; unchanged) 4 files / 62 tests, exit 0.
  - `green-apis.log` 9 files / 39 tests, exit 0 (`generatedApiTypes`, `sheetAdjustments`, `panels`, `characterMaximumHitPoints`, `playStateConcurrency`, `gmWrites`, campaign `characterSheet`, `liveSessions/state`, `encounters/liveCharacterState`).
  - `oxfmt --check` on the four changed source files: clean.
- Not run: Storybook (cannot start in a worktree). Web runtime tests (the web only consumes the DTO types; `typecheck:app` and `typecheck:tests` cover them and parsed values are unchanged).

## Proposed ledger edits (filled by the slice session)

- Close AC RELIABILITY-11.1 (the senses panel and the Sheet adjustment DTOs are flat unions; `api.d.ts` carries real types). Note: the rule-evaluation `movement.speeds` was never a Convex type, so there was no defect there.
- Register follow-up: type the remaining intersection-built authoring DTOs that reach Convex as `any` (facet `restrictions`, effect `paths` / BASIC_ACTION), and decide the stored creature speed shape for `statBlock.speeds` (`z.unknown()`).
