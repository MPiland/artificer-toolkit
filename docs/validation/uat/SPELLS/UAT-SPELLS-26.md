# UAT-SPELLS-26: Sheet attack rows match the room, and an always-on feature that rests restore (Tranquility)

Sheet attack rows match the room, and an always-on feature that rests restore (Tranquility).

Level 4 (Advanced play) · Feature SPELLS · Mode: Group (GM, P1, P2, P3) · Path position 177 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2**, who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- Done in [UAT-SPELLS-2](UAT-SPELLS-2.md): the arena Encounter from SPELLS-2 is running in Review: Party in the Field with Sage (P1), Hale (P2) and Vex (P3).

## Accounts and windows

- **Roles used:** GM, P1, P2, P3
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. **P2:** For part B build Kade (Monk, Way of the Open Hand, level 11) in the Builder. Kade and Hale are never in the Campaign together.
Part A (Sage and Hale):

1. **P1:** On Sage's Sheet note the attack and damage rows. **P2:** In the Encounter have Hale cast **Bless** on Sage. **P1:** Read the Sheet row again. Confirm the Bless bonus is folded into the row.
2. **P1:** Sage attacks with her quarterstaff in the Encounter. Confirm the room rolls the same bonus and damage dice the Sheet row showed.

Part B (swap):

3. **P2:** While the Encounter is still running, try **Change Character** and confirm it is refused. **GM:** Choose **Complete encounter**. **P2:** Now use **Change Character** and pick Kade in place of Hale. **GM:** Start a new Encounter with Kade, Sage and a Goblin.
4. **P2:** On Kade's Sheet confirm Tranquility shows as active, not as a use.
5. **P2:** Make Kade attack the Goblin so the feature's End On condition fires. Confirm the Sheet reads "ended until" the rest it returns on, and that its grants are gone.
6. **GM:** Undo the attack. Confirm the feature is active again.
7. **GM:** Choose **Complete encounter**. **P2:** Attack once outside the Encounter if the feature is active again, or leave it ended, then take a **Long Rest** from Kade's Sheet. Confirm Tranquility returns to active.

## Expected

- The Sheet and room agree; the feature is never shown as a use counter.
- The swap succeeds only because no Encounter is running; during an Encounter **Change Character** is refused.

## Other users see

- **P1:** Sees Bless on Sage in both places, and must NOT see Kade's Sheet.
- **P3:** Sees nothing of the swap beyond the roster name changing.

## ACs covered

SPELLS-8.6, SPELLS-31.2

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
