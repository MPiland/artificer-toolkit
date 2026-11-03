# UAT-RULES-5: An attack with two damage parts keeps each part visible

An attack with two damage parts keeps each part visible.

Level 4 (Advanced play) · Feature RULES · Run order 145 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P2** (`Review_Pl_Bryn`), who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Fire and Thunder** (owner GM; member P2 with Pyra, who has Fireball and Thunderwave; a Wolf and three Goblins; Assisted mode; the review Encounter started; P1 and P3 are not members).

## Accounts and windows

- **Accounts:** GM, P2
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

S1. **GM:** In Review: Fire and Thunder choose **Complete encounter** in the turn menu, then create and start a new Encounter (standard initiative is not needed). Find an SRD Creature whose attack has two damage types at `/creatures` and add it.

1. **GM:** Open the Creature's page and read its attack: note each damage part (dice and damage type).
2. **GM:** Start the Encounter and bring the turn to that Creature (Pyra answers any initiative prompt as in [UAT-RULES-2](UAT-RULES-2.md)).
3. **GM:** From the action drawer choose that attack against Pyra. Answer the attack roll (and any damage prompt) so it hits; if it misses, undo or repeat on its next turn.
4. **GM:** Read the roll card in chat and the Encounter history entry for the hit.
5. **P2:** Read the same card in P2's window, then read Pyra's hit points before and after.
6. **GM:** Reload the tabletop and read the card again.

## Expected

- The roll card lists each damage part as its own line with its dice, damage type and result, then one total; the parts are not merged into a single untyped number.
- Pyra's hit points drop by the total (less any resistance she has: she has none).
- The Encounter history shows one hit with the same parts, once.
- After the reload the card and history show the same parts and total.

## Other users see

- **P2:** The same roll card (or the same totals) once the attack resolves; no pending prompts belonging to the GM's monster rolls.

## ACs covered

RULES-1.6

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
