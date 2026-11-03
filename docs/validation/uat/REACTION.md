# Reactions and decisions — UAT scenarios

Feature `REACTION` in the [phase ledger](../../roadmap/08-phase-ledger.json). Set up first: [README](README.md#setup). Accounts: [README](README.md#accounts). Review data: [README](README.md#review-data). Several users: [README](README.md#running-several-users-side-by-side). Record results: [README](README.md#recording-results). Gaps: [README](README.md#known-uat-gaps).

This file proves that when an attack or spell triggers a reaction, the right person is asked, the hit waits with no timer, the GM can skip a stuck decision, the dice flow works with Auto-roll on and off, and Shield, Counterspell and authored reaction spells resolve correctly.

## UAT-REACTION-1: Shield prompts the right player while the attacker waits

- **Covers:** REACTION-1.1, REACTION-1.2, REACTION-3.1, REACTION-4.1, REACTION-4.4, REACTION-4.5
- **Accounts:** GM, P1
- **Preconditions:** Review data loaded. Campaign **Review: Shield and Hold** (GM and P1 only; Ember has Shield and the Wolf is in the Encounter). Ember's Shield is already used once in the review data, so start a new round: the GM uses **Next turn** until Ember's reaction is available again (a new round). P1 has Auto-roll ON. The Wolf must have a second attack available later in the round for step 11 (if it has only one, the GM uses another hostile creature added to the Encounter). Reset the review data afterwards.

**Steps**

1. **GM:** Open the live table. Note Ember's hit points, armor class, remaining first-level slots and that her reaction is available.
2. **GM:** Advance to the Wolf's turn. Have the Wolf attack Ember with an attack that will hit (use the roll the app produces).
3. **P1:** Confirm a reaction prompt appears for Ember offering **Use** or **Decline**, and that the hit has not been applied yet (Ember's hit points unchanged).
4. **GM:** Confirm you see the attack held and waiting, and that no timer is running.
5. **P1:** Wait 60 seconds without answering. Confirm nothing is applied.
6. **P1:** Close the tab and reopen the live table. Confirm the prompt is still there.
7. **P1:** Choose **Use**. Confirm one first-level slot is spent, Ember's reaction is used and her armor class goes up.
8. **GM:** Confirm the Wolf's hit became a miss if the new armor class beat the roll, and read the history.
9. **GM:** Choose **Undo last action**. Confirm the reaction, the slot and the hit are restored.
10. **GM:** Advance to the Wolf's next turn and have it attack Ember again (repeat steps 2 to 3), then **P1:** choose **Decline**. Confirm the hit is applied and Ember's reaction and slot are not spent.
11. **GM:** Repeat steps 2 to 3 once more, then **P1:** choose **Use**. Then, in the same round, have the Wolf (or the other hostile) attack Ember again. Confirm no second reaction is offered (one reaction per round).
12. **GM:** Advance to the next round and confirm Ember's reaction is available again.
13. **P1:** On Ember's turn, try to cast Shield from the ordinary action list (not as a reaction). Read the refusal.

**Expected**

- The Use/Decline prompt reaches only Ember's controller (P1) and the GM.
- The hit waits for the answer with no timer; the prompt survives a reload.
- Use spends the reaction and slot and the new AC counts against the triggering attack; Decline applies the hit; undo restores everything.
- A creature gets one reaction per round (step 11); Decline leaves the reaction and slot unspent (step 10).
- A reaction-only spell such as Shield cannot be cast as an ordinary action (step 13).
- After the reload in step 6 the prompt shows the same offer, not a new one.

**Other users see**

- **GM:** Sees the attack held while the decision is open and sees who has answered.
- **P2/P3:** Not members of this Campaign; they see nothing of it.

## UAT-REACTION-2: Only the right controller answers; GM Skip decision

- **Covers:** REACTION-1.1, REACTION-1.2, REACTION-1.4, REACTION-3.1
- **Accounts:** GM, P1, P2, P3
- **Preconditions:** **Review: Party in the Field**, Assisted, the round 2 Encounter under way. Bryn's reaction is available (not spent this round) and the GM can place the Wolf next to Bryn. Step 9 needs a save prompt: the GM causes a saving throw for Aria with any available effect (if none is available in the Wolf or Goblin actions, record step 9 as not run). Reset the review data afterwards.

**Steps**

1. **P1:** On Aria's turn, move Aria away from the Wolf to trigger an opportunity attack.
2. **GM:** Confirm a Pending decision appears for the Wolf's controller (the GM). Do not answer yet.
3. **P1:** While waiting, try to move another token or undo anything. Read the "Waiting on a movement decision." message.
4. **P2:** Look at the table. Confirm you cannot see the decision's choices and cannot answer it.
5. **P2:** Try to answer for the Wolf (any reaction control). Read the refusal.
6. **GM:** Choose **Skip decision**. Confirm the movement continues, the opportunity attack is treated as declined and no reaction was used.
7. **GM:** Place the Wolf next to Bryn, then move the Wolf away from Bryn so Bryn's opportunity attack is offered to P2 as a Use/Decline choice. **P1:** Try to answer for Bryn. Read the refusal.
8. **P2:** Answer **Use** or **Decline** for Bryn.
9. **GM:** Create a decision that cannot be skipped (an initiative roll or a save prompt). Try **Skip decision**. Read the refusal.
10. **GM:** Repeat step 7 and, instead of P2, answer the decision for Bryn yourself (the GM can answer for anyone). Confirm it resolves.

**Expected**

- Only the reacting creature's controller (or the GM) can answer; the attacker's player cannot answer for someone else.
- **Skip decision** cancels a paused action and treats declinable choices as declined.
- It is refused for decisions play cannot continue without (initiative, saves, Recharge, legendary dice, dice during a move).
- While a movement decision is open, moves, undo and door changes are blocked.

**Other users see**

- **P3:** Sees no decision text for choices they do not own, and sees no Use/Decline controls.
- **P2:** After the answer, sees the continuing result.

## UAT-REACTION-3: Roll prompts, Auto-roll on versus off

- **Covers:** REACTION-2.1, REACTION-2.2, REACTION-2.3, REACTION-2.4
- **Accounts:** GM, P1
- **Preconditions:** **Review: Party in the Field**. Run first with P1's Auto-roll OFF (the review default), then ON. Step 4 needs advantage or disadvantage: if none arises naturally, the GM applies a condition such as Prone to the Wolf first (reset the review data afterwards). Step 6 uses **Review: Shield and Hold**, where Ember's reaction must be available (UAT-REACTION-1 preconditions).

**Steps**

1. **P1:** Confirm the **Auto-roll** switch is OFF. On Aria's turn attack the Wolf.
2. **P1:** At the roll prompt choose **Roll dice** three times. Open the roll log and confirm every attempt is recorded without settling the attack. Then confirm the attack: the card must use the roll from the latest attempt in the log.
3. **P1:** Make another attack; this time type physical dice faces instead (any legal d20 faces) and commit. Confirm the attack settles using the faces you entered.
4. **P1:** Make another attack that has advantage or disadvantage (see Preconditions). Confirm the app preselects the mode and gives the reason. Change the mode and commit; confirm the card labels the change.
5. **P1:** Switch Auto-roll ON. Attack again. Confirm no roll prompt appears and a card posts.
6. **P1:** In Shield and Hold, get a reaction prompt for Ember (as in UAT-REACTION-1 steps 2 to 3) while Auto-roll is on. Confirm you are still asked **Use** or **Decline**; only dice are rolled for you.
7. **P1:** Open Settings, Preferences, and confirm **Roll my dice automatically** shows on; sign in on another browser and confirm it is on there too.
8. **GM:** Turn your own Auto-roll OFF and ON; confirm it only affects the GM's creatures' rolls.

**Expected**

- Every **Roll dice** attempt is logged; the settled result uses the last app roll or the typed faces (never a value you could not see in the log).
- A changed d20 mode is labelled on the card and stored beside the derived mode.
- Auto-roll never makes a choice for you.
- The setting is saved to your account on every device.

**Other users see**

- **GM:** Sees a roll card for each settled roll but not the unsettled attempts.

## UAT-REACTION-4: Counterspell and chains

- **Covers:** REACTION-4.1, REACTION-4.3
- **Accounts:** GM, P1, P2
- **Preconditions:** Heavy setup: build the Characters and the Mage Encounter by hand. Your own Sandbox Campaign (UAT-SCENE-1) with P1 and P2 each assigned a Character built in the Builder as a level 5 caster who knows Counterspell with a third-level slot (the review casters Ember and Pyra do not know Counterspell), and an Encounter with a Mage creature. All three tokens are within range of each other. Players' Auto-roll ON; GM's OFF.

**Steps**

1. **GM:** Have the Mage cast a leveled spell at P1's Character.
2. **P1:** Confirm a Counterspell Use/Decline prompt appears for P1's Character. **P2:** Confirm one appears for P2's Character (each its own controller) and not for P1's.
3. **P2:** Choose **Use** with a slot at least as high as the spell. Confirm the spell is countered and the slot spent.
4. **GM:** Repeat with P2 using a lower slot. Confirm the ability check is asked and a failed check still spends the slot.
5. **P1:** When P2 counters, answer **Use** for your own Counterspell on P2's cast. Confirm the chain resolves innermost first.
6. **GM:** Read the history of the single triggering occurrence.

**Expected**

- The chain resolves innermost first inside one occurrence; a countered cast spends its slot and action and has no effect.

**Other users see**

- **P1, P2:** Each sees only their own prompt; both see the final result. Nobody sees the other's slot choices until it resolves.

## UAT-REACTION-5: An authored reaction spell (Absorb Elements)

- **Covers:** REACTION-4.2
- **Accounts:** GM, P1
- **Preconditions:** **Review: Shield and Hold**: Ember (P1's Character) is a caster, is in the Encounter with the Wolf, and her reaction and a first-level slot are available (see UAT-REACTION-1 preconditions). P1 and the GM open the live table; P1 also opens **/spells**. Reset the review data afterwards.

**Steps**

1. **P1:** In the Spell editor, create a homebrew copy of Absorb Elements (copy the SRD one, since SRD spells are read-only) or author a reaction spell with the same trigger (the caster takes damage of chosen types), a resistance effect and a follow-up damage benefit.
2. **P1:** Publish it and learn it on Ember. Author the spell's chosen damage types to include piercing (the Wolf's bite).
3. **GM:** On the Wolf's turn have it bite Ember.
4. **P1:** Confirm a reaction prompt offers the spell. Choose **Use**.
5. **GM:** Read the history: the resistance applied before the damage and the follow-up benefit was granted.
6. **P1:** Edit the spell so piercing is no longer a chosen type and publish. **GM:** Have the Wolf bite Ember again in a later round. Confirm no prompt offers the spell.

**Expected**

- The authored spell triggers like the SRD ones: resistance before damage, a follow-up benefit.

**Other users see**

- **GM:** Sees the same reaction in history.

## UAT-REACTION-6: Disarm evidence from participants

- **Covers:** REACTION-1.3
- **Accounts:** GM, P1, P2
- **Preconditions:** Heavy setup: build the Campaign and Run by hand. Your own Sandbox Campaign (UAT-SCENE-1) with P1's and P2's Characters each holding a weapon (set on their Sheets), Assisted, the Disarm optional rule enabled in table settings and a new Run started with a Wolf (UAT-ENCOUNTER-3 steps 3 and 5). The review Encounters are already running and cannot take the new rule.

**Steps**

1. **GM:** Have the Wolf attempt Disarm against P1's Character.
2. **P1:** Confirm a prompt for evidence (a roll) appears for your Character; provide it.
3. **P2:** Confirm you do not see P1's prompt and cannot answer it.
4. **GM:** Try to answer a second time. Confirm a stale or already-resolved refusal.
5. **P1:** Open your Character's Sheet and confirm the held item changed once.

**Expected**

- Only participants provide evidence; a non-participant or stale answer is refused; one action and one item change result.

**Other users see**

- **P2:** Sees the final card only.

## UAT-REACTION-7: Reconnect while a decision is open

- **Covers:** REACTION-1.1, REACTION-1.2
- **Accounts:** GM, P1
- **Preconditions:** **Review: Shield and Hold**, a pending reaction prompt for P1 (see UAT-REACTION-1 steps 1 to 3). Reset the review data afterwards.

**Steps**

1. **P1:** In your browser's Network panel set throttling to "Offline" for 30 seconds, then back to "No throttling".
2. **P1:** Confirm the page reconnects by itself and the Shield prompt is still waiting.
3. **GM:** Meanwhile confirm the attack is still held.
4. **P1:** Answer **Use**. Confirm the result is applied once.

**Expected**

- The decision survives reconnect; temporary previews may vanish but the decision does not.

**Other users see**

- **GM:** Sees the attack stay held throughout and sees no duplicate prompt for P1 after P1 returns.

## Run notes

One entry per failed, blocked or skipped run, newest first, linked from the [tracker](TRACKER.md). Use the scenario id as a `###` heading, then the date, the build (commit or staging build name), the tester, the step number and the details listed in [When a scenario fails](README.md#when-a-scenario-fails).
