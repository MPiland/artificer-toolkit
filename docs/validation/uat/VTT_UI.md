# VTT presentation — UAT scenarios

Feature `VTT_UI` in the [phase ledger](../../roadmap/08-phase-ledger.json). Set up first: [README](README.md#setup). Accounts: [README](README.md#accounts). Review data: [README](README.md#review-data). Several users: [README](README.md#running-several-users-side-by-side). Record results: [README](README.md#recording-results). Gaps: [README](README.md#known-uat-gaps).

This file proves the live map shows each token's identity, conditions, facing and system state clearly, previews and perception match the rules, footprints and dragging behave, and the map is usable by keyboard, at low zoom, without relying on colour, and with a screen reader.

## UAT-VTT_UI-1: Token identity, status rings, facing and system state

- **Covers:** VTT_UI-1.1, VTT_UI-1.2, VTT_UI-1.3, VTT_UI-2.1
- **Accounts:** GM, P1, P2
- **Preconditions:** Review data loaded. **Review: Party in the Field**, Assisted, for steps 1 to 8 and 12 (Step 4's reaction halo uses **Review: Shield and Hold**, GM and P1 only). Steps 9 to 11 need the optional rules Facing, Marking, Injuries and Morale, which the already-running Review Encounter cannot take: run them in the Sandbox Campaign (UAT-SCENE-1) after enabling those rules in table settings and starting a new Run with P1's and P2's Characters, a Wolf and a Goblin (UAT-ENCOUNTER-3 steps 3 and 5). Heavy setup: G5. Reset the review data afterwards.

**Steps**

1. **GM:** Open the live table. Look at Aria, Bryn, Cade, the Wolf and the Goblin. Confirm each token shows its art or initial and a ring: blue for Friendly, red for Hostile.
2. **GM:** Change the Goblin's disposition to Neutral. Confirm the ring turns purple. Change it back.
3. **P1:** Click Aria's token. Confirm a selection outline appears that is distinct from the ring colour and from the turn halo and reaction halo.
4. **GM:** Advance to the Wolf's turn. Confirm a turn halo appears around the Wolf. Switch to **Review: Shield and Hold** and have the Wolf attack Ember so P1 gets a reaction prompt (UAT-REACTION-1 steps 2 to 3); confirm the reaction halo is distinct from the turn halo.
5. **GM:** Apply a harmful condition (Prone), Concentration (a Concentration spell the token holds) and a beneficial effect (Bless) to one token with the token's condition and effect controls. Confirm the outer ring shows one segment per status, coloured by category.
6. **GM:** Apply more than eight statuses (nine or more conditions and effects on one token). Confirm at most eight segments show, the last marking overflow.
7. **P1:** Hover or focus the token. Confirm a list names every status by icon and name.
8. **GM:** Place two tokens next to each other and confirm the outer ring never overlaps a neighbour.
9. **GM:** (Sandbox) With Facing enabled, set a token's facing. Confirm a facing indicator and arcs appear.
10. **P1:** (Sandbox) With Marking enabled, make a melee hit. Confirm the target shows a mark.
11. **GM:** (Sandbox) Trigger a lingering injury on P1's Character (a critical hit, UAT-ATTACK-7 step 9), a morale result on the Goblin (for example by defeating the Wolf next to it; if no morale result occurs, record that) and a used reaction (UAT-REACTION-1). Confirm each shows on the token.
12. **P2:** Confirm what you can see of other tokens' statuses matches what a player may know (a hidden condition on a token is not listed).

**Expected**

- Ring colours: red Hostile, blue Friendly, purple Neutral. "Yours" is shown by selection and description, not by ring colour.
- Status segments are coloured by category (harmful condition, Concentration, beneficial effect, other), in model order, up to eight.
- Facing, arcs, marks, injuries, morale and reaction state are visible on the token.

**Other users see**

- **P2:** The same rings and halos live; no GM-only status (for example hidden conditions) appears.

## UAT-VTT_UI-2: Previews, footprints, large tokens and dragging

- **Covers:** VTT_UI-3.1, VTT_UI-3.3
- **Accounts:** GM, P1, P2
- **Preconditions:** **Review: Fire and Thunder** (GM and P2 only) for steps 4 and 5; **Review: Party in the Field** for the rest (P1 and P2 both members and watching). Steps 6 to 9 add tokens and zones, so reset the review data afterwards. Heavy setup: G5.

**Steps**

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

**Expected**

- Range, target, path, aura and placed-zone previews all show; Large tokens occupy the right number of squares; dragging respects walls and occupied squares.

**Other users see**

- **P2:** Sees committed results but not another player's unsent preview (steps 3 and 10).

## UAT-VTT_UI-3: Light, fog, senses and the GM's view preview

- **Covers:** VTT_UI-3.2, VTT_UI-3.4, VTT_UI-3.5, VTT_UI-5.2
- **Accounts:** GM, P1
- **Preconditions:** Heavy setup: G5. Use the Sandbox Campaign (UAT-SCENE-1). Review Scenes have no lighting; the GM edits the Sandbox Scene in **Live maps** to set ambient illumination, a light source, magical darkness, obscurement and fog. The review Characters have no darkvision or Devil's Sight, so P1 builds in the Builder (Heavy setup) one Character with darkvision (for example a dwarf or elf) and one Warlock with Devil's Sight; the GM assigns each to P1's seat in turn with **Change Character** (a player has one Character per Campaign). The GM adds a Giant Bat (blindsight) and a Wolf to the Scene. Players' Roll my dice automatically does not matter here.

**Steps**

1. **GM:** Open the Scene settings and set ambient illumination to Bright. Confirm the map shows as authored.
2. **GM:** Set to Dim. Confirm the map is visibly darkened. Set to Dark. Confirm it is black beyond lights and senses.
3. **GM:** Add a light with a bright and a dim radius and a colour. Confirm both radii show, tinted by the colour without washing out the map art.
4. **GM:** Add a magical darkness area. Confirm it stays black inside light.
5. **GM:** Add an obscurement. Confirm it draws as its own layer.
6. **GM:** Use the view preview to see as a chosen token. Confirm you see that token's view.
7. **P1:** With the darkvision Character assigned, confirm that within the darkvision range darkness shows as dim light in greys and dim light shows as bright in colour.
8. **GM:** Give P1 control of a second token (the Giant Bat) in its **Controllers**. **P1:** Select that token, then P1's Character's token. Confirm the view changes to the selected token's senses, one token at a time.
9. **P1:** Select the Giant Bat and confirm its blindsight reveals within range regardless of light. **GM:** Give a token truesight (or use a creature that has it) and confirm magical darkness shows through it.
10. **GM:** Assign the Warlock with Devil's Sight to P1's seat. **P1:** Confirm within its range it sees in colour in both ordinary and magical darkness, does not see invisible creatures, and magical darkness is marked by a dotted outline and faint tint.
11. **GM:** Open the view preview for the Wolf. Confirm it uses the Wolf's stat-block senses like a Character does (compare with the senses printed on its stat block).

**Expected**

- Ambient levels, light radii, magical darkness, obscurement and senses render as described; the GM can see everything; a player's view uses one token's senses at a time.

**Other users see**

- **P1:** Sees only their own token's view; never the GM's full view.

## UAT-VTT_UI-4: Keyboard, screen reader and low zoom

- **Covers:** VTT_UI-4.1, VTT_UI-4.2
- **Accounts:** GM, P1
- **Preconditions:** **Review: Party in the Field**. A screen reader (Narrator on Windows) for steps 7 to 9; if none is available record steps 7 to 9 as not run. Steps 3, 4 and 8 attack and move, so reset the review data afterwards. Steps 4 and 8 need Aria's turn.

**Steps**

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

**Expected**

- Every control and token is reachable and operable by keyboard with a visible focus; colour is never the only signal; a screen reader announces names, statuses and outcomes.
- The remaining half of VTT_UI-4.2 (evidence and conflict cases, selector coverage) is proved by the ledger tests; only keyboard and screen-reader behaviour is run here.

**Other users see**

- **GM:** Sees the same results as a mouse user.

## Covered elsewhere

| AC | Why not a UAT step |
| -- | ------------------ |
| VTT_UI-5.1 | A source-data audit comparing every SRD Creature's structured senses with its printed ones. A tester cannot check all of them; UAT-VTT_UI-3 step 11 spot-checks one (the Wolf). |
