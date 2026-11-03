# UAT-SPELLS-13: Reaction spells: Shield and Counterspell, one-roll grants

Reaction spells: Shield and Counterspell, one-roll grants.

Level 4 (Advanced play) · Feature SPELLS · Run order 162 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2** (`Review_Pl_Bryn`), who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the account **P3** (`Review_Pl_Cade`), who owns Cade (in Review: Party in the Field) and is also a member of Review: Sandbox.
- Done in [UAT-SPELLS-2](UAT-SPELLS-2.md): the arena Encounter from SPELLS-2 is running in Review: Party in the Field with Sage (P1), Hale (P2) and Vex (P3).

## Accounts and windows

- **Accounts:** GM, P1, P2, P3
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

S1. Sage needs Shield and Counterspell prepared and a 3rd-level slot spare; Hale needs Aid and Blade Barrier prepared.

1. **GM:** Have the Wolf attack Sage. **P1:** On the reaction prompt choose **Use** Shield. Confirm the attack is held until answered and that a hit can turn into a miss.
2. **P1:** Take the rest of Sage's turn, then pass to the next round. Confirm Shield's +5 AC ends at the start of Sage's next turn.
3. **P2:** On Hale's turn cast **Aid** (a 2nd-level spell) at a Character. **P1:** On the reaction prompt use **Counterspell** with a 3rd-level slot. Confirm Aid is countered and does nothing.
4. **P2:** Hale casts **Blade Barrier** (a 6th-level spell). **P1:** Use Counterspell with a 3rd-level slot. Confirm a Counterspell ability check is asked for (against a DC set by the spell's level), and that even if the check fails the slot is spent.
5. **GM:** Have the Wolf attack Sage again. **P1:** Decline the reaction. Confirm the attack resolves.
6. **GM:** Confirm Sage cannot react twice in a round (her second reaction prompt in the same round is not offered).
7. **P1:** Cast **Shocking Grasp** on the Wolf. Confirm the Wolf is then offered no opportunity attack or other reaction until the grant ends (move Hale away from the Wolf to check).
8. **P3:** Vex casts **Vicious Mockery** on the Goblin (a one-roll attack-disadvantage grant). **GM:** Then trigger an opportunity attack by the Goblin and, on another turn, a Disarm attempt by it. Confirm each attack roll uses up the grant (the next attack after the first is not at disadvantage).
9. **P2:** Try to answer Sage's reaction prompt on P2's screen. Confirm P2 is refused. **GM:** Answer for P1 once instead.

## Expected

- Reactions pause the hit or cast; only the reactor's controller or the GM answers; Shield's lifetime is as listed.
- A one-roll grant ends on the holder's next attack roll of any kind, including opportunity attacks and Disarm.

## Other users see

- **P2:** Sees a held-action pending state and the final result; must NOT be able to answer Sage's prompt.
- **P3:** Sees the same pending state.

## ACs covered

SPELLS-8.3, SPELLS-5.4, SPELLS-5.5, SPELLS-5.10

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
