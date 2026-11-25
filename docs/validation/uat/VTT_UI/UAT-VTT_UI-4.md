# UAT-VTT_UI-4: Keyboard, screen reader and low zoom

Keyboard, screen reader and low zoom.

Level 3 (Core play) · Feature VTT_UI · Mode: Group (GM, P1) · Path position 122 of 195

## Prerequisites

- The account **GM** exists and hosts The Campaign.
- The account **P1** exists and is seated as a player in The Campaign.
- **The Campaign** is running: P1, P2 and P3 are seated with Campaign Characters Aria, Bryn and Cade (Level 1 Fighters, each built by their own player in the Character Builder), a presented Scene with a Wolf token and a Goblin token, Assisted mode with the Speed Factor initiative, and an Encounter started and in round 2 (built in the CAMPAIGN, SCENE and ENCOUNTER scenarios).
- P1's computer has a screen reader (Narrator on Windows) for steps 7 to 9; without one mark those steps SKIPPED.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1:** Without using the mouse, press Tab until a token has focus. Confirm a visible focus outline.
2. [ ] **P1:** Use the arrow keys to move between tokens; press Enter or Space to select.
3. [ ] **P1:** Open the action drawer by keyboard, pick an attack, and choose a target with the keyboard. Press Esc and confirm targeting cancels.
4. [ ] **P1:** On Aria's turn, move Aria's token by keyboard. Confirm the movement readout updates.
5. [ ] **GM:** Zoom the map out to its lowest zoom. Confirm tokens are still distinguishable and not only by colour.
6. [ ] **P1:** Check that dispositions, conditions and turn state are shown by shape, icon or text as well as colour.
7. [ ] **P1:** With Narrator on, focus a token. Confirm it reads the name, disposition, statuses and position.
8. [ ] **P1:** Make an attack that hits. Confirm the live region announces the outcome.
9. [ ] **P1:** Open the target list with the screen reader. Confirm entries read name, distance and range state.
10. [ ] **P1:** Resize to 375 px width (device toolbar). Confirm the map and drawer remain usable.

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
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
