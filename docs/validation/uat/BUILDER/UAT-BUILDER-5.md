# UAT-BUILDER-5: Withdrawing shared content reconciles assigned Characters

Withdrawing shared content reconciles assigned Characters.

Level 2 (GM setup) · Feature BUILDER · Mode: Group (GM, P1) · Path position 58 of 188

## Prerequisites

- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **GM**, owner of the four review Campaigns.
- Done in [UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md): P1 is a member of the Sandbox Campaign with "UAT Dara" assigned.
- Done in [UAT-AUTHORING-8](../AUTHORING/UAT-AUTHORING-8.md): the Feat "UAT Sharp Eyes" is Active and owned by P1.
- Done in [UAT-AUTHORING-11](../AUTHORING/UAT-AUTHORING-11.md): sharing homebrew with a Campaign is known.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. **P1:** Share the Feat "UAT Sharp Eyes" with the Sandbox Campaign as in [AUTHORING-11](../AUTHORING/UAT-AUTHORING-11.md).
S2. **P1:** Build and activate a Character named "UAT Shared" that takes the Feat "UAT Sharp Eyes" (as in [BUILDER-1](UAT-BUILDER-1.md) steps 1 to 10).
S3. **P1:** On the Sandbox Campaign's Party panel choose **Change Character** and assign "UAT Shared" in place of "UAT Dara".

1. **P1:** Confirm "UAT Shared" in the sandbox Campaign has the Feat on the Sheet.
2. **P1:** Remove the share of the Feat from the sandbox Campaign content list.
3. **P1:** Open the Character and check the Sheet and Builder preview.
4. **P1:** Use the Builder to commit the repair, or reassign the Character's content as the page offers.
5. **GM:** Reload the sandbox Campaign page.
6. **P1:** Share the Feat again ([UAT-AUTHORING-11](../AUTHORING/UAT-AUTHORING-11.md) step 2), then **GM:** use **Remove player** on P1 in the sandbox Campaign Party. **P1:** open "UAT Shared" and your Characters list.
   R1. **P1:** On the Sandbox Campaign's Party panel choose **Change Character** and put "UAT Dara" back.

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
- **Set:**
- **Role:**
- **Failed step:**
- **Notes:**
