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
- 2026-10-14: stop condition hit for the six `ABILITIES` entries only: the Sheet Reference panel reads `ABILITIES[code].description` (long sentence) while the select tooltip showed the short `tooltip`. Integration owner's ruling: keep the long `description`, drop the short tooltip text, so both surfaces show the same sentence. All other entries with both fields have no other `description` reader, so they keep the tooltip text. `SPELLCASTING` (the reference-only entry in `ABILITY_MODIFIER_REFERENCE_OPTIONS`, no other reader) follows the general rule: description is now the old tooltip text.
- 2026-10-14: premise change: the `systemVocabularyOptions.test.ts` skill test asserted `skill.tooltip === 'DEX'`; that data no longer exists, so the assertion is removed and the test only proves the skill description is served.

- 2026-10-14: edits done. 557 code-list entries across 44 `packages/shared/src/domains` files (plus the 7 in `ability.ts`) all carried both fields and none was tooltip-only; each now has the old tooltip text as `description` (ABILITIES keep the long description per the ruling above). `tooltip` removed from `CoreMeta`, `Vocabulary`, `vocabularyDtoSchema`, the source-data content type, the 18 SRD skill rows and `runtimeCopyFieldNames`; `toOptions` reads `description` only; `srdManifest.generated.ts` regenerated; `authoring-schema.md` updated.
- 2026-10-14: red (`local-validation/authoring-19/red-authoring.log`, `red-schema.log`): with production files stashed and shared rebuilt at base, the new code-list resolver test and the schema DTO test fail. Green (`green-schema.log` 661, `green-authoring.log` 77, `green-apis.log` 17, `green-web.log` 194 tests) pass on the changed tree.
- 2026-10-14: base merged (`b2f2a9620`); final hold on the merged tree (`local-validation/authoring-19/summary2.log`): builds green, authoring `nodeRuntime` 77, convex `nodeRuntime.test.ts` 17, web `SystemVocabularyOptionTooltips` + `nodeRuntimeResolver` 10, Turbo typecheck (`typecheck`, `typecheck:tests`, `typecheck:stories`) 17/17, local codegen exit 0 (refreshed `apps/apis/convex/_generated/api.d.ts`, no `tooltip`). Storybook not run (worktree).

## Proposed ledger edits (filled by the slice session)

- AC AUTHORING-19.1: proven by `systemVocabularyOptions.test.ts` (code-list description served by the real resolver, red before fix), `vocabulary-dto.test.ts` (schema carries `description` only, red before fix), the unchanged AUTHORING-18 proofs (`SystemVocabularyOptionTooltips.test.tsx`, web `nodeRuntimeResolver.test.ts`, convex `nodeRuntime.test.ts`) and the grep proof (`\btooltip\b` absent from `packages/shared`, `schema`, `source-data`, `authoring`, `apps/apis/convex` except the generated types refreshed by codegen).
- Copy decision (integration owner): ABILITIES select tooltips now show the long Reference-panel sentence, not the short phrase.
- Main session: reset and reseed local Convex after merge (SRD skill rows lost `tooltip`).
- Contract note: `description` is the single option-description field for vocabulary rows and `CoreMeta` code lists (`docs/architecture/authoring-schema.md`).
