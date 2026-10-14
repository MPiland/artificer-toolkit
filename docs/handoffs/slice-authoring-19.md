# Slice workbook: AUTHORING-19 (one option-description field)

**Status:** OPEN (started 2026-10-14)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

AUTHORING-18 (merged `d87cc4d31`) made `description` the option description the authoring selects show in a tooltip. Two `tooltip` fields remain:

1. **System vocabulary rows.** `tooltip` on the vocabulary record (`packages/schema/src/vocabulary/vocabulary.ts:9`, `packages/shared/src/domains/vocabulary/authored/vocabulary.ts:6`, `packages/source-data/src/content.ts:75`) and in the SRD corpus rows (`packages/source-data/src/srd/vocabulary.ts`; the skills' `tooltip` duplicates `governingAbilityDefinitionId`). Nothing reads it.
2. **Shared code-list metadata.** `CoreMeta` (`packages/shared/src/domains/core/core.ts`) carries both `description` and `tooltip`. The authoring resolver merges them (`packages/authoring/src/nodeRuntime/nodeRuntimeService.ts:569`: `option.tooltip ?? option.description`). About 50 files under `packages/shared/src/domains/**/core` and `**/authored` declare `tooltip` values.

End state: one field, `description`, for option and vocabulary copy. `toOptions` reads `description` only. `tooltip` is gone from `CoreMeta`, the vocabulary record, the schema, the source-data content type, the SRD corpus rows and the manifest. Also remove it from `runtimeCopyFieldNames` in `apps/web/src/data/nodeRuntime/queries.ts` once nothing sends it.

For code-list entries:

- An entry with only `tooltip`: its text moves to `description`.
- An entry with both: first find every reader of `CoreMeta.description` outside the resolver (detail pages, the Sheet, the Worker, rules text).
  - If no other surface reads it, keep the text authors see today. That is the `tooltip`, because the resolver prefers it.
  - If another surface reads `description` and shows different copy than the option tooltip, stop and report the entries and the readers. That is a user-visible copy decision.
- The `encounterActionChoices.ts:30` JSDoc and the web `Actions.tsx` style key are unrelated uses of the word; leave them.

Pre-launch rule: no shim, no fallback. The main session resets and reseeds local Convex after merge (corpus rows change). Regenerate the SRD manifest if your change alters it.

Read first: AUTHORING-18's workbook ([slice-authoring-18.md](slice-authoring-18.md)); `nodeRuntimeService.ts` `toOptions`; `core.ts`; the vocabulary schema and SRD vocabulary; `packages/authoring/src/nodeRuntime/systemVocabularyOptions.test.ts`; `apps/web/src/forms/tests/SystemVocabularyOptionTooltips.test.tsx`.

## Closes

- AC AUTHORING-19.1.

## File scope

`packages/shared` (code-list metadata and vocabulary types), `packages/schema/src/vocabulary`, `packages/source-data` (content type, SRD vocabulary rows, manifest), `packages/authoring/src/nodeRuntime`, `apps/web/src/data/nodeRuntime/queries.ts`, and the tests that name `tooltip`. Do not touch `apps/apis` beyond what codegen produces. If a Convex validator names `tooltip`, update it and run codegen under the lock.

## Red-first checklist

1. Resolver: a test in `systemVocabularyOptions.test.ts` (or the nearest resolver test) fails on base because the resolver still reads `tooltip`. For example, a code-list option whose description alone comes through.
2. Schema: a vocabulary record carrying `tooltip` is refused (strict object), or the field is absent from the parsed type; follow the schema's existing strictness.
3. Grep proof: `rg -n "\btooltip\b" packages/shared packages/schema packages/source-data packages/authoring` returns only the unrelated uses listed above.
4. Journey: `SystemVocabularyOptionTooltips.test.tsx` passes unchanged, and so do the AUTHORING-18 proofs.
5. Publication and the authoring resolver tests pass unchanged (`packages/authoring`, `apps/apis/convex/authoring/nodeRuntime.test.ts`).

## Status log

- 2026-10-14: workbook written.

## Proposed ledger edits (filled by the slice session)
