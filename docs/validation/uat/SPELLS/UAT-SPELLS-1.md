# UAT-SPELLS-1: Build the casters and cast from the Sheet outside an Encounter

Build the casters and cast from the Sheet outside an Encounter.

Level 4 (Advanced play) · Feature SPELLS · Mode: Group (P1, P2, P3) · Path position 158 of 195

## Prerequisites

- Each player already has a Character seated in The Campaign: **Aria** (P1), **Bryn** (P2) and **Cade** (P3), each a level 1 Fighter that the player built in the Character Builder. Nobody is in an Encounter, so no Character swap is involved.
- A free account holds 6 personal Characters. P3 ends the SPELLS series with exactly 6 (Cade, Vex, Moss and three one-off Characters in scenario 27), so P3 must not build extra Characters outside these scenarios.

## Accounts and windows

- **Roles used:** P1, P2, P3
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. Allow time: three Builder runs at levels 5 to 11 (Sage, Hale, Vex).

1. [ ] **P1:** Open `/characters`, create a new Character with the Builder: Wizard level 9, Evocation, named **Sage**, with the spell list and equipment above. Save it.
2. [ ] **P2:** Build **Hale** the same way (Cleric 13, spell list and items above).
3. [ ] **P3:** Build **Vex** (Bard 5) and **Moss** (Druid 9). Make sure all three Characters are active (the Builder asks) so they can be picked into the Campaign in scenario 2.
4. [ ] **P1:** Open Sage's Sheet. Cast **Find Familiar** from the Sheet (it is a ritual, so the Sheet allows it). Do this here, before any Encounter.
5. [ ] **P1:** Open the **Extras** tab. Confirm a Summoned entry for the familiar shows AC, speed, attacks and current and maximum hit points.
6. [ ] **P1:** Lower the familiar's hit points on the Sheet by a few points. Reload the page. Confirm the lowered count is still shown.
7. [ ] **P2:** On Hale's Sheet, edit current hit points down to 0.
8. [ ] **P2:** Confirm death save successes and failures show at 0 HP. Press **Roll death save** once (type a number 10 or higher) and see a success marked.
9. [ ] **P2:** Edit three failures into the death saves. Confirm the Sheet shows Hale as Dead.
10. [ ] **P2:** Edit current hit points to a value above 0. Confirm the Dead state clears and Hale is alive.

## Expected

- Sage's familiar is listed in Extras with live HP; HP changes made there stay put on reload.
- The Sheet shows death saves only while at 0 HP, accepts hand edits, and rolls a death save outside an Encounter.
- A dead Character reads Dead until a Sheet HP edit above 0 revives it.
- Outside an Encounter the familiar stays in Extras until dismissed (a timed summon stays until dismissed or a long rest; scenario 22 checks that with Moss).

## Other users see

- **P1, P2, P3:** Each sees only their own Characters in their own list; nobody can open another player's Sheet from their own Characters list.

## ACs covered

SPELLS-34.1, SPELLS-3.6, SPELLS-3.3

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
