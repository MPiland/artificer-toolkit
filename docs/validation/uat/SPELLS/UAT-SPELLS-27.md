# UAT-SPELLS-27: Racial traits, creature traits and Eldritch Blast

Racial traits, creature traits and Eldritch Blast.

Level 4 (Advanced play) · Feature SPELLS · Run order 176 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P3** (`Review_Pl_Cade`), who owns Cade (in Review: Party in the Field) and is also a member of Review: Sandbox.
- Done in [UAT-SPELLS-26](UAT-SPELLS-26.md): scenarios 2 to 26 are finished and the arena is rebuilt after each swap.

## Accounts and windows

- **Accounts:** GM, P1, P2, P3
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

S1. **P3:** Build Dunn (Hill Dwarf Fighter, level 1), Pip (Lightfoot Halfling Fighter, level 1) and Wren (Warlock, level 5). Each is swapped in only between Encounters. Step 11 is a best-effort check of an internal guard; skip it if the GM cannot reach the situation, and say so.

1. **P3:** In the Builder create **Dunn** (Hill Dwarf Fighter 1), **Pip** (Lightfoot Halfling Fighter 1) and **Wren** (Warlock 5 with Eldritch Blast). Make all three active.
2. **GM:** Choose **Complete encounter**. **P3:** Use **Change Character** to put Dunn in the Party in place of Moss. **GM:** Rebuild the arena with scenario 2 steps 4 and 5.
3. **P3:** On Dunn's Sheet confirm Dwarven Toughness adds 1 maximum hit point per level compared to a plain Fighter 1 (read the Sheet and compare with Bryn's).
4. **GM:** Have the Giant Spider bite Dunn and force a Constitution save against its poison. **P3:** Confirm the save is rolled with advantage and the roll prompt names Dwarven Resilience, and that poison damage to Dunn is halved.
5. **GM:** Have the Wolf attack Dunn while another hostile creature is within 5 feet of him. Confirm the Wolf's attack roll has advantage and names Pack Tactics.
6. **GM:** Choose **Complete encounter**. **P3:** Change Character to Pip. **GM:** Rebuild the arena.
7. **P3:** Make an attack roll for Pip and type a 1 for the die. Confirm Lucky lets Pip reroll it and the second roll is used. **GM:** Apply Frightened to Pip and have the Goblin force a Wisdom save: confirm advantage naming Brave. (Lucky and Brave are Lightfoot Halfling racial traits.)
8. **GM:** On the Goblin's turn confirm the bonus-action options include Nimble Escape (Disengage or Hide), and add an Archmage: **P1** casts **Fireball** at it and confirm the Archmage's save has advantage naming Magic Resistance.
9. **GM:** Choose **Complete encounter**. **P3:** Change Character to Wren. **GM:** Rebuild the arena. **P3:** Cast **Eldritch Blast** at a level-5 Warlock, splitting the beams between two targets. Confirm two beams (one attack roll each) and that a Goblin at 0 HP is not targeted by a leftover beam.
10. **P3:** Confirm the beam count does not change during the Encounter and that each beam is its own damage instance.
11. **GM:** Slow a Goblin with Caltrops (scenario 19 step 5), then make that Goblin move through a reaction that can end grants. Confirm the slow stays unless the Goblin regains hit points, and that Undo of that move is refused or restores everything (never half of it). Doubt: which tester-visible situation reaches this guard.
    R1. **GM:** Complete the arena Encounter. **P1, P2, P3:** Use **Change Character** to put Aria, Bryn and Cade back in Review: Party in the Field.

## Expected

- Each authored racial and creature trait applies on screen with its name as the reason.
- Eldritch Blast creates the right number of beams and each one is rolled separately.

## Other users see

- **P1:** Sees the Archmage's save result and the Wolf's advantage on the public card; must NOT see P3's private Lucky reroll prompt.
- **P2:** Same.

## ACs covered

SPELLS-32.1, SPELLS-33.1, SPELLS-17.6, SPELLS-26.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
