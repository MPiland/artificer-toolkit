# UAT-PRIVACY-3: Non-members, removed players and signed-out visitors

Non-members, removed players and signed-out visitors.

Level 3 (Core play) · Feature PRIVACY · Mode: Group (GM, P1, P2, P5) · Path position 131 of 191

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- P1 has Aria, P2 has Bryn and P3 has Cade as their Characters in The Campaign (each a Level 1 Fighter, built by their player in the Character Builder).
- **P5** has an account, is not a member of The Campaign and owns no Character.

## Accounts and windows

- **Roles used:** GM, P1, P2, P5
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P5:** While signed in, open the tabletop address of The Campaign and the Campaign's own address (GM sends both addresses to P5).
2. [ ] **P5:** Search listings for The Campaign and open its public listing page, if one exists.
3. [ ] **GM:** Remove P2 from The Campaign while P2's tabletop window is open ([UAT-CAMPAIGN-2](../CAMPAIGN/UAT-CAMPAIGN-2.md) shows the removal control).
4. [ ] **P2:** Watch the tabletop window, then reload it.
5. [ ] **P2:** Try the old tabletop address and the Campaign address.
6. [ ] **P1:** Copy the address of Aria's Sheet and send it to P2. **P2:** Try to open it, and try to open the Sheet address of Bryn, your own old Character in The Campaign.
7. [ ] **P5:** Open a private window (not signed in) and open the tabletop address of The Campaign.
8. [ ] **P1:** Reload the tabletop window and confirm it still works as before.
       R1. **GM:** Re-seat P2 as in [CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md), and **P2:** choose Bryn again.

## Expected

- Steps 1, 2, 5, 6 and 7 give a clear refusal (for example "Campaign membership is no longer available.", not found, or sign in required; record the exact wording), and no Campaign data appears.
- The open tabletop window of P2 stops receiving updates after removal and closes or shows an access message.
- P2 cannot read Character Sheets from a Campaign they have left.

## Other users see

- **P5 (not a member):** must NOT see any tokens, chat, notes, announcements or roster of The Campaign, whether signed in or in the private window.
- **P2 (removed):** must NOT see any Encounter data, chat, notes or roster after removal.
- **P1 (still a member):** keeps full access and sees no change after P2 is removed.

## ACs covered

PRIVACY-1.2

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
