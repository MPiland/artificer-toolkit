# Slice workbook: PRIVACY-4 and PLATFORM-13.6 (small bundle)

**Status:** OPEN (started 2026-10-13)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

Two unrelated small PBIs, one commit each.

1. **PRIVACY-4.1.** When a caster drops Concentration outside their turn, the recorded notice names a hidden source only to the GM; players read it without the source's name (D99, D101). Suspected cause, to be confirmed by the red test: `concentrationChosenEnd.ts` (around lines 77–80) builds the notice from `carriedConcentration(ended).label` without checking `sourceHidden`, and stores it as a run-command label. `hideConcentrationSource` in `activeGrantListings.ts` exists for this. Redact by audience at read (the timeline already has per-audience lines, see D103 `ISSUER`/`gmLines`); do not store a pre-redacted copy in place of the true label.
2. **PLATFORM-13.6.** `packages/source-data/src/srd/import.test.ts` › "publishes the SRD basic-action catalogue as System data (Q11)" timed out at 5000 ms in a loaded root-package run (`local-validation/lane3-merge/root-packages.log`); lane 3 hit the same class in r5c and r6, and `781c9529a` fixed only the `cloneAuthoredItem` corpus test. Find the unbounded or repeated work in SRD import preparation and the authored-corpus tests and remove it. Never raise a timeout.

Read first: D99, D101, D103 in `docs/handoffs/phase-08-2-decisions.md`; `docs/architecture/live-sessions.md` (timeline audiences); `781c9529a`.

## Closes

- PRIVACY-4.1 (PRIVACY-4 DONE); PLATFORM-13.6.

## File scope

Concentration end and timeline read code in `apps/apis/convex` and the Session Worker, and their tests; SRD import preparation in `packages/source-data` and its tests. The parallel ATTACK-18 slice E session may edit SRD basic-action entries and their tests in `import.test.ts`; keep your edits to the import preparation's work and merge the base branch before committing.

## Red-first checklist

1. A player reads a Concentration-drop notice for a hidden source without its name; the GM reads the name (red first).
2. A visible source's notice still names it for players.
3. PLATFORM-13.6: profile the slow test (per-step timings in the log), show the repeated or unbounded work, fix it, and prove the test's time drops (before/after numbers). Then one loaded root-package run with no per-test timeout raised, green.

## Status log

- 2026-10-13: workbook written; session started.

## Proposed ledger edits (filled by the slice session)
