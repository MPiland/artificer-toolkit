# UAT-CAMPAIGN-12: Character swap on the player's own turn

Character swap on the player's own turn.

Level 3 (Core play) · Feature CAMPAIGN · Mode: Group (GM, P1, P2, P3) · Path position 113 of 195

## Prerequisites

- Done in [UAT-CAMPAIGN-11](UAT-CAMPAIGN-11.md): P1 has Ember and Aria in The Campaign; the Wolf and Goblin Blueprint and "UAT Cavern" are ready.
- The Campaign has no running Encounter, Aria is P1's Active Character and Ember is Benched.

## Accounts and windows

- **Roles used:** GM, P1, P2, P3
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S0. **P1:** Choose **Mark active** on Ember (no Encounter is running). **GM:** Start an Assisted Run on "UAT Cavern" from the Wolf and Goblin Blueprint with Ember, Bryn and Cade, as in [ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md) steps 3 to 5.

1. [ ] **GM:** Advance until it is Ember's turn. Note the creature that comes after her.
2. [ ] **P1:** Choose **Mark active** on Aria. Confirm "Requested, waiting for the GM".
3. [ ] **GM:** Approve the request during Ember's turn.
4. [ ] **All:** Confirm Ember's turn ended and the next creature is up. Confirm Aria holds Ember's slot, and acts in it next round.
5. [ ] **P1:** Choose **Mark active** on Ember again and have the **GM** approve it, so Ember is the Active Character before the next step.
6. [ ] **GM:** Have the Wolf attack Ember so P1's Shield prompt is open and still waiting; do not answer it.
7. [ ] **P1:** Choose **Mark active** on Aria. **GM:** Approve the request while the prompt is open. Record which of these happens: the prompt is cancelled and the swap completes at once, or the swap waits until P1 answers the prompt and then completes. Record anything else.

R1. **GM:** Choose **Complete encounter**. **P1:** Make sure Aria is the Active Character (choose **Mark active** on Aria if not).

## Expected

- Approving a swap on the Active Character's own turn ends that turn once and the next creature is up; the new Character acts in the same slot next round.
- A pending decision for the old Character is cancelled where possible; otherwise the swap waits for the answer and then completes.

## Other users see

- **GM:** The request card and the turn change.
- **P2, P3:** The turn moving on and the token under its new name.

## ACs covered

D236

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
