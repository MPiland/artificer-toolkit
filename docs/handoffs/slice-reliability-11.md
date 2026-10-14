# Slice workbook: RELIABILITY-11 (Convex infers real types for the senses panel and rule-evaluation speeds)

**Status:** OPEN (started 2026-10-14)
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

## Proposed ledger edits (filled by the slice session)
