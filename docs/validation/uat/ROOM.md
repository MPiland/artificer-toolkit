# Sessions and live room — UAT scenarios

Feature `ROOM` in the [phase ledger](../../roadmap/08-phase-ledger.json). Set up first: [README](README.md#setup).

Proves the GM and three players can all join the same live table, see each other, talk, share notes and maps, plan Sessions, survive a dropped connection, lose access when removed, and that the table keeps its state when everyone leaves and comes back. Accounts: [README](README.md#accounts). Review data: [README](README.md#review-data). Several windows: [README](README.md#running-several-users-side-by-side). Record results: [README](README.md#recording-results). "Tabletop window" means the window opened with **Open tabletop window** in the **Live tabletop** panel of the Campaign's session page (or **Open live tabletop window** on a Character Sheet).

## UAT-ROOM-1: GM and three players join at once

- **Covers:** ROOM-1.1, ROOM-1.5
- **Accounts:** GM, P1, P2, P3
- **Preconditions:** Review: Party in the Field; no tabletop window open anywhere. All four accounts signed in, each in its own browser profile. No Session has to be open.

**Steps**

1. **GM:** Open Review: Party in the Field and its session page. In the **Live tabletop** panel choose **Open tabletop window**.
2. **P1:** Open the same Campaign and choose **Open tabletop window**.
3. **P2:** Do the same.
4. **P3:** Do the same.
5. **GM:** Read the header badge and the text beside it.
6. **P1:** Read the header badge and the text beside it.
7. **GM:** Look for who is present in the room (names or portraits on the live table).
8. **P2:** Close the tabletop window.
9. **GM:** Check the presence list again.
10. **P2:** Reopen the tabletop window.
11. **All four:** Close every tabletop window and wait six minutes.
12. **GM:** Open the tabletop window again.

**Expected**

- Every active member gets in without a Session being open. The GM sees a **GM** badge and "Live editing available"; players see a **Player** badge and "Play view". The header holds the **Auto-roll** switch.
- Presence updates as people join and leave without a reload.
- The Encounter, tokens and chat are the same for everyone after they join (as far as each may see).
- After step 12 the room starts again from the last saved state: the Encounter round, tokens and Scene are as you left them.

**Other users see**

- **P1, P2, P3:** each see the other members as present; none sees GM-only controls ("Live editing available" is absent).

## UAT-ROOM-2: Previews and pings

- **Covers:** ROOM-2.1, ROOM-2.3
- **Accounts:** GM, P1, P2
- **Preconditions:** All three have the tabletop window of Review: Party in the Field open and a Scene is presented.

**Steps**

1. **GM:** Turn on **Show my previews to players** (the label reads **Players see your previews and pings** when on).
2. **GM:** Hover or aim at a spot on the map to create a preview and ping the map.
3. **P1:** Watch the map.
4. **GM:** Turn it off (the label reads **Previews and pings are private**) and ping again.
5. **P1:** Ping a spot on the map yourself.
6. **P2:** Watch for P1's ping.
7. **GM:** Leave the windows open for at least ten minutes (record the actual time; the room renews each window's sign-in before it expires), then ping again.

**Expected**

- With previews shared, P1 and P2 see the GM's preview and ping; with it off they see nothing.
- P1's own ping is visible to all players and the GM.
- Pings keep working after a token renewal or reload, without any manual sign-in.
- Previews disappear after a short time and are not left on the map.

**Other users see**

- **P2:** sees the GM's previews only while sharing is on. Must NOT see the GM's private aiming or previews while it is off.

## UAT-ROOM-3: Reconnect after a dropped connection

- **Covers:** ROOM-2.2, ROOM-1.4
- **Accounts:** GM, P1, P2
- **Preconditions:** Steps 1-6: GM and P1 in the tabletop window of Review: Party in the Field. Steps 7-10 use the sandbox Campaign from UAT-CAMPAIGN-2 (Heavy setup: G5) with P1 and P2 as members (invite P2 as in UAT-SOCIAL-2 if absent) and a tabletop window open for GM, P1 and P2. Never remove anyone from a review Campaign. The browser Network panel's "Offline" throttle lets you drop a connection.

**Steps**

1. **P1:** In the browser developer tools open the Network panel and choose **Offline**.
2. **GM:** Move a token (or post a chat line) while P1 is offline.
3. **P1:** Wait one minute, then switch the throttle back to No throttling.
4. **P1:** Watch the tabletop window without reloading.
5. **P1:** Reload the page.
6. **GM:** If an Encounter decision is waiting for P1, check it is still pending.
7. **GM:** In the sandbox Campaign, use **Remove player** on P1 while P1's tabletop window is open.
8. **P1:** Try to use the open window (post a chat line), then reload it.
9. **GM and P2:** Post a chat line and move a token.
10. **GM:** Read the presence list.

**Expected**

- After the connection is back, P1's window reconnects on its own and shows the token move and the chat line made while offline. A waiting decision is still there; a temporary aim or preview may need redoing.
- A reload yields the same state.
- Steps 7-8: P1 is refused and the window closes or shows an access message; the chat line is not posted.
- Step 9-10: GM and P2 keep working without a reload; P1 is gone from the presence list and P2 and the GM are still present.

**Other users see**

- **GM:** sees P1 leave and rejoin the presence list in steps 1-5, and leave for good in step 7.
- **P2:** never sees P1's rejected chat line.

## UAT-ROOM-4: Chat — Table, Party and Direct

- **Covers:** ROOM-3.1, ROOM-7.1
- **Accounts:** GM, P1, P2, P3
- **Preconditions:** Review: Party in the Field; all four in the tabletop window or the Campaign chat page. Roll my dice automatically OFF.

**Steps**

1. **P1:** In the Table conversation send "Hello table".
2. **P1:** Edit that message to say "Hello again table".
3. **P1:** Delete (tombstone) the message.
4. **P2:** Switch the Message voice to roleplay and send a line in the Table conversation.
5. **P2:** Open the **Party** conversation and send a message there.
6. **P3:** Open **Direct messages** and send P1 a direct message.
7. **GM:** Try to open the Party conversation and the direct message list.
8. **P1:** Send three rapid Table messages "A", "B", "C" in a row.
9. **GM:** With the roll switch on Public, have the Wolf attack Aria from the action drawer so that the attack roll card and the damage roll card come from one command.

**Expected**

- Table messages appear for everyone immediately. An edited message shows as edited; a deleted one shows as removed.
- Party messages are visible to players only. The direct message is visible only to P1 and P3.
- Messages and roll cards appear in the order they were sent (A, B, C; the attack roll before its damage roll).

**Other users see**

- **P2:** sees Table messages and Party messages but NOT P3's direct message to P1.
- **GM:** sees Table messages; must NOT see Party messages or P3's direct message to P1.
- **P3:** sees Table, Party and own directs; must NOT see anything else.

## UAT-ROOM-5: Rolls, private GM rolls and chat limits

- **Covers:** ROOM-3.3, ROOM-3.4
- **Accounts:** GM, P1, P2
- **Preconditions:** Review: Party in the Field; live room open; all with Roll my dice automatically OFF. The player limit (30 per minute) is tested by hand in steps 4-5; the GM limit (60 per minute) is optional step 8; the Scene-write limit (240 per minute) and replay of an exact retry cannot be reached by hand and are proved by the room tests.

**Steps**

1. **P1:** Roll a skill from the Sheet with destination Table.
2. **P1:** Roll another with destination **To GM**.
3. **GM:** Set the roll switch to Private and roll for the Wolf.
4. **P2:** Send forty short chat messages quickly (or as fast as you can) to the Table conversation.
5. **P2:** Wait one minute and send one more.
6. **P1:** Open the Campaign chat in a second tab and compare it to the tabletop chat.
7. **P1:** Read the unread badge on the chat, then open it.
8. **GM (optional, slow):** Send sixty-one short Table messages in under a minute, then wait a minute and send one more.

**Expected**

- The Table roll shows for everyone, the To GM roll only to the GM and P1, and the GM's private roll to no player.
- After enough messages in a minute P2 is told the limit has been reached (players 30 per minute) and further messages are refused until time passes; the one after a minute goes through.
- Both views of the chat list the same entries in the same order; the unread count clears when opened.
- Step 8: the GM is told the limit (60 per minute) has been reached on the sixty-first message; the one after a minute goes through.

**Other users see**

- **P2:** sees the Table roll. Must NOT see the To GM roll or the Wolf roll.
- **P1:** sees the Table roll and their own To GM roll; must NOT see the Wolf roll.

## UAT-ROOM-6: Notes — private and shared

- **Covers:** ROOM-3.2, ROOM-3.5
- **Accounts:** GM, P1, P2
- **Preconditions:** Review: Party in the Field.

**Steps**

1. **P1:** Open the Campaign notes and create an entry titled "P1 secret"; leave it **Private**.
2. **P1:** Create a second entry "P1 shared" and set it **Shared**.
3. **P2:** Open the notes and look for both entries.
4. **GM:** Open the notes and look for both entries.
5. **P1:** Change "P1 secret" to Shared; **P2:** reload the notes and look for it. Then **P1:** change it back to Private; **P2:** reload again.
6. **P2:** Try to change visibility on "P1 shared" and try to edit its text; then copy the address of "P1 secret" from P1's window (if an entry has its own address) and open it in P2's window.
7. **P1:** Open "P1 shared" in two tabs (A and B). In tab A change the text and save. In tab B (not reloaded) change the text differently and save.
8. **P1:** Delete "P1 secret".

**Expected**

- Private entries are visible only to their author and the GM. Shared entries are visible to every member.
- Step 5: P2 sees "P1 secret" only while it is Shared.
- Step 6: P2 cannot change visibility; P2's attempt to open the private entry by address is refused. Record whether P2 may edit the text of a shared entry (the criterion only forbids reading or editing another member's private entry).
- Step 7: the save from the stale tab B is refused with a version-conflict message or shows tab A's change; tab A's text is not silently lost.
- Deleting removes it for everyone who could see it.

**Other users see**

- **P2:** sees "P1 shared" but NOT "P1 secret".
- **GM:** sees both entries.

## UAT-ROOM-7: Show a map to players without presenting

- **Covers:** ROOM-3.6
- **Accounts:** GM, P1, P2
- **Preconditions:** Review: Party in the Field with a presented Scene. The GM creates a throwaway Scene "UAT Map B" in that Campaign with a different map image, one token and, if possible, a wall or fog (as in UAT-SCENE-1). Only this Scene is deleted in step 6; never delete a review Scene.

**Steps**

1. **GM:** In the tabletop window choose to show "UAT Map B" to players (**Choose a Campaign scene to show at the table**, then show it).
2. **P1:** Look at the tabletop window.
3. **GM:** Check that the presented Scene (with its tokens) has not changed for the Encounter.
4. **GM:** Stop showing it.
5. **P1:** Try to open the shown map again (browser back).
6. **GM:** Show it again, then delete "UAT Map B".
7. **P2:** Check the window.

**Expected**

- Players see a view-only image of the shown map, with that Scene's fog if it has fog. They do not see any tokens or objects on the shown Scene.
- The presented Scene and the Encounter are unchanged.
- After stopping, or after the Scene is deleted, players cannot see the map any more.

**Other users see**

- **P1, P2:** must NOT see the second Scene's tokens, walls or hidden objects at any time, only the map and fog.

## UAT-ROOM-8: Plan and log Sessions

- **Covers:** ROOM-4.1, ROOM-4.2, ROOM-4.5
- **Accounts:** GM, P1, P2
- **Preconditions:** Review: Party in the Field with its Sessions listed; the live room may be on.

**Steps**

1. **GM:** Open the Campaign **Sessions** and choose **Add session**; give it a name, a start time and a **Time zone**.
2. **P1:** Open the Session and set **Your RSVP** to Maybe, then to Present.
3. **P2:** Set the RSVP to Absent.
4. **GM:** Open **Session attendance** and mark who attended. **P1:** look for the attendance control and try to use it.
5. **P1:** In **Session notes** create a private note and a shared note.
6. **P2:** Open the Session notes.
7. **GM:** Open the Session notes.
8. **GM:** Pin a reference (a Character or Scene) under **Pinned references**. **P1:** open the Session and look at the pinned references.
9. **GM:** Open the tabletop window and note the Encounter round, the presented Scene and who is present.
10. **GM:** Choose **Finish this Session**, then recheck the same three things at the tabletop.
11. **P1:** Edit a shared note on the finished Session.

**Expected**

- The Session gets the next number and shows its schedule. Each RSVP is stored once per member (changing it replaces, not adds); the GM sees all three RSVPs.
- Step 4: attendance is the GM's; P1 has no working control or is refused.
- Private notes are read only by the author and the GM; shared notes by everyone, with the author named.
- Step 8: the pinned reference appears for P1, and opens only what P1 may see.
- Finishing the Session marks it Finished ("This Session is finished. Shared notes remain editable.") and changes nothing at the live table: the Encounter, Scene and presence are the same as in step 9.
- Step 11: the edit to the shared note succeeds.

**Other users see**

- **P2:** sees the shared note and its author, NOT P1's private note.

## UAT-ROOM-9: Live play commands go through the room

- **Covers:** ROOM-5.1, ROOM-5.3, ROOM-5.4, ROOM-6.14
- **Accounts:** GM, P1
- **Preconditions:** Review: Party in the Field; tabletop windows open for GM and P1. The Encounter is active. Bryn (P2's Character) has a token on the presented Scene.

**Steps**

1. **P1:** Open Aria's Sheet in a second tab; note hit points.
2. **GM:** Apply 2 damage to Aria through the Encounter actor controls.
3. **P1:** Check the Sheet and the tabletop.
4. **P1:** On the Sheet apply 1 point of healing.
5. **GM:** Check Aria's hit points on the tabletop.
6. **GM:** Move Aria's token one square.
7. **P1:** In the tabletop window, try to drag Bryn's token one square. **GM:** check Bryn's token on the GM's tabletop and reload it.
8. **Both:** Close the Sheet and the tabletop windows and wait six minutes (the room saves and closes).
9. **GM:** Open the tabletop window again and the Sheet in another tab.

**Expected**

- Damage and healing show in the Sheet and tabletop right away and agree.
- Step 7: P1 cannot move a token P1 does not control; the move is refused, Bryn's token stays in its square on both windows, and nothing is written (still so after the GM's reload and after the room reopens). The refusal on the Convex path is proved by the room and Convex tests.
- The token's new square, Aria's hit points and the Encounter round are the same after the room has closed and reopened.
- No edit is lost or doubled.

**Other users see**

- **GM:** sees P1's Sheet healing on the tabletop within a second.

## UAT-ROOM-10: Archiving a Campaign closes its live room

- **Covers:** ROOM-1.5
- **Accounts:** GM, P1
- **Preconditions:** Heavy setup: G5. A throwaway Campaign owned by the GM with P1 as a member (create "UAT Archive Room" as in UAT-CAMPAIGN-1; P1 joins by invitation as in UAT-SOCIAL-2). Never archive a review Campaign. The saved-and-closed-after-five-minutes half of ROOM-1.5 is UAT-ROOM-1 steps 11-12.

**Steps**

1. **GM and P1:** Open the tabletop window of "UAT Archive Room".
2. **GM:** Post a chat line and note it.
3. **GM:** Archive the Campaign (as in UAT-CAMPAIGN-1 step 8).
4. **P1:** Watch the tabletop window, try to post a chat line, then reload it.
5. **GM:** Try to open the tabletop window of the archived Campaign.

**Expected**

- Step 4: P1's window closes or shows that the Campaign is archived; the chat line is not posted and a reload does not reopen the room.
- Step 5: the GM cannot open a live room on the archived Campaign; the Campaign is read-only.

**Other users see**

- **P1:** sees the archived, read-only Campaign and nothing of a live table after step 3.

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC        | Why not a UAT step                                                                                                                                                                             |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ROOM-1.2  | Ticket signing, single use and one-minute expiry are security-token checks; a tester cannot read or replay a ticket.                                                                           |
| ROOM-1.3  | Durable Object origin, signature, claim and replay rejection are contract tests needing forged requests.                                                                                       |
| ROOM-4.3  | Clock version contention and DAILY recovery watermarks are timing harnesses.                                                                                                                   |
| ROOM-4.4  | Contention and archived-authorization ordering are contract tests; the app has no verified tester path for GM adjustments outside live play, so its visible half has no step (owner: confirm). |
| ROOM-5.2  | Which writer applies an Encounter move (room command rather than Convex) is internal; the move itself and its refusals are in UAT-MOVE-1, UAT-MOVE-2 and UAT-ROOM-9 step 7.                    |
| ROOM-6.1  | Room test fixture (a player-socket helper); test code only.                                                                                                                                    |
| ROOM-6.2  | Room test of a spatial save-effect hazard; the hazard play itself is UAT-MOVE-8.                                                                                                               |
| ROOM-6.3  | Room tests of maintenance variants; no maintenance prompt exists in the review data to drive by hand.                                                                                          |
| ROOM-6.4  | Room test asserting a movement receipt counter; internal bookkeeping.                                                                                                                          |
| ROOM-6.5  | Room test of empty-prior maintenance; internal.                                                                                                                                                |
| ROOM-6.6  | Room test of maintenance pauses and stale refusals through a test-only seed route.                                                                                                             |
| ROOM-6.7  | Room test of a Character initiating Disarm; the Disarm play itself is UAT-REACTION-6.                                                                                                          |
| ROOM-6.8  | Test fixture item change (Longsword instead of Club); test code only.                                                                                                                          |
| ROOM-6.9  | Room test of Concentration with two Characters; Concentration play itself is in the SPELLS file.                                                                                               |
| ROOM-6.10 | Room test of equipment commands with content seeding; test code only.                                                                                                                          |
| ROOM-6.11 | Room test of Legendary Action controller cases; Legendary play itself is in UAT-ENCOUNTER-6 and UAT-SPELLS-18.                                                                                 |
| ROOM-6.12 | Room test of Concentration advantage on movement and a shared spatial effect; test code only.                                                                                                  |
| ROOM-6.13 | Room test of initiative receipt metadata; internal.                                                                                                                                            |
