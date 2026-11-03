# UAT-CAMPAIGN-3: Players see only what the GM made visible

Players see only what the GM made visible.

Level 3 (Core play) · Feature CAMPAIGN · Mode: Group (GM, P1, P2) · Path position 79 of 190

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2**, who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

1. **GM:** Open Review: Party in the Field and the notes area.
2. **GM:** Create a GM note and leave it private (not shared with the party). Create a second note and mark it **Shared with party**.
3. **P1:** Open the same Campaign and its notes.
4. **P2:** Open the Campaign and its notes.
5. **P1:** Open Aria's Sheet from the Campaign and add a private note on the Sheet.
6. **GM:** Open Aria's Sheet from the Campaign Party.
7. **P1:** Open Bryn's Sheet address in P1's window (copy it from P2).

## Expected

- P1 and P2 see the shared note, written by the GM, without internal attribution fields; they do not see the private note.
- Step 6: the GM sees Aria's Sheet as the GM does but cannot read the private note P1 added to the Sheet, if the Sheet marks it private.
- Step 7: P1 is refused Bryn's Sheet unless Bryn has Party can view on.

## Other users see

- **P2:** must NOT see the GM's private note, P1's private Sheet note, or Aria's Sheet unless its owner enabled Party can view.

## ACs covered

CAMPAIGN-2.1, CAMPAIGN-2.2

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
