# UAT-VTT_UI-4: Keyboard, screen reader and low zoom

Keyboard, screen reader and low zoom.

Level 3 (Core play) · Feature VTT_UI · Mode: Group (GM, P1) · Path position 115 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).
- The review data provides a screen reader (Narrator on Windows) for steps 7 to 9; without one mark those steps SKIPPED.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

1. **P1:** Without using the mouse, press Tab until a token has focus. Confirm a visible focus outline.
2. **P1:** Use the arrow keys to move between tokens; press Enter or Space to select.
3. **P1:** Open the action drawer by keyboard, pick an attack, and choose a target with the keyboard. Press Esc and confirm targeting cancels.
4. **P1:** On Aria's turn, move Aria's token by keyboard. Confirm the movement readout updates.
5. **GM:** Zoom the map out to its lowest zoom. Confirm tokens are still distinguishable and not only by colour.
6. **P1:** Check that dispositions, conditions and turn state are shown by shape, icon or text as well as colour.
7. **P1:** With Narrator on, focus a token. Confirm it reads the name, disposition, statuses and position.
8. **P1:** Make an attack that hits. Confirm the live region announces the outcome.
9. **P1:** Open the target list with the screen reader. Confirm entries read name, distance and range state.
10. **P1:** Resize to 375 px width (device toolbar). Confirm the map and drawer remain usable.

## Expected

- Every control and token is reachable and operable by keyboard with a visible focus; colour is never the only signal; a screen reader announces names, statuses and outcomes.
- The remaining half of VTT_UI-4.2 (evidence and conflict cases, selector coverage) is proved by the ledger tests; only keyboard and screen-reader behaviour is run here.

## Other users see

- **GM:** Sees the same results as a mouse user.

## ACs covered

VTT_UI-4.1, VTT_UI-4.2

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
