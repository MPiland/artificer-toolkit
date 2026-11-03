# UAT-SPELLS-10: Dying, death saves, healing and kills

Dying, death saves, healing and kills.

Level 4 (Advanced play) · Feature SPELLS · Mode: Group (GM, P1, P2) · Path position 161 of 188

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

S1. **P2:** Auto-roll OFF for the first half, ON for the second. Hale is the target.

1. **GM:** Reduce a Goblin to 0 HP. Confirm it is defeated as a Creature.
2. **GM:** Reduce Hale to 0 HP with damage that leaves less than her maximum HP over. Confirm Hale is Unconscious and dying.
3. **GM:** Advance to Hale's turn. Confirm a death save prompt appears for **P2** before anything else on her turn. **P2:** Type a number under 10: a failure is marked on Hale's Sheet (one failure in total).
4. **GM:** Damage Hale at 0 HP with a normal hit. Confirm one more failure on the Sheet (two in total). Undo that damage, then damage her with a critical hit instead and confirm it adds two failures (three in total, so she dies); undo it again to return to one failure.
5. **GM:** Heal Hale from 0. Confirm death saves reset on the Sheet and she is conscious at the healed HP.
6. **GM:** Undo the heal. Confirm the earlier death save tally comes back on the Sheet.
7. **GM:** Reduce Hale to 0, then on a later turn: **P2** types a 1 for the death save and confirm it adds two failures (from a fresh count), then repeat from a fresh count with a 20 and confirm she regains 1 HP and is conscious.
8. **GM:** Damage Hale to 0 with damage at least equal to her maximum HP beyond 0. Confirm she is killed outright and shows Dead to everyone.
9. **GM:** Advance turns. Confirm a dead Hale takes no turn, actions or reactions and ignores healing. Undo back to a dying Hale to continue.
10. **P2:** Switch **Roll my dice automatically** ON (`/settings/preferences`), get Hale dying again and confirm the death save is rolled for you at her turn start with no prompt. **GM:** Confirm the roll is visible to you in both modes.
11. **P2:** Switch Auto-roll OFF again and reach three successes: confirm Hale stabilizes. Reach three failures (from fresh Hale at 0): confirm death.

## Expected

- Start of turn order is Recharge, then death save, then start-of-turn effects.
- The death save tally is on Hale's Sheet; the tabletop shows the prompt to P2.

## Other users see

- **P1:** Sees Hale's Dying or Dead badge but must NOT see her private death save tally.

## ACs covered

SPELLS-3.1, SPELLS-3.2, SPELLS-3.3, SPELLS-3.4, SPELLS-3.5

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
