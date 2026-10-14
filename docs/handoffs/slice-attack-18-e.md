# Slice workbook: ATTACK-18 slice E (basic actions offered by facet restrictions; FREE_HAND)

**Status:** DONE (merged `3ebbd4a4c`; closed by the main session 2026-10-14)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

Finish ATTACK-18. A `BASIC_ACTION` document's `restrictions` (carried since slice A, not evaluated) become live: a basic action is offered only to actors that meet its authored facet restrictions, an unmet restriction is refused with `SOURCE_REQUIREMENTS_NOT_MET` through the existing `sourceStateRequirements` check, and a basic action with no restriction is offered to every actor. `FREE_HAND` becomes an authorable predicate, true while either hand is empty; it reads `resolveHandOccupancy` (`packages/shared/src/domains/subjects/core/equipmentHands.ts`, AUTHORING-17). Characters and Creatures both.

Then close ATTACK-18.1: confirm no closed basic-action mechanic code or old path remains (slice D already deleted `USE_BASIC_ACTION`, the catalogue `check` and `mechanics`, `STABILIZE_TARGET`, `BASIC_ACTION_MECHANIC_CODE`); delete anything left. The catalogue stays locked in the SRD and copyable into a homebrew System. Grapple and Shove are ATTACK-7 (slices C and F) and are out of scope here. Add one end-to-end journey that uses an authored basic action, and update `docs/architecture/rules-runtime.md` and the D106 ATTACK-18 addendum in `phase-08-2-decisions.md` ("Slice E built").

Read first: D106 and its ATTACK-18 addendum (slices A–D built notes), D107 (hands) in `docs/handoffs/phase-08-2-decisions.md`; [slice-attack-18-d.md](slice-attack-18-d.md); `docs/architecture/rules-runtime.md`.

## Closes

- Task ATTACK-18.T6; ACs ATTACK-18.1 and ATTACK-18.3. ATTACK-18.2 (behavior unchanged) closes with them if every existing proof stays green.

## File scope

`packages/schema`, `packages/shared` (facets, targeting, hands), `packages/rules-runtime` basic-action offering and restriction evaluation, `packages/source-data` basic actions, `apps/apis/convex/encounters` action choices, the Session Worker's basic-action routing, and their tests. Out of scope: the web action drawer (`apps/web/src/domains/campaigns/vtt/**`), owned by the parallel VTT session. Offering is decided by the server's choice list, so the drawer should need no change; if it does, report it instead of editing.

## Red-first checklist

1. An authored basic action restricted by `FREE_HAND` is not offered to an actor with both hands full and is offered once a hand is free (Character and Creature).
2. Resolving that action with both hands full is refused `SOURCE_REQUIREMENTS_NOT_MET` (room and Convex).
3. A basic action with no restriction is offered to every actor, including one with both hands full.
4. A restriction on another facet (not FREE_HAND) is evaluated by the same check, proving restrictions are generic, not FREE_HAND-only.
5. A homebrew System copy of the SRD catalogue keeps the restrictions and they apply.
6. Journey: an authored basic action offered, resolved, logged with its label and undone in a real room or convex-test Run.
7. A repo search proves no closed basic-action code remains (list the search in the status log).

## Status log

- 2026-10-13: workbook written; session started.
- 2026-10-13: built. Production: `FREE_HAND` facet predicate (schema enum + payload, shared registry), `handFacts` rule input (`characterHandRuleFacts.ts`), `EncounterHolderState.freeHand` from `resolveHandOccupancy`, `encounterBasicActionRestrictionsHold`, descriptor `restrictions`, offer filter in `actionChoiceReads`, worker refusal `refuseUnmetBasicActionRestrictions` (`SOURCE_REQUIREMENTS_NOT_MET`, new domain rejection reason and message).
- Checklist, with logs under `local-validation/attack18e/`:
  1. Offered only with a free hand: Creature in `basicActionRestrictions.test.ts` (Convex) and the rules-runtime test; Character in the rules-runtime test (real sheet via the fact builders) and offered with free hands in Convex. A Character with both hands full is proved in rules-runtime only (the Convex player Character carries no equipment). Red: `RED-rules-runtime-restrictions.log` (module missing) and `RED-convex-restrictions.log` (offer filter and refusal neutered: 3 of 6 failed); green: `GREEN-final.log`.
  2. Refusal `SOURCE_REQUIREMENTS_NOT_MET` with both hands full: Convex test driving the real room worker (red log above shows it resolving without the refusal).
  3. Unrestricted action offered to a full-handed Creature: Convex test (passes red and green by design, it guards the default).
  4. Non-FREE_HAND restriction (`CAN_ACT`): offered, then dropped once the actor is Incapacitated (Convex) and the rules-runtime test.
  5. Homebrew copy: rules-runtime test re-homes Dash to another `gameSystemId` with a restriction; the entry keeps it and it applies. The encounter rules adapter is registered for the SRD System only, so a non-SRD capability does not compile today; the test proves the data path and the Run-System path separately.
  6. Journey: Convex test offers, resolves, logs ("Pull Free" `RESOLVE_ACTION` timeline entry) and undoes (`REVERT_LAST_ACTION`) an authored restricted action.
  7. Closed-code search (`rg` over `apps` and `packages`, excluding `node_modules`, `dist`, `_generated`): `USE_BASIC_ACTION`, `BASIC_ACTION_MECHANIC_CODE`, `STABILIZE_TARGET`, `basicActionMechanic` and `BasicActionMechanic` have no hits in code; `nativeBasicAction` matches only the import of `nativeBasicActionResponse.js` (the authored CHECK response path, not a closed catalogue path). Catalogue `check`/`mechanics`: none in `packages/schema/src/shared/basicActions.ts` or the SRD catalogue (the `check` key at `basicActions.ts:300` is the authored effect's CHECK invocation). Docs still name the removed codes only as history (`phase-08-2-decisions.md` D106 and earlier decisions; `phase-08-2-convex-cutover.md` lines 99 and 225 are stale historical text for the main session to refresh).
- Deviation: the SRD catalogue authors no restrictions, so the Convex tests import restricted copies of Use an Object. `playerControlFixture` gained an optional `loadout` (published Equipment held by the fixture Creatures).
- Validation (`GREEN-final-2.log`): encounter-persistence build and typecheck, session-worker typecheck, 9 unit files (89 tests), Convex `basicActionRestrictions`, `basicActions`, `turnDeathSave` (First Aid) and `actionChoices` (52 tests), worker First Aid room test (11) all green. The first final run (`GREEN-final.log`) caught two regressions of mine: the worker computed holder state for unrestricted actions, which read the actor-action capability definition that the First Aid fixtures do not publish, and the Dodge unit fixture had a Creature snapshot with no payload. Holder state is now read only when an action has restrictions, and the fixture carries `payload: {}`.
- Review round 1 (2026-10-13):
  1. Resolution bypass: every worker path other than `planNativeLiveEncounterAction` is excluded by construction, not guarded. `resolveEncounterActionSource` builds a `BASIC_ACTION` source only from `basicActions` entries the caller read, and `nativeEncounterRules.ts` (`loadSource`) is the only worker caller that reads them. The area (`nativeEncounterAreaRules.ts`: action, answer, removal, legendary resistance), movement-reaction (`nativeEncounterMovement.ts`) and Disarm (`nativeDisarm.ts`) paths call `resolveEncounterActionSource({ ...input, system })` with none, so a basic action id there throws "stale" before any restriction could matter. A point-area command naming a basic action id is also refused `TARGET_UNAVAILABLE` earlier, by the `resolveCheckActionInputDtoSchema` guard. Pinned by `encounterBasicActionRestrictions.test.ts` ("a basic action source exists only where the catalogue entries are read"); it is a characterization test, so it has no red run. A future caller that starts reading `basicActions` must add the check at its own site. The Convex `prepareActionMechanics` path is untouched.
  2. `nativeEncounterRules.ts`: the `!` is replaced by an explicit "Encounter rules input binding mismatch." error.
  3. `encounterHolderDefense.heldItems`: the actor kinds are CHARACTER, CREATURE and CUSTOM (`encounterRunState.ts`), so the `default` is now an explicit `case 'CUSTOM'` (no equipment).
- Known pre-existing, unchanged: `actionChoices.test.ts(76,14)` typecheck error, stale `_generated/api.d.ts`, four session-worker `SessionWorkerEnvironment` literal errors. Local codegen was not run (the backend admin key was not needed for these tests and nothing deploys); the main session's reseed and deploy step covers it.

## Proposed ledger edits (filled by the slice session)

- Task ATTACK-18.T6: DONE.
- AC ATTACK-18.1 (every basic action authored, no closed code): closes. Proof: checklist 7 search plus `basicActions.test.ts` (catalogue offered as authored actions).
- AC ATTACK-18.3 (offered through facet restrictions, `FREE_HAND`): closes. Proof: `basicActionRestrictions.test.ts` (Convex), `encounterBasicActionRestrictions.test.ts` (rules-runtime).
- AC ATTACK-18.2 (behavior unchanged): closes with the above; `basicActions.test.ts`, `turnDeathSave.test.ts`, `encounterBasicActions.test.ts`, the First Aid worker test and `encounterHolderDefense.test.ts` stay green (see `GREEN-final.log`).
- New follow-ups to register if wanted: a Convex-level Character with both hands full (needs equipment on the fixture Character); the encounter rules adapter for non-SRD Systems (homebrew runtime) is outside this slice.
