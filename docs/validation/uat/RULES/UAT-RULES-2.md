# UAT-RULES-2: A started Encounter pauses for answers and resumes with nothing half-applied

A started Encounter pauses for answers and resumes with nothing half-applied.

Level 4 (Advanced play) · Feature RULES · Mode: Group (GM, P2) · Path position 148 of 190

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P2**, who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Fire and Thunder** (owner GM; member P2 with Pyra, who has Fireball and Thunderwave; a Wolf and three Goblins; Assisted mode; the review Encounter started; P1 and P3 are not members).

## Accounts and windows

- **Roles used:** GM, P2
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. **GM:** In Review: Fire and Thunder choose **Complete encounter** in the turn menu, then create and start a new Encounter as step 1 describes. P2: Roll my dice automatically OFF.

1. **GM:** In Review: Fire and Thunder, with standard initiative set in the Campaign's table settings, create a new Encounter on the presented Scene in Assisted mode and add the Wolf and one Goblin to it. Pyra (P2) is a combatant.
2. **GM:** Choose **Start encounter**.
3. **GM:** Watch the Encounter panel while the start is waiting.
4. **P2:** Read the pending roll prompt for Pyra's initiative. Do not answer yet.
5. **P2:** Reload the tabletop page while the prompt is open.
6. **P2:** Answer the prompt with **Roll dice**.
7. **GM:** If asked to roll initiative for the monsters, answer each prompt.
8. **GM:** When the start finishes, read the initiative order and the round counter.
9. **P2:** Look at the same initiative order.

## Expected

- Step 3: while any answer is outstanding, the Encounter is shown as waiting; there is no half-built order, no partial round counter and no partial combat log.
- Step 5: the same prompt is still there after the reload (a decision survives a refresh).
- Step 8: after the last answer, the Encounter begins at round 1 with a complete initiative order. Nothing was applied twice.
- Step 9: P2 sees the identical order.

## Other users see

- **P2:** Sees only their own prompt, not the GM's monster initiative prompts or any partial results before the Encounter begins.
- **GM:** Sees every prompt that is theirs (monsters), and the player's roll only after it is answered.

## ACs covered

RULES-1.2, RULES-1.4

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
