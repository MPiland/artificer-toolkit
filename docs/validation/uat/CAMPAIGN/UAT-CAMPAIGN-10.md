# UAT-CAMPAIGN-10: Bench a second Character and mark it active

Bench a second Character and mark it active.

Level 2 (GM setup) · Feature CAMPAIGN · Mode: Group (GM, P1, P2) · Path position 50 of 195

## Prerequisites

- Done in [UAT-CAMPAIGN-9](UAT-CAMPAIGN-9.md): P1, P2 and P3 are seated in The Campaign with Aria, Bryn and Cade. Aria is P1's Active Character.
- **P1** has fewer than 6 personal Characters (FREE limit), so there is room for one more.
- No Encounter is running in The Campaign.

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S0. **P1:** In the Builder (as in [BUILDER-1](../BUILDER/UAT-BUILDER-1.md) steps 1 to 10) build and activate **UAT Bench**, a Level 1 Fighter. P1 is trying a second build for the party.

1. [ ] **P1:** Open The Campaign's **Party** panel. Note your card: Aria with the badge **Active**.
2. [ ] **P1:** Choose **Add Character**. Confirm the picker hides Aria, Bryn and Cade (they are already in a Campaign) and offers UAT Bench. Pick UAT Bench.
3. [ ] **P1:** Confirm the roster shows Aria as **Active** and UAT Bench as **Benched**. The Benched card has **Mark active** and **Remove Character**. Confirm there is no **Change Character** button anywhere.
4. [ ] **GM and P2:** Open the Party panel. Confirm P1 shows both cards, Aria **Active** and UAT Bench **Benched**.
5. [ ] **P1:** Choose **Mark active** on UAT Bench (no Encounter is running). Confirm it switches at once, with no waiting message: UAT Bench is **Active** and Aria is **Benched**.
6. [ ] **GM and P2:** Confirm the roster shows the same change.
7. [ ] **P1:** Choose **Remove Character** on UAT Bench (the Active Character). Confirm Aria stays on the bench and nobody is Active for P1 (Aria is not promoted by herself).
8. [ ] **GM and P2:** Confirm the roster shows P1 with no Active Character and Aria benched.
9. [ ] **P1:** Choose **Mark active** on Aria. Confirm Aria is **Active** again.

R1. **P1:** Delete UAT Bench from **Characters** (P1 is back to the Characters from before S0).

## Expected

- A player can keep several Characters in one Campaign. Exactly one is **Active**; the rest are **Benched**.
- The picker hides Characters already in any Campaign.
- Outside an Encounter, **Mark active** switches at once and everyone sees the change.
- Removing the Active Character leaves nobody active until the player marks one.

## Other users see

- **GM, P2:** The Party roster shows P1's Active and Benched cards and each change live.

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
