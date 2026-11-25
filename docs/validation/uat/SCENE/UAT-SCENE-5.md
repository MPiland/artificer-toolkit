# UAT-SCENE-5: Doors

Doors.

Level 2 (GM setup) · Feature SCENE · Mode: Group (GM, P1) · Path position 63 of 195

## Prerequisites

- The account **GM** exists and hosts The Campaign.
- The account **P1** exists and is seated as a player in The Campaign.
- Done in [UAT-SCENE-3](UAT-SCENE-3.md): "UAT Cavern" is presented with a door (added in step 7).

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **GM:** Add a second door to the presented Scene.

1. [ ] **GM:** Make sure the door is **Closed** and not **Locked**.
2. [ ] **P1:** Open the door from the **Doors** list or by clicking it.
3. [ ] **P1:** Close it again.
4. [ ] **GM:** Choose **Lock** on the door.
5. [ ] **P1:** Try to open the locked door.
6. [ ] **P1:** Look at the second door's controls and try to lock it.
7. [ ] **GM:** Choose **Unlock**.
8. [ ] **P1:** Open the door once more.

## Expected

- P1 can open and close an unlocked door and the change shows on the GM's screen.
- A locked door cannot be opened by P1; P1 has no lock or unlock control.
- The GM can lock and unlock.

## Other users see

- **GM:** sees the door state change each time.

## ACs covered

SCENE-2.4

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
