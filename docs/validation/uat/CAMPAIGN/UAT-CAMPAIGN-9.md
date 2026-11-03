# UAT-CAMPAIGN-9: Seat the whole party in the Sandbox Campaign

Seat the whole party in the Sandbox Campaign.

Level 2 (GM setup) · Feature CAMPAIGN · Mode: Group (GM, P1, P2, P3) · Path position 56 of 190

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- Done in [UAT-CAMPAIGN-2](UAT-CAMPAIGN-2.md): the Sandbox Campaign is owned by GM, P1 is a member with "UAT Dara", P2 is a member with no Character.
- Done in [UAT-BUILDER-7](../BUILDER/UAT-BUILDER-7.md): "UAT Bryn Sandbox" (P2) and "UAT Cade Sandbox" (P3) are committed and in no Campaign.
- The review data provides the account **P3**, who owns Cade (in Review: Party in the Field) and is also a member of Review: Sandbox.

## Accounts and windows

- **Roles used:** GM, P1, P2, P3
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

1. **GM:** Open the Sandbox Campaign (the copy with the "Plot" notes from [CAMPAIGN-1](../CAMPAIGN/UAT-CAMPAIGN-1.md)) and open its **Party** panel. Note which of P1, P2 and P3 are members and which Character each has.
2. **GM:** For each of P2 and P3 who is not a member, open **Social**, open the player's profile and invite them to the Sandbox Campaign. **P2 / P3:** open **Social**, **Received invitations**, and accept.
3. **P2:** In the Sandbox Campaign choose **Add Character** (or **Change Character**) and assign "UAT Bryn Sandbox".
4. **P3:** Do the same with "UAT Cade Sandbox".
5. **P1:** If the Party panel shows no Character for you, assign "UAT Dara".
6. **GM:** Reload the Party panel.

## Expected

- The Party panel lists P1 with "UAT Dara", P2 with "UAT Bryn Sandbox" and P3 with "UAT Cade Sandbox".
- Each Character is in this one Campaign only. Nobody was added twice.
- Later scenarios send you back here whenever they remove a player: repeat only the steps for the player who is missing.

## Other users see

- **P1, P2, P3:** Each sees the Sandbox Campaign under **Campaigns** after accepting, with the Party roster.

## ACs covered

none (set-up for the Scene, Encounter and Move scenarios; no acceptance criterion)

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
