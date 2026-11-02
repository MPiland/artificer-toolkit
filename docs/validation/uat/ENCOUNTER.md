# Encounter setup — UAT scenarios

Feature `ENCOUNTER` in the [phase ledger](../../roadmap/08-phase-ledger.json). Set up first: [README](README.md#setup). Accounts: [README](README.md#accounts). Review data: [README](README.md#review-data). Several users: [README](README.md#running-several-users-side-by-side). Record results: [README](README.md#recording-results). Gaps: [README](README.md#known-uat-gaps).

This file proves a GM and up to three players can prepare, start, run and finish an Encounter in both Assisted and Manual mode, with the right people controlling the right creatures, every initiative style working, and the table seeing the same thing at the same time.

## UAT-ENCOUNTER-1: Assisted and Manual Encounter journeys pass

- **Covers:** ENCOUNTER-2.2, ENCOUNTER-2.3, ENCOUNTER-2.7, ENCOUNTER-3.3, ENCOUNTER-3.4, ENCOUNTER-3.5, ENCOUNTER-3.6, ENCOUNTER-5.1
- **Accounts:** GM, P1, P2, P3
- **Preconditions:** Review data loaded. Campaign **Review: Party in the Field** (Assisted, Encounter in round 2). All four accounts have the live table open in separate browser profiles. P1, P2 and P3 have switched **Auto-roll** ON in the tabletop header (this scenario needs auto-roll on). Part B uses the Sandbox Campaign (set up as in UAT-SCENE-1: P1, P2 and P3 are members, each with a Character created in the Builder, because Aria, Bryn and Cade are already in the Review Campaign and a Character can be in only one Campaign). Heavy setup: G5. Part A completes the Review Encounter, so reset the review data (README setup steps 2 to 5) afterwards if you need it again.

**Steps**

Part A: Assisted, three players

1. **GM:** Open **Review: Party in the Field**, then **Open tabletop window** in the **Live tabletop** panel. Note whose turn it is, the round number, and each creature's hit points on screen.
2. **P1, P2, P3:** Open the same live table. Confirm each header shows the **Player** badge and the Scene is visible.
3. **GM:** Open the Encounter drawer and the Encounter history. Confirm Aria, Bryn and Cade are listed as Characters (Friendly) and Wolf and Goblin as creatures (Hostile).
4. **GM:** Use **Next turn** until it is Aria's turn (or use **Current turn** if the tool offers a picker).
5. **P1:** Open the action drawer, pick Aria's weapon attack, aim it at the Wolf, and confirm. With auto-roll on, no roll prompt should appear.
6. **P1:** Choose **End turn**.
7. **P2:** Repeat steps 5 and 6 on Bryn's turn against the Goblin (the GM advances the turn first).
8. **P3:** On Cade's turn, attack the Wolf or Goblin and end the turn.
9. **GM:** On a creature's turn, act for the Wolf (attack a Character), then end its turn. Note the round number when the turn order wraps.
10. **GM:** Open the Encounter history and read every entry from this scenario.
11. **GM:** Choose **Complete encounter**. Confirm the Encounter is finished and the live table shows no active turn.

Part B: Manual

12. **GM:** Open the Sandbox Campaign and, in its table settings, set **Automation mode** to **Manual** and save. Reuse the "UAT Cavern" Scene with tokens for P1's and P2's Characters.
13. **GM:** Create an Encounter with a Goblin; the party takes in the Sandbox's assigned Characters. Check that **Start encounter** stays disabled until every combatant has initiative.
14. **GM:** Use **Roll initiative** for the Goblin, then enter an Initiative number for each of P1's, P2's and P3's Characters, then **Start encounter**.
15. **P1:** Open the live table. Confirm the action drawer is not shown (Manual mode) and that you can still move your own Character's token.
16. **GM:** Use **Next turn** through a full round. Edit a hit point total by hand on a creature and confirm the app records it without applying any rule or prompt.
17. **GM:** Complete the Encounter, then set **Automation mode** back to **Assisted** and save, so later scenarios in the Sandbox are Assisted.

**Expected**

- In Part A every player attack is resolved by the app (damage and hit points change on screen) without a roll prompt, and each player acted only on their own Character's turn.
- Each action is one line in Encounter history, naming the actor and the result, and the round number rises once after the last creature acts.
- A Character's assigned player is already a controller of that Character (P1 can act for Aria without the GM setting anything); the Wolf and Goblin can be acted for only by the GM.
- After **Complete encounter** the Run no longer shows as active.
- In Part B the **Start encounter** button is disabled until every combatant has initiative, then enabled.
- In Manual mode the action drawer is hidden for players, no roll prompts or reaction prompts appear, and the table tracks turns, rounds and reminders only. (The "Assisted only" refusal of a rules action cannot be triggered by hand because no rules control is offered; the ledger proof covers it.)
- The Manual Encounter's party is exactly the Sandbox's active Character assignments: P1's, P2's and P3's Characters are in the order.

**Other users see**

- **P2, P3:** Every attack, hit point change and turn change from other users appears live without a refresh. They never see the GM's private rolls.
- **P1 (Part B):** A Manual-mode table shows turn order and rounds but no attack outcomes computed by the app.

## UAT-ENCOUNTER-2: Initiative and optional-combat combinations pass end to end

- **Covers:** ENCOUNTER-3.2, ENCOUNTER-4.1, ENCOUNTER-4.2, ENCOUNTER-4.3, ENCOUNTER-4.4, ENCOUNTER-9.1, ENCOUNTER-10.1, ENCOUNTER-2.3
- **Accounts:** GM, P1, P2, P3
- **Preconditions:** Review data loaded. This scenario changes Campaign table settings; use **Review: Party in the Field** after finishing its current Encounter (scenario UAT-ENCOUNTER-1 Part A completes it), or use the Sandbox Campaign (kept **Assisted**; it needs P1, P2 and P3 with Characters as in UAT-ENCOUNTER-1). Heavy setup: G5 for the extra Encounters in steps 8 to 10. P1, P2 and P3 have Auto-roll ON for the first half and OFF for the second.

**Steps**

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

**Expected**

- Speed Factor: order follows declared factors plus modifiers; ties are broken by the authored tie rule, not by chance; a player who declares and then resolves a different action is refused.
- Each initiative die rolled for a declaration (auto-rolled or typed) posts exactly one Initiative roll card to the table, the same style a GM-rolled initiative posts.
- A roll with advantage or disadvantage shows two faces and keeps the higher or lower; the card shows the mode and both faces.
- A reinforcement actor is placed in the order according to the policy (this round if its place has not passed, otherwise next round).
- Facing, Flanking, Marking and other chosen rules show as active on the Encounter and do not stop initiative working.

**Other users see**

- **P2, P3:** All initiative cards appear on the table as soon as they are rolled; a declaration by P1 is visible as a declared action in the order, not as P1's private choice if the GM hid it.

## UAT-ENCOUNTER-3: Prepare, start, delete and persist a Run

- **Covers:** ENCOUNTER-1.1, ENCOUNTER-2.1, ENCOUNTER-2.2, ENCOUNTER-2.4, ENCOUNTER-2.5, ENCOUNTER-3.1
- **Accounts:** GM, P1
- **Preconditions:** The Sandbox Campaign (Assisted) with P1 as a member with a Character and the "UAT Cavern" Scene (UAT-SCENE-1). The Review Encounters are already started, so this scenario does not use them.

**Steps**

1. **GM:** Open the Sandbox Campaign and check P1 is a member with a Character and the Scene exists.
2. **GM:** Create an Encounter Blueprint with a Wolf and a Goblin. Confirm it appears in the Campaign's Encounter list and the picker offers only Blueprints for this Campaign's game system.
3. **GM:** Create a Run from the Blueprint on the Scene. Confirm it is **Prepared** and the map shows tokens for each actor.
4. **GM:** Choose **Delete encounter** on the Prepared Run and confirm. Confirm it disappears and the Blueprint is still there.
5. **GM:** Create a Run again and **Start encounter**. Confirm it becomes active.
6. **GM:** Try to start a second Run in the same Campaign while the first is active. Read the refusal.
7. **GM:** Close the tab, then reopen the live table. Confirm the active Encounter and presented Scene are still there.
8. **P1:** Open the live table, confirm you see the same Scene and Encounter. Close and reopen; confirm it persists.
9. **GM:** Finish the Session (end the current Session from the Campaign session page). Confirm the Encounter is still active in the next Session.
10. **GM:** Remove an actor mid-combat when it is not its turn. Confirm the turn marker stays on the same actor.
11. **GM:** Add a reinforcement. Confirm the turn marker and history are unchanged.
12. **GM:** Complete the Encounter. Confirm the Scene stays presented to players.
13. **GM:** Create a new Run from the same Blueprint on the same Scene and start it. Confirm each actor's token binds again, with no duplicate tokens.
14. **GM:** Open the first Run's history. Confirm it still names its actors and results unchanged.

**Expected**

- The Prepared Run can be deleted; a started one cannot be deleted, only completed.
- Starting a second Run while one is active is refused with a message naming the active Run.
- The active Encounter survives closing the tab, reconnecting and finishing a Session.
- Removing or adding an actor does not move the turn marker or erase history.
- The Scene stays presented after the Encounter completes.
- Steps 13 to 14: the second Run reuses the Scene's tokens without duplicates, and the first Run's history is intact.

**Other users see**

- **P1:** The same Scene and Encounter; on completion the map remains and the turn order clears.

## UAT-ENCOUNTER-4: Controllers, dispositions and removing a member

- **Covers:** ENCOUNTER-3.3, ENCOUNTER-3.4, ENCOUNTER-3.5, ENCOUNTER-3.6, ENCOUNTER-3.7
- **Accounts:** GM, P1, P2, P3
- **Preconditions:** Steps 1 to 6 use **Review: Party in the Field** with its Encounter active (they change the Wolf's disposition and the Goblin's controllers, which steps 4 and 6 set back). Steps 7 and 8 use the Sandbox Campaign with P3 as a member with a Character and a new Prepared Run (create one from the Blueprint as in UAT-ENCOUNTER-3 step 3), because they remove a Character and a member and must not touch Review data. Heavy setup: G5.

**Steps**

1. **GM:** Open the Encounter drawer. For the Goblin, open **Controllers** and add P1 as a controller (the companion/granted-creature case).
2. **P1:** On the Goblin's turn, act for it. Confirm you can resolve its action and end its turn.
3. **P2:** Try to act for the Goblin. Read the refusal.
4. **GM:** Remove P1 from the Goblin's **Controllers**. Confirm P1 can no longer act for it.
5. **GM:** Open Aria's controllers. Confirm P1 is listed and cannot be removed (a Character's assigned player always controls it).
6. **GM:** Change the Wolf's disposition to Friendly, then Neutral, then back to Hostile. Confirm the token ring colour changes each time (Friendly blue, Hostile red; note the Neutral colour).
7. **GM:** In the Sandbox, before starting the Prepared Run, remove P3's Character from the Campaign's active Characters. Start. Confirm that Character is not in the order.
8. **GM:** Remove P3 as a Sandbox member. Confirm P3 drops from every controller list and the P3 window is removed from the live table.

**Expected**

- Only the GM and a listed controller can act for an actor; others are refused with a message that they do not control it.
- Disposition defaults: Characters Friendly (blue ring), creatures Hostile (red ring); GM edits change the ring colour. The Encounter drawer lists Aria, Bryn and Cade as Friendly and the Wolf and Goblin as Hostile before step 6.
- Removing a member removes them from every controller list.

**Other users see**

- **P2:** Sees the ring colour changes live and cannot act for a creature they do not control; sees no controller changes for Characters that are not theirs beyond what the Party shows.
- **P3 (after step 8):** Is removed from the room and gets an access message on reload.

## UAT-ENCOUNTER-5: Morale

- **Covers:** ENCOUNTER-6.1, ENCOUNTER-6.2, ENCOUNTER-6.3
- **Accounts:** GM, P1
- **Preconditions:** Review data loaded; Morale offered under **Optional combat rules** only once it resolves. A fresh Encounter is needed: use the Sandbox Campaign (P1's Character, Assisted, Auto-roll ON for P1) and create and start a new Run from the Wolf and Goblin Blueprint as in UAT-ENCOUNTER-3 steps 3 to 5.

**Steps**

1. **GM:** Open table settings and select **Morale** under **Optional combat rules** if it is offered. If it is not offered, record that and stop (the AC says it appears only once it resolves).
2. **GM:** Start a new Run of the Wolf and Goblin Blueprint in the Sandbox.
3. **P1:** On P1's Character's turns attack the Goblin until it is at half hit points or fewer.
4. **GM:** Confirm a morale save is offered for the Goblin. Accept and resolve it.
5. **GM:** If the save fails, read the proposed outcome (flee, or surrender when escape is impossible). Confirm it.
6. **GM:** Open the Goblin's actor card. Confirm the outcome is shown as a morale mark.

**Expected**

- A trigger creates a morale offer for the GM only; a failed save proposes flee (or surrender if escape is impossible); the GM must confirm; the confirmed outcome is recorded on the actor.

**Other users see**

- **P1:** Sees a morale state on the Goblin token after the GM confirms it; never sees the GM's save before it resolves.

## UAT-ENCOUNTER-6: Roll cards for turn-stage rolls

- **Covers:** ENCOUNTER-7.1, ENCOUNTER-7.2, ENCOUNTER-8.1, ENCOUNTER-9.1
- **Accounts:** GM, P1
- **Preconditions:** Review: Party in the Field with its Encounter active (this scenario adds creatures and hides the Goblin, so reset the review data afterwards). Run once with P1's Auto-roll ON and once with it OFF.

**Steps**

1. **P1:** Set Auto-roll ON. Take a turn and attack. Count the roll cards your attack posts.
2. **GM:** Add a creature with Recharge (such as a Dragon Wyrmling) and one with Legendary Actions as reinforcements (Heavy setup: G5), take the Recharge creature's turn and count cards at turn start; when the legendary window opens after another creature's turn, roll its legendary dice and count cards.
3. **P1:** Set Auto-roll OFF. Attack again; at the roll prompt choose **Roll dice**, then commit. Count cards.
4. **P1:** Attack again and type physical dice faces instead. Count cards.
5. **GM:** Make an attack that has advantage or disadvantage (the roll prompt names the reason), change the roll mode at the prompt before committing, and watch the card. Then turn on your computer's "reduce motion" accessibility setting, reload, and repeat.
6. **GM:** Open Chat and look at where each card went (Table, To GM, Just me). Then mark the Goblin's token hidden, have it attack, and look under **Enemy rolls** and **My rolls**.

**Expected**

- Each roll, including Recharge and legendary dice, posts exactly one card: no attempt card plus a second card at commit.
- A card whose roll mode changed at commit animates the cancelled die with a cross; with reduced motion on the same result appears without animation.
- Cards for a hidden actor go to the GM's private rolls (**My rolls**), not the table.

**Other users see**

- **GM:** Sees the same one card per roll that the table sees.

## UAT-ENCOUNTER-7: Blueprint edits and who can reach them

- **Covers:** ENCOUNTER-1.2, ENCOUNTER-1.3
- **Accounts:** GM, P1
- **Preconditions:** The Sandbox Campaign with the Wolf and Goblin Blueprint from UAT-ENCOUNTER-3 step 2 and P1 as a member. A second browser window with nobody signed in (a private window of a profile that is signed out).

**Steps**

1. **GM:** Open the Blueprint in the Encounter builder in two browser tabs, A and B.
2. **GM (tab A):** Rename the Blueprint and save.
3. **GM (tab B), without reloading:** Add a second Goblin and save.
4. **GM:** Reload both tabs and compare the Blueprint name and creature list.
5. **GM (tab A):** Double-click the save control (two clicks in under a second) after a small change, then open the Encounter history or list.
6. **P1:** Open the Campaign's Encounter list and look for the Blueprint. Then paste the Blueprint builder's address (copy it from the GM's tab) into P1's browser.
7. **Signed-out window:** Paste the live table address of the Sandbox Campaign.

**Expected**

- Step 3: the stale save is refused with a message that the Blueprint changed (or it merges visibly); after reload both tabs show the same name and the same creature list, and the Blueprint is never half-saved.
- Step 5: the Blueprint changes once and there is one copy of it.
- Step 6: P1 does not see the Blueprint in a list, and the pasted address shows a not-allowed or not-found message, not the GM's Blueprint.
- Step 7: the signed-out window is sent to sign-in and shows no table data.

**Other users see**

- **P1:** must NOT see the Blueprint's name, creatures or any edit.

## Covered elsewhere

| AC            | Why not a UAT step                                                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ENCOUNTER-2.6 | Forced rollbacks need injected failures a tester cannot cause; the race outcomes on lifecycle, binding and presentation are exercised by hand in UAT-RELIABILITY-2. |
