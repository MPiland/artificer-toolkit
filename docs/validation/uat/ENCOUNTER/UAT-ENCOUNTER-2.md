# UAT-ENCOUNTER-2: Initiative and optional-combat combinations pass end to end

Initiative and optional-combat combinations pass end to end.

Level 4 (Advanced play) · Feature ENCOUNTER · Run order 140 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2** (`Review_Pl_Bryn`), who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the account **P3** (`Review_Pl_Cade`), who owns Cade (in Review: Party in the Field) and is also a member of Review: Sandbox.
- Done in [UAT-ENCOUNTER-1](UAT-ENCOUNTER-1.md): the Party Encounter is complete and the Sandbox Encounter has been rebuilt.
- Done in [UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md): P1, P2 and P3 are seated in the Sandbox Campaign with their Characters.

## Accounts and windows

- **Accounts:** GM, P1, P2, P3
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

S1. **P1, P2, P3:** Auto-roll ON for the first half of the scenario, OFF for the second.

1. **GM:** Open the Campaign's table settings. Note the current **Initiative policy** (Speed Factor on the review Campaigns) and **Initiative tie resolver**. Under **Optional combat rules**, select every rule that is offered (up to 14; use only those actually listed). Save.
2. **GM:** Start a new Encounter with the three Characters and the Wolf and Goblin. Confirm the Encounter drawer shows the chosen rules as active (for example "Facing rule is active").
3. **P1, P2, P3:** Each use **Declare actions** (the declaration button in the decision drawer) for your Character and pick different actions; at least one player picks a light action and one a heavy action. Do not pick the same Speed Factor as another player so order changes.
4. **GM:** Declare Speed Factor for the Wolf and Goblin too, then read the turn order. It must follow the Speed Factor numbers plus modifiers (light actions earlier than heavy ones).
5. **GM:** Make two actors tie (declare the same Speed Factor for two creatures). Read how the tie is settled and compare to the **Initiative tie resolver** you saw in step 1.
6. **P1:** On Aria's turn, try to do something different from what Aria declared (for example attack when the declaration was a spell). Read the response.
7. **P1:** Do the declared action. Confirm it resolves.
8. **GM:** Finish the Encounter. Change **Initiative policy** to a different policy (for example a side-based or per-actor one if listed) and start another Encounter.
9. **GM:** Add a new Wolf mid-combat as reinforcement (use the Encounter drawer's add-actor control). Confirm whether it acts this round or next round, and note which.
10. **P1, P2, P3:** Switch Auto-roll OFF. Finish this Encounter, change **Initiative policy** to a declared-action-roll policy if listed, and start a new Encounter. Each player is prompted to roll initiative for a declared action; choose **Roll dice** for one player and type faces for another.
11. **GM:** Give one Character a condition or effect that grants advantage (or disadvantage) on initiative, then have that player roll initiative at the roll prompt, which names the reason. Read the roll card. If no available condition or effect affects initiative, record that ENCOUNTER-10.1 could not be shown by hand.
12. **GM:** Read the Chat/rolls area and the Encounter history.

## Expected

- Speed Factor: order follows declared factors plus modifiers; ties are broken by the authored tie rule, not by chance; a player who declares and then resolves a different action is refused.
- Each initiative die rolled for a declaration (auto-rolled or typed) posts exactly one Initiative roll card to the table, the same style a GM-rolled initiative posts.
- A roll with advantage or disadvantage shows two faces and keeps the higher or lower; the card shows the mode and both faces.
- A reinforcement actor is placed in the order according to the policy (this round if its place has not passed, otherwise next round).
- Facing, Flanking, Marking and other chosen rules show as active on the Encounter and do not stop initiative working.

## Other users see

- **P2, P3:** All initiative cards appear on the table as soon as they are rolled; a declaration by P1 is visible as a declared action in the order, not as P1's private choice if the GM hid it.

## ACs covered

ENCOUNTER-3.2, ENCOUNTER-4.1, ENCOUNTER-4.2, ENCOUNTER-4.3, ENCOUNTER-4.4, ENCOUNTER-9.1, ENCOUNTER-10.1, ENCOUNTER-2.3

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
