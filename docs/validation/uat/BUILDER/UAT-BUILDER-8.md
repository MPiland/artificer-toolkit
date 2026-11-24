# UAT-BUILDER-8: Permanently delete a Character that is in a running Encounter

A player permanently deletes their own Character from the Characters list and from the Sheet; the Campaign and its running Encounter let it go.

Level 2 (GM setup) · Feature BUILDER · Mode: Group (GM, P1) · Path position 69 of 191

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)). P1 has Aria as their Campaign Character (1 of 6 personal Characters).
- An Encounter is running in The Campaign ([UAT-ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md)).

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **P1:** Build and activate two Fighters named "UAT Delete Me" and "UAT Keep Me" ([BUILDER-1](UAT-BUILDER-1.md) steps 1 to 10).
S2. **P1:** On The Campaign's Party panel choose **Change Character** and assign "UAT Delete Me".
S3. **GM:** Start an Encounter in The Campaign that includes "UAT Delete Me" and leave it running.

1. [ ] **GM:** Try to find a way to delete "UAT Delete Me" (open the Campaign Party panel and the Character link).
2. [ ] **P1:** Open `<STAGING_URL>/characters`, open the actions on "UAT Delete Me" and choose **Delete**. Read the confirmation, then choose **Cancel**.
3. [ ] **P1:** Choose **Delete** again and confirm.
4. [ ] **P1:** Reopen the old "UAT Delete Me" Sheet link and Builder link (use the browser Back history).
5. [ ] **GM:** Reload The Campaign and look at the Party panel and the running Encounter.
6. [ ] **P1:** Open "UAT Keep Me" and check it is unchanged. Then open it and use the trash icon in the Sheet header: confirm the dialog names "UAT Keep Me", choose **Cancel**.
7. [ ] **P1:** Check the Characters list and the Party panel once more.
       R1. **P1:** Delete "UAT Keep Me" from **Characters**, then on the Party panel choose **Add Character** and assign Aria (P1 has 1 of 6 personal Characters again). **GM:** Complete the Encounter and start a new one on the presented Scene with the Wolf, the Goblin and Aria, Bryn and Cade as in [UAT-ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md) steps 3 to 5.

## Expected

- Step 1: the GM has no delete action for the player's Character.
- Step 2: the confirmation names "UAT Delete Me", says it is permanent and cannot be restored; Cancel leaves the Character in the list.
- Step 3: the Character leaves the list at once.
- Step 4: both links show that the Character could not be found.
- Step 5: the Party panel no longer lists "UAT Delete Me", and the Encounter no longer has its token or effects.
- Step 6: "UAT Keep Me" is unchanged and still listed; Cancel deletes nothing.
- Step 7: "UAT Keep Me" and every shared or homebrew item either Character used are still there.

## Other users see

- **GM:** The Character leaves the Party and the running Encounter without the Encounter ending.
- **P1:** Only their own Characters; nothing of the deleted Character remains.

## ACs covered

BUILDER-5.1, BUILDER-5.2, BUILDER-5.3

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
