# UAT-RELIABILITY-13: Account deletion closes the live table

Account deletion closes the live table.

Level 5 (Reliability, performance and release) · Feature RELIABILITY · Mode: Group (GM, P5) · Path position 188 of 191

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- **P5** has an account, is a member of P3's Campaign only and hosts no Campaign ([ACCOUNTS-11](../ACCOUNTS/UAT-ACCOUNTS-11.md) deleted the throwaway). This scenario deletes P5's account, so run it after every other scenario that uses P5 (none comes later on the path). Use **OWN** only in [ACCOUNTS-12](../ACCOUNTS/UAT-ACCOUNTS-12.md), which deletes it last.

## Accounts and windows

- **Roles used:** GM, P5
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **GM:** Invite P5 to The Campaign by username from their profile, as in [SOCIAL-2](../SOCIAL/UAT-SOCIAL-2.md); **P5:** accept. (With P1 to P4 seated this fills the fifth player seat.)

1. [ ] **P5:** Open The Campaign tabletop window.
2. [ ] **GM:** Open the tabletop window and confirm P5 is present in the roster.
3. [ ] **P5:** Delete the account from the account settings and confirm the deletion.
4. [ ] **P5:** Read the tabletop window.
5. [ ] **GM:** Read the roster and the live table.

## Expected

- Step 4: P5's tabletop window stops receiving updates and shows a signed-out or access message; it does not keep updating.
- Step 5: P5 is no longer a member of The Campaign or of P3's Campaign; nothing else in the table changes.

## Other users see

- **GM:** Sees P5 removed and no error.

## ACs covered

RELIABILITY-21.8

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
