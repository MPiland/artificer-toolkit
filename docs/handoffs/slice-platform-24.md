# Slice PLATFORM-24: paused rule continuations need no signing key

Ledger: `PLATFORM-24` (ACs 24.1, 24.2; task T1). Decision: Q23 in [phase-08-2-decisions.md](phase-08-2-decisions.md#resolved).

## Why

The 2026-10-16 audit found:

- No client ever receives or returns a rule continuation. Clients resolve with `RESOLVE_RULE_OCCURRENCE`.
- Convex never seals or verifies one.
- The cross-service reason ended when the room became the only Encounter writer (ADR 0035).

The HMAC seal still has one job: resume (`resumeRuleGraph`) skips graph validation. The seal is the only proof that a resumed graph came from the compiler. Removal replaces that proof with real validation.

## Scope

1. In `packages/rules-runtime/src/rulesRuntimeService.ts`:
   - Delete `sealContinuation`/`unsealContinuation` and the key parameter.
   - In `resume` and `resumeWithGraph`, run the validation `executeFrozen` runs: capability lookup, `contractVersion` match, `validateCompiledRuleGraph`.
   - Add a test that resumes a tampered graph and expects rejection.
2. Delete:
   - the `seal` field from `packages/schema/src/shared/ruleExecutionProtocol.ts`;
   - `deriveRulesContinuationKey` and `continuationIntegrityKey` in `platformRulesRuntime.ts`;
   - the Worker env field and its call site (`environment.ts`, `nativeRulesRuntime.ts`, `nativeLiveSessionRoom.ts`, and `worker-configuration.d.ts` via its generator);
   - the vitest config keys;
   - all test fixture keys and literal `seal:` fixtures;
   - the `.dev.vars.example` name;
   - the `scripts/validatePreStagingLocal.mjs` secret name.
3. Stored data: cancel paused decisions stored before the change, following the ADR 0033 precedent. Pre-launch, so the field is removed outright rather than widened. The checksum covers the seal, so any stripping must rewrite `pendingSnapshotChecksum` too.
4. Docs:
   - `apps/session-worker/README.md`
   - `apps/apis/README.md`
   - `docs/architecture/live-sessions.md`
   - `docs/architecture/rules-runtime.md`
   - an ADR 0029 amendment
   - a short historical note in the cutover handoff
5. The orchestrator will remove the local env names after merge. Never open or print `.dev.vars` or env values.

## Log

- 2026-10-16: registered.
