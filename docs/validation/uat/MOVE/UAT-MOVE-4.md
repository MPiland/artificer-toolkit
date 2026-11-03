# UAT-MOVE-4: Undo last token move

Undo last token move.

Level 3 (Core play) · Feature MOVE · Mode: Group (GM, P1) · Path position 106 of 190

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. **GM:** Turn **Fog of war** on (Shared party) as in [SCENE-4](../SCENE/UAT-SCENE-4.md).

1. **GM:** Note Aria's square.
2. **P1:** Move Aria's token two squares.
3. **P1:** Look for an undo control.
4. **GM:** Choose **Undo last token move** (the stage icon).
5. **GM:** Press it again.
6. **P1:** Move Aria again and then have the GM move another token.
7. **GM:** Choose **Undo last token move** and read which token returns.
8. **GM:** Trigger an opportunity-attack pause ([UAT-MOVE-3](UAT-MOVE-3.md)) and try to undo during the pause.
   R1. **GM:** Turn **Fog of war** OFF again.

## Expected

- P1 has no undo for tokens. The GM's undo returns Aria to the step 1 square, and restores the fog as it was.
- A second press with nothing to undo is refused with a message. Step 7: undo acts only on the latest move (the other token); Aria's earlier move is not rewound by it. Step 8: undo is refused with "Waiting on a movement decision." while the decision is pending.
- Everyone sees the token return.
- Not exercised here: the refusals after a move that settled Encounter mechanics, or one made as part of an action (the play guide lists them).

## Other users see

- **P1:** sees the token move back immediately.

## ACs covered

MOVE-1.2

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
