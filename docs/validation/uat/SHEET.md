# Character Sheet — UAT scenarios

Feature `SHEET` in the [phase ledger](../../roadmap/08-phase-ledger.json). Set up first: [README](README.md#setup).

Proves a player can run their Character from the Sheet (hit points, rests, spells, rolls, gear, hands, Speed) on desktop and on a phone, that what they share or hide at the table is exactly what they chose, and that the Sheet and the live table never disagree. Accounts and review data: [README](README.md#accounts), [README](README.md#review-data). Several windows side by side: [README](README.md#running-several-users-side-by-side). Record results: [README](README.md#recording-results).

## UAT-SHEET-1: Edit a personal Sheet and reload

- **Covers:** SHEET-1.1, SHEET-1.3, SHEET-1.4, SHEET-5.2
- **Accounts:** P1
- **Preconditions:** Review data loaded. Use "UAT Dara", P1's Character from UAT-BUILDER-1 (build her as a Fighter). She is in no Campaign, so her Sheet is outside live play, where the SHEET-1.3 and SHEET-5.2 rules apply. Do not use Aria or Ember for this: they are in live Encounters.

**Steps**

1. **P1:** Open Characters from the main menu and choose **UAT Dara** to open the Character Sheet.
2. **P1:** Note the current hit points shown in the vitals area.
3. **P1:** Choose **Manage hit points**, enter 3 in **Hit point amount**, apply it as damage, and close the panel.
4. **P1:** Turn **Inspiration** on.
5. **P1:** Choose **Manage conditions and exhaustion**, add one condition (for example Poisoned) with a short note, and close the panel.
6. **P1:** Open the inventory section and add or change a quantity of one item; then change a currency amount (for example add 5 copper pieces).
7. **P1:** Open the notes section, choose **Create Note**, type a short note, and save it.
8. **P1:** Reload the browser page.
9. **P1:** Compare every item you changed with what the Sheet now shows.
10. **P1:** In a second browser tab of the same account, open the same Sheet and change the hit point amount by one more point of damage; then, in the first tab (not reloaded), apply one more point of healing.
11. **P1:** Reload both tabs.

**Expected**

- Step 3: current hit points drop by exactly 3 from step 2 (it cannot drop below 0).
- After step 8 the damage, Inspiration, the condition and its note, the inventory change, the currency change and the note are all still there, with no duplicates.
- Step 10: both edits land one after the other or one is refused with a visible message; no edit is silently lost. After step 11 both tabs show the same hit points.
- The Sheet shows only content from sources the Character is allowed to use (nothing from content disabled for the Campaign).

**Other users see**

- Not applicable: single user.

## UAT-SHEET-2: Short and long rest

- **Covers:** SHEET-2.1, SHEET-2.2, SHEET-2.3
- **Accounts:** P1
- **Preconditions:** Same as UAT-SHEET-1 ("UAT Dara", a level-1 Fighter). She has taken damage (UAT-SHEET-1 step 3) and has spent a resource (use Second Wind, which recovers on a short rest).

**Steps**

1. **P1:** On UAT Dara's Sheet, note hit points, hit dice, any spent resource, and any condition or exhaustion level.
2. **P1:** Open the rests section and start a short rest. Read the preview before confirming.
3. **P1:** In the preview, choose a number of hit dice to roll and roll them (with Roll my dice automatically OFF you are prompted; choose **Roll dice**).
4. **P1:** Confirm the short rest.
5. **P1:** Note hit points, hit dice, and which resources came back.
6. **P1:** Add a condition, then start a long rest, read the preview, and confirm it.
7. **P1:** Reload the page.

**Expected**

- The short-rest preview lists the hit dice you may spend and what recovers; confirming adds the rolled healing to hit points and reduces remaining hit dice by the number rolled.
- Short-rest resources come back; long-rest-only resources do not come back on a short rest.
- After the long rest hit points are at maximum, spent resources and spell slots are restored, and only the hit dice and exhaustion changes the rest policy allows are applied.
- Effects that a rest should end (such as a reduced maximum hit points that ends on rest) are gone; effects that are not rest-ended stay.
- After reload the values are unchanged (no second rest effect is applied).

**Other users see**

- Not applicable: single user.

## UAT-SHEET-3: Learn, prepare and cast spells from the Sheet

- **Covers:** SHEET-1.2
- **Accounts:** P1
- **Preconditions:** Ember is in a live Encounter, so use a separate caster: P1 builds "UAT Wizard" (Wizard level 1, in no Campaign) in the Builder first, as in UAT-BUILDER-1. A Wizard learns spells into a spellbook and prepares them.

**Steps**

1. **P1:** Open UAT Wizard's Sheet and the spells section.
2. **P1:** Note the number of remaining first-level slots.
3. **P1:** Use **Search spells** to find a spell the Wizard can learn, and choose to learn it.
4. **P1:** Prepare a spell that is not yet prepared.
5. **P1:** Cast a prepared first-level spell from the Sheet.
6. **P1:** Reload the page.
7. **P1:** Take a long rest (see UAT-SHEET-2), then check the slot count.
8. **P1:** Unprepare the spell you prepared in step 4.
9. **P1:** Forget the spell you learned in step 3.

**Expected**

- Each action is reflected within about a second without reloading.
- Casting reduces the matching slot count by one; it is still reduced after reload.
- The long rest restores the slots.
- Unprepared and forgotten spells no longer appear as prepared or known; they remain findable by search.

**Other users see**

- Not applicable: single user.

## UAT-SHEET-4: Roll from the Sheet and choose who sees it

- **Covers:** SHEET-3.1, SHEET-3.2, SHEET-3.3, SHEET-3.4
- **Accounts:** GM, P1, P2
- **Preconditions:** Review data loaded; all four accounts have Roll my dice automatically OFF. P1 and P2 are members of Review: Party in the Field. The tabletop window is not required; use each person's Campaign chat page. Step 8 needs a short rest on Aria: if rests are unavailable during the live Encounter, record that and run step 8 with "UAT Dara" in the sandbox Campaign from UAT-CAMPAIGN-2 instead.

**Steps**

1. **GM:** Open Review: Party in the Field and its Campaign chat; leave it on the Table conversation.
2. **P2:** Open the same Campaign chat on the Table conversation.
3. **P1:** Open Aria's Sheet and click a skill (for example Athletics) to start a roll. Read the **Roll destination** choices.
4. **P1:** Leave the destination at **Table** and choose **Roll dice**.
5. **P1:** Start another roll, set the destination to **To GM**, and roll.
6. **P1:** Start a third roll, set the destination to **Just me**, and roll.
7. **P1:** Open **Open roll history** on the Sheet.
8. **P1:** Start a short rest preview and roll a hit die; look at the destination choices offered for this roll.
9. **P1:** Reload the Sheet and open the roll history again.
10. **P1:** In the roll history, use the clear or discard control (if the history offers one) on one entry, then reload and reopen the history.
11. **P2:** Paste the address of Aria's Sheet (copied from P1's window) into P2's window and try to open it and its roll history.

**Expected**

- Table is the default destination. Step 8 offers only Table and To GM (never Just me) because the roll changes the Character.
- Roll history on the Sheet lists all three rolls from steps 4 to 6 (and the hit die roll), most recent first, with the totals; it is still available after reload.
- The Table roll appears in the Table chat as a card with the roller's name and total.
- Step 10: the discarded entry is gone from the history after reload and the others remain.
- Step 11: P2 is refused or sees not-found (unless P1 has Party can view on, in which case the roll history is still not shown); none of P1's rolls appear.

**Other users see**

- **GM:** sees the Table roll and the To GM roll in the Campaign chat; does NOT see the Just me roll.
- **P2:** sees only the Table roll card. Must NOT show the To GM roll, the Just me roll, or the hit die roll if it was sent To GM.

## UAT-SHEET-5: GM Public and Private rolls with reveals

- **Covers:** SHEET-3.5
- **Accounts:** GM, P1, P2
- **Preconditions:** Review: Party in the Field; all accounts have Roll my dice automatically OFF. GM, P1 and P2 each have the Campaign chat open on the Table conversation.

**Steps**

1. **GM:** In the GM roller (or the roll prompt), find the **Public / Private** switch (Roll visibility). Confirm it starts on Public the first time.
2. **GM:** Roll a d20 with Public selected.
3. **GM:** Switch to **Private** and roll a d20 for the Wolf.
4. **GM:** In chat, open **My rolls**. Find the private roll.
5. **GM:** Choose **Show that I rolled** on the private roll.
6. **GM:** Choose **Show roll** on the same roll.
7. **GM:** Try **Show roll** on the same card again.
8. **GM:** Reload the page and check the switch.
9. **GM:** Roll again with Private, and do not reveal it.

**Expected**

- Public roll shows to everyone as a roll card.
- The Private roll shows nothing in the Table chat for players. Step 4 lists it under **My rolls** with the two buttons.
- Step 5 posts a notice that the GM rolled (naming the Wolf only if players can see it). Step 6 posts the full roll marked "Revealed by GM". Each button works once; step 7 is unavailable or refused.
- After reload the switch is still on Private (last choice is remembered).
- The step 9 roll is in **My rolls** only.

**Other users see**

- **P1:** sees the Public roll card, the "rolled" notice from step 5 and the revealed roll from step 6. Must NOT see the step 3 roll before it is revealed, nor the unrevealed step 9 roll, nor the Wolf's name in the step 5 notice if the Wolf is hidden from P1.
- **P2:** same as P1.

## UAT-SHEET-6: Equipment, inventory, attunement and deleting an item

- **Covers:** SHEET-4.2, SHEET-4.3, SHEET-4.4
- **Accounts:** P1, P2
- **Preconditions:** Review data loaded. Use P1's "UAT Dara" (UAT-BUILDER-1), which is in no live Encounter. A homebrew Equipment item that grants an action or a bonus when equipped exists, or P1 creates one first under Equipment with the New control (a weapon with a damage action is enough).

**Steps**

1. **P1:** On UAT Dara's Sheet open the inventory section and add the homebrew item.
2. **P1:** Equip it. Check the actions list and any bonus it grants.
3. **P1:** Unequip it, then equip it again.
4. **P1:** Try to attune the item if it allows attunement; note the attunement slot count.
5. **P1:** Move some currency between types using **Amount to move** and **Currency type to move**.
6. **P1:** Go to Equipment, delete the homebrew item (confirm any prompt), and return to UAT Dara's Sheet.
7. **P2:** Copy the address of UAT Dara's Sheet from P1's browser and open it in P2's window.

**Expected**

- Equipping adds the item's action or bonus; unequipping removes it. Attunement uses a slot and is refused beyond the limit.
- Currency totals stay consistent (the amount moved leaves one type and arrives in the other).
- After step 6 the item is gone from the inventory and its action, bonus and charges are gone from the Sheet; unrelated items and bonuses remain.
- Step 7: P2 cannot open UAT Dara's Sheet (she is in no Campaign); P2 sees a refusal or not-found page, not P1's data.

**Other users see**

- **P2:** must NOT see UAT Dara's inventory, currency or notes at any point in this scenario.

## UAT-SHEET-7: Starting equipment on a new Character

- **Covers:** SHEET-4.1
- **Accounts:** P1
- **Preconditions:** The Builder lets P1 create a Character (see UAT-BUILDER-1 for the full journey; this scenario can be checked on that run's "UAT Dara" or on any other new Character). Slow: use any short build path.

**Steps**

1. **P1:** Open Characters, choose the control to create a new Character, and complete the Builder to the end, picking a class and background with starting equipment.
2. **P1:** Finish and open the new Character's Sheet.
3. **P1:** Open the inventory section and currency totals.
4. **P1:** Reload the Sheet.

**Expected**

- The Sheet lists the starting equipment and starting currency from the class and background choices, each exactly once.
- After reload the items and currency are unchanged (not doubled).

**Other users see**

- Not applicable: single user.

## UAT-SHEET-8: Hands, two-handed weapons and shields

- **Covers:** SHEET-8.1, SHEET-8.2, SHEET-8.3
- **Accounts:** P1
- **Preconditions:** Use "UAT Dara" (no live Encounter). P1 adds a one-handed weapon, a second one-handed weapon, a two-handed weapon, and a shield (and a second shield for step 8) from the SRD Equipment list.

**Steps**

1. **P1:** On UAT Dara's Sheet open Equipment and equip the first one-handed weapon.
2. **P1:** Equip the second one-handed weapon.
3. **P1:** Note the Armor Class, then equip the shield.
4. **P1:** Equip a third item and observe what happens.
5. **P1:** Swap the main-hand and off-hand items.
6. **P1:** Unequip the item in the main hand.
7. **P1:** Equip the two-handed weapon.
8. **P1:** Equip a second shield (if you have one) and compare Armor Class.

**Expected**

- Step 1 puts the weapon in the main hand; step 2 puts the second in the off hand.
- Each hand holds at most one item; with both hands full the app does not silently drop one.
- A shield counts toward Armor Class only while held in a hand, and only one shield counts even if two are held.
- Swap exchanges the two hands. Emptying the main hand moves an off-hand weapon into the main hand; an off-hand shield stays in the off hand.
- A two-handed weapon takes the main hand and blocks the off hand.

**Other users see**

- Not applicable: single user.

## UAT-SHEET-9: Speed on the overview and the Movement panel

- **Covers:** SHEET-6.1
- **Accounts:** P1
- **Preconditions:** "UAT Dara"'s Sheet. Steps 3-5 need a Character with a second movement type (for example a fly or swim speed); the review Characters have none, so build one or record steps 3-5 as skipped.

**Steps**

1. **P1:** Open UAT Dara's Sheet overview and read the Speed value.
2. **P1:** Open the Movement panel from the Speed value.
3. **P1:** If the Character has more than one movement type, use **Movement shown on the sheet** to choose another type.
4. **P1:** Close the panel and re-read the overview Speed.
5. **P1:** Reload.

**Expected**

- The overview shows the walking speed by default (30 ft for a standard Fighter unless the Character differs).
- The Movement panel lists every speed the Character has.
- After step 4 the overview shows the speed you chose; it is still chosen after reload.

**Other users see**

- Not applicable: single user.

## UAT-SHEET-10: Sheet at phone width

- **Covers:** SHEET-1.1
- **Accounts:** P1
- **Preconditions:** Browser device toolbar set to 375 px wide (the phone preview mode in the browser developer tools).

**Steps**

1. **P1:** Sign in at 375 px and open UAT Dara's Sheet (UAT-BUILDER-1).
2. **P1:** Use the **Character sheet mobile pages** navigation to visit each page (overview, actions, spells or inventory, notes).
3. **P1:** Open **Manage hit points** and apply 1 damage, then heal 1.
4. **P1:** Open **Open manual dice roller** and roll a d20.
5. **P1:** Open **Open roll history**.
6. **P1:** Scroll each page to the bottom.

**Expected**

- No page needs horizontal scrolling and no control is cut off or overlapped.
- Every control you used is reachable with a thumb-sized target and the HP change is correct.
- The roll appears in roll history.

**Other users see**

- Not applicable: single user.

## UAT-SHEET-11: Sheet during live play and after reconnect

- **Covers:** SHEET-5.3
- **Accounts:** GM, P1
- **Preconditions:** Review: Party in the Field Encounter is active and P1 and GM both have the tabletop window open (Open tabletop window in the Live tabletop panel).

**Steps**

1. **P1:** Open Aria's Sheet in a second tab.
2. **P1:** Note Aria's hit points on the Sheet.
3. **GM:** In the tabletop window apply 2 damage to Aria through the Encounter actor controls.
4. **P1:** Watch the Sheet without reloading.
5. **P1:** In the browser developer tools Network panel choose "Offline" (this cuts the page's connection).
6. **GM:** While P1 is offline, apply 1 more damage to Aria.
7. **P1:** After about a minute switch the Network panel back to No throttling and wait for the page to reconnect without reloading.

**Expected**

- Step 4: the Sheet's hit points drop by 2 without a reload.
- After reconnect (step 7) the Sheet shows the further 1 point of damage; nothing is lost or applied twice.

**Other users see**

- **GM:** sees Aria's hit points change on the tabletop and no error from P1's reconnect.

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC        | Why not a UAT step                                                                   |
| --------- | ------------------------------------------------------------------------------------ |
| SHEET-5.1 | Two simultaneous Builder commits is a concurrency harness; not reproducible by hand. |
| SHEET-5.4 | Post-write failure rollback needs fault injection.                                   |
| SHEET-7.1 | Records read by a note edit is a storage measurement.                                |
