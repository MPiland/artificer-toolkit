# UAT-SOCIAL-1: Create a listing, apply, accept and fill a table

Create a listing, apply, accept and fill a table.

Level 2 (GM setup) · Feature SOCIAL · Run order 53 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2** (`Review_Pl_Bryn`), who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the account **P3** (`Review_Pl_Cade`), who owns Cade (in Review: Party in the Field) and is also a member of Review: Sandbox.

## Accounts and windows

- **Accounts:** GM, P1, P2, P3
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

S1. **GM:** Create a new Campaign named "UAT Table" as in [CAMPAIGN-1](../CAMPAIGN/UAT-CAMPAIGN-1.md) steps 1 and 2. In its Settings set the number of player seats to 1. P1, P2 and P3 have no application to it yet.

1. **GM:** Open **Social** and choose to host a new listing. Fill in the table details (title, **Game style**, **Tone**, **Table needs**, **Content guidance**) and publish it with one open seat.
2. **P1:** Open **Social** and find the GM's listing (use **Show results** after setting filters if offered). Open it.
3. **P1:** Choose **Apply to join**, type a **Message to the host**, and submit.
4. **P2:** Do the same for the same listing.
5. **P1:** Open **My applications** and check the status of your application.
6. **GM:** Open the hosted listing's applications. Accept P1.
7. **GM:** Try to accept P2 while the table is full.
8. **P2:** Reload **My applications**.
9. **P3:** Open the listing and try to apply.
10. **P1:** Withdraw your own application from **My applications** if still open, otherwise open the Campaign.
11. **GM:** Reload the hosted listing's applications.

## Expected

- The listing shows in search; the application shows as pending (SUBMITTED) for the applicant and in the host's list.
- Accepting P1 makes P1 a member of the Campaign (visible under **Campaigns** for P1).
- Step 7 is refused with a full-table message because the seat is taken (**Table full**).
- P3 sees **Table full** and cannot apply.
- Withdrawn or declined applications show their final status and the host's list reflects it.

## Other users see

- **P2:** sees the final decision on their application only. Must NOT see P1's message or details about P1's application.
- **P3:** must NOT see anyone's applications or messages.

## ACs covered

SOCIAL-1.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
