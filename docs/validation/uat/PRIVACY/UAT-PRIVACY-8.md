# UAT-PRIVACY-8: Campaign content stays hidden until revealed

Campaign content stays hidden until revealed.

Level 3 (Core play) · Feature PRIVACY · Mode: Group (GM, P1) · Path position 136 of 195

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- P1 has Aria, P2 has Bryn and P3 has Cade as their Characters in The Campaign (each a Level 1 Fighter, built by their player in the Character Builder).
- Done in [UAT-ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md): The Campaign holds the Wolf and Goblin Blueprint and "UAT Cavern" is its presented Scene.
- Done in [UAT-RELIABILITY-4](../RELIABILITY/UAT-RELIABILITY-4.md): a second Scene exists in The Campaign (3 of 5 Scenes in use).

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **P1:** Switch **Roll my dice automatically** OFF.
S2. **GM:** In the The Campaign, with "UAT Cavern" presented, create and start a new Run from the Wolf and Goblin Blueprint as in [ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md) steps 3 to 5 (complete any Run still running first). A first Encounter is running; a second Scene exists.

1. [ ] **P1:** Open the Campaign's Encounters list.
2. [ ] **P1:** Open the tabletop window.
3. [ ] **GM:** Prepare a second Encounter (not started) and keep a second Scene unpresented.
4. [ ] **P1:** Reload Encounters and look.
5. [ ] **GM:** Start the second Encounter, then **Present a scene** for the second Scene.
6. [ ] **P1:** Look at Encounters and the tabletop.
7. [ ] **GM:** Prepare a third Encounter that includes P1's Character, and start it so that it pauses on an initiative roll prompt for P1's Character before it becomes active. **P1:** Confirm you see that prompt (if no pre-start prompt appears, record it).
8. [ ] **GM:** Complete the second Encounter. **P1:** Look at Encounters.

## Expected

- Before reveal P1 sees only the Campaign's active Encounter and the presented Scene with its fog. The prepared Encounter and the unpresented Scene are absent.
- After the GM starts and presents them, P1 sees them. A prepared run paused on a decision for P1 shows that decision to P1 (step 7) and nothing else about it.
- The GM sees every Encounter and Scene throughout.

## Other users see

- **P1:** must NOT see prepared Encounters, unpresented Scenes, creature lists, or any Campaign file area (there is no file area).

## ACs covered

PRIVACY-3.2

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
