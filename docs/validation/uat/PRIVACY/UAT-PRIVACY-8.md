# UAT-PRIVACY-8: Campaign content stays hidden until revealed

Campaign content stays hidden until revealed.

Level 3 (Core play) · Feature PRIVACY · Mode: Group (GM, P1) · Path position 129 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- Done in [UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md): P1, P2 and P3 are seated in the Sandbox Campaign with their Characters.
- Done in [UAT-ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md): the Sandbox Campaign holds the Wolf and Goblin Blueprint and "UAT Cavern" is its presented Scene.
- Done in [UAT-SCENE-1](../SCENE/UAT-SCENE-1.md): a second Scene exists in the Sandbox Campaign (add it with the Scene editor if missing).

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. **P1:** Switch **Roll my dice automatically** OFF.
S2. **GM:** In the Sandbox Campaign, with "UAT Cavern" presented, create and start a new Run from the Wolf and Goblin Blueprint as in [ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md) steps 3 to 5 (complete any Run still running first). A first Encounter is running; a second Scene exists.

1. **P1:** Open the Campaign's Encounters list.
2. **P1:** Open the tabletop window.
3. **GM:** Prepare a second Encounter (not started) and keep a second Scene unpresented.
4. **P1:** Reload Encounters and look.
5. **GM:** Start the second Encounter, then **Present a scene** for the second Scene.
6. **P1:** Look at Encounters and the tabletop.
7. **GM:** Prepare a third Encounter that includes P1's Character, and start it so that it pauses on an initiative roll prompt for P1's Character before it becomes active. **P1:** Confirm you see that prompt (if no pre-start prompt appears, record it).
8. **GM:** Complete the second Encounter. **P1:** Look at Encounters.

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
- **Tester:**
- **Set:**
- **Role:**
- **Failed step:**
- **Notes:**
