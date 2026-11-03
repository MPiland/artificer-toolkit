# UAT-SPELLS-15: Grant spells and their lifetimes

Grant spells and their lifetimes.

Level 4 (Advanced play) · Feature SPELLS · Mode: Group (GM, P1, P2, P3) · Path position 166 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2**, who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the account **P3**, who owns Cade (in Review: Party in the Field) and is also a member of Review: Sandbox.
- Done in [UAT-SPELLS-2](UAT-SPELLS-2.md): the arena Encounter from SPELLS-2 is running in Review: Party in the Field with Sage (P1), Hale (P2) and Vex (P3).

## Accounts and windows

- **Roles used:** GM, P1, P2, P3
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. Sage, Hale and Vex each need a spare slot of the level they cast. **Everyone:** Take a Long Rest on the Sheet first if the scenario needs spare slots, and clear old grants and conditions from earlier scenarios.

1. **P2:** Hale casts **Aid** on Sage. Confirm Sage's maximum and current HP rise. **GM:** End it by hand and confirm current HP clamps to the old maximum if she was above it.
2. **P3:** Vex casts **Heroism** on Sage. Confirm it needs Concentration (Vex holds it).
3. **P1:** Sage casts **Darkvision** on herself and **Fly** on herself (a speed grant for every speed type). Confirm the movement budget changes with Fly. **P3:** Vex casts **Longstrider** on Sage and confirm Sage's movement budget rises further. Fly and Heroism's Concentration are held by different casters, so both stay.
4. **P2:** Hale casts **Protection from Energy** on Sage, choosing fire as the damage type. Confirm resistance to fire only (a fire hit is halved, a cold hit is not) and that Hale now holds Concentration.
5. **P2:** Hale casts **Shield of Faith** on Sage. Confirm Sage's AC rises by 2, attacks against her use it, and that casting it ended Protection from Energy because it is also a Concentration spell (one Concentration at a time).
6. **P1:** Cast **Ray of Frost** on the Goblin. Confirm its speed is reduced until the end of the caster's next turn.
7. **P3:** Cast **Vicious Mockery** on the Goblin. Confirm an attack-disadvantage grant used up by its next attack.
8. **P1:** Cast **Shocking Grasp** on a Wolf and confirm no reactions for it (see scenario 13).
9. **GM:** Open a token and the turn tracker. Confirm each active grant is listed with its source and time left. Open Sage's Sheet and confirm the same.
10. **GM:** End one grant by hand. Confirm it disappears.
11. **GM:** Hide the source of a grant (a hidden Goblin casting a spell that grants something to Sage; Heavy setup: the GM marks the Goblin's token hidden by hand). **P1:** Confirm the label is not shown to players.
12. **GM:** Break Vex's Concentration (damage with a failed check). Confirm Heroism ends.
13. **GM:** Put a Unicorn in the Encounter. At the end of another creature's turn use the Unicorn's **Shimmering Shield** legendary action on itself or a creature within 60 ft. Confirm attacks against that Character or Creature use +2 AC and that it ends at the end of the Unicorn's next turn.
14. **P2:** Hale casts **Protection from Energy** again on Sage (she holds Concentration). **GM:** Incapacitate Hale (for example Stunned) and confirm the Protection from Energy grant on Sage ends.
15. **GM:** Remove the Goblin that holds Vicious Mockery's disadvantage grant from the Encounter (remove its token). Confirm the grant is gone from the turn tracker. Then have **P1** cast Ray of Frost on the Wolf, and have the GM skip Sage's next turn: confirm the speed reduction still ends, because a skipped turn counts both its start and its end.

## Expected

- Each grant applies and ends when its authored lifetime says.

## Other users see

- **P2:** Sees grants on the table tokens and the turn tracker; a hidden source is not named.
- **P3:** Same; must NOT see the label of the hidden Goblin's grant.

## ACs covered

SPELLS-8.3, SPELLS-5.3, SPELLS-5.4, SPELLS-5.6, SPELLS-5.8, SPELLS-30.1, SPELLS-5.7, SPELLS-5.10

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
