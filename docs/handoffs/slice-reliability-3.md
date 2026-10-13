# Slice workbook: RELIABILITY-3 (a retried movement decision replays every message its sender was sent)

**Status:** OPEN (started 2026-10-13)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

When a movement decision answer or a GM void commits, the room sends its sender two messages live: the Scene `COMMAND_COMMITTED` and the Encounter result. `#commitRoomGeometry` in `apps/session-worker/src/nativeLiveSessionRoom.ts` stores only the ENCOUNTER receipt, so a retried command (same idempotency key) replays the Encounter result through `replayRoomEncounterCommand` (`roomEncounterCommands.ts`) and omits the Scene receipt. Nothing leaks today; the Scene catches up through state sync. Make a retry replay both messages, each projected for the current viewer exactly as live projects it.

Read first: the RELIABILITY-3 ledger entry and its note; the receipt comment near `nativeLiveSessionRoom.ts:3862`; `docs/architecture/live-sessions.md` (receipts and replay); ADR 0034 (per-viewer redaction).

## Closes

- RELIABILITY-3.1 (then RELIABILITY-3 is DONE once the journey is verified).

## File scope

`nativeLiveSessionRoom.ts` (`#commitRoomGeometry` and the two replay call sites near lines 2174 and 2233), `roomEncounterCommands.ts`, the receipt storage they use, and room tests under `apps/session-worker/test`. Out of scope: action planners and basic actions (ATTACK-18 slice E session), sense composition on Scene tokens (VTT_UI-5 session). Those sessions also edit `nativeLiveSessionRoom.ts`; keep your change local to the geometry receipt and replay paths, and merge the base branch before committing.

## Red-first checklist

1. A player retries a movement decision answer with the same key: the replay delivers the Scene receipt and the Encounter result, in the live order, and both equal what live sent that sender (red today: the Scene receipt is missing).
2. A GM void retried the same way replays both messages.
3. Redaction: a replay for a viewer who cannot see a hidden mover gets the same redacted Scene and Encounter projections live would send that viewer, never the GM's.
4. A retry with a different payload under the same key is still refused as today.

This is the journey: run the room test through the real room with real SRD content (fake only platform and data), and record why it is the PBI's journey in the status log.

## Status log

- 2026-10-13: workbook written; session started.
- 2026-10-13: red: `local-validation/reliability-3/red.log` (new `apps/session-worker/test/nativeMovementDecisionReplay.test.ts`: checklist 1-3 fail because the retry replays one message, not two; live already sent two).
- 2026-10-13: fix. `#commitRoomGeometry` stores `[sceneMessage, encounterMessage]` as `receipt_json` when a movement decision settles (a single Scene message otherwise, as before; the journal treats the receipt as opaque). The Encounter command's REPLAY branch parses one message or the array, re-presents the last (Encounter) message through `replayRoomEncounterCommand` unchanged, and sends the stored Scene receipt(s) ahead of it through `replayMessage` (the marking `replayReceipt` already did). A failed Encounter re-presentation sends only `UNAVAILABLE`. No wire-contract change.
- 2026-10-13: green: `green.log` (new file + `nativeMovementPlanning.test.ts` + `nativeLiveSessionRoom.test.ts`, 145 tests). After merging the base (d87c792ba): `green-merged.log` (the same files plus `nativeRoomSquaresScene.test.ts`, 157 tests passed) and `typecheck.log` (`turbo run typecheck --filter="[codex/phase-08-2-convex-cutover]"`, 7 of 7 tasks successful).
- Checklist: 1 (player answer) and 2 (GM void) `red.log` / `green.log`; 3 (hidden mover: the player's live Scene message is `SCENE_VERSION`, the GM's is a `SCENE` delta, the replay equals live and never names the mover token) `red.log` / `green.log`; 4 (changed payload under the same key is refused `INVALID_COMMAND`) passes before and after the fix, so it has no meaningful red: it pins unchanged behavior.
- Journey: `nativeMovementDecisionReplay.test.ts` runs the real room (real SRD content, real planner, journal, per-viewer projection) over a GM walk that raises a reaction decision, then the sender's answer or void, then its retry; only the platform (fetch, dice) is faked.
- Deviations: `movementRoomFixture.ts` gained `hiddenActorIds` (additive; the Scene tokens were hard-coded visible). The Scene replay carries `replayed: true`, the room's convention for Scene retries; the Encounter replay shows the stored result over the Run's current projection. Local Encounter commands keep a single-message receipt.
- Not run: Storybook (no UI change).

## Proposed ledger edits (filled by the slice session)

- RELIABILITY-3.1: status DONE; proof `apps/session-worker/test/nativeMovementDecisionReplay.test.ts` (player answer, GM void, hidden-mover redaction and changed-payload refusal through the real room), `local-validation/reliability-3/{red,green}.log`; `docs/architecture/live-sessions.md` documents the two-message receipt.
- RELIABILITY-3: DONE with RELIABILITY-3.1 (the journey is the same room test).
