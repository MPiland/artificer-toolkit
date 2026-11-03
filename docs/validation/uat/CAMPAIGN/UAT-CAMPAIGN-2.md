# UAT-CAMPAIGN-2: Invite, accept, leave, remove, rejoin and transfer

Invite, accept, leave, remove, rejoin and transfer.

Level 2 (GM setup) · Feature CAMPAIGN · Mode: Group (GM, P1, P2) · Path position 53 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2**, who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- Done in [UAT-CAMPAIGN-1](UAT-CAMPAIGN-1.md): the second copy, with the "Plot" notes section, is the Sandbox Campaign; the original is archived.
- Done in [UAT-BUILDER-1](../BUILDER/UAT-BUILDER-1.md): "UAT Dara" is committed and in no Campaign.

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

1. **GM:** Open **Social** and create a listing for the Campaign, or open P1's profile and use the invite action to invite **P1** to the sandbox Campaign.
2. **P1:** Open **Social**, go to **Received invitations**, and accept the invitation.
3. **GM:** Repeat the invite for P2 and have **P2** accept.
4. **P1:** Open the sandbox Campaign, choose **Add Character** and assign "UAT Dara" (not Aria).
5. **P1:** Choose **Leave Campaign** and confirm.
6. **P1:** Try to open the Campaign's address again.
7. **GM:** Open the Campaign **Party** and check that P1's Character and seat are gone.
8. **GM:** Invite P1 again; **P1:** accept it and rejoin.
9. **GM:** On the Party, choose **Remove player** for P2 and confirm.
10. **P2:** Reload any open Campaign page.
11. **GM:** Re-invite P2; **P2:** accept again.
12. **GM:** In Settings, start an ownership transfer to P1.
13. **P1:** Accept the ownership offer.
14. **P1 (now GM):** Check that Settings and Manage controls are available; **GM (now player):** check they are gone.
15. **P1:** Transfer ownership back to the original GM, and **GM:** accept.
    R1. **P1:** After the rejoin in step 8 your Character was released. Choose **Add Character** and assign "UAT Dara" again.

## Expected

- After leaving or removal the player cannot open the Campaign ("Campaign membership is no longer available." or an access message) and the seat and Character assignment are released.
- Rejoining works and starts clean; nothing from before returns automatically.
- Ownership transfer needs acceptance within seven days, and fails with a clear message if the new owner's plan cannot host another Campaign. After a successful transfer roles switch immediately and the old owner is a Player.

## Other users see

- **P2:** after removal (step 10) sees an access-lost message and does not see the Party, chat or notes of the Campaign.
- **P1 and P2:** never see the GM-only Campaign settings before a transfer (check at steps 4 and 8).

## ACs covered

CAMPAIGN-2.3, CAMPAIGN-2.4, CAMPAIGN-2.5

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
