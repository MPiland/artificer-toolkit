# UAT-RELIABILITY-13: Account deletion closes the live table

Account deletion closes the live table.

Level 5 (Reliability, performance and release) · Feature RELIABILITY · Mode: Group (GM, DISPOSABLE) · Path position 185 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the Campaign **Review: Sandbox** (owner GM; members P1, P2 and P3 with Iris, Juno and Kit; Manual mode; dim light and per-player fog; a wall with a closed door, a rubble line and one light; a visible Ogre in the east room and a hidden Goblin and a hidden Wolf; the review Encounter started and nobody has acted).

- The review data provides a throwaway account **DISPOSABLE** that is in no Campaign, created by the owner by invitation to a spare email address (as in [ACCOUNTS-6](../ACCOUNTS/UAT-ACCOUNTS-6.md)). Consumes: the account is deleted. The owner creates a new one for each run.

## Accounts and windows

- **Roles used:** GM, DISPOSABLE
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. **GM:** Invite DISPOSABLE to Review: Sandbox by username from their profile, as in [SOCIAL-2](../SOCIAL/UAT-SOCIAL-2.md); **DISPOSABLE:** accept.

1. **DISPOSABLE:** Open the Review: Sandbox tabletop window.
2. **GM:** Open the tabletop window and confirm DISPOSABLE is present in the roster.
3. **DISPOSABLE:** Delete the account from the account settings and confirm the deletion.
4. **DISPOSABLE:** Read the tabletop window.
5. **GM:** Read the roster and the live table.

## Expected

- Step 4: DISPOSABLE's tabletop window stops receiving updates and shows a signed-out or access message; it does not keep updating.
- Step 5: DISPOSABLE is no longer a member; nothing else in the table changes.

## Other users see

- **GM:** Sees DISPOSABLE removed and no error.

## ACs covered

RELIABILITY-21.8

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
