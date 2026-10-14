# Slice workbook: PRIVACY-4 and PLATFORM-13.6 (small bundle)

**Status:** DONE (merged `6bbbf7f62`; closed by the main session 2026-10-14)
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
- 2026-10-13: PRIVACY-4.1 premise disproved and ruled by the main session (option A): the notice is stored PRIVATE with the true label and `readEncounterTimelinePage` never gives a player a PRIVATE entry, so no player-facing leak exists and `concentrationChosenEnd.ts` needs no change. Added regression tests in `nativeRoomChosenConcentrationEnd.test.ts` for hidden and visible sources: GM reads the name; a subscribed player, the replay of their own command and a fresh connection receive neither the notice nor a hidden source's name. Non-vacuity: widening the player scan to the GM scan in `roomEncounterSessionFeed.ts` turned 3 tests red (`privacy-mutation-red2.log`), reverted; green `privacy-post-merge.log` (17/17). Commit `c75e21cda`.
- 2026-10-13: PLATFORM-13.6 profiled (`profile-before2.log`, CPU profile): the Q11 test prepared all 1,057 subjects plus a 5.6 MB manifest (cold 2.3 s, `import-before.log`) to assert 60 reusable definitions; per subject the document was hashed three times and the manifest re-roundtripped all subjects through JSON and zod. Fixes in `import.ts`: `prepareSrdDefinitions` (definitions alone, used by `prepareSrdImport` and the Q11 test), one canonical string compare plus one hash per document, manifest checksum normalises only definitions, catalogue and content source. Q11 2324 ms → 35 ms; `prepareSrdImport` warm 1.4–1.6 s → 1.2 s; the two other full-import tests 4052 → 2597 ms and 1947 → 1295 ms (`import-after-verbose.log`). Regenerated SRD manifest is byte-identical. No timeout touched. Commit `ed74dea56`.
- 2026-10-13: base merged (clean); post-merge build, `turbo typecheck` for source-data and session-worker, and privacy test green; one loaded root-package run green, 274 files / 2536 tests in 54 s (`root-packages.log`).

## Proposed ledger edits (filled by the slice session)

- PRIVACY-4.1: DONE. Evidence: regression tests in `apps/session-worker/test/nativeRoomChosenConcentrationEnd.test.ts`; no production change (the audit's suspected leak does not exist; the notice is PRIVATE by construction).
- PLATFORM-13.6: DONE. Evidence: `packages/source-data/src/srd/import.ts` and `import.test.ts`; Q11 2324 → 35 ms, root-package run green with no timeout raised.
- Follow-up candidates (not done here): `contentSnapshots.test.ts`, `srdCreatureAttackSweep.test.ts` and the web builder fixtures each call the full `prepareSrdImport()` at module load (about 1.2 s each, per process); not failing today.
