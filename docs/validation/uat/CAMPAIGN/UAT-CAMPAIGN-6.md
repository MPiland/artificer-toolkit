# UAT-CAMPAIGN-6: Announcements

Announcements.

Level 2 (GM setup) · Feature CAMPAIGN · Mode: Group (GM, P1, P2) · Path position 62 of 188

## Prerequisites

- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2**, who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- Done in [UAT-CAMPAIGN-1](UAT-CAMPAIGN-1.md): the original Campaign is archived.
- Done in [UAT-CAMPAIGN-9](UAT-CAMPAIGN-9.md): P1 is a member of the Sandbox Campaign.

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

1. **P1 and P2:** Open the notifications page (**Notifications**) in each window and note the unread count.
2. **GM:** Open the Campaign's **Announcements** and write an announcement targeted at the whole table. Publish it.
3. **P1:** Open Notifications and the Campaign Announcements list.
4. **GM:** Write a second announcement for the party only (if the Party target is offered) and publish it.
5. **GM:** Retry publishing the same announcement by pressing the publish control twice quickly.
6. **GM:** Open the archived original Campaign from [UAT-CAMPAIGN-1](UAT-CAMPAIGN-1.md) and try to publish an announcement in it.
7. **P1:** Open a deep link to an announcement that is not available (edit one character of an announcement address copied from the list).
8. **GM:** In the sandbox Campaign publish an announcement. **P1:** Confirm it appears, then choose **Leave Campaign** and try to open the sandbox announcement list and the announcement address.
   R1. **GM:** Re-seat P1 in the Sandbox Campaign as in [CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md) (invite by username, accept, assign the Character).

## Expected

- The table announcement appears for P1 and P2 in the Campaign announcements list and creates one in-app notification each.
- The party announcement is shown only to Party members. The double-press publishes once.
- Publishing in an archived Campaign is refused.
- An unavailable deep link shows an "unavailable" message and the page stays usable. After leaving the sandbox Campaign, its announcement list and address are refused for P1.

## Other users see

- **P2:** sees the table announcement and, if party targeted, the party announcement. Must NOT see an announcement addressed to a group P2 is not in.

## ACs covered

CAMPAIGN-6.1, CAMPAIGN-6.2, CAMPAIGN-6.3

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
