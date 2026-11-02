# Rules engine — UAT scenarios

Feature `RULES` in the [phase ledger](../../roadmap/08-phase-ledger.json). Set up first: [README](README.md#setup).

The rules engine is mostly invisible. A tester sees it in two places: authored forms that show, hide and require fields as the author's choices change, and live-table decisions that pause the game until someone answers and then resume exactly where they left off. These scenarios tie to those visible flows; the engine's internals are listed under Covered elsewhere.

## UAT-RULES-1: Authoring forms show, hide and require fields as choices change

- **Covers:** RULES-1.1
- **Accounts:** P1
- **Preconditions:** Review data built. Authoring experience (Settings, Preferences) set to Guided.

**Steps**

1. **P1:** Open http://localhost:3000/spells/new.
2. **P1:** Note which fields are shown. Change the Spell's level from a leveled Spell to a cantrip and note which fields appear or disappear.
3. **P1:** Change it back. Check whether any field you had filled in earlier has been cleared.
4. **P1:** Choose a field whose answer reveals more fields (for example the kind of duration, casting time or targeting). Pick each option in turn and note the new fields.
5. **P1:** Leave a newly revealed required field empty and try to **Activate**.
6. **P1:** Fill in the revealed field, then switch back to the option that hides it.
7. **P1:** Switch to the option again and check the field's value.
8. **P1:** Open http://localhost:3000/creatures/new and repeat steps 4-7 on one choice that reveals a group (for example adding an attack or a trait).
9. **P1:** Discard both drafts.

**Expected**

- Fields appear and disappear immediately as the choice changes; no stale fields remain on screen.
- A field that is required only for one choice is marked required only while that choice is selected.
- Step 5: publishing is refused with a message naming the missing field and the step it is on.
- Step 6-7: a field hidden by your choice has its value cleared; it is empty when it reappears.
- Required rules, options and labels are the same after reload of the saved draft.

**Other users see**

- Not applicable: single user.

## UAT-RULES-2: A started Encounter pauses for answers and resumes with nothing half-applied

- **Covers:** RULES-1.2, RULES-1.4
- **Accounts:** GM, P2
- **Preconditions:** Review data built. P2's **Roll my dice automatically** is OFF (the review default). The GM completes the existing Encounter of Review: Fire and Thunder first (**Complete encounter** in the turn menu), then plays here. Heavy setup: G5. The review Campaigns use the Speed Factor initiative variant, whose start prompts differ from a plain initiative roll, so the GM first changes the Campaign's table settings to standard initiative (the variant is frozen into each new Encounter). Open the tabletop of that Campaign for the GM and P2 ([README](README.md#running-several-users-side-by-side)).

**Steps**

1. **GM:** In Review: Fire and Thunder, with standard initiative set in the Campaign's table settings, create a new Encounter on the presented Scene in Assisted mode and add the Wolf and one Goblin to it. Pyra (P2) is a combatant.
2. **GM:** Choose **Start encounter**.
3. **GM:** Watch the Encounter panel while the start is waiting.
4. **P2:** Read the pending roll prompt for Pyra's initiative. Do not answer yet.
5. **P2:** Reload the tabletop page while the prompt is open.
6. **P2:** Answer the prompt with **Roll dice**.
7. **GM:** If asked to roll initiative for the monsters, answer each prompt.
8. **GM:** When the start finishes, read the initiative order and the round counter.
9. **P2:** Look at the same initiative order.

**Expected**

- Step 3: while any answer is outstanding, the Encounter is shown as waiting; there is no half-built order, no partial round counter and no partial combat log.
- Step 5: the same prompt is still there after the reload (a decision survives a refresh).
- Step 8: after the last answer, the Encounter begins at round 1 with a complete initiative order. Nothing was applied twice.
- Step 9: P2 sees the identical order.

**Other users see**

- **P2:** Sees only their own prompt, not the GM's monster initiative prompts or any partial results before the Encounter begins.
- **GM:** Sees every prompt that is theirs (monsters), and the player's roll only after it is answered.

## UAT-RULES-3: A reaction pauses a hit; answering resumes it; privacy of the pause

- **Covers:** RULES-1.2, RULES-1.4
- **Accounts:** GM, P1, P2
- **Preconditions:** Review data built; P1 is a member of Review: Shield and Hold and has not yet used Ember's reaction this round (advance the Encounter to the next round if the review data left it used). P2 is not a member of Review: Shield and Hold; P2 is signed in on another profile and has Review: Party in the Field open to check privacy. P1's auto-roll OFF.

**Steps**

1. **GM:** Open the tabletop of Review: Shield and Hold and advance to the Wolf's turn.
2. **GM:** Have the Wolf attack Ember from the action drawer.
3. **GM:** Read the Encounter panel while the attack is waiting.
4. **P1:** Read the reaction prompt that appears for Ember (Shield).
5. **P1:** Close the tab, wait a few seconds, and reopen the tabletop. (Alternatively set the browser's Network panel to Offline for 10 seconds and back.)
6. **P1:** Read the prompt again, then choose **Use reaction**.
7. **P1:** If asked, roll or enter the dice and let the attack complete.
8. **GM:** Read the Encounter history for this attack.
9. **GM:** Advance through Ember's turn (her reaction becomes available again) to the Wolf's next turn. Repeat steps 2-4, then choose **Skip decision** instead of waiting.
10. **P2:** In P2's own window, try to open the tabletop of Review: Shield and Hold (paste its address).

**Expected**

- Step 3: the attack is held; Ember's hit points and slots have not changed yet.
- Step 4: Ember's controller (P1) sees the prompt; the GM can see that a decision is pending but cannot be fooled into resolving it as P1 unless they choose the GM override.
- Step 5-6: the same prompt is still waiting after the reconnect; no duplicate prompts.
- Step 7: after the answer, the attack finishes once: Shield's bonus applies to that attack (a hit can become a miss) and a first-level slot is spent.
- Step 8: the history shows one attack, the reaction, and the outcome, each once.
- Step 9: **Skip decision** treats a declinable choice as declined and play continues; no slot is spent.
- Step 10: P2 is refused (not a member); nothing of the Campaign is shown.

**Other users see**

- **GM:** Sees the pending state and the final result.
- **P2:** In the Party in the Field window sees nothing of this Campaign's decision, dice or prompts at any step.

## UAT-RULES-4: Healing keeps its dice and modifier visible in the roll card

- **Covers:** RULES-1.5
- **Accounts:** GM, P1
- **Preconditions:** Review: Party in the Field Encounter under way with Aria damaged (the review data leaves her hit by the Wolf; if she is at full hit points, have the GM damage her through the Encounter first). Aria is a level-1 Fighter, so her heal is Second Wind (a bonus action, dice plus a modifier). Ember has no healing Spell, so there is no fallback: if Second Wind is not offered, record it as a finding.

**Steps**

1. **P1:** Open the tabletop of Review: Party in the Field and wait for Aria's turn (advance turns as GM if needed).
2. **P1:** Note Aria's current hit points.
3. **P1:** Open the action drawer and choose Second Wind (or the heal available).
4. **P1:** At the roll prompt, choose **Roll dice**.
5. **P1:** Read the roll card shown in chat.
6. **P1:** Note Aria's hit points afterwards.

**Expected**

- The roll card shows the dice (for example 1d10) and the added modifier separately, then the total.
- Hit points rise by that total, capped at maximum.
- One heal produces one roll card, not two.

**Other users see**

- **GM:** Sees the same roll card in chat and Aria's updated hit points.

## UAT-RULES-5: An attack with two damage parts keeps each part visible

- **Covers:** RULES-1.6
- **Accounts:** GM, P2
- **Preconditions:** Review data built. Heavy setup: G5. In Review: Fire and Thunder, complete the existing Encounter and create a new one (as in UAT-RULES-2; standard initiative is not needed here). Find an SRD Creature whose attack has two damage types in its stat block at http://localhost:3000/creatures (for example one with a bite that adds acid or poison damage); the GM adds it to the new Encounter beside Pyra.

**Steps**

1. **GM:** Open the Creature's page and read its attack: note each damage part (dice and damage type).
2. **GM:** Start the Encounter and bring the turn to that Creature (Pyra answers any initiative prompt as in UAT-RULES-2).
3. **GM:** From the action drawer choose that attack against Pyra. Answer the attack roll (and any damage prompt) so it hits; if it misses, undo or repeat on its next turn.
4. **GM:** Read the roll card in chat and the Encounter history entry for the hit.
5. **P2:** Read the same card in P2's window, then read Pyra's hit points before and after.
6. **GM:** Reload the tabletop and read the card again.

**Expected**

- The roll card lists each damage part as its own line with its dice, damage type and result, then one total; the parts are not merged into a single untyped number.
- Pyra's hit points drop by the total (less any resistance she has: she has none).
- The Encounter history shows one hit with the same parts, once.
- After the reload the card and history show the same parts and total.

**Other users see**

- **P2:** The same roll card (or the same totals) once the attack resolves; no pending prompts belonging to the GM's monster rolls.

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC        | Why not a UAT step                                                                                                                                                                                    |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RULES-1.3 | Rejection of tampered or invalid resume evidence (26 runtime tests): a tester would have to forge stored decision data. The honest pause-and-resume path is exercised in UAT-RULES-2 and UAT-RULES-3. |
| RULES-2.1 | CI file-size and import-budget guardrails; no running behaviour.                                                                                                                                      |
| RULES-2.2 | Golden harness pinning compiled checksums; a test harness over every SRD effect.                                                                                                                      |
| RULES-2.3 | One d20 settlement function behind every check, save and contest; behaviour unchanged for players, which the ATTACK and SPELLS journeys exercise.                                                     |
| RULES-2.4 | One sealed-choice lifecycle and pause union in code; behaviour unchanged, and the pauses themselves (reactions, saves, initiative) are exercised in UAT-RULES-2, UAT-RULES-3 and the REACTION file.   |
| RULES-2.5 | Single event table and dispatch site; a code structure with no new play behaviour.                                                                                                                    |
| RULES-2.6 | Effect-action compiler decomposition; an internal refactor.                                                                                                                                           |
| RULES-2.7 | Capability registry and a neutral second-System tracer; no second System exists to play.                                                                                                              |
| RULES-2.8 | File splits below the size budget and one home for initiative cursor ordering; an internal refactor, with turn order exercised in the ENCOUNTER file.                                                 |
