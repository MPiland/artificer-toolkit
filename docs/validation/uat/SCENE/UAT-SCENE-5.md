# UAT-SCENE-5: Doors

Doors.

Level 2 (GM setup) · Feature SCENE · Mode: Group (GM, P1) · Path position 67 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- Done in [UAT-SCENE-3](UAT-SCENE-3.md): "UAT Cavern" is presented with a door (added in step 7).

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. **GM:** Add a second door to the presented Scene.

1. **GM:** Make sure the door is **Closed** and not **Locked**.
2. **P1:** Open the door from the **Doors** list or by clicking it.
3. **P1:** Close it again.
4. **GM:** Choose **Lock** on the door.
5. **P1:** Try to open the locked door.
6. **P1:** Look at the second door's controls and try to lock it.
7. **GM:** Choose **Unlock**.
8. **P1:** Open the door once more.

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
- **Tester:**
- **Set:**
- **Role:**
- **Failed step:**
- **Notes:**
