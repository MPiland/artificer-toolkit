# UAT-ROOM-1: GM and three players join at once

GM and three players join at once.

Level 3 (Core play) · Feature ROOM · Run order 76 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2** (`Review_Pl_Bryn`), who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the account **P3** (`Review_Pl_Cade`), who owns Cade (in Review: Party in the Field) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).

## Accounts and windows

- **Accounts:** GM, P1, P2, P3
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

1. **GM:** Open Review: Party in the Field and its session page. In the **Live tabletop** panel choose **Open tabletop window**.
2. **P1:** Open the same Campaign and choose **Open tabletop window**.
3. **P2:** Do the same.
4. **P3:** Do the same.
5. **GM:** Read the header badge and the text beside it.
6. **P1:** Read the header badge and the text beside it.
7. **GM:** Look for who is present in the room (names or portraits on the live table).
8. **P2:** Close the tabletop window.
9. **GM:** Check the presence list again.
10. **P2:** Reopen the tabletop window.
11. **All four:** Close every tabletop window and wait six minutes.
12. **GM:** Open the tabletop window again.

## Expected

- Every active member gets in without a Session being open. The GM sees a **GM** badge and "Live editing available"; players see a **Player** badge and "Play view". The header holds the **Auto-roll** switch.
- Presence updates as people join and leave without a reload.
- The Encounter, tokens and chat are the same for everyone after they join (as far as each may see).
- After step 12 the room starts again from the last saved state: the Encounter round, tokens and Scene are as you left them.

## Other users see

- **P1, P2, P3:** each see the other members as present; none sees GM-only controls ("Live editing available" is absent).

## ACs covered

ROOM-1.1, ROOM-1.5

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
