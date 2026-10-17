# Slice workbook: PLATFORM-13.T11 (nativeRoomAdmission lease flake, lazy-schema check)

**Status:** READY_FOR_MERGE (started 2026-10-17)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

Raised by SPELLS-20.T4b2b2: root-cause the `nativeRoomAdmission` lease-renewal flake, and check the two suspected lazy-schema violations (`encounterRuleCommands.ts:121`, `followUpSave.ts:16`). Closes PLATFORM-13.2.

## Flake: root cause

Failure: Tests run 39006755256 (`ci/attack-2-t2`), `test/nativeRoomAdmission.test.ts:403`, "renews the authorization lease with one read per half-lease": `expected 4 to be 3` (the room's read count passed the one renewal the test allows), plus `RoomFailureLog: The room logged 3 failure(s) during this test`: `actor reconcile failed: A room command is already running`, `Scene cache restore failed: Campaign access ended`, and `alarm failed; retrying` from `#closeRoom` (route status 0). None of those can come from the test's own room, which is admitted, has an open socket and an unexpired lease.

Cause: `room()` in this file builds its Durable Object and never calls `trackRoom(stub)`, which every other room fixture does (`liveRoomFixture.ts`) so that `setupRoomTeardown.ts` waits for the room's sockets to close and cancels its alarm after the test. Each earlier test's room therefore kept running its close handling (idle-release alarm, post-commit reconcile, Scene cache restore) into later tests. Two spies are isolate-wide (`--no-isolate`, one workerd isolate): `vi.spyOn(globalThis, 'fetch')` in `room()` and `vi.spyOn(Date, 'now')` in the lease test, which shifts every room's clock 31 s forward. A stray room's fetch hit the current test's mock, was pushed onto the current `routes` and answered from the current `members` (so it was refused as "Campaign access ended"), and its lease, shifted by the clock spy, was due, so its renewal read was counted as this room's. The wait on `reads + 1` then saw 4.

Not reproducible locally in 12 consecutive runs of the file (`local-validation/platform-13-t11/repro-*.log`): the window needs a loaded runner. The evidence is the CI log and the missing teardown, which `roomTeardown.ts` documents as the failure mode of a leaked room.

Fix: `trackRoom(stub)` in `room()`. No retry, timeout or skip.

## Lazy schemas

The rule is in `docs/architecture/transport.md` (Lazy schema construction), enforced by `yarn lint:schemas` (`scripts/lazySchemas.mjs --check`). Before the fix it reported exactly these two sites: `unaffectedActorIdsSchema` (`z.optional(...)` at module scope) and `repeatPerceptionDtoSchema` (`z.object(...)` at module scope). Both are now `lazySchema(() => …)`.

CI does not run `yarn lint`, so the rule had no enforcement. Regression test: `packages/schema/src/__tests__/lazy-schema-lint.test.ts` runs the lint script itself, so the package tests catch a module-private eager schema (`lazy-schemas.test.ts` sees only exported ones). It fails on the base (the two sites above).

## Validation

See the status log.

## Status log

- 2026-10-17: workbook written; fixes committed. Typecheck lane green (platform-13-t11). Light lane: nativeRoomAdmission 15 passed; schema lazy-schema-lint, lazy-schemas, effect-schema-parsing 34 passed.
