# UAT-SPELLS-7: Hold Person, Concentration, damage checks, replacement and end

Hold Person, Concentration, damage checks, replacement and end.

Level 4 (Advanced play) · Feature SPELLS · Mode: Group (GM, P1, P2) · Path position 157 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2**, who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the account **P3**, who owns Cade (in Review: Party in the Field) and is also a member of Review: Sandbox.
- Done in [UAT-SPELLS-2](UAT-SPELLS-2.md): the arena Encounter from SPELLS-2 is running in Review: Party in the Field with Sage (P1), Hale (P2) and Vex (P3).

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. **GM:** Add two Bandits, the Ogre and the Wolf; keep Sage adjacent to a Bandit. GM Auto-roll OFF. **Everyone:** Take a Long Rest on the Sheet first if the scenario needs spare slots, and clear old grants and conditions from earlier scenarios.

1. **P1:** Cast **Hold Person** at the Ogre (not a Humanoid). Confirm an overridable creature-type warning. Cancel.
2. **P1:** Cast Hold Person at a Bandit. Confirm the action pauses on the Bandit's save for the GM. With GM Auto-roll OFF the prompt shows; **GM:** type a low roll so it fails. The Bandit shows Paralyzed.
3. **GM:** Undo last action. Switch GM Auto-roll ON. **P1:** Cast Hold Person at the same Bandit again. Confirm the save is rolled without a prompt and the action continues (if the dice let the Bandit succeed, undo and repeat until it fails). Switch the GM's Auto-roll back OFF.
4. **P1:** Confirm Sage now holds Concentration (visible on the Sheet and turn tracker).
5. **P1:** Sage attacks the Paralyzed Bandit from adjacent with her quarterstaff. Confirm advantage with a reason naming Paralyzed and that a hit is a critical hit with doubled dice. **GM:** Confirm the Bandit's movement readout is 0 while Paralyzed, and that choosing Dash does not raise it.
6. **P1:** Cast **Ray of Frost** at the Bandit from more than 5 feet away. Confirm advantage still shows but a hit is not a critical hit.
7. **GM:** Move the Wolf and bite Sage. **P1:** Answer the Concentration prompt. Confirm a DC of 10 or half the damage, whichever is higher. Fail it once and confirm Hold Person ends, the Bandit is no longer Paralyzed and its movement budget returns to its normal speed.
8. **P1:** Recast Hold Person at the Bandit (fail its save as before), then cast **Fear** at the Goblins. Confirm the new Concentration replaces Hold Person with no prompt and Hold Person's Paralyzed condition ends. **GM:** Try Undo last action; confirm it does not bring Hold Person back (it is refused or leaves it ended). Doubt: the exact refusal wording.
9. **P1:** Recast Hold Person at the Bandit, then press **End Concentration** on the Sheet status strip (the Encounter drawer has the same button). Confirm it ends with no action spent and the Paralyzed condition ends.
10. **GM:** Apply Paralyzed to the Bandit by hand from the condition control, then have it make a Strength or Dexterity save. Confirm it fails automatically even on a natural 20, with the reason shown, while a Wisdom save is rolled normally.
11. **P1:** Cast Hold Person again so Sage concentrates. **GM:** Reduce Sage to 0 HP. Confirm Concentration ends with no roll. Then heal Sage back above 0 so she can act in later scenarios.
12. **GM:** Have the **Magma Mephit** (add it to the Encounter) cast its innate **Heat Metal** (a Concentration spell) at Hale's mace, then damage the Mephit without defeating it. Confirm the Mephit is asked a Concentration check and the damage commits.

## Expected

- The step lines above; conditions apply their mechanics with no per-condition behaviour, the derived roll mode names the condition.
- The Concentration marker belongs to Sage on her Sheet and the turn tracker; ending it removes every effect tied to it.

## Other users see

- **P2:** Sees the Bandit's Paralyzed badge and the Concentration marker on Sage; sees no private GM rolls.

## ACs covered

SPELLS-1.2, SPELLS-8.5, SPELLS-9.1, SPELLS-9.2, SPELLS-5.7, SPELLS-5.11, SPELLS-2.1, SPELLS-2.2, SPELLS-2.3, SPELLS-2.4, SPELLS-2.6, SPELLS-8.1

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
