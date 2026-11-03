# UAT-MOVE-3: Opportunity attack pauses the move

Opportunity attack pauses the move.

Level 3 (Core play) · Feature MOVE · Run order 101 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2** (`Review_Pl_Bryn`), who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).

## Accounts and windows

- **Accounts:** GM, P1, P2
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

S1. **GM:** Turn **Fog of war** on for the Scene (Shared party). **GM:** Roll my dice automatically OFF.

1. **P1:** On your own turn (or if turn order does not matter in this build, now), drag Aria's token away from the Wolf, out of its reach.
2. **P1:** Read what appears, and note which part of the map is revealed to you beyond the point where the move stopped.
3. **GM:** Open the **Pending decision**. Read the prompt for the Wolf.
4. **P1 and P2:** While it is open, try to move another token and try to open a door.
5. **GM:** Try to undo the last token move.
6. **GM:** Choose **Use reaction** for the Wolf's opportunity attack.
7. **GM:** Answer any roll prompt (with auto-roll off, type or roll the attack).
8. **P1:** Watch the token and the chat.
9. **P1:** Move Aria back next to the Wolf and away again, to get a second pause.
10. **GM:** This time choose **Decline reaction**.
11. **P1:** Move Aria back next to the Wolf and away a third time to get another pause.
12. **GM:** Choose **Skip decision**.
    R1. **GM:** Turn **Fog of war** OFF again.

## Expected

- The move pauses at the point Aria leaves the Wolf's reach and shows a "Pending decision" to the GM (the Wolf's controller). While it is open every token move, undo and door change is blocked with "Waiting on a movement decision.".
- Use reaction runs an opportunity attack; its result shows in chat, and the move then continues to its destination. Decline reaction continues with no attack.
- Skip decision treats the choice as declined and the move continues.
- While the move is paused the fog is revealed only along the path travelled up to the pause point, not beyond it; it extends as the move continues.

## Other users see

- **P1:** sees that the move is paused waiting on a decision; sees the attack result card only after the GM resolves it. P1 cannot answer the Wolf's reaction.
- **P2:** sees the pause and the final outcome; must NOT see the GM's private roll if the GM rolled Private, nor map areas the party has not explored under shared fog.

## ACs covered

MOVE-1.2

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
