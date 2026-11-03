# UAT-REACTION-3: Roll prompts, Auto-roll on versus off

Roll prompts, Auto-roll on versus off.

Level 3 (Core play) · Feature REACTION · Mode: Group (GM, P1) · Path position 108 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).
- The review data provides the Campaign **Review: Shield and Hold** (owner GM; member P1 with Ember, who has Shield and Hold Person; a Wolf and a Goblin; Assisted mode; the review Encounter started with the Goblin held by Ember's Hold Person and Ember's Shield reaction already used this round).

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. **GM:** In Review: Shield and Hold use **Next turn** until a new round starts and Ember's Shield reaction is available again. (for step 6).
S2. Run steps 1 to 5 first with P1's Auto-roll OFF (the default), then again with it ON. If step 4 finds no advantage or disadvantage, **GM:** apply Prone to the Wolf first.

1. **P1:** Confirm the **Auto-roll** switch is OFF. On Aria's turn attack the Wolf.
2. **P1:** At the roll prompt choose **Roll dice** three times. Open the roll log and confirm every attempt is recorded without settling the attack. Then confirm the attack: the card must use the roll from the latest attempt in the log.
3. **P1:** Make another attack; this time type physical dice faces instead (any legal d20 faces) and commit. Confirm the attack settles using the faces you entered.
4. **P1:** Make another attack that has advantage or disadvantage (see Preconditions). Confirm the app preselects the mode and gives the reason. Change the mode and commit; confirm the card labels the change.
5. **P1:** Switch Auto-roll ON. Attack again. Confirm no roll prompt appears and a card posts.
6. **P1:** In Shield and Hold, get a reaction prompt for Ember (as in [UAT-REACTION-1](UAT-REACTION-1.md) steps 2 to 3) while Auto-roll is on. Confirm you are still asked **Use** or **Decline**; only dice are rolled for you.
7. **P1:** Open Settings, Preferences, and confirm **Roll my dice automatically** shows on; sign in on another browser and confirm it is on there too.
8. **GM:** Turn your own Auto-roll OFF and ON; confirm it only affects the GM's creatures' rolls.
   R1. **GM:** Remove Prone from the Wolf if you applied it.

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
- **Set:**
- **Role:**
- **Failed step:**
- **Notes:**
