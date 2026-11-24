# UAT-REACTION-3: Roll prompts, Auto-roll on versus off

Roll prompts, Auto-roll on versus off.

Level 3 (Core play) · Feature REACTION · Mode: Group (GM, P1) · Path position 111 of 191

## Prerequisites

- **The Campaign** is hosted by GM with P1, P2 and P3 seated as players.
- **The Campaign** has Aria (P1), Bryn (P2) and Cade (P3), level 1 Fighters each player built, seated; Assisted mode with the Speed Factor initiative; and a running Encounter in round 2 with tokens for the three Fighters, a Wolf and a Goblin, as the GM built it in [UAT-ENCOUNTER-1](../ENCOUNTER/UAT-ENCOUNTER-1.md) (steps 12 to 16) and played on.
- Done in [UAT-REACTION-1](../REACTION/UAT-REACTION-1.md): P1 built **Ember**, a level 3 Wizard with Shield and Hold Person prepared and 1st-level slots. Ember is not seated yet; the setup step has P1 swap to her.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. For step 6 only: **P1** swaps to Ember with **Change Character** (the **GM** completes the running Encounter first), and the **GM** starts a new Encounter with Ember, a Wolf and a Goblin and uses **Next turn** until Ember's Shield reaction is available.
S2. Run steps 1 to 5 first with P1's Auto-roll OFF (the default), then again with it ON. If step 4 finds no advantage or disadvantage, **GM:** apply Prone to the Wolf first.

1. [ ] **P1:** Confirm the **Auto-roll** switch is OFF. On Aria's turn attack the Wolf.
2. [ ] **P1:** At the roll prompt choose **Roll dice** three times. Open the roll log and confirm every attempt is recorded without settling the attack. Then confirm the attack: the card must use the roll from the latest attempt in the log.
3. [ ] **P1:** Make another attack; this time type physical dice faces instead (any legal d20 faces) and commit. Confirm the attack settles using the faces you entered.
4. [ ] **P1:** Make another attack that has advantage or disadvantage (see Preconditions). Confirm the app preselects the mode and gives the reason. Change the mode and commit; confirm the card labels the change.
5. [ ] **P1:** Switch Auto-roll ON. Attack again. Confirm no roll prompt appears and a card posts.
6. [ ] **P1:** As Ember (see S1), get a reaction prompt for Ember (as in [UAT-REACTION-1](UAT-REACTION-1.md) steps 2 to 3) while Auto-roll is on. Confirm you are still asked **Use** or **Decline**; only dice are rolled for you.
7. [ ] **P1:** Open Settings, Preferences, and confirm **Roll my dice automatically** shows on; open the same account on a second device or browser and confirm it is on there too.
8. [ ] **GM:** Turn your own Auto-roll OFF and ON; confirm it only affects the GM's creatures' rolls.
       R1. **GM:** Remove Prone from the Wolf if you applied it, and complete the Encounter. **P1:** Use **Change Character** to put Aria back in The Campaign in place of Ember.

## Expected

- Every **Roll dice** attempt is logged; the settled result uses the last app roll or the typed faces (never a value you could not see in the log).
- A changed d20 mode is labelled on the card and stored beside the derived mode.
- Auto-roll never makes a choice for you.
- The setting is saved to your account on every device.

## Other users see

- **GM:** Sees a roll card for each settled roll but not the unsettled attempts.

## ACs covered

REACTION-2.1, REACTION-2.2, REACTION-2.3, REACTION-2.4

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
