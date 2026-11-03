# Content authoring — UAT scenarios

Feature `AUTHORING` in the [phase ledger](../../roadmap/08-phase-ledger.json). Set up first: [README](README.md#setup).

Proves a GM or player can browse the SRD, copy any locked SRD record into their own draft, edit, save, publish, duplicate and delete homebrew, keep drafts private from other accounts, share published homebrew with a Campaign, and that the authoring forms behave. Source loss reaching existing Characters is in [BUILDER](BUILDER.md). On publishing, the control is labelled **Activate** on most pages (some pages say Publish); use whichever the page shows.

## UAT-AUTHORING-1: Browse Game Systems and Rules Catalogues

- **Covers:** AUTHORING-1.1, AUTHORING-1.3, AUTHORING-1.4, AUTHORING-2.1, AUTHORING-8.2, AUTHORING-8.3, AUTHORING-9.4
- **Accounts:** GM
- **Preconditions:** Review data built.

**Steps**

1. **GM:** Open http://localhost:3000/systems and open the SRD System.
2. **GM:** Note any identifier, version or checksum the page shows. Reload and compare.
3. **GM:** Open the Rules Catalogue (or catalogues) on the System page. Page forward and back, then use the search and a category filter.
4. **GM:** Note the counts shown, apply a filter, and note the filtered count.
5. **GM:** Open http://localhost:3000/races. Count the SRD base Races listed, and find a Race that has subraces and confirm base Races and their subraces are grouped together.
6. **GM:** Open http://localhost:3000/spells. Page through the list, use the filters for level, school and Class, and search "Cure".
7. **GM:** Open a Spell, note its URL, then reload it. Copy the URL into a new tab.
8. **GM:** Look at the main navigation on the System page and on the Spells page.

**Expected**

- The System page loads and shows the same identity and checksum after reload.
- Catalogues page in both directions without repeating or skipping entries; changing search or filter returns you to the first page and the count matches what you see.
- Races lists a base Race with its subraces together, not as unrelated rows, and the SRD list is complete: it shows 13 Races as the seed records (record the number you see; a different count is a finding).
- Spell filters narrow the list and the count; the Spell opens at the same URL in a new tab.
- Navigation entries match the System's capabilities (only areas that System supports are shown).

**Other users see**

- Not applicable: single user.

## UAT-AUTHORING-2: SRD records are locked but can be copied into an owned draft

- **Covers:** AUTHORING-2.2, AUTHORING-12.1, AUTHORING-12.4, AUTHORING-14.2, AUTHORING-14.3, AUTHORING-15.1
- **Accounts:** GM
- **Preconditions:** Review data built; Authoring experience in Settings, Preferences is Guided (the default may differ: check **Authoring experience**).

**Steps**

1. **GM:** Open http://localhost:3000/backgrounds and open an SRD Background (for example Acolyte).
2. **GM:** Try to type into any field on the page.
3. **GM:** Look for any edit or delete controls.
4. **GM:** Choose **Duplicate to edit**.
5. **GM:** Note the new page: its URL, the name and the Draft badge. Edit the name to "UAT Acolyte Copy".
6. **GM:** Choose **Save Draft**, then reload.
7. **GM:** Go back to the SRD Acolyte and confirm it is unchanged.
8. **GM:** Repeat steps 1-4 for an SRD Creature (Wolf at http://localhost:3000/creatures) and an SRD Spell, without editing.
9. **GM:** In Settings, Preferences set **Authoring experience** to Advanced, then repeat step 4 on another Background.
10. **GM:** On each copy choose **Discard draft** so no clutter remains.

**Expected**

- Step 2-3: SRD fields cannot be edited and no Delete is offered for the SRD record.
- Step 4-5: a new Draft with a different URL (its own identity) opens, with the SRD contents copied in.
- Step 6: the edited name survives the reload and the draft reappears in your Background list marked as a draft.
- Step 7: the SRD Acolyte still has its original name and contents.
- Step 8: Wolf and Fireball (or any Spell) also offer only the copy action.
- Step 9: Guided and Advanced both lead to an editable owned copy; the page makes clear whether you are editing a copy, overriding, or creating new.
- Step 10: discarded drafts disappear from your list; the SRD records remain.

**Other users see**

- Not applicable: single user.

## UAT-AUTHORING-3: Background lifecycle — create, save, publish, replace, export, delete

- **Covers:** AUTHORING-3.1, AUTHORING-3.2, AUTHORING-12.2, AUTHORING-13.1, AUTHORING-13.2, AUTHORING-2.3, PLATFORM-21.1
- **Accounts:** P1, P2
- **Preconditions:** Review data built; two browser profiles.

**Steps**

1. **P1:** Open http://localhost:3000/backgrounds/new.
2. **P1:** Try to publish (**Activate**) with the name empty.
3. **P1:** Enter the name "UAT Wanderer", fill the required fields, and choose **Save Draft**.
4. **P1:** Reload, then go to http://localhost:3000/backgrounds and find your draft.
5. **P1:** Open it, change the description, and choose **Activate**.
6. **P1:** Confirm it now shows as Active/Published in the list and use the search box and filters to find it.
7. **P1:** Open it, edit the name to "UAT Wanderer II", save the draft, and make another change that is invalid (for example clear a required field).
8. **P1:** Try to **Activate** the invalid version.
9. **P1:** Fix the field and choose **Activate** again.
10. **P1:** Choose **Export JSON** on it.
11. **P1:** Choose Delete and confirm. Then look at the list.
12. **P1:** In a new draft, choose **Discard draft** and confirm.

**Expected**

- Step 2: publishing is refused with a message naming the missing required field; nothing becomes active.
- Step 4: your saved draft survives reload and is listed as a draft.
- Step 5-6: it becomes the Active version and appears in the list when searched and filtered.
- Step 8: the invalid draft is refused with a clear message, and the previously active "UAT Wanderer" is still the Active version everyone sees.
- Step 9: the corrected version replaces the old one atomically: the list shows "UAT Wanderer II" and the old name is gone.
- Step 10: a JSON file downloads.
- Step 11: the Background is deleted from the active list; if a draft exists it is kept or offered back, not silently lost.
- Step 12: the discarded draft is gone and the list returns.

**Other users see**

- **P2:** After step 3 and again after step 9, search Backgrounds for "UAT Wanderer": it never appears (a draft is private, and homebrew stays private until shared; see UAT-AUTHORING-11).

## UAT-AUTHORING-4: Author, publish and filter a homebrew Spell with artwork

- **Covers:** AUTHORING-9.1, AUTHORING-9.2, AUTHORING-9.3, AUTHORING-12.3, AUTHORING-4.1
- **Accounts:** P1
- **Preconditions:** Review data built; a small image on P1's computer.

**Steps**

1. **P1:** Open http://localhost:3000/spells/new.
2. **P1:** Name it "UAT Ember Dart", set a level (for example 1), a school, a casting time, and add the Wizard Class (or another SRD Class) to the Class list.
3. **P1:** Upload artwork, choose **Save Draft**, reload and confirm the artwork shows.
4. **P1:** Publish with **Activate**.
5. **P1:** Open the Active Spell for editing (this starts a new draft), upload a different image, then choose **Discard draft** and confirm. Open the Spell again.
6. **P1:** Open http://localhost:3000/spells, filter by the level, school, Class and casting time you chose and find "UAT Ember Dart".
7. **P1:** Change a filter so it should not match and confirm it disappears.
8. **P1:** Choose **Export JSON** on it.
9. **P1:** Choose **Duplicate**, name the copy "UAT Ember Dart Copy", and save the draft.
10. **P1:** Open the signed-out page http://localhost:3000/spells in a private window (not signed in).

**Expected**

- Step 3: the draft artwork survives reload.
- Step 5: the draft's image and the Active version's image are separate: discarding the new draft image leaves the first image on the Active Spell.
- Step 6: the Spell appears under every matching filter and the result count includes it; the row shows current labels for level, school and Class.
- Step 7: it no longer appears under a non-matching filter, with the count updated.
- Step 9: the copy opens as a new draft with a different URL and the same content; the original is unchanged.
- Step 10: the signed-out visit shows no homebrew and requires sign-in.

**Other users see**

- **P2:** Searching Spells for "UAT Ember" finds nothing (private homebrew).

## UAT-AUTHORING-5: Author a Class and see the Spell guard

- **Covers:** AUTHORING-4.3, AUTHORING-4.4, AUTHORING-4.1
- **Accounts:** P1
- **Preconditions:** UAT-AUTHORING-4 done (the Spell "UAT Ember Dart" is active and lists a Class).

**Steps**

1. **P1:** Open http://localhost:3000/classes/new.
2. **P1:** Name it "UAT Ember Mage", fill the required fields and choose **Save Draft**, then **Activate**.
3. **P1:** Open "UAT Ember Dart", add "UAT Ember Mage" to its Classes, save the draft and **Activate** again.
4. **P1:** Open the Class list and open "UAT Ember Mage".
5. **P1:** Try to delete "UAT Ember Mage".
6. **P1:** Remove the Class from the Spell, activate the Spell, then delete the Class again.
7. **P1:** Make a draft copy of the Class ("Duplicate") and choose **Discard draft**.

**Expected**

- Step 2-4: the Class is active, appears in the Class list, and is selectable on the Spell and in the Spell Class filter.
- Step 5: deletion is refused with a message naming that the Spell still refers to it; the Class stays.
- Step 6: with the reference removed, deletion succeeds and the Class disappears from the list and the Spell filter.
- Step 7: a copy opens as a draft and discards cleanly.

**Other users see**

- Not applicable: single user.

## UAT-AUTHORING-6: Creature copy, computed AC and the item loadout

- **Covers:** AUTHORING-5.1, AUTHORING-17.1, AUTHORING-17.2, AUTHORING-17.3
- **Accounts:** GM, P1
- **Preconditions:** Review data built. Step 9 needs a Campaign Encounter that accepts a new creature: if the already-running Encounter in Review: Party in the Field does not, create a new Scene and Encounter in it by hand (Heavy setup: build the Scene and Encounter).

**Steps**

1. **GM:** Open the SRD Wolf at http://localhost:3000/creatures and read its Armor Class and any natural armor line.
2. **GM:** Open the SRD Goblin and read its Armor Class and its loadout (main hand, off hand, carried, worn).
3. **GM:** Choose **Duplicate to edit** on the Goblin and name the copy "UAT Goblin".
4. **GM:** In the loadout, put a two-handed weapon in the main hand and try to also place a shield in the off hand.
5. **GM:** Replace the weapon with a one-handed weapon and keep the shield. Note the computed AC.
6. **GM:** Remove the shield. Note the AC.
7. **GM:** Set a +1 shield and note the AC again.
8. **GM:** Look for any field that sets a fixed Armor Class or an AC note.
9. **GM:** Choose **Save Draft** and **Activate**, then add UAT Goblin to an Encounter of Review: Party in the Field (see Preconditions).
10. **GM:** In that Encounter, change the instance's shield and watch its AC.

**Expected**

- Wolf shows AC 13 (10 + 2 Dex + 1 natural). Goblin shows 15 (leather armor, shield), matching its stat block.
- Step 4: the form refuses or clears the off hand when a two-handed weapon is in the main hand.
- Step 5-7: the AC recomputes from what is worn and held: no shield lowers it by 2; the +1 shield raises it by 1 over a plain shield.
- Step 8: there is no free-text AC field; AC is computed.
- Step 9: the Encounter creature copies the authored loadout.
- Step 10: changing or removing the instance's shield changes only that instance's AC, not the authored UAT Goblin.

**Other users see**

- **P1:** In the live table the instance's AC shows the changed value after step 10.

## UAT-AUTHORING-7: Equipment variants, inheritance and item names

- **Covers:** AUTHORING-6.1, AUTHORING-6.2, AUTHORING-13.3, AUTHORING-16.1, AUTHORING-16.2
- **Accounts:** P1, P2
- **Preconditions:** Review data built; two browser profiles.

**Steps**

1. **P1:** Open http://localhost:3000/equipment, search "Healer" and open the SRD item.
2. **P1:** Read its name and look for its uses/charges.
3. **P1:** Search "Arrows", "Crossbow Bolts", "Sling Bullets", "Blowgun Needles", "Iron Spikes" and read each name and price.
4. **P1:** Duplicate the SRD Longsword to a draft, name it "UAT Blade", and **Activate** it.
5. **P1:** Create a variant of "UAT Blade" named "UAT Blade +1" that inherits from it and adds a bonus; **Activate** it.
6. **P1:** Edit "UAT Blade" (change the damage dice) and **Activate** the new version.
7. **P1:** Open "UAT Blade +1" and look at its damage.
8. **P1:** Try to delete "UAT Blade" while the variant exists.
9. **P1:** Delete the variant first, then the base.

**Expected**

- Step 1-2: the item is named "Healer's Kit" with no number in the name; its 10 uses appear as charges.
- Step 3: names carry no bundle counts (for example "Arrows", not "Arrows (20)"); price is per piece.
- Step 5-7: the variant inherits the base; after the base is republished the variant shows the new damage dice without being edited.
- Step 8: deletion of the base is refused naming the published variant.
- Step 9: deletion succeeds in that order.

**Other users see**

- **P2:** Searching Equipment for "UAT Blade" finds nothing at any point.

## UAT-AUTHORING-8: Author a Feat, a Race and a Vehicle

- **Covers:** AUTHORING-7.1, AUTHORING-8.1, AUTHORING-10.1, AUTHORING-5.1
- **Accounts:** P1, P2
- **Preconditions:** Review data built; two browser profiles.

**Steps**

1. **P1:** Open http://localhost:3000/feats/new; create "UAT Sharp Eyes", save the draft, reload, then **Activate**.
2. **P1:** Search Feats for it, **Export JSON**, then **Duplicate** it and **Discard draft** on the copy.
3. **P1:** Open http://localhost:3000/races/new; create "UAT Dwarf Line", save and **Activate**.
4. **P1:** Create a subrace of it, "UAT Dwarf Line Hill", that inherits from "UAT Dwarf Line" and **Activate** it.
5. **P1:** Edit "UAT Dwarf Line", change one trait, **Activate**, then open the subrace and check the trait.
6. **P1:** Try to delete "UAT Dwarf Line" while the subrace exists.
7. **P1:** Open http://localhost:3000/vehicles/new; create "UAT Cart", save, **Activate**, upload artwork, and **Export JSON**.
8. **P1:** Delete the Vehicle.

**Expected**

- Feats, Races and Vehicles each save as a draft, survive reload, and become active on **Activate**; exports download JSON.
- The subrace shows the changed parent trait after the parent is republished.
- Deleting a parent Race that has a published subrace is refused; deleting the subrace first works.
- The deleted Vehicle disappears from the list.

**Other users see**

- **P2:** None of these appears in P2's Feats, Races or Vehicles lists.

## UAT-AUTHORING-9: Reusable effects, grants and modifiers on a System

- **Covers:** AUTHORING-11.1, AUTHORING-11.2, AUTHORING-11.3, AUTHORING-11.4
- **Accounts:** GM, P1
- **Preconditions:** Review data built. The GM can author System definitions: if the page offers no create control to this account, stop and report.

**Steps**

1. **GM:** Open http://localhost:3000/systems and the SRD System, then find **Reusable definitions**.
2. **GM:** Page through the list with **Next definitions page** and **Previous definitions page**; use **Definition family** to see the seven families.
3. **GM:** Under **Create reusable definition**, choose one family, enter a **Label** and a description, and create it.
4. **GM:** Edit its **Reusable definition document**, save, and reload.
5. **GM:** Open the same definition in a second browser tab, change the label there and save.
6. **GM:** In the first tab (still on the older version), try to save and publish.
7. **GM:** Reload the first tab and publish.

**Expected**

- Step 2: all seven families exist and the list pages without repeats; compiler-generated Effect actions are not listed.
- Step 3-4: the new definition is an owner-private draft with one current publication; your local edits are kept if the list refreshes in the background.
- Step 6: the stale save/publish is refused with a message about a newer version; nothing is overwritten.
- Step 7: after reload the newer content appears and publishing succeeds.

**Other users see**

- **P1:** After step 4, open the SRD System's **Reusable definitions** list: the GM's draft definition is not listed.

## UAT-AUTHORING-10: Another account cannot see or edit your drafts

- **Covers:** AUTHORING-15.1, AUTHORING-12.1
- **Accounts:** P1, P2, GM
- **Preconditions:** Review data built; two browser profiles.

**Steps**

1. **P1:** Open http://localhost:3000/backgrounds/new, name it "UAT Private Draft", **Save Draft**.
2. **P1:** Copy the draft's page URL from the address bar.
3. **P2:** Paste the same URL into P2's browser.
4. **P2:** Append `/edit` if the page has no edit form, and try again.
5. **P2:** Search Backgrounds for "UAT Private Draft".
6. **GM:** Repeat steps 3 and 5.
7. **P1:** **Activate** the Background so it is published but still private.
8. **P2:** Repeat steps 3-5.
9. **P2:** Open the SRD Acolyte and look for any delete or direct edit control.
10. **P1:** Delete "UAT Private Draft".

**Expected**

- Step 3-6: P2 and the GM see not-found/unavailable, never the draft's contents, and cannot save or delete.
- Step 8: a published private homebrew is still invisible to P2 and the GM.
- Step 9: SRD records offer P2 only the copy action.
- Step 10: P1 can delete their own record.

**Other users see**

- **P2 / GM:** Nothing of the draft or its content at any time.

## UAT-AUTHORING-11: Share homebrew with a Campaign, then withdraw it

- **Covers:** AUTHORING-15.2, AUTHORING-15.3, AUTHORING-2.2
- **Accounts:** P1, P2, GM
- **Preconditions:** UAT-AUTHORING-4 done (active homebrew Spell "UAT Ember Dart" owned by P1). P1 is a member of Review: Party in the Field and Review: Shield and Hold, but not Review: Fire and Thunder.

**Steps**

1. **P1:** Open the Campaign page of Review: Party in the Field and find **Campaign content**.
2. **P1:** Under **Share owned homebrew**, set **Content type** to Spell, pick **Owned homebrew** "UAT Ember Dart", and choose **Share**.
3. **P2:** Open the same Campaign page and look at **Campaign content**.
4. **GM:** Do the same.
5. **P1:** Open "UAT Ember Dart", edit the description, and **Activate** the new version.
6. **P2:** Reload **Campaign content** and open the shared Spell.
7. **P2:** Look for a way to remove the share (it was shared by P1).
8. **GM:** Look for a way to remove the share.
9. **P1:** Remove the share (the unshare control next to the entry).
10. **P2:** Reload **Campaign content**.
11. **P1:** Open the Campaign page of Review: Fire and Thunder (P1 is not a member).
12. **P1:** Back on Review: Party in the Field, open **Share owned homebrew**, set **Content type** to Background, and look at **Owned homebrew**: P1 has an unpublished draft if UAT-AUTHORING-3 left one, otherwise create a draft Background first.

**Expected**

- Step 3-4: P2 and the GM see the shared Spell as "Shared by" P1; the **Share owned homebrew** panel is available only to members who own homebrew.
- Step 6: the shared entry now shows the new description after P1 republished.
- Step 7-8: only P1 (the recorded author) can remove the share; other users see no remove control or are refused.
- Step 10: the entry is gone for P2.
- Step 11: P1 is refused or the Campaign is not listed for P1; no share panel is offered.
- Step 12: only active homebrew appears in **Owned homebrew**; the draft Background does not.

**Other users see**

- **P2 / GM:** See above. (Maturity masking of shared content is not exercised here; it is an unverified part of AUTHORING-15.2.)

## UAT-AUTHORING-12: Option descriptions and adding a Check and a DC

- **Covers:** AUTHORING-18.1, AUTHORING-19.1, AUTHORING-20.1
- **Accounts:** P1
- **Preconditions:** Review data built; Authoring experience set to Advanced for step 4.

**Steps**

1. **P1:** Open http://localhost:3000/creatures/new and find a field with System options such as speeds, senses, damage types, skills or abilities.
2. **P1:** Hover (or focus) several options in the dropdown and read the tooltip.
3. **P1:** Do the same for damage types and for proficiencies on a new Spell or Class.
4. **P1:** In the Spell editor, open the mechanics/effects section and add an invocation **Check**; then add a **DC** to that Check.
5. **P1:** Save the draft and reload.
6. **P1:** Discard the draft.

**Expected**

- Step 2-3: each System option shows a tooltip with the description of that option (not blank, not a raw code).
- Step 4: adding a Check and a DC each creates a filled-in default row ready to edit, without an error.
- Step 5: the added rows survive the reload.

**Other users see**

- Not applicable: single user.

## UAT-AUTHORING-13: Author a Fire Bolt-like cantrip from scratch

- **Covers:** none of the registered ACs. This is an authoring-effort check: it measures how hard a real effect is to build, and it complements AUTHORING-9.1 to 9.3.
- **Accounts:** P1
- **Preconditions:** Review data built; **Authoring experience** in Settings, Preferences is **Advanced**. Do not copy the SRD Fire Bolt: build from the blank form so the effort is measured. Keep the SRD Fire Bolt page open in a second tab as the reference. A stopwatch is running (see the recording lines below).

**Steps**

1. **P1:** Start the timer. Open http://localhost:3000/spells/new.
2. **P1:** Under Basics, enter the **Name** "UAT Fire Bolt Copy" and a **Description** (paste the SRD text or write your own). Set **Level** to Cantrip, **Magic School** to Evocation, and add Sorcerer and Wizard to **Classes**. Under Casting, set **Casting Time** to 1 action and tick the Verbal and Somatic **Components**.
3. **P1:** Under Effects, add one effect (the **Add effect** button). In **How It Starts** set **Kind** to Action, **Trigger** to Ranged Spell Attack, and **Activation** to Action with **Amount** 1.
4. **P1:** Under **Range** set **Range Kind** to Distance, **Amount** 120, **Unit** Feet. Under **Targeting** set **Target Selection** to Single Target and **Target Eligibility** to Any valid target.
5. **P1:** Under **Outcome Paths** add one path. Set **Outcome Path** to On Hit, **Outcome Group** to Single, **Selection Model** to Direct and **Starts From** to Source.
6. **P1:** In the path's **Result**, set **Outcome Type** to Single, then add one outcome. Set **Effect Kind** to Damage, **Damage Type** to Fire, **Value Kind** to Dice, **Scaling Kind** to Per Level and **Scaling Source** to Character Level.
7. **P1:** In the outcome's **Levels** table add four rows: **Level** 1 with **Damage Dice** `1d10`, level 5 with `2d10`, level 11 with `3d10`, level 17 with `4d10`.
8. **P1:** Choose **Save Draft**, reload, and confirm every value is still set.
9. **P1:** Choose **Activate**. Stop the timer.
10. **P1:** Open the published "UAT Fire Bolt Copy" in the reader view (its detail page) in one tab and the SRD **Fire Bolt** in another. Compare them side by side: casting time, range, attack, damage, scaling levels and Classes.
11. **P1:** Record the time taken and the 1-5 difficulty rating (below), then **Discard draft** or delete the Spell to leave no clutter.

**Expected**

- Step 2-7: every field above exists in the Advanced form under the label given. Fields that do not apply to the chosen Trigger or Effect Kind stay hidden rather than erroring.
- Step 8: the draft survives the reload with all four scaling rows.
- Step 9: **Activate** succeeds without a validation message; if one appears, record its exact wording as a confusion point.
- Step 10: the reader view of the copy matches the SRD Fire Bolt on every mechanical line (ranged spell attack, 120 feet, 1d10 fire, 2d10 at level 5, 3d10 at 11, 4d10 at 17, Sorcerer and Wizard). Wording of the description may differ.

**Other users see**

- **P2:** Searching Spells for "UAT Fire Bolt" finds nothing (private homebrew).

**Record** (in [Run notes](#run-notes), whatever the result): time from step 1 to step 9 (minutes), difficulty 1 (trivial) to 5 (could not finish without help), the step where you hesitated longest, and any value you could not find.

## UAT-AUTHORING-14: Author a Fireball-like spell from scratch

- **Covers:** none of the registered ACs. Authoring-effort check, as UAT-AUTHORING-13.
- **Accounts:** P1
- **Preconditions:** Review data built; **Authoring experience** is **Advanced**. Build from the blank form, not from a copy. Keep the SRD **Fireball** open in a second tab as the reference. A stopwatch is running.

**Steps**

1. **P1:** Start the timer. Open http://localhost:3000/spells/new.
2. **P1:** Under Basics, enter the **Name** "UAT Fireball Copy" and a **Description**. Set **Level** to Level 3, **Magic School** to Evocation, and add Sorcerer and Wizard to **Classes**. Set **Casting Time** to 1 action and tick Verbal, Somatic and Material **Components**.
3. **P1:** Under Effects, add one effect. In **How It Starts** set **Kind** to Action and **Trigger** to Saving Throw. In **Saving Throw** set **DC Method** to the option that uses the caster's spell save DC, and **Save Ability** to Dexterity. Set **Activation** to Action with **Amount** 1.
4. **P1:** Set **Range** to Distance, **Amount** 150, **Unit** Feet. Set **Shape Kind** to Sphere with **Radius** **Amount** 20, **Unit** Feet. Set **Target Selection** to Area Contents and **Target Eligibility** to Any valid target.
5. **P1:** Under **Outcome Paths** add a first path: **Outcome Path** On Save Failure, **Outcome Group** Single, **Selection Model** Direct, **Starts From** Source. In its **Result** set **Outcome Type** Single and add an outcome: **Effect Kind** Damage, **Damage Type** Fire, **Value Kind** Dice, **Scaling Kind** Per Level, **Scaling Source** Spell Cast Level.
6. **P1:** In that outcome's **Levels** table add seven rows: **Level** 3 with **Damage Dice** `8d6`, then 4 with `9d6`, 5 with `10d6`, 6 with `11d6`, 7 with `12d6`, 8 with `13d6`, 9 with `14d6`.
7. **P1:** Add a second path: **Outcome Path** On Save Success, with the same Group, Selection Model and Starts From. Add an outcome with the same Effect Kind, Damage Type, Value Kind, Scaling Kind and Scaling Source, and set **Amount Modifier** to Half.
8. **P1:** In the second outcome's **Levels** table enter the same seven rows again (levels 3 to 9, `8d6` to `14d6`).
9. **P1:** Choose **Save Draft**, reload, then **Activate**. Stop the timer.
10. **P1:** Open the published copy in the reader view beside the SRD **Fireball** and compare casting time, range, area, save, damage on a failed save, damage on a successful save, and the upcast table.
11. **P1:** Record the time taken and the difficulty rating, then delete the Spell.

**Expected**

- Step 3-8: each field exists in the Advanced form under the label given.
- Step 7-8 (expected behaviour, not a failure): the second path asks you to restate the full seven-row level table, because half damage on a save is a modifier on a separate path with its own table, not a derived value. The "+1d6 per slot above 3rd" rule is also entered as seven written-out rows, not as one rule. Note how long these two steps took and whether you made a typo in the second table. Deriving both is a known candidate improvement (authoring audit), not part of this scenario.
- Step 9: the copy activates, with the same totals the SRD Fireball has.
- Step 10: the reader view of the copy matches Fireball on every mechanical line: DEX save, 20-foot sphere, 150 feet, 8d6 on a failed save, half on a success, 9d6 at 4th level up to 14d6 at 9th.

**Other users see**

- **P2:** Searching Spells for "UAT Fireball" finds nothing.

**Record**: time from step 1 to step 9, difficulty 1 to 5, the time spent on steps 7 and 8 alone, and every typo or mismatch you had to correct between the two tables.

## UAT-AUTHORING-15: Author an Empowered Spell-like feature that spends a resource pool

- **Covers:** AUTHORING-21.1, AUTHORING-21.2 (once AUTHORING-21 merges); also an authoring-effort check.
- **Accounts:** P1
- **Preconditions:** Review data built; **Authoring experience** is **Advanced**. **Blocked until AUTHORING-21 merges**: the link between the modifier and its pool is changing from a typed Charge ID to a picker, and this scenario is written against the picker. Keep the SRD Sorcerer's **Empowered Spell** feature open as the reference (Classes, Sorcerer, Metamagic). A stopwatch is running.

**Steps**

1. **P1:** Start the timer. Open http://localhost:3000/feats/new and enter the **Name** "UAT Empowered Copy" and a **Description** (paste the SRD Empowered Spell text or write your own).
2. **P1:** Under **Charges** define the pool the feature spends, a stand-in for sorcery points: choose a **Limit Kind** (for example Fixed amount, with a number of points) and a **Reset Kind** of Long Rest.
3. **P1:** Under Effects, add one effect. In **How It Starts** set **Kind** to Passive and **Trigger** to Activated.
4. **P1:** In **Cast Modifier**, choose the pool from the **Resource pool** list (the pool from step 2, listed under the Feat's name). Set **Cost** to 1. In **Rerolls damage dice after the roll** set **Damage dice rerolled** to 0, **Plus the modifier of** to Charisma, and **At least** to 1.
5. **P1:** Under **Outcome Paths** add one path: **Outcome Path** On Use, **Outcome Group** Single, **Selection Model** Direct. In its **Result**, add an outcome with **Effect Kind** Manual Adjudication, a **Reason** of your choice, and **Instructions** such as "The chosen damage dice are rolled again, and the new rolls stand."
6. **P1:** Choose **Save Draft**, reload, confirm the pool is still selected in **Cast Modifier**, then **Activate**. Stop the timer.
7. **P1:** Open the published copy in the reader view beside the SRD Empowered Spell and compare: the cost (1 point), the Charisma-based reroll count with a minimum of one, and the pool it spends.
8. **P1:** Rename the Feat (a pool is listed under its owner's name), **Activate** again, and reopen the Cast Modifier.
9. **P1:** Record the time taken and the difficulty rating, then delete the Feat.

**Expected**

- Step 4: the pool is chosen from a list, not typed as an ID; a feature with no pool defined offers an empty list rather than a free-text box. If the picker does not list the Feat's own pool (the SRD defines the pool on the Class, under Resource, Charges), record that; building a homebrew Class to hold the pool is the fallback and counts toward the time.
- Step 6: the chosen pool survives the reload and the feature activates.
- Step 7: the copy and the SRD Empowered Spell agree on cost, reroll count and minimum, and both name the pool they spend.
- Step 8: the Cast Modifier still points at the same pool, now shown under the Feat's new name.

**Other users see**

- **P2:** Searching Feats for "UAT Empowered" finds nothing.

**Record**: time from step 1 to step 6, difficulty 1 to 5, and whether you found the pool link without help.

## Authoring feedback

Each tester fills this in once, after the authoring scenarios they ran (UAT-AUTHORING-13 to 15, plus any other authoring scenario). Write it in [Run notes](#run-notes) under a `### Authoring feedback - <tester> - <YYYY-MM-DD>` heading, with the commit or staging build, the table below and an answer to each question. Answer in your own words; short answers are fine, and "none" is a valid answer.

| Scenario         | Time taken (minutes) | Difficulty (1 = trivial, 5 = could not finish unaided) |
| ---------------- | -------------------- | ------------------------------------------------------ |
| UAT-AUTHORING-13 |                      |                                                        |
| UAT-AUTHORING-14 |                      |                                                        |
| UAT-AUTHORING-15 |                      |                                                        |

1. **Guided and Advanced.** Which mode felt easier for the things you built? Did you switch between them, and if so at which step and why (the Guided header offers **Switch to advanced**; Settings, Preferences changes the default)?
2. **Where you got stuck.** List each place you stopped or asked for help, the page or section it was on, and how you got unstuck.
3. **Fields you did not understand.** List the field labels whose meaning or effect you could not tell, even if you filled them in by guessing.
4. **Starting point.** For the next effect you build, would you rather copy an existing effect, start from a template, or build from scratch? Say why, and say if it depends on the kind of effect.
5. **Visual node-graph editor.** Imagine building the same effect on a canvas of connected boxes (a node graph) instead of the form. Would that have helped, made it harder, or made no difference? Say why, and for which of the three scenarios.
6. **Anything else** that cost you time or that you expected to find and did not.

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC             | Why not a UAT step                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTHORING-1.2  | Fail-closed handling of malformed, corrupt or unavailable Systems; needs deliberately corrupted stored data that a tester cannot create.                |
| AUTHORING-1.5  | Neutral second-System tracers and documentation; no second System exists to browse.                                                                     |
| AUTHORING-4.2  | Canonical replay, index repair and managed backfill of all 1,057 roots; a seed and repair audit.                                                        |
| AUTHORING-5.2  | Canonical Creature import audit across the corpus (compilation, identity, rollback); a seed audit. SRD Creatures are browsed in UAT-PLATFORM-1.         |
| AUTHORING-6.3  | Canonical Equipment import including the 500-item inheritance ceiling and unordered parents; a seed audit.                                              |
| AUTHORING-10.2 | Canonical Vehicle import audit (compilation, checksums, rollback of conflicts) across the corpus; a seed audit. Vehicles are browsed in UAT-PLATFORM-1. |
| AUTHORING-14.1 | Clone conformance over all 1,057 canonical records; a corpus-scale test. One copy per domain is exercised by hand in UAT-AUTHORING-2 and 3.             |

## Run notes

One entry per failed, blocked or skipped run, newest first, linked from the [tracker](TRACKER.md). Use the scenario id as a `###` heading, then the date, the build (commit or staging build name), the tester, the step number and the details listed in [When a scenario fails](README.md#when-a-scenario-fails).
