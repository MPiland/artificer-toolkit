# UAT-SPELLS-26: Sheet attack rows match the room, and an always-on feature that rests restore (Tranquility)

Sheet attack rows match the room, and an always-on feature that rests restore (Tranquility).

Level 4 (Advanced play) · Feature SPELLS · Mode: Group (GM, P1, P2, P3) · Path position 184 of 195

## Prerequisites

- **The Campaign** is hosted by GM with P1, P2 and P3 seated as players.
- Done in [UAT-SPELLS-2](UAT-SPELLS-2.md): the arena Encounter from SPELLS-2 is running in The Campaign with Sage (P1), Hale (P2) and Vex (P3).

## Accounts and windows

- **Roles used:** GM, P1, P2, P3
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **P2:** For part B build Kade (Monk, Way of the Open Hand, level 11) in the Builder. Hale stays on the bench in The Campaign while Kade is the Active Character.
Part A (Sage and Hale):

1. [ ] **P1:** On Sage's Sheet note the attack and damage rows. **P2:** In the Encounter have Hale cast **Bless** on Sage. **P1:** Read the Sheet row again. Confirm the Bless bonus is folded into the row.
2. [ ] **P1:** Sage attacks with her quarterstaff in the Encounter. Confirm the room rolls the same bonus and damage dice the Sheet row showed.

Part B (swap):

3. [ ] **GM:** Choose **Complete encounter** (Kade joins the party between fights). **P2:** Choose **Add Character** and pick Kade (he lands on the bench beside Hale), then choose **Mark active** on Kade. It takes effect at once, with no GM approval, because no Encounter is running. **GM:** Start a new Encounter with Kade, Sage and a Goblin.
4. [ ] **P2:** On Kade's Sheet confirm Tranquility shows as active, not as a use.
5. [ ] **P2:** Make Kade attack the Goblin so the feature's End On condition fires. Confirm the Sheet reads "ended until" the rest it returns on, and that its grants are gone.
6. [ ] **GM:** Undo the attack. Confirm the feature is active again.
7. [ ] **GM:** Choose **Complete encounter**. **P2:** Attack once outside the Encounter if the feature is active again, or leave it ended, then take a **Long Rest** from Kade's Sheet. Confirm Tranquility returns to active.

## Expected

- The Sheet and room agree; the feature is never shown as a use counter.
- Marking Kade active takes effect at once because no Encounter is running (a swap during a running Encounter needs the GM's approval: see [UAT-CAMPAIGN-11](../CAMPAIGN/UAT-CAMPAIGN-11.md)).

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
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
