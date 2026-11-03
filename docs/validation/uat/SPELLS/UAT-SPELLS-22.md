# UAT-SPELLS-22: Summons: turns, groups and ends

Summons: turns, groups and ends.

Level 4 (Advanced play) · Feature SPELLS · Mode: Group (GM, P1, P2, P3) · Path position 175 of 190

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2**, who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the account **P3**, who owns Cade (in Review: Party in the Field) and is also a member of Review: Sandbox.
- Done in [UAT-SPELLS-2](UAT-SPELLS-2.md): the arena Encounter from SPELLS-2 is running in Review: Party in the Field with Sage (P1), Hale (P2) and Vex (P3).
- Done in [UAT-SPELLS-19](UAT-SPELLS-19.md): P3 plays Moss.

## Accounts and windows

- **Roles used:** GM, P1, P2, P3
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. **GM:** In the Spell authoring forms author two homebrew summon Spells (one whose summon rolls its own initiative, one whose summon acts right after its owner) and a summon form with no attacks for step 7. If the forms lack summon turn timing, mark steps 4 to 8 BLOCKED and report. **P1:** Prepare both with slots available.

1. **P3:** Moss casts **Conjure Animals**, choosing a creature and count. Confirm one group token appears with one shared turn.
2. **P3:** Run the group: confirm one attack per surviving creature. **GM:** Reduce the group count and confirm attacks drop.
3. **P3:** Check the Extras tab: the summon shows its live HP, and its HP matches the Encounter token.
4. **P1:** Cast the own-initiative homebrew summon spell with Sage. Confirm the summon rolls its own initiative on arrival and has its own score and its own turn in the order.
5. **P1:** On the summon's turn confirm **P1** gets a prompt and the action drawer with **End turn**. Try the summon's own Attack: refused as not the current actor. Delegate an attack through Sage: confirm it resolves.
6. **P1:** Cast the "right after its owner" homebrew summon spell. **GM:** Confirm it acts immediately after Sage in side and individual initiative and keeps that place across two rounds.
7. **P1:** Cast the no-attack summon. **GM:** Move a hostile Goblin away from it and confirm the summon gets no opportunity attack and offers no attack reaction.
8. **GM:** End a summon while it is the current actor and again while it is next. Confirm the order continues without a gap each time. Undo and confirm the order restores.
9. **P3:** Break Moss's Concentration (the GM damages her and **P3** fails the check). Confirm the Conjure Animals summon leaves Extras. **GM:** Reduce another summon to 0 HP and confirm it leaves Extras; **P1:** dismiss a third from Extras and confirm it leaves.
10. **GM:** Choose **Complete encounter**. **P3:** Cast **Conjure Animals** from Moss's Sheet outside an Encounter. Confirm its Extras entry shows the same creature, count and stat block as the in-Encounter cast in step 1, and that it stays in Extras until dismissed or a long rest. Rebuild the arena with scenario 2 steps 4 and 5 afterwards.

## Expected

- The summon's prompt appears when its turn starts; the Encounter actor is the only record.
- The Sheet-cast and the Encounter-cast summon from the same spell are built the same.

## Other users see

- **P3:** Sees P1's summon only as a token; must NOT see its private rolls.
- **P2:** Same.

## ACs covered

SPELLS-34.2, SPELLS-34.3, SPELLS-34.4, SPELLS-34.5, SPELLS-35.1, SPELLS-35.2, SPELLS-35.3, SPELLS-35.4, SPELLS-35.5, SPELLS-35.6

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
