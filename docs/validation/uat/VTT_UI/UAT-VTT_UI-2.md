# UAT-VTT_UI-2: Previews, footprints, large tokens and dragging

Previews, footprints, large tokens and dragging.

Level 3 (Core play) · Feature VTT_UI · Mode: Group (GM, P1, P2) · Path position 116 of 190

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2**, who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).
- The review data provides the Campaign **Review: Fire and Thunder** (owner GM; member P2 with Pyra, who has Fireball and Thunderwave; a Wolf and three Goblins; Assisted mode; the review Encounter started; P1 and P3 are not members).

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

1. **P1:** On Aria's turn start an attack. Confirm a range ring appears around her token and targetable tokens highlight.
2. **P1:** Hover the Wolf. Confirm a target preview and distance show.
3. **P1:** Drag Aria's token. Confirm a path preview with cost shows "used / budget ft". **P2:** Confirm you do not see P1's unsent preview, only the committed move once P1 releases.
4. **P2 (Fire and Thunder):** Start **Fireball** from Pyra's list (she has third-level slots; the review play spent one, so one is left). Confirm an area preview follows the pointer.
5. **P2:** Start Thunderwave. Confirm the preview is centred on Pyra.
6. **GM:** Place a hazard zone and a trap. Confirm each preview shows its footprint.
   6a. **GM:** If a token has an aura (an aura-bearing creature, or a spell that creates one), confirm its aura area is drawn around the token. If none is available, record VTT_UI-3.1's aura preview as not shown.
7. **GM:** Add a Large token (for example an Ogre). Confirm its footprint occupies a 2x2 area.
8. **GM:** Drag the Large token to a spot partly overlapping another token. Confirm the move is refused.
9. **GM:** Rotate a token. Confirm it rotates and keeps its footprint.
10. **P1:** Reload the page after starting an aimed area. Confirm temporary previews may disappear and need redoing.
    R1. **GM:** Remove the tokens and zones you added in steps 6 to 9.

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
- **Set:**
- **Role:**
- **Failed step:**
- **Notes:**
