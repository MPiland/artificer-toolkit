# Slice workbook: AUTHORING-20 (authors can add an invocation Check and a Check DC)

**Status:** OPEN (started 2026-10-14)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

Regression: `apps/web/src/forms/rendering/authoringNodeDefaultInventory.test.ts` fails on the base tip:

```
"invocation.check -> check",
"check.dc -> checkDc",
"actorRelationshipModule.dc -> checkDc",
```

ATTACK-18 slice D (`b26e108cb`, `e876a5939`) added `CHECK_NODE_MAP` and `CHECK_DC_NODE_MAP` (`packages/shared/src/domains/effects/maps/check.ts`) and reached them from `invocation.ts` (`check`) and from `path.ts` (the actor relationship module's `dc`, "Escape DC"), but registered no default factory for `check` or `checkDc`. An author who clicks Add on those groups gets no valid default row.

Add the two factories following the existing pattern: the kind union and map list in `apps/web/src/forms/rendering/authoringNodeDefaultRegistry.ts`, and the factory cases in `authoringNodeDefaults.ts`, next to `checkChoice`. Build each default from the shared node map and the schema (the DC map's own discriminant and defaults), not from a hand-written shape that can drift. If the shared maps already declare the defaults, read them. If not, find out how the sibling factories (`checkChoice`, `invocation`, `actorRelationshipModule`) build theirs and match that.

Read first: AGENTS.md "Web Folder Organization" (form platform rules: domain adapters provide only default values and item/object factories; no wrappers); `check.ts`, `invocation.ts`, and the `actorRelationshipModule` section of `path.ts`; `authoringNodeDefaults.ts` and `authoringNodeDefaultRegistry.ts`; the schemas for a Check and a Check DC under `packages/schema`.

## Closes

- AC AUTHORING-20.1.

## File scope

`apps/web/src/forms/rendering` (the registry, the defaults and their tests), plus a form test under `apps/web/src/forms/tests`. Change `packages/shared` maps only if a default must be declared there for the factory to read; a schema change is out of scope (escalate).

## Red-first checklist

1. `authoringNodeDefaultInventory.test.ts` is already red on base; record that red log.
2. A unit test for each factory: the `check` default and the `checkDc` default parse with the schema the publication path uses.
3. A form test through the real `FormRenderer` and node-runtime resolver output: on an invocation, Add Check creates a check with a DC row; on an actor relationship module, Add Escape DC creates a valid DC. Both fail before the fix.
4. The inventory test is green.

## Status log

- 2026-10-14: workbook written.
- 2026-10-14: root cause: the registry still carried an `escapeCheckDc` kind (from ATTACK-7 slice B), but no node map has that id any more (the DC map is `checkDc`), so it was dead and the real `checkDc` map had no factory; ATTACK-18 slice D added `check` the same way. Fix in `authoringNodeDefaultRegistry.ts` / `authoringNodeDefaults.ts`: new kinds `check` and `checkDc`, retired `escapeCheckDc`. `checkDc` defaults to `{ kind: 'FIXED', value: 10 }` (the retired factory's value, valid under `checkDcDtoSchema`); `check` composes the existing `checkChoice` default and the new `checkDc` default through the same factory (no duplicate shape). `checks` stays empty on purpose: `checkChoiceDtoSchema` requires at least one allowed check and the factory cannot know vocabulary ids, so the author names one (same as the existing `checkChoice` default).
- 2026-10-14: tests written before the fix: `authoringNodeDefaults.test.ts` (factories vs `checkDtoSchema` / `checkDcDtoSchema`, nodes taken from real resolver output), `forms/tests/CheckAddActions.test.tsx` (real resolver output into the real `FormRenderer`, click Add Check / Add Escape DC, read form state), plus the existing inventory test.

- 2026-10-14: base merged (RELIABILITY-5 modifier lengths among others). Hold 1 (`local-validation/authoring-20/`, `summary.log`): builds schema/shared/authoring/rules-runtime/encounter-persistence exit 0; `red.log` (production change stashed in my worktree): 5 tests fail in 3 files (inventory `invocation.check -> check`, `check.dc -> checkDc`, `actorRelationshipModule.dc -> checkDc`; both factory unit tests; both Add-button form tests); stash restored and dropped; `turbo run typecheck typecheck:tests typecheck:stories --filter="[codex/phase-08-2-convex-cutover]"` exit 0. `green.log` of that hold was invalid: I had not rebuilt `packages/source-data`, so its stale dist failed SRD parsing in unrelated suites (GuidedEntryJourneys, AuthoredDomainFieldParity, AuthoredDomainAuthoringLayout, one FormPlatform timeout). Hold 2 (`summary2.log`): source-data build exit 0; `green2.log` 9 files / 291 tests pass (the 3 new files, registry test, FormPlatform, AuthoringFormPlatform, GuidedEntryJourneys, AuthoredDomainFieldParity, AuthoredDomainAuthoringLayout), exit 0.
- Storybook not run (no story touched).

## Proposed ledger edits (filled by the slice session)

- AC AUTHORING-20.1: proven by `authoringNodeDefaultInventory.test.ts` (red on base, green), `authoringNodeDefaults.test.ts` (factories parse with `checkDtoSchema` / `checkDcDtoSchema`) and `forms/tests/CheckAddActions.test.tsx` (Add Check and Add Escape DC through the real `FormRenderer` and resolver output).
