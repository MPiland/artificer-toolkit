# UAT-SPELLS-16: Grants and Concentration carry over after the Encounter

Grants and Concentration carry over after the Encounter.

Level 4 (Advanced play) · Feature SPELLS · Mode: Group (GM, P1, P2, P3) · Path position 167 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2**, who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the account **P3**, who owns Cade (in Review: Party in the Field) and is also a member of Review: Sandbox.
- Done in [UAT-SPELLS-2](UAT-SPELLS-2.md): the arena Encounter from SPELLS-2 is running in Review: Party in the Field with Sage (P1), Hale (P2) and Vex (P3).

## Accounts and windows

- **Roles used:** GM, P1, P2, P3
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. **GM:** Enable the Campaign clock (the **World time** control on the Campaign page) in the Campaign settings. Vex stands in for the "timed condition" target. **Everyone:** Take a Long Rest on the Sheet first if the scenario needs spare slots, and clear old grants and conditions from earlier scenarios.

1. **P1:** Sage casts **Fly** on herself and holds Concentration. **P2:** Hale casts **Aid** on Sage (a grant with a duration, no Concentration).
2. **P1:** Sage casts **Blindness/Deafness** on Vex, choosing Blindness. **P3:** Fail the save when prompted. Confirm Vex is Blinded. **GM:** Add a Goblin and have **P3** cast **Vicious Mockery** on it so a Creature also holds a grant.
3. **GM:** Choose **Complete encounter**. Confirm the offer "Advance world time?" appears with the elapsed rounds. Accept.
4. **P1:** Confirm on Sage's Sheet that Fly's grant and Aid carry over. **P3:** Confirm Vex's Sheet still shows Blinded with its time left. **GM:** Confirm the Goblin's grant is gone (a Creature's grants end with the Run).
5. **P1:** Open Sage's Sheet outside any Encounter and end Concentration on Fly yourself. Confirm Fly's grant ends with no action used. Cast Fly again and end it again to confirm the same.
6. **P1:** Cast Fly again. **GM:** Start a later Encounter (rebuild the arena with scenario 2 steps 4 and 5). **P1:** Confirm Sage is still concentrating. **GM:** Damage Sage and confirm a Concentration check is staged for **P1**; fail it and confirm Fly and every other carried grant that depended on it ends.
7. **GM:** Cast or apply a new timed grant on Sage with a duration shorter than a few rounds, play those rounds, and confirm the grant counts down in rounds and ends when time runs out.
8. **GM:** Advance **World time** past the Blindness/Deafness duration (one minute). **P3:** Confirm Vex's Blinded condition is released on the Sheet and in the Encounter.

## Expected

- A carried condition does not stay forever on the Character; carried grants and conditions expire on the Campaign clock or when the GM ends them.
- The caster alone controls ending their Concentration.

## Other users see

- **P2:** Sees Hale's own carried Aid grant on her Sheet only; must NOT see Sage's Concentration check prompt.
- **P3:** Sees Vex's own Blinded state expire, and nothing of Sage's Sheet.

## ACs covered

SPELLS-5.9, SPELLS-5.11, SPELLS-5.12, SPELLS-5.13, SPELLS-5.14

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
