# UAT-SPELLS-2: Set up the Spell Arena Encounter (Assisted)

Set up the Spell Arena Encounter (Assisted).

Level 4 (Advanced play) · Feature SPELLS · Run order 150 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2** (`Review_Pl_Bryn`), who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the account **P3** (`Review_Pl_Cade`), who owns Cade (in Review: Party in the Field) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).
- Done in [UAT-SPELLS-1](UAT-SPELLS-1.md): Sage (P1), Hale (P2) and Vex (P3) are committed and in no Campaign.
- Done in [UAT-ENCOUNTER-2](../ENCOUNTER/UAT-ENCOUNTER-2.md): the Party Encounter was completed.

## Accounts and windows

- **Accounts:** GM, P1, P2, P3
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

1. **GM:** Open **Review: Party in the Field**, open the Live tabletop and choose **Complete encounter** on the running review Encounter. If the GM is offered to advance the Campaign clock, choose **Not now**.
2. **GM:** In the Campaign's table settings confirm Automation mode is Assisted and the Initiative policy is the Speed Factor variant. Make sure **Automatic cover** is ticked. Save table settings if you changed anything.
3. **P1:** On the Campaign's Party roster choose **Change Character** and pick **Sage** in the Character picker (it replaces Aria). **P2:** choose **Change Character** and pick **Hale**. **P3:** choose **Change Character** and pick **Vex**.
4. **GM:** Present a Scene (the review map) and create a new Encounter. Add Sage, Hale and Vex's tokens (not Aria's, Bryn's or Cade's), and Goblin x3 in a group about 6 squares from the party, one Wolf adjacent to Sage, one Giant Spider, two Bandits, one Ogre.
5. **GM:** Start the Encounter and set initiative for everyone. Choose a turn for Sage.
6. **P1:** In the action drawer find the spell **Fireball**. Confirm it is listed once per slot level Sage can cast it at, such as "Fireball (3rd level)", "Fireball (4th level)" and "Fireball (5th level)", that cantrips appear once, and that the choice shows the spell's component text (it is shown, not enforced).
7. **P1:** Look for Find Familiar (a ritual) in the action drawer. Expected refusal: it shows as unavailable with a message to cast it from the Sheet, and no slot is spent.
8. **P1:** Cast **Magic Missile**. Confirm the slot count on the Sheet drops by one; then **GM:** choose Undo last action and confirm the slot is restored.

## Expected

- Spells list one row per castable level; rituals are refused with a message to use the Sheet; slot spend and undo work.
- Component text appears on the choice but is not enforced.

## Other users see

- **P2, P3:** See the same turn order and tokens; no private creature info.

## ACs covered

SPELLS-8.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
