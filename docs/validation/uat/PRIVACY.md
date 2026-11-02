# Privacy and redaction — UAT scenarios

Feature `PRIVACY` in the [phase ledger](../../roadmap/08-phase-ledger.json). Set up first: [README](README.md#setup).

Proves that at a live table the GM sees everything, each player sees only what their Character may know, and nobody else ever sees hidden tokens, private rolls, monster statistics, or another player's private data. Every scenario names what each window must NOT show; look for those on purpose and report any leak as a failure. Accounts: [README](README.md#accounts). Review data: [README](README.md#review-data). Several windows: [README](README.md#running-several-users-side-by-side). Record results: [README](README.md#recording-results). Use three browser profiles at once, one for the GM and one each for P1 and P2, with the tabletop window open in each.

## UAT-PRIVACY-1: What a player sees of the Encounter

- **Covers:** PRIVACY-1.1, PRIVACY-1.4, PRIVACY-1.6
- **Accounts:** GM, P1, P2
- **Preconditions:** Review: Party in the Field; Encounter active, round 2, Assisted. Roll my dice automatically OFF for all. The health display is at its default (Hidden): if you changed it in UAT-PRIVACY-6, reset the review data first. This scenario adds a hidden Goblin, so reset the review data afterwards.

**Steps**

1. **GM:** Open the turn order and the Wolf's and Goblin's details (stat block, hit points, abilities, hidden notes).
2. **P1:** Open the turn order and click the Wolf's token and the Goblin's token.
3. **P2:** Do the same.
4. **GM:** Add a Goblin token to the Scene and mark it **Hidden from players**.
5. **P1:** Look at the map, the turn order and the Encounter history.
6. **GM:** Make the hidden Goblin attack Aria (use the action drawer as the GM).
7. **P1:** Aria has no reaction, so no prompt should appear; read the chat and history.
8. **P2:** Read the chat and the Encounter history.

**Expected**

- The GM sees everything: exact hit points, full stat blocks and the hidden Goblin.
- Players see creatures in the turn order and on the map but no exact monster hit points, no monster stat block details beyond what the table shows publicly, and no hidden Goblin token or combatant (a "Hidden combatant" placeholder may appear for an actor with no name).
- The attack from the hidden Goblin appears in chat in a way that does not name the Goblin or reveal its position to players who cannot see it.

**Other users see**

- **P1:** must NOT see the hidden Goblin's token, name, initiative number, hit points, stat block, or the roll it made; must NOT see the Wolf's exact hit points.
- **P2:** same as P1, plus must NOT see P1's decision prompts, only the final public outcome.

## UAT-PRIVACY-2: GM private rolls and monster rolls

- **Covers:** PRIVACY-1.1, PRIVACY-1.4
- **Accounts:** GM, P1, P2
- **Preconditions:** Review: Party in the Field; Encounter active; all with Roll my dice automatically OFF. A hidden Goblin token exists (UAT-PRIVACY-1 step 4; add it now if you skipped that scenario). Reset the review data afterwards.

**Steps**

1. **GM:** Set the roll switch to **Private**.
2. **GM:** Make the Wolf attack Aria.
3. **GM:** Open chat **Enemy rolls** and **My rolls**.
4. **P1:** Look at the Table chat and the Encounter history.
5. **P2:** Look at the Table chat and the Encounter history.
6. **GM:** Switch the roll switch to **Public** and have the Wolf attack Bryn.
7. **GM:** Make a hidden Goblin (UAT-PRIVACY-1) roll with the switch on Public.
8. **P1:** Make a skill roll with **Just me** as the destination.
9. **GM:** Look in chat for P1's Just me roll. **P2:** confirm you also do not see it.

**Expected**

- The GM sees the Private roll in **Enemy rolls** and **My rolls**. Players see only the consequences (hit or miss, damage taken), not the dice, total or attack bonus.
- The Public attack shows the roll card to everyone.
- A hidden Goblin's roll is always Private, even when the switch is on Public.
- The GM does not see P1's Just me roll.

**Other users see**

- **P1 and P2:** must NOT see the Wolf's Private roll dice, the hidden Goblin's roll, or each other's Just me rolls.
- **GM:** must NOT see P1's Just me roll.

## UAT-PRIVACY-3: Non-members, removed players and signed-out visitors

- **Covers:** PRIVACY-1.2
- **Accounts:** GM, P1, P2, OUTSIDER (gap G3)
- **Preconditions:** Review: Fire and Thunder (P1 is not a member) for steps 1 to 2. Steps 3 to 6 remove P2, so use the Sandbox Campaign from UAT-SCENE-1 with P1's and P2's Characters, not a Review Campaign (Heavy setup: G5). Step 7 (signed out) runs now. Step 8 is blocked until gap G3 is fixed (it needs an account outside every Campaign).

**Steps**

1. **P1:** Open the address of Review: Fire and Thunder and try its tabletop address.
2. **P1:** Search listings for Fire and Thunder and open its public listing page, if one exists.
3. **GM:** In the Sandbox, remove P2 while P2's tabletop window is open (UAT-CAMPAIGN-2 shows the removal control).
4. **P2:** Watch the tabletop window, then reload it.
5. **P2:** Try the old tabletop address and the Campaign address.
6. **P2:** Try to open the Sheet addresses for P1's Character and for P2's own old Character in the Sandbox.
7. **Signed-out window:** Open the Sandbox tabletop address while signed out (a private window needs no spare account).
8. **OUTSIDER:** (blocked: G3) Sign in with an account that is not a member and open the tabletop address.

**Expected**

- Steps 1 and 5 to 8 give a clear refusal (for example "Campaign membership is no longer available.", not found, or sign in required; record the exact wording), and no Campaign data appears.
- The open tabletop window of P2 stops receiving updates after removal and closes or shows an access message.
- P2 cannot read Character Sheets from a Campaign they have left.

**Other users see**

- **P1 (not a member):** must NOT see any Fire and Thunder tokens, chat, notes, announcements or roster.
- **P2 (removed):** must NOT see any Encounter data, chat, notes or roster after removal.
- **Signed-out window and OUTSIDER (blocked: G3):** must NOT see anything.

## UAT-PRIVACY-4: Ownership transfer changes who sees what

- **Covers:** PRIVACY-1.2, PRIVACY-1.7
- **Accounts:** GM, P1
- **Preconditions:** The Sandbox Campaign from UAT-SCENE-1 (GM owner, P1 a member) with a running Encounter (UAT-ENCOUNTER-3 steps 3 and 5). Heavy setup: G5. Both in the tabletop window. Roll my dice automatically OFF for the GM.

**Steps**

1. **GM:** Add a hidden token to the Scene, then make a Private roll for a monster (as in UAT-PRIVACY-2 step 1).
2. **P1:** Note what the tabletop shows. Run an action as P1 and note its command card in chat (for example roll a skill).
3. **GM:** Transfer ownership to P1 (UAT-CAMPAIGN-2 steps 12 to 13) and have **P1** accept.
4. **P1 (new GM):** Reload the tabletop window.
5. **GM (now a player):** Reload the tabletop window.
6. **GM (now a player):** Check history and chat for the action P1 ran and for the Private roll made before the transfer.
7. **P1 (new GM):** Check the same history. Then transfer ownership back (UAT-CAMPAIGN-2 step 15) and have the original GM accept.
8. **GM (owner again):** Reload and check the history again.

**Expected**

- After transfer P1 sees the hidden token and the GM-only controls; the former GM no longer sees them.
- A command replayed after transfer (history, chat entries) shows the redacted player view to the former owner, and the full GM view to the new owner (steps 6 and 7).
- After the ownership comes back (step 8), the original GM again sees the full view. (A short delay before roles switch on an open window is documented as accepted exposure; reload and re-check before calling it a failure.)

**Other users see**

- **Former GM (now a player):** must NOT see the hidden token, hidden stat blocks, or the Private roll history after the transfer.

## UAT-PRIVACY-5: Reloads and replays do not leak

- **Covers:** PRIVACY-1.5, PRIVACY-1.4
- **Accounts:** GM, P1, P2
- **Preconditions:** Review: Party in the Field; Encounter active; roll prompts on (auto-roll OFF). Step 1 attacks the Wolf, so reset the review data afterwards.

**Steps**

1. **P1:** Make an attack from the action drawer.
2. **P1:** Reload the page immediately and check that the result and history appear.
3. **P1:** Press the browser back and forward.
4. **P2:** Look at the Encounter history; then reload.
5. **GM:** Make a Private monster roll.
6. **P2:** Reload several times and open the history each time.
7. **P1:** Open the same Encounter from a second tab.

**Expected**

- P1 sees their own result after reload exactly once (no duplicate attack).
- P2 sees the same public result, and after reload never sees more than before.
- Repeated reloads by players never reveal the Private roll.
- Opening the same Encounter in a second tab (step 7) shows P1 the same single result, not a second attack.

**Other users see**

- **P2:** must NOT see P1's decision prompts or P1's Just me roll, even after several reloads or reconnects.

## UAT-PRIVACY-6: Health display settings

- **Covers:** PRIVACY-2.1
- **Accounts:** GM, P1, P2
- **Preconditions:** Review: Party in the Field; Encounter active; all in the tabletop window. This scenario changes health display settings, so reset the review data afterwards.

**Steps**

1. **GM:** In the Encounter drawer find the health display choice and read the default.
2. **P2:** Look at Aria's and the Wolf's health on the tabletop and in the turn order.
3. **P1:** Open the Character health setting for Aria and choose **Descriptive**.
4. **P2:** Read Aria's health again.
5. **P1:** Change Aria's setting to **Bar**, then **Exact**.
6. **GM:** Set the Encounter's health display to **Descriptive** for the Wolf, **Bar** for the Goblin, and give the Wolf a per-actor override of **Exact**.
7. **P1:** Read the Wolf and Goblin health.
8. **GM:** Read all health values.

**Expected**

- The default is **Hidden**: players see no health number or bar for other creatures.
- Aria's own setting controls what others see of Aria: Descriptive words, a Bar, or Exact numbers. Each player sets it for their own Character only.
- The GM's per-Encounter and per-actor settings control how the Wolf and Goblin appear to players.
- The GM always sees exact values.

**Other users see**

- **P2:** must NOT see Aria's exact hit points unless Aria is set to Exact; must NOT see Bryn's setting changed by P1.
- **P1:** must NOT see the Wolf's hit points in a form stricter or looser than the GM's setting.

## UAT-PRIVACY-7: Other players' Sheets and Campaign roster

- **Covers:** PRIVACY-3.1
- **Accounts:** GM, P1, P2
- **Preconditions:** Review: Party in the Field. Aria's Sheet has "Party can view" off (if it is on, P1 turns it off first).

**Steps**

1. **P2:** Open the Campaign roster.
2. **P2:** Try to open Aria's Sheet.
3. **P1:** On Aria's Sheet, find **What the party sees**, and turn **Party can view** on.
4. **P2:** Reload and open Aria's Sheet.
5. **P2:** Look for Aria's personality and background.
6. **P1:** Turn **Party can view** off again.
7. **P2:** Reload Aria's Sheet.
8. **GM:** Open Aria's Sheet.

**Expected**

- The roster shows only name, portrait, level and class for each Character.
- Step 2 is refused (GM only). Step 4 shows the Sheet in a read-only form. Personality and background are never shown to P2 at any step.
- After step 6 P2 is refused again. The GM can always open the Sheet.

**Other users see**

- **P2:** must NOT see Aria's personality, background, private notes, inventory details (unless the shared view lists them) or any private Sheet data, in any step.

## UAT-PRIVACY-8: Campaign content stays hidden until revealed

- **Covers:** PRIVACY-3.2
- **Accounts:** GM, P1
- **Preconditions:** The Sandbox Campaign from UAT-SCENE-1 (P1 a member) with a first Encounter running and a second Scene (UAT-SCENE-1). Heavy setup: G5. P1's Roll my dice automatically OFF.

**Steps**

1. **P1:** Open the Campaign's Encounters list.
2. **P1:** Open the tabletop window.
3. **GM:** Prepare a second Encounter (not started) and keep a second Scene unpresented.
4. **P1:** Reload Encounters and look.
5. **GM:** Start the second Encounter, then **Present a scene** for the second Scene.
6. **P1:** Look at Encounters and the tabletop.
7. **GM:** Prepare a third Encounter that includes P1's Character, and start it so that it pauses on an initiative roll prompt for P1's Character before it becomes active. **P1:** Confirm you see that prompt (if no pre-start prompt appears, record it).
8. **GM:** Complete the second Encounter. **P1:** Look at Encounters.

**Expected**

- Before reveal P1 sees only the Campaign's active Encounter and the presented Scene with its fog. The prepared Encounter and the unpresented Scene are absent.
- After the GM starts and presents them, P1 sees them. A prepared run paused on a decision for P1 shows that decision to P1 (step 7) and nothing else about it.
- The GM sees every Encounter and Scene throughout.

**Other users see**

- **P1:** must NOT see prepared Encounters, unpresented Scenes, creature lists, or any Campaign file area (there is no file area).

## UAT-PRIVACY-9: A hidden Concentration source stays hidden

- **Covers:** PRIVACY-4.1
- **Accounts:** GM, P1
- **Preconditions:** Review: Shield and Hold (GM and P1 only; P1 plays Ember, who holds Hold Person). Roll my dice automatically OFF. A hidden caster is needed: GM adds a hidden spellcasting creature to the Scene that concentrates on a spell (a Mage). Heavy setup: G5; reset the review data afterwards.

**Steps**

1. **GM:** Add a creature that is hidden from players and cast a Concentration spell with it (or give it a concentrating effect).
2. **GM:** Deal damage to the hidden creature outside its own turn so its Concentration check fails.
3. **P1:** Read the chat and history notice about the dropped Concentration.
4. **GM:** Read the same notice.

**Expected**

- The GM's notice names the hidden creature or spell source.
- Players' notice says that Concentration ended without the hidden source's name.

**Other users see**

- **P1:** must NOT see the hidden creature's name, token or spell source in the notice or anywhere, including after a reload.
- **P2:** not a member of Shield and Hold; sees nothing of it.

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC          | Why not a UAT step                                                          |
| ----------- | --------------------------------------------------------------------------- |
| PRIVACY-1.3 | Every producer using the reviewed dispatcher is a code and contract review. |
