# Token movement — UAT scenarios

Feature `MOVE` in the [phase ledger](../../roadmap/08-phase-ledger.json). Set up first: [README](README.md#setup).

Proves a player can move only their own token, that the table stops illegal moves (walls, hostile spaces, the map edge, locked tokens), that leaving an enemy's reach pauses for the GM's answer, that the GM can undo a token move, and that traps, hidden hazards and climbing behave and stay hidden from players. Accounts: [README](README.md#accounts). Review data: [README](README.md#review-data). Several windows: [README](README.md#running-several-users-side-by-side). Record results: [README](README.md#recording-results). Scenes with walls, doors and zones do not exist in the review data: build them in a sandbox Campaign (see SCENE UAT, UAT-SCENE-1 and UAT-SCENE-3) or add them to Review: Party in the Field in the steps.

## UAT-MOVE-1: A player moves their own token

- **Covers:** MOVE-1.1, MOVE-1.5, MOVE-1.3
- **Accounts:** GM, P1, P2
- **Preconditions:** Review: Party in the Field; Encounter active, round 2; GM, P1 and P2 in the tabletop window. Roll my dice automatically OFF.

**Steps**

1. **P1:** Click Aria's token and drag it one square away from the Wolf to an empty square, then confirm if asked.
2. **P1:** Read the movement readout.
3. **P1:** Drag Aria's token several squares further, farther than Aria's speed.
4. **P1:** Read the readout and any warning.
5. **P1:** Try to drag the Wolf's token.
6. **P1:** Try to drag Bryn's token.
7. **P2:** Try to drag Aria's token.
8. **GM:** Move Aria's token and the Wolf's token.
9. **P1:** Reload the page.

**Expected**

- Step 1: the token moves and the readout shows "used / budget ft" (for example "Movement 15 / 30 ft"). Diagonal steps count 5, 10, 5 feet.
- Step 3: the move is allowed; Assisted mode shows a yellow "N ft over" but does not stop the move (movement is advisory).
- Steps 5 to 7 are refused: the token does not move, and the app refuses with a message (read and record its exact wording). Nothing changes on the other windows.
- The GM can move every token.
- After reload everyone still sees the final positions.

**Other users see**

- **P2 and GM:** see Aria's token move as P1 drags it, and end in the same square. They never see tokens move that the player had no right to move.
- **P2:** must NOT see anything that P1's refused drag did.

## UAT-MOVE-2: Refusals at walls, hostile spaces and the map edge

- **Covers:** MOVE-1.1
- **Accounts:** GM, P1
- **Preconditions:** **Review: Sandbox** (this scenario adds walls, a door and terrain to its Scene, so reset the review data afterwards: README setup steps 2 to 5). Read "Aria" below as Iris (P1) and "the Wolf" as the Ogre. The Scene already has a wall at x=400, a closed door in it and a rubble line in the west room; the GM draws the extra pieces in the steps with the tools described in UAT-SCENE-3. Iris has room to move.

**Steps**

1. **GM:** Draw a Wall across the map in front of Aria, and a Door (closed) in a second wall.
2. **P1:** Drag Aria's token through the wall.
3. **P1:** Drag Aria's token to the door while it is closed.
4. **P1:** Open the door (from the **Doors** list) and drag through it.
5. **GM:** Lock the door; **P1:** try to open it, then drag through.
6. **P1:** Drag Aria onto the square the Wolf occupies.
7. **P1:** Drag Aria off the edge of the map.
8. **GM:** Use **Lock token movement** on Aria's token (token properties).
9. **P1:** Try to move Aria's token.
10. **GM:** Unlock it; **P1:** move it one square.
11. **GM:** Add a one-way barrier and a window and try dragging through each.
12. **GM:** Add difficult terrain with a movement cost multiplier of 2 and walk Aria through two squares of it.

**Expected**

- Steps 2, 3, 5 and 6 are refused with a clear message and the token returns to where it started.
- A wall, a closed door, a locked door and a one-way barrier block the crossing from the blocked side; a window and an open door follow their rules.
- Step 7 refuses to leave the map. Step 9 is refused because the token is locked. Step 10 works.
- Difficult terrain raises the used movement above the straight-line distance (a multiplier of 2 doubles the cost of the squares crossed).
- Nothing is written when a move is refused: reload shows the old square.

**Other users see**

- **GM:** sees the token stay where it was after each refusal; sees no half-finished move.

## UAT-MOVE-3: Opportunity attack pauses the move

- **Covers:** MOVE-1.2
- **Accounts:** GM, P1, P2
- **Preconditions:** Review: Party in the Field; Aria adjacent to the Wolf; Encounter active in Assisted mode. P1, GM and P2 in the tabletop window. Before step 1 the GM turns **Fog of war** on for the Scene (Shared party) so stopped-path fog can be seen. Roll my dice automatically OFF for the GM.

**Steps**

1. **P1:** On your own turn (or if turn order does not matter in this build, now), drag Aria's token away from the Wolf, out of its reach.
2. **P1:** Read what appears, and note which part of the map is revealed to you beyond the point where the move stopped.
3. **GM:** Open the **Pending decision**. Read the prompt for the Wolf.
4. **P1 and P2:** While it is open, try to move another token and try to open a door.
5. **GM:** Try to undo the last token move.
6. **GM:** Choose **Use reaction** for the Wolf's opportunity attack.
7. **GM:** Answer any roll prompt (with auto-roll off, type or roll the attack).
8. **P1:** Watch the token and the chat.
9. **P1:** Move Aria back next to the Wolf and away again, to get a second pause.
10. **GM:** This time choose **Decline reaction**.
11. **P1:** Move Aria back next to the Wolf and away a third time to get another pause.
12. **GM:** Choose **Skip decision**.

**Expected**

- The move pauses at the point Aria leaves the Wolf's reach and shows a "Pending decision" to the GM (the Wolf's controller). While it is open every token move, undo and door change is blocked with "Waiting on a movement decision.".
- Use reaction runs an opportunity attack; its result shows in chat, and the move then continues to its destination. Decline reaction continues with no attack.
- Skip decision treats the choice as declined and the move continues.
- While the move is paused the fog is revealed only along the path travelled up to the pause point, not beyond it; it extends as the move continues.

**Other users see**

- **P1:** sees that the move is paused waiting on a decision; sees the attack result card only after the GM resolves it. P1 cannot answer the Wolf's reaction.
- **P2:** sees the pause and the final outcome; must NOT see the GM's private roll if the GM rolled Private, nor map areas the party has not explored under shared fog.

## UAT-MOVE-4: Undo last token move

- **Covers:** MOVE-1.2
- **Accounts:** GM, P1
- **Preconditions:** Review: Party in the Field, GM and P1 in the tabletop window. Fog of war is on (Shared party; see UAT-SCENE-4 for the switch).

**Steps**

1. **GM:** Note Aria's square.
2. **P1:** Move Aria's token two squares.
3. **P1:** Look for an undo control.
4. **GM:** Choose **Undo last token move** (the stage icon).
5. **GM:** Press it again.
6. **P1:** Move Aria again and then have the GM move another token.
7. **GM:** Choose **Undo last token move** and read which token returns.
8. **GM:** Trigger an opportunity-attack pause (UAT-MOVE-3) and try to undo during the pause.

**Expected**

- P1 has no undo for tokens. The GM's undo returns Aria to the step 1 square, and restores the fog as it was.
- A second press with nothing to undo is refused with a message. Step 7: undo acts only on the latest move (the other token); Aria's earlier move is not rewound by it. Step 8: undo is refused with "Waiting on a movement decision." while the decision is pending.
- Everyone sees the token return.
- Not exercised here: the refusals after a move that settled Encounter mechanics, or one made as part of an action (the play guide lists them).

**Other users see**

- **P1:** sees the token move back immediately.

## UAT-MOVE-5: Moving outside an Encounter and in a sandbox

- **Covers:** MOVE-1.4
- **Accounts:** GM, P1
- **Preconditions:** Use the Sandbox Campaign from UAT-SCENE-1 and UAT-SCENE-3 (a Scene, no Encounter, a token for P1's Character). If you use Review: Party in the Field instead, first choose Complete encounter in the turn controls and reset the review data afterwards. P1 controls their own Character below.

**Steps**

1. **GM:** Present the Scene with a token for P1's Character, a wall, and an unbound token (add a plain token "Marker" with **Controlled by players** on).
2. **P1:** Move P1's Character's token.
3. **P1:** Move the Marker.
4. **GM:** Turn **Controlled by players** off for the Marker.
5. **P1:** Try to move the Marker.
6. **P1:** Try to move P1's Character's token to a place behind the wall.

**Expected**

- Outside an Encounter a player moves tokens they control, including a plain token the GM allowed.
- With control turned off, the Marker cannot be moved by P1.
- Walls still refuse moves.

**Other users see**

- **GM:** sees every move as it happens.

## UAT-MOVE-6: Peers converge, reload and departure

- **Covers:** MOVE-1.3
- **Accounts:** GM, P1, P2
- **Preconditions:** The Sandbox Campaign from UAT-SCENE-1 and UAT-SCENE-3 with tokens for P1's and P2's Characters on the presented Scene, three windows open. Step 6 removes P2 from the Sandbox, so do not run this on a Review Campaign. Encounter-bound movement convergence is shown in UAT-MOVE-1 and UAT-RELIABILITY-2.

**Steps**

1. **P1:** Move P1's Character's token.
2. **P2:** Move P2's Character's token at about the same time.
3. **All:** Compare maps.
4. **P2:** Reload the page.
5. **P1:** Go offline (Network panel) and move P1's Character's token; go back online.
6. **GM:** Remove P2 from the Campaign (see CAMPAIGN UAT).
7. **P2:** Try to move P2's Character's token and reload.

**Expected**

- All three windows show the same positions after each step, including after reload.
- A move made offline is either committed once or shown as failed; it is not duplicated.
- After removal P2 cannot move anything and is refused on reload.

**Other users see**

- **GM and P1:** see the same final positions; P2's refused attempts change nothing.

## UAT-MOVE-7: Overrun, Shove Aside and Tumble

- **Covers:** MOVE-1.2, MOVE-2.2, MOVE-2.4, MOVE-2.6
- **Accounts:** GM, P1
- **Preconditions:** Review: Party in the Field in Assisted mode with the optional movement rules available from the Campaign's table settings (if the Overrun, Shove Aside or Tumble choices do not appear, look for them in the table settings and start a new Encounter; this is rule setup, not a failure. The labels confirmed in the decision drawer are **Overrun**, **Tumble** and **Decline passage**; describe the others as you find them). Aria is next to the Wolf. Roll my dice automatically OFF.

**Steps**

1. **P1:** On Aria's turn start a move and choose the Overrun option to pass through the Wolf's space. Note Aria's movement readout before and during the contest.
2. **GM:** When the contest prompt appears, roll or type the Wolf's roll.
3. **P1:** Roll or type Aria's roll.
4. **P1:** Repeat with **Tumble** to pass through an enemy's space.
5. **GM:** Choose **Decline passage** on one of the contests.
6. **P1:** Start a Shove Aside move past an ally.
7. **P1:** Choose the destination square offered for the shoved creature.

**Expected**

- While a contest is open, Aria's movement readout does not change; it is charged only when the move finishes, and a decision left open across a reload is still there exactly once. Each option pauses the move for a contest. If the mover wins, the move completes through the space; if not, the move stops with a message.
- **Decline passage** lets the target refuse passage and the move stops (Aria's token stays where it paused and nothing further is spent).
- Shove Aside offers only legal destinations, and the chosen one is where the ally ends up.
- Every contest roll is visible to the table as a roll card unless rolled Private by the GM.

**Other users see**

- **P1 (watching the Wolf's roll):** must NOT see the GM's roll if it was made Private.

## UAT-MOVE-8: Hidden hazards, traps and auras

- **Covers:** MOVE-3.1, MOVE-3.2, MOVE-3.3, MOVE-3.5, MOVE-3.6, MOVE-3.7
- **Accounts:** GM, P1, P2
- **Preconditions:** **Review: Sandbox** (or Review: Party in the Field) with its Scene, active Encounter and tokens for P1's and P2's Characters (Iris and Juno; read "Aria" and "Bryn" below as them). The GM uses the zone tool in the tabletop window. In Campaign table settings **Noticing concealed zones** is **GM prompt** (default). This adds zones to review data, so reset the review data afterwards. Before step 3, P1 reads Aria's passive Perception from her Sheet and tells the GM, who sets the Spot DC to that number or lower in step 3.

**Steps**

1. **GM:** Open the zone tool (**Create scene object**, zone) and place a visible pit trap zone with a label and no spot DC.
2. **P1 and P2:** Look at the map.
3. **GM:** Place a second zone, a concealed caltrop field, and set the **Spot DC** to the number P1 reported (or lower) and a **Disarm DC** of 14 by typing flat numbers.
4. **P1 and P2:** Look at the map and the zone list.
5. **P1:** Move Aria toward the concealed zone from a distance.
6. **GM:** Wait for a quiet prompt to reveal the zone to a Character whose passive Perception meets the Spot DC.
   6a. **GM:** Start dragging Aria's token toward the concealed zone without releasing, and read the path preview for which creatures have not noticed it. Release back on Aria's square.
7. **P1:** Drag Aria through the visible pit and read the path preview or warning.
8. **P1:** Drag Aria through the concealed zone.
9. **GM:** Reveal the concealed zone to Aria only, then check P2's window.
10. **GM:** Disarm the concealed zone, then use GM undo to bring it back.
11. **GM:** Place a third zone with the zone tool, then use GM undo and check it is removed.
12. **GM:** In the table settings set **Noticing concealed zones** to **Search only**, move Bryn toward the zone and check that no prompt appears; roll Bryn's search from the Sheet.

**Expected**

- A visible zone is shown to all. A concealed zone is drawn and listed only for the GM and Characters who know it; the Spot DC and Disarm DC are shown only to the GM.
- A creature who does not know of the zone gets no path warning and no Move carefully offer; entering it triggers it.
- The GM's path preview shows which creatures have not noticed the zone.
- Step 11: GM undo removes the placed zone like any placed zone.
- The reveal prompt goes only to the GM. After a reveal only Aria gets the warning. Disarm removes the zone and GM undo restores it.
- In Search only mode there is no prompt; the GM decides after the roll. There is no Search button.

**Other users see**

- **P1 before reveal:** must NOT see the concealed zone, its list entry, its Spot DC, its Disarm DC or any warning.
- **P2 after the reveal to Aria only:** still must NOT see the zone or any warning.

## UAT-MOVE-9: Climb onto a larger creature

- **Covers:** MOVE-4.1, MOVE-4.2, MOVE-4.3, MOVE-4.4
- **Accounts:** GM, P1
- **Preconditions:** **Review: Sandbox**, where the Large Ogre stands in the east room (read "Aria" below as Iris; the GM moves the Ogre's token next to Iris's, or the party crosses through the door). Alternatively use Review: Party in the Field and add a Large or bigger creature (for example a Giant or Ogre) to the Encounter next to Aria's token by hand. This changes review data, so reset it afterwards. The Climb rule is offered in Campaign table settings only once it works; look for it there.

**Steps**

1. **GM:** Open Campaign table settings and check the climb rule is offered; turn it on and start a fresh Encounter if needed.
2. **P1:** On Aria's turn choose the option to climb onto the large creature.
3. **P1 and GM:** Roll the contest: Aria's Athletics or Acrobatics against the creature's Acrobatics.
4. **GM:** Move the large creature one square.
5. **P1:** Attack the creature while clinging.
6. **GM:** Make the creature try to dislodge Aria with the contest it is offered.
7. **P1:** Look at where Aria lands.

**Expected**

- Only a creature suitably larger and adjacent can be climbed; a smaller target is not offered.
- If Aria wins she moves into the target's space and clings; Aria moves with it and attacks it with advantage (the roll shows advantage).
- If the target wins the dislodge contest Aria lands in a legal adjacent square.
- The climb rule appears in the table settings only if it is implemented; if you cannot find it, record that against MOVE-4.4.

**Other users see**

- **P1:** sees the contest outcome; must NOT see the GM's Private rolls.

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC       | Why not a UAT step                                                                                                                                                                                                                                                |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MOVE-2.1 | The Overrun policy's authored shape and typing is a contract check; what it produces (the contested Overrun move) is exercised by MOVE-2.2 in UAT-MOVE-7.                                                                                                         |
| MOVE-2.3 | Same for the Shove Aside policy; its behaviour is MOVE-2.4 in UAT-MOVE-7.                                                                                                                                                                                         |
| MOVE-2.5 | Same for the Tumble policy; its behaviour is MOVE-2.6 in UAT-MOVE-7.                                                                                                                                                                                              |
| MOVE-3.4 | A camouflaged zone comes only from an authored zone manifest on a Spell, which a tester would have to author and cast; the ledger proof is an authoring-parity test through the real form. The GM-set Spot DC in UAT-MOVE-8 shows the same concealment on screen. |

## Run notes

One entry per failed, blocked or skipped run, newest first, linked from the [tracker](TRACKER.md). Use the scenario id as a `###` heading, then the date, the build (commit or staging build name), the tester, the step number and the details listed in [When a scenario fails](README.md#when-a-scenario-fails).
