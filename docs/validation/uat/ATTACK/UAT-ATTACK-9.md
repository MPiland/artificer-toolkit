# UAT-ATTACK-9: Class features in play

Class features in play.

Level 3 (Core play) · Feature ATTACK · Mode: Group (GM, P1) · Path position 134 of 191

## Prerequisites

- **The Campaign** is hosted by GM with P1, P2 and P3 seated as players.
- Done in [UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md): P1 is seated in The Campaign with **Aria**, a level 1 Fighter P1 built.
- A free account holds 6 personal Characters. P1 already has Aria and Ember (built in [UAT-REACTION-1](../REACTION/UAT-REACTION-1.md)), so P1 builds in two batches (see S1 and step 9) and deletes every Character built here at the end (R2).
- Done in [UAT-ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md): The Campaign holds the Wolf and Goblin Blueprint and "UAT Cavern" is its presented Scene.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **P1:** In the Builder (as in [BUILDER-2](../BUILDER/UAT-BUILDER-2.md)) build and commit: a Barbarian, a Rogue holding two light melee weapons, a Fighter of level 5 (Extra Attack, Second Wind, Action Surge) and a Paladin with spell slots. (Aria, Ember and these four make 6 of 6; step 9 needs three more, so P1 deletes the first three from `/characters` before building those.)
S2. **P1:** Before each group of steps use **Change Character** on your seat in the Party panel (a player has one Character per Campaign, swapped only between Encounters; the GM completes the Encounter first). Set **Auto-roll** ON for P1 and OFF for the GM.

1. [ ] **P1:** Seat the Barbarian with **Change Character**. **GM:** Start an Encounter with a Wolf.
2. [ ] **P1:** As the Barbarian, use Rage as a bonus action. Confirm a rage charge is spent and resistance and the damage bonus apply.
3. [ ] **P1:** As the Barbarian, try to cast a spell while raging. Read the refusal. End Rage by choice.
4. [ ] **GM:** Undo the Rage action. Confirm the charge returns.
5. [ ] **P1:** As the Barbarian, Rage again and end the turn without attacking a hostile or taking damage. Confirm Rage ends at the end of the turn (ATTACK-9.6).
6. [ ] **GM:** Complete the Encounter. **P1:** Seat the Rogue. **GM:** Start an Encounter. **P1:** As the Rogue, make a hit with advantage. Confirm Sneak Attack dice are added once. Hit a second time in the same turn; confirm no second dice.
   - 6a. **GM:** Complete. **P1:** Seat the Fighter 5. **GM:** Start an Encounter. **P1:** Take the Attack action. Confirm the drawer shows "Attack 1 of 2" with the last weapon and target kept, make the first attack, then make the second without a warning. **GM:** Undo the second attack and confirm its slot is returned and the first attack stays.
   - 6b. **P1:** As the Fighter 5, use Second Wind (heals 1d10 + level) and Action Surge (extra action). Confirm each is limited to its uses per short rest.
7. [ ] **GM:** Complete. **P1:** Seat the Paladin. **GM:** Start an Encounter. **P1:** Hit with a melee weapon. Confirm the app offers Divine Smite; spend a slot and confirm the radiant dice.
8. [ ] **GM:** Complete. **P1:** Seat the Rogue with two light weapons (it is the one from step 6). **GM:** Start an Encounter. **P1:** Attack with the main hand and confirm the off-hand bonus attack is offered and adds no positive ability modifier.
9. [ ] **P1:** Delete the Barbarian, Rogue and Paladin from `/characters`, then build and commit Fighter 5 / Ranger 5, Fighter 11 / Paladin 5 and Fighter 20. For each multiclass in turn (**P1:** seat it; **GM:** complete the old Encounter and start a new one), **P1:** open the Attack action and read how many attacks it offers (Fighter 5 / Ranger 5 makes 2, Fighter 11 / Paladin 5 makes 3, Fighter 20 makes 4).
       R1. **GM:** Complete the Encounter. **P1:** Use **Change Character** to put Aria back on your seat.
        R2. **P1:** Delete the Fighter 5, Fighter 5 / Ranger 5, Fighter 11 / Paladin 5 and Fighter 20 Characters from `/characters`. P1 is back to 2 of 6 (Aria and Ember).

## Expected

- Each feature resolves with the described dice, limits and undo; Extra Attack takes the highest source, not the sum.
- Step 6a: with two attacks, the drawer shows "Attack N of M" and the second attack raises no warning; each attack keeps its own roll and undo.
- (The authoring-parity half of ATTACK-9.1 to 9.6, that an author-built equivalent resolves identically, is proved by the ledger tests.)

## Other users see

- **GM:** Sees each feature in history; sees the Barbarian's rage and condition icons on the token.

## ACs covered

ATTACK-8.2, ATTACK-8.4, ATTACK-9.1, ATTACK-9.2, ATTACK-9.3, ATTACK-9.4, ATTACK-9.5, ATTACK-9.6

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
