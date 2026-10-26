# Slice RELIABILITY-8: one typed authored-form factory, no silent defaults

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

Each AC note in the ledger lists the exact files.

- **RELIABILITY-8.T1** closes ACs RELIABILITY-8.1 and 8.6.
  - Each authored domain declares one typed form config: empty values, to-submit and to-form-values.
  - One generic factory consumes it, typed against the real query result.
  - Delete the per-domain pass-through wrappers, the untyped `toSystemCreateData` and `toEditData`, and the no-op `isSystemResponse`.
  - Guided forms are typed by their domain values. That means no `{} as object`, no per-file readers, no `session.system!`, and one shared summary/option/string-reader set.
- **RELIABILITY-8.T2** (after T1) closes ACs RELIABILITY-8.2 and 8.3.
  - A new item's System and a spell's school come from the route or the author's choice. They never default to `[0]`, and a missing one is an explicit state.
  - An empty label is a validation error, not "Untitled …".
  - Defaults live once, in the empty values.
- **RELIABILITY-8.T3** (after T1) closes ACs RELIABILITY-8.4 and 8.5.
  - Feature and feat selects are typed against their enums. One shared set of charge reset options and helpers serves both editors.
  - Node defaults use `satisfies` against the schema DTOs, and the default invocation is declared once.
- RELIABILITY-8.T4 (AC 8.7, shared web rules) runs in its own session: [slice-reliability-8-t4.md](slice-reliability-8-t4.md).
- RELIABILITY-10 (one state owner, narrow subscriptions) follows T1 in this lane and is out of scope here.

## Log

### T1 (ACs 8.1, 8.6) — 2026-10-24

- AC 8.1: `authoredFormFactories.ts` is now a registry of `defineAuthoredForm(config)` calls, one typed config per domain (context resolver, empty values, to-submit, to-form-values). `authoredFormSessionFactory.ts` is the single narrowing point from router `unknown` data (type predicates, no casts). Per-domain `resolveCreate<X>SystemId` wrappers, `toSystemCreateData`, `toEditData` and `isSystemResponse` are deleted.
- AC 8.6: every Guided screen receives `system` (narrowed once in `GuidedAuthoring`), so `session.system!` and `session.system?.X ?? []` are gone. Shared `EMPTY_GUIDED_FORM_VALUES`, `readString`, `toSelectOption` (`guidedValues.ts`) and `GuidedSummaryRow` replace the per-domain copies.
- Deviation from the AC wording: the layout form is one `object`-typed `useAppForm` shared by all domains and the Character Builder, so a domain-typed `withForm` is not possible without changing that seam. `defaultValues` is a single named `EMPTY_GUIDED_FORM_VALUES: object` and domain values are read through typed readers instead of `{} as object` casts.
- Test premise change: the "resolves create system ids" test asserted the deleted `resolveCreate<X>SystemId` wrappers. It is replaced by two tests that assert the same behavior through the real `createSession` (system chosen from the available systems; missing system reported). Added `readString` and `toSelectOption` cases to `guidedValues.test.ts`.

### T2 (ACs 8.2, 8.3) — 2026-10-24

- AC 8.2: the create loader resolves the System from the route or a `?system=` search param (`resolveCreateSystemId`); it never takes `[0]`. With no choice the session has `systemRequired` and `AuthoringLayout` and the Character Builder show `SystemChoiceAlert` (a System picker that sets `?system=`). A spell's school is an author-chosen `SelectField` in Guided (Continue is gated on it); `normalizeSpellForSubmit` no longer injects a fallback school.
- AC 8.3: the domain normalisers no longer substitute "Untitled X" or `'DRAFT'`. A blank label fails the form's own validation at submit, and a draft save with a blank label sets the same field error instead of saving. Defaults live once in the empty values. The character equipment currency select ignores a cleared value rather than writing `''`.
- Test premise changes: the "Untitled X" normaliser assertions in `domains/*/tests/` now expect `''` (the old behavior is retired, not weakened). The fallback-school spell test is removed with the fallback. Create-session tests now assert the system comes from the loader's resolved `system`.
- Not changed, by judgment: social `campaignFormat ?? 'ONGOING'` (a display default before a Campaign is chosen), `weekday ?? 'Recurring'` (label text only), and the identity placeholders `'pending-character'` and `'server-owned'` in `createFallbackCharacterFormValues` (neither is a System or school; the live form is always built from the server draft). The `'pending-system'` placeholder was removed in the review round below.

### T3 (ACs 8.4, 8.5) — 2026-10-24

- AC 8.4: `GuidedChargeFields` and `guidedCharge.ts` (reset options, `createCharge`, `isSimpleCharge`) are the one limited-uses editor for features and feats. The usage and reset selects are typed against their enums with `allowDeselect={false}` and `findOption` narrowing; no casts or `'TRAIT'`/`'LONG_REST'` fallbacks (new features are created with `section: 'TRAIT'`).
- AC 8.5: `createDefaultInvocation()` is declared once in `authoringNodeDefaults.ts` and used by the invocation, manifest-behavior and default-effect cases.

### Review round — 2026-10-24

- AC 8.2: `createFallbackCharacterFormValues(systemId)` has no default System. `EMPTY_CHARACTER_FORM_VALUES` (empty `systemId`) is the type carrier for `withForm({ defaultValues })`; the empty id is the same explicit "no System" state as the other authored forms. `stepNavigation` has no `?? 'REVIEW'` left.
- AC 8.3: tests cover the blank-label draft save (`AuthoringLayout.test.tsx`) and the blank-label save and activate rejection through the real layout (`AuthoredDomainAuthoringLayout.test.tsx`).
- ACs 8.2/8.4: tests added for `SystemChoiceAlert` (picker sets `?system=`), spell Continue gated on school, `manualCurrency` (cleared select ignored), `guidedCharge` and `GuidedChargeFields`.
- AC 8.5: node defaults are typed against their schema DTOs with `satisfies`; `authoringNodeDefaults.ts` has no cast allowance left in `scripts/doubleCasts.mjs`.
- AC 8.6: the layout form stays `object`-typed; see the T1 deviation note. A domain-generic `useAppForm` was assessed as a 35-50 file change with TS2589 risk.

### AC 8.6 follow-up — 2026-10-24

- The layout form stays one `object`-typed form (shared with the Character Builder); a domain-generic `useAppForm` was assessed as a 35-50 file change. Guided screens are typed by their domain's form values at one boundary in `guidedValues.ts`: `readGuidedValues(domain, values)` returns `Partial` of the registry's `toFormValues` result, and `guidedField(domain, key, ...nested)` checks the top-level key against the same type.
- Gone: the per-screen `read<Domain>Values`/`readFeatures`/`readDetails` readers and `isRecord` re-parsing, every `toTypedAuthoringFieldName<object>(undefined, ...)` in the Guided screens, `readField`, and the two-argument `readString`. Shared and tolerant of malformed invalid-draft rows: `toFeatures`, `toDetails`, `readString`, `toSelectOption`, `GuidedSummaryRow`.
- Single narrowing point: the type predicate in `isGuidedValues` (no cast). It relies on the layout form being created from the same domain's `toFormValues`. Its JSDoc states it is an unchecked narrowing; QUALITY-7 removes it. Tests: `GuidedClassAuthoring.test.tsx` (preserved advanced grants) and `GuidedBackgroundAuthoring.test.tsx` (starting-gear rows and the preserved-choices alert).
- `EMPTY_GUIDED_FORM_VALUES` is an un-annotated `{}` type carrier for `withForm`; no `{} as object`.
- Retired with the readers: the class `proficiencies` grant-kind filter and the background `startingEquipment` shape check (the values are the domain's typed form values).
- Deleted unused node defaults `creatureAction`, `creatureLairProfile`, `creatureLegendaryProfile` (referenced only by their own switch case and registry entry).

## Journey (RELIABILITY-8.T5, 2026-10-25)

- New test in `apps/web/src/forms/tests/AuthoredDomainAuthoringLayout.test.tsx`: "creates an item only after a System is chosen and a label is given (RELIABILITY-8 journey)". It renders the real `AuthoringLayout` for a new equipment item with no System (the System choice shows, empty, with no form), then with the chosen System (as the route loader carries it), submits a blank label (field error, no mutation), then a label (the submitted payload holds the label and the chosen `systemId`). Only Convex is faked.
- The `?system=` navigation itself is covered by `SystemChoiceAlert.test.tsx` and `authoredFormFactories.test.ts`; the static test router does not reload loader data. Register it as `journeyTests`.
