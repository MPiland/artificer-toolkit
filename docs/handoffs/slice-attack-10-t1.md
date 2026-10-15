# Slice workbook: ATTACK-10.T1 (Hide)

**Status:** IN_PROGRESS (started 2026-10-15), phase 1 design
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
