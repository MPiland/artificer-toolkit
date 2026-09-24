# Initiative declaration response checkpoint

**Status:** resumed and passing locally on 2026-09-24 (see [Resolution](#resolution)). The earlier stop is recorded below. No acceptance changed. This page is the durable copy of the approved scope and stopped checkpoint. Raw evidence remains under ignored `local-validation/phase82-goal-20260923/do-rules-execution/initiative-declarations/`.

The user approved local implementation and testing (`call_HBBV88caQZPGSp4hPmkMTYRX`) after automatic approval review initially refused a private capture and PLAYER-authorization patch. That review concern is resolved for this **specific** scope. The real continuation-key decision is separate and still unanswered; this approval permits no key export, provisioning, deployment, database reset or new service. Local proof uses fixed fixture keys.

## Approved behavior and boundary

Existing public Encounter behavior carries into the private Session DO turn path: the OWNER may declare for any actor, and a currently assigned PLAYER may answer only the issued declaration for their own Character. START, ADVANCE_TURN, score/order responses and other turn decisions stay OWNER-only. The root receipt identifies the GM who initiated the turn; its resolution history identifies each actual responder, including the PLAYER.

The existing private Worker Encounter and Character capture inputs gain an optional `turnResponse` holding the validated RESOLVE_RULE_OCCURRENCE command. It cannot coexist with movement or Concentration scope. The private TURN_COMMAND capture carries the actual `campaignOwnerUserId` so the Worker does not assume the responder is the owner. These are existing private routes; no client endpoint or new HTTP route is part of the change.

Admission requires current authenticated membership, DO_ACTIVE authority and epoch, matching Campaign/Session/Run, and authority over the issued declaration or exact retained history. The selected actor comes from the issued request or stored response history and must match the PLAYER's current Campaign Character assignment. Revocation blocks replay. Preserve command fingerprint, request ID, occurrence version, correlation ID, actual responder, current Character assignment/System/source versions and the Worker secret boundary. Native and private paths share the same controller rule; no client-supplied owner impersonation is accepted.

The shared turn planner reuses the current declaration source preparation, request generation, compiler and in-memory initiative store. It checks the recreated issued request and selected primary/bonus options, updates only the staged participant, then issues the next declaration or enters existing score handling. Preserve root, policy, round, cohort, outgoing effects and response history. Existing private pending/terminal mutations remain the atomic transaction for occurrence, round, effect, Character and receipt writes.

## Ordered checks and stopped source

All commands used PowerShell in the regular `D:/dev/artificer-toolkit` checkout on `codex/phase-08-2-convex-cutover`, HEAD `989fbfdb437391b0d8ef41814c7ea04fa1ed5d3a`. Work remains uncommitted. The 15 declaration source files are individually hashed in `source-stopped.json`; that manifest's SHA-256 is `B77ACE70DDBA40A476E23495DCB74F189D4BE4CA46B15F13968E2C26595ECFD3`. It excludes later documentation edits and is not a release manifest. The relocation folder retains the complete stopped Git status.

1. `yarn install --immutable` passed after a sandbox Corepack-cache refusal was retried with escalation. `local-validation/phase82-relocation-20260924/install-escalated.log` retains existing peer dependency and optional `unix-dgram` warnings.
2. Formatting used `yarn oxfmt --config local-validation/phase82-goal-20260923/do-rules-execution/action-pending-commit/root-format-config.json --disable-nested-config --ignore-path local-validation/phase82-goal-20260923/do-rules-execution/action-pending-commit/empty.ignore --write <changed paths>`. `format01.log` records the cache refusal; `format02.log` passed before subsequent source corrections.
3. With `$env:GOMAXPROCS='2'`, `yarn turbo run typecheck typecheck:convex --filter=@artificer-toolkit/apis --filter=@artificer-toolkit/session-worker --concurrency=1 --env-mode=loose` failed in `types01.log`: the declaration branch spread the wider `root` union. Changing it to the narrowed `context.root` fixed the runtime package build.
4. The same compiler command in `types02.log` passed the runtime build and Worker check, then failed at the test's unconditional `planned.prepared.root` access. Pending results expose the root through their snapshot context. That test access was corrected; **the final source was not typechecked again**. The pre-existing Turbo Worker output warning remains.
5. Independent read-only authorization/persistence review found missing reliable PLAYER-terminal test coverage. The test now uses two deterministic response orders, with actual actor IDs asserted around fixture Run creation. Its UUID allocation positions are fixture-sensitive and fail explicitly if Run creation changes. The root receipt must identify OWNER; response history must identify the actual responder. Scoped test formatting/lint passed before the final union-access correction; full final formatting/lint was not rerun.
6. `yarn vitest run --config apps/apis/vitest.config.ts apps/apis/convex/encounters/initiativeDeclarations.test.ts -t 'commits private declarations'` failed **2 tests; 8 skipped**, 43.72 seconds total, in `private01.log`. Both response orders report `EncounterConflictError: The declared Character action equipment facts are stale.` at `packages/rules-runtime/src/encounterInitiativeDeclarationCompiler.ts:315`, called by `prepareEncounterTurnInitiative` at line 290 and the Worker planner. The cause is not diagnosed; do not label this a fixture-only failure or loosen the stale-fact guard without evidence.

The user reiterated the stop boundary while the private check was running. The check finished; no subsequent source fix, test, compiler, import check, deployment or feature work ran. The prepared `import-check.mjs` was not executed. All patch verification processes ended. If the user resumes work, diagnose this exact failing declaration path first, then complete the scoped proof. The [living handoff](../../handoffs/phase-08-2-convex-cutover.md) carries the remaining Phase 8.2 work. No R06, R08 or V15 gate is accepted from this checkpoint.

## Resolution

Diagnosis: the Character's only declaration option referenced an **unequipped** dagger. The shared option generator (`options()` in `encounterInitiativeDeclarationCompiler.ts`) offers every compiled action candidate, while `compileEncounterInitiativeDeclaration` requires a weapon action's item in `initiativeActorFacts.equippedItems`, which lists only equipped items. The native parity tests equip every item (`EQUIP_ITEM`) before START; the private test did not. The stale-fact guard was correct and is unchanged.

Fix: the private test now uses the same `equipAllCharacterItems` fixture step as the native controller test (shared test-local helper). Checks, in order, logs under ignored `local-validation/claude-decl/`:

1. `private02.log`: both private response orders pass (2 passed, 8 skipped).
2. `file01.log`: complete `initiativeDeclarations.test.ts` passes, 10/10.
3. `types01.log`: `GOMAXPROCS=2` serial `turbo run typecheck typecheck:convex` for apis and session-worker passes, 10/10 tasks.

Open product question (not changed): the generator still offers unequipped weapon actions that the compiler then refuses as stale. Either the options should exclude them or compilation should accept the candidate's own equipment facts; that choice changes user-visible behavior and awaits a ruling.
