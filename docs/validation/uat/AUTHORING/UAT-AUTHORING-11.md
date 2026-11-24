# UAT-AUTHORING-11: Share homebrew with a Campaign, then withdraw it

Share homebrew with a Campaign, then withdraw it.

Level 2 (GM setup) · Feature AUTHORING · Mode: Group (GM, P1, P2, P5) · Path position 52 of 191

## Prerequisites

- The account **P1** exists (a free account, a player in The Campaign).
- The account **P2** exists (a free account, a player in The Campaign), used only for the cross-role check.
- The account **GM** exists (a free account that hosts The Campaign).
- Done in [UAT-AUTHORING-4](UAT-AUTHORING-4.md): the Spell "UAT Ember Dart" is Active and owned by P1.
- The account **P5** exists and is not a member of The Campaign.

## Accounts and windows

- **Roles used:** GM, P1, P2, P5
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1:** Open the Campaign page of The Campaign and find **Campaign content**.
2. [ ] **P1:** Under **Share owned homebrew**, set **Content type** to Spell, pick **Owned homebrew** "UAT Ember Dart", and choose **Share**.
3. [ ] **P2:** Open the same Campaign page and look at **Campaign content**.
4. [ ] **GM:** Do the same.
5. [ ] **P1:** Open "UAT Ember Dart", edit the description, and **Activate** the new version.
6. [ ] **P2:** Reload **Campaign content** and open the shared Spell.
7. [ ] **P2:** Look for a way to remove the share (it was shared by P1).
8. [ ] **GM:** Look for a way to remove the share.
9. [ ] **P1:** Remove the share (the unshare control next to the entry).
10. [ ] **P2:** Reload **Campaign content**.
11. [ ] **P5:** P1 sends P5 the address of The Campaign page. P5 opens it.
12. [ ] **P1:** Back on The Campaign page, open **Share owned homebrew**, set **Content type** to Background, and look at **Owned homebrew**: P1 has an unpublished draft if [UAT-AUTHORING-3](UAT-AUTHORING-3.md) left one, otherwise create a draft Background first.

## Expected

- Step 3-4: P2 and the GM see the shared Spell as "Shared by" P1; the **Share owned homebrew** panel is available only to members who own homebrew.
- Step 6: the shared entry now shows the new description after P1 republished.
- Step 7-8: only P1 (the recorded author) can remove the share; other users see no remove control or are refused.
- Step 10: the entry is gone for P2.
- Step 11: P5 is not a member: the Campaign page shows no Campaign content and no share panel.
- Step 12: only active homebrew appears in **Owned homebrew**; the draft Background does not.

## Other users see

- **P2 / GM:** See above. **P5:** nothing of The Campaign's content. (Maturity masking of shared content is not exercised here; it is an unverified part of AUTHORING-15.2.)

## ACs covered

AUTHORING-15.2, AUTHORING-15.3, AUTHORING-2.2

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
