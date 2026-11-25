# UAT-CAMPAIGN-6: Announcements

Announcements.

Level 2 (GM setup) · Feature CAMPAIGN · Mode: Group (GM, P1, P2) · Path position 58 of 195

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- P1 has Aria, P2 has Bryn and P3 has Cade as their Characters in The Campaign (each a Level 1 Fighter, built by their player in the Character Builder).
- Done in [UAT-CAMPAIGN-1](UAT-CAMPAIGN-1.md): the original Campaign is archived.

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1 and P2:** Open the notifications page (**Notifications**) in each window and note the unread count.
2. [ ] **GM:** Open the Campaign's **Announcements** and write an announcement targeted at the whole table. Publish it.
3. [ ] **P1:** Open Notifications and the Campaign Announcements list.
4. [ ] **GM:** Write a second announcement for the party only (if the Party target is offered) and publish it.
5. [ ] **GM:** Retry publishing the same announcement by pressing the publish control twice quickly.
6. [ ] **GM:** Open the archived original Campaign from [UAT-CAMPAIGN-1](UAT-CAMPAIGN-1.md) and try to publish an announcement in it.
7. [ ] **P1:** Open a deep link to an announcement that is not available (edit one character of an announcement address copied from the list).
8. [ ] **GM:** In The Campaign publish an announcement. **P1:** Confirm it appears, then choose **Leave Campaign** and try to open The Campaign's announcement list and the announcement address.
       R1. **GM:** Re-seat P1 in The Campaign as in [CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md) (invite by username, accept, assign the Character).

## Expected

- The table announcement appears for P1 and P2 in the Campaign announcements list and creates one in-app notification each.
- The party announcement is shown only to Party members. The double-press publishes once.
- Publishing in an archived Campaign is refused.
- An unavailable deep link shows an "unavailable" message and the page stays usable. After leaving The Campaign, its announcement list and address are refused for P1.

## Other users see

- **P2:** sees the table announcement and, if party targeted, the party announcement. Must NOT see an announcement addressed to a group P2 is not in.

## ACs covered

CAMPAIGN-6.1, CAMPAIGN-6.2, CAMPAIGN-6.3

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
