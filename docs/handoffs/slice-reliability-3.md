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

## Proposed ledger edits (filled by the slice session)
