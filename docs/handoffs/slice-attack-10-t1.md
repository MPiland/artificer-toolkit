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
  - Active-effect definitions are immutable (`schemaVersion 2`, checksummed), so the observer set lives in the mutable lifecycle (`concealedFromActorIds`); the definition's `LOCATION_CONCEALMENT` carries `stealthTotal`. Search, the GM command and the move prune update the lifecycle through `updateLifecycleCas`.
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
