# UAT-SOCIAL-5: Notification feed, read state and preferences

Notification feed, read state and preferences.

Level 4 (Advanced play) · Feature SOCIAL · Run order 148 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).
- The review data provides a local mail catcher (see [Reading local email](../README.md#reading-local-email)).

## Accounts and windows

- **Accounts:** GM, P1, P2
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

1. **P1 and P2:** Open the notifications page and note the unread count.
2. **GM:** Publish an announcement in Review: Party in the Field (Announcements).
3. **P1:** Watch the notification count in the header without reloading, then open Notifications.
4. **P1:** Open the notification; confirm it opens the announcement and is marked read.
5. **P1:** Open notification preferences and switch off both channels (in-app and email).
6. **GM:** Publish a second announcement.
7. **P1:** Check Notifications.
8. **P2:** Check Notifications.
9. **GM:** Publish announcements one after another until P2 has been sent more than 25 in total (count P2's earlier ones; this is slow, roughly 26 small announcements). Then count the entries in P2's feed. Stop and record the count reached if you cannot finish.
10. **P1:** Turn the channels back on.
11. **GM:** Publish another announcement and check P1 gets it.

## Expected

- The new announcement arrives live as an unread notification; opening it marks it read.
- With both channels off P1 gets no notification for the second announcement; P2 still does.
- Step 9: P2's feed holds 25 entries, the latest 25; the oldest are gone. (The announcements stay in the Campaign.)
- Email: [local email](../README.md#reading-local-email) holds no email to P1 for the second announcement (both channels off). Record which announcement emails P1 and P2 did receive.
- After re-enabling channels P1 gets the next one.

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
- **Failed step:**
- **Notes:**
