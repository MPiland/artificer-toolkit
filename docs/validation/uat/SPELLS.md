# Saves, conditions and spells — UAT scenarios

Feature `SPELLS` in the [phase ledger](../../roadmap/08-phase-ledger.json). Set up first: [README](README.md#setup).

These scenarios play real casters and monsters through saves, conditions, dying, Concentration, areas, grants, zones and summons so a GM and players can trust the spell and rules layer at a live table. Scenarios 1 and 2 build the shared casters and arena that most later scenarios reuse; see [accounts](README.md#accounts), [review data](README.md#review-data) and [running several users side by side](README.md#running-several-users-side-by-side). Record outcomes as described in [recording results](README.md#recording-results); known holes are in [known UAT gaps](README.md#known-uat-gaps).

**Shared cast (built once in scenario 1, reused everywhere).** Spell lists are for setup; if a Character cannot prepare them all at once, prepare only what the running scenario names and swap on the Sheet.

- **Sage** (P1): Wizard, Evocation school, level 9, quarterstaff. Spells: Fireball, Lightning Bolt, Burning Hands, Thunderwave, Magic Missile, Scorching Ray, Shield, Counterspell, Charm Person, Hold Person, Fear, Blindness/Deafness, Invisibility, Misty Step, Dimension Door, Telepathic Bond, Find Familiar, Darkvision, Fly, Ray of Frost, Shocking Grasp, and any other cantrips you like. Equipment: Caltrops (bag of 20), Oil (flask), Hunting Trap. (Absorb Elements is not an SRD spell; the reaction-spell journey that needs it is [UAT-REACTION-5](REACTION.md).)
- **Hale** (P2): Cleric, level 13 (needed for the 7th-level Plane Shift), mace. Spells: Spare the Dying, Aid, Bless, Protection from Energy, Spirit Guardians, Sanctuary, Shield of Faith, Blade Barrier, Word of Recall, Plane Shift, Guidance. Equipment: a Healer's Kit, 2 Antitoxin (vial) and 1 Potion of Healing.
- **Vex** (P3): Bard, level 5. Spells: Vicious Mockery, Heroism, Longstrider, Hold Person, Fear.
- **Moss** (P3's second Character): Druid, level 9. Spells: Conjure Animals, Entangle, Spike Growth, Moonbeam, Giant Insect, Insect Plague, Longstrider, Darkvision.
- **Kade** (P2's second Character): Monk, Way of the Open Hand, level 11 (holds Tranquility); only used in scenario 26.
- Scenario 27 builds three more one-off Characters for P3 (a Hill Dwarf, a Lightfoot Halfling and a Warlock).
- GM Creatures used (add from the SRD list): Goblin, Wolf, Bandit, Ogre, Gargoyle, Zombie, Giant Spider, Magma Mephit, Unicorn, Adult Red Dragon, Silver Dragon Wyrmling, Gorgon.

**Which Campaign, which Character, and when to swap.** Every scenario from 2 on runs in **Review: Party in the Field** (members P1, P2, P3). A player can have only one Character assigned to a Campaign at a time (the Party roster's **Add Character** / **Change Character** button, then pick from the Character picker), and a Character can sit in only one Campaign. So nobody ever has two Characters in this Campaign at once; they swap, and **only between Encounters** (GM chooses **Complete encounter**, the player changes Character, the GM rebuilds the arena with scenario 2 steps 4 and 5):

- **P1** plays **Sage** in every scenario (she replaces Aria in scenario 2; Aria's, Bryn's and Cade's tokens are removed from the arena because they are no longer in the Party).
- **P2** plays **Hale** in every scenario except scenario 26 part B, where P2 swaps to **Kade** (and ends the scenario as Kade).
- **P3** plays **Vex** in scenarios 2 to 18, swaps to **Moss** at the start of scenario 19 and stays Moss through scenario 26. Scenario 27 swaps P3 through three one-off Characters.
- Where a scenario completes the Encounter (6, 12, 16, 22 part B, 23), its last step says to rebuild the arena. A rebuilt arena keeps hit points, slots and conditions the Characters already have; if a caster runs short of slots, take a **Long Rest** on the Sheet between scenarios. Remove stray conditions and Exhaustion from a Character before the next scenario.
- The Encounter, the Auto-roll switch and Undo are the GM's. Players cannot undo anything.

All four accounts start with Roll my dice automatically OFF, so roll prompts appear and you can type physical dice. Scenarios that need it ON say so.

## UAT-SPELLS-1: Build the casters and cast from the Sheet outside an Encounter

- **Covers:** SPELLS-34.1, SPELLS-3.6, SPELLS-3.3
- **Accounts:** P1, P2, P3
- **Preconditions:** Review data loaded. Each player can reach `/characters`. Heavy setup: three level 5 to 11 Builder runs; allow time. Nobody is in an Encounter yet, so no Character swap is involved.

**Steps**

1. **P1:** Open `/characters`, create a new Character with the Builder: Wizard level 9, Evocation, named **Sage**, with the spell list and equipment above. Save it.
2. **P2:** Build **Hale** the same way (Cleric 13, spell list and items above).
3. **P3:** Build **Vex** (Bard 5) and **Moss** (Druid 9). Make sure all three Characters are active (the Builder asks) so they can be picked into the Campaign in scenario 2.
4. **P1:** Open Sage's Sheet. Cast **Find Familiar** from the Sheet (it is a ritual, so the Sheet allows it). Do this here, before any Encounter.
5. **P1:** Open the **Extras** tab. Confirm a Summoned entry for the familiar shows AC, speed, attacks and current and maximum hit points.
6. **P1:** Lower the familiar's hit points on the Sheet by a few points. Reload the page. Confirm the lowered count is still shown.
7. **P2:** On Hale's Sheet, edit current hit points down to 0.
8. **P2:** Confirm death save successes and failures show at 0 HP. Press **Roll death save** once (type a number 10 or higher) and see a success marked.
9. **P2:** Edit three failures into the death saves. Confirm the Sheet shows Hale as Dead.
10. **P2:** Edit current hit points to a value above 0. Confirm the Dead state clears and Hale is alive.

**Expected**

- Sage's familiar is listed in Extras with live HP; HP changes made there stay put on reload.
- The Sheet shows death saves only while at 0 HP, accepts hand edits, and rolls a death save outside an Encounter.
- A dead Character reads Dead until a Sheet HP edit above 0 revives it.
- Outside an Encounter the familiar stays in Extras until dismissed (a timed summon stays until dismissed or a long rest; scenario 22 checks that with Moss).

**Other users see**

- **P1:** Not applicable (their own Sheet only).
- **P3:** Cannot open Hale's or Sage's Sheet through their own Characters list.

## UAT-SPELLS-2: Set up the Spell Arena Encounter (Assisted)

- **Covers:** SPELLS-8.1
- **Accounts:** GM, P1, P2, P3
- **Preconditions:** Scenario 1 done. Use **Review: Party in the Field** (all of P1, P2, P3 are members). A Character must be active and not assigned to another Campaign to be eligible. This is the one scenario that swaps all three players' Characters (Aria, Bryn and Cade out; Sage, Hale and Vex in).

**Steps**

1. **GM:** Open **Review: Party in the Field**, open the Live tabletop and choose **Complete encounter** on the running review Encounter. If the GM is offered to advance the Campaign clock, choose **Not now**.
2. **GM:** In the Campaign's table settings confirm Automation mode is Assisted and the Initiative policy is the Speed Factor variant. Make sure **Automatic cover** is ticked. Save table settings if you changed anything.
3. **P1:** On the Campaign's Party roster choose **Change Character** and pick **Sage** in the Character picker (it replaces Aria). **P2:** choose **Change Character** and pick **Hale**. **P3:** choose **Change Character** and pick **Vex**.
4. **GM:** Present a Scene (the review map) and create a new Encounter. Add Sage, Hale and Vex's tokens (not Aria's, Bryn's or Cade's), and Goblin x3 in a group about 6 squares from the party, one Wolf adjacent to Sage, one Giant Spider, two Bandits, one Ogre.
5. **GM:** Start the Encounter and set initiative for everyone. Choose a turn for Sage.
6. **P1:** In the action drawer find the spell **Fireball**. Confirm it is listed once per slot level Sage can cast it at, such as "Fireball (3rd level)", "Fireball (4th level)" and "Fireball (5th level)", that cantrips appear once, and that the choice shows the spell's component text (it is shown, not enforced).
7. **P1:** Look for Find Familiar (a ritual) in the action drawer. Expected refusal: it shows as unavailable with a message to cast it from the Sheet, and no slot is spent.
8. **P1:** Cast **Magic Missile**. Confirm the slot count on the Sheet drops by one; then **GM:** choose Undo last action and confirm the slot is restored.

**Expected**

- Spells list one row per castable level; rituals are refused with a message to use the Sheet; slot spend and undo work.
- Component text appears on the choice but is not enforced.

**Other users see**

- **P2, P3:** See the same turn order and tokens; no private creature info.

## UAT-SPELLS-3: Fireball on a group with saves answered by different controllers

- **Covers:** SPELLS-7.1, SPELLS-7.2, SPELLS-8.4, SPELLS-1.1, SPELLS-1.2, SPELLS-16.1
- **Accounts:** GM, P1, P2
- **Preconditions:** Scenario 2 running. Put Hale's token inside the goblin group's blast zone on purpose (the GM drags it), so an ally is caught. GM's Auto-roll OFF, P2's Auto-roll OFF. Sage needs two 3rd-level and one 4th-level slot spare (take a Long Rest first if not).

**Steps**

1. **P1:** On Sage's turn choose **Fireball (3rd level)** and click a point on the map near the three Goblins and Hale.
2. **P1:** Before it resolves, read the list of creatures caught. Confirm Hale (an ally) and the Goblins are listed.
3. **P1:** Aim a second point far beyond the spell's range. Confirm an overridable warning, then cancel.
4. **GM:** On the pending area, remove one Goblin from the list. Confirm only the GM has that control (P1 and P2 do not).
5. **P2:** Confirm Hale's own save prompt appears for P2 only. Answer by typing a roll.
6. **GM:** Answer the two remaining Goblin save prompts, in any order, one with a low roll and one with a high roll.
7. **P1:** Confirm the action only settles after the last save is in. Read the damage on each target in the history.
8. **GM:** Open the history. Confirm damage was rolled once for the area (8d6), full on a failed save and half on a success, per target.
9. **GM:** Choose Undo last action. Confirm every target's hit points return and Sage's slot returns.
10. **P1:** Recast at the 4th-level row. Confirm 9d6 is rolled for the area and a 4th-level slot is spent.
11. **GM:** Undo the 4th-level cast. **P1 (Sage, Evocation):** Cast Fireball at the 3rd-level row again and in the caster's choices use **Sculpt Spells** to spare Hale. Confirm Hale automatically succeeds and takes no damage while the Goblins still save.
12. **GM:** Undo that cast, then switch your own Auto-roll switch ON, and have **P1** recast Fireball. Confirm the Goblin saves are rolled without a prompt, while **P2** is still asked for Hale unless P2's own Auto-roll is on. Switch the GM's Auto-roll back OFF afterwards.

**Expected**

- Each caught creature, allies and Sage's own side included, gets a save asked at once of its own controller; the area commits once.
- Removing a creature and undoing both work; undo reverts every target and the slot.
- Area actions that leave a condition on each caught creature (scenario 18) are undone together; this scenario only proves damage.

**Other users see**

- **P2:** Sees only Hale's prompt, not the Goblin prompts. Sees the final damage cards.
- **P3 (if open):** Sees the result cards but no prompts.

## UAT-SPELLS-4: Area caster cannot see a hidden creature

- **Covers:** SPELLS-7.3
- **Accounts:** GM, P1
- **Preconditions:** Scenario 2 running. Heavy setup: the GM marks a token hidden by hand.

**Steps**

1. **GM:** Add a Goblin token and mark it hidden so players are not sent it.
2. **GM:** Place it inside an area Sage will fireball, with two visible Goblins.
3. **P1:** Cast Fireball over all three.
4. **GM:** Answer all save prompts; give the hidden Goblin a failed save first time.
5. **P1:** Read the results. Confirm the hidden Goblin appears only if it failed its save.
6. **GM:** Undo, and repeat with the hidden Goblin succeeding. Confirm P1 sees nothing about it.

**Expected**

- The GM sees every target and roll.
- The caster sees the hidden creature only on a failed save, and nothing on a success; no token for it ever appears on P1's map.

**Other users see**

- **P1:** As above; the save prompt for the hidden Goblin goes to the GM only.

## UAT-SPELLS-5: Cones, lines, Self cubes and aiming on the map

- **Covers:** SPELLS-13.1, SPELLS-13.2, SPELLS-22.1, SPELLS-23.1, SPELLS-23.2
- **Accounts:** GM, P1
- **Preconditions:** Scenario 2 running with the Wolf adjacent to Sage and Goblins in a line 3 and 5 squares away. Sage needs spare 1st-level slots for Burning Hands, Lightning Bolt (3rd) and Thunderwave.

**Steps**

1. **P1:** Choose **Burning Hands**. Press on Sage's token, drag toward the Goblins and release. Confirm a cone is drawn from where you pressed in the direction you dragged and that the list shows the creatures inside it.
2. **P1:** Cast it. **GM:** answer the saves. Confirm damage per creature as in scenario 3.
3. **GM:** Undo. **P1:** Choose **Lightning Bolt**. Drag a line through two Goblins. Confirm the line catches the two it crosses.
4. **P1:** Choose **Thunderwave** and pick which side of Sage's space the cube extends from. Confirm it snaps to the grid on that side, centered along that side. Pick each of the four sides and confirm each snap.
5. **P1:** Confirm Sage is never in her own Thunderwave list.
6. **P1:** Try to pick a single point for Burning Hands (a click with no drag). Confirm it is refused with a message about needing a direction.
7. **P1:** Try to drag a direction for Fireball. Confirm a different refusal message about needing a point.
8. **GM:** Add a **Magma Mephit** next to two Goblins and reduce it to 0 HP so its Death Burst (a 5-foot area centered on itself) triggers. Confirm every creature whose token overlaps that area is caught except the Mephit, and each gets its own save (the printed DC is 11). Doubt: Death Burst's exact area wording and whether it triggers from a hand-set 0 HP or only from damage; if not, hit it with damage instead.

**Expected**

- The shape you drag is exactly the shape committed. Cones and lines catch every creature inside. A Self cube never catches the caster.
- A point given to a directed area, or a direction to a point area, gets its own refusal.

**Other users see**

- **P2:** Sees the resolved damage cards after the casting but not the aiming drag preview.

## UAT-SPELLS-6: Cover from walls and manual cover

- **Covers:** SPELLS-14.1, SPELLS-14.2
- **Accounts:** GM, P1
- **Preconditions:** Scenario 2 running. Automatic cover ON. Heavy setup: the GM draws the walls by hand on the Scene.

**Steps**

1. **GM:** Draw a wall between Sage and a Goblin leaving a gap, so the Goblin is half-covered.
2. **P1:** Cast Ray of Frost (an attack) at the Goblin. Confirm the roll shows a labelled cover bonus (+2).
3. **P1:** Cast Fireball with the cover boundary near a second Goblin. Confirm that Goblin's Dexterity save shows its cover bonus.
4. **GM:** Move a Goblin entirely behind a solid wall. Confirm total cover blocks the attack.
5. **GM:** On a creature's cover, change the tier by hand (for example to three-quarters, +5). Confirm the roll shows +5.
6. **GM:** Choose **Complete encounter**, then in table settings untick **Automatic cover** and save (the setting is frozen into an Encounter when it is created). Rebuild the arena as a new Encounter with scenario 2 steps 4 and 5, keeping the wall.
7. **GM:** In the new Encounter, confirm a Goblin half behind the wall now gets no automatic bonus. Set that target's cover tier by hand. **P1:** Attack it with Ray of Frost. Confirm the same bonus applies as when cover was automatic.
8. **GM:** To leave the later scenarios as they were, choose **Complete encounter**, tick **Automatic cover** again, save, and rebuild the arena with scenario 2 steps 4 and 5.

**Expected**

- With automatic cover on, the app shows a labelled bonus and total cover blocks; with it off, nothing is applied until the GM sets the tier by hand.

**Other users see**

- **P2:** Sees the labelled bonus in cards only on rolls they can see.

## UAT-SPELLS-7: Hold Person, Concentration, damage checks, replacement and end

- **Covers:** SPELLS-1.2, SPELLS-8.5, SPELLS-9.1, SPELLS-9.2, SPELLS-5.7, SPELLS-5.11, SPELLS-2.1, SPELLS-2.2, SPELLS-2.3, SPELLS-2.4, SPELLS-2.6, SPELLS-8.1
- **Accounts:** GM, P1, P2
- **Preconditions:** Scenario 2 running with two Bandits, the Ogre and the Wolf. Use Sage for Hold Person (Sage stays adjacent to a Bandit with her quarterstaff). Sage needs spare 2nd-level and 3rd-level slots. GM Auto-roll OFF to start.

**Steps**

1. **P1:** Cast **Hold Person** at the Ogre (not a Humanoid). Confirm an overridable creature-type warning. Cancel.
2. **P1:** Cast Hold Person at a Bandit. Confirm the action pauses on the Bandit's save for the GM. With GM Auto-roll OFF the prompt shows; **GM:** type a low roll so it fails. The Bandit shows Paralyzed.
3. **GM:** Undo last action. Switch GM Auto-roll ON. **P1:** Cast Hold Person at the same Bandit again. Confirm the save is rolled without a prompt and the action continues (if the dice let the Bandit succeed, undo and repeat until it fails). Switch the GM's Auto-roll back OFF.
4. **P1:** Confirm Sage now holds Concentration (visible on the Sheet and turn tracker).
5. **P1:** Sage attacks the Paralyzed Bandit from adjacent with her quarterstaff. Confirm advantage with a reason naming Paralyzed and that a hit is a critical hit with doubled dice. **GM:** Confirm the Bandit's movement readout is 0 while Paralyzed, and that choosing Dash does not raise it.
6. **P1:** Cast **Ray of Frost** at the Bandit from more than 5 feet away. Confirm advantage still shows but a hit is not a critical hit.
7. **GM:** Move the Wolf and bite Sage. **P1:** Answer the Concentration prompt. Confirm a DC of 10 or half the damage, whichever is higher. Fail it once and confirm Hold Person ends, the Bandit is no longer Paralyzed and its movement budget returns to its normal speed.
8. **P1:** Recast Hold Person at the Bandit (fail its save as before), then cast **Fear** at the Goblins. Confirm the new Concentration replaces Hold Person with no prompt and Hold Person's Paralyzed condition ends. **GM:** Try Undo last action; confirm it does not bring Hold Person back (it is refused or leaves it ended). Doubt: the exact refusal wording.
9. **P1:** Recast Hold Person at the Bandit, then press **End Concentration** on the Sheet status strip (the Encounter drawer has the same button). Confirm it ends with no action spent and the Paralyzed condition ends.
10. **GM:** Apply Paralyzed to the Bandit by hand from the condition control, then have it make a Strength or Dexterity save. Confirm it fails automatically even on a natural 20, with the reason shown, while a Wisdom save is rolled normally.
11. **P1:** Cast Hold Person again so Sage concentrates. **GM:** Reduce Sage to 0 HP. Confirm Concentration ends with no roll. Then heal Sage back above 0 so she can act in later scenarios.
12. **GM:** Have the **Magma Mephit** (add it to the Encounter) cast its innate **Heat Metal** (a Concentration spell) at Hale's mace, then damage the Mephit without defeating it. Confirm the Mephit is asked a Concentration check and the damage commits.

**Expected**

- The step lines above; conditions apply their mechanics with no per-condition behaviour, the derived roll mode names the condition.
- The Concentration marker belongs to Sage on her Sheet and the turn tracker; ending it removes every effect tied to it.

**Other users see**

- **P2:** Sees the Bandit's Paralyzed badge and the Concentration marker on Sage; sees no private GM rolls.

## UAT-SPELLS-8: Attack and check modifiers from conditions

- **Covers:** SPELLS-2.2, SPELLS-2.5, SPELLS-2.6, SPELLS-2.7, SPELLS-2.1
- **Accounts:** GM, P1, P2
- **Preconditions:** Scenario 2 running. Sage and a Goblin adjacent. Auto-roll OFF for P1 and P2. Step 6 needs a hidden token (Heavy setup: the GM marks a token hidden by hand). Step 7 needs a homebrew condition: the GM defines it on a homebrew copy of the System record under `/systems` and the Campaign must use that System; if the review Campaign cannot use it or no condition editor exists, record step 7 as BLOCKED with that reason (no Gn covers it). Clear every condition and Exhaustion from Sage and the Goblin when you finish.

**Steps**

1. **GM:** Apply **Poisoned** to Sage from the condition control. **P1:** attack. Confirm disadvantage with the reason "Poisoned".
2. **GM:** Replace with **Frightened**, then **Prone**, then **Restrained**. Each time confirm Sage's attacks roll with disadvantage naming the condition.
3. **GM:** Make the Goblin Restrained, Stunned, Unconscious and Petrified in turn. Confirm attacks against each have advantage naming the condition.
4. **GM:** Make the Goblin Prone. Confirm an adjacent attacker has advantage and one more than 5 feet away has disadvantage.
5. **GM:** Apply Poisoned to Sage and start an Overrun or Tumble contest. Confirm Sage's ability check has disadvantage.
6. **GM:** Add a Goblin token, mark it hidden, and make the hidden Goblin Frightened. Have it contest Hale's Overrun (or Tumble) so **P2** is asked for a roll. **P2:** Confirm the roll prompt shows disadvantage or the plain contest without naming the hidden Goblin's Frightened condition. Doubt: what exactly a player sees of a hidden holder's condition in a contest prompt.
7. **GM:** Create a homebrew condition (for example "Dazed" with disadvantage on attack rolls), apply it to Sage, and have **P1** attack. Confirm the roll shows disadvantage naming "Dazed", the same way the SRD conditions did in step 2.
8. **GM:** Set **Exhaustion** level 1 on Sage. Confirm ability checks have disadvantage; level 2 halves speed; level 3 gives attack and save disadvantage; level 5 sets speed 0.
9. **P1:** Choose Dash while Restrained and again at Exhaustion 5. Confirm the movement budget stays 0 each time and returns to normal once the condition is removed.

**Expected**

- Modes are derived with the condition named, restored when the condition is removed.

**Other users see**

- **P2:** Sees condition badges on tokens. A hidden holder's condition source is not named.

## UAT-SPELLS-9: Exhaustion 4 and 6, Petrified resistance, nonmagical defenses and automatic failures

- **Covers:** SPELLS-10.1, SPELLS-10.2, SPELLS-10.3, SPELLS-10.4, SPELLS-10.5, SPELLS-10.6, SPELLS-9.1, SPELLS-2.4, SPELLS-9.2
- **Accounts:** GM, P1
- **Preconditions:** Scenario 2 running; add a Gargoyle (resists nonmagical weapon damage) and a Magma Mephit (it can cast Heat Metal itself, which makes it a Creature that holds Concentration). Step 7 needs a homebrew condition that makes Constitution saves fail automatically (authored as in scenario 8 step 7); if it cannot be authored, mark step 7 BLOCKED and note why. Clear all conditions and Exhaustion afterwards.

**Steps**

1. **GM:** On the Goblin set Exhaustion level 4. Confirm its maximum hit points are halved on the token.
2. **GM:** Set Exhaustion level 6. Confirm the Goblin dies.
3. **GM:** Apply Petrified to a Wolf. **P1:** attack it with Sage's quarterstaff. Confirm the damage is halved (resisted).
4. **P1:** Hit the Gargoyle with Sage's quarterstaff. Confirm resistance to nonmagical damage applies. Then cast **Shocking Grasp** on it and confirm that spell hit is not resisted for being nonmagical.
5. **GM:** Make Sage Stunned and force a Dexterity save. Confirm before and after the roll that it shows "automatic failure" and why.
6. **GM:** Clear Stunned. **P1:** Cast **Hold Person** on the Goblin to hold Concentration, then the GM applies Exhaustion 3 to Sage and damages her. Confirm **P1** is asked for a Concentration check that rolls with disadvantage and the roll prompt says why.
7. **GM:** Apply the homebrew auto-fail Constitution condition to Sage while she concentrates and damage her. Confirm the check is labelled an automatic failure and Concentration ends on it.
8. **GM:** Have the Magma Mephit cast **Heat Metal** (Concentration), then damage the Mephit with Exhaustion 3 on it: same disadvantage label. Repeat with the auto-fail condition: Concentration on the Mephit ends and its Heat Metal grant ends.

**Expected**

- Exhaustion levels follow the Creature's condition row level; the GM sets the level in the Encounter; automatic failures are labelled.
- A Creature that concentrates is treated like a Character for the check and the auto-fail.

**Other users see**

- **P1:** Sees the labelled failure reasons on rolls they roll.

## UAT-SPELLS-10: Dying, death saves, healing and kills

- **Covers:** SPELLS-3.1, SPELLS-3.2, SPELLS-3.3, SPELLS-3.4, SPELLS-3.5
- **Accounts:** GM, P2
- **Preconditions:** Scenario 2 running. Hale is the target. P2 Auto-roll OFF for the first half, ON for the second.

**Steps**

1. **GM:** Reduce a Goblin to 0 HP. Confirm it is defeated as a Creature.
2. **GM:** Reduce Hale to 0 HP with damage that leaves less than her maximum HP over. Confirm Hale is Unconscious and dying.
3. **GM:** Advance to Hale's turn. Confirm a death save prompt appears for **P2** before anything else on her turn. **P2:** Type a number under 10: a failure is marked on Hale's Sheet (one failure in total).
4. **GM:** Damage Hale at 0 HP with a normal hit. Confirm one more failure on the Sheet (two in total). Undo that damage, then damage her with a critical hit instead and confirm it adds two failures (three in total, so she dies); undo it again to return to one failure.
5. **GM:** Heal Hale from 0. Confirm death saves reset on the Sheet and she is conscious at the healed HP.
6. **GM:** Undo the heal. Confirm the earlier death save tally comes back on the Sheet.
7. **GM:** Reduce Hale to 0, then on a later turn: **P2** types a 1 for the death save and confirm it adds two failures (from a fresh count), then repeat from a fresh count with a 20 and confirm she regains 1 HP and is conscious.
8. **GM:** Damage Hale to 0 with damage at least equal to her maximum HP beyond 0. Confirm she is killed outright and shows Dead to everyone.
9. **GM:** Advance turns. Confirm a dead Hale takes no turn, actions or reactions and ignores healing. Undo back to a dying Hale to continue.
10. **P2:** Switch **Roll my dice automatically** ON (`/settings/preferences`), get Hale dying again and confirm the death save is rolled for you at her turn start with no prompt. **GM:** Confirm the roll is visible to you in both modes.
11. **P2:** Switch Auto-roll OFF again and reach three successes: confirm Hale stabilizes. Reach three failures (from fresh Hale at 0): confirm death.

**Expected**

- Start of turn order is Recharge, then death save, then start-of-turn effects.
- The death save tally is on Hale's Sheet; the tabletop shows the prompt to P2.

**Other users see**

- **P1:** Sees Hale's Dying or Dead badge but must NOT see her private death save tally.

## UAT-SPELLS-11: Stabilizing: Spare the Dying, Healer's Kit and first aid

- **Covers:** SPELLS-8.2, SPELLS-3.5, SPELLS-3.7
- **Accounts:** GM, P1, P2, P3
- **Preconditions:** Scenario 2 running with a Zombie and a Wolf added next to Hale. Hale (a Cleric) casts Spare the Dying; Sage is the dying target, because Sage is a Wizard and cannot cast it.

**Steps**

1. **GM:** Reduce Sage to 0 HP so she is dying. **P2:** On Hale's turn cast **Spare the Dying** at Sage. Confirm Sage becomes stable with no further death saves.
2. **P2:** Try Spare the Dying at the Zombie. Confirm the undead exclusion warning.
3. **GM:** Damage Sage again. Confirm she is dying again, and Undo restores the stable state with its death saves.
4. **P2:** On a creature that is not dying (the Wolf), use the Healer's Kit. Confirm the overridable warning that the target is not dying and that nothing changes if overridden.
5. **GM:** Make Sage dying. **P2:** Use the Healer's Kit on Sage. Confirm Sage becomes stable.
6. **GM:** Make Sage dying again. **P2:** Use the first aid basic action. Confirm it spends an Action and asks for a DC 10 Wisdom (Medicine) check; success makes Sage stable, failure does not.

**Expected**

- Stabilizing is the same result whether by Spare the Dying, the kit or first aid.

**Other users see**

- **P1:** Sees Sage's Dying and Stable badge change, and must NOT see Hale's private rolls.
- **P3:** Sees the same badge and Hale's actions on the table.

## UAT-SPELLS-12: Single-use items and Antitoxin

- **Covers:** SPELLS-5.1, SPELLS-5.2, SPELLS-11.1, SPELLS-11.2, SPELLS-11.3
- **Accounts:** GM, P2, P1
- **Preconditions:** Scenario 2 running. Hale carries 2 vials of Antitoxin.

**Steps**

1. **P2:** On Hale's Sheet note the Antitoxin count. In the Encounter use Antitoxin on Sage.
2. **P2:** Confirm the Sheet shows one fewer vial and an Action was spent.
3. **GM:** Force Sage to save against a poison effect. Confirm advantage with the reason "Antitoxin (vial)". Force a non-poison save. Confirm no advantage.
4. **P2:** Try Antitoxin on the Zombie. Confirm an overridable undead warning.
5. **GM:** Undo the Antitoxin use. Confirm the grant is gone, the Action is back, the vial returns and rolls already made stay on the record.
6. **P2:** Use the last vial. Confirm it disappears from equipment and is no longer offered as an action.
7. **P2:** Reload the table in another tab with stale data and try to use the item again. Confirm a refusal message.
8. **GM:** Choose **Complete encounter**, set **Automation mode** to Manual in the Campaign's table settings, and start a new Encounter with Hale and Sage. **P2:** Use the Potion of Healing. Confirm the app does not change the potion count by itself; edit it on the Sheet by hand.
9. **GM:** Set **Automation mode** back to Assisted, **Complete encounter**, and rebuild the arena with scenario 2 steps 4 and 5.

**Expected**

- Assisted mode uses up one; the last removes the item; undo gives it back.
- Manual mode leaves the item count alone.

**Other users see**

- **P1:** Sees the "Antitoxin (vial)" grant on Sage for the hour, and must NOT see Hale's equipment list or counts.

## UAT-SPELLS-13: Reaction spells: Shield and Counterspell, one-roll grants

- **Covers:** SPELLS-8.3, SPELLS-5.4, SPELLS-5.5, SPELLS-5.10
- **Accounts:** GM, P1, P2, P3
- **Preconditions:** Scenario 2 running. Sage has Shield and Counterspell prepared with at least one 3rd-level or higher slot spare; Hale has Aid and Blade Barrier prepared. Absorb Elements is not an SRD spell, so its reaction journey is [UAT-REACTION-5](REACTION.md), not here. Shield's other lifetimes are in scenario 15.

**Steps**

1. **GM:** Have the Wolf attack Sage. **P1:** On the reaction prompt choose **Use** Shield. Confirm the attack is held until answered and that a hit can turn into a miss.
2. **P1:** Take the rest of Sage's turn, then pass to the next round. Confirm Shield's +5 AC ends at the start of Sage's next turn.
3. **P2:** On Hale's turn cast **Aid** (a 2nd-level spell) at a Character. **P1:** On the reaction prompt use **Counterspell** with a 3rd-level slot. Confirm Aid is countered and does nothing.
4. **P2:** Hale casts **Blade Barrier** (a 6th-level spell). **P1:** Use Counterspell with a 3rd-level slot. Confirm a Counterspell ability check is asked for (against a DC set by the spell's level), and that even if the check fails the slot is spent.
5. **GM:** Have the Wolf attack Sage again. **P1:** Decline the reaction. Confirm the attack resolves.
6. **GM:** Confirm Sage cannot react twice in a round (her second reaction prompt in the same round is not offered).
7. **P1:** Cast **Shocking Grasp** on the Wolf. Confirm the Wolf is then offered no opportunity attack or other reaction until the grant ends (move Hale away from the Wolf to check).
8. **P3:** Vex casts **Vicious Mockery** on the Goblin (a one-roll attack-disadvantage grant). **GM:** Then trigger an opportunity attack by the Goblin and, on another turn, a Disarm attempt by it. Confirm each attack roll uses up the grant (the next attack after the first is not at disadvantage).
9. **P2:** Try to answer Sage's reaction prompt on P2's screen. Confirm P2 is refused. **GM:** Answer for P1 once instead.

**Expected**

- Reactions pause the hit or cast; only the reactor's controller or the GM answers; Shield's lifetime is as listed.
- A one-roll grant ends on the holder's next attack roll of any kind, including opportunity attacks and Disarm.

**Other users see**

- **P2:** Sees a held-action pending state and the final result; must NOT be able to answer Sage's prompt.
- **P3:** Sees the same pending state.

## UAT-SPELLS-14: Reaction countdown timer

- **Covers:** SPELLS-31.3
- **Accounts:** GM, P1, P2
- **Preconditions:** Scenario 13 set-up (Sage with Shield, the Wolf able to attack her). Blocked until SPELLS-31.3 is DONE in the ledger (it is TODO now, so the countdown does not exist yet); skip this scenario until then. The exact label of the reaction time setting is unconfirmed: look for it in the Campaign's table settings.

**Steps**

1. **GM:** Open the Campaign's table settings and find the reaction time. Confirm the default is 5 seconds, set it to 3 and to 15 and confirm both are accepted, then try 2 and 16 and confirm they are refused. Leave it at 5.
2. **GM:** Have the Wolf attack Sage. **P1:** Confirm a countdown on the reaction prompt that declines itself at zero.
3. **GM:** Trigger it again. **P1:** Press Enter outside a text field and confirm the first option is chosen.
4. **GM:** Trigger again. **P1:** Press Esc. Confirm it declines.
5. **GM:** Trigger again. **P1:** Use the large buttons.
6. **P1:** Mark yourself AFK. **GM:** Trigger again. Confirm it auto-declines at once without pausing the table.
7. **GM:** Mark P1 AFK yourself (instead of P1). Confirm the same. Doubt: where each AFK control lives is unconfirmed.

**Expected**

- The timer counts down on the reactor's screen only; the table does not stall.

**Other users see**

- **P2:** Must NOT see Sage's countdown or buttons; sees only the pending state and the result.

## UAT-SPELLS-15: Grant spells and their lifetimes

- **Covers:** SPELLS-8.3, SPELLS-5.3, SPELLS-5.4, SPELLS-5.6, SPELLS-5.8, SPELLS-30.1, SPELLS-5.7, SPELLS-5.10
- **Accounts:** GM, P1, P2, P3
- **Preconditions:** Scenario 2 running; Sage, Hale and Vex each have a spare slot of the level of the spells they cast below. Remove old grants from earlier scenarios first.

**Steps**

1. **P2:** Hale casts **Aid** on Sage. Confirm Sage's maximum and current HP rise. **GM:** End it by hand and confirm current HP clamps to the old maximum if she was above it.
2. **P3:** Vex casts **Heroism** on Sage. Confirm it needs Concentration (Vex holds it).
3. **P1:** Sage casts **Darkvision** on herself and **Fly** on herself (a speed grant for every speed type). Confirm the movement budget changes with Fly. **P3:** Vex casts **Longstrider** on Sage and confirm Sage's movement budget rises further. Fly and Heroism's Concentration are held by different casters, so both stay.
4. **P2:** Hale casts **Protection from Energy** on Sage, choosing fire as the damage type. Confirm resistance to fire only (a fire hit is halved, a cold hit is not) and that Hale now holds Concentration.
5. **P2:** Hale casts **Shield of Faith** on Sage. Confirm Sage's AC rises by 2, attacks against her use it, and that casting it ended Protection from Energy because it is also a Concentration spell (one Concentration at a time).
6. **P1:** Cast **Ray of Frost** on the Goblin. Confirm its speed is reduced until the end of the caster's next turn.
7. **P3:** Cast **Vicious Mockery** on the Goblin. Confirm an attack-disadvantage grant used up by its next attack.
8. **P1:** Cast **Shocking Grasp** on a Wolf and confirm no reactions for it (see scenario 13).
9. **GM:** Open a token and the turn tracker. Confirm each active grant is listed with its source and time left. Open Sage's Sheet and confirm the same.
10. **GM:** End one grant by hand. Confirm it disappears.
11. **GM:** Hide the source of a grant (a hidden Goblin casting a spell that grants something to Sage; Heavy setup: the GM marks the Goblin's token hidden by hand). **P1:** Confirm the label is not shown to players.
12. **GM:** Break Vex's Concentration (damage with a failed check). Confirm Heroism ends.
13. **GM:** Put a Unicorn in the Encounter. At the end of another creature's turn use the Unicorn's **Shimmering Shield** legendary action on itself or a creature within 60 ft. Confirm attacks against that Character or Creature use +2 AC and that it ends at the end of the Unicorn's next turn.
14. **P2:** Hale casts **Protection from Energy** again on Sage (she holds Concentration). **GM:** Incapacitate Hale (for example Stunned) and confirm the Protection from Energy grant on Sage ends.
15. **GM:** Remove the Goblin that holds Vicious Mockery's disadvantage grant from the Encounter (remove its token). Confirm the grant is gone from the turn tracker. Then have **P1** cast Ray of Frost on the Wolf, and have the GM skip Sage's next turn: confirm the speed reduction still ends, because a skipped turn counts both its start and its end.

**Expected**

- Each grant applies and ends when its authored lifetime says.

**Other users see**

- **P2:** Sees grants on the table tokens and the turn tracker; a hidden source is not named.
- **P3:** Same; must NOT see the label of the hidden Goblin's grant.

## UAT-SPELLS-16: Grants and Concentration carry over after the Encounter

- **Covers:** SPELLS-5.9, SPELLS-5.11, SPELLS-5.12, SPELLS-5.13, SPELLS-5.14
- **Accounts:** GM, P1, P2, P3
- **Preconditions:** Scenario 2 running with the Campaign clock enabled (the **World time** control shows on the Campaign page; if it does not, enable it in the Campaign's settings; with no clock, the offer in step 3 does not appear and grants only end when the GM ends them, which this scenario cannot show). Sage can cast Fly (Concentration) and Blindness/Deafness (no Concentration). Clear old grants first. Vex stands in for the "timed condition" target because only Sage has Blindness/Deafness.

**Steps**

1. **P1:** Sage casts **Fly** on herself and holds Concentration. **P2:** Hale casts **Aid** on Sage (a grant with a duration, no Concentration).
2. **P1:** Sage casts **Blindness/Deafness** on Vex, choosing Blindness. **P3:** Fail the save when prompted. Confirm Vex is Blinded. **GM:** Add a Goblin and have **P3** cast **Vicious Mockery** on it so a Creature also holds a grant.
3. **GM:** Choose **Complete encounter**. Confirm the offer "Advance world time?" appears with the elapsed rounds. Accept.
4. **P1:** Confirm on Sage's Sheet that Fly's grant and Aid carry over. **P3:** Confirm Vex's Sheet still shows Blinded with its time left. **GM:** Confirm the Goblin's grant is gone (a Creature's grants end with the Run).
5. **P1:** Open Sage's Sheet outside any Encounter and end Concentration on Fly yourself. Confirm Fly's grant ends with no action used. Cast Fly again and end it again to confirm the same.
6. **P1:** Cast Fly again. **GM:** Start a later Encounter (rebuild the arena with scenario 2 steps 4 and 5). **P1:** Confirm Sage is still concentrating. **GM:** Damage Sage and confirm a Concentration check is staged for **P1**; fail it and confirm Fly and every other carried grant that depended on it ends.
7. **GM:** Cast or apply a new timed grant on Sage with a duration shorter than a few rounds, play those rounds, and confirm the grant counts down in rounds and ends when time runs out.
8. **GM:** Advance **World time** past the Blindness/Deafness duration (one minute). **P3:** Confirm Vex's Blinded condition is released on the Sheet and in the Encounter.

**Expected**

- A carried condition does not stay forever on the Character; carried grants and conditions expire on the Campaign clock or when the GM ends them.
- The caster alone controls ending their Concentration.

**Other users see**

- **P2:** Sees Hale's own carried Aid grant on her Sheet only; must NOT see Sage's Concentration check prompt.
- **P3:** Sees Vex's own Blinded state expire, and nothing of Sage's Sheet.

## UAT-SPELLS-17: Two Concentrations with an authored ring

- **Covers:** SPELLS-12.1, SPELLS-12.2, SPELLS-12.3
- **Accounts:** GM, P1
- **Preconditions:** Scenario 2 running. Heavy setup: this needs homebrew authoring. The GM (an owner of an authored item) builds the ring in the authoring forms for items; whether the item form can express "keep a second Concentration, maximum spell level 3 for both, 1 use per dawn", "advantage on the first spell's Concentration save while holding only one", "disadvantage on the second spell's save when the damage exceeds 10 plus its level" and "vulnerability to psychic damage while holding two" is unconfirmed; if the authoring form cannot express them, mark the scenario BLOCKED and report which rule is missing (the ledger proof is the evidence). Known gap: the Sheet's picker to end one of two held Concentrations by choice, and the once-per-dawn use counter display, are not finished; do not assert them.

**Steps**

1. **GM:** In authoring create the homebrew ring described above and give it to Sage. **P1:** Equip it on Sage's Sheet.
2. **P1:** In the Encounter cast **Hold Person** on a Goblin, then **Fear** on the Wolf. Confirm both are held and the second cast does not replace the first.
3. **P1:** Cast **Charm Person** (a third Concentration). Confirm the prompt **End which Concentration?** and that choosing Hold Person ends only it and its grants.
4. **GM:** Damage Sage. Confirm one Concentration save per spell, in casting order, each prompted to **P1**.
5. **GM:** Fail the second save. Confirm only that spell ends.
6. **GM:** With only one spell held, damage Sage and confirm the ring's advantage is named on the save. With two held, damage Sage by more than 10 plus the second spell's level and confirm the disadvantage on the second spell's save is named.
7. **GM:** While two are held, confirm Sage has vulnerability to psychic damage (a psychic hit is doubled); end one and confirm the vulnerability goes.
8. **P1:** With the ring's one use per dawn already spent, cast a new Concentration and confirm it replaces the old one instead of keeping both.
9. **P1:** Unequip the ring, cast a new Concentration and confirm it replaces the old.

**Expected**

- Authored rule only; without the ring or with no uses left, a new Concentration replaces the old.
- Each spell's Concentration save is separate; a failed save ends only its own spell and that spell's grants.

**Other users see**

- **P2:** Sees which spells Sage concentrates on as badges on her token; must NOT see Sage's Concentration roll prompts.

## UAT-SPELLS-18: Dragons, breath weapons and Legendary Resistance

- **Covers:** SPELLS-15.1, SPELLS-18.1, SPELLS-19.1, SPELLS-19.2, SPELLS-21.1
- **Accounts:** GM, P1, P2, P3
- **Preconditions:** Scenario 2 running; add an Adult Red Dragon (it has Legendary Resistance (3/Day) and Wing Attack), a Silver Dragon Wyrmling and a Gorgon. Characters are low level, so the breaths may hurt; raise their hit points on the Sheet first.

**Steps**

1. **GM:** On the Red Dragon's turn, choose its **Fire Breath (Recharge 5-6)** action and aim the cone at Sage, Hale and Vex. Then, at the end of another creature's turn, open the Legendary window and choose **Wing Attack (Costs 2 Actions)**, which is the Dragon's area legendary option, aimed at the same three Characters.
2. **GM:** Confirm for each of the two areas that each caught Character's save goes to its own player (**P1** for Sage, **P2** for Hale, **P3** for Vex). Answer. Confirm damage is half on a success where the action says so, and that undo reverts it.
3. **GM:** Run the Silver Dragon Wyrmling's Paralyzing Breath. Confirm the Characters that fail are Paralyzed and undo removes it from every one.
4. **GM:** Run the Gorgon's Petrifying Breath. Confirm the printed repeat save applies.
5. **P1:** Sage casts **Hold Person** on the Red Dragon. Fail its save (Hold Person only works on a Humanoid, so expect the overridable creature-type warning; **GM:** override it for this test). **GM:** On the offered Legendary Resistance prompt use it. Confirm the failure becomes a success and a charge is spent.
6. **P1:** Cast again, **GM:** decline Legendary Resistance and confirm the failure stays.
7. **GM:** Undo the use. Confirm the charge returns.
8. **P1:** Cast Fireball over the Dragon and the Wolf. **GM:** Confirm a Legendary Resistance prompt is not offered for an area spell with several creatures.

**Expected**

- Breaths resolve through the same area flow as Fireball; Legendary Resistance is offered only on a single-target save.

**Other users see**

- **P2:** Sees the damage and conditions, but not the dragon's private rolls.
- **P3:** Same.

## UAT-SPELLS-19: Zones, auras and lasting hazards

- **Covers:** SPELLS-4.2, SPELLS-17.1, SPELLS-17.2, SPELLS-17.3, SPELLS-17.4, SPELLS-17.5, SPELLS-20.1, SPELLS-24.1, SPELLS-30.1
- **Accounts:** GM, P1, P2, P3
- **Preconditions:** Scenario 2 running. **P3** now plays **Moss** (Druid 9) instead of Vex: before this scenario, **GM** completes the Encounter, **P3** changes the Party roster entry from Vex to Moss with **Change Character**, and **GM** rebuilds the arena with scenario 2 steps 4 and 5. Hale has Spirit Guardians and Blade Barrier; Moss has Spike Growth, Moonbeam and Entangle; Sage has Caltrops (bag of 20), Oil (flask) and Hunting Trap. Remove old grants first.

**Steps**

1. **P2:** Hale casts **Spirit Guardians**. Confirm an aura circle drawn on the map centered on her and that it moves when she moves.
2. **GM:** Move a Goblin in; confirm it saves on entry and at the start of its turn. Park a creature with only its edge or a corner touching the circle and confirm it is not affected.
3. **P3:** Moss casts **Moonbeam**, **Spike Growth** and **Entangle** (one at a time, using Undo placement between). Confirm each places a zone and resolves its entry and turn rules.
4. **P2:** Cast **Blade Barrier**, choosing the wall shape. Confirm a zone with save, damage, cover and difficult terrain.
5. **P1:** Sage uses the **Caltrops (bag of 20)** item from her equipment in the Encounter. Confirm the field appears on the map.
6. **GM:** Move a Goblin so it ends its move inside the field: confirm a DC 15 Dexterity save, and on a failure its movement stops, it takes 1 piercing damage, and its speed is down 10 feet.
7. **GM:** Move another Goblin that only passes through the field. Confirm the save is made on entering and that it stops in the field on a failure.
8. **GM:** Raise the slowed Goblin's hit points by any amount using the token's HP control. Confirm its speed returns; Undo the heal and confirm the speed reduction returns. Then repeat the heal as **P3**: move Moss (reduce her hit points first with the GM) into the field, fail the save, and heal Moss from her own Sheet; confirm the slow ends.
9. **GM:** Give the Goblin resistance to piercing damage, make it fail the save again, and confirm no piercing damage is dealt but the slow still applies.
10. **P1:** Drag Sage's token across a visible half-speed field. Confirm a choice between careful and normal movement and that the chosen move commits.
11. **P1:** Use the **Oil (flask)** and the **Hunting Trap** items. **GM:** Move a creature through each and confirm each triggers on pass-through, as Blade Barrier did in step 4 (these three are the zones SPELLS-17.5 names).

**Expected**

- Zones catch by positive-area overlap; touching an edge or corner does not trigger it.

**Other users see**

- **P2:** Sees the zones and aura radius from sources they are allowed to see; must NOT see a hidden creature's zone.
- **P3:** Same.

## UAT-SPELLS-20: Multi-target spells and teleports

- **Covers:** SPELLS-26.1, SPELLS-28.1, SPELLS-28.2
- **Accounts:** GM, P1, P2, P3
- **Preconditions:** Scenario 2 running. P3 plays Moss (see scenario 19).

**Steps**

1. **P1:** Cast **Magic Missile** choosing the same Goblin for two darts and another for one. Confirm each dart is its own damage instance.
2. **P1:** Cast **Scorching Ray** with a different target mix. Confirm per-ray attack rolls.
3. Eldritch Blast needs a Warlock, which no shared Character is; its beam split and level scaling are checked in [UAT-SPELLS-27](#uat-spells-27-racial-traits-creature-traits-and-eldritch-blast) step 9. Continue here.
4. **P1:** Cast a multi-target spell with per-creature saves such as Hold Person at a higher slot (3rd level or above). Confirm one save per creature, each answered by the GM for the creatures.
5. **P1:** Cast **Misty Step**. Click a free square within range. Confirm the token teleports with no path and no opportunity attacks.
6. **P1:** Cast **Dimension Door** and teleport. Confirm it too.
7. **P1:** Try a second teleport move without casting. Confirm it is refused.
8. **GM:** Undo the cast. Confirm the position returns.
9. **P2:** Hale casts **Word of Recall** and **Plane Shift** (Plane Shift is a 7th-level spell, which is why Hale is level 13; its travel half teleports the target). **P3:** Moss casts **Giant Insect**. **P1:** Sage casts **Telepathic Bond**. Confirm each resolves the right outcome (teleport, manifest, link).

**Expected**

- Spells that target chosen creatures resolve per target; teleport allowance is bounded and consumed.

**Other users see**

- **P3:** Sees the new token position after the teleport, and must NOT see the movement of a hidden creature.
- **P2:** Sees the same token positions.

## UAT-SPELLS-21: Invisibility, Sanctuary, Fear and Blindness

- **Covers:** SPELLS-27.1, SPELLS-27.2, SPELLS-29.1, SPELLS-29.2, SPELLS-30.1
- **Accounts:** GM, P1, P2, P3
- **Preconditions:** Scenario 2 running with Sage, Hale and a Goblin. Sage has Invisibility, Charm Person, Fear and Blindness/Deafness prepared (prepare them on the Sheet if needed). Step 6 needs a wall (Heavy setup: the GM draws a wall by hand).

**Steps**

1. **P1:** Cast Invisibility on Sage. Make an attack roll. Confirm the Invisibility ends. Undo the attack: confirm it returns.
2. **P1:** Recast and cast a spell instead: confirm it ends.
3. **P2:** Hale casts **Sanctuary** on Sage; have **P1** attack an enemy with Sage. Confirm Sanctuary ends when Sage attacks. Recast it and have Sage cast an offensive spell at an enemy: confirm it ends the same way.
4. **P1:** Cast **Charm Person** on the Goblin and fail its save. **P2:** Have Hale (a companion) hit the Goblin. Confirm the charm ends because the caster's companion harmed the target. Undo the hit and confirm the charm returns.
5. **P1:** Cast **Fear** on the Goblin. Fail its save. Confirm Frightened records Sage as the source.
6. **GM:** Move the Goblin so it loses line of sight to Sage, then have it attack. Confirm disadvantage only while it can see her (Heavy setup: a wall drawn by hand to break the line of sight).
7. **GM:** Move the Goblin closer to Sage. Confirm a soft warning that you can override.
8. **GM:** Start the Goblin's turn. Confirm the GM is told it must Dash and move away; do something else and confirm a "Do it anyway" warning logged for the GM.
9. **GM:** End the Goblin's turn without line of sight. Confirm it is offered a Wisdom save; success ends the effect for it only. Undo.
10. **P1:** Cast **Blindness/Deafness** on a Goblin choosing Blinded. Confirm the condition on a failed save with a repeat save at the end of each of its turns. Recast it with a 3rd-level slot and confirm an extra target can be chosen.
11. **GM:** Apply Frightened to the Goblin by hand, with no source. Confirm its attacks always roll with disadvantage, whether or not it can see anyone.

**Expected**

- Authored end events fire from one consumer; Frightened follows its source.

**Other users see**

- **P2:** Sees Frightened and Blinded badges but must NOT see the Goblin's private roll.
- **P3:** Same.

## UAT-SPELLS-22: Summons: turns, groups and ends

- **Covers:** SPELLS-34.2, SPELLS-34.3, SPELLS-34.4, SPELLS-34.5, SPELLS-35.1, SPELLS-35.2, SPELLS-35.3, SPELLS-35.4, SPELLS-35.5, SPELLS-35.6
- **Accounts:** GM, P1, P2, P3
- **Preconditions:** Scenario 2 running; P3 plays Moss. Heavy setup for steps 4 to 8: Find Familiar is a ritual and cannot be cast in an Encounter, so the GM authors (or P1 owns) two homebrew summon spells through the spell authoring forms: one whose summon rolls its own initiative on arrival (own initiative), one whose summon acts right after its owner, and a summon form with no attacks (for step 7). Whether the authoring forms offer the summon turn timing is unconfirmed; if they do not, mark steps 4 to 8 BLOCKED and report. Sage must have both spells prepared with slots available.

**Steps**

1. **P3:** Moss casts **Conjure Animals**, choosing a creature and count. Confirm one group token appears with one shared turn.
2. **P3:** Run the group: confirm one attack per surviving creature. **GM:** Reduce the group count and confirm attacks drop.
3. **P3:** Check the Extras tab: the summon shows its live HP, and its HP matches the Encounter token.
4. **P1:** Cast the own-initiative homebrew summon spell with Sage. Confirm the summon rolls its own initiative on arrival and has its own score and its own turn in the order.
5. **P1:** On the summon's turn confirm **P1** gets a prompt and the action drawer with **End turn**. Try the summon's own Attack: refused as not the current actor. Delegate an attack through Sage: confirm it resolves.
6. **P1:** Cast the "right after its owner" homebrew summon spell. **GM:** Confirm it acts immediately after Sage in side and individual initiative and keeps that place across two rounds.
7. **P1:** Cast the no-attack summon. **GM:** Move a hostile Goblin away from it and confirm the summon gets no opportunity attack and offers no attack reaction.
8. **GM:** End a summon while it is the current actor and again while it is next. Confirm the order continues without a gap each time. Undo and confirm the order restores.
9. **P3:** Break Moss's Concentration (the GM damages her and **P3** fails the check). Confirm the Conjure Animals summon leaves Extras. **GM:** Reduce another summon to 0 HP and confirm it leaves Extras; **P1:** dismiss a third from Extras and confirm it leaves.
10. **GM:** Choose **Complete encounter**. **P3:** Cast **Conjure Animals** from Moss's Sheet outside an Encounter. Confirm its Extras entry shows the same creature, count and stat block as the in-Encounter cast in step 1, and that it stays in Extras until dismissed or a long rest. Rebuild the arena with scenario 2 steps 4 and 5 afterwards.

**Expected**

- The summon's prompt appears when its turn starts; the Encounter actor is the only record.
- The Sheet-cast and the Encounter-cast summon from the same spell are built the same.

**Other users see**

- **P3:** Sees P1's summon only as a token; must NOT see its private rolls.
- **P2:** Same.

## UAT-SPELLS-23: Manual mode raises no rules prompts

- **Covers:** SPELLS-1.2
- **Accounts:** GM, P1, P2
- **Preconditions:** Scenario 2 done. Heavy setup: a Manual-mode Encounter built by hand (the review Campaign is Assisted).

**Steps**

1. **GM:** Choose **Complete encounter**, set **Automation mode** to Manual in the Campaign's table settings, create a new Encounter with Sage, Hale, Moss and a Goblin, and start it (every combatant needs a hand-entered initiative in Manual mode).
2. **P1:** Confirm the action drawer is hidden (no automated actions).
3. **GM:** Damage Sage by hand while she is Concentrating on a spell (cast one in the Sheet first), and apply a save-forcing effect by hand. Confirm no roll prompts, reactions or Concentration checks are raised for anyone.
4. **GM:** Complete the Encounter, set **Automation mode** back to Assisted, rebuild the arena with scenario 2 steps 4 and 5.

**Expected**

- Manual mode is a map, turn order and roller only.

**Other users see**

- **P1:** Sees no automatic prompts.
- **P2:** Same; must NOT be asked for any roll.

## UAT-SPELLS-24: Privacy and permissions refusals

- **Covers:** SPELLS-1.1, SPELLS-1.2
- **Accounts:** GM, P1, P2, P3
- **Preconditions:** Scenario 2 running.

**Steps**

1. **P1:** Cast **Fireball** at the Goblin and the Wolf (with **GM**'s Auto-roll OFF). Confirm the action pauses on the creatures' saves for the **GM**, not for P1. **GM:** Turn Auto-roll ON, repeat the cast, and confirm the saves are rolled and the action continues with no pause.
2. **P2:** While a save prompt is open for Sage, try to answer Sage's prompt on P2's screen. Confirm it is refused or not offered.
3. **P3:** Try to answer a pending prompt for a Goblin. Confirm it is refused or not offered.
4. **GM:** Make a roll Private. **P1:** Confirm P1 cannot see it. Use **Show roll** and **Show that I rolled** once each and confirm the roll then becomes visible.
5. **P3:** Look for an Undo last action control. Confirm only the GM has it.
6. **P2:** Try to remove a creature from a pending area. Confirm refused.

**Expected**

- A roll is answered only by the controller or the GM; private rolls stay private until revealed.
- In Assisted mode the creature's save for a player's spell pauses for the GM unless the GM's Auto-roll is ON.

**Other users see**

- **P1:** Sees only public cards; must NOT see the GM's Private roll until revealed.
- **P3:** Same.

## UAT-SPELLS-25: Phone width: Sheet death saves and summons

- **Covers:** SPELLS-3.6, SPELLS-34.1
- **Accounts:** P1, P2
- **Preconditions:** Scenario 1 done (Sage's familiar still in Extras). Use the browser device toolbar at 375 px (the device toolbar emulates a phone screen; press F12, then the device icon).

**Steps**

1. **P2:** Open Hale's Sheet at 375 px. Set hit points to 0.
2. **P2:** Confirm death saves are visible and tappable with no sideways page scroll. Press **Roll death save** and confirm the result shows.
3. **P1:** Open Sage's Sheet at 375 px and the Extras tab. Confirm the familiar entry shows AC, speed, attacks and HP, readable with no sideways scroll.

**Expected**

- Controls are usable at 375 px width; no horizontal page scroll.

**Other users see**

- Not applicable: each player looks only at their own Sheet.

## UAT-SPELLS-26: Sheet attack rows match the room, and an always-on feature that rests restore (Tranquility)

- **Covers:** SPELLS-8.6, SPELLS-31.2
- **Accounts:** GM, P1, P2, P3
- **Preconditions:** Scenario 2 running with Sage and Hale (part A). Part B needs **Kade** (Monk, Way of the Open Hand, level 11, which has Tranquility), built by P2 beforehand in the Builder (Hale is P2's Character in this Campaign until the swap). Tranquility is authored as an always-on effect that ends on an End On condition (attacking) and returns after a long rest; the rest steps below use the Sheet's rest control (titled **Short Rest** / **Long Rest**). Kade has no class feature the others rely on, and Hale and Kade are never in the Campaign together.

**Steps**

Part A (Sage and Hale):

1. **P1:** On Sage's Sheet note the attack and damage rows. **P2:** In the Encounter have Hale cast **Bless** on Sage. **P1:** Read the Sheet row again. Confirm the Bless bonus is folded into the row.
2. **P1:** Sage attacks with her quarterstaff in the Encounter. Confirm the room rolls the same bonus and damage dice the Sheet row showed.

Part B (swap):

3. **P2:** While the Encounter is still running, try **Change Character** and confirm it is refused. **GM:** Choose **Complete encounter**. **P2:** Now use **Change Character** and pick Kade in place of Hale. **GM:** Start a new Encounter with Kade, Sage and a Goblin.
4. **P2:** On Kade's Sheet confirm Tranquility shows as active, not as a use.
5. **P2:** Make Kade attack the Goblin so the feature's End On condition fires. Confirm the Sheet reads "ended until" the rest it returns on, and that its grants are gone.
6. **GM:** Undo the attack. Confirm the feature is active again.
7. **GM:** Choose **Complete encounter**. **P2:** Attack once outside the Encounter if the feature is active again, or leave it ended, then take a **Long Rest** from Kade's Sheet. Confirm Tranquility returns to active.

**Expected**

- The Sheet and room agree; the feature is never shown as a use counter.
- The swap succeeds only because no Encounter is running; during an Encounter **Change Character** is refused.

**Other users see**

- **P1:** Sees Bless on Sage in both places, and must NOT see Kade's Sheet.
- **P3:** Sees nothing of the swap beyond the roster name changing.

## UAT-SPELLS-27: Racial traits, creature traits and Eldritch Blast

- **Covers:** SPELLS-32.1, SPELLS-33.1, SPELLS-17.6, SPELLS-26.1
- **Accounts:** GM, P1, P2, P3
- **Preconditions:** Scenarios 2 to 26 are done and the arena is rebuilt after each swap. P3 plays three one-off Characters in turn: **Dunn** (Hill Dwarf Fighter, level 1), **Pip** (Lightfoot Halfling Fighter, level 1) and **Wren** (Warlock, level 5), each swapped in only between Encounters. P3 builds all three first. The conversions these ACs describe are internal, so this scenario spot checks one authored trait each way rather than the whole corpus; the ledger tests prove the rest. Step 11 is a best-effort check of an internal guard; skip it if the GM cannot reach the situation, and say so.

**Steps**

1. **P3:** In the Builder create **Dunn** (Hill Dwarf Fighter 1), **Pip** (Lightfoot Halfling Fighter 1) and **Wren** (Warlock 5 with Eldritch Blast). Make all three active.
2. **GM:** Choose **Complete encounter**. **P3:** Use **Change Character** to put Dunn in the Party in place of Moss. **GM:** Rebuild the arena with scenario 2 steps 4 and 5.
3. **P3:** On Dunn's Sheet confirm Dwarven Toughness adds 1 maximum hit point per level compared to a plain Fighter 1 (read the Sheet and compare with Bryn's).
4. **GM:** Have the Giant Spider bite Dunn and force a Constitution save against its poison. **P3:** Confirm the save is rolled with advantage and the roll prompt names Dwarven Resilience, and that poison damage to Dunn is halved.
5. **GM:** Have the Wolf attack Dunn while another hostile creature is within 5 feet of him. Confirm the Wolf's attack roll has advantage and names Pack Tactics.
6. **GM:** Choose **Complete encounter**. **P3:** Change Character to Pip. **GM:** Rebuild the arena.
7. **P3:** Make an attack roll for Pip and type a 1 for the die. Confirm Lucky lets Pip reroll it and the second roll is used. **GM:** Apply Frightened to Pip and have the Goblin force a Wisdom save: confirm advantage naming Brave. (Lucky and Brave are Lightfoot Halfling racial traits.)
8. **GM:** On the Goblin's turn confirm the bonus-action options include Nimble Escape (Disengage or Hide), and add an Archmage: **P1** casts **Fireball** at it and confirm the Archmage's save has advantage naming Magic Resistance.
9. **GM:** Choose **Complete encounter**. **P3:** Change Character to Wren. **GM:** Rebuild the arena. **P3:** Cast **Eldritch Blast** at a level-5 Warlock, splitting the beams between two targets. Confirm two beams (one attack roll each) and that a Goblin at 0 HP is not targeted by a leftover beam.
10. **P3:** Confirm the beam count does not change during the Encounter and that each beam is its own damage instance.
11. **GM:** Slow a Goblin with Caltrops (scenario 19 step 5), then make that Goblin move through a reaction that can end grants. Confirm the slow stays unless the Goblin regains hit points, and that Undo of that move is refused or restores everything (never half of it). Doubt: which tester-visible situation reaches this guard.

**Expected**

- Each authored racial and creature trait applies on screen with its name as the reason.
- Eldritch Blast creates the right number of beams and each one is rolled separately.

**Other users see**

- **P1:** Sees the Archmage's save result and the Wolf's advantage on the public card; must NOT see P3's private Lucky reroll prompt.
- **P2:** Same.

## Covered elsewhere

| AC          | Why not a UAT step                                                                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SPELLS-4.1  | Corpus-wide conversion of CLOSED_RULE to authored options, proved by authoring-parity tests; nothing differs on screen for the tester.                                                                  |
| SPELLS-6.1  | A rules audit whose output is a slice list; no tester-visible behaviour.                                                                                                                                |
| SPELLS-25.1 | Schema and corpus check that every zone sets attachmentKind; a failing zone cannot be built, so there is no screen to compare. Scenario 19 shows the zones that work.                                   |
| SPELLS-31.1 | TODO in the ledger: corpus conversion of class and subclass feature closed rules with authoring-parity proofs. Run a UAT spot check (for example Open Hand Tranquility in scenario 26) once it is DONE. |
