# UAT-SPELLS-14: Reaction countdown timer

Reaction countdown timer.

Level 4 (Advanced play) · Feature SPELLS · Mode: Group (GM, P1, P2) · Path position 165 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2**, who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the account **P3**, who owns Cade (in Review: Party in the Field) and is also a member of Review: Sandbox.
- Done in [UAT-SPELLS-2](UAT-SPELLS-2.md): the arena Encounter from SPELLS-2 is running in Review: Party in the Field with Sage (P1), Hale (P2) and Vex (P3).
- Done in [UAT-SPELLS-13](UAT-SPELLS-13.md): Sage has Shield and the Wolf can attack her.

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. Blocked until SPELLS-31.3 is DONE in the ledger (TODO now): record SKIPPED until then. Look for the reaction time setting in the Campaign's table settings.

1. **GM:** Open the Campaign's table settings and find the reaction time. Confirm the default is 5 seconds, set it to 3 and to 15 and confirm both are accepted, then try 2 and 16 and confirm they are refused. Leave it at 5.
2. **GM:** Have the Wolf attack Sage. **P1:** Confirm a countdown on the reaction prompt that declines itself at zero.
3. **GM:** Trigger it again. **P1:** Press Enter outside a text field and confirm the first option is chosen.
4. **GM:** Trigger again. **P1:** Press Esc. Confirm it declines.
5. **GM:** Trigger again. **P1:** Use the large buttons.
6. **P1:** Mark yourself AFK. **GM:** Trigger again. Confirm it auto-declines at once without pausing the table.
7. **GM:** Mark P1 AFK yourself (instead of P1). Confirm the same. Doubt: where each AFK control lives is unconfirmed.

## Expected

- The timer counts down on the reactor's screen only; the table does not stall.

## Other users see

- **P2:** Must NOT see Sage's countdown or buttons; sees only the pending state and the result.

## ACs covered

SPELLS-31.3

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
