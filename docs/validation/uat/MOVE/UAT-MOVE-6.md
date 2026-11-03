# UAT-MOVE-6: Peers converge, reload and departure

Peers converge, reload and departure.

Level 2 (GM setup) · Feature MOVE · Run order 69 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2** (`Review_Pl_Bryn`), who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- Done in [UAT-SCENE-4](../SCENE/UAT-SCENE-4.md): "UAT Cavern" is presented with tokens for UAT Dara and UAT Bryn Sandbox, and no Encounter is running.

## Accounts and windows

- **Accounts:** GM, P1, P2
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

1. **P1:** Move P1's Character's token.
2. **P2:** Move P2's Character's token at about the same time.
3. **All:** Compare maps.
4. **P2:** Reload the page.
5. **P1:** Go offline (Network panel) and move P1's Character's token; go back online.
6. **GM:** Remove P2 from the Campaign (see CAMPAIGN UAT).
7. **P2:** Try to move P2's Character's token and reload.
   R1. **GM:** Re-seat P2 and add P2's token back to the Scene in the Sandbox Campaign as in [CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md) (invite by username, accept, assign the Character).

## Expected

- All three windows show the same positions after each step, including after reload.
- A move made offline is either committed once or shown as failed; it is not duplicated.
- After removal P2 cannot move anything and is refused on reload.

## Other users see

- **GM and P1:** see the same final positions; P2's refused attempts change nothing.

## ACs covered

MOVE-1.3

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
