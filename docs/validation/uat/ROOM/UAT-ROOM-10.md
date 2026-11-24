# UAT-ROOM-10: Archiving a Campaign closes its live room

Archiving a Campaign closes its live room.

Level 3 (Core play) · Feature ROOM · Mode: Group (P4, P1) · Path position 89 of 191

## Prerequisites

- Done in [EXPLORATORY-3](../EXPLORATORY/EXPLORATORY-3.md): P4 hosts "P4's Campaign" (active, with P5 seated). A free account hosts one active Campaign, and GM already hosts The Campaign.
- The account **P1** exists and can join another Campaign.

## Accounts and windows

- **Roles used:** P4, P1
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **P4:** Open P4's Campaign and invite P1 by username (seats used: P5 and P1, of 5). **P1:** accept, as in [SOCIAL-2](../SOCIAL/UAT-SOCIAL-2.md).

1. [ ] **P4 and P1:** Open the tabletop window of P4's Campaign.
2. [ ] **P4:** Post a chat line and note it.
3. [ ] **P4:** Archive the Campaign (as in [UAT-CAMPAIGN-1](../CAMPAIGN/UAT-CAMPAIGN-1.md) step 6).
4. [ ] **P1:** Watch the tabletop window, try to post a chat line, then reload it.
5. [ ] **P4:** Try to open the tabletop window of the archived Campaign.

## Expected

- Step 4: P1's window closes or shows that the Campaign is archived; the chat line is not posted and a reload does not reopen the room.
- Step 5: the host cannot open a live room on the archived Campaign; the Campaign is read-only.

## Other users see

- **P1:** sees the archived, read-only Campaign and nothing of a live table after step 3.

## ACs covered

ROOM-1.5

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
