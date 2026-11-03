# Character Builder — UAT scenarios

Feature `BUILDER` in the [phase ledger](../../roadmap/08-phase-ledger.json). Set up first: [README](README.md#setup).

Proves a player can build a Character from choices, save and resume drafts, commit it to a playable Sheet, and that Characters stay playable and repair themselves when the content they use is changed or removed. Authoring itself is in [AUTHORING](AUTHORING.md). The Sheet on a phone is in the Sheet file.

## UAT-BUILDER-1: Build a Character for a review player, save, resume and commit

- **Covers:** BUILDER-1.1, BUILDER-1.3, BUILDER-2.2
- **Accounts:** P1, GM
- **Preconditions:** Review data built. Build a Character named "UAT Dara" for P1; P1 already has Aria and Ember (both are in review Campaigns, so "UAT Dara" is the free Character used for the Campaign scenarios).

**Steps**

1. **P1:** Open http://localhost:3000/characters and choose **Create Character**.
2. **P1:** Enter **Character Name** "UAT Dara" and choose a Race, a Class and a Background.
3. **P1:** Fill the ability scores (use the **Ability Method** the page offers) and pick the equipment choices.
4. **P1:** Choose **Save Character Draft**.
5. **P1:** Close the tab. Reopen http://localhost:3000/characters and find the draft; open it.
6. **P1:** Confirm your earlier choices are intact, then change the Background and save the draft again.
7. **P1:** Start a second Character, enter the name "UAT Throwaway", save the draft, then choose **Discard draft** and confirm.
8. **P1:** Back on "UAT Dara", go to the **Review** step.
9. **P1:** Read the status. If it says **Needs attention**, open the listed items and fix them until it says **Ready to activate**.
10. **P1:** Choose **Activate** to commit the Character.
11. **P1:** Open the new Character's Sheet.
12. **P1:** Reload the Sheet and check the Characters list.

**Expected**

- Step 4-6: the draft survives closing the tab and reopens with every choice; the draft list shows it as a draft, not a Character.
- Step 7: the discarded draft disappears and cannot be reopened.
- Step 9: **Ready to activate** appears only when nothing needs attention; committing before then is refused with the reason.
- Step 10-11: a Sheet opens with the chosen Race, Class and Background, correct ability scores, starting equipment in the inventory and hit points at maximum.
- Step 12: the Character is listed once under Characters and the draft is gone; the starting equipment is not added a second time on reload.

**Other users see**

- **GM:** After step 4 and after step 10, open Review: Party in the Field's Party panel: "UAT Dara" and the draft are not shown (P1's Character there is still Aria).

## UAT-BUILDER-2: Two windows on one draft cannot overwrite each other

- **Covers:** BUILDER-1.2, BUILDER-2.2
- **Accounts:** P1
- **Preconditions:** A saved draft exists (create a quick one named "UAT Race Condition" in the Builder and save it).

**Steps**

1. **P1:** Open the draft in window A and in window B (two tabs of the same account).
2. **P1:** In window A change the Character Name to "UAT RC One" and choose **Save Character Draft**.
3. **P1:** In window B (still showing the old version) change the name to "UAT RC Two" and choose **Save Character Draft**.
4. **P1:** Reload window B.
5. **P1:** Finish the draft in window A to **Activate** it.
6. **P1:** In window B (still open), try to **Activate** the same draft.
7. **P1:** Check the Characters list.

**Expected**

- Step 3: the save from the older window is refused with a message that a newer version exists; the draft keeps "UAT RC One".
- Step 4: window B now shows "UAT RC One".
- Step 5: the Character is created.
- Step 6: the second commit is refused because the draft was already consumed; no second Character is created.
- Step 7: exactly one "UAT RC One" Character exists.

**Other users see**

- Not applicable: single user.

## UAT-BUILDER-3: Choice-heavy builds — multiclass and spellcaster

- **Covers:** BUILDER-2.1
- **Accounts:** P2
- **Preconditions:** Review data built.

**Steps**

1. **P2:** In the Builder, start "UAT Multi": Fighter level 1.
2. **P2:** Use **Change class** or the Classes step to add Rogue as a second class and give each class its levels.
3. **P2:** Complete the remaining choices (**HP gained** and **Hit Point Method**, skills, equipment) and **Activate**.
4. **P2:** On the Sheet check the class line, hit dice, hit points and proficiencies.
5. **P2:** In the Builder start "UAT Cleric": Cleric with the Life domain.
6. **P2:** Choose spells to prepare and finish and **Activate**.
7. **P2:** On the Sheet open the spells, check the prepared list and slots, cast a leveled spell from the Sheet and watch the slot count.
8. **P2:** In the Builder start "UAT Dragon": a Dragonborn; choose the ancestry options and finish.
9. **P2:** On the Sheet check the breath weapon and resistance match the ancestry you chose.

**Expected**

- Step 4: the Sheet shows both classes with their levels, combined hit dice of both types, and proficiencies from the first class only where the rules say so.
- Step 7: the prepared spells match the choices; slots match the Cleric level; casting a spell lowers that slot by one.
- Step 9: ancestry-dependent features (damage type of the breath weapon, resistance) match your choice.
- Each build commits with no error and a clean Sheet.

**Other users see**

- Not applicable: single user.

## UAT-BUILDER-4: Removing content a Character uses repairs the Character

- **Covers:** BUILDER-3.1, BUILDER-3.2, BUILDER-3.3, AUTHORING-3.3, AUTHORING-7.2, AUTHORING-6.4
- **Accounts:** P1
- **Preconditions:** P1 has an active homebrew Feat "UAT Sharp Eyes" (create it as in [AUTHORING](AUTHORING.md)) and an active homebrew Background and Equipment item. Build a Character "UAT Reconcile" that takes the Feat, the Background and the Equipment, commit it, take some damage (leave hit points below maximum) and add a custom note to the inventory.

**Steps**

1. **P1:** Open "UAT Reconcile" on the Sheet and note the Feat's effect, the current hit points, the inventory and the URL.
2. **P1:** Open "UAT Sharp Eyes", edit a detail and **Activate** a new version (a replacement).
3. **P1:** Reopen "UAT Reconcile"'s Sheet and the Builder preview.
4. **P1:** Delete "UAT Sharp Eyes" from the Feat page.
5. **P1:** Open the Character list and the Sheet.
6. **P1:** Open the Character in the Builder and read the preview before changing anything.
7. **P1:** Choose **Activate** on the repaired Character.
8. **P1:** Open the Sheet again, then do the same with the Background and the Equipment (delete each, preview, activate).

**Expected**

- Step 3: the Character still works; the Sheet's URL, name, hit points and inventory are unchanged after the replacement.
- Step 5: the Character is marked as needing repair and the Sheet blocks play with a message that it needs repair.
- Step 6: the preview removes only the invalid grant (the missing Feat); everything else is kept.
- Step 7-8: committing returns the Character to Active; hit points (still damaged), the custom inventory note and the identity are unchanged. The Feat's effect, and later the Background's and Equipment's contributions, are gone from the Sheet; unrelated choices remain.

**Other users see**

- Not applicable: "UAT Reconcile" is in no Campaign, so no other account is involved. (Repair of a Character that is in a Campaign is UAT-BUILDER-5.)

## UAT-BUILDER-5: Withdrawing shared content reconciles assigned Characters

- **Covers:** BUILDER-3.4
- **Accounts:** P1, GM
- **Preconditions:** The sandbox Campaign from UAT-CAMPAIGN-2 (GM owner, P1 a member). Never remove P1 from a review Campaign: later scenarios need that membership. P1 has an active homebrew Feat "UAT Sharp Eyes" shared with the sandbox Campaign (share it as in UAT-AUTHORING-11, in the sandbox Campaign), and a Character "UAT Shared" built with that Feat. P1 assigns it with **Change Character** on the sandbox Campaign's Party panel in place of "UAT Dara".

**Steps**

1. **P1:** Confirm "UAT Shared" in the sandbox Campaign has the Feat on the Sheet.
2. **P1:** Remove the share of the Feat from the sandbox Campaign content list.
3. **P1:** Open the Character and check the Sheet and Builder preview.
4. **P1:** Use the Builder to commit the repair, or reassign the Character's content as the page offers.
5. **GM:** Reload the sandbox Campaign page.
6. **P1:** Share the Feat again (UAT-AUTHORING-11 step 2), then **GM:** use **Remove player** on P1 in the sandbox Campaign Party. **P1:** open "UAT Shared" and your Characters list.

**Expected**

- Step 3: the Character no longer holds the shared grant; the rest of its private state survives.
- Step 4: the Character returns to Active after the commit.
- Step 5: the Campaign shows no remnant of the withdrawn content.
- Step 6: P1's personal Characters keep everything except grants that came through the Campaign; nothing is left half-reconciled, and "UAT Shared" is released from the Campaign and still opens.

**Other users see**

- **GM:** Sees the Campaign content list without the Feat after step 2 and the Party without P1 after step 6. P2 is not involved.

## UAT-BUILDER-6: Imported custom items keep their kind, properties and damage

- **Covers:** BUILDER-4.1, BUILDER-4.2, BUILDER-4.3
- **Accounts:** P1
- **Preconditions:** Needs a source the owner supplies; none exists in the review data and a D&D Beyond link cannot be fetched without outside network access. P1 has a Foundry character JSON file (or a D&D Beyond public character link) that includes: an equipped custom two-handed or versatile weapon with a damage type and a magic bonus, an equipped custom armor with a magic bonus, and an equipped custom shield. If no such source is available, mark the scenario BLOCKED in the [tracker](TRACKER.md) and name the missing source in [Run notes](#run-notes). Step 7 needs a live target: use a Scene attack against a creature in a P1 Campaign, or record the Sheet's attack roll only.

**Steps**

1. **P1:** Open http://localhost:3000/library/import.
2. **P1:** Under **Choose a source** pick the source type, paste the character-sheet link (**Character-sheet links**) or choose the JSON file.
3. **P1:** Review the preview; for each custom item note the **Import choice** offered and import it.
4. **P1:** Open the imported Character's Sheet.
5. **P1:** Open the custom weapon, armor and shield in Equipment (http://localhost:3000/equipment).
6. **P1:** On the Sheet inventory check which hand holds the weapon and shield and what is worn.
7. **P1:** Make an attack with the custom weapon from the Sheet.

**Expected**

- The weapon is listed as a weapon (not generic gear) with its properties such as two-handed or versatile.
- The weapon attack uses the imported dice, damage type, ability modifier and magic bonus.
- The armor is listed as armor with its base AC, DEX rule and magic bonus; the shield as a shield; rarity shows when the System knows it.
- The equipped weapon and shield are in hands and the armor is worn; AC on the Sheet reflects them.

**Other users see**

- Not applicable: single user.

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC          | Why not a UAT step                                                                                                                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BUILDER-2.3 | Convex limits, per-edit call counts, autosave bytes, commit database I/O and worker chunk size; measured by a harness and the build, not visible on screen (the Builder working is UAT-BUILDER-1 and 3). |
| BUILDER-2.4 | Exact removal of test fixtures and stale-JWT denial; a test-harness property.                                                                                                                            |

## Run notes

One entry per failed, blocked or skipped run, newest first, linked from the [tracker](TRACKER.md). Use the scenario id as a `###` heading, then the date, the build (commit or staging build name), the tester, the step number and the details listed in [When a scenario fails](README.md#when-a-scenario-fails).
