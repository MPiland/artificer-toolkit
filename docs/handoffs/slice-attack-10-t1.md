# Slice workbook: ATTACK-10.T1 (Hide)

**Status:** IN_PROGRESS (started 2026-10-15), phase 2 implementation (red-first)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

D100 automated attack-roll sight (`packages/rules-runtime/src/encounterAttackPerception.ts`, believed vs true mode in `encounterAttackBelief.ts`), but Hide is still only logged. SRD 5.1:

- Hide is a Dexterity (Stealth) check. A creature is hidden from each observer whose Wisdom (Perception), passive or from a Search, does not beat the check.
- You can't hide from a creature that sees you clearly.
- A hidden creature's location is unknown to that observer.
- Attacking from hiding has advantage, and attacking reveals the hider.
- An observer who notices the hider ends the hidden state for that observer.

"Unseen" (D100) and "hidden" are different states:

- **Unseen:** an invisible creature is unseen, but its location is known.
- **Hidden:** the location itself is unknown to that observer. ATTACK-17.T4 (attacking an empty square, the GM resolves who is there) builds on exactly that.

Constraints:

- **ADR 0038:** Hide is the SRD basic action from the System catalogue (Q11, `prepareSrdDefinitions`). The hidden state, its contest and its end triggers come from core options: a check contest, a per-observer relationship state and end events. Nothing Hide-specific in code. Rogue Cunning Action (Hide as a bonus action) must work with no new code.
- **D100 no-metagaming ruling:** the hiding player sees their own Stealth total, but never which observers failed to notice them; the GM sees all of it. Observer-side prompts never name the hidden fact.
- **Eligibility comes from perception, not a free choice:** an observer who currently SEES the hider (D100 combat perception: lighting, obscurement, barriers, Invisible, Senses) can't be hidden from. The GM can still decide circumstances (SRD: "the DM decides when circumstances are appropriate for hiding"). Propose the smallest GM path that fits the existing GM override patterns.
- **Ends:** the hider attacks, which reveals it to everyone; an observer's Search succeeds; or an observer comes to see the hider clearly, for example the hider moves into its sight. GM undo restores the state.

### Phase 1: design (stop and send it before writing product code)

Send the main session one design packet (`SendMessage`), then wait for approval. It covers:

1. **The authored model:** the check contest, the per-observer state, end events and the catalogue entry, with file:line evidence of what exists today. Check relationship conditions, end events, Search and the basic-action catalogue.
2. **How hidden feeds attack resolution:** advantage from hiding against that observer, and the location-unknown fact ATTACK-17.T4 will read. Also how the believed vs true mode treats it.
3. **Redaction:** what each viewer sees (hider, observers' controllers, GM).
4. **The persisted or contract changes,** options with tradeoffs, and a recommendation.

### Phase 2: implementation, after approval

Red-first, per the checklist below.

## Closes

- AC ATTACK-10.2.

## Red-first checklist (phase 2)

1. The SRD Hide basic action compiles from the catalogue through core options. This fails on base.
2. **In the Worker:**
   - a Hide with a Stealth total above one observer's passive Perception and below another's is hidden from the first only;
   - an observer that sees the hider clearly is never in the hidden set.
3. An attack from hiding has advantage against that target and reveals the hider to everyone.
4. A successful Search reveals the hider to the searcher. GM undo restores the prior state.
5. **Redaction:** the hiding player's view and other players' views never name the failed observers. The GM's view does.
6. **Journey:** a Worker Encounter journey through real code: hide, attack from hiding with advantage, and the hider revealed.

## Status log

- 2026-10-15: workbook written.
- 2026-10-15: phase 1 design packet sent (notes folder `attack-10-t1-design-packet.md`); APPROVED option A. Rulings:
  - Generic `CONCEAL_FROM_OBSERVERS` effect, PASSIVE and CONCEALMENT DC kinds, `LOCATION_CONCEALMENT` state contribution, per-observer DC freezing; nothing Hide-specific in code. Update ADR 0038 and the engine guide; add no D-number.
  - **Ties go to the observer**: noticed when the observer's score (passive or Search total) >= the Stealth total. One rule for both; a tie test for each.
  - Believed mode: the hider believes the targets in its set are unaware; the true mode cancels with the existing generic caption.
  - GM command `SET_CONCEALMENT_OBSERVERS` (add or remove observer ids on an existing effect; GM only; in the receipt; undoable).
  - Sees-clearly end: read-time derive plus a prune on the commit of any token move on the Scene (hider or set member), one call site in the movement files (shared with SPELLS-17.T1: sync first). Lighting and other Scene edits go through the GM command.
  - Search is in scope.
  - Do NOT fix Invisibility's dead `ON_ATTACK_ROLL` end event; if widening consumption would start consuming Invisibility, stop and tell the main session.
- 2026-10-15: implementation decisions (phase 2):
  - Active-effect definitions are immutable (`schemaVersion 2`, checksummed), so the observer set lives in the mutable lifecycle (`concealedFromActorIds`); the definition's `LOCATION_CONCEALMENT` carries `concealmentTotal`. Search, the GM command and the move prune update the lifecycle through `updateLifecycleCas`.
  - The check pipeline is extended with a `resolution` discriminant on `BASIC_ACTION_CHECK` (no new command type); Escape stays its own command.
  - `consumableGrants` widens to modifier grants OR `LOCATION_CONCEALMENT` effects only, so Invisibility (condition path) is untouched.
  - Scope is large (about 25 files reference `BASIC_ACTION_CHECK`, about 10 per effect kind, about 15 compiler sites). Delivery is in green increments: (1) foundation + pure rules, (2) pipeline, Worker, GM command, prune, journey, docs.
  - Storybook runs: none (cannot run in a worktree); the web drawer model change is covered by unit tests only.
- 2026-10-15: findings and risks recorded during phase 2:
  - **Escape DC gap (follow-up).** The shared check DC schema now offers `PASSIVE` and `CONCEALMENT`, but `encounterEscapeCheck.ts` honours only `FIXED`; an authored Escape with another kind is not rejected at authoring. Register a small follow-up (reject at compile, or support).
  - **Passive mapping convention.** A passive is mapped to its skill by name (`PASSIVE_<SKILL>` to skill `<SKILL>`, `passiveSkillDefinitionId`). A System that names a passive otherwise gets no passive score. A frozen per-actor passive override (a feature that sets passive Perception) is not modelled; the score is 10 + the skill total, plus or minus 5 for advantage or disadvantage.
  - **Fallbacks.** A `CUSTOM` observer (no frozen modifier) is treated as seeing the hider (never in the set). A stored concealment with an empty set is inert and still occupies the hider's concealment until consumed, so a second Hide while hidden is refused as a warning rather than stacking.
  - **Settled-in-create context.** The settled-in-create concealment context is bound to the command only (`commandId`), not to the roller beyond the pending record. First Aid has the same gap; not widened here.
  - **Response path.** The concealment settle needs no per-observer target loads, since the frozen context holds every DC.
  - **Redaction is by construction.** `listActiveGrantListings` lists only `MODIFIER_GRANT` contributions, `projectPlayerEncounterProjection` has no concealment field, rule receipts are never served to players, the pending read has `dc: null`, and timeline entries default to PRIVATE. Tests prove it: player timeline and pending read carry no observer ids; the GM read does.
  - **red1 result.** Nine of ten red-1 files failed on the stale base `dist` (expected). True green needs the ordered builds under the heavy lane.
  - **Invisibility.** Not touched. `consumableGrants` widens only to `LOCATION_CONCEALMENT` effects; a unit test proves an effect that is neither a grant nor a concealment is not consumed by an attack.
  - **Proposed ledger edit (main session applies).** ATTACK-10.T1 done once the checklist is green; ATTACK-10.2 closed; ATTACK-17.T4 unblocked (waited only on Hide). Add a follow-up task for the Escape DC gap above.
  - **Validation denial.** A read of the lock/queue files with `ls` was denied by a deny rule; I stopped and did not retry. I do not know the queue state; build1 is queued under `attack-10-t1-build1`.
- 2026-10-15: CI iterations on `ci/attack-10-t1` (cloud, since the local heavy lane never acquired its lock):
  - Runs 38770160981, 38771064999: TS7056 in `packages/schema`. Fixed with an explicit `EncounterConcealmentCheckPendingContextDto`, an explicit `ConcealmentCheckSettlement`, and an explicit `ServerRuleExecutionApplicationOutputsDto` union. A `ZodMiniType`-annotated schema cannot be a `discriminatedUnion` member, so the union or the consumer is annotated, not the members.
  - Run 38771983271: `encounterActionEffects.ts` TS2339 (the stored Character plan has no `concealmentContribution`); the plan is widened to the adapter's `CharacterRuleActionActiveEffectPlan`.
  - Run 38772706419 (single "Build packages" job): build passes; Typecheck web, Typecheck Convex/Worker/packages, Packages and Worker and Convex shard 1 fail. Their logs were unreachable behind GitHub's shared API rate limit; the next run (7b5723196) is read once the limit lifts.
  - A GitHub log read and one earlier `ls` of the lock directory were denied/limited; neither was retried another way.
- 2026-10-15: Scene gating (increment 2, part 1). On a Scene an observer that really sees the hider has noticed it: the Worker reads each non-allied observer's placement on the action's locked Scene (`readNativeLiveObserversSeeing`, per-observer pair capture, spatial effects once) and a Hide never freezes those observers into the set; `resolveAttackSight` leaves the Scene to decide, and uses the persisted set only without a Scene. Without a Scene (D94, everyone sees everyone) the GM decides circumstances. Test: a wall puts two of three Wolves out of the hider's sight, and the one in sight is never in the set.
- 2026-10-15: open ruling asked of the main session: the move-time prune (needs post-move perception in the Worker room and a receipt entry so undo restores it; touches the persisted move receipt, shared with SPELLS-17.T1).
- 2026-10-15 (main session): Invisibility's unconsumed end events are registered as SPELLS-27. The approved prune is on any token-move commit by the hider or a set member, plus a read-time guard.
- 2026-10-15 (main session, prune undo): "receipt" is approved; derive-only is rejected. Each prune entry (effect id, holder, observer ids before and after) is recorded with the move command, and the GM's undo of that move restores the pruned observers on an effect that still exists; it never re-creates an ended one. **Proposed ledger edit:** record this as a D-number at merge (main assigns it).
- 2026-10-15: prune implemented and wired.
  - Plan: `planConcealmentPrune` (Worker, from the predicted Scene and the movement plan's targets). Apply and receipt: `applyConcealmentPrune` inside the MOVEMENT branch of `executeRoomSceneGeometry`, after the Scene publish, through `updateLifecycleCas`; the receipt is the room evidence row `sceneConcealmentPrunes` [sceneId, commandId]. Undo: `publishRoomSceneUndo` calls `onUndone(targetCommandId)`, which runs `restoreRoomConcealmentPrune` in the same transaction.
  - **Deviation from the "both branches" ruling.** The GEOMETRY branch (`expectedEncounterVersion === null`) cannot move a token bound to an ACTIVE Run (`assertStandaloneMovement` refuses it), so a prune there would be dead code. Only the MOVEMENT branch prunes.
  - Limits: automation MANUAL plans no movement targets, so nothing is pruned (GM command is the override); undo unions `before - after` onto the current set, so it composes with later GM edits.
  - Stale generated types: `apps/apis/convex/_generated/api.d.ts` is tracked and bakes in inferred DTOs; the new `LOCATION_CONCEALMENT` contribution broke the web typecheck until codegen regenerates it.
  - Tests: `apps/session-worker/test/nativeRoomConcealmentPrune.test.ts` (hider move prunes and undo restores; observer move prunes; effect ended in between stays ended).
- Phase 2 complete. SRD Hide/Search catalogue expectations and manifest regenerated (97f25d0d0); Search test now advances to the searcher's initiative turn (b362e2acb). Cloud CI run 38787642952 on `ci/attack-10-t1` is green on every job (builds, all typechecks, Convex 1-4, packages and Worker, web). Earlier `developmentLifecycleProof` failure (run 38781197096, suite 3/4) did not recur and is treated as a flake.

## Merge review round 1 (2026-10-15, main session; list frozen)

Reviewed commit 745eb25b4. Fixes land at their cause, red first, then scoped tests and CI on `ci/attack-10-t1`.

Frozen list:

- **Blocker 1.** Hide and Search roll cards must be private (GM plus the roller's controller), whatever the roller's public flag or the GM's preference. Proof through the real path: another player gets no card or total; a GM hider with a PUBLIC preference shows no player a card; no non-GM frame carries observer ids or the total.
- **Blocker 2.** Believed mode must not reveal which observers failed. Ruling: believed mode treats the hider as hidden from any non-allied target while it holds a concealment effect; true mode still uses the set and cancels with the existing caption.
- **3.** The compiler rejects PASSIVE without CONCEAL_FROM_OBSERVERS and CONCEALMENT without DETECT_CONCEALED (one test each).
- **4.** `encounterActionEffectPlans.ts` carries the authored consume events (no hard-coded `ON_ATTACK_ROLL`), proved with an authored variant.
- **5.** The passive-to-skill link is authored data in the System, not derived from a `PASSIVE_<SKILL>` code.
- **6.** A discriminant replaces `'createdEffect' in settlement`.
- **7.** The Escape DC offers FIXED and CONTEST only, in the schema, the authored type and the node map, tested through node-runtime resolution.
- **8.** A type-level equality assertion for `EncounterConcealmentCheckPendingContextDto`.
- **9.** `revertConcealmentCheck` throws `unavailable(...)` on a stale version.
- **Nits.** Unused exports dropped; one observer-set normalizer and one set-equality method (`normalizeObserverActorIds`, `sameObserverActorIds`); the `input` wrapper in `nativeConcealmentPrune.ts` removed; `stealthTotal` renamed `concealmentTotal`.

Resolutions:

- Blocker 1: `asHiddenRoller` (`ruleRollCards.ts`) forces the card private; the concealment settlement and the app-roll path (`evidenceRolls.ts`) both use it. Tests: `nativeRoomHideAction.test.ts`, "who sees the Hide and Search rolls" (GM hider with the room's PUBLIC preference, player hider on both dice paths, another player's frames).
- Blocker 2: `resolveAttackSight` believed guard is "concealment present and relationship not ALLIED"; tests in `encounterAttackPerception.test.ts` (noticed by A but not B gives the same believed prompt against both; true mode differs).
- 3: `concealCompile.test.ts`. 4: variant with `ON_ABILITY_CHECK` plus `ON_ATTACK_ROLL`, `GrantConsumeEvent` being only those two. 5: `systemPassiveDefinitionDtoSchema.skillDefinitionId` (additive, v4 System), SRD passives author it. 6: `isConcealmentCheckSettlement`. 7: `escapeDcDtoSchema`, `ESCAPE_DC_NODE_MAP` (`escapeDc`), `escapeDcOptions.test.ts`. 8: `concealment-check-pending-context.test.ts`. 9: `actionRevert.ts`. Reachable (review round 2): an uninterrupted voluntary token move writes no Run command but prunes the observers, which bumps the effect version, so a Hide undo after it is refused. Room test "refuses to undo the Hide once a token move pruned its observers" (`nativeRoomHideAction.test.ts`).
- Nit not done: `concealmentObserverCommand.ts` still scans the actors for the effect. The store indexes an effect by (encounter, holder, id) and the command carries no holder, so an id-only lookup needs a `holderActorId` on the command (a transport contract change). The GM tracker UI that issues this command needs the holder with the effect id anyway; add it there.

Report-only answers:

1. **Attack sight on a Scene ignores the persisted set.** Intended, and it is the SRD rule (you cannot hide from a creature that sees you clearly): on a Scene the geometry decides who sees the hider, the prune keeps the set honest for Search and the GM, and only the neutral environment (D94, no Scene) falls back to the set. Consequence: a GM edit of the set has no effect on attacks while a Scene is active. If main wants the GM override to bind on a Scene too, the change is one line (also UNSEEN when the observer is in the set), made safe by the prune.
2. **No slice owns a UI for `SET_CONCEALMENT_OBSERVERS`.** The ledger has no item for it, and the GM Encounter projection carries no concealment (no effect id, holder or observers; player projections have none either). Needs a registered PBI on the GM tracker/token surface: project the GM-only concealment with its effect id and holder, and issue the command. Main registers it.
3. **`restoreRoomConcealmentPrune` is safe, by design.** It runs in the same room transaction as the Scene undo, so nothing interleaves. It only adds back `before - after` (the observers the move itself dropped), never removes, so a GM's later edit is kept. It never recreates an ended effect, and it returns silently when the Run is not the held one because the concealments of a Run that is not active matter to no one. Residual: an observer a later Search removed is re-added by the undo of the earlier move. A version fence (item 9's rule) would need an `afterVersion` on the persisted prune entry and would block the Scene undo itself over a nuance, so it is not added.
4. **A Scene-undo prune restore does not republish the Encounter projection, and needs none today**: no projection carries concealment (see 2) and the Encounter stream version does not move. The GM-tracker PBI must republish when it adds the projection.

Contract changes in this round (flag for main): the System v4 `passives[].skillDefinitionId` (additive, optional); the Escape `dc` narrowed to FIXED and CONTEST (pre-launch, no authored Escape uses another kind); the persisted `LOCATION_CONCEALMENT` field renamed `stealthTotal` to `concealmentTotal` (pre-launch; no data migration, local dev Runs reset).

## Independent review (2026-10-15, opus, read-only) and what was done

Fixed:

- **B2 (item 9).** Reachable: an uninterrupted voluntary token move writes no Run command but its prune bumps the effect version, so a Hide undo after it is refused (`unavailable`, concealment kept). Room test "refuses to undo the Hide once a token move pruned its observers"; the item 9 text above is corrected.
- **S1.** `docs/architecture/rules-runtime.md` now states the ruled believed mode (hidden from any non-allied target while a concealment exists).
- **S3.** The compiler rejects a conceal or detect outcome on a non-check action (`concealCompile.test.ts`).
- **S4.** Formatter churn restored from base (betterAuth `_generated`, `sheetCommands.ts`, `characterActiveEffects.ts`, `activeEffectGrantTotals.ts`, `characterHandRuleFacts.ts`, `walkingSpeed.ts`, `characterAbilities.ts`, `authoredRouteStory.fixtures.ts`, the timings doc).
- **S5.** `systemPassiveDefinitionDtoSchema.skillDefinitionId` is required and nullable (one absence).
- **N1.** The three local aliases import the exported `EncounterConcealmentCheckPendingContextDto`. **N2.** The `sourceId!` owner is `turnEffectOwner`.

Stands, with the reason:

- **B1 (GM view of the failed observers).** No GM Encounter projection carries any concealment today (report-only answer 2), so the GM-facing surface is a new projection plus the GM tracker UI that issues `SET_CONCEALMENT_OBSERVERS`. It changes a transport contract and needs its own registered PBI; this slice proves the negative half (no player-visible frame carries observers) and the stored/receipt half. Main decides whether it joins this AC.
- **S2.** On a Scene-bound Run with no `sceneContext`, observers are not Scene-gated (the neutral-environment rule, D94). Warning or requiring the context changes action-start behavior; flagged for main, not changed.
- **N3, N4, N5, N7.** The `afterVersion` repeat is a plan-versus-settlement agreement check and a shared helper would be a single-use abstraction; `prepareEncounterConcealmentEffect` is exported and used by the test fixture; the `isConcealmentCheck` read and `loadDefinition` adapter are one-liners at distinct seams; N7 is the acknowledged residual above. N6: the System v4 field is recorded under "Contract changes" above.
- **Test gaps, recorded:** attack-time advantage on a Scene is proved by the journey test "gives an attack from hiding advantage"; not covered: a target-side concealment (Blocker 2 target stripping beyond the unit test), GM Roll dice with explicit PUBLIC visibility, a player Search card, `ON_ABILITY_CHECK` consumption end to end, a Character-owned concealment. Register as a follow-up test slice.
