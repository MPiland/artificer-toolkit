# UAT-REACTION-4: Counterspell and chains

Counterspell and chains.

Level 3 (Core play) · Feature REACTION · Mode: Group (GM, P1, P2) · Path position 136 of 190

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2**, who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- Done in [UAT-ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md): the Sandbox Campaign holds the Wolf and Goblin Blueprint and "UAT Cavern" is its presented Scene.
- Done in [UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md): P1, P2 and P3 are seated in the Sandbox Campaign with their Characters.

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. **P1 and P2:** In the Builder (as in [BUILDER-2](../BUILDER/UAT-BUILDER-2.md)) build a level 5 caster who knows Counterspell with a third-level slot and commit it. In the Sandbox Campaign use **Change Character** to assign it (P1: "UAT Counter A", P2: "UAT Counter B").
S2. **GM:** Start an Encounter with a Mage creature; all three tokens are in range of each other. Players' Auto-roll ON; GM's OFF.

1. **GM:** Have the Mage cast a leveled spell at P1's Character.
2. **P1:** Confirm a Counterspell Use/Decline prompt appears for P1's Character. **P2:** Confirm one appears for P2's Character (each its own controller) and not for P1's.
3. **P2:** Choose **Use** with a slot at least as high as the spell. Confirm the spell is countered and the slot spent.
4. **GM:** Repeat with P2 using a lower slot. Confirm the ability check is asked and a failed check still spends the slot.
5. **P1:** When P2 counters, answer **Use** for your own Counterspell on P2's cast. Confirm the chain resolves innermost first.
6. **GM:** Read the history of the single triggering occurrence.
   R1. **GM:** Complete the Encounter. **P1 and P2:** use **Change Character** to put back "UAT Dara" and "UAT Bryn Sandbox".

## Expected

- The chain resolves innermost first inside one occurrence; a countered cast spends its slot and action and has no effect.

## Other users see

- **P1, P2:** Each sees only their own prompt; both see the final result. Nobody sees the other's slot choices until it resolves.

## ACs covered

REACTION-4.1, REACTION-4.3

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
