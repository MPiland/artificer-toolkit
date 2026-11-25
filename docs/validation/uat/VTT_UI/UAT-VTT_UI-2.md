# UAT-VTT_UI-2: Previews, footprints, large tokens and dragging

Previews, footprints, large tokens and dragging.

Level 3 (Core play) · Feature VTT_UI · Mode: Group (GM, P1, P2) · Path position 121 of 195

## Prerequisites

- The account **GM** exists and hosts The Campaign.
- The account **P1** exists and is seated as a player in The Campaign.
- The account **P2** exists and is seated as a player in The Campaign.
- **The Campaign** is running: P1, P2 and P3 are seated with Campaign Characters Aria, Bryn and Cade (Level 1 Fighters, each built by their own player in the Character Builder), a presented Scene with a Wolf token and a Goblin token, Assisted mode with the Speed Factor initiative, and an Encounter started and in round 2 (built in the CAMPAIGN, SCENE and ENCOUNTER scenarios).
- P2 has Bryn as their Campaign Character and 1 of 6 personal Characters, so there is room to build Pyra in step S0. Pyra is a Level 5 Sorcerer who knows Fireball and Thunderwave and has third-level slots. P2 adds Pyra to The Campaign and marks her active in step S1, between Encounters (P2's caster joins for this arc; Bryn goes to the bench).

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S0. **P2:** In the Builder (as in [BUILDER-1](../BUILDER/UAT-BUILDER-1.md) steps 1 to 10) build and activate **Pyra**, a Level 5 Sorcerer who knows Fireball and Thunderwave and has third-level slots.
S1. **GM:** Choose **Complete encounter** on the running Encounter. **P2:** Choose **Add Character** on the Party roster and pick Pyra (she lands on the bench beside Bryn), then choose **Mark active** on her. **GM:** With "UAT Cavern" presented, create and start a new Run from the Wolf and Goblin Blueprint as in [ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md) steps 3 to 5, with Aria, Pyra and Cade as the party.

1. [ ] **P1:** On Aria's turn start an attack. Confirm a range ring appears around her token and targetable tokens highlight.
2. [ ] **P1:** Hover the Wolf. Confirm a target preview and distance show.
3. [ ] **P1:** Drag Aria's token. Confirm a path preview with cost shows "used / budget ft". **P2:** Confirm you do not see P1's unsent preview, only the committed move once P1 releases.
4. [ ] **P2:** With Pyra as your Active Character, start **Fireball** from Pyra's list (she has an unspent third-level slot). Confirm an area preview follows the pointer.
5. [ ] **P2:** Start Thunderwave. Confirm the preview is centred on Pyra.
6. [ ] **GM:** Place a hazard zone and a trap. Confirm each preview shows its footprint.
       6a. **GM:** If a token has an aura (an aura-bearing creature, or a spell that creates one), confirm its aura area is drawn around the token. If none is available, record VTT_UI-3.1's aura preview as not shown.
7. [ ] **GM:** Add a Large token (for example an Ogre). Confirm its footprint occupies a 2x2 area.
8. [ ] **GM:** Drag the Large token to a spot partly overlapping another token. Confirm the move is refused.
9. [ ] **GM:** Rotate a token. Confirm it rotates and keeps its footprint.
10. [ ] **P1:** Reload the page after starting an aimed area. Confirm temporary previews may disappear and need redoing.
        R1. **GM:** Remove the tokens and zones you added in steps 6 to 9. **GM:** Complete the Encounter. **P2:** Choose **Mark active** on Bryn again (Pyra sits out the next arc and stays on the bench).

## Expected

- Range, target, path, aura and placed-zone previews all show; Large tokens occupy the right number of squares; dragging respects walls and occupied squares.

## Other users see

- **P2:** Sees committed results but not another player's unsent preview (steps 3 and 10).

## ACs covered

VTT_UI-3.1, VTT_UI-3.3

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
