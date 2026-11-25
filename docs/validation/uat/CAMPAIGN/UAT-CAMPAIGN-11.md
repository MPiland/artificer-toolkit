# UAT-CAMPAIGN-11: Mid-fight Character swap needs the GM's approval

Mid-fight Character swap needs the GM's approval.

Level 3 (Core play) · Feature CAMPAIGN · Mode: Group (GM, P1, P2, P3) · Path position 112 of 195

## Prerequisites

- Done in [UAT-REACTION-1](../REACTION/UAT-REACTION-1.md): P1 has Ember (level 3 Wizard with Hold Person) and Aria in The Campaign. Aria is P1's Active Character and Ember is Benched.
- Done in [UAT-SCENE-1](../SCENE/UAT-SCENE-1.md) and [UAT-ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md): "UAT Cavern" exists and The Campaign holds the Wolf and Goblin Blueprint.
- P2 has Bryn and P3 has Cade, each Active.

## Accounts and windows

- **Roles used:** GM, P1, P2, P3
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S0. **GM:** Choose **Complete encounter** on any running Encounter. **P1:** Choose **Mark active** on Ember (no Encounter is running, so no approval). **GM:** With "UAT Cavern" presented, create and start an Assisted Run from the Wolf and Goblin Blueprint with Ember, Bryn and Cade as the party, as in [ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md) steps 3 to 5. Auto-roll is on for P1 and off for the GM.

1. [ ] **GM and P1:** Note Ember's initiative slot and her token's position on the map.
2. [ ] **GM:** Advance to Ember's turn. **P1:** Cast Hold Person on the Goblin. Confirm Concentration shows on Ember and the Goblin is Paralyzed.
3. [ ] **P1:** On the Party roster choose **Mark active** on Aria. Confirm your card shows "Requested, waiting for the GM" with **Cancel request**, and Ember is still **Active**.
4. [ ] **GM:** Confirm the Party card shows "Swap Ember for Aria?" with Decline and Approve, and the header shows "1 Character swap request".
5. [ ] **P1:** Choose **Cancel request**. Confirm the waiting text is gone. **GM:** Confirm the card and the header button are gone.
6. [ ] **P1:** Choose **Mark active** on Aria again. **GM:** Choose **Decline**. Confirm nothing changes: Ember is still Active, Concentration shows and the Goblin is still Paralyzed. **P1:** Confirm the waiting text is gone.
7. [ ] **P1:** Choose **Mark active** on Aria a third time. **GM:** Open the header **1 Character swap request** button (the "Character swap requests" window) and choose **Approve**.
8. [ ] **All:** Confirm Aria is **Active** and Ember is **Benched**. Confirm the token is in the same position with the same initiative slot, and now shows the name Aria with her art or initial.
9. [ ] **GM and P1:** Confirm Ember's Concentration ended and the Goblin is no longer Paralyzed.
10. [ ] **GM:** Open the Encounter log. Confirm an entry reads "Ember swapped for Aria" (record the exact wording).
11. [ ] **P1:** Open Ember's Sheet from the roster and confirm it still opens. **P2, P3:** Confirm the token is named Aria and no request card is shown to you.

R1. **GM:** Choose **Complete encounter**. The end state is Aria Active and Ember Benched, as after REACTION-1.

## Expected

- When the Active Character is in a running Encounter, **Mark active** sends a request instead of switching. The player can cancel it; the GM can decline or approve it.
- On approval the new Character takes the old one's token and initiative slot, with the new name and portrait; the old Character's effects and Concentration end; the GM's log records the swap.

## Other users see

- **GM:** The swap request card on the Party panel and the header button, until answered.
- **P2, P3:** The token under its new name; never the request.

## ACs covered

D236

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
