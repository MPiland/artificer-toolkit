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
