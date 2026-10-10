# Phase 8.2 Convex cutover handoff

**Status:** active; current state below, older records follow under explicit "Historical" headings.
**Updated:** 2026-10-07.
**Workspace:** regular `D:/dev/artificer-toolkit` checkout on `codex/phase-08-2-convex-cutover`. The detached `.codex/worktrees/phase-08-2-convex-cutover` remains a read-only backup.

## Current state (2026-10-07)

**Latest slice commit:** SPELLS-9 closed (tenth session below), `36cbc764a`.

**Last full validation:** `eca5bbc76`. Every room-routed test now runs on the real Session Worker in local workerd, and the stand-in room fixtures are deleted (see [Room test fixtures](../architecture/live-sessions.md)).

**Combined validation on that tree, all green:**

- lint and format;
- Turbo typecheck, web typecheck and Convex typecheck;
- packages tests;
- session-worker: 365 tests;
- apis: 2122 tests;
- web: 1643 tests;
- local codegen push.

**Product fixes in that commit:**

- The D74 reload and reconcile now run on the room chain.
- The Disarm contributor `reason` key is removed.
- Fixed-outcome authored Character actions are offered, and `rollable` is removed.
- Nested command ID reuse is refused as `COMMAND_ID_REUSED`.
- Join-ticket refusals are typed, and the web client stops reconnecting.

**Done 2026-10-07 (later session):**

- PLATFORM-16 (`bf06db27b`), rescoped to D88: only the Convex `encounterEvidenceRolls` table is removed. `encounterRunCommands` and `encounterRuleReceipts` stay as the Convex-side inbox for Run CREATE and REMOVE_ACTOR departure writes.
- PLATFORM-15 (`8a3d3c410`): the redundant summary `outcome` is removed (user decision). Save results are asserted on the Concentration roll card's `ruleCheck.outcome`.

**Done 2026-10-07 (third session), one commit:**

- PLATFORM-17: the `as CreatureAuthored` casts are gone. The grant, facet and modifier DTOs now mirror the shared authored types (see [data lifecycle](../architecture/data-lifecycle.md)); the spatial damage effect is one builder in `packages/rules-runtime/src/testing`.
- CAMPAIGN-8: Campaign access refusals throw `rejectDomain('CAMPAIGN_NOT_FOUND')`; the deliberate plain-throw exceptions are listed in [live sessions](../architecture/live-sessions.md).
- RELEASE-5: `check:deployed-config` refuses a Worker config whose production or named environment carries `LOCAL_CONTENT_SNAPSHOT_ORIGIN`.
- ROOM-7 (found in validation): chat entries read back in insertion order; the shared insert stamps `createdAt` after the conversation's newest entry.
- The stale PLATFORM-15 `outcome` snapshots are regenerated.
- Local Convex was deployed, reseeded and the SRD audit passes (backup `local-validation/convex-reset/plt17-reseed.before.zip`, a no-op reset; delete once this tree is trusted).
- Ledger: 58/124 PBIs, 280/401 ACs.

**Done 2026-10-07 (fourth session):**

- WSJF ranking below.
- PLATFORM-11 (REL-9): fixture audit found no stand-in room and no copied authorization, rules or route logic. The fixture rules are recorded in [live sessions](../architecture/live-sessions.md); the room-only `GM_ONLY` refusal in `actorReorderCommand.test.ts` is the guard. Ledger 59/124 PBIs, 281/401 ACs.
- PRIVACY-3: `cutoverPrivacy.test.ts` D87 now has the GM reveal (START) and end (COMPLETE) the Encounter in the real room instead of seeding the states; players read only the ACTIVE Run. The Campaign uses MANUAL initiative because Convex test fixtures seed no initiative policy (a non-MANUAL START then fails as a redacted `UNAVAILABLE`; `roomErrorLogs()` shows the cause). PRIVACY feature done; ledger 60/124 PBIs, 281/401 ACs.

**Done 2026-10-07 (fifth session):**

- SHEET-6: SHEET-6.1 reworded with the user's approval to match the approved design. The overview shows the primary Speed (walking, or the player's chosen movement), and the Movement panel opened from it lists every speed. Proofs: `sheetProjectionSpeed.test.ts` (AUTO and EXPLICIT with an extra speed) and the `CharacterSheetView.test.tsx` journey. Ledger 61/124 PBIs, 282/401 ACs.
- PLATFORM-17 follow-up: the web test typecheck had been red since `35222fdad` (CHOSEN grant fixtures lacked `selectionDuplicatePolicy`; the dead creature `createEmptyProficiency` failed the contract and is deleted). Class and Background factories now parse through `proficiencyGrantDtoSchema` in tests.
- `haiku` subagents now resolve to Haiku 5.5 (`ANTHROPIC_DEFAULT_HAIKU_MODEL` in `~/.claude/settings.json`); use them for light mechanical runs.

**Done 2026-10-07 (sixth session):**

- ENCOUNTER-2: ENCOUNTER-2.7 reworded with the user's approval. ADR 0034 Manual mode tracks only, so the dead `manualReminderMode` setting and the MANUAL result `reminder` are removed end to end (schema, runtime, persistence, Worker, Convex snapshot, web settings). Manual action commands now refuse as `ASSISTED_ONLY` (a regression test failed first with a redacted `UNAVAILABLE`). The `developmentLifecycleProof` journey proves the refusal in the real room. Opt-in Manual-mode rules cues are recorded as post-beta in [future enhancements](../roadmap/future-enhancements.md#manual-mode-rules-cues). Ledger 62/124 PBIs, 283/401 ACs.

**Done 2026-10-07 (seventh session):**

- CAMPAIGN-7 (D92): the Campaign owner may assign their own Character, and it plays like any player's for inventory transfers, chat, Encounter control and Sheet visibility. The GM's Character speaks in TABLE through ROLEPLAY; PARTY and its announcements stay players-only (ADR 0013); DIRECT is unchanged. The GM keeps full GM authority. On ownership transfer the incoming owner keeps their Character in play. The GM joins the Party roster only while playing a Character, and Play Character shows for any role with an assigned Character. Proofs: `gmCharacter.test.ts` journey (red first), `nativeCharacterSheet.test.ts`, `CampaignParty.test.tsx`, `CampaignListPage.test.tsx`. Ledger 63/124 PBIs, 284/401 ACs. Next: ATTACK-8.
  **Done 2026-10-07 (eighth session):**

- ATTACK-8 (D93): the Attack action spends the Action once and opens its attack slots (`resources.attackAction`, keyed by `turnSequence`, so a turn start writes nothing). Extra Attack is the authored `ATTACKS_PER_ATTACK_ACTION` value, highest source wins; the `CLASS_*_EXTRA_ATTACK` and Thirsting Blade closed rules are deleted. A filler attack by an actor who can't act still warns. Receipts carry `attackActionTransition`, so undo returns the slot. The drawer shows "Attack N of M" and preselects the last weapon and target. Contract: [rules-runtime](../architecture/rules-runtime.md).
- The `evidenceRolls.test.ts` and `concentration.test.ts` Manual-Run tests, failing since ENCOUNTER-2 (`3f80c6786`), now expect the decided `DOMAIN_REJECTED`/`ASSISTED_ONLY` refusal (commit "Expect the exact Manual-Run refusal", 20/20 passing).
- SPELLS-2 runs in a parallel session in worktree `.claude/worktrees/spells-2` (branch `claude/spells-2-conditions`, [handoff](spells-2-conditions.md)); it records D94. At this handoff it had passed typecheck and codegen and was running the full apis suite before committing. Next session starts by merging that branch here once it is committed (read its final report first); `encounterActionMechanicsPreparation.ts` overlaps slightly and four of its files have CRLF line endings to check.

**Done 2026-10-07 (ninth session):**

- ATTACK-3: journey `encounterJourneys.test.ts` › a player's "Do it anyway" on bendable warnings. The player's companion bites itself (TARGET_DISPOSITION), overrides it, the GM's timeline entry carries `ruleOverrides`, a second Bite warns ACTION_ECONOMY_UNAVAILABLE and writes nothing, the GM undoes, and the next Bite needs no override. A HOSTILE-only Bite is not a compiled attack (`effectActionCompiler` needs `dispositionKind: 'ANY'`), so the warning uses the self-target.
- PLATFORM-5.6: `seedAudit.test.ts` fails the audit for a stale record and for a missing one. The committed `srdManifest.generated.ts` was stale (both `seed.test.ts` tests red on this branch); regenerated with `yarn workspace @artificer-toolkit/apis generate:srd:manifest`.
- PERF-4.1: `encounterActorCap.test.ts` meters Run creation at the cap with `countDatabaseIo` (under a quarter of the 16 MiB and 32,000-document limits).
- Needs-proof audit (user approvals 2026-10-07): proofs linked for SPELLS-3.1, PERF-3.1–3.3, 3.5, 3.6, 3.8, 3.9, 3.12, 4.2, 4.3; PERF-3.13 and PLATFORM-13.1 retired; PERF-3.7, 4.1, 4.3 and PLATFORM-13.4 reworded. Open gaps, each with its ledger note: PLATFORM-13.2, 13.3, 13.4, 14.1, 14.2, 14.3 and PERF-3.4, 3.7, 3.10, 3.11.
- Ledger 66/125 PBIs, 301/407 ACs (counts include the audit edits).

**Done 2026-10-08 (tenth session):**

- SPELLS-2 merged (`a5c8cb3f4`).
- SPELLS-9 slice A (`b13e5fe73`, D95): a holder that is defeated or can't act after a direct action, turn effect or Cleaving loses Concentration with no check. The end is a `CONCENTRATION_END` child receipt with a rules chat entry, and undo reports lost Concentration. Qualified damage defenses are proved for direct and opportunity attacks. Validation: 10 Convex files 100/100, session-worker 371/371, encounter-persistence 56/56, typecheck 13/13.
- SPELLS-9 slice B (`1ae22a765`): opportunity attacks and spatial contacts that defeat or incapacitate the holder (condition or capability-suppressing effect) end it; later contacts in the move roll nothing. A movement contact scans only its batch target (movement reactions are single-target; recorded in D95).
- SPELLS-9 slice C (`5ecdb340a`): GM actor edits and Sheet hit point or condition edits end it; the edit's command id is the receipt parent, and the Sheet write, cleanup and receipt share one stream-version bump. Edits are not undoable.
- SPELLS-9.2 (`36cbc764a`), SPELLS-9 done: Creature holders make the check on every path; `targetCharacter` is nullable. Found and fixed: Creature save proficiency was authored but never compiled, so every Creature save lacked its proficiency bonus; `saveProficiencyBonuses` is now a required pinned rule fact (local Convex reset and reseeded, backup `local-validation/convex-reset/spells92-save-proficiency.before.zip`). Registered SPELLS-10.6: Character Concentration saves ignore condition roll modes.
- Deleted the dead `executeEncounterMovementReactionAction` copy and its helpers from `encounterMovementReactionActionExecution.ts` (the live one is in `encounterMovementReactionExecution.ts`). The user gave standing approval to delete unused code. A repo-wide dead-code sweep runs in a separate session on worktree branch `claude/dead-code-sweep-2026-10` (report: `docs/validation/dead-code-sweep-2026-10.md`); merge it here when it finishes, after reading its report.
- Ledger 68/126 PBIs, 310/420 ACs. Next: SPELLS-3.2.

**Done 2026-10-08 (eleventh session):**

- SPELLS-3 refined: 3.2 became 3.2–3.6, under D96 (dying, death saves and death; slices A–D are listed there).
- SPELLS-3 slice A (`cb0d837bc`), 3.2 and 3.3 DONE. Damage at 0 HP adds death-save failures (two on a crit), massive damage kills, healing from 0 resets the saves, and undo restores them. A dead Character (failures = 3) is skipped, ignores healing and shows Dead; a Sheet HP edit above 0 revives it. The math is in `schema/shared/characterDeathSaves.ts`, because receipt replay needs it too. `deathSaves` is a required play-state field (local Convex reset and reseeded, backup `local-validation/convex-reset/spells3a.before.zip`). Also fixed: a SPELLS-9 `JourneyBase` type error in `encounterJourneys.test.ts`, and the stale SPELLS-9 projection snapshots.
- Dead-code sweep merged (report `docs/validation/dead-code-sweep-2026-10.md`). An independent audit against the backlog found no reachable or needed deletion: of the deleted optional rules, only Shove Aside can be enabled, and it never had a working path (MOVE-2.3, 2.4). The report lists where the removed rule logic can be recovered (`437b2dd15`) for MOVE-2.3/2.4, SPELLS-8, VTT_UI-1.3/2.1 and ENCOUNTER-4. Follow-ups made before merging: the deleted play-state split/merge round-trip test was restored against the live merges, and the dead Morale resolver and stale doc references were removed. Merged tree: gate clean, and the schema, rules-runtime, encounter-persistence, session-worker, web and Convex suites all pass.
- Registered the seven approved 2014 DMG optional-combat variants that had no build work (`08-vtt-optional-combat-coverage.json` lists them as FOUNDATION only): ATTACK-12 Facing, ATTACK-13 Marking, ATTACK-14 Hitting cover, ATTACK-15 Lingering injuries, ATTACK-16 Massive damage (system shock), ENCOUNTER-6 Morale, MOVE-4 Climb onto a larger creature. Each is offered in Campaign settings only once it resolves. Ranked 2026-10-08 (twelfth session); see the variants table below the ranking.
- Ledger 68/133 PBIs, 312/444 ACs. Next: SPELLS-3 slice B (3.4, the turn-start death save), then C (3.5) and D (3.6, which also shows Dead for frozen actors).

**Done 2026-10-08 (fourteenth session):**

- SPELLS-3.7 DONE (D98, `e07973294`): first aid is the SRD basic action "First Aid" (mechanic `STABILIZE_TARGET`; catalogue entries carry a nullable `check`). The helper spends an Action and a DC 10 Wisdom (Medicine) check pauses as a pending occurrence (`basicActionCheck*` in encounter-persistence, `encounterBasicActionCheck.ts`, worker `nativeBasicActionResponse.ts`), answered by roll prompt or auto-roll; success stabilizes. The command's `allyActorId` is now `targetActorId`. Proofs: five journeys in `turnDeathSave.test.ts`, `basicActions.test.ts`, `nativeRoomFirstAidAction.test.ts`. MANUAL Runs already refused every basic action as `ASSISTED_ONLY`.
- REACTION-4.1 reworded with the user's approval (Absorb Elements is not SRD 5.1); REACTION-4.2 registered: a user can author a reaction spell such as Absorb Elements.
- SHEET-7 DONE in a user-run parallel session, merged (`489ae1e96`): Character head checksums are derived at assembly, not stored. Local Convex reset and reseeded after the merge (1120 documents, audit OK).
- `convex deploy` typechecks test files that the Turbo typecheck skips; `turnDeathSave.test.ts` failed it and is fixed (`652d1d9cb`). Verify Convex test typing with `yarn tsc -p convex/tsconfig.json --noEmit` from `apps/apis`.
- SPELLS-5 runs in a user-run parallel session (worktree `.claude/worktrees/spells-5`, branch `codex/spells-5-apply-grant`); merge it here once it reports.
- SPELLS-3.6 DONE, SPELLS-3 DONE with a verified journey (`c9b41939c`): Sheet commands `SET_DEATH_SAVES` and `ROLL_DEATH_SAVE` (server d20, outcome and a GM-visible `DEATH_SAVE` roll card in one write, `characters/sheetDeathSaveRoll.ts`; the room handles it inside a held Run), the vitals tracker `CharacterSheetDeathSaves.tsx`, and `deathSaves` in frozen Encounter actor state. Journey `apps/apis/convex/characters/sheetDeathSaves.test.ts`. Full apis suite 2166 passed; local Convex reset and reseeded (1120 documents, audit OK).
- AUTHORING-16 DONE (D97): ammunition, iron spikes and the healer's kit are single pieces (`arrows.ts`, `crossbow-bolts.ts`, `blowgun-needles.ts`, `sling-bullets.ts`, `iron-spikes.ts`, `healers-kit.ts`; record IDs kept) priced and weighed per piece, and class grants give 20. Builder labels a plural name without "x" (`startingEquipmentChoices.ts`). Proof `packages/source-data/src/srd/itemCounts.test.ts`; manifest regenerated; local Convex reset and reseeded (1120 documents, audit OK). The Builder e2e assertion ("Light Crossbow and 20 Crossbow Bolts", `characterBuilder.spec.ts`) needs the env the pre-staging lifecycle supplies (`verifyCharacterBrowser`), so it runs with `yarn validate:pre-staging:local`, not standalone.
- Fixed a test-harness race in cross-member command-ID reuse: the room sends every member each commit under its command ID, so the test client could settle another member's reused ID with that broadcast (one full-suite failure in `commands.test.ts`). `expectOtherMembersCommandRefusal` (`tests/fixtures/roomRefusals.ts`) completes a socket round trip first; `cleaving.test.ts` now uses the shared refusal helpers instead of local copies. Product clients never share command IDs, so the room is unaffected.
- Registered SPELLS-11 from SPELLS-5: using a single-use item (potion, Antitoxin vial) removes one from the holder's equipment, and GM undo gives it back. SRD items carry no consumption data today. SPELLS-5.2 proves undo returns the Action and removes the grant.
- RULES-1 (1.5, 1.6): explicit kernel proofs in `packages/rules-runtime/src/__tests__/kernelDiceIdentity.test.ts`, on SRD content. The Potion of Healing rolls its authored 2d4 and adds the resolved modifier once; resolved healing with other dice is refused. The Adult Red Dragon Bite rolls, totals and types its piercing and fire parts separately; swapped and duplicate outcome identities are refused. Test-only; no product change.
- Ledger 77/137 PBIs, 321/457 ACs at that point.

**Done 2026-10-09 (fifteenth session):**

- SPELLS-5 slices A–F built in a user-run parallel session, merged (`983ce6ad9`); 5.6 (per-speed-type movement, decided 2026-10-09) and the 5.7 question remain. It adds:
  - active grant listings (`activeGrantListing.ts`) and `activeGrants` on actor DTOs and the Sheet overview;
  - Sheet `END_ACTIVE_EFFECT`, `UPDATE_ACTOR.endActiveEffectId` and `capabilities.endActiveEffects`;
  - an optional, nullable `lifecycle.expiresAtCampaignMinute`, with clock expiry in `campaigns/clockGrantExpiry.ts`;
  - grant carry-over between Runs (`encounters/runGrantCarryOver.ts`);
  - TICKS `anchor: 'HOLDER' | 'SOURCE'`, where SOURCE needs an Encounter origin with a source actor;
  - the `MODIFIER_GRANT` contribution.
- After the merge, local Convex was reset and reseeded (1057 subjects, 60 definitions, audit OK).
  - The first deploy failed: "Loading the pushed modules … Function execution timed out (maximum duration: 4s)". The container was at 93% of its memory limit and had read 329 GB from disk.
  - `docker restart phase82-convex-local-linux` took about 7 minutes to serve again. After that the same source deployed cleanly.
  - If this timeout recurs, check `docker stats` before suspecting the bundle.
- Needs-proof gaps closed (`c11ea6c09`): PERF-3.7, PERF-3.11, PLATFORM-13.4, 14.2 and 14.3. Evidence is in `docs/validation/phase-08-2/needs-proof-audit-2026-10-09.md` and `encounter-persistence/src/__tests__/actorSnapshotRows.test.ts`.
- PERF-3.10 DONE: the stage's stored Run and prepared-decision reads, the player decision list and `useEncounterPendingDecision` skip Convex while the room holds authority. Proofs are in `CampaignVttStage.test.tsx`, `useEncounterPendingDecision.test.tsx` and `CampaignPlayerEncounterDecisions.test.tsx`. The checkpoint-time notice is retired by `live-sessions.md`.
- AUTHORING-12.4 DONE, which completes AUTHORING-12: Sheet overrides (ability, item weight, HP max) leave every authored root, version, payload chunk and compilation unchanged (`sheetAdjustments.test.ts`). Edit Source and Create New were already proved.
- Ledger 79/140 PBIs, 341/483 ACs. SPELLS-5.6 and 5.7 are done (2026-10-09). 5.6: stored `speeds` replace `walkingSpeed`, and a voluntary move may name its `speedId`. 5.7: a Character's Concentration grant carries over to the Campaign clock and ends when its caster starts another Concentration, in the room or at checkpoint via the Run's `concentrationCasterCharacterIds`; mid-Run admission is deferred (D99). The ATTACK-10 and ENCOUNTER-7 branches are merged (7fdd1b675, 7e4f76c74) and the merged tree is green; ENCOUNTER-7 is DONE. A deleted Character's Run actor is removed without reading its effects (e3559734b). SPELLS-5.11 DONE (eeca6d635, D101): the caster ends their own Concentration at any time; Convex ends the caster's and outside holders' grants and the room, under the same command id, ends those an active Run holds, immediately and with no GM approval, writing a GM-only `CONCENTRATION_DROPPED_OUTSIDE` history entry. Concentration has no range condition unless the spell says so. ATTACK-10.1 ruling (being built on `claude/priceless-carson-0bbcd9`): before commit the prompt shows only the mode the attacker believes; on commit the true mode applies, a cancelled die is marked and a missing die is rolled (or prompted in manual play); the player card says generically "the target can sense you" and never names the Sense; the GM sees the specific reason. New PBIs: ATTACK-17 (target from map tokens or the Encounter list, sharing one selection; unseen and hidden creatures are not listed unless the GM reveals them; players can attack a square for the GM to resolve), ENCOUNTER-8 (animated ✕ and new die when the mode changes at commit), ATTACK-10.5 (saves follow the reason rule), SPELLS-5.12 and 5.13 (carried Concentration in later fights; carried grants count down in rounds and completing a Run offers to advance the Campaign clock). Next here: SPELLS-11. SPELLS-12 (more than one Concentration, generic capacity modifier) follows SPELLS-8. Then continue the WSJF ranking: SPELLS-7, ATTACK-10, ATTACK-7. Open needs-proof gaps: PLATFORM-13.2, 13.3, 14.1, PERF-3.4, 3.14.

**Done 2026-10-08 (thirteenth session):**

- SPELLS-3.5 DONE (D96, `faceb847b`): a STABILIZE effect application (`deathSavesAfterStabilize`, `isCharacterDying` in `schema/shared/characterDeathSaves.ts`; folded in `encounterCharacterMechanicsBatch.ts`). The real SRD Healer's Kit compiles to it in `effectActionCompiler.ts`. A target that is not dying is the overridable `TARGET_NOT_DYING` warning and changes nothing. Proved by an ally journey in `turnDeathSave.test.ts`: the kit spends one charge, and undo restores the saves and the charge. Room tests (`nativeRoomStabilizeAction.test.ts`) self-target, because the room fixture holds one Character; its new `characterEquipment` option puts real SRD equipment in the room. With no Scene, touch range is the acknowledged `TARGET_RANGE_UNCHECKED` warning.
- SPELLS-3.5 was split with the user's approval: first aid is SPELLS-3.7 and casting Spare the Dying is SPELLS-8.2. Registered AUTHORING-16 (D97: item names carry no use or bundle counts; ammunition is single pieces priced per piece; no sale unit). Merchant interface added to future enhancements.
- Merged the journey-gap bundle (five journeys verified); its session is archived and its branch deleted. The folder `.claude/worktrees/journey-gaps` may still need deleting once unlocked.
- Proved a user-entered quantity on Sheet inventory add (`CharacterSheetInventory.test.tsx`).
- Ledger 73/136 PBIs, 314/453 ACs. Next: SPELLS-3.7 (first aid as a basic action, DC 10 Wisdom (Medicine); basic actions have no rolls today), then SPELLS-3 slice D (3.6), then AUTHORING-16.

**Done 2026-10-08 (twelfth session):**

- SPELLS-3 slice B, 3.4 DONE (D96): a dying Character's turn starts with a death save, a turn stage after Recharge and before START_OF_TURN effects (`encounterTurnDeathSave.ts`; outcome math `deathSavesAfterRoll` in `schema/shared/characterDeathSaves.ts`; applied through the mechanics batch's `deathSave` input, phase `TURN_DEATH_SAVE`, in `persistEncounterTurnDeathSave`). Prompted to the controller as a D20_EVIDENCE with a `DEATH_SAVE` trigger, or auto-rolled. Every save posts exactly one roll card (commit card unless an app attempt already carded that die). A Character that dies at its own turn start keeps that turn and is skipped afterwards. The `liveCharacterState` D96 journey setup moved to `tests/fixtures/liveCharacterRun.ts`.
- Registered ENCOUNTER-7: Recharge and Legendary dice post no card, and app-rolled action d20s are carded twice.
- WSJF-ranked the seven optional-combat variants (table below the ranking).
- Ledger 68/135 PBIs, 313/449 ACs (RELEASE-7, the alpha tester play guide, registered; written once VTT behavior freezes). Next: SPELLS-3 slice C (3.5, STABILIZE and first aid), then D (3.6).

**Done 2026-10-07 (parallel session, worktree `claude/spells-2-conditions`):**

- SPELLS-2 (D94): conditions apply their mechanics through one authored condition policy (`condition-rule-state` mechanics, evaluated by `encounterConditionMechanics.ts`), with no per-condition code. Mechanics cover attack and save roll modes, save auto-fail, crits against, speed and exhaustion levels, for Characters and Creatures. SPELLS-2.1 was refined into 2.1–2.7. Fixed: the Overrun initiator contributors dropped the condition's holder, and roll-mode reasons named a condition by its rule-state definition label ("Paralyzed rule policy") instead of the condition. The shared apis `fixture()` now seeds the SRD condition rule states, because Encounter reads require a definition for every active condition. `srdManifest.generated.ts` was regenerated. Pre-existing failures were also fixed. CAMPAIGN-7 had dropped the PLAYER-only assignment check without D92's replacement, so `readCampaignAssignedCharacter` now fails closed unless an OWNER membership matches the Campaign's owner (the gmWrites and rolls tests prove it). The archived-Campaign capabilities expectation now lists CAMPAIGN-7's `assignOwnCharacter` and `transferOwnInventory`. The Manual-run concentration and evidence-roll tests assert ENCOUNTER-2's `ASSISTED_ONLY` domain rejection. The conformance snapshot carries the new outcome-rule fact. The Builder catalogue assembly test has an explicit timeout. The 500-definition options ceiling test now fills from the rows already present, because the seeded condition rule states count toward that shared ceiling. Deferred items (Petrified resistance, Exhaustion 4 and 6, the Creature level editor, the auto-fail roll UX, concentration saves under conditions) are registered as SPELLS-10. Proofs and journeys are in the ledger (`actionCommands.test.ts`, `basicActions.test.ts`). Ledger 64/126 PBIs, 291/420 ACs (the counts include ATTACK-8's concurrent registrations).
  **Next work: the WSJF ranking below, top down (ranked 2026-10-07).** WSJF = (user/business value + time criticality + risk reduction or enablement) / job size, Fibonacci scores. A PBI never starts before the PBIs it is marked "after".

| #   | PBI                                     | WSJF | Note                                                                                                                                     |
| --- | --------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | PLATFORM-11                             | 8.0  | Done (fourth session).                                                                                                                   |
| 2   | PRIVACY-3                               | 5.3  | Done (fourth session).                                                                                                                   |
| 3   | SHEET-6                                 | 5.0  | Done (fifth session).                                                                                                                    |
| 4   | ENCOUNTER-2 (2.7)                       | 4.3  | Done (sixth session).                                                                                                                    |
| 5   | CAMPAIGN-7                              | 4.3  | Done (seventh session).                                                                                                                  |
| 6   | ATTACK-8                                | 4.2  | Done (eighth session). ATTACK-11 (authored Multiattack, auto-sequence) follows it directly.                                              |
| 7   | ATTACK-3                                | 4.0  | Done (ninth session).                                                                                                                    |
| 8   | PLATFORM-5 (5.6)                        | 4.0  | Done (ninth session).                                                                                                                    |
| 9   | "Needs proof" audit                     | 4.0  | Proofs linked (ninth session); 13.4, 14.2, 14.3, PERF-3.7, 3.10, 3.11 closed (fifteenth). Open: PLATFORM-13.2, 13.3, 14.1, PERF-3.4, 3.14. |
| 10  | SPELLS-2                                | 3.3  | Done (parallel session, D94; merged in the ninth session). SPELLS-10 holds the deferred condition mechanics.                             |
| 11  | SPELLS-9                                | 4.5  | Done (tenth session, D95).                                                                                                               |
| 12  | SPELLS-3 (3.2–3.6)                      | 4.2  | Done (D96, D98; fourteenth session).                                                                                                     |
| 13  | SPELLS-5                                | 3.8  | Merged `983ce6ad9`; 5.6 per-speed-type movement still to build. SPELLS-11 (single-use items used up) follows it directly.              |
| 14  | RULES-1                                 | 3.3  | Done (fourteenth session): `kernelDiceIdentity.test.ts`.                                                                                 |
| 15  | ATTACK-10                               | 3.0  | After SPELLS-2.                                                                                                                          |
| 16  | BUILDER-3, AUTHORING-2, AUTHORING-13    | 3.0  | Done (journeys closed before the fourteenth session).                                                                                    |
| 17  | SPELLS-7                                | 3.0  | Area and multi-target.                                                                                                                   |
| 18  | AUTHORING-14                            | 2.7  | Done (all-domain duplication conformance).                                                                                               |
| 19  | ATTACK-7                                | 2.6  | Grapple and shove; 7.2 Engulf (after ATTACK-11).                                                                                         |
| 20  | VTT_UI-2                                | 2.6  |                                                                                                                                          |
| 21  | ATTACK-9                                | 2.5  | Class-feature resolvers.                                                                                                                 |
| 22  | SPELLS-8                                | 2.3  | After SPELLS-5, SPELLS-7, RULES-1.                                                                                                       |
| 23  | PLATFORM-2                              | 2.3  | Done (journey closed).                                                                                                                   |
| 24  | SHEET-7                                 | 2.0  | Done (parallel session, fourteenth).                                                                                                     |
| 25  | AUTHORING-12 (12.4)                     | 1.8  | Done (fifteenth session).                                                                                                                |
| 26  | ATTACK-4                                | 1.7  | Cleaving (optional rule).                                                                                                                |
| 27  | MOVE-3, VTT_UI-1, VTT_UI-4, PLATFORM-12 | 1.6  |                                                                                                                                          |
| 28  | REACTION-4                              | 1.5  | After SPELLS-8.                                                                                                                          |
| 29  | SPELLS-4                                | 1.5  |                                                                                                                                          |
| 30  | ATTACK-6                                | 1.3  |                                                                                                                                          |
| 31  | ATTACK-5                                | 1.2  | After SPELLS-2 and ATTACK-7: 35 of its 41 allowlisted attacks are grapple, swallow, attach, drain and condition riders (`OUTCOME_KIND`). |
| 32  | AUTHORING-1 (1.4, 1.5)                  | 1.1  |                                                                                                                                          |
| 33  | VTT_UI-3                                | 1.0  |                                                                                                                                          |
| 34  | ROOM-6                                  | 0.9  | Test fixtures only.                                                                                                                      |
| 35  | ENCOUNTER-4                             | 0.8  | Speed Factor (optional rule).                                                                                                            |
| 36  | MOVE-2                                  | 0.6  | Overrun, Shove Aside, Tumble (optional rules).                                                                                           |
| 37  | ATTACK-2 (2.5)                          | —    | Umbrella; closes when spells, reactions and death saves land.                                                                            |

**Optional-combat variants (ranked 2026-10-08).** Each is opt-in and offered only once it resolves, so value and time criticality are low (2 and 1) and size decides. They slot into the table above by WSJF; none outranks SPELLS-3.

| PBI         | WSJF | Size | Slots after                | Note                                                                                            |
| ----------- | ---- | ---- | -------------------------- | ----------------------------------------------------------------------------------------------- |
| ATTACK-16   | 1.3  | 3    | #29 SPELLS-4               | Massive damage (system shock): one Constitution save on a large single-source hit.              |
| ATTACK-14   | 0.8  | 5    | #34 ROOM-6, after SPELLS-7 | Hitting cover. No cover rules exist yet; cover arrives with SPELLS-7 (area and multi-target).   |
| ATTACK-13   | 0.8  | 5    | #34 ROOM-6                 | Marking: a mark effect plus a free, advantaged opportunity attack.                              |
| ENCOUNTER-6 | 0.8  | 5    | #34 ROOM-6                 | Morale: GM-offered save on authored triggers, recorded outcome.                                 |
| ATTACK-12   | 0.5  | 8    | #36 MOVE-2                 | Facing: token facing UI, set at end of move and as a reaction; rear-arc attacks.                |
| ATTACK-15   | 0.5  | 8    | #36 MOVE-2                 | Lingering injuries; after SPELLS-3 (failed death save trigger) and needs Sheet display.         |
| ENCOUNTER-7 | 2.3  | 3    | #21 ATTACK-9               | Not a variant: one roll card per turn-stage roll and per app-rolled action d20 (GM visibility). |
| MOVE-4      | 0.4  | 8    | #36 MOVE-2, after MOVE-2   | Climb onto a larger creature; reuses the Overrun and Tumble contest path, so it follows MOVE-2. |

Batched into one local live run (not scheduled for any single item): ACCOUNTS-1, 2, 3, 5 and 8 browser journeys; PLATFORM-4 uploads (needs the local R2 fixture); RELEASE-6; ENCOUNTER-5; the ATTACK-8.4 "Attack 1 of 2, then 2 of 2" drawer journey.

End of phase: PLATFORM-6.2, 7.2, 8.2, 9.2, 10.2; PLATFORM-13.5 dependency refresh; PERF-1, PERF-2, PERF-3.14; RELEASE-1 to RELEASE-4.

**Live runs:** do not schedule a live-backend run for a single check. Prefer work that needs no live run. Batch live-only proofs, such as RELEASE-6 (confirm the typed Campaign refusal regexes in `apps/web/tests/live-backend`), into the next live run that happens for another reason.

The final `yarn validate:pre-staging:local` runs once, at the end of Phase 8.

**Operating notes for the next session:**

- The dashboard is https://claude.ai/artifact/Qcho6LKSBVJtVg2PKv36jv, built from `node scripts/acceptanceProgress.mjs --json`.
- The `.agents/` deletions stay unstaged and uncommitted.
- Convex and Session Worker tests resolve `packages/schema` and `packages/encounter-persistence` through `dist`: rebuild them after source changes before running those tests.
- `gate.ps1`, `vt.ps1` and `nt.ps1` take `local-validation/.validation.lock` themselves; never wrap them in the lock. Format with `yarn format` (oxfmt).
- Authority is the ledger, not the older counts below; see [ADR 0029](../adr/0029-convex-backend-cutover.md), [ADR 0035](../adr/0035-room-authoritative-live-encounters.md), [persistence](../architecture/persistence.md), [live-session coordination](../architecture/live-sessions.md) and the [release runbook](../runbooks/phase-8-2-release.md).

## Historical checkpoint (2026-09-24, later session)

The approved completion plan runs S0–S7: checkpoint, code-quality groundwork, continuation secret, Campaign-owned play (ADR 0033), R06 room dispatch, security hardening, gameplay rules, final proof. Done and committed locally on this branch:

- **S0:** checkpoint of Codex's previously untracked relocation.
- **S1:**
  - Shared guards; one `stateHttp` route factory; aliases and dead code removed.
  - Worker route table `callLiveSessionRoute`, with `LIVE_SESSION_ROUTE_PATHS` shared with Convex `http.ts`.
  - Pure `planLiveSceneCommand` extracted from the room.
  - Test fixtures consolidated.
- **S2:** dedicated `RULES_CONTINUATION_SECRET` with `deriveRulesContinuationKey` (v2 label).
- **Cleanup:**
  - Deleted the stale `packages/db` corpus copy and the orphaned rule-path manifest.
  - `AGENTS.md` and the docs corrected (link check clean).
  - Dead `campaigns/inventoryPurge` removed; the ADR 0032 deletion job already purges all of its tables.
- **S3 ([ADR 0033](../adr/0033-campaign-owned-play-and-session-log.md)):**
  - Campaign-keyed live table, presentation, tickets (v2) and Encounter Runs; `PLAY` revision scope.
  - Session finish no longer touches play.
  - `campaigns/playMigrations.ts` migrates development rows.
  - Web tabletop is at `/tabletop/campaigns/$campaignPublicId`, with a Campaign encounter panel and PREPARED Run deletion.
  - Acceptance amended with the user's approval: P15, V05, V08, V09, V14 and F12 reopened, count 59/75.
- **Deployability fixes found by the first real codegen push:** both defects were pre-existing.
  - `encounterMovement:begin` declared union arguments; Convex requires an object.
  - Worker-boundary capture/commit modules exceeded Convex's 64 MB module-load budget (`encounterRulesCapture` needed 65.8 MB). They now validate with their Zod contracts in the handler behind `args: v.any()` and use about 30 MB. See [live-session coordination](../architecture/live-sessions.md).

Validation at the S3 commit:

- Full Convex suite: 624 files, 2,095/2,095 tests.
- Schema 449/449, Worker 70/70, focused web tests.
- apis/worker/schema/shared/rules-runtime/web typechecks.
- Local codegen push against `phase82-convex-local-linux`.

Rule from here on: run a local codegen push for every slice that touches Convex (see `AGENTS.md` validation guidance), and serialize compiler/test runs with the validation lock described in `AGENTS.md`.

- **S6 rules (partial):** carried weapons count as drawn unless an action requires equipping; pure shield-conflict evaluator (`encounterWieldConflict.ts`).
- **S4A, single Encounter command door:**
  - Every Encounter command enters through the room (`ENCOUNTER` command scope). The room runs the DO planners for actions, turns and concentration and forwards everything else, or anything a planner marks `LivePlannerUnsupportedError`, to Convex through the private `encounterCommand` route. The private `encounterRoute` route classifies pending decisions with the shared `encounters/occurrenceOwner.ts` classifier.
  - `encounters/commands:execute` and `commandActions:execute` are internal; browsers can no longer run Encounter commands.
  - Web sends Encounter commands through `useCampaignLiveSession().sendEncounterCommand`. Encounter acks resolve only the initiator and never advance the room sequence.
  - Room closure closes sockets and waits for in-flight commands before setting the drain fence.
  - The real-backend HTTP dev drivers (`apps/apis/tests/development*.ts`) can no longer execute Encounter commands; they still run under the in-process adapter. Correction: the R08 Encounter proofs do use them, so the drivers must send Encounter commands through the Session room (see the Decision log).
- **S5 Convex hardening:** `@convex-dev/rate-limiter` limits (tickets, Scene writes, conversation, Social), the 5-minute ACTIVATING cap, the publication role check, eviction retry with backoff, and 30-day Scene command retention. See the Security and limits section of [live-session coordination](../architecture/live-sessions.md).

Validation at the S4A/S5 commit:

- Full Convex suite: 355 files, 2,110/2,112 tests. The two failures were missing rate-limiter registrations in account-deletion tests; they are fixed and pass on rerun. One avatar loopback test timed out once on a rerun and then passed.
- Worker 73/73; focused web tests; apis/worker/web typechecks; local codegen push.

Also committed: S5 room limits (`3eba2a32`), private-by-default GM previews (`7571733c`) and the shield-stow prompt (`7f61ce58`).

**Scope decision (2026-09-24, user-approved, [ADR 0034](../adr/0034-player-control-rules-assistance-and-roll-prompts.md)):** an audit against PRODUCT.md found that players could not act for their own Characters, that Sheet writes left Run Character mirrors stale (refusing that Character's Encounter commands), and several further agency gaps. 8.2 now closes with the core below. A launch-gating Phase 8.3 "Player play parity" follows with spell casting and area targeting, death saves, Sheet–tabletop integration, map targeting and non-movement reactions.

Next (8.2 core, in order):

1. **Grip and carried weapons (in progress):** authored grip markers on weapon effects (versatile one-hand and two-hand actions, shield conflict per grip); carried weapons attack with correct modifiers.
2. **Combat math correctness** (from the 2026-09-24 authored-data audit; one slice). Implemented locally, uncommitted and awaiting integration (reset/reseed, codegen); see the S6c section of [rules-runtime](../architecture/rules-runtime.md). Open: magic ammunition (needs an ammunition-selection decision), `maxBonus` (unused field: remove or reject), GM stat-block display of qualified defenses, and Creature Magic Weapons traits:
   - Damage modifiers (ability, SOURCE +N, Dueling) are folded but never added to damage.
   - Character actions have no attack kind: ranged attacks use melee roll modes, Characters never flank. Consolidate the five attack-kind classifiers and the two modifier group-key builders.
   - Heavy never applies: size is missing from the fold input, so the SIZE restriction fails. Behind it, roll-mode contributors ignore SOURCE scope (`effectActionCompiler.ts` ~5762); after the fix, remove the roll-mode exclusion in `drawnSourceState`.
   - ARMOR_CLASS SET_VALUE is added instead of replacing (Draconic Resilience).
   - Scope semantics: SOURCE applies only to things from that source (per the registry); re-author Character-wide features (Archery, Dueling, Defense, Unarmored Defense, Draconic Resilience, Font of Inspiration) as GLOBAL with facet filters.
   - "Nonmagical" resistance qualifiers are dropped by the seed normalizer, becoming full resistances or immunities.
   - Proficiency is matched by exact equipment id (magic variants fail; `*` is unhandled); magic ammunition bonuses never reach the firing weapon.
   - Condition-specific save grants are never selected.
   - Fail-closed latent issues: PENALTY sign; non-Character restriction contexts are dropped, so the restriction passes; unsupported modifier kinds are rejected at publish until implemented.
   - SRD data errors: Barbarian and Fighter Defense lack armor gates; Monk Unarmored Defense has no mechanics; light and medium armor DEX gated on armor proficiency; missing Rogue weapon and tool proficiencies; Heavy armor STR and speed.
   - Sheet item panel shows manual adjustments only for magic weapons.
   - The shield-stow AC delta counts only the shield's base value, not a magic shield's +N.
   - Add direct unit tests in `packages/rules-runtime` (it has none today).
   - Phase 8.3 (with spell casting): APPLY_GRANT effects (19; e.g. Shield, Aid), condition mechanics, long range, and the remaining modifier kinds. Add an acceptance criterion: in Assisted mode, a player's spell that forces a creature's save pauses for that creature's controller, unless their auto-roll is on (moved out of V11.4 by Q6).
   - Performance (found 2026-09-25, [bundle timing](../validation/phase-08-2/bundle-timing-2026-09-25.md)):
     - Typical room commands take ~1.1 s p95, against a 250 ms rule-bound budget.
     - Encounter Run creation fails at the 100-actor cap (reads over 16 MiB).
     - A profiling and fix slice is running.
     - If contract-preserving fixes aren't enough, the next lever is a warm path: the room plans from the volatile state returned by its last commit, and a fence refusal forces a recapture.
   - Test-suite speed (user-approved 2026-09-26, safest steps first). Each step must show identical coverage and results before the next begins. 0. Upgrade convex-test 0.0.56 → 0.0.60 as its own change. Skip 0.0.58, which lets Vitest stubs bypass the transaction guards.
     - **Why:** accuracy, not speed. It adds real-backend guards (timers and `fetch` in transactions, args-validator shape), real request metadata (drop the `authJwks.test.ts` stub and test the 503 fallback), and fixes false scheduled-function hang errors.
     - **Proof:** three suite runs per version (unshuffled, seeds 101 and 202) with identical test IDs and statuses; per-file counts of scheduled-function errors, "not supported in Convex queries or mutations", timer-restore and args-validator messages; and a per-file timing comparison.
     1. Measure per-file Convex suite timings (no code change). The suite is ~30 minutes because `apps/apis/vitest.config.ts` runs it serially: ~21 minutes of tests, ~8 minutes of per-file imports.
     2. Validation cadence: affected tests per slice; reset and reseed only when schema or seed data changes; full integration at checkpoints and the final R08 run.
     3. Parallelism.
        - First extend the 60-second session expiry in the test fixtures (`tests/fixtures/characters.ts`, `publication.ts`). Tests of expiry itself set their own times.
        - Then trial 2–3 workers, adopted only if repeated runs match the serial baseline exactly.
     4. Only if step 1's measurements justify them:
        - pure memoization of fixture parsing and checksums (estimated under 1%);
        - a convex-test patch caching schema export per schema;
        - a separate trial to cut the ~8 minutes of repeated per-file workspace `dist` imports.

        Each goes through the equivalence protocol: identical test IDs and results, three shuffled seeds, and each changed file run alone.
     - **Never:** share database state across tests, replay seeded snapshots, or set `isolate: false`. convex-test 0.0.56 has no snapshot or clone, and tests assert whole tables and use global mocks (read-only analysis, 2026-09-26).
     - Remove the dead fixture `apps/apis/tests/fixtures/movementPassageFixture.ts` (imported nowhere).
     - Move the 12 already-pure test files out of the Convex suite (for example `encounters/actionExecution`, `actionEffectBaseline`, `wieldConflict` → `packages/rules-runtime/src/__tests__`). The test IDs and results must stay identical.

   - Rules test coverage, a quality project (read-only audit, 2026-09-26):
     - **The gap:** `packages/rules-runtime` has 7 test files for about 270 source files. The largest planners have no fast tests: the effect compiler, initiative lifecycle, ties and order, turn effects, Legendary Actions, Recharge, Concentration, Disarm preparation, and the spatial movement service. Most rules coverage is end-to-end through Convex tests, and many of those assertions are loose ("HP decreased").
     - **Plan:** build strict pure tests family by family, in this order:
       1. action warnings and target policy;
       2. saves and immunity;
       3. initiative;
       4. turn effects, Legendary Actions, Recharge and Concentration;
       5. movement.

       Use `createPlatformRulesRuntime`, `inMemoryInitiativeRepository` and `dnd5eSrdCharacter.ts`, and inject `random`. Prove each new test fails when the logic is deliberately broken. Only then slim the matching Convex test.

     - **Never remove the last proof of a Convex guarantee:**
       - tampered receipt refusal;
       - stale source-identity refusal;
       - the Scene version fence;
       - no writes on refusal;
       - command-id reuse;
       - `NOT_ACTOR_CONTROLLER`;
       - roll draw mismatch;
       - exactly-once undo.
     - **Expected payoff:** mainly precision and catching regressions. Speed gains are small, about 2–4 minutes.
     - **Next pure targets, confirmed untested by the liveSessions audit:**
       - Initiative:
         - `planEncounterInitiativeAdvance` (`encounterInitiativeStateSettlement.ts:201`): SAME_ROUND and ROUND_WRAP; inputs are cheap.
         - Initiative tie settlement.
       - Concentration:
         - `resolveDnd5eConcentrationSaveFacts` / `dnd5eConcentrationDamageDc` (`systems/dnd5e/concentrationPolicy.ts`);
         - `evaluateNativeConcentrationEvidence` / `completeNativeConcentrationResult`;
         - `projectEncounterMovementConcentrationEnd` (cleanup of dependent effects).
       - Action economy: `evaluateEncounterActionEconomy` (warning).
       - From the scenes audit. These have cheap inputs and currently no pure test:
         - `sceneTokenMovementFailure` (`shared/domains/vtt/geometry.ts:293`);
         - `discoverEncounterMovementPassageContact` / `discoverEncounterMovementPassage` (endpoint occupied, next passage stop);
         - `deriveCharacterSceneVision` (sense range, non-visual channel);
         - fog exploration truncated at a pending contact (`planSceneCommandExploration`).
       - From the encounters audit:
         - Disarm: `disarmSourceWins`, `disarmApplicationOutputs`, `planEncounterDisarmSuccess` (`encounterDisarmPreparation.ts`). Add these before trimming any Disarm it.each rows.
         - `applyCharacterScalarValuesToFacts` / `foldActiveScalarReductions`.
         - `buildMovementTarget` (the Creature branch).
         - `prepareNativeCharacterActionState`.
         - The wield-conflict NONE case.
         - A carried weapon having the same modifier as an equipped one.
       - From the characters audit. The Character domain has no pure tests for its reducer, projection, rest or builder:
         - Easy, no harness needed: the Sheet command reducer `applyCharacterSheetCommand` (`sheetCommandReducer.ts:1269`) for notes and groups, and extras (add, clamp, exclusive, remove).
         - Needs a pure Character-context harness, built on `prepareCharacterRuleContext` with in-memory `Readers` as `apps/session-worker/src/nativeCharacterRules.ts:329` does:
           - builder resolution and reconciliation (`resolveCharacterBuilder`, `reconcileCharacterBuilderCharacter`, chosen-grant choices);
           - rest preview and completion (`buildCharacterRestPreview`, `applyCompletedCharacterRest`);
           - `resolveCharacterRecordStats`.
         - Before those assertions can move, extract the inline Convex rest and extras cleanup (`characters/sheetCommands.ts:383-384, 423, 462, 481-484`: resourceUsage and max-HP-modifier filters) into pure functions.
         - Keep in Convex: `drafts.test.ts` (all), `characterMaximumHitPoints.test.ts` (stored-stat sync across every write path), Sheet extras source visibility, and Campaign masking wiring.
       - From the turn-phase audit:
         - GM turn-correction cursor math is inline in Convex (`encounters/commands.ts:269-316`). Extract it into a pure function (T4) before its assertions can move. `initiativeCorrection.test.ts:144` is already pure and can move as it is.
         - `turnLegendaryAction.test.ts:1052` is named "settles once with spend, damage and cursor" but asserts only status, version and replay. Strengthen it or rename it.
         - Once the pure tests exist, the rules outcomes duplicated across in-process and live-Worker transports in `turnConcentration.test.ts` (461/960, 511/584, 678/785) can shrink to one transport each.
       - Test cleanup: `encounters/actionCharacterSources.test.ts:627-664` runs a second full setup and compares two snapshots with nothing executed between them. That proves nothing and doubles the test's cost. Remove it together with the redundant re-reads.
       - Worker-level tests with injected capture fakes, the medium-effort precedent being `apps/session-worker/test/nativeTurnEffectPerception.test.ts`:
         - movement Concentration;
         - maintenance forecasting;
         - passage contests;
         - reaction evidence order and STOP;
         - the room-side maintenance currentness refusal. `movementMaintenance.test.ts:586` is its only proof today.
     - **Also Convex-only proofs to keep:**
       - the `roomCaptureCache` transaction-limits test at the actor cap;
       - action commit rollback;
       - capture bundle ≡ separate-capture parity;
       - revision stamps (CAMPAIGN, and SYSTEM via import jobs);
       - external-commit resolve;
       - `characterRulesCapture` privacy and no-hydration checks.

   - Observability: room planner failures surface only as a generic "UNAVAILABLE" and aren't logged. Add structured, secret-free error logging.
   - R08 prep: the development proof drivers can't load under `yarn tsx`. Test-only fixtures import convex-test, which uses `import.meta.glob`.
   - R08 prep: the local R2 fixture (`apps/apis/tests/localR2.ts`, served from the Convex container on 127.0.0.1:8026) was started by hand and stops when the container restarts. Its start command is undocumented. Script its start in the local proof tooling, checking health first, and document it in `apps/apis/README.md`. Map uploads, and so bound-move timing and browser proofs, need it.
   - R08 prep: rebuild a room-driven, real-backend reaction contention proof for V14.4 once S4-c lands.
     - The stale driver (`developmentEncounterReactionTransactions.ts`) was deleted and replaced by an in-process test.
     - convex-test runs one transaction at a time, so the in-process test proves winner and loser semantics but not true parallel transactions.
     - Only the real backend can prove true parallelism.
   - Phase 8.3 (user, 2026-09-25): Encounter combatant kinds beyond CHARACTER, CREATURE and CUSTOM:
     - mounts, with mounted-combat rules;
     - vehicles, including crewed vehicle combat;
     - traps;
     - hazards.
       Compare each with Foundry's actor types.
   - Follow-ups from S6g: `REACTION_COUNT SET_VALUE` with APPLY_GRANT (Shocking Grasp); Barbarian Fast Movement mechanics.

3. **Live Character state:** remove the Run's Character HP and stream-version mirror; Encounter reads use the current Character fenced by captured revisions.
4. **Modes and enforcement:** remove `AUTOMATIC` and add a per-person "Auto-roll my dice" preference. Assisted rule checks become warnings with a logged "Do it anyway"; GM undo or void of results and stuck prompts.
5. **Player control:** one actor-control predicate with GM-set controllers; player actions, turn end, initiative and rolls; roll prompts ("Roll dice" or typed, rerolls logged, roll-mode override); redaction; action-economy and movement display; one in-flight player Encounter command per user. Spec: `local-validation/s6/spec-player-actions.md` (local).
   5b. **Visibility privacy (with player control):** players see no other actor's health by default (PCs or enemies); another player's Sheet is GM-only by default. Opt-in: "Party can view" per Character. Health display levels (Hidden by default, Descriptive, Bar, Exact) are set per Character by its player, and per Encounter for enemies by the GM, with a per-actor override. In Phase 8.3, the GM's per-enemy "Share health state" action posts a descriptive state (Unhurt, Hurt, Bloodied, Near death) once to the table log.
6. **Table fixes:** players commit moves outside Encounters (web gate), toggle unlocked visible doors, and roll to the table by default with a "To GM" option. Fog of war becomes opt-in per Scene: with fog off, players see every non-hidden entity (today a Scene without fog layers shows players only their own tokens).
7. **S4 remaining:** DO-owned bound movement (Convex-first authority sequence advance and a live `geometryStaging:observe` route), capture cache, deleting the Convex-side rules code for DO-covered flows, removing the retired rule-pack feature.
   7a. **Combat math follow-ups:**
   - remove `maxBonus` (schema, SRD data, web authoring);
   - make unarmored AC formulas choose the best, not stack;
   - reject or implement the remaining unconsumed modifier kinds (SAVE_DC SET_VALUE, PROFICIENCY_BONUS, CHARGE_LIMIT, range/duration/shape, spell-slot and known/prepared counts, action counts), keeping the kinds the SRD uses;
   - missing weapon and tool proficiencies for Bard, Druid, Monk, Sorcerer and Wizard, and Monk Unarmored Movement mechanics;
   - the GM stat block shows qualified defenses;
   - melee spell attacks can flank (the trigger needs a melee or ranged distinction);
   - Dueling's "no other weapons" condition.
     7b. **R08 proof readiness:** do one local deploy after combat math and rerun an Encounter proof through the room. The `encounter-action-contention` proof imports convex-test-only fixtures (`fixtures/encounterAction` → `fixtures/characters` uses `import.meta.glob`), so split the pure fixture data from the convex-test setup. Proofs that write Scene state directly may be refused while their Campaign's room holds authority; route those writes through the room too.
8. **S4B:** DO planners for Disarm, Cleaving responses, ROLL_ENEMY_ACTION, Legendary Resistance, spatial action interpretation and Manual mode, then delete their Convex rules code.
9. **S7:** Also: fold in Scene fog save retention (Q4); delete the Codex backup worktree after the final commit (Q2); add "rotate the staging and production credentials" to the go-live checklist (Q1). R01–R05 audit, R08 `yarn validate:pre-staging:local`, V15 workload with player-issued commands, docs.
   - R08 prerequisite (done 2026-09-24, not yet run end to end): `scripts/validatePreStagingLocal.mjs` no longer uses the historical Codex packet `.codex/validation/local-convex-linux-20260915/`. Its proof runners are ported to `scripts/runLocalConvexProof.ps1`; the reset stage uses `scripts/resetLocalConvex.ps1`. Admin keys are generated with `docker exec` at run time. The stored credentials file is no longer used. Evidence goes under `local-validation/`. See the [release runbook](../runbooks/phase-8-2-release.md#final-local-source).
   - Still open for R08: every lifecycle proof runs `apps/apis/tests/developmentDrafts.ts`, so the S4A note above that R08 does not use the HTTP development drivers is wrong. Since S4A those drivers cannot run Encounter commands, so the Encounter proofs (lifecycle, contention, movement, passage, disarm, effects, VTT, V15) will probably fail until they go through the room. Those drivers also still write browser output under `.codex/validation/`.

Integration items for the pending local-reset batch (grip, fog opt-in, roll visibility, doors):

- Chat roll payloads gained `consumedAt` as an optional field for rest-roll settlement. Before committing, make it a required, nullable field on the ROLL payload variant only (pre-launch: no optional fields). Text payloads must not carry it. Verify with the post-reset codegen push.
- Re-run the web and Convex typechecks after the codegen push. The roll-visibility slice's remaining errors come only from the stale generated API.

Fog follow-ups (from the fog opt-in slice):

- Convex fog commands refuse painting while fog is OFF, but they don't enforce the shared-party versus per-player layer-owner rule against the Scene's mode. Existing tests deliberately mix both layer kinds in one Scene, so decide the rule and enforce it once.
- Only Convex emits `FOG_MODE_SET` today, and players pick it up through the room's version re-sync. If the room ever applies it directly, turning fog off must trigger a full recipient refresh, because newly visible entities aren't carried by the delta.
- A fog-off Scene that keeps its fog layers uses full hydration, and players still download layers they won't use. Revisit if Scene load time matters.

Open follow-up: Scene fog save retention (derived fog saves keep `geometrySaveId` after their geometry save is pruned; superseded fog saves and chunks are not garbage-collected).

## Decision log (delegated, for user review)

The user delegated decisions on 2026-09-24 (night): use Foundry as the baseline, extend it for versatility and quality of life, "same but better" at minimum. Each entry gives the decision, the Foundry baseline (with Roll20 as a second reference where useful) and the reasoning.

- **D70: packed history with indexed receipt headers (2026-09-29). Decision maker: Codex; approved
  by the user on the same date.** Codex decided that checkpoint ledgers hold immutable history
  payloads once, while small indexed per-command receipt headers point to their checksummed entries.
  This preserves existing UUID replay, duplicate-command refusal, privacy and complete timeline paging
  through Convex indexes, without duplicating history bodies. Headers count toward the Q16 workload.
  The ledger/header writers, readers and cleanup are still required; the record builder alone does
  not complete S3. See [ADR 0035 D70](../adr/0035-room-authoritative-live-encounters.md#d70-packed-history-with-indexed-receipt-headers--2026-09-29).

- **Development proof drivers go through the Session room (2026-09-24).** Since S4A, browsers can't call Encounter command functions, so the real-backend drivers (`apps/apis/tests/development*.ts`, used by the R08 proofs) can no longer run Encounter commands. The drivers will send Encounter commands over a real Session-room WebSocket with a ticket, as the browser does, and their `.codex/validation` output paths move to `local-validation/`. Rejected alternative: admin-key calls that impersonate a user, which would prove a path production never uses. Foundry and Roll20 have no equivalent; this is a testing-integrity choice.
- **Local deploys are part of local validation (2026-09-24).** `convex codegen` uploads functions only to generate types; it doesn't activate them, so the local backend kept running pre-ADR-0033 functions. Pushing functions to the local Docker deployment is covered by the same local-only authority as resets. Staging and production still need explicit approval.
- **Domain rejections carry a code and a user-safe message (2026-09-24, in the modes and enforcement slice).** The room currently reduces every Encounter failure to a generic message ("The Encounter command could not be completed."). Foundry and Roll20 show players specific warnings. Expected domain rejections, such as "This Campaign already has an active Encounter" or a stale version, become `ConvexError` data `{ code, message }`, following the `RATE_LIMITED` pattern. The room forwards those messages; unexpected errors stay generic, so internals never leak. Drivers assert on codes.
- **Magic ammunition is chosen per weapon (2026-09-25, Phase 8.3; user override: tracking is a Campaign option the GM sets, and with it off bonuses apply but nothing is counted down).** Foundry baseline: a weapon consumes a selected ammunition item, and that item's bonuses apply to the attack. Roll20's 5e sheet also links ammunition per attack. Extensions:
  - auto-select when only one compatible stack is carried;
  - a quick ammunition switch in the attack drawer;
  - ammunition counted down per attack.

  Rejected: GLOBAL ammunition bonuses faceted to launchers, which add up across stacks and remove the player's choice. It needs Sheet UI and inventory consumption, so it lands with Sheet–tabletop integration.

- **`maxBonus` is removed (2026-09-25).** It is on 165 SRD items, has no consumer and duplicates the authored +N modifiers. Removing the field is cleaner than keeping an authoring option that always fails validation. Foundry has no equivalent; magic bonuses are ordinary modifiers there too.
- **The Dwarf heavy-armor speed exception is kept (2026-09-25).** It is SRD text.
- **Unarmored AC formulas choose the best (2026-09-25, queued).** 5e says a creature with several AC formulas picks one, so alternative base formulas (Barbarian, Monk, Draconic Resilience) compete instead of stacking. Foundry's 5e system has the same single-calculation rule.
- **Character maximum HP: one persistence funnel (2026-09-25, revised).** The first decision assumed a single writer, but maximum HP also depends on GM Campaign adjustments and on published content, and nine code paths write the Character document. Revised:
  - the Run keeps no maximum-HP copy and no staleness refusal, because rules already compute the live maximum;
  - for display, one shared Character persistence helper, used by every Character document writer and by GM adjustment writes, recomputes and stores the effective maximum in the same transaction;
  - accepted lag: after a content republish, a Character's stored maximum updates on its next write, while the Sheet always shows the live value (Roll20 is no better; compendium changes don't reach existing characters);
  - rejected: evaluating the full Sheet on every reactive Encounter read (too costly) and a publish-time recompute job for now (infrastructure for a rare case; follow-up).

  Copied Character conditions are also removed from Run actors.

- **Displayed maximum HP includes active reductions (2026-09-25, player-control slice).** Foundry shows the effective maximum with active effects applied, so projections subtract active maximum-HP reductions (such as a vampire's bite) from the stored maximum. Watch item: every Character write now runs a full Sheet evaluation, and some writers reload the catalogue; measure it under the V15 workload before optimizing.

- **"Auto-roll my dice" defaults on and is stored server-side (2026-09-25).** Foundry rolls immediately when you click (manual dice entry is an opt-in configuration), and so does Roll20. So the fast path is the default, and players who roll physical dice turn it off to get the per-roll prompt. It is a profile preference read by the server when a roll is needed:
  - no prompt round trip;
  - works if the roller's client has disconnected;
  - applies on every device.

  It only rolls dice and never chooses anything; see the Assisted rule below.

- **GM void resolves a stuck decision by kind (2026-09-25).** Foundry and Roll20 have no rules prompts to get stuck; any table tool with prompts needs an escape hatch, especially once players drive actions and can disconnect. GM-only, with the outcome depending on the kind of decision:
  - a paused action is cancelled whole;
  - declinable responses resolve as a decline;
  - turn-flow steps are skipped where the flow can continue, and are otherwise refused with guidance.
- **Soft enforcement split (2026-09-25).** In Assisted mode these are warnings with a logged "Do it anyway": action economy, resource/slot/charge availability, range, `requiresEquipped`, target disposition. These stay hard: authorization, stale versions, missing or invisible targets, a player acting out of turn (reactions excepted), invalid game state. "Do it anyway" never drives resources negative; it records the shortfall and shows the GM an override badge. Foundry warns but lets you proceed on most of these (for example casting without a slot, when consumption is unchecked), and Roll20 enforces none. We warn with a GM-visible audit, which is better than silent permissiveness and friendlier than hard blocks.
- **GM undo of the last action (2026-09-25).** Neither Foundry nor Roll20 has combat undo. The GM can revert the last committed action exactly, from the before-states recorded in its receipt. It is refused, with an explanation, if a later command or Sheet write touched an affected actor, or if a transition has no exact inverse. Actions only; movement has its own undo.
- **GM answers any prompt instead of voiding turn steps (2026-09-25).** Voiding a Recharge or a turn-effect save would need a "skipped" variant in stored turn plans and replay. Instead the GM can answer any prompt, including ones routed to a player, and "Roll dice" makes that one click; so a disconnected roller can't wedge a turn. That goes into the player-control slice. Void stays for actions (cancelled) and declinable choices (declined). Correction (user, 2026-09-25): "Assisted means assisted." In Assisted mode the app never acts or chooses on anyone's behalf, so authored "automatic" reactions are offered as a Use/Decline choice to the actor's controller (the GM for monsters). The modes part A change that let them fire on their own is reverted in the player-control slice.
- **Actor disposition follows Foundry (2026-09-25, player-control slice).** Hostile-only targeting warned on every attack because actors had no disposition. Every Run actor now gets a GM-editable Friendly, Neutral or Hostile disposition (default Friendly for Characters, Hostile for Creatures), like Foundry's token disposition. Flanking's ally and enemy relationships read the same field. The action drawer marks already-unavailable actions with their reason before selection.
- **Local Worker configuration (2026-09-24).** `apps/session-worker/.dev.vars` was rebuilt from the local Convex secrets to match `.dev.vars.example`. The retired executor variables are removed from it, from the local Convex env and from the generated Worker types. `RULES_CONTINUATION_SECRET` is now provisioned locally.

## Historical authority snapshot (2026-09-27)

At this historical checkpoint, the fixed ledger was **53/75** cases and **195/276** criteria (2026-09-27; `node scripts/acceptanceProgress.mjs`). The readiness and open-case details in this paragraph describe that checkpoint only. Current status is in the authority section above and the [acceptance JSON](../roadmap/08-2-convex-cutover-acceptance.json).

The cutover keeps heavy live rules **and heavy fact preparation** in the Session Durable Object (DO). Convex owns atomic Character Sheet and Encounter writes and their receipts; Scene publication uses per-entity deltas. Every Encounter command's rules and dice run in the DO (D41). Convex records the listed GM tools and commits room plans through Worker-secret routes, with ordered dispatch and write-ahead crash recovery (D27). V15 is measured, but not yet claimed: see docs/validation/phase-08-2/. No staging, production, retirement, deployment, database reset, journal deletion or real continuation-key transfer is authorized by this handoff.

Current architecture is defined by [ADR 0029](../adr/0029-convex-backend-cutover.md), [live-session coordination](../architecture/live-sessions.md) and [shared rules runtime](../architecture/rules-runtime.md). [ADR 0024](../adr/0024-current-published-authored-content.md) governs current published sources and frozen issued occurrences; its policy supersedes older whole-Character source-vector claims. [ADR 0032](../adr/0032-campaign-deletion-lifecycle.md) governs Campaign deletion. The [release runbook](../runbooks/phase-8-2-release.md) and [remaining-work plan](../roadmap/08-2-convex-cutover-remaining.md) govern promotion order.

## Historical local checkpoints

The latest _completed_ movement-response checkpoint passed **31 focused cases in 8 files**, serial API/Convex/Worker types **10/10**, formatter/lint on **39 TypeScript files**, and an 8-root private import check with no heavy preparation or emitted Kernel/compiler imports. It includes actual private final Passage rollback, one allowance consumption and replay; PLAYER movement Concentration response, child receipt and revoked-assignment refusal; and initial/response movement admission. The source manifest is SHA-256 `27047BE566B2B6180396F7B024054B4D9B03A6ED396C2C4F554C2FC12C373F90` **before** the declaration edits and checkout relocation. The ordered commands, failures corrected before that checkpoint and limits are in [the durable movement summary](../validation/phase-08-2/README.md). They do **not** certify the current working tree.

Initial START and initiative evidence/order responses had separately passed: fresh serial types **10/10**, START/Recharge and round-wrap response cases, exact prior-round history and replay. Round 1 is inserted without replacement, no outgoing effect is applied, and incoming effect ordinal is zero. This does not cover declaration responses or room dispatch. The earlier native+private action, concentration and movement receipts remain supporting scoped evidence in the retained local validation archive, not final-source release proof.

The approved relocation copied **3,376 files**, left **1,526 unchanged**, and removed **1,283 tracked obsolete files** in the regular checkout. The regular checkout's `AGENTS.md` and spell mapper edits were preserved. Transfer evidence is under `local-validation/phase82-relocation-20260924/`. The raw evidence copy from the detached worktree to ignored `local-validation/phase82-goal-20260923/` completed successfully (robocopy exit 3: copied files and extra destination files). The durable summary is under `docs/validation/phase-08-2/`. Immutable Yarn install in the regular checkout passed with existing peer and optional `unix-dgram` warnings; it is not a current-source compiler or test pass.

## Historical work in progress and continuation notes

The user explicitly approved **local implementation and testing** of initiative declaration response integration (`call_HBBV88caQZPGSp4hPmkMTYRX`). An earlier automatic review refusal was resolved by that specific approval. The durable [declaration checkpoint](../validation/phase-08-2/initiative-declarations.md) records the bounded scope and exact stopped state. The user then clarified that work should stop at this patch. All implementation and validation processes started for this patch have ended; do not resume fixes or start another feature without the user's direction.

**Update 2026-09-24 (resumed):** the declaration patch now passes locally — a fixture omitted the native parity step that equips the Character's weapon; see the [declaration resolution](../validation/phase-08-2/initiative-declarations.md#resolution). The historical stop state follows. **The patch was not passing.** Both private declaration response-order tests failed with `The declared Character action equipment facts are stale.` at `encounterInitiativeDeclarationCompiler.ts:315`, called by `prepareEncounterTurnInitiative` at line 290. `private01.log` retains the complete failure; 2 failed, 8 skipped. No investigation or further fix followed the stop instruction. The latest compiler run failed a test-only pending/complete union access; that access was corrected before the test run, but types were not rerun. The earlier runtime union error was fixed and its package build passed on the second run. Independent authorization/persistence review completed; its missing PLAYER-terminal coverage finding led to the two deterministic test variants, which currently fail before completing the proof.

The intended declaration parity is the existing public behavior: OWNER may declare for any actor; a currently assigned PLAYER may respond only for their issued Character declaration. START, ADVANCE_TURN, initiative score/order and other turn decisions remain OWNER-only. The private capture adds only the approved optional `turnResponse` and captured Campaign owner identity; it cannot combine with movement or Concentration scope. Preserve issued request checksum, selected options, response history, current controller/assignment, actual responder identity, replay and one atomic pending/terminal write. The root receipt identifies the initiating GM; its resolution history identifies the actual responders. The existing native declaration fixture is the parity reference. `source-stopped.json` in the declaration evidence folder hashes the 15 touched source files; it is not a whole-repository release manifest.

After declaration proof, the remaining functional path is contextual Encounter decisions, actual ordered room dispatch/recovery, and final coherent local R08. R01–R05 track successful boundary removal and lifecycle on that same final source. Run the frozen V15 workload only after room dispatch and recovery exist; then seek separate managed R09/V15 and R10/retirement authorization. The fixed scenario is one GM, five players, eleven actors, eight rounds and two actions plus reactions; preview p95 ≤150 ms, durable p95 ≤250 ms/p99 ≤500 ms, and gameplay command p95 ≤1 s. Do not treat a timeout or incomplete suite as passing evidence.

## Decisions and unresolved questions

- Preserve immediate VTT behavior, per-entity Scene deltas and Pixi object retention. Do not restore full-Scene replacement, duplicate hydration, a DO Character publication lane, a second rules engine, a database emulator, arbitrary patch endpoint, queue or service.
- Character Sheet writes and matching Encounter results stay atomic in Convex. Heavy evaluation and fact preparation stay in the DO. The room must drain pending Scene publication before capture/commit, check authorization, epoch and all captured revisions, then acknowledge and broadcast only after required Convex commit. Exact retries return stored receipts without rerolling or spending twice. SQLite journal receipts/outbox are durable and cannot be discarded to force a retry.
- Selected source/target Character captures require exact stream versions. Unrelated stored actor snapshots still require assignment, ownership, System and ACTIVE checks but not an unrelated newer stream version.
- Earlier local implementation approvals remain in force for initial START (`call_d16qktM5L4Z5vir3Bu4jn4RS`) and the movement Character-assignment correction (`call_KIhJlMidUWEjsJQsNurYgMkk`). The assignment reader validates against the Campaign owner while receipts keep the actual initiating PLAYER; authenticated membership, active assignment, current control and System checks remain required. These approvals do not expand the declaration or continuation-key scope.
- [ADR 0030](../adr/0030-owner-deletion-and-retained-dependencies.md) requires referenced third-party dependencies to be repaired before owner deletion, preserving other owners' content and history. [ADR 0031](../adr/0031-oversized-inventory-cleanup.md) permits bounded, resumable cleanup of oversized inventories while unrelated inventory remains usable. These rulings preserve the fixed lifecycle cases; old refusal or whole-Campaign atomic-cleanup proofs cannot replace their current tests.
- **Continuation key ruling (user, 2026-09-24):** use a dedicated `RULES_CONTINUATION_SECRET` provisioned directly into both the Convex and Worker environments, like the existing Worker/ticket secrets. It is never transported over HTTP, and the Better Auth secret remains Convex-only. Pre-launch pending continuations sealed with the old derived key fail closed rather than being migrated. Not yet implemented. The paragraph below is the prior state.
- The **real continuation-key design was unanswered**. An automatic review refused exporting a derived key through private capture; that patch was not applied. Declaration approval does not authorize it. The Better Auth master secret must never leave Convex. Current local tests use fixed fixture keys; do not provision/export a real key or bypass review. The alternatives remain private derived-key delivery with specific approval or Convex-held key with verified resealing of issued continuations.
- Finishing a Session with an unfinished Encounter remains an unanswered product choice: complete it, block finish, or carry it forward. Freeze only that slice.
- The one authorized usage reset was redeemed at roughly 1% remaining with key `0c9fabd8-2a6b-4bdf-b614-fb2f64ace3b7`; zero credits remain. Last recorded limits at about 15:21 UTC were 89% used/11% remaining. Read fresh limits if relevant; do not retry that reset.

## Local verification and process limits

Use native PowerShell. Keep complete command output under ignored `local-validation/` for this regular checkout and publish concise ordered evidence under [Phase 8.2 validation](../validation/phase-08-2/README.md). Do not read a still-running log; inspect a bounded failure excerpt after completion. Record the final working-tree identity, command order, result and retained log path. Any later source, fixture, generated artifact or configuration change invalidates affected proof. The [release runbook](../runbooks/phase-8-2-release.md) requires the complete pre-staging local lifecycle before promotion; focused checks are implementation feedback.

Run the native TypeScript compiler **alone** on this Windows machine: `GOMAXPROCS=2`, Turbo `--concurrency=1 --env-mode=loose`. Do not run it alongside Vitest. A compiler allocation crash or incomplete suite is a failed gate. Build fresh rules-runtime outputs before tests importing new wildcard-export modules.

Existing Docker container `phase82-convex-local-linux` (ports 3210/3211), media helper (8026), web (3000) and Worker (loopback 8787) are historical observations in the raw handoff, not current health checks. Verify the actual process and port before reuse; do not start a duplicate or erase SQLite state on a timeout. Docker Desktop startup is user-owned; an earlier daemon shutdown preserved its volume but lost the local R2 helper's in-memory objects, so missing objects after restart are not deletion proof. A loopback Worker launch succeeded after an all-interface launch was refused by automatic review. The last local deployment predates the new declaration work and is not current-source evidence. A prior V15 command-entry preflight produced two one-second CPU timeouts before handler entry; it did not isolate an initializer or pass the workload. Do not repeat it until the room integration warrants it.

The 67 KB previous living handoff remains read-only in the detached worktree and in the copied local archive. Its dated historical checkpoints and process handles are superseded by this document, the current source, the fixed ledger and fresh verification. No remote staging or production step follows automatically from a local pass.

## Paused 2026-09-28 (laptop transport): in-flight work to resume

All agents were stopped cleanly. Their work sits uncommitted or unmerged in worktrees under `.claude/worktrees/`. The branch `codex/phase-08-2-convex-cutover` is clean and pushed at `04b3e46e4` (plus the docs commit for this note).

- **ADR 0035 S1** (Encounter persistence package): `agent-a7995c8923eaefdb1`.
  - 7 validated commits (`ed9841396`…`c7913f11f`), plus work in progress.
  - The work in progress follows the ruling: the package defines its own `EncounterDomainRejection`, which the Convex function wrappers translate to `ConvexError` in one place. That removes the package's runtime `convex` import and the `resolve.dedupe` workaround in `apps/apis/vitest.config.ts`.
  - To resume: finish that change, re-validate, merge, then codegen.
- **ADR 0036 S6** (Builder evaluates in the browser): `agent-a203cdf0908189bd9`. Uncommitted work in progress (snapshot client, access cache tests).
- **ADR 0036 S7** (commit reads only referenced content): `agent-a4f64ace2d4d3c19b`. Uncommitted work in progress (Convex `findEquipment` reader).
- **Next after these,** in order:
  1. The ADR 0035 Amendment 12 record-shape slice.
  2. ADR 0035 S2 (room store).
  3. ADR 0036 S8–S10.
  4. D65 (Cloudflare web hosting).
  5. The Q18 follow-ups.
  6. The queued pre-beta rules work.
- **Open questions:** Q19 (live cursors and ping).
