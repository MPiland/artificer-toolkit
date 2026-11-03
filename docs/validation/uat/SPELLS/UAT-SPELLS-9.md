# UAT-SPELLS-9: Exhaustion 4 and 6, Petrified resistance, nonmagical defenses and automatic failures

Exhaustion 4 and 6, Petrified resistance, nonmagical defenses and automatic failures.

Level 4 (Advanced play) · Feature SPELLS · Mode: Group (GM, P1) · Path position 160 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2**, who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the account **P3**, who owns Cade (in Review: Party in the Field) and is also a member of Review: Sandbox.
- Done in [UAT-SPELLS-2](UAT-SPELLS-2.md): the arena Encounter from SPELLS-2 is running in Review: Party in the Field with Sage (P1), Hale (P2) and Vex (P3).

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. **GM:** Add a Gargoyle and a Magma Mephit (it casts Heat Metal and concentrates).
S2. **GM:** For step 7 author a homebrew condition that makes Constitution saves fail automatically, as in [SPELLS-8](../SPELLS/UAT-SPELLS-8.md) step 7. If it cannot be authored, mark step 7 BLOCKED and say why.

1. **GM:** On the Goblin set Exhaustion level 4. Confirm its maximum hit points are halved on the token.
2. **GM:** Set Exhaustion level 6. Confirm the Goblin dies.
3. **GM:** Apply Petrified to a Wolf. **P1:** attack it with Sage's quarterstaff. Confirm the damage is halved (resisted).
4. **P1:** Hit the Gargoyle with Sage's quarterstaff. Confirm resistance to nonmagical damage applies. Then cast **Shocking Grasp** on it and confirm that spell hit is not resisted for being nonmagical.
5. **GM:** Make Sage Stunned and force a Dexterity save. Confirm before and after the roll that it shows "automatic failure" and why.
6. **GM:** Clear Stunned. **P1:** Cast **Hold Person** on the Goblin to hold Concentration, then the GM applies Exhaustion 3 to Sage and damages her. Confirm **P1** is asked for a Concentration check that rolls with disadvantage and the roll prompt says why.
7. **GM:** Apply the homebrew auto-fail Constitution condition to Sage while she concentrates and damage her. Confirm the check is labelled an automatic failure and Concentration ends on it.
8. **GM:** Have the Magma Mephit cast **Heat Metal** (Concentration), then damage the Mephit with Exhaustion 3 on it: same disadvantage label. Repeat with the auto-fail condition: Concentration on the Mephit ends and its Heat Metal grant ends.
   R1. **GM:** Clear all conditions and Exhaustion.

## Expected

- Exhaustion levels follow the Creature's condition row level; the GM sets the level in the Encounter; automatic failures are labelled.
- A Creature that concentrates is treated like a Character for the check and the auto-fail.

## Other users see

- **P1:** Sees the labelled failure reasons on rolls they roll.

## ACs covered

SPELLS-10.1, SPELLS-10.2, SPELLS-10.3, SPELLS-10.4, SPELLS-10.5, SPELLS-10.6, SPELLS-9.1, SPELLS-2.4, SPELLS-9.2

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
