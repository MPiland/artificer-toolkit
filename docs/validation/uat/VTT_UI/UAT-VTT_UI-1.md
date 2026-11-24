# UAT-VTT_UI-1: Token identity, status rings, facing and system state

Token identity, status rings, facing and system state.

Level 3 (Core play) · Feature VTT_UI · Mode: Group (GM, P1, P2) · Path position 116 of 191

## Prerequisites

- The account **GM** exists and hosts The Campaign.
- The account **P1** exists and is seated as a player in The Campaign.
- **The Campaign** is running: P1, P2 and P3 are seated with Campaign Characters Aria, Bryn and Cade (Level 1 Fighters, each built by their own player in the Character Builder), a presented Scene with a Wolf token and a Goblin token, Assisted mode with the Speed Factor initiative, and an Encounter started and in round 2 (built in the CAMPAIGN, SCENE and ENCOUNTER scenarios).
- Done in [UAT-REACTION-1](../REACTION/UAT-REACTION-1.md): P1 built Ember, a Level 3 Wizard who has Shield and Hold Person prepared. P1 makes Ember their Campaign Character (Party panel, **Change Character**) before step 4. (Aria is P1's Campaign Character the rest of the time.)
- Done in [UAT-ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md): The Campaign holds the Wolf and Goblin Blueprint and "UAT Cavern" is its presented Scene.
- Done in [UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md): P1, P2 and P3 are seated in The Campaign with their Characters.

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. For steps 9 to 11: **GM:** In table settings enable the optional rules Facing, Marking, Injuries and Morale. Then, with "UAT Cavern" presented, create and start a new Run from the Wolf and Goblin Blueprint as in [ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md) steps 3 to 5 (complete any Run still running first).

1. [ ] **GM:** Open the live table. Look at Aria, Bryn, Cade, the Wolf and the Goblin. Confirm each token shows its art or initial and a ring: blue for Friendly, red for Hostile.
2. [ ] **GM:** Change the Goblin's disposition to Neutral. Confirm the ring turns purple. Change it back.
3. [ ] **P1:** Click Aria's token. Confirm a selection outline appears that is distinct from the ring colour and from the turn halo and reaction halo.
4. [ ] **GM:** Advance to the Wolf's turn. Confirm a turn halo appears around the Wolf. **P1:** Change your Campaign Character to Ember. **GM:** Have the Wolf attack Ember so P1 gets a reaction prompt ([UAT-REACTION-1](../REACTION/UAT-REACTION-1.md) steps 2 to 3); confirm the reaction halo is distinct from the turn halo.
5. [ ] **GM:** Apply a harmful condition (Prone), Concentration (a Concentration spell the token holds) and a beneficial effect (Bless) to one token with the token's condition and effect controls. Confirm the outer ring shows one segment per status, coloured by category.
6. [ ] **GM:** Apply more than eight statuses (nine or more conditions and effects on one token). Confirm at most eight segments show, the last marking overflow.
7. [ ] **P1:** Hover or focus the token. Confirm a list names every status by icon and name.
8. [ ] **GM:** Place two tokens next to each other and confirm the outer ring never overlaps a neighbour.
9. [ ] **GM:** With Facing enabled, set a token's facing. Confirm a facing indicator and arcs appear.
10. [ ] **P1:** With Marking enabled, make a melee hit. Confirm the target shows a mark.
11. [ ] **GM:** Trigger a lingering injury on P1's Character (a critical hit, [UAT-ATTACK-7](../ATTACK/UAT-ATTACK-7.md) step 9), a morale result on the Goblin (for example by defeating the Wolf next to it; if no morale result occurs, record that) and a used reaction ([UAT-REACTION-1](../REACTION/UAT-REACTION-1.md)). Confirm each shows on the token.
12. [ ] **P2:** Confirm what you can see of other tokens' statuses matches what a player may know (a hidden condition on a token is not listed).

## Expected

- Ring colours: red Hostile, blue Friendly, purple Neutral. "Yours" is shown by selection and description, not by ring colour.
- Status segments are coloured by category (harmful condition, Concentration, beneficial effect, other), in model order, up to eight.
- Facing, arcs, marks, injuries, morale and reaction state are visible on the token.

## Other users see

- **P2:** The same rings and halos live; no GM-only status (for example hidden conditions) appears.

## ACs covered

VTT_UI-1.1, VTT_UI-1.2, VTT_UI-1.3, VTT_UI-2.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
