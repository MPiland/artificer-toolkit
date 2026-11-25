# UAT-CAMPAIGN-9: Seat the whole party in The Campaign

Seat the whole party in The Campaign.

Level 2 (GM setup) · Feature CAMPAIGN · Mode: Group (GM, P1, P2, P3, P4) · Path position 49 of 195

## Prerequisites

- Done in [UAT-CAMPAIGN-2](UAT-CAMPAIGN-2.md): The Campaign is hosted by GM, P1 is a member with Aria, and P2 is a member with no Character.
- Done in [UAT-BUILDER-7](../BUILDER/UAT-BUILDER-7.md): Bryn (P2) and Cade (P3) are committed and in no Campaign.
- **P3** and **P4** have accounts and are members of no Campaign. P4 needs no Character.
- All accounts are on the FREE plan: 1 active hosted Campaign per account, 5 player seats per Campaign, 5 Scenes per Campaign and 6 personal Characters per account.

## Accounts and windows

- **Roles used:** GM, P1, P2, P3, P4
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **GM:** Open The Campaign (the copy with the "Plot" notes from [CAMPAIGN-1](../CAMPAIGN/UAT-CAMPAIGN-1.md)) and open its **Party** panel. Note which of P1, P2, P3 and P4 are members and which Character each has.
2. [ ] **GM:** For each of P2, P3 and P4 who is not a member, open **Social**, open the player's profile and invite them to The Campaign. **P2 / P3 / P4:** open **Social**, **Received invitations**, and accept.
3. [ ] **P2:** In The Campaign choose **Add Character** and pick Bryn. Confirm Bryn shows as the Active Character.
4. [ ] **P3:** Do the same with Cade.
5. [ ] **P1:** If the Party panel shows no Character for you, choose **Add Character** and pick Aria.
6. [ ] **GM:** Reload the Party panel.

## Expected

- The Party panel lists P1 with Aria, P2 with Bryn, P3 with Cade and P4 with no Character.
- Each Character is in this one Campaign only. Nobody was added twice. Four players use four of the five player seats.
- Later scenarios send you back here whenever they remove a player: repeat only the steps for the player who is missing.

## Other users see

- **P1, P2, P3, P4:** Each sees The Campaign under **Campaigns** after accepting, with the Party roster.

## ACs covered

none (set-up for the Scene, Encounter and Move scenarios; no acceptance criterion)

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
