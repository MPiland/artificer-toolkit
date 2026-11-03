# UAT-SPELLS-8: Attack and check modifiers from conditions

Attack and check modifiers from conditions.

Level 4 (Advanced play) · Feature SPELLS · Run order 157 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2** (`Review_Pl_Bryn`), who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the account **P3** (`Review_Pl_Cade`), who owns Cade (in Review: Party in the Field) and is also a member of Review: Sandbox.
- Done in [UAT-SPELLS-2](UAT-SPELLS-2.md): the arena Encounter from SPELLS-2 is running in Review: Party in the Field with Sage (P1), Hale (P2) and Vex (P3).

## Accounts and windows

- **Accounts:** GM, P1, P2
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

S1. **P1, P2:** Auto-roll OFF. **GM:** Place a Goblin adjacent to Sage and mark a Goblin hidden for step 6.
S2. **GM:** For step 7, on a homebrew copy of the System record under `/systems`, define the homebrew condition and make the Campaign use that System. If the Campaign cannot use it or no condition editor exists, record step 7 BLOCKED with that reason.

1. **GM:** Apply **Poisoned** to Sage from the condition control. **P1:** attack. Confirm disadvantage with the reason "Poisoned".
2. **GM:** Replace with **Frightened**, then **Prone**, then **Restrained**. Each time confirm Sage's attacks roll with disadvantage naming the condition.
3. **GM:** Make the Goblin Restrained, Stunned, Unconscious and Petrified in turn. Confirm attacks against each have advantage naming the condition.
4. **GM:** Make the Goblin Prone. Confirm an adjacent attacker has advantage and one more than 5 feet away has disadvantage.
5. **GM:** Apply Poisoned to Sage and start an Overrun or Tumble contest. Confirm Sage's ability check has disadvantage.
6. **GM:** Add a Goblin token, mark it hidden, and make the hidden Goblin Frightened. Have it contest Hale's Overrun (or Tumble) so **P2** is asked for a roll. **P2:** Confirm the roll prompt shows disadvantage or the plain contest without naming the hidden Goblin's Frightened condition. Doubt: what exactly a player sees of a hidden holder's condition in a contest prompt.
7. **GM:** Create a homebrew condition (for example "Dazed" with disadvantage on attack rolls), apply it to Sage, and have **P1** attack. Confirm the roll shows disadvantage naming "Dazed", the same way the SRD conditions did in step 2.
8. **GM:** Set **Exhaustion** level 1 on Sage. Confirm ability checks have disadvantage; level 2 halves speed; level 3 gives attack and save disadvantage; level 5 sets speed 0.
9. **P1:** Choose Dash while Restrained and again at Exhaustion 5. Confirm the movement budget stays 0 each time and returns to normal once the condition is removed.
   R1. **GM:** Clear every condition and Exhaustion from Sage and the Goblin.

## Expected

- Modes are derived with the condition named, restored when the condition is removed.

## Other users see

- **P2:** Sees condition badges on tokens. A hidden holder's condition source is not named.

## ACs covered

SPELLS-2.2, SPELLS-2.5, SPELLS-2.6, SPELLS-2.7, SPELLS-2.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
