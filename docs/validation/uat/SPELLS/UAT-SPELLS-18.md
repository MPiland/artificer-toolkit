# UAT-SPELLS-18: Dragons, breath weapons and Legendary Resistance

Dragons, breath weapons and Legendary Resistance.

Level 4 (Advanced play) · Feature SPELLS · Mode: Group (GM, P1, P2, P3) · Path position 171 of 190

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

S1. **GM:** Add an Adult Red Dragon, a Silver Dragon Wyrmling and a Gorgon. Raise the Characters' hit points on their Sheets first.

1. **GM:** On the Red Dragon's turn, choose its **Fire Breath (Recharge 5-6)** action and aim the cone at Sage, Hale and Vex. Then, at the end of another creature's turn, open the Legendary window and choose **Wing Attack (Costs 2 Actions)**, which is the Dragon's area legendary option, aimed at the same three Characters.
2. **GM:** Confirm for each of the two areas that each caught Character's save goes to its own player (**P1** for Sage, **P2** for Hale, **P3** for Vex). Answer. Confirm damage is half on a success where the action says so, and that undo reverts it.
3. **GM:** Run the Silver Dragon Wyrmling's Paralyzing Breath. Confirm the Characters that fail are Paralyzed and undo removes it from every one.
4. **GM:** Run the Gorgon's Petrifying Breath. Confirm the printed repeat save applies.
5. **P1:** Sage casts **Hold Person** on the Red Dragon. Fail its save (Hold Person only works on a Humanoid, so expect the overridable creature-type warning; **GM:** override it for this test). **GM:** On the offered Legendary Resistance prompt use it. Confirm the failure becomes a success and a charge is spent.
6. **P1:** Cast again, **GM:** decline Legendary Resistance and confirm the failure stays.
7. **GM:** Undo the use. Confirm the charge returns.
8. **P1:** Cast Fireball over the Dragon and the Wolf. **GM:** Confirm a Legendary Resistance prompt is not offered for an area spell with several creatures.

## Expected

- Breaths resolve through the same area flow as Fireball; Legendary Resistance is offered only on a single-target save.

## Other users see

- **P2:** Sees the damage and conditions, but not the dragon's private rolls.
- **P3:** Same.

## ACs covered

SPELLS-15.1, SPELLS-18.1, SPELLS-19.1, SPELLS-19.2, SPELLS-21.1

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
