# UAT-SOCIAL-1: Create a listing, apply, accept and fill a table

Create a listing, apply, accept and fill a table.

Level 2 (GM setup) · Feature SOCIAL · Mode: Group (P3, P1, P2, P5) · Path position 51 of 195

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- **P3** has no hosted Campaign other than the one created in step S1 (GM already hosts The Campaign, and the FREE plan allows one hosted Campaign per account, so P3 hosts the table in this scenario).
- **P5** has an account and is a member of no Campaign.
- All accounts are on the FREE plan: 1 active hosted Campaign per account, 5 player seats per Campaign, 5 Scenes per Campaign and 6 personal Characters per account.

## Accounts and windows

- **Roles used:** P3, P1, P2, P5
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **P3:** Create a new Campaign named "P3's Campaign" as in [CAMPAIGN-1](../CAMPAIGN/UAT-CAMPAIGN-1.md) steps 1 and 2. In its Settings set the number of player seats to 1. P1, P2 and P5 have no application to it yet.

1. [ ] **P3:** Open **Social** and choose to host a new listing. Fill in the table details (title, **Game style**, **Tone**, **Table needs**, **Content guidance**) and publish it with one open seat.
2. [ ] **P1:** Open **Social** and find P3's listing (use **Show results** after setting filters if offered). Open it.
3. [ ] **P1:** Choose **Apply to join**, type a **Message to the host**, and submit.
4. [ ] **P2:** Do the same for the same listing.
5. [ ] **P1:** Open **My applications** and check the status of your application.
6. [ ] **P3:** Open the hosted listing's applications. Accept P1.
7. [ ] **P3:** Try to accept P2 while the table is full.
8. [ ] **P2:** Reload **My applications**.
9. [ ] **P5:** Open the listing and try to apply.
10. [ ] **P1:** Withdraw your own application from **My applications** if still open, otherwise open the Campaign.
11. [ ] **P3:** Reload the hosted listing's applications.

## Expected

- The listing shows in search; the application shows as pending (SUBMITTED) for the applicant and in the host's list.
- Accepting P1 makes P1 a member of the Campaign (visible under **Campaigns** for P1).
- Step 7 is refused with a full-table message because the seat is taken (**Table full**).
- P5 sees **Table full** and cannot apply.
- Withdrawn or declined applications show their final status and the host's list reflects it.

## Other users see

- **P2:** sees the final decision on their application only. Must NOT see P1's message or details about P1's application.
- **P5:** must NOT see anyone's applications or messages.

## ACs covered

SOCIAL-1.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
