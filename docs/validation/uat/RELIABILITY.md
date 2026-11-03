# Replay, reconnect and contention — UAT scenarios

Feature `RELIABILITY` in the [phase ledger](../../roadmap/08-phase-ledger.json). Set up first: [README](README.md#setup).

These scenarios prove that a dropped connection, a double click, a page refresh, two people acting at the same instant, and a closed-and-reopened room never lose a decision, apply an action twice, or leak private information. Accounts and several-window setup are in the README: [accounts](README.md#accounts), [running several users side by side](README.md#running-several-users-side-by-side). To drop a connection on purpose, open the browser's developer tools, go to the Network panel and set throttling to "Offline" (set it back to "No throttling" to reconnect), or close the tab and reopen the live table.

## UAT-RELIABILITY-1: Privacy, replay, rollback, concurrency and performance hold together

- **Covers:** RELIABILITY-1.1, RELIABILITY-1.2, RELIABILITY-3.1
- **Accounts:** GM, P1, P2
- **Preconditions:** Review data loaded ([review data](README.md#review-data)). Use Campaign **Review: Party in the Field**. GM, P1 and P2 each have the live table open in their own browser profile, Scene presented, Encounter active. Note Aria's and the Wolf's hit points, and Aria's position, before you start. Players' Roll my dice automatically OFF. This scenario changes review data, so reset it afterwards (README setup steps 2 to 5).

**Steps**

1. **GM:** Set the **Roll visibility** switch in the action drawer to **Private**. Make any roll for the Wolf (for example roll its initiative or an attack roll). Note what the roll shows.
2. **P1:** Drag Aria's token away from the Wolf so Aria leaves the Wolf's reach (a small step is enough).
3. **P1:** Read the screen. The move must pause rather than finish.
4. **GM:** Find the **Pending decision** drawer and read it. It offers **Use reaction** and **Decline reaction** for the Wolf. Do not answer yet.
5. **P2:** Try to drag Bryn's token a short distance. Read the message.
6. **GM:** Set the browser to Offline for about 15 seconds, then set it back to No throttling (or close the tab and reopen the live table).
7. **GM:** Read the **Pending decision** drawer again.
8. **P1:** Reload the page (browser refresh) while the decision is still open. Reopen the live table. Read what Aria's token and the drawer show.
9. **GM:** Double-click **Use reaction** quickly (two clicks in under a second).
10. **GM:** Open the Encounter history. Count the opportunity attacks against Aria that were just added.
11. **P1:** Reload the page again and compare Aria's hit points, the Wolf's reaction, and the history with before the reload.
12. **GM:** In the Encounter turn menu choose **Undo last action**. Note Aria's hit points afterwards.
13. **GM:** Reload the page, open the turn menu again and try **Undo last action** a second time. Read the message.
14. **P1:** Look for any undo control at the table. Then open chat and look for **My rolls**.
15. **P2:** Reload and check that the GM's private roll from step 1 is not in chat or the roll cards.

**Expected**

- Step 3: Aria's move is paused on a **Pending decision**, not completed.
- Step 5: Bryn's move is refused with "Waiting on a movement decision."
- Step 7: the decision is still open, unchanged, after the reconnect; wording such as "This choice is durable. Reconnecting returns to the same decision." may appear. No second prompt appears and none has been lost. (A temporary preview, such as an aimed area, may have vanished; that is allowed.)
- Step 8: after the reload the decision is still pending and Aria's token has not jumped.
- Steps 9-10: exactly one opportunity attack is recorded, with no repeated roll. The Wolf's reaction is spent once. P1's window shows Aria's move arrive and the result of the opportunity attack once each, with nothing repeated.
- Step 11: after reload the hit points, history entry count and reaction state are identical to before the reload; nothing is rolled again.
- Step 12: Aria's hit points and the Wolf's reaction return to their values before the opportunity attack.
- Step 13: the second undo is refused (already undone, or nothing to undo); nothing changes.
- Step 14: P1 has no undo control. The GM's private roll is only in the GM's **My rolls**.
- Step 15: the private roll is absent for P2 both before and after the reload.

**Other users see**

- **P1:** After step 9 sees Aria's move complete and the opportunity attack result; after step 12 sees Aria's hit points restored.
- **P2:** Sees the "Waiting on a movement decision." refusal; must NOT see the GM's private roll at any point, including after a reload.

## UAT-RELIABILITY-2: Two users act at the same moment

- **Covers:** RELIABILITY-2.1, RELIABILITY-2.2, RELIABILITY-2.3, RELIABILITY-2.4
- **Accounts:** GM, P1, P2
- **Preconditions:** Review data loaded. Steps 1-7 use **Review: Shield and Hold** (GM and P1 only; P2 is not a member there). Ember's Shield is already spent in the review data, so first start a new round (the GM uses **Next turn** until Ember's reaction is available; see UAT-REACTION-1). Steps 8-11 use **Review: Party in the Field** (GM, P1, P2). Steps 12-15 use the Sandbox Campaign from UAT-SCENE-1 with two Scenes (P1 a member; Heavy setup: build that Campaign and its second Scene by hand) and the GM in two browser tabs. Use two computers or two side-by-side windows and a helper counting "3, 2, 1, go". Reset the review data afterwards.

**Steps**

1. **GM:** In **Review: Shield and Hold**, open the live table and use **Next turn** until the Wolf is current. Have the Wolf attack Ember (roll if asked) so that a Shield prompt appears for Ember's player.
2. **P1:** Open the Shield prompt and leave it unanswered.
3. **GM:** Open the same prompt (the GM can answer for anyone).
4. **P1 and GM, together on "go":** P1 clicks **Use** while the GM clicks **Decline**.
5. **P1:** Read the screen after both clicks settle.
6. **GM:** Read the screen, then open Encounter history.
7. **GM:** Check Ember's spell slots and whether the attack hit or missed.
8. Switch both to **Review: Party in the Field**. **P1 and P2, together on "go":** P1 drags Aria's token and P2 drags Bryn's token to different empty squares.
9. **P1 and GM, together on "go":** P1 drags Aria's token to one empty square while the GM drags the same Aria token to a different empty square.
10. **GM, P1 and P2:** Look at Aria's position in each window, then reload each window and look again.
11. **GM:** Open Encounter history and read the movement entries from steps 8 and 9.
12. **GM (in Shield and Hold) and P2 (in Party in the Field), together on "go":** the GM presses **Next turn** in Shield and Hold while P2 drags Bryn's token in Party in the Field.
13. **GM (tab A and tab B, in the Sandbox), together on "go":** tab A presents Scene 1 while tab B presents Scene 2.
14. **GM and P1:** Reload both windows and read which Scene is presented.
15. **GM (tab A and tab B), together on "go":** both choose **Complete encounter** on the Sandbox Run. **GM:** Read the Encounter history.

**Expected**

- Steps 5-7: only one answer wins. The other person sees a message that the choice was already answered or is out of date, and the stale click does not undo the winner. History records one reaction outcome, Ember loses at most one first-level slot, and Ember's reaction is spent once. The hit or miss matches the winning answer.
- Step 8: both moves succeed; each token ends on its own target square in every window.
- Step 9: one move wins and the other is refused or applies after it in order. Which one wins can vary; Aria is never in two places and never ends on a square occupied by another token.
- Step 10: all windows, before and after reload, show the same position for Aria and Bryn.
- Step 11: history shows each movement once, with no duplicate or half-finished entry.
- Step 12: both actions succeed independently (independent Runs do not block each other), and Bryn's move and the turn change each appear once.
- Steps 13-14: exactly one Scene ends up presented, the same in every window before and after reload; the other attempt is refused or applied after it in order.
- Step 15: the Run completes once; the second attempt is refused as already complete, and history shows one completion.

**Other users see**

- **P1:** The same winning answer and final positions as the GM.
- **P2:** In steps 8-11 sees both tokens end where the winning commands put them; never a token in two places.

## UAT-RELIABILITY-3: The room closes after everyone leaves and reopens with state intact

- **Covers:** RELIABILITY-2.5, RELIABILITY-2.6
- **Accounts:** GM, P1, P3
- **Preconditions:** Review data loaded. Use **Review: Party in the Field** with the live table open for GM and P1. P3 has the Campaign page (not the live table) open in another window. Steps 3 and 5 change review data, so reset it afterwards. Allow about ten minutes in all.

**Steps**

1. **GM:** Note the round, whose turn it is, Aria's and the Wolf's hit points, and the last three chat entries.
2. **P3:** On the Campaign page outside the table, note the hit points and conditions shown for each Character, and the round number.
3. **GM:** Make a change at the table, such as damaging the Wolf or changing Aria's hit points through the action drawer.
4. **P3:** Without refreshing, watch the Campaign page for the change.
5. **P1:** Open Aria's Sheet in another tab, change a play value (for example spend a hit die or edit hit points) and save it.
6. **GM:** Look at the live table for Aria's changed value, make one table action (for example **Next turn**) and look again.
7. **GM and P1:** Close every tabletop tab and window (stay signed in and stay members; do not use any Leave Campaign control).
8. Wait about six minutes with nobody in the room (the room closes about five minutes after the last person leaves).
9. **GM:** Reopen the live table with **Open tabletop window** in the **Live tabletop** panel.
10. **P1:** Reopen the live table.
11. **GM and P1:** Compare the round, current turn, hit points, positions, conditions and chat with your notes from step 1 and the changes from steps 3 and 5.

**Expected**

- Step 4: P3's Campaign page updates by itself, with no refresh, to show the new hit points (and the round) for Characters P3 is allowed to see.
- Steps 2 and 4: P3 does not see another member's Character details unless that Character's Sheet is shared with the party; for one that is not shared, no hit points or conditions appear.
- Step 6: Aria's Sheet edit shows on the table at once or by the next table action, and no other play state (initiative, reactions, positions) is lost.
- Step 11: everything matches: same round and turn, same hit points including the Sheet edit, same positions and chat. Nothing is reset to the start.

**Other users see**

- **P3:** Sees only party-visible values on the Campaign page, never another member's private Character details.
- **P1:** Sees the same restored state as the GM after reopening.

## UAT-RELIABILITY-4: A new Scene measures lengths correctly in every unit

- **Covers:** RELIABILITY-4.1, RELIABILITY-4.2
- **Accounts:** GM
- **Preconditions:** Review data loaded. Have any small JPEG, PNG or WebP image on your computer to use as a map. Use the Sandbox Campaign from UAT-SCENE-1 (Heavy setup: build it by hand): the Review Encounters are already running, so they cannot start a new Encounter on a new Scene.

**Steps**

1. **GM:** In **Live maps** upload the image and name it "Reliability squares".
2. **GM:** Choose **Square** and the unit feet. Note the default distance per cell shown.
3. **GM:** Switch the unit to metres. Note the new default distance per cell.
4. **GM:** Switch the unit to squares. Note the new default distance per cell.
5. **GM:** Switch back to feet and save the Scene.
6. **GM:** Present the Scene and add a token for a creature.
7. **GM:** Start a new Encounter on this Scene (Campaign mode Assisted; UAT-ENCOUNTER-3 steps 3 and 5), with a creature a few squares from another.
8. **GM:** Move a token, then pick an attack action against a creature a few squares away and read the range shown.
9. **GM:** Set a second new Scene's unit to squares, present it, start an Encounter and repeat step 8.

**Expected**

- Step 2: default distance per cell is 5 ft.
- Step 3: it becomes about 1.524 m.
- Step 4: it becomes 1 square.
- Step 5: back to 5 ft.
- Steps 7-9: the Encounter opens, and the movement readout and action drawer show range and reach without any error message or blank screen, on both the feet and squares Scenes.

**Other users see**

- Not applicable: single user.

## UAT-RELIABILITY-5: Forms and sign-out recover without silent data loss

- **Covers:** RELIABILITY-8.3, RELIABILITY-9.1, RELIABILITY-9.6, RELIABILITY-21.14
- **Accounts:** GM, P1
- **Preconditions:** Review data loaded. GM can author a Spell at `/spells`. Delete the "Reliability Probe" Spell afterwards (or leave it if your reset removes it). Step 9 signs P1 out, so P1 signs back in after step 10.

**Steps**

1. **GM:** Open `/spells` and start a new Spell. Leave the name empty, fill in whatever else is required, and try to save.
2. **GM:** Give the Spell the name "Reliability Probe" and save it.
3. **GM:** Open the Spell's edit page in two browser tabs, A and B.
4. **GM (tab A):** Start typing a sentence into the description but do not save.
5. **GM (tab B):** Change the Spell's name and save.
6. **GM (tab A):** Read what the page shows, then continue typing.
7. **P1:** Open Aria's Sheet, go to the Extras area and click the Creature select. Type the first letters of a creature name.
8. **P1:** Keep typing and watch whether the typed letters stay.
9. **P1:** Set the browser to Offline, then choose sign out from the account menu.
10. **P1:** Read the page. Set the browser back to No throttling and use the retry control offered.

**Expected**

- Step 1: the save is refused with an error on the name field; no Spell called "Untitled Spell" is created.
- Step 2: the Spell is created under the typed name.
- Step 6: tab A keeps what you typed in step 4 and tells you the name changed elsewhere, rather than silently replacing your text.
- Step 8: the letters you type in the Creature select stay; the field does not reset on every keystroke.
- Step 10: the page says sign-out failed (it does not say "Signing you out..." forever) and offers a retry; after going back online, retry signs you out.

**Other users see**

- Not applicable: single user.

## UAT-RELIABILITY-6: A contested passage holds, then spends once

- **Covers:** RELIABILITY-1.3
- **Accounts:** GM, P1
- **Preconditions:** The same setup as UAT-MOVE-7: **Review: Party in the Field**, Aria adjacent to the Wolf, Assisted, the Overrun choice available (reset the review data afterwards). The movement readout appears in the action area.

**Steps**

1. **P1:** On Aria's turn note the movement readout, then start a move and choose **Overrun** to pass through the Wolf's space.
2. **P1:** While the contest is open, read the movement readout again.
3. **P1:** Reload the page. Confirm the contest is still open.
4. **GM:** Answer the contest so that Aria wins. Double-click the answering control (two clicks in under a second).
5. **P1:** Read the movement readout and Aria's position. Reload and read both again.
6. **P1:** On Aria's next turn, start another passage and choose **Decline passage**, or have the GM decline for the Wolf.
7. **P1:** Read the movement readout and Aria's position. Reload.

**Expected**

- Steps 2-3: the movement readout is unchanged while the contest is open; nothing is spent before the passage finishes, and a reload shows the same single open contest.
- Steps 4-5: the movement is charged once, for the whole path, and Aria arrives once. The double-click does not charge or move twice.
- Steps 6-7: after the passage is declined Aria's token stays where it paused, and only the distance actually travelled is spent.

**Other users see**

- **GM:** Sees the contest open, then one result in history.

## UAT-RELIABILITY-7: Authored speed and sense bonuses use the right length unit

- **Covers:** RELIABILITY-5.1
- **Accounts:** GM, P1
- **Preconditions:** The Sandbox Campaign from UAT-SCENE-1 with P1's Character on a Scene (Heavy setup: build that Campaign and Scene by hand). The GM authors a Feature at `/features` (or the equivalent authoring area; the exact labels were not verified, so describe what you find). The editor must offer a length unit on speed and sense modifiers; if it does not, record that against RELIABILITY-5.1.

**Steps**

1. **P1:** Open P1's Character's Sheet. Note the walking speed and the darkvision range if any.
2. **GM:** Create a Feature "Reliability Boots" that adds +30 to walking speed with the unit set to feet. Publish it.
3. **GM:** Copy it as "Reliability Yards" with the bonus set to +30 and the unit set to yards. Publish it.
4. **GM:** Create a Feature "Reliability Eyes" that adds +30 feet to a sense range, and grant it to a Character with a sense that is 20 yards (60 ft) if available.
5. **P1:** Have the GM give P1's Character "Reliability Boots" and read the Sheet speed. Then swap to "Reliability Yards" and read it again.
6. **P1:** Read the sense range with "Reliability Eyes" granted.
7. **P1:** Start a move on a Scene and read the movement budget shown.

**Expected**

- Step 5: Boots add 30 ft to the speed; Yards add 90 ft (30 yards). Neither changes it by a different amount or by zero.
- Step 6: the sense range grows by exactly 30 ft, even when the base sense was authored in yards.
- Step 7: the movement budget shown matches the Sheet speed.

**Other users see**

- **GM:** Sees the same speed and senses on the Character's token.

## UAT-RELIABILITY-8: The Sheet shows correct rests, ability checks and hit points

- **Covers:** RELIABILITY-6.1, RELIABILITY-6.3, RELIABILITY-6.19
- **Accounts:** P1
- **Preconditions:** Review data loaded. P1 has Aria's Sheet open. Hit points edits change review data, so reset it afterwards.

**Steps**

1. **P1:** On Aria's Sheet, reduce her hit points (edit them to below her maximum).
2. **P1:** Start a short rest and spend one hit die. Read the roll and the new hit points.
3. **P1:** Reload. Confirm the hit points and the hit dice remaining kept their values.
4. **P1:** Roll Athletics and read the roll card. Roll Stealth and read the roll card.
5. **P1:** Set Aria's temporary hit points to 5 and save. Reload. Then clear them back to nothing and reload.
6. **P1:** In the Extras area add a Creature (for example a pet), choosing an origin other than the world default, and save. Reload and read the origin.

**Expected**

- Step 2: the hit die roll resolves (the die roll plus Constitution modifier, never above the maximum) and one hit die is spent.
- Step 4: Athletics names the Strength modifier and Stealth the Dexterity modifier; no skill uses the wrong ability.
- Step 5: temporary hit points show 5, then show none (zero) rather than blank or an error.
- Step 6: the Creature keeps the origin you chose and is not changed to World.

**Other users see**

- Not applicable: single user.

## UAT-RELIABILITY-9: Roll reasons and initiative read the right source

- **Covers:** RELIABILITY-6.9, RELIABILITY-6.15
- **Accounts:** GM, P1
- **Preconditions:** The Sandbox Campaign (UAT-SCENE-1) with P1's Character, a Wolf and a Goblin and a new Run waiting to start (UAT-ENCOUNTER-3 steps 3 and 5; Heavy setup: build that Campaign and Run by hand). P1's Roll my dice automatically OFF.

**Steps**

1. **GM:** Before starting, open P1's Character's Sheet and note its initiative modifier. Open the Wolf's stat block and note its Dexterity modifier.
2. **GM:** Start the Encounter and roll initiative for everyone (with typed faces, for example 10 for each), and read the totals.
3. **GM:** Make the Wolf Prone and have P1's Character attack it at melee range.
4. **P1:** At the roll prompt read the advantage reason.
5. **GM:** Give P1's Character the Bless effect. **P1:** Attack again and read the roll card's reasons.
6. **GM:** Remove the effects.

**Expected**

- Step 2: each actor's total equals the typed face plus its own modifier (the Character's from the Sheet, the Wolf's from its Dexterity); a Creature and a Character never use each other's modifier.
- Step 4: the prompt names Prone (and the range) as the reason for advantage.
- Step 5: the card names the effect (Bless) as the source of the bonus, not a raw id or an unknown label.

**Other users see**

- **P1:** Sees the same reasons the GM sees on the public card.

## UAT-RELIABILITY-10: Builder and party inventory values are right

- **Covers:** RELIABILITY-6.5, RELIABILITY-6.13, RELIABILITY-6.17, RELIABILITY-7.2, RELIABILITY-10.3
- **Accounts:** GM, P1
- **Preconditions:** Review data loaded. P1 opens the Builder for a new Character (Heavy setup if you finish it: finish it only inside a throwaway Campaign of your own, never a Review Campaign, and delete the draft afterwards). The GM opens the party inventory of **Review: Party in the Field** (UAT-CAMPAIGN-5).

**Steps**

1. **GM:** Open the party inventory and read the currencies listed.
2. **GM:** Add coins to one currency, reload and read the entry again.
3. **P1:** Start a new Character in the Builder. Choose a class and pick the level-1 hit points option.
4. **P1:** Read the hit points shown, and the hit die value and proficiency bonus.
5. **P1:** Raise the level to 2 and read the hit points and proficiency bonus again.
6. **P1:** Look for a field named "HP gained (legacy)" or a hit-point override.
7. **P1:** Leave a required choice empty, then try to finish. Read the list of issues and select one.
8. **P1:** In the Builder set the network to Slow 3G (browser developer tools), then save a step. Watch the save control.

**Expected**

- Steps 1-2: each currency shows its proper name (for example gold) and not an id; no currency is mislabelled and added coins stay on the same currency after a reload.
- Steps 4-5: hit points at level 1 equal the hit die maximum plus the Constitution modifier; the hit die average and proficiency bonus (+2 at levels 1 to 4) match the class and level.
- Step 6: no "HP gained (legacy)" input or hit-point override exists.
- Step 7: selecting an issue takes you to the Builder step that owns it, never to Review as a fallback.
- Step 8: the save control shows a saving state until it finishes, never idle while the save is pending.

**Other users see**

- **GM:** Sees the same currency names and amounts as the party inventory the players see.

## UAT-RELIABILITY-11: Authoring selects, labels and lists

- **Covers:** RELIABILITY-8.2, RELIABILITY-8.4, RELIABILITY-8.7, RELIABILITY-9.2
- **Accounts:** GM, P1
- **Preconditions:** Review data loaded. Labels in the authoring forms were not verified in source, so describe the control you find. Spell and Feature drafts you create here should be deleted afterwards.

**Steps**

1. **GM:** Open `/spells`, start a new Spell, and read whether a System and a School are preselected.
2. **GM:** Fill in everything else and try to save without choosing a School. Read the result.
3. **GM:** Open a new Feature and a new Feat. In each, open the type and charge reset selects and try to clear the choice.
4. **GM:** Compare the charge reset options in the Feature editor and the Feat editor.
5. **GM:** Read the enum values shown in the editors (for example reset timing) for raw text such as LONG_REST.
6. **GM:** Open the Campaign page and note the owner-only controls (edit, archive, transfer, invite).
7. **P1:** Open the same Campaign page and look for the same controls.
8. **GM:** Open the list of all SRD Spells (or Equipment). Scroll to the very bottom and note the last item and the total shown.
9. **GM:** Search for an item that would be on a later page and confirm it is found.

**Expected**

- Step 1: the System comes from the route you opened or your selection, and no School is preselected.
- Step 2: the save is refused with a message asking for a School; the Spell is not created with a default School.
- Step 3: neither select can be left blank once chosen; there is no "Trait" or "Long rest" fallback that appears without being chosen.
- Step 4: both editors offer the same charge reset options in the same order.
- Step 5: values read as words ("Long rest"), not raw identifiers.
- Steps 6-7: the GM sees owner-only controls when they are the active owner; P1 sees none of them.
- Steps 8-9: the list shows every item, not only the first page; search finds items from later pages.

**Other users see**

- **P1:** Never sees owner-only controls on a Campaign they do not own.

## UAT-RELIABILITY-12: Core pages open with their data

- **Covers:** RELIABILITY-21.1, RELIABILITY-21.2, RELIABILITY-21.3, RELIABILITY-21.4
- **Accounts:** GM, P1
- **Preconditions:** Review data loaded; the local backend has not just been restarted. This is a smoke check that the pages load and the data appears with no timeout error; the one-second query limit itself is measured by CI, so a slow page here is a prompt to look, not a measured failure.

**Steps**

1. **GM:** Open the authoring tools (`/spells`, then a Class or Feature editor). Confirm each opens and lists its data.
2. **P1:** Open Aria's Sheet. Confirm it opens and every tab shows data.
3. **GM:** In **Review: Party in the Field**, open the party inventory and its equipment picker. Confirm the options list.
4. **GM:** Open the live table of the Campaign with the active Encounter. Confirm it opens and the Encounter appears.
5. **GM:** Read the browser console for timeout or limit errors on each page.

**Expected**

- Each page opens with its data and no timeout, "limit exceeded" or blank-screen error.

**Other users see**

- **P1:** Opens the Sheet and the live table the same way, with the same data.

## UAT-RELIABILITY-13: Account deletion closes the live table

- **Covers:** RELIABILITY-21.8
- **Accounts:** GM, SPARE1 (Review_Pl_Dara)
- **Preconditions:** Delete only a spare account (never GM, P1, P2, P3 or SUPERADMIN); a reset and a rerun of the review data restores it. Heavy setup: the GM adds SPARE1 to **Review: Sandbox** by inviting SPARE1 by username from SPARE1's social profile, and SPARE1 accepts in the app (UAT-SOCIAL-2 shows the invitation flow; no email is needed). Reset the review data afterwards.

**Steps**

1. **SPARE1:** Open the Review: Sandbox tabletop window.
2. **GM:** Open the tabletop window and confirm SPARE1 is present in the roster.
3. **SPARE1:** Delete the account from the account settings and confirm the deletion.
4. **SPARE1:** Read the tabletop window.
5. **GM:** Read the roster and the live table.

**Expected**

- Step 4: SPARE1's tabletop window stops receiving updates and shows a signed-out or access message; it does not keep updating.
- Step 5: SPARE1 is no longer a member; nothing else in the table changes.

**Other users see**

- **GM:** Sees SPARE1 removed and no error.

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC                | Why not a UAT step                                                                                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RELIABILITY-5.2   | A malformed authored speed cannot be produced through the authoring form, which constrains the value; the refusal is checked by publish-time and read-time contract tests. |
| RELIABILITY-6.2   | Deletes dead contract versions and reader branches; the data reseed is the reset in README setup steps 2 to 5, with no new screen behaviour.                               |
| RELIABILITY-6.4   | A compile-time guarantee (exhaustive switches over grant kinds); no runtime behaviour a tester could see.                                                                  |
| RELIABILITY-6.6   | Removes a legacy fallback and migrates stored data; the reset and reseed is the only visible effect.                                                                       |
| RELIABILITY-6.7   | Deletes the version 1 maintained-effect descriptor; no behaviour change on screen.                                                                                         |
| RELIABILITY-6.8   | One System schema version; migration of development data only.                                                                                                             |
| RELIABILITY-6.10  | Required array fields in the contract; empty and filled Creatures behave the same on screen.                                                                               |
| RELIABILITY-6.11  | Typed fact extraction replaces casts; compile-time only.                                                                                                                   |
| RELIABILITY-6.12  | One shared function builds the live-session envelope key; internal, and reconnection is exercised by UAT-RELIABILITY-1.                                                    |
| RELIABILITY-6.14  | Only reachable with corrupt stored data (an unknown condition type or a missing label), which a tester cannot create through the app.                                      |
| RELIABILITY-6.16  | Routes Concentration and melee classification through the System module; the result is the same as before, so nothing differs on screen.                                   |
| RELIABILITY-6.18  | An import warning for unnamed entries; the alpha guide lists no import control and the preview needs a crafted import file.                                                |
| RELIABILITY-7.1   | Authoring stories and tests use the real resolver; test and bundle code, with no screen behaviour.                                                                         |
| RELIABILITY-8.1   | Typed form factory replaces pass-through wrappers; internal.                                                                                                               |
| RELIABILITY-8.5   | Node defaults checked at compile time (`satisfies`); internal.                                                                                                             |
| RELIABILITY-8.6   | Typed guided forms and shared readers; internal refactor.                                                                                                                  |
| RELIABILITY-9.3   | Render purity (no ref writes during render); enforced by lint and tests.                                                                                                   |
| RELIABILITY-9.4   | No test or story modules in production; lint rule.                                                                                                                         |
| RELIABILITY-9.7   | SSR-stable rendering (no clock or locale values during render); tests, with hydration only visible as console warnings.                                                    |
| RELIABILITY-9.8   | Type guards instead of casts; lint.                                                                                                                                        |
| RELIABILITY-10.1  | Form state ownership in one TanStack form; internal structure.                                                                                                             |
| RELIABILITY-10.2  | Re-render scope while typing; measured by render-count tests, not visible to a tester.                                                                                     |
| RELIABILITY-11.1  | Generated Convex API type check (typecheck assertion).                                                                                                                     |
| RELIABILITY-12.1  | Generated Convex API type check (type test).                                                                                                                               |
| RELIABILITY-12.2  | Generated Convex API type check (type test).                                                                                                                               |
| RELIABILITY-13.1  | A flaky test made deterministic (fixture cleanup order); test code.                                                                                                        |
| RELIABILITY-14.1  | A flaky test made deterministic (custody deletion); test code.                                                                                                             |
| RELIABILITY-15.1  | A flaky test made deterministic (initiative tie seeding); test code.                                                                                                       |
| RELIABILITY-15.2  | Same, for every settled-Run test in initiativeDeclarations; test code.                                                                                                     |
| RELIABILITY-15.3  | Same, for initiativeSpellDeclarations; test code.                                                                                                                          |
| RELIABILITY-16.1  | CI snapshot-update workflow and artifact; CI tooling.                                                                                                                      |
| RELIABILITY-17.1  | A flaky Worker test made deterministic; test code.                                                                                                                         |
| RELIABILITY-18.1  | A flaky scheduler test made deterministic; test code.                                                                                                                      |
| RELIABILITY-19.1  | merge-slice size-budget conflict handling; CI tooling.                                                                                                                     |
| RELIABILITY-19.2  | merge-slice size-budget lowering; CI tooling.                                                                                                                              |
| RELIABILITY-19.3  | merge-slice retry on GitHub 5xx; CI tooling.                                                                                                                               |
| RELIABILITY-20.1  | CI job on a throwaway Convex and Worker stack; CI infrastructure.                                                                                                          |
| RELIABILITY-20.2  | CI job selection and merge gating; CI infrastructure.                                                                                                                      |
| RELIABILITY-20.3  | Every CI browser proof passes; CI results.                                                                                                                                 |
| RELIABILITY-20.4  | A documentation statement in ci-validation.md and AGENTS.md; checked by reading them.                                                                                      |
| RELIABILITY-20.5  | Content snapshot page budget measured by the harness; the visible effect (the Session room opens) is exercised by every live-table scenario.                               |
| RELIABILITY-21.5  | A single installed prosemirror-model; dependency check in CI.                                                                                                              |
| RELIABILITY-21.6  | The CI journey driver no longer fails after a Worker reload 409; CI driver fix.                                                                                            |
| RELIABILITY-21.7  | CI journey fix (no RulesRevisionChangedError during preparation); CI driver.                                                                                               |
| RELIABILITY-21.9  | Cold-sample 250 ms p95 latency budget measured by the harness; PERF owns the measurement.                                                                                  |
| RELIABILITY-21.10 | Needs two clients on different IPs against a deployed or CI stack; not reproducible on one local machine.                                                                  |
| RELIABILITY-21.11 | Fresh-stack seeding without write-rate or OCC errors; CI seeding behaviour.                                                                                                |
| RELIABILITY-21.12 | A journey-timing fix for the Shared with party option; CI timing. The sharing flow itself is exercised in UAT-CAMPAIGN-4.                                                  |
| RELIABILITY-21.13 | One-second function-time budget on the area, history and Sheet command paths while all proofs run; measured by CI.                                                         |
| RELIABILITY-21.15 | Socket re-authentication challenge at token expiry minus 60 s; a CI timing proof.                                                                                          |
| RELIABILITY-21.16 | Sheet derived once and stored per section; internal performance, proved by the builder CI journey.                                                                         |
| RELIABILITY-21.17 | CI workflow rule for known-bug label edits.                                                                                                                                |
| RELIABILITY-21.18 | CI sharding and runner-minute measurements.                                                                                                                                |
| RELIABILITY-21.19 | CI gating policy for slices and merge batches.                                                                                                                             |
| RELIABILITY-21.20 | Checksum trust in Sheet derivation; internal performance (a tampered document is refused, which a tester cannot craft).                                                    |
| RELIABILITY-21.21 | The one-second query budget on the player reload after a Campaign custody cleanup; needs a Campaign deletion plus CI timing.                                               |

## Run notes

One entry per failed, blocked or skipped run, newest first, linked from the [tracker](TRACKER.md). Use the scenario id as a `###` heading, then the date, the build (commit or staging build name), the tester, the step number and the details listed in [When a scenario fails](README.md#when-a-scenario-fails).
