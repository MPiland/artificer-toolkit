# UAT-CAMPAIGN-13: Swap in a Prepared Encounter needs no request

Swap in a Prepared Encounter needs no request.

Level 3 (Core play) · Feature CAMPAIGN · Mode: Group (GM, P1) · Path position 114 of 195

## Prerequisites

- Done in [UAT-CAMPAIGN-11](UAT-CAMPAIGN-11.md): P1 has Ember and Aria in The Campaign; the Wolf and Goblin Blueprint and "UAT Cavern" are ready.
- Aria is P1's Active Character, Ember is Benched and no Encounter is running.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **GM:** With "UAT Cavern" presented, create a Run from the Wolf and Goblin Blueprint with Aria in the party, and leave it **Prepared** (do not start it). Note Aria's token and slot.
2. [ ] **P1:** Choose **Mark active** on Ember. Confirm it switches at once: no "Requested, waiting for the GM" text for P1, and no request card or header button for the **GM**.
3. [ ] **GM:** Confirm the Prepared Run's token is now Ember, in the same slot as Aria's was.
4. [ ] **GM:** Start the Run. Confirm Ember takes part under her own name.

R1. **GM:** Complete the Run. **P1:** Choose **Mark active** on Aria.

## Expected

- In a Prepared Encounter, **Mark active** swaps immediately with no GM approval; the token and slot are kept with the new name and portrait.

## Other users see

- **GM:** The token renamed; no request.

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
