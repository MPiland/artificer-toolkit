# UAT-DEVICES-4: Campaigns on a phone: invitation, Party and Active Character

Campaigns on a phone: invitation, Party and Active Character.

Device pass · Feature DEVICES · Mode: Group (GM, P5, P1) · Device pass position 4 of 9

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated and one free player seat of the five the FREE plan allows ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- **P5** has an account and is a member of no Campaign. If P5 still belongs to one from [UAT-SOCIAL-2](../SOCIAL/UAT-SOCIAL-2.md), leave that Campaign first.
- **P1** has Aria as the Active Character in The Campaign ([UAT-BUILDER-1](../BUILDER/UAT-BUILDER-1.md), [UAT-CAMPAIGN-3](../CAMPAIGN/UAT-CAMPAIGN-3.md)).

## Accounts and windows

- **Roles used:** GM, P5, P1
- **Windows:** GM uses a desktop browser. P5 and P1 each use a phone (a real phone, or a browser device toolbar set to 375 px wide) in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **GM:** On desktop, open the profile of P5 from the Social Hub and invite them to The Campaign with a short message, as in [UAT-SOCIAL-2](../SOCIAL/UAT-SOCIAL-2.md) step 1.

1. [ ] **P5:** On the phone open **Social Hub**, then **Received invitations**. Open the invitation and read it.
2. [ ] **P5:** Accept the invitation.
3. [ ] **P5:** Open **Campaigns** and open The Campaign. Scroll the whole page.
4. [ ] **P1:** On the phone open **Campaigns**, open The Campaign and find the **Party** roster.
5. [ ] **P1:** Read each row of the roster (Character name and its owner). Find Aria and check she is marked as the Active Character.
6. [ ] **P1:** Find the control that makes a benched Character the Active Character (**Mark active**) and check it is fully visible and reachable with a thumb. Do not choose it.
7. [ ] **P1:** Open Aria's Sheet from the roster and go back.
8. [ ] **P5:** Leave The Campaign using its own leave control. If P5 cannot, **GM** removes P5 from the Campaign on desktop.

## Expected

- The invitation list, the invitation, the Campaign page and the Party roster fit the phone width with no sideways scroll and no overlapping text.
- Accepting makes P5 a member immediately, and The Campaign is listed under **Campaigns**.
- The roster shows one Active Character per player and a visible control to change it; every control is reachable.
- After step 8 P5 belongs to no Campaign again and The Campaign has its four players as before.

## Other users see

- **GM:** sees P5 become a member after step 2 and leave after step 8.
- **P5:** while a member, must NOT see the GM's private notes or other members' private Character data.

## ACs covered

Not tied to an AC: device coverage.

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
