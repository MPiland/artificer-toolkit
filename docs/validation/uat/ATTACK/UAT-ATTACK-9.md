# UAT-ATTACK-9: Class features in play

Class features in play.

Level 3 (Core play) · Feature ATTACK · Mode: Group (GM, P1) · Path position 131 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- Done in [UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md): P1, P2 and P3 are seated in the Sandbox Campaign with their Characters.
- Done in [UAT-ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md): the Sandbox Campaign holds the Wolf and Goblin Blueprint and "UAT Cavern" is its presented Scene.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. **P1:** In the Builder (as in [BUILDER-2](../BUILDER/UAT-BUILDER-2.md)) build and commit: a Barbarian, a Rogue, a Fighter of level 5 (Extra Attack, Second Wind, Action Surge), a Paladin with spell slots, a Character with two light melee weapons, and the multiclasses Fighter 5 / Ranger 5, Fighter 11 / Paladin 5 and Fighter 20.
S2. **P1:** Before each group of steps the GM uses **Change Character** on P1's seat in the Party panel (a player has one Character per Campaign). Set **Auto-roll** ON for P1 and OFF for the GM.

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
   R1. **GM:** Use **Change Character** to put "UAT Dara" back on P1's seat, and complete the Encounter.

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
- **Set:**
- **Role:**
- **Failed step:**
- **Notes:**
