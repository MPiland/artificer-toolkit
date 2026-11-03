# UAT-VTT_UI-1: Token identity, status rings, facing and system state

Token identity, status rings, facing and system state.

Level 3 (Core play) · Feature VTT_UI · Mode: Group (GM, P1, P2) · Path position 115 of 190

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).
- The review data provides the Campaign **Review: Shield and Hold** (owner GM; member P1 with Ember, who has Shield and Hold Person; a Wolf and a Goblin; Assisted mode; the review Encounter started with the Goblin held by Ember's Hold Person and Ember's Shield reaction already used this round).
- Done in [UAT-ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md): the Sandbox Campaign holds the Wolf and Goblin Blueprint and "UAT Cavern" is its presented Scene.
- Done in [UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md): P1, P2 and P3 are seated in the Sandbox Campaign with their Characters.

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. For steps 9 to 11: **GM:** In the Sandbox Campaign, with "UAT Cavern" presented, create and start a new Run from the Wolf and Goblin Blueprint as in [ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md) steps 3 to 5 enable the optional rules Facing, Marking, Injuries and Morale in table settings first, then (complete any Run still running first).

1. **GM:** Open the live table. Look at Aria, Bryn, Cade, the Wolf and the Goblin. Confirm each token shows its art or initial and a ring: blue for Friendly, red for Hostile.
2. **GM:** Change the Goblin's disposition to Neutral. Confirm the ring turns purple. Change it back.
3. **P1:** Click Aria's token. Confirm a selection outline appears that is distinct from the ring colour and from the turn halo and reaction halo.
4. **GM:** Advance to the Wolf's turn. Confirm a turn halo appears around the Wolf. Switch to **Review: Shield and Hold** and have the Wolf attack Ember so P1 gets a reaction prompt ([UAT-REACTION-1](../REACTION/UAT-REACTION-1.md) steps 2 to 3); confirm the reaction halo is distinct from the turn halo.
5. **GM:** Apply a harmful condition (Prone), Concentration (a Concentration spell the token holds) and a beneficial effect (Bless) to one token with the token's condition and effect controls. Confirm the outer ring shows one segment per status, coloured by category.
6. **GM:** Apply more than eight statuses (nine or more conditions and effects on one token). Confirm at most eight segments show, the last marking overflow.
7. **P1:** Hover or focus the token. Confirm a list names every status by icon and name.
8. **GM:** Place two tokens next to each other and confirm the outer ring never overlaps a neighbour.
9. **GM:** (Sandbox) With Facing enabled, set a token's facing. Confirm a facing indicator and arcs appear.
10. **P1:** (Sandbox) With Marking enabled, make a melee hit. Confirm the target shows a mark.
11. **GM:** (Sandbox) Trigger a lingering injury on P1's Character (a critical hit, [UAT-ATTACK-7](../ATTACK/UAT-ATTACK-7.md) step 9), a morale result on the Goblin (for example by defeating the Wolf next to it; if no morale result occurs, record that) and a used reaction ([UAT-REACTION-1](../REACTION/UAT-REACTION-1.md)). Confirm each shows on the token.
12. **P2:** Confirm what you can see of other tokens' statuses matches what a player may know (a hidden condition on a token is not listed).

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
- **Set:**
- **Role:**
- **Failed step:**
- **Notes:**
