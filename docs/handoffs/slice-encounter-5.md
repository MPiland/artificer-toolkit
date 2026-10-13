# Slice workbook: ENCOUNTER-5 (three-user Assisted Encounter journey)

**Status:** OPEN (started 2026-10-13)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

No local journey runs an Encounter with three users in Assisted mode with auto-roll on. The only three-user journey is the managed browser spec `apps/web/tests/managed-vtt/managedRemoteVtt.spec.ts`, which needs a cloud deployment and is out of bounds (ADR 0035). Build a local journey: a GM and two players, each controlling their own Character (players drive their own actions), run an Assisted Encounter with auto-roll on from START through at least one full round to COMPLETE. Every member sees the turn order, rolls and results the GM and rules produce, projected for that member.

Follow the existing real-room convex-test pattern (for example `cutoverPrivacy.test.ts` D87, where the GM starts and completes the Encounter in the real room). Use real SRD Characters and Creatures; fake only platform and data. This is not a browser test: the criterion is about the Encounter flow, not what a page shows.

Read first: the ENCOUNTER-5 ledger entry (5.1 note: replaces the original Automatic journey; AUTOMATIC is not reinstated); ADR 0034; ENCOUNTER-2's Assisted-mode decisions in `docs/handoffs/phase-08-2-decisions.md`; the room fixtures used by `cutoverPrivacy.test.ts`.

## Closes

- ENCOUNTER-5.1 and the ENCOUNTER-5 journey.

## File scope

New journey test file(s) under `apps/apis/convex` (or `apps/session-worker/test` if the room fixture lives there) and test fixtures. No production code unless the journey finds a bug; a bug gets a red regression test and is reported in the status log before it is fixed. Out of scope: every file the parallel slices own (basic actions, drawer previews, senses, privacy, Scene lengths).

## Red-first checklist

1. The journey fails before it is wired (record the first red reason).
2. Three members admitted: GM and two players, each player bound to their own Character; a player cannot act for the other's Character.
3. Assisted with auto-roll on: initiative and the turn's attack and damage rolls auto-roll; each member receives the result once, projected for them.
4. At least one full round, then the GM completes the Encounter and all three see it end.

## Status log

- 2026-10-13: workbook written; session started.

## Proposed ledger edits (filled by the slice session)
