# UAT-BUILDER-5: Withdrawing shared content reconciles assigned Characters

Withdrawing shared content reconciles assigned Characters.

Level 2 (GM setup) · Feature BUILDER · Mode: Group (GM, P1) · Path position 54 of 195

## Prerequisites

- The account **P1** exists and is seated as a player in The Campaign.
- The account **GM** exists and hosts The Campaign.
- Done in [UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md): P1 is seated in The Campaign with Aria as their Campaign Character.
- Done in [UAT-AUTHORING-8](../AUTHORING/UAT-AUTHORING-8.md): the Feat "UAT Sharp Eyes" is Active and owned by P1.
- Done in [UAT-AUTHORING-11](../AUTHORING/UAT-AUTHORING-11.md): sharing homebrew with a Campaign is known.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **P1:** Share the Feat "UAT Sharp Eyes" with The Campaign as in [AUTHORING-11](../AUTHORING/UAT-AUTHORING-11.md).
S2. **P1:** Build and activate a Character named "UAT Shared" that takes the Feat "UAT Sharp Eyes" (as in [BUILDER-1](UAT-BUILDER-1.md) steps 1 to 10).
S3. **P1:** On The Campaign's Party panel choose **Add Character** and pick "UAT Shared" (it lands on the bench beside Aria), then choose **Mark active** on it (the build with the new Feat joins the party for this arc).

1. [ ] **P1:** Confirm "UAT Shared" in The Campaign has the Feat on the Sheet.
2. [ ] **P1:** Remove the share of the Feat from The Campaign content list.
3. [ ] **P1:** Open the Character and check the Sheet and Builder preview.
4. [ ] **P1:** Use the Builder to commit the repair, or reassign the Character's content as the page offers.
5. [ ] **GM:** Reload The Campaign page.
6. [ ] **P1:** Share the Feat again ([UAT-AUTHORING-11](../AUTHORING/UAT-AUTHORING-11.md) step 2), then **GM:** use **Remove player** on P1 in The Campaign Party. **P1:** open "UAT Shared" and your Characters list.
       R1. **GM:** Invite P1 back into The Campaign (the invite steps in the CAMPAIGN scenarios). **P1:** Accept, then on the Party panel choose **Add Character** and pick Aria (the removal released both Characters, so Aria is the Active Character again at once). Then delete "UAT Shared" from **Characters** (P1 is back to 1 of 6 personal Characters).

## Expected

- Step 3: the Character no longer holds the shared grant; the rest of its private state survives.
- Step 4: the Character returns to Active after the commit.
- Step 5: the Campaign shows no remnant of the withdrawn content.
- Step 6: P1's personal Characters keep everything except grants that came through the Campaign; nothing is left half-reconciled, and "UAT Shared" is released from the Campaign and still opens.

## Other users see

- **GM:** Sees the Campaign content list without the Feat after step 2 and the Party without P1 after step 6. P2 is not involved.

## ACs covered

BUILDER-3.4

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
