# UAT-SPELLS-23: Manual mode raises no rules prompts

Manual mode raises no rules prompts.

Level 4 (Advanced play) · Feature SPELLS · Run order 172 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- Done in [UAT-SPELLS-2](UAT-SPELLS-2.md): Sage exists and the arena was built.

## Accounts and windows

- **Accounts:** GM, P1, P2
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

S1. **GM:** Complete the arena Encounter and build a Manual-mode Encounter in Review: Party in the Field by hand (the review Campaign is Assisted).

1. **GM:** Choose **Complete encounter**, set **Automation mode** to Manual in the Campaign's table settings, create a new Encounter with Sage, Hale, Moss and a Goblin, and start it (every combatant needs a hand-entered initiative in Manual mode).
2. **P1:** Confirm the action drawer is hidden (no automated actions).
3. **GM:** Damage Sage by hand while she is Concentrating on a spell (cast one in the Sheet first), and apply a save-forcing effect by hand. Confirm no roll prompts, reactions or Concentration checks are raised for anyone.
4. **GM:** Complete the Encounter, set **Automation mode** back to Assisted, rebuild the arena with scenario 2 steps 4 and 5.

## Expected

- Manual mode is a map, turn order and roller only.

## Other users see

- **P1:** Sees no automatic prompts.
- **P2:** Same; must NOT be asked for any roll.

## ACs covered

SPELLS-1.2

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
