# UAT-REACTION-4: Counterspell and chains

Counterspell and chains.

Level 3 (Core play) · Feature REACTION · Mode: Group (GM, P1, P2) · Path position 141 of 195

## Prerequisites

- **The Campaign** is hosted by GM with P1, P2 and P3 seated as players.
- Done in [UAT-ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md): The Campaign holds the Wolf and Goblin Blueprint and "UAT Cavern" is its presented Scene.
- Done in [UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md): P1, P2 and P3 are seated in The Campaign with Aria, Bryn and Cade.

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **P1 and P2:** Each in their own account, in the Builder (as in [BUILDER-2](../BUILDER/UAT-BUILDER-2.md)) build a level 5 caster who knows Counterspell with a third-level slot and commit it. In The Campaign each chooses **Add Character** to bring it in (it lands on the bench), then **Mark active**, between Encounters (the party's counterspellers join for this arc) (P1: "UAT Counter A", P2: "UAT Counter B").
S2. **GM:** Start an Encounter with a Mage creature; all three tokens are in range of each other. Players' Auto-roll ON; GM's OFF.

1. [ ] **GM:** Have the Mage cast a leveled spell at P1's Character.
2. [ ] **P1:** Confirm a Counterspell Use/Decline prompt appears for P1's Character. **P2:** Confirm one appears for P2's Character (each its own controller) and not for P1's.
3. [ ] **P2:** Choose **Use** with a slot at least as high as the spell. Confirm the spell is countered and the slot spent.
4. [ ] **GM:** Repeat with P2 using a lower slot. Confirm the ability check is asked and a failed check still spends the slot.
5. [ ] **P1:** When P2 counters, answer **Use** for your own Counterspell on P2's cast. Confirm the chain resolves innermost first.
6. [ ] **GM:** Read the history of the single triggering occurrence.
       R1. **GM:** Complete the Encounter. **P1 and P2:** choose **Mark active** on Aria and Bryn again, use **Remove Character** on "UAT Counter A" and "UAT Counter B", then delete them from `/characters` so P1 and P2 are back to their earlier Character counts.

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
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
