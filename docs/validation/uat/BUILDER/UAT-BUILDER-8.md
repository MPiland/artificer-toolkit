# UAT-BUILDER-8: Permanently delete a Character that is in a running Encounter

A player permanently deletes their own Character from the Characters list and from the Sheet; the Campaign and its running Encounter let it go.

Level 2 (GM setup) · Feature BUILDER · Mode: Group (GM, P1) · Path position 61 of 191

## Prerequisites

- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **GM**, owner of the four review Campaigns.
- Done in [UAT-BUILDER-7](UAT-BUILDER-7.md): P1 can build and activate a Character ([BUILDER-1](UAT-BUILDER-1.md) steps 1 to 10).

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. **P1:** Build and activate two Fighters named "UAT Delete Me" and "UAT Keep Me" ([BUILDER-1](UAT-BUILDER-1.md) steps 1 to 10).
S2. **P1:** On the Sandbox Campaign's Party panel choose **Change Character** and assign "UAT Delete Me".
S3. **GM:** Start an Encounter in the Sandbox Campaign that includes "UAT Delete Me" and leave it running.

1. **GM:** Try to find a way to delete "UAT Delete Me" (open the Campaign Party panel and the Character link).
2. **P1:** Open `<STAGING_URL>/characters`, open the actions on "UAT Delete Me" and choose **Delete**. Read the confirmation, then choose **Cancel**.
3. **P1:** Choose **Delete** again and confirm.
4. **P1:** Reopen the old "UAT Delete Me" Sheet link and Builder link (use the browser Back history).
5. **GM:** Reload the Sandbox Campaign and look at the Party panel and the running Encounter.
6. **P1:** Open "UAT Keep Me" and check it is unchanged. Then open it and use the trash icon in the Sheet header: confirm the dialog names "UAT Keep Me", choose **Cancel**.
7. **P1:** Check the Characters list and the Party panel once more.
   R1. **P1:** Build a replacement Character if later scenarios need one.

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
- **Set:**
- **Role:**
- **Failed step:**
- **Notes:**
