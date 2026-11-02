# Campaigns — UAT scenarios

Feature `CAMPAIGN` in the [phase ledger](../../roadmap/08-phase-ledger.json). Set up first: [README](README.md#setup).

Proves a GM can create, run, copy, archive and delete a Campaign, bring players in and take them out, share content and party gear, post announcements and play a Character of their own, and that players only ever see what the GM has made visible to them. Accounts: [README](README.md#accounts). Several windows: [README](README.md#running-several-users-side-by-side). Record results: [README](README.md#recording-results).

## UAT-CAMPAIGN-1: Create, edit, copy, archive and delete a Campaign

- **Covers:** CAMPAIGN-1.1, CAMPAIGN-1.2
- **Accounts:** GM
- **Preconditions:** Review data loaded. Do not touch the three Review Campaigns in this scenario; make your own.

**Steps**

1. **GM:** Open **Campaigns** and choose **Create a Campaign** (or **Start your first table**).
2. **GM:** Enter a **Campaign name** such as "UAT Sandbox", a description, choose a **Game System** and create it.
3. **GM:** On the new Campaign page open **Settings**, change the description, and wait for "Saved.".
4. **GM:** Open the notes area, add a notes section called "Plot" with one line of text.
5. **GM:** Choose **Copy Campaign**. Leave the notebook content unticked, create the copy, and open it.
6. **GM:** Go back to the original and copy it again, this time ticking **Notebook content to copy** for the "Plot" section.
7. **GM:** Open each copy and compare name, description and notes.
8. **GM:** On the original Campaign, archive it. Open the archive list (**View archive**) and confirm it is there.
9. **GM:** Try to edit the archived Campaign.
10. **GM:** Delete the first copy (the one without notes) and wait for **Campaign deleted.** Keep the second copy (with the "Plot" section) for the later scenarios.
11. **GM:** Reload **Campaigns** and check the active list and the archive list.

**Expected**

- The new Campaign is listed on **Campaigns** and opens with the name and description you gave.
- The first copy has the same game metadata (name pattern, description) but no notes; the second copy has the "Plot" section too.
- The archived Campaign is read-only ("This Campaign is read-only.") and moves from the active list to the archive.
- The deleted copy is gone after a reload; deletion shows progress and then disappears. The second copy and the archived original remain.

**Other users see**

- Not applicable: single user.

## UAT-CAMPAIGN-2: Invite, accept, leave, remove, rejoin and transfer

- **Covers:** CAMPAIGN-2.3, CAMPAIGN-2.4, CAMPAIGN-2.5
- **Accounts:** GM, P1, P2
- **Preconditions:** The second copy from UAT-CAMPAIGN-1 (called the sandbox Campaign from here on). Never use a Review Campaign: leaving or removal would break the review data. P1 needs a Character that is in no Campaign (Aria and Ember are already in review Campaigns, and a Character can be in only one Campaign): use "UAT Dara" from UAT-BUILDER-1, or build a quick one. Inviting uses the in-app invitation list; email is not readable locally (gap G1). Ownership transfer to P1 needs P1's Free plan to be able to host another Campaign: if it cannot, step 12 is refused with a plan message (that is the refusal half of CAMPAIGN-2.4) and steps 13-15 are BLOCKED.

**Steps**

1. **GM:** Open **Social** and create a listing for the Campaign, or open P1's profile and use the invite action to invite **Review_Pl_Aria** to the sandbox Campaign.
2. **P1:** Open **Social**, go to **Received invitations**, and accept the invitation.
3. **GM:** Repeat the invite for P2 and have **P2** accept.
4. **P1:** Open the sandbox Campaign, choose **Add Character** and assign "UAT Dara" (not Aria).
5. **P1:** Choose **Leave Campaign** and confirm.
6. **P1:** Try to open the Campaign's address again.
7. **GM:** Open the Campaign **Party** and check that P1's Character and seat are gone.
8. **GM:** Invite P1 again; **P1:** accept it and rejoin.
9. **GM:** On the Party, choose **Remove player** for P2 and confirm.
10. **P2:** Reload any open Campaign page.
11. **GM:** Re-invite P2; **P2:** accept again.
12. **GM:** In Settings, start an ownership transfer to P1.
13. **P1:** Accept the ownership offer.
14. **P1 (now GM):** Check that Settings and Manage controls are available; **GM (now player):** check they are gone.
15. **P1:** Transfer ownership back to the original GM, and **GM:** accept.

**Expected**

- After leaving or removal the player cannot open the Campaign ("Campaign membership is no longer available." or an access message) and the seat and Character assignment are released.
- Rejoining works and starts clean; nothing from before returns automatically.
- Ownership transfer needs acceptance within seven days, and fails with a clear message if the new owner's plan cannot host another Campaign. After a successful transfer roles switch immediately and the old owner is a Player.

**Other users see**

- **P2:** after removal (step 10) sees an access-lost message and does not see the Party, chat or notes of the Campaign.
- **P1 and P2:** never see the GM-only Campaign settings before a transfer (check at steps 4 and 8).

## UAT-CAMPAIGN-3: Players see only what the GM made visible

- **Covers:** CAMPAIGN-2.1, CAMPAIGN-2.2
- **Accounts:** GM, P1, P2
- **Preconditions:** Review: Party in the Field; GM and P1 and P2 are members.

**Steps**

1. **GM:** Open Review: Party in the Field and the notes area.
2. **GM:** Create a GM note and leave it private (not shared with the party). Create a second note and mark it **Shared with party**.
3. **P1:** Open the same Campaign and its notes.
4. **P2:** Open the Campaign and its notes.
5. **P1:** Open Aria's Sheet from the Campaign and add a private note on the Sheet.
6. **GM:** Open Aria's Sheet from the Campaign Party.
7. **P1:** Open Bryn's Sheet address in P1's window (copy it from P2).

**Expected**

- P1 and P2 see the shared note, written by the GM, without internal attribution fields; they do not see the private note.
- Step 6: the GM sees Aria's Sheet as the GM does but cannot read the private note P1 added to the Sheet, if the Sheet marks it private.
- Step 7: P1 is refused Bryn's Sheet unless Bryn has Party can view on.

**Other users see**

- **P2:** must NOT see the GM's private note, P1's private Sheet note, or Aria's Sheet unless its owner enabled Party can view.

## UAT-CAMPAIGN-4: Campaign content, sources and removals

- **Covers:** CAMPAIGN-3.1, CAMPAIGN-3.2, CAMPAIGN-3.3, CAMPAIGN-3.4, CAMPAIGN-3.5
- **Accounts:** GM, P1
- **Preconditions:** The sandbox Campaign from UAT-CAMPAIGN-2 with P1 as a member and "UAT Dara" assigned (the GM is the owner again after step 15; if ownership could not be transferred, nothing changed). The GM owns one homebrew Spell and one homebrew Race (create them under Spells and Races first, with the New control).

**Steps**

1. **GM:** Open the Campaign **Settings** and read **Primary Rules Catalogue** and **Additional Rules Catalogues**.
2. **GM:** Add the homebrew Spell's parent source (if the Spell is built on an official Spell, share the parent first) so the homebrew Spell is available in this Campaign.
3. **GM:** Reload the Settings page and check that the share persisted.
4. **P1:** Open the Builder for a new Character in this Campaign and check which content is offered.
5. **GM:** Open Campaign **Content** and try to share the homebrew Spell without its parent source being shared, if you skipped that in step 2. (A share from a different Game System cannot be tried: only one Game System exists locally.)
6. **P1:** Build a Character that uses the homebrew Spell and, on the Campaign Party panel, choose **Change Character** to assign it in place of "UAT Dara".
7. **GM:** Try to remove the homebrew Spell from the Campaign.
8. **P1:** Choose **Change Character** and put "UAT Dara" back. **GM:** Then remove the Spell from the Campaign.
9. **GM:** Reload the Settings page.
10. **GM:** In Settings, change the text presentation option (for example mature content wording) if offered, then view a shared item as P1 and as yourself.

**Expected**

- Settings changes save with a "Saved." message and persist on reload.
- A homebrew item without its parent source is refused with a message naming the missing parent (step 5, or step 2 if you try the share before the parent).
- Removing a source still used by a Character, draft or optional combat definition is refused and names what uses it. After the Character no longer uses it, the removal works and stays removed after reload.
- Text presentation applies to the shared copies; private notes keep their original text.

**Other users see**

- **P1:** sees the added content in the Builder and in the Campaign; does NOT see content the GM has not shared, nor GM-only Settings.

## UAT-CAMPAIGN-5: Party inventory and Vehicles

- **Covers:** CAMPAIGN-4.1, CAMPAIGN-5.1
- **Accounts:** GM, P1
- **Preconditions:** The sandbox Campaign from UAT-CAMPAIGN-2 with P1 as a member and "UAT Dara" assigned. A Vehicle exists to choose (Vehicles menu) or the GM creates one.

**Steps**

1. **GM:** Open the Campaign **Inventory** area and add an item and some currency to the party inventory.
2. **P1:** Open the Campaign and view the party inventory.
3. **P1:** Move an item from your Character's inventory to the party inventory, then move one back.
4. **GM:** Create a Vehicle for the Campaign by choosing a Vehicle definition.
5. **GM:** Place cargo in the Vehicle from the party inventory.
6. **GM:** Mark the Vehicle unavailable, then restore it.
7. **GM:** Return the cargo, then destroy the Vehicle.
8. **P1:** Reload and check where the cargo is.

**Expected**

- Movement between a Character, the party inventory and the Vehicle never creates or loses an item or coin; totals before equal totals after.
- Cargo in an unavailable or destroyed Vehicle is returned to a valid place, never lost.
- Players see the party inventory but not any GM-private inventory entries.

**Other users see**

- **P1:** sees party inventory and Vehicles the GM made visible; must NOT see GM-private or audit-only entries.

## UAT-CAMPAIGN-6: Announcements

- **Covers:** CAMPAIGN-6.1, CAMPAIGN-6.2, CAMPAIGN-6.3
- **Accounts:** GM, P1, P2
- **Preconditions:** Review: Party in the Field for steps 1-5; the sandbox Campaign from UAT-CAMPAIGN-2 (P1 a member) and the archived original from UAT-CAMPAIGN-1 for steps 6-8. P1 leaves only the sandbox Campaign, never a review Campaign. Email delivery cannot be read (gap G1); check the in-app notification only.

**Steps**

1. **P1 and P2:** Open the notifications page (**Notifications**) in each window and note the unread count.
2. **GM:** Open the Campaign's **Announcements** and write an announcement targeted at the whole table. Publish it.
3. **P1:** Open Notifications and the Campaign Announcements list.
4. **GM:** Write a second announcement for the party only (if the Party target is offered) and publish it.
5. **GM:** Retry publishing the same announcement by pressing the publish control twice quickly.
6. **GM:** Open the archived original Campaign from UAT-CAMPAIGN-1 and try to publish an announcement in it.
7. **P1:** Open a deep link to an announcement that is not available (edit one character of an announcement address copied from the list).
8. **GM:** In the sandbox Campaign publish an announcement. **P1:** Confirm it appears, then choose **Leave Campaign** and try to open the sandbox announcement list and the announcement address.

**Expected**

- The table announcement appears for P1 and P2 in the Campaign announcements list and creates one in-app notification each.
- The party announcement is shown only to Party members. The double-press publishes once.
- Publishing in an archived Campaign is refused.
- An unavailable deep link shows an "unavailable" message and the page stays usable. After leaving the sandbox Campaign, its announcement list and address are refused for P1.

**Other users see**

- **P2:** sees the table announcement and, if party targeted, the party announcement. Must NOT see an announcement addressed to a group P2 is not in.

## UAT-CAMPAIGN-7: The GM plays a Character

- **Covers:** CAMPAIGN-7.1
- **Accounts:** GM, P1
- **Preconditions:** The sandbox Campaign from UAT-CAMPAIGN-2 with P1 as a member and "UAT Dara" assigned. The GM has no Character in the review data: build one in the Builder first (for example "UAT GM Hero", as in UAT-BUILDER-1, signed in as GM).

**Steps**

1. **GM:** Open the Campaign **Party**, choose **Add Character**, and assign the GM's own Character to the Campaign.
2. **P1:** Open the Campaign and check the Party roster.
3. **GM:** In the Campaign chat, switch **Message voice** to roleplay and send an in-character line on the Table conversation.
4. **GM:** Open the Party conversation (players only).
5. **P1:** Send a message to the Party conversation.
6. **GM:** Try to move an item from the GM Character's inventory to P1's Character.
7. **GM:** Transfer ownership to P1 (see UAT-CAMPAIGN-2; the same plan-capacity note applies) and check the Party roster from both windows.

**Expected**

- The GM's Character appears on the Party roster like any other player's.
- The in-character line posts in the public Table conversation under the Character's name.
- The Party conversation is not available to the GM; the GM cannot read it.
- The inventory transfer works as for any player.
- After the transfer (if P1's plan allows it) P1, now the owner, still has their own Character "UAT Dara" on the Party roster; the former GM's Character is still listed and is now a player's Character. If the transfer is refused for plan capacity, record that and the roster is unchanged.

**Other users see**

- **P1:** sees the GM Character in the Party and the in-character line in the Table chat; must NOT see anything else that reveals the GM's private notes.

## UAT-CAMPAIGN-8: Not a member

- **Covers:** CAMPAIGN-8.1
- **Accounts:** GM, P1
- **Preconditions:** Review data loaded. P1 is not a member of Review: Fire and Thunder.

**Steps**

1. **GM:** Open Review: Fire and Thunder and its tabletop and copy both addresses. **P1:** Open the copied Campaign address.
2. **P1:** Try the Campaign's tabletop address.
3. **P1:** Read the message.

**Expected**

- P1 sees a clear "not found" or access message, not "Server Error", and no Campaign data.
- The tabletop address also refuses entry.

**Other users see**

- **GM:** Unaffected; the GM window shows no sign of P1's attempt.

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC | Why not a UAT step |
| -- | ------------------ |
| CAMPAIGN-1.3 | Staged publication, replay, rollback and quota contracts; checked by contract tests with injected faults a tester cannot cause. The create, copy, archive and delete flow itself is UAT-CAMPAIGN-1. |
| CAMPAIGN-4.2 | Bounded background cleanup of oversized inventories; needs an inventory far larger than anyone can enter by hand. |
| CAMPAIGN-4.3 | Real-backend source-loss and Vehicle cleanup under contention; a concurrency harness. |
| CAMPAIGN-5.2 | Oversized cargo cleanup under contention; a concurrency harness. |
| CAMPAIGN-8.2 | The exact-message match in notification code and the live-backend test patterns; a code check. The refusal wording a tester sees is UAT-CAMPAIGN-8. |
