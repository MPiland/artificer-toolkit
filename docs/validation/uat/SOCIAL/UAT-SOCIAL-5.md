# UAT-SOCIAL-5: Notification feed, read state and preferences

Notification feed, read state and preferences.

Level 4 (Advanced play) · Feature SOCIAL · Mode: Group (GM, P1, P2) · Path position 153 of 191

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- The email addresses of **P1** and **P2** can be read as [Reading email](../TESTERS.md#reading-email) describes.

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1 and P2:** Open the notifications page and note the unread count.
2. [ ] **GM:** Publish an announcement in The Campaign (Announcements).
3. [ ] **P1:** Watch the notification count in the header without reloading, then open Notifications.
4. [ ] **P1:** Open the notification; confirm it opens the announcement and is marked read.
5. [ ] **P1:** Open notification preferences and switch off both channels (in-app and email).
6. [ ] **GM:** Publish a second announcement.
7. [ ] **P1:** Check Notifications.
8. [ ] **P2:** Check Notifications.
9. [ ] **GM:** Publish announcements one after another until P2 has been sent more than 25 in total (count P2's earlier ones; this is slow, roughly 26 small announcements). Then count the entries in P2's feed. Stop and record the count reached if you cannot finish.
10. [ ] **P1:** Turn the channels back on.
11. [ ] **GM:** Publish another announcement and check P1 gets it.

## Expected

- The new announcement arrives live as an unread notification; opening it marks it read.
- With both channels off P1 gets no notification for the second announcement; P2 still does.
- Step 9: P2's feed holds 25 entries, the latest 25; the oldest are gone. (The announcements stay in the Campaign.)
- Email: [Reading email](../TESTERS.md#reading-email) holds no email to P1 for the second announcement (both channels off). Record which announcement emails P1 and P2 did receive.
- After re-enabling channels P1 gets the next one.

- Staging: every email this scenario sends arrives in the inbox within a few minutes, shows the product branding, has working links and is not in spam.

## Other users see

- **P2:** gets their own notifications regardless of P1's preferences. Must NOT see anything addressed to P1 only.

## ACs covered

SOCIAL-2.1, SOCIAL-2.2, SOCIAL-2.3

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
