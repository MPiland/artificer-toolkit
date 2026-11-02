# Attacks and actions — UAT scenarios

Feature `ATTACK` in the [phase ledger](../../roadmap/08-phase-ledger.json). Set up first: [README](README.md#setup). Accounts: [README](README.md#accounts). Review data: [README](README.md#review-data). Several users: [README](README.md#running-several-users-side-by-side). Record results: [README](README.md#recording-results). Gaps: [README](README.md#known-uat-gaps).

In this file "Auto-roll ON" means the players' setting; the GM's stays OFF, so monster rolls raise a roll prompt the GM answers. Aria, Bryn and Cade are level-1 Fighters with a club: no Extra Attack and no spells. Casters are Ember (Review: Shield and Hold) and Pyra (Review: Fire and Thunder). Scenarios that need other Characters (levelled, multiclassed or two-weapon) use P1's Character in the Sandbox Campaign built in the Builder (Heavy setup: G5; a player can have only one Character per Campaign, so swap with **Change Character** on the Party panel). Several scenarios change review data: reset it (README setup steps 2 to 5) when you need it clean again.

This file proves a GM and up to three players can fight at the same time: each player acts only for their own Characters on their own turn, Assisted mode warns (and lets the GM or player proceed when the rule is bendable), the GM can undo the last action, and the combat rules, monster attacks and class features resolve as the SRD says.

## UAT-ATTACK-1: Effects, movement, reactions and the turn lifecycle pass end to end

- **Covers:** ATTACK-1.1, ATTACK-2.1, ATTACK-2.5, ATTACK-3.1, ATTACK-8.1, ATTACK-17.1, ATTACK-17.2, ATTACK-19.1
- **Accounts:** GM, P1, P2, P3
- **Preconditions:** Review data loaded. **Review: Party in the Field**, Assisted, round 2 under way. All four users have the live table open in separate profiles. P1, P2 and P3 have **Auto-roll** ON for steps 1 to 14 (switch it on in the tabletop header first).

**Steps**

1. **GM:** In the live table, read the round number, whose turn it is, and every hit point total. Write them down.
2. **GM:** Use **Next turn** until it is Aria's turn.
3. **P1:** Open the action drawer. Confirm the actions that cannot be used right now appear dimmed with a reason. Pick the weapon attack for Aria.
4. **P1:** Confirm the map shows a range ring around Aria's token and targetable creatures highlighted. Hover the Wolf and read the distance and roll modifiers shown. Press Esc and confirm targeting stops; pick the attack again.
5. **P1:** In targeting mode, open the Encounter drawer. Confirm the actor list is now sorted by distance with range shown. Click the Wolf on the list, not the map, and confirm it is the same target as clicking on the map would give.
6. **P1:** Confirm the attack. Read the roll card (hit or miss, damage, advantage reasons) and the Wolf's new hit points. Aria's club is her main-hand weapon, so damage is the full weapon roll plus her ability modifier.
7. **P1:** Aria has one attack in her Attack action (no Extra Attack), so confirm the drawer offers no further attack as part of that action and shows no "Attack 1 of 2". (Seeing "Attack 1 of 2" needs an Extra Attack Character: UAT-ATTACK-9 step 6a.)
8. **P1:** Drag Aria's token one square away from the Wolf. Read the movement readout ("used / budget ft").
9. **GM:** When the Pending decision for an opportunity attack appears, choose **Use reaction** for the Wolf. Read the result. Note that no decision reached P2 or P3 (they were not in the audience).
10. **P1:** Choose **End turn**. Confirm the turn moves to the next creature in order.
11. **GM:** Act for the Wolf on its turn: attack Aria. Aria has no reaction feature, so no reaction prompt should reach P1; note that none appears.
12. **GM:** Advance through Bryn's and Cade's turns. Each of **P2** and **P3** attack a hostile creature on their own turn using the same steps 3 to 6.
13. **GM:** Complete a full round. Confirm the round number rose by one and that the turn-start steps ran in order for any creature that needed them (Recharge, death save, start-of-turn effects).
14. **GM:** Open the Encounter history and read the entries: each action, movement, reaction and turn change appears once.

**Expected**

- Each player could act only for their own Character on that Character's turn; the same drawer, targeting ring and range list worked the same for each of the three players.
- Attack results change hit points on screen; a hit, miss or critical shows the dice and reasons.
- Turn order wraps. Taking the Attack action spends the Action once; with one attack in the action, no further attack is offered under it and no warning appears for the one attack made.
- Every step above appears in the history in order with the actor's name.

**Other users see**

- **P2, P3:** Every attack, movement and reaction outcome appears live; the opportunity-attack decision is not shown to them while it is open.
- **P2 (during P1's turn):** The action drawer shows P2's own Character actions only as unavailable out of turn.

## UAT-ATTACK-2: Players control only their own actors

- **Covers:** ATTACK-2.2, ATTACK-2.3, ATTACK-2.4
- **Accounts:** GM, P1, P2
- **Preconditions:** **Review: Party in the Field**, Assisted, Encounter active. Auto-roll ON for P1 and P2.

**Steps**

1. **GM:** Advance to Aria's turn.
2. **P2:** Try to attack with Aria (open the drawer, or select Aria's token and try to use an action). Read the refusal.
3. **P2:** Try to move Aria's token. Read the refusal.
4. **P1:** Try to act for the Wolf (select its token and try an action). Read the refusal.
5. **P1:** While it is still Aria's turn, use an action for Aria. Confirm it works.
6. **GM:** Advance to Bryn's turn.
7. **P1:** Try to attack with Aria out of turn. Read the refusal.
8. **GM:** Mark the Goblin's token hidden from players. **P2:** On Bryn's turn, open the target list and confirm the Goblin is not listed.
9. **P1:** Start an attack and, before confirming, quickly click confirm twice (double-click). Confirm only one attack resolves and that you cannot have two Encounter commands in flight.
10. **GM:** Open the Goblin's **Controllers** and give P2 control, then advance to the Goblin's turn. **P2:** Confirm you can now act for the Goblin and end its turn.
11. **GM:** Advance to the Goblin's next turn and remove P2 from the Goblin's controllers. Confirm P2 can no longer act for it.
12. **P2:** Try again to act for the Goblin. Read the refusal.

**Expected**

- Acting for another player's Character, an uncontrolled creature, acting out of turn, or targeting a hidden creature is refused with a plain message, and nothing changes in the history.
- A granted creature works until the GM revokes control.
- A second click while a command is in flight does not produce a second action.

**Other users see**

- **GM:** Sees refusals not at all in history (rejections change nothing); sees granted and revoked actions normally.
- **P3:** Sees only accepted actions on the table.

## UAT-ATTACK-3: Assisted warnings and "Do it anyway"

- **Covers:** ATTACK-3.2, ATTACK-8.3
- **Accounts:** GM, P1, P2
- **Preconditions:** **Review: Party in the Field**, Assisted. Auto-roll ON. Aria must be the active actor.

**Steps**

1. **P1:** On Aria's turn, pick an attack and aim at the Wolf. Move Aria's token away first so the Wolf is out of weapon range (use a square or two more than her reach).
2. **P1:** Confirm. Read the warning and confirm it has a **Do it anyway** button.
3. **P1:** Choose **Do it anyway**. Confirm the attack resolves.
4. **GM:** Open the Encounter history. Confirm the entry shows an override badge.
5. **P1:** Spend the Action (attack), then try a second action that needs an Action. Read the warning and choose **Do it anyway**.
6. **P1:** Use Aria's Second Wind (a limited-use feature), then try it a second time and, if a warning with **Do it anyway** appears, choose it. Check Aria's Second Wind uses on the Sheet: confirm they never go below zero.
7. **P1:** Target a friendly creature (Bryn) with an attack. Read the disposition warning and confirm it offers **Do it anyway** (the dimmed-with-reason actions of UAT-ATTACK-1 step 3 and this friendly-target warning are ATTACK-3.1, covered in UAT-ATTACK-1).
8. **P1:** On the Sheet unequip Aria's club, then try an attack with it from the drawer. Read the warning.
9. **P2:** On Bryn's turn, try to act out of turn for Aria. Confirm the refusal has no **Do it anyway** button.
10. **P1:** In a duplicate browser tab with an old copy of the page (do not reload), try to act again after the Encounter changed in the other tab. Confirm a stale-information refusal with no **Do it anyway**.
11. **GM:** Complete the Encounter (this ends the Review Encounter; reset the review data afterwards). **P1:** From the old tab try an action on the completed Encounter. Confirm refusal with no **Do it anyway**.

**Expected**

- Out of range, wrong target disposition, no action left and unequipped weapon warn with **Do it anyway**; an overridden action works and the GM sees a badge on it in history.
- Never overridable: not allowed to act, acting out of turn, stale information, an invalid game state. These have no **Do it anyway**.
- Overrides never drive a resource such as a spell slot or charges negative.
- Aria's Attack action has one attack, so a second attack is not offered as part of it and shows the action-economy warning with **Do it anyway** (step 5). That an extra attack that fits the open action raises no warning is shown in UAT-ATTACK-9 step 6a.

**Other users see**

- **GM:** The history shows each override with a badge and the player's name; other players do not see the override badge.

## UAT-ATTACK-4: Undo last action and its refusals

- **Covers:** ATTACK-3.3, ATTACK-8.4
- **Accounts:** GM, P1, P2
- **Preconditions:** **Review: Party in the Field**, Assisted, no pending decision. Auto-roll ON. Step 7 uses **Review: Shield and Hold**. Step 10 ends the Review Encounter, so reset the review data afterwards.

**Steps**

1. **P1:** On Aria's turn, attack the Wolf. Note the Wolf's hit points before and after.
2. **P1:** Look for an undo control. Confirm players cannot undo anything at the live table.
3. **GM:** In the Encounter turn menu choose **Undo last action**. Confirm the Wolf's hit points are back to the value before the attack, Aria's action is available again and the attack slot is returned.
4. **GM:** Choose **Undo last action** again right away. Read the refusal (nothing to undo or already undone).
5. **P1:** Attack again. Then **GM:** move any token. Then **GM:** **Undo last action**. Read the refusal (a later change touched an affected actor) and the "adjust manually" message.
6. **P1:** Attack again. **P1:** before the GM undoes, edit Aria's hit points or spend her Second Wind from the Sheet. **GM:** try **Undo last action**. Read the refusal (Sheet changed since).
7. **GM:** Switch to **Review: Shield and Hold** (GM and P1 only), where Ember holds Concentration on Hold Person. Have the Wolf attack Ember until a hit forces a Concentration check that Ember fails (or type a low roll when prompted), so the Concentration ends. **GM:** try to undo that damage action. Read the refusal naming what cannot be restored.
8. **P1:** Begin an action that raises a Pending decision (move out of an enemy's reach). While the decision is open, **GM:** try **Undo last action**. Read the refusal.
9. **GM:** Back in **Review: Party in the Field**, place a zone (hazard) with the zone tool as in UAT-MOVE-8 step 1 and use **Undo placement**. Confirm the zone disappears.
10. **GM:** Complete the Encounter, then try **Undo last action**. Read the refusal.

**Expected**

- Undo exactly restores hit points, conditions, resources, effects, action used and slots when the action was the latest change.
- Undo is refused with a plain explanation when a decision is pending, the Encounter is not active, it was already undone, a later command or Sheet write touched an involved actor, or the action involved something the app cannot rewind (contest, escape, mirrored damage, ended Concentration).
- After undo the action cannot be redone.

**Other users see**

- **P2:** Sees hit points and the history return to the earlier state live.
- **P1:** Sees the attack disappear from history with a note that the GM undid it.

## UAT-ATTACK-5: Targeting, hidden creatures and private roll cards

- **Covers:** ATTACK-17.3, ATTACK-17.4, ATTACK-17.5, ATTACK-17.6, ATTACK-10.5, ATTACK-10.6
- **Accounts:** GM, P1, P2
- **Preconditions:** **Review: Party in the Field**. The GM creates the hidden state in the steps. Steps 7 and 10 add creatures to the Encounter (Heavy setup: G5; reset review data afterwards). GM Auto-roll OFF; P1 and P2 Auto-roll ON.

**Steps**

1. **GM:** Mark the Goblin's token hidden from players (token menu), or use Hide for it.
2. **P1:** Start an attack on Aria's turn. Confirm the map and target list show no Goblin.
3. **GM:** Reveal the Goblin to players as an unnamed unseen creature. **P1:** Confirm an unknown-distance entry now appears first in the list, marked hidden or invisible, then the visible creatures nearest first.
4. **GM:** Reveal it by name. **P1:** Confirm the name appears.
5. **GM:** Open the observer list for the Goblin (the hidden-creature panel). Add P1's Character as an observer, then remove it.
6. **P2:** Look for the Goblin's observer information. Confirm players never see that list.
7. **GM:** Add a Quasit to the Encounter, mark it hidden, and on its turn use its Scare against Aria. **P1:** Read Aria's save prompt and its reasons: confirm they show only what Aria knows and do not name the hidden Quasit. **GM:** Confirm your own view of the same save shows the full reason.
8. **GM:** Give P2 control of the (still hidden) Goblin in its **Controllers**, and advance to the Goblin's turn.
9. **P2:** Attack Aria with the Goblin. **P2:** Confirm you see your own roll card for it. **P1:** Confirm you do not see that card. **GM:** Confirm you see the full card.
10. **GM:** Add a spellcasting creature (for example a Mage) that holds a Concentration spell, mark it hidden, and give P2 control of it. Have it take damage that forces a Concentration check. **P2:** Confirm you see a private Concentration check card. **P1:** Confirm you do not. **GM:** Confirm you see the full card. (If no available creature can hold Concentration, record ATTACK-17.6 as not shown.)

**Expected**

- Players' maps and lists show only creatures they can see; hidden ones are neither drawn nor listed. Unnamed revealed creatures are listed first with unknown distance.
- Players never see which observers a hidden creature is hidden from.
- Prompts and reasons shown to players never name a hidden fact; the GM sees the full reason.
- Private roll cards reach only the roller and the GM.

**Other users see**

- **P1, P2:** Each sees only their own private cards; P1 never sees P2's cards for the hidden creatures, and P2 never sees the GM's private rolls.

## UAT-ATTACK-6: Hiding, invisibility and unseen attackers

- **Covers:** ATTACK-10.1, ATTACK-10.2, ATTACK-10.3, ATTACK-10.4
- **Accounts:** GM, P1, P2
- **Preconditions:** **Review: Party in the Field**. Auto-roll ON for P1; P2 has the live table open. Step 6 applies a condition to Aria, so reset the review data afterwards.

**Steps**

1. **P1:** On Aria's turn choose the Hide action and complete its Stealth check.
2. **GM:** Read the Encounter history. Confirm it says which creatures failed to notice Aria.
3. **P1:** Attack the Wolf from hiding. Read the roll reasons: advantage from an unseen attacker.
4. **P1:** Confirm that after attacking Aria is no longer hidden.
5. **GM:** On the Wolf's turn make the Wolf attack Aria. Read the roll reasons: the reasons should reflect whether the Wolf sees Aria.
6. **GM:** Give Aria the Invisible condition (via a condition effect). Have the Wolf attack. Read the disadvantage reason.
7. **GM:** Have Aria use Dodge. Confirm Dodge checks sight (no benefit against an attacker who cannot see).
8. **P1:** Move Aria out of the Wolf's reach and let the Wolf make an opportunity attack. Confirm the same sight rules apply (read the reasons).
9. **GM:** Open the Wolf creature's stat block and confirm its Senses list is structured (for example darkvision with a range).

**Expected**

- Hide hides from creatures that fail to notice; attacking or being noticed ends it; attacks from hiding have advantage.
- Invisible and unseen attackers or targets get advantage or disadvantage, and the reasons name it; opportunity attacks apply the same rules.
- Creature Senses are structured definitions.

**Other users see**

- **P2:** Sees the roll cards but not Aria's hidden state reasons unless the GM reveals them.

## UAT-ATTACK-7: Optional combat rules in play

- **Covers:** ATTACK-1.3, ATTACK-4.1, ATTACK-4.2, ATTACK-12.1, ATTACK-12.2, ATTACK-12.3, ATTACK-12.4, ATTACK-13.1, ATTACK-13.2, ATTACK-13.3, ATTACK-15.1, ATTACK-15.2, ATTACK-15.3, ATTACK-16.1, ATTACK-16.2
- **Accounts:** GM, P1, P2
- **Preconditions:** The Sandbox Campaign (Assisted) with P1's and P2's Characters, and a Wolf and Goblin Blueprint (UAT-ENCOUNTER-3 step 2). The Review Encounters are already running, so they cannot take new settings. The GM enables, in table settings under **Optional combat rules**, Facing, Flanking, Marking, Cleaving, Injuries and Massive damage (those offered), then starts a new Run (UAT-ENCOUNTER-3 steps 3 and 5). If a rule is not offered, record that (the AC says each appears only once it resolves). GM Auto-roll OFF, so you can type physical dice faces for steps 9 and 10.

**Steps**

1. **GM:** Open table settings and confirm the rules above are listed. Select them. Save. Start an Encounter. Confirm "Facing rule is active" or similar shows.
2. **P1:** On P1's Character's turn, move and set the Character's facing at the end of the move. Confirm arcs are drawn.
3. **P1:** Attack a creature from its rear arc. Read the roll evidence: advantage naming the arc.
4. **P1:** Try to attack a creature that is in your own Character's rear arc. Read the refusal.
5. **GM:** Replace the Encounter's optional rule selection on the active Encounter and save. Read the confirmation. Try replacing with a rule from another System (if shown). Read the refusal.
6. **P1/P2:** Position P1's and P2's Characters on opposite sides of the Wolf. **P1:** Melee attack and read the flanking advantage reason. **P2:** Move your Character away; **P1:** attack again on a later turn and confirm no advantage.
7. **P1:** Make a melee attack. Confirm the target now shows a mark. Have **P2** hit the same target; confirm marks are one per attacker.
8. **GM:** On the Wolf's turn move the Wolf (marked by P1's Character) out of P1's Character's reach. **P1:** When the opportunity attack decision appears for you, choose **Use reaction**; confirm the attack has advantage and your reaction is still available afterwards. **GM:** Move the Wolf back and out again in the same turn; confirm no second marked opportunity attack is offered.
9. **GM:** Make the Wolf hit a Character with a critical hit (type a natural 20 at the roll prompt). Confirm the GM is offered a roll on the lingering-injury table. Accept; open the Character's Sheet and confirm the injury and its healing text. Remove it as GM.
10. **GM:** Make an attack (typing maximum damage dice) that deals damage to a creature of at least half its hit point maximum from one source. Confirm a Constitution save is prompted. Fail it; confirm a system-shock result is applied.
11. **P1:** Attack with a Cleaving weapon (whatever weapon the rule applies to; record which), killing the target with excess damage. Confirm the excess carries to the next target in the chain.

**Expected**

- Facing, flanking, marking, injuries, massive damage and cleaving each change the roll or offer a prompt exactly as described, and the roll evidence names the arc or flank.
- Rules not offered in settings are listed as a gap in the results.

**Other users see**

- **P2:** Sees arcs, marks and flanking evidence on the table; sees an injury on P1's Character only through the Sheet if it is shared with the party.

## UAT-ATTACK-8: Grapple, shove and basic actions

- **Covers:** ATTACK-7.1, ATTACK-7.3, ATTACK-7.4, ATTACK-7.5, ATTACK-7.6, ATTACK-7.7, ATTACK-18.2, ATTACK-18.3, ATTACK-18.1, ATTACK-7.9
- **Accounts:** GM, P1, P2
- **Preconditions:** **Review: Party in the Field**, Aria adjacent to the Wolf. Players' Auto-roll ON, GM's OFF. Steps 8, 10 and 13 add creatures or Characters (Heavy setup: G5; reset the review data afterwards).

**Steps**

1. **P1:** On Aria's turn open the action drawer and find Grapple and Shove. Confirm they are offered (Aria has a free hand).
2. **P1:** Choose Grapple against the Wolf. Read the contest: Athletics against the Wolf's Athletics or Acrobatics, rolled by the GM.
3. **GM:** Answer the Wolf's roll prompt. Confirm a win applies **Grappled** to the Wolf.
4. **GM:** On the Wolf's turn have it use its Action to escape. Confirm the escape check and its DC.
5. **P1:** Grapple again. Move Aria's token. Confirm the Wolf is dragged at half speed. Confirm no opportunity attack was offered for dragged creatures.
6. **P1:** Release the grapple with no action. Confirm Grappled is removed.
7. **P1:** Shove the Wolf. On a win choose knocked prone or pushed 5 feet; read the result.
8. **GM:** Add a creature two sizes larger than Aria (for example a Dragon) to the Encounter. **P1:** Try Grapple on it. Read the refusal.
9. **P1:** On the Sheet equip a second weapon so both of Aria's hands hold weapons, then try to Grapple. Confirm the app prompts to stow one for free.
10. **GM:** Add a Cloaker and have it Bite Aria so she is grappled. **P2:** On Bryn's turn use Bryn's Action to make the escape check for Aria. Confirm Aria is freed on success (ATTACK-7.9).
11. **GM:** Use Dash, Disengage, Dodge, Help and First Aid once each; confirm they work as before and appear unavailable when the actor does not meet the restriction.
12. **GM:** Open the System's basic actions catalogue. Confirm SRD basic actions are read-only and can be copied into a homebrew System.
13. **GM:** Create a homebrew Crusher feat (any-direction 5-foot push on a bludgeoning hit) from a copy of the SRD feat, and build a Sandbox Character who has it (the review Characters do not). **That player:** hit a creature with a bludgeoning weapon. Confirm the mover can pick a legal unoccupied square.

**Expected**

- Grapple and shove follow the contest rules; riders and counts appear on tokens; holds show a Grappled condition and a held-at-once limit.
- Basic actions are locked in the SRD and copyable into a homebrew System.

**Other users see**

- **P2:** Sees Grappled and prone conditions on tokens and the contest cards, and (step 10) is the one who rolls the escape check.

## UAT-ATTACK-9: Class features in play

- **Covers:** ATTACK-8.2, ATTACK-8.4, ATTACK-9.1, ATTACK-9.2, ATTACK-9.3, ATTACK-9.4, ATTACK-9.5, ATTACK-9.6
- **Accounts:** GM, P1
- **Preconditions:** The Sandbox Campaign with P1 as a member (Heavy setup: G5). The review Characters are level-1 Fighters with no Extra Attack, so P1 builds these in the Builder first: a Barbarian, a Rogue, a Fighter of level 5 (Extra Attack, Second Wind, Action Surge), a Paladin with spell slots, a Character with two light melee weapons, and the multiclasses Fighter 5 / Ranger 5, Fighter 11 / Paladin 5 and Fighter 20. A player can have only one Character per Campaign, so before each group of steps the GM uses **Change Character** on P1's seat in the Party panel to assign the right one and starts a fresh Encounter (a Wolf plus the Character). Players' Auto-roll ON; GM's OFF.

**Steps**

1. **GM:** Assign the Barbarian to P1's seat and start an Encounter with a Wolf.
2. **P1:** As the Barbarian, use Rage as a bonus action. Confirm a rage charge is spent and resistance and the damage bonus apply.
3. **P1:** As the Barbarian, try to cast a spell while raging. Read the refusal. End Rage by choice.
4. **GM:** Undo the Rage action. Confirm the charge returns.
5. **P1:** As the Barbarian, Rage again and end the turn without attacking a hostile or taking damage. Confirm Rage ends at the end of the turn (ATTACK-9.6).
6. **GM:** Complete the Encounter, assign the Rogue to P1's seat and start an Encounter. **P1:** As the Rogue, make a hit with advantage. Confirm Sneak Attack dice are added once. Hit a second time in the same turn; confirm no second dice.
   - 6a. **GM:** Complete, assign the Fighter 5 and start an Encounter. **P1:** Take the Attack action. Confirm the drawer shows "Attack 1 of 2" with the last weapon and target kept, make the first attack, then make the second without a warning. **GM:** Undo the second attack and confirm its slot is returned and the first attack stays.
   - 6b. **P1:** As the Fighter 5, use Second Wind (heals 1d10 + level) and Action Surge (extra action). Confirm each is limited to its uses per short rest.
7. **GM:** Complete, assign the Paladin and start an Encounter. **P1:** Hit with a melee weapon. Confirm the app offers Divine Smite; spend a slot and confirm the radiant dice.
8. **GM:** Complete, assign the Character with two light weapons and start an Encounter. **P1:** Attack with the main hand and confirm the off-hand bonus attack is offered and adds no positive ability modifier.
9. **GM:** For each multiclass in turn (assign, start an Encounter), **P1:** open the Attack action and read how many attacks it offers (Fighter 5 / Ranger 5 makes 2, Fighter 11 / Paladin 5 makes 3, Fighter 20 makes 4).

**Expected**

- Each feature resolves with the described dice, limits and undo; Extra Attack takes the highest source, not the sum.
- Step 6a: with two attacks, the drawer shows "Attack N of M" and the second attack raises no warning; each attack keeps its own roll and undo.
- (The authoring-parity half of ATTACK-9.1 to 9.6, that an author-built equivalent resolves identically, is proved by the ledger tests.)

**Other users see**

- **GM:** Sees each feature in history; sees the Barbarian's rage and condition icons on the token.

## UAT-ATTACK-10: Multiattack and SRD monster attacks

- **Covers:** ATTACK-1.2, ATTACK-5.1, ATTACK-5.2, ATTACK-5.3, ATTACK-5.4, ATTACK-5.5, ATTACK-5.6, ATTACK-5.7, ATTACK-5.8, ATTACK-5.9, ATTACK-5.10, ATTACK-5.11, ATTACK-5.12, ATTACK-5.13, ATTACK-5.14, ATTACK-5.15, ATTACK-7.2, ATTACK-7.8, ATTACK-11.1, ATTACK-11.3, ATTACK-11.4
- **Accounts:** GM, P1
- **Preconditions:** Heavy setup: G5. Reset the review data afterwards. The GM builds one Encounter (Review: Party in the Field after completing its Encounter, or the Sandbox with P1's Character as the target) with, as separate creatures: Balor, Clay Golem, Cloaker, Dryad, Duergar, Kraken, Purple Worm, Quasit, Rug of Smothering, Shadow, Spirit Naga, Shambling Mound, Brown Bear and Drider. Auto-roll ON.

**Steps**

1. **GM:** For each creature in turn, open the action drawer on its turn and use its listed attack once against Aria (the GM can raise Aria's hit points from the Sheet if she falls). For each, record the roll card and any rider shown.
2. **GM:** Balor Whip: confirm forced movement and no opportunity attack for the pulled creature.
3. **GM:** Cloaker Bite: confirm the Grappled outcome and escape DC shown.
4. **GM:** Kraken Lightning Storm: confirm the save prompts.
5. **GM:** Purple Worm Tail Stinger: confirm the poison rider and save.
6. **GM:** Quasit Claws then Scare: confirm each rider.
7. **GM:** Shadow Strength Drain: confirm the Strength reduction.
8. **GM:** For swallow, engulf, curse, disease and lycanthropy riders, confirm a GM ruling note appears beside the damage.
9. **GM:** On the Brown Bear, begin its Multiattack: confirm the drawer shows what is left and offers only the allowed attacks (it cannot bite twice). Confirm the drawer preselects the only possible next attack and keeps the last target. End the Multiattack early.
10. **GM:** On the Drider, confirm its Bite swap is offered once. Confirm a Recharge attack not ready is not offered.
11. **GM:** On the Shambling Mound, hit with both slams; confirm Grappled and then Engulf is offered on a Medium or smaller target.
12. **GM:** Open the Creature editor on a copy and confirm Multiattack authoring (slots, alternatives, swaps, conditions) and the grapple rider fields (escape DC, size limit, held-at-once count). Try publishing an invalid Multiattack; confirm refusal.
13. **GM:** Repeat any attack with a replay (reload the page mid-action) and confirm charges are not re-spent and dice are not rerolled.

**Expected**

- Every SRD monster attack resolves without "unsupported"; rare riders appear as a GM ruling note; Multiattack offers only valid next attacks; recharge and charges persist across reload.

**Other users see**

- **P1:** Sees only attacks aimed at Aria and her saves; sees rider notes only when they affect Aria.

## UAT-ATTACK-11: Weapons in hand, loadouts and Disarm

- **Covers:** ATTACK-1.1, ATTACK-6.4, ATTACK-6.5, ATTACK-6.6, ATTACK-19.1, ATTACK-19.2, ATTACK-19.3, ATTACK-19.4
- **Accounts:** GM, P1
- **Preconditions:** The Sandbox Campaign (Assisted) with P1's Character built in the Builder with two light melee weapons (main hand and off hand) and a shortbow with arrows (Heavy setup: G5; the review Aria has only a club). The GM enables **Track ammunition** in table settings, then starts a new Run with a Goblin (UAT-ENCOUNTER-3 steps 3 and 5). GM has the Goblin's actor card open in two browser tabs for steps 5 to 7. P1's Auto-roll ON.

**Steps**

1. **P1:** On P1's Character's turn, attack. Confirm the main-hand weapon and full damage are used; the off-hand attack as a bonus action adds no positive ability modifier unless the Character has Two-Weapon Fighting.
2. **P1:** Empty a hand (stow one weapon), then attack with the other. Confirm the attack draws the bound weapon into the free hand automatically.
3. **P1:** Throw a weapon. Confirm it leaves the hand. Swap weapons and confirm swaps are free.
4. **GM:** Attempt Disarm against P1's Character in Assisted mode. Confirm the player must give evidence (a roll) and the item leaves the held hand.
5. **GM:** Replace the Goblin's loadout (active Creature actor) from the actor card. Confirm the new loadout appears and the Goblin's next attack uses it.
6. **GM (tab A and tab B):** On the Goblin's turn, with its attack ready to confirm in tab A, replace the loadout in tab B and confirm the attack in tab A within a second of each other.
7. **GM:** Read the Encounter history and the Goblin's loadout.
8. **P1:** With ammunition tracking on, fire the shortbow until the stack is empty. Confirm the next shot is refused. Turn tracking off in a new Encounter and confirm the bonuses still apply and nothing is counted.

**Expected**

- Weapons move between hands as described; ammunition is counted only when tracking is on, with one piece per shot.
- Steps 6 to 7: either the attack resolved with the old loadout and then the loadout changed, or the loadout changed and the attack was refused or resolved with the new one; the history shows each once, the Goblin's loadout is the new one, and nothing is half-applied.

**Other users see**

- **P1:** Sees the item-held change on the Sheet and the Goblin's attack result on the table; sees no loadout internals.

## Covered elsewhere

| AC          | Why not a UAT step                                                                                                                            |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| ATTACK-6.1  | The loadout's stored contract shared by authoring and Encounters; checked by schema tests. The behaviour it supports is UAT-ATTACK-11 step 5. |
| ATTACK-6.2  | A source-data audit of the Creature equipment, not something a screen shows.                                                                  |
| ATTACK-6.3  | A shared derivation path (Creature and Character gear use one code path) with no behaviour change a tester could see.                         |
| ATTACK-11.2 | A stat-block audit over all 142 SRD Multiattacks. UAT-ATTACK-10 spot-checks the visible effect on a sample of monsters.                       |
