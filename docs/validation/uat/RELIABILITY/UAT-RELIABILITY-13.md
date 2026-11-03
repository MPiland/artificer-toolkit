# UAT-RELIABILITY-13: Account deletion closes the live table

Account deletion closes the live table.

Level 5 (Reliability, performance and release) · Feature RELIABILITY · Run order 186 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **SPARE2** (`Review_Pl_Eli`), a player who is a member of no Campaign and owns no Character.
- The review data provides the Campaign **Review: Sandbox** (owner GM; members P1, P2 and P3 with Iris, Juno and Kit; Manual mode; dim light and per-player fog; a wall with a closed door, a rubble line and one light; a visible Ogre in the east room and a hidden Goblin and a hidden Wolf; the review Encounter started and nobody has acted).

## Accounts and windows

- **Accounts:** GM, SPARE1 (Review_Pl_Dara)
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

S1. **GM:** Invite SPARE2 (`Review_Pl_Eli`) to Review: Sandbox by username from their profile, as in [SOCIAL-2](../SOCIAL/UAT-SOCIAL-2.md); **SPARE2:** accept.

1. **SPARE2:** Open the Review: Sandbox tabletop window.
2. **GM:** Open the tabletop window and confirm SPARE2 is present in the roster.
3. **SPARE2:** Delete the account from the account settings and confirm the deletion.
4. **SPARE2:** Read the tabletop window.
5. **GM:** Read the roster and the live table.

## Expected

- Step 4: SPARE2's tabletop window stops receiving updates and shows a signed-out or access message; it does not keep updating.
- Step 5: SPARE2 is no longer a member; nothing else in the table changes.

## Other users see

- **GM:** Sees SPARE2 removed and no error.

## ACs covered

RELIABILITY-21.8

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
