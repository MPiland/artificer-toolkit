# Scenes and maps — UAT scenarios

Feature `SCENE` in the [phase ledger](../../roadmap/08-phase-ledger.json). Set up first: [README](README.md#setup).

Proves a GM can upload and calibrate a map, build and present a Scene with tokens, walls, doors, light and fog, that players see exactly what they should and nothing hidden, and that several players can share one table screen. Accounts: [README](README.md#accounts). Review data: [README](README.md#review-data). Several windows: [README](README.md#running-several-users-side-by-side). Record results: [README](README.md#recording-results). The scenarios build on each other: run UAT-SCENE-1 first, because it creates the Scene the later ones use.

## UAT-SCENE-1: Upload a map, calibrate and create a Scene

- **Covers:** SCENE-1.1, SCENE-3.1
- **Accounts:** GM
- **Preconditions:** A map image on your computer (JPEG, PNG or WebP, under 25 MiB and no side over 8192 pixels). Use your own "Sandbox" Campaign (the copy from UAT-CAMPAIGN-1), not a Review Campaign, so the review data stays clean. Scenarios 3 to 9 also need P1, P2 and P3 as Sandbox members (invite and accept as in UAT-CAMPAIGN-2 steps 1 to 3) and a Character each: Aria, Bryn and Cade are already in the Review Campaign and a Character can be in only one Campaign, so each player first creates a new level-1 Character in the Builder and assigns it with **Add Character**. Below these are "P1's Character", "P2's Character" and "P3's Character". Heavy setup: G5.

**Steps**

1. **GM:** Open the Sandbox Campaign and go to the Live maps area (**Prepared scenes**).
2. **GM:** Choose **Map image** and select your picture. Watch **Map upload progress**.
3. **GM:** Type a **Scene name** (for example "UAT Cavern").
4. **GM:** Choose Grid type **Square**, set **Distance per cell** to 5 and **Distance unit** to **Feet**.
5. **GM:** Choose **Calibrate on map**, click a grid intersection to set the origin, then click an adjacent intersection to set the cell size.
6. **GM:** Check the **Map calibration preview**, then choose **Create scene**.
7. **GM:** Reload the page and open the Scene again.
8. **GM:** Edit the Scene name and the cell size, save, and reload.

**Expected**

- Upload shows progress and ends with a preview of the map; the Scene appears in **Prepared scenes**.
- After reload the Scene opens with the same map, name, grid and calibration.
- Edits persist after reload.

**Other users see**

- Not applicable: single user.

## UAT-SCENE-2: Map upload refusals

- **Covers:** SCENE-3.1
- **Accounts:** GM
- **Preconditions:** The Sandbox Campaign. Have ready: a text file renamed ".png", a GIF or PDF file, and (if you have one) an image over 8192 pixels on a side or over 25 MiB.

**Steps**

1. **GM:** Open the Scene creation area and choose **Map image**.
2. **GM:** Select the GIF (or PDF).
3. **GM:** Select the renamed text file.
4. **GM:** Select the oversized image, if available.
5. **GM:** Select a valid map, then clear it and select it again.
6. **GM:** Try **Create scene** with no Scene name.

**Expected**

- A non-image shows "Maps must be JPEG, PNG, or WebP images."; a file that cannot be read shows "That map could not be processed. Check its dimensions and try again."; an oversized file is refused with a clear message.
- Nothing is created for a refused file.
- Without a name the form says "Name this scene." and does not submit.

**Other users see**

- Not applicable: single user.

## UAT-SCENE-3: Present a Scene and build it live

- **Covers:** SCENE-1.2, SCENE-2.1
- **Accounts:** GM, P1, P2
- **Preconditions:** UAT-SCENE-1 done, including the Sandbox members and their Characters. Fog is off.

**Steps**

1. **GM:** Open the tabletop window and choose **Present a scene**, then pick "UAT Cavern".
2. **P1:** Open the tabletop window.
3. **P2:** Open the tabletop window.
4. **GM:** Add a token for P1's Character and place it on the map.
5. **GM:** Add a second token for a creature (for example a Goblin) and mark it **Hidden from players**.
6. **GM:** Draw a wall across the map.
7. **GM:** Add a door, a window, a one-way barrier and a light on the map.
8. **GM:** Draw a darkness zone.
9. **GM:** Add a GM note with **GM only** visibility.
10. **GM:** Check the **Scene objects** list.
11. **P1:** Compare the map with what the GM sees.
12. **GM:** Make the goblin visible (turn off Hidden from players).
13. **GM:** Move the wall a little.

**Expected**

- Players see the presented Scene's map. Every non-hidden token, wall, door, window, one-way barrier and light is visible to P1 and P2; the hidden token is not. The darkness zone shows to players as the GM drew it.
- Edits the GM makes (step 13) show on P1 and P2 within a second and they converge to the same picture as the GM.
- After step 12 the goblin token appears for P1 and P2.

**Other users see**

- **P1 and P2:** must NOT see the hidden goblin token before step 12, the GM-only note, the Scene objects list, or the GM's editing tools.

## UAT-SCENE-4: Fog of war off, shared and per player

- **Covers:** SCENE-2.5
- **Accounts:** GM, P1, P2
- **Preconditions:** UAT-SCENE-3 done; add a token for P2's Character as well, so P1's and P2's Characters both have tokens on the map.

**Steps**

1. **GM:** In the Scene settings check **Fog of war** is off. **P1:** note what is visible.
2. **GM:** Turn **Fog of war** on and choose **Shared party** fog.
3. **P1 and P2:** Look at the map.
4. **GM:** Move P1's Character's token across the map.
5. **P2:** Look at the map.
6. **GM:** Change **Fog visibility** to **Per player**. Choose **Choose player**, pick P2, and drag an area to edit that player's fog (**Drag an area on the map to edit fog.**).
7. **P1 and P2:** Compare the maps.
8. **GM:** Choose **Reveal entire map**, then switch fog off.
9. **GM:** Use **Full GM view** and then **GM vision preview** for P1.

**Expected**

- With fog off, players see every non-hidden token, wall, door and light. With fog on they see only explored or visible areas.
- In shared mode moving P1's Character reveals the map for both P1 and P2. In per-player mode P2 sees only P2's own explored area.
- **Reveal entire map** shows everything to players; switching fog off removes the fog.
- The GM vision preview shows what P1 would see and does not change what P1 sees.

**Other users see**

- **P1:** must NOT see areas only P2 has explored (per-player mode), tokens in unexplored areas, or hidden tokens.
- **P2:** same, with P1's areas.

## UAT-SCENE-5: Doors

- **Covers:** SCENE-2.4
- **Accounts:** GM, P1
- **Preconditions:** UAT-SCENE-3 done with a door on the map (step 7 added one) and a second door added by the GM. Both windows open.

**Steps**

1. **GM:** Make sure the door is **Closed** and not **Locked**.
2. **P1:** Open the door from the **Doors** list or by clicking it.
3. **P1:** Close it again.
4. **GM:** Choose **Lock** on the door.
5. **P1:** Try to open the locked door.
6. **P1:** Look at the second door's controls and try to lock it.
7. **GM:** Choose **Unlock**.
8. **P1:** Open the door once more.

**Expected**

- P1 can open and close an unlocked door and the change shows on the GM's screen.
- A locked door cannot be opened by P1; P1 has no lock or unlock control.
- The GM can lock and unlock.

**Other users see**

- **GM:** sees the door state change each time.

## UAT-SCENE-6: Offline edits recover

- **Covers:** SCENE-1.3, SCENE-2.2
- **Accounts:** GM, P1
- **Preconditions:** Both in the tabletop window of the Sandbox Campaign with the "UAT Cavern" Scene presented and a wall on it (UAT-SCENE-3).

**Steps**

1. **GM:** Open the browser developer tools Network panel and choose **Offline**.
2. **GM:** Move a token and add a wall while offline.
3. **GM:** Switch back to No throttling, wait for reconnect, and watch the map.
4. **GM:** Reload.
5. **P1:** Check the map.
6. **GM:** Close the tab entirely while offline, reopen the tabletop window online, and check the map.
7. **GM:** Open the tabletop window in a second browser tab (tab B) beside the first (tab A). In tab A move the wall a little; in tab B, without reloading, move the same wall somewhere else.
8. **GM:** Reload both tabs and compare the wall.
9. **GM:** Add a spare token, then in tab A double-click its remove control (two clicks in under a second) and check the token list.

**Expected**

- After reconnect or reload the Scene shows the final positions. A change that could not be sent is either replayed or clearly flagged; nothing silently disappears or duplicates.
- P1 sees the same final map.
- Steps 7 to 8: the second move is either applied after the first or refused with a message that the Scene changed; after reload both tabs show the wall in the same single place, and P1 sees that same place. Nothing is half-applied or duplicated.
- Step 9: the token is removed once; no error, and no second token disappears.

**Other users see**

- **P1:** sees changes only once they succeed, never a half-state, and never the hidden token.

## UAT-SCENE-7: Map ownership and deletion

- **Covers:** SCENE-3.2, SCENE-3.3
- **Accounts:** GM, P1
- **Preconditions:** Sandbox Campaign from UAT-SCENE-1 with P1 as a member. The transfer itself uses UAT-CAMPAIGN-2 steps 12 and 13 (step 2 below); do not run its steps 14 and 15 (transfer back) until this scenario ends.

**Steps**

1. **GM:** Open Settings and Account and note the used media storage.
2. **GM:** Transfer ownership of the Sandbox Campaign to P1 and have **P1** accept.
3. **P1:** Open Settings and Account and note the media storage. **GM:** do the same.
4. **P1:** Present the Scene in the tabletop window, then try to delete the Scene while it is presented.
5. **P1:** Present another Scene (or stop presenting), then delete "UAT Cavern".
6. **P1:** Reload and check the Scene list and storage.

**Expected**

- After transfer the map's storage is charged to the account that uploaded it, and the Scene and map still open for the new owner.
- A Scene that is live or in use cannot be deleted; a message explains why.
- After deletion the Scene is gone and the storage drops.

**Other users see**

- **GM (now a player):** must NOT see GM-only Scene objects after the transfer.

## UAT-SCENE-8: GM loot tables

- **Covers:** SCENE-4.1, SCENE-4.2
- **Accounts:** GM, P1
- **Preconditions:** Review: Party in the Field. Wolf and Goblin are in the Encounter. Defeating the Wolf changes review data, so reset it (README setup steps 2 to 5) before running ENCOUNTER, ATTACK or REACTION afterwards.

**Steps**

1. **GM:** Open the Scene's loot tables and create a table with a name, a skill check, and two ranges (1 to 10 and 11 to 20) with different items and coins.
2. **GM:** Add a third range that overlaps the first and save.
3. **GM:** Fix the overlap and save.
4. **GM:** Add a loot table to the Wolf in the Encounter.
5. **GM:** Reload and open the tables.
6. **GM:** Defeat the Wolf (reduce its hit points to zero).
7. **GM:** Open the **Loot** panel in the tabletop window and look at the Scene's tables and the Wolf's table.
8. **GM:** Enter a roll of 14 and look at the highlight.
9. **P1:** Look at the tabletop window.

**Expected**

- Step 2 is refused with a message naming the overlap and nothing saves. Corrected tables save and reopen intact, with the item names, quantities, coins and note.
- The defeated Wolf's token shows a loot marker; the Loot panel lists its table and the Scene's.
- Entering 14 highlights the 11 to 20 range. Nothing is granted automatically.

**Other users see**

- **P1:** must NOT see the Loot panel, the loot marker, tables or highlighted ranges, and nothing is given to P1's inventory.

## UAT-SCENE-9: One shared table screen for several players

- **Covers:** SCENE-5.1, SCENE-5.2, SCENE-5.3
- **Accounts:** GM, P1, P2, P3
- **Preconditions:** Sandbox Campaign with tokens for P1's, P2's and P3's Characters; all four in the tabletop window.

**Steps**

1. **GM:** Open the Party and give P1 control of P2's Character in addition to P1's own (**Also controlled by**). Keep P2 as owner.
2. **P1:** Look for a **Main Character** selector and read the choice.
3. **P1:** Select P2's Character as the main Character.
4. **P1:** Click P2's Character's token to select it, then click empty space to clear.
5. **P1:** Move P2's Character's token one square.
6. **P2:** Move that token too.
7. **GM:** Take the control back from P1.
8. **P1:** Try to move that token again.
9. **P1:** Type 150 in **Zoom percentage**, press **Zoom in** once, then reload; also open **Full screen**.
10. **P3:** Check P3's own zoom.

**Expected**

- P1 gets a selector, defaults to P1's own Character, and while P2's Character is selected sees through that Character's senses; clearing or multi-selecting returns to the main Character.
- P1 can move Bryn's token while allowed; the owner P2 keeps control. After the GM takes control back P1 cannot move it.
- Zoom is the typed or stepped value and persists across reload and view switches on that device; it does not affect P3.

**Other users see**

- **P2:** sees only P2's own Character's view; must NOT see what only P1's Character's senses reveal while P1 views as P2's Character, nor P1's choice of main Character.
- **P3:** unaffected.

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC | Why not a UAT step |
| -- | ------------------ |
| SCENE-2.3 | Maximum-polygon and full fog-capacity coverage is a storage limit test; drawing the largest allowed polygon by hand is impractical, and the ordinary walls, fog and light of scenarios 3 and 4 show the same code working at normal size. |
