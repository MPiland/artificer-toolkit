# Alpha play guide

A plain-language guide to the live table for alpha players and GMs. It describes what the app does today, checked against the code and its tests. Where a feature is not finished, a note says so instead of guessing.

> Status: draft. The release-candidate walkthrough (RELEASE-7.T3) confirms each statement against the running build before alpha invites go out. The [known gaps](#known-gaps) and [how to send feedback](#sending-feedback) are at the end.

## Words used in this guide

- **Campaign**: your table. The **GM** is the Campaign owner; everyone else is a **Player**. There are no other roles.
- **Live table**: the shared play room for a Campaign. There is one per Campaign, and any active member can open it.
- **Scene**: a map the GM presents to the table.
- **Encounter**: a combat run on a Scene, with initiative and turns.
- **Assisted** and **Manual**: the two Encounter modes ([see below](#manual-and-assisted-encounters)).
- **Sheet**: your Character's play screen.

## For everyone

### Joining the live table

1. Open the Campaign's session page and choose **Open tabletop window** in the **Live tabletop** panel. You can also use **Open live tabletop window** on a Character Sheet.
2. The header shows a **GM** or **Player** badge. The GM sees "Live editing available"; players see "Play view". It also holds the **Auto-roll** switch.
3. Until the GM presents a Scene, players see "The GM has not presented a scene yet."
4. If your connection drops, the app reconnects on its own. A decision you were waiting on is still there afterwards, but temporary previews (such as an aimed area) may disappear and need redoing.
5. The room closes about five minutes after the last person leaves. If you are removed from the Campaign you are removed from the room.

A player with more than one Character gets a **Main Character** selector.

### Rolling dice and the auto-roll preference

- **Roll my dice automatically** (Settings, Preferences, and the **Auto-roll** switch in the tabletop header) is a per-account setting that applies on every device and in every Campaign. It starts on.
- **On**: the app rolls whenever a roll is needed, with no prompt. It never makes choices for you: you are still asked to use or decline reactions and other options.
- **Off**: you get a roll prompt each time. Choose **Roll dice** (the app rolls; you can roll again, and every attempt is logged) or type in the faces of physical dice. If the roll has advantage or disadvantage the app preselects it and says why; changing it is logged.
- The GM's setting decides how the GM's monster rolls are made; each player's setting decides rolls for their own Characters.
- There is no way to override a single roll while auto-roll is on. To enter physical dice, switch the preference off first.

### Manual and Assisted Encounters

The GM chooses the mode in the Campaign's table settings. The default is **Assisted**. The mode is fixed when an Encounter is created: changing the setting later does not change an Encounter already created.

|                                               | Assisted             | Manual                             |
| --------------------------------------------- | -------------------- | ---------------------------------- |
| Action drawer (attacks, spells, choices)      | Shown                | Hidden                             |
| Rules checks                                  | App checks and warns | App does not apply rules           |
| Damage, healing, slot spending                | Applied by the app   | Not applied; the table tracks them |
| Roll prompts, reactions, Concentration checks | Raised               | Not raised                         |

In **Assisted** mode a rule problem (out of range, wrong creature type, no action left, unequipped weapon and so on) shows a warning with a **Do it anyway** button. The GM can see every override in the Encounter history. Some problems can never be overridden: not being allowed to act, acting out of turn, stale information and invalid game state.

In **Manual** mode the app is a map, a turn order and a place to roll, and the table keeps the rules.

Optional Campaign settings (frozen into each Encounter): **ammunition tracking** (off by default; when on, each ammunition attack uses up pieces from the chosen stack), and **automatic cover** (on by default; cover comes from walls on the Scene).

### Moving tokens

- You can move your own Character's token (and any other token the GM has given you control of). The GM can move every token.
- The movement readout shows "used / budget ft". In Assisted mode a yellow "N ft over" appears when you exceed it. **Movement is advisory: the app does not stop you.** Dash adds to the budget.
- Diagonal steps count 5, 10, 5 feet. Difficult terrain multiplies the cost of what you cross.
- The app refuses a move that crosses a blocking wall, ends inside a hostile creature's space, leaves the map, or touches a locked token.
- Leaving an enemy's reach pauses your move on a **Pending decision**: the enemy's controller chooses **Use reaction** or **Decline reaction** (opportunity attack). Some moves (Overrun, Tumble) pause for a contest with **Decline passage**. While a movement decision is open, token moves, undo and door changes are blocked ("Waiting on a movement decision.").
- Pushes and pulls caused by effects do not provoke opportunity attacks.
- Anyone can open or close a door; only the GM can lock one.

### Turns, attacks and saves (Assisted)

- **Start of a turn** runs in this order: Recharge rolls, then a death save if the Character is dying, then start-of-turn effects. Who rolls depends on the auto-roll preference of the controlling player (or the GM for monsters).
- **Attacks and actions**: on your turn, open the action drawer and pick an action. Your choices appear in the drawer; targets must be creatures you can see (hidden or unseen ones are refused). The app applies advantage and disadvantage from conditions and range, and cover from the Scene, and shows the reason.
- **Saves**: when an area catches several creatures, each creature gets its own save prompt, answered by whoever controls it (the GM for monsters), in any order. The area settles when the last answer is in, or immediately if every save is auto-rolled. The GM can remove a creature from a pending area.
- **Legendary actions** open after other creatures' turns end. A **Legendary Resistance** is offered to the creature's owner as a prompt.

### Spells

- A spell appears once for each level you can cast it at, such as "Cure Wounds (2nd level)". Choosing the row chooses the slot, so upcasting is just picking the higher row. Cantrips appear once.
- Targeting is by the spell's kind: yourself, one creature, a list of creatures, a point on the map (click it), a direction (drag from your token), centred on you, or a drawn wall or ring.
- **Rituals** cannot be cast in an Encounter. They show as unavailable with a message to cast them from your Sheet; no slot is spent.
- **Components** are shown on the choice but are not checked or used up.
- **Reaction spells** (such as Shield) are cast when their trigger happens, not as a normal action.
- **Concentration**: casting a Concentration spell replaces the one you hold (no prompt, when you can hold one). Damage that does at least 1 hit point of damage makes you roll a Concentration check against DC 10 or half the damage, whichever is higher; failing ends the spell and effects tied to it. Dropping to 0 hit points or becoming incapacitated ends it with no roll. You can end it yourself at any time.
- Where a Character can hold more than one Concentration, casting another at the limit asks **End which Concentration?**; each held spell gets its own save in the order cast, and a failure ends only that spell.

> **Still in progress**
>
> - The Sheet's picker for ending one of two held Concentrations is not finished. Use the cast-time prompt for now.
> - Sorcerer metamagic: Subtle, Careful, Sculpt and Heightened are available. Twinned, Distant, Extended, Quickened, Overchannel and Empowered are not yet; the GM should rule these by hand.
> - Once-per-dawn uses and some advantage rules on second Concentrations are not finished, and replacing a held Haste can fail.

### Reactions

- A reaction prompt appears when a creature that can react is hit by an attack (Shield, Uncanny Dodge, Deflect Missiles), takes damage (Absorb Elements), sees a spell cast (Counterspell), or is left by a moving creature (opportunity attack).
- The reacting creature's controller answers **Use** or **Decline** (the GM for monsters; the GM can answer for anyone). The attacker's player cannot answer for someone else.
- Until the prompt is answered, the hit or cast is held and nothing is applied. There is no timer: a prompt waits until answered or until the GM skips it.
- You get one reaction per round. Dead, unconscious and incapacitated creatures are not offered one.
- A Shield bonus applies to the attack that triggered it, so a hit can become a miss. Counterspell with a slot at least as high as the spell counters it; a lower slot needs an ability check from the Counterspell holder, and a failed check still spends the slot.
- With auto-roll on you are still asked whether to react; only the dice are rolled for you.

### Roll visibility (players)

When you roll you choose where the result goes: **Table** (everyone, the default), **To GM**, or **Just me**. Rolls that change your Character's state (such as spending hit dice on a short rest) never go to "Just me". You never see the GM's private rolls.

## For GMs

### Preparing and presenting Scenes

- In **Live maps**, upload a map (JPEG, PNG or WebP, up to 25 MiB, 8192 pixels per side), name it, choose Square or Gridless, calibrate the grid on the map and set the cell size and unit (feet, metres or squares).
- Only you can present a Scene. Choose it from **Present a scene**. Only you can add, change or remove tokens and walls, and edit fog.
- **Show to players** is separate: it shows an image to players without presenting a Scene.
- Wall types: wall, door, window and one-way block movement; terrain only slows it. Fog is optional per Scene (off, shared by the party, or per player). Tokens you mark hidden are not sent to players.

### Running an Encounter

- Choose **Assisted** or **Manual** in the Campaign's table settings before you create the Encounter.
- **Initiative**: you can roll or enter it for anyone. In Manual mode **Start encounter** stays disabled until every combatant has initiative. A player may roll or enter initiative once for a Character they control; a second attempt, or someone else's Character, is refused. Once the order is set, only you change it, including the tie-break order. Ties go to the higher Dexterity score; if equal, you choose the order. A Speed Factor initiative variant is also available.
- **Turn controls**: Current turn, Previous turn, Next turn, Undo last action, Complete encounter.
- Non-Character creatures have a **Roll initiative** button and an Initiative number field.
- **Opportunity attacks, legendary windows and Legendary Resistance** prompt the creature's controller, which for monsters is you.
- **Skip decision**: cancels a paused action and treats declinable choices as declined. It is refused for decisions play cannot continue without (initiative, saves, Recharge, legendary dice, dice during a move).
- Remove a creature from a pending area from the pending area prompt.

### Public and Private rolls

- A **Public / Private** switch (**Roll visibility**) sits in the action drawer, the roll prompt and the GM roller. Your last choice is remembered on your profile; the default is Public.
- It governs your manual rolls and the app's automatic rolls for monsters, including a monster's save against a player's spell. A hidden creature's roll is always Private. A player's own rolls always go to the table, whatever your switch says.
- Find your private rolls in chat under **My rolls**, and the Encounter's enemy rolls under **Enemy rolls**.
- Each private roll has two one-time reveal buttons: **Show roll** (posts the full roll to the table, marked "Revealed by GM") and **Show that I rolled** (tells the table you rolled, naming the creature if it was one). Each can be used once. A private roll made before the live table opened cannot be revealed until the session ends.

### Undo: what it can and cannot do

There are two separate undos, and only you can use them. Players cannot undo anything at the live table.

**Undo last token move** (the stage icon)

- Restores the token's position and the fog from the latest unmatched move.
- Refused if there is nothing to undo, the move settled Encounter mechanics (for example a successful climb), the move was part of an action (undo the action instead), the token changed since, or a movement decision is pending.

**Undo last action** (Encounter turn menu)

- Restores hit points, conditions, resources, effects, the action used and spell slots (including pact slots). It cannot be redone.
- Works only if that action is the latest change in the Encounter.
- Refused when a decision is pending, the Encounter is not active, or it is already undone.
- Refused with an "adjust manually" message when the action involved things the app cannot rewind: a contested escape, mirrored damage, an escaped grapple, a pushed creature that has since moved, ended effects, zone or cleaving damage to a Character, token moves on the Scene, or a Sheet or equipment that changed since. A spell slot is not restored if the player has since spent that slot from their Sheet.
- Undoing an action whose damage ended a Concentration is refused and names what it cannot restore.
- Zone placement has its own **Undo placement** while it is the last action.

**Cannot be undone**: there is no way to un-reveal a roll, and a replaced Concentration cannot be restored by undo.

### Not built yet at the table

- Surprise rounds, and delay or ready actions, are not available. Rule them by hand.
- Whether a token may move off its turn is not enforced by the movement path (not confirmed in tests).

## Known gaps

These are things you may run into. None is a surprise bug: the team knows about each and has decided it can wait. When one comes up, the GM rules it by hand and play carries on. (More are listed under [Spells](#spells) and [Undo](#undo-what-it-can-and-cannot-do) above.)

### Table and map

- **Hex grids are not available.** Scenes are square or gridless.
- **Distances are in feet.** A Scene's grid can be calibrated in metres, but rules distances (range, reach, speed) stay in feet.
- **No surprise round.** Features that depend on being surprised (Assassinate's automatic critical, Surprise Attack, Foresight's "can't be surprised") are description only.
- **Daylight is all or nothing per Scene.** A torch-lit room on a daylit map counts as sunlight, which matters for sunlight-sensitive creatures. The GM can rule it or turn the Scene's daylight off.
- **No hazard or trap tools beyond the basics.** The GM places a zone, sets the spot and disarm numbers, and reveals or disarms it by hand.
- **Other players see a roll as a text card.** Only the roller sees the dice animate.
- **A death save shows its result on the Sheet only.** The tabletop shows the prompt but no tally or token mark.
- **Pushes can stop early.** If a push or pull needs a free square and none is within 5 feet, the creature stays put and may overlap its target. The GM moves the token.

### Combat

- **Manual mode gives no reminders.** In Manual mode the app does not hint that an opportunity attack, ongoing damage or a Concentration check is due.
- **Hands and components are not checked.** A caster holding a sword and shield can still cast a spell with somatic or material components, and free object interactions are not counted.
- **Hitting cover is not a rule here.** A ranged attack that misses only because of cover simply misses.
- **Undo does not cover contests.** Grapple, Shove, Disarm and contested escapes cannot be undone; the GM adjusts by hand.
- **Group tokens are one token.** A group makes one attack per creature in it, so four bears make four attacks, not eight. Multi-creature Conjure spells make one group token, and the GM raises the group count when a higher slot should add creatures.
- **Defeat bonuses are limited to the holder's own actions.** Features that reward a kill (Dark One's Blessing) give nothing for a kill by a movement reaction, a contest or a zone. The GM adds it.
- **Some creature features are partial.** Examples: a Vampire's regeneration does not stop in sunlight or running water, Death Throes do not chain from one dying Balor to another, and a long rest for a creature does not restore its hit points. The GM applies the missing step.
- **Initiative variants.** With Speed Factor, basic actions such as Dodge cannot be declared, so a creature could pick a light action for the bonus and then do something else.

### Spells and features

- **Some spell parts are description only.** Where a spell names an effect the app cannot yet model (for example, ending a chosen list of creatures' conditions with Heroes' Feast, or Mass Heal's shared pool), the GM resolves it.
- **Dice are spent on the first matching roll.** Guidance and Resistance cannot be saved for later or applied to initiative.
- **Metamagic, Monk and Warlock gaps.** See [Spells](#spells) for the Sorcerer list. Open Hand pushes exactly 15 feet; the GM moves the token back if the Monk wants less.
- **Spell-slot recovery is not limited by the app.** Arcane Recovery and Natural Recovery are not restricted to a short rest, so keep to the rule yourselves.
- **Magic Weapon does not start Concentration** until its source data is corrected; track it by hand.

## Sending feedback

Tell us when something is wrong, confusing or missing, including things that look like the gaps above. The more exactly you can point at the moment, the faster it is fixed. Please include:

1. **Campaign**: its name.
2. **Scene**: the name of the Scene on screen.
3. **Round and turn**: the Encounter round, and whose turn it was.
4. **Mode**: Assisted or Manual, and whether Auto-roll was on.
5. **What you expected** to happen.
6. **What happened instead**, with a screenshot if you can, and the exact wording of any warning or error.
7. **Whether you can repeat it**, and the steps if so.

Check this list first: a known gap does not need a report, though a note that it hurt your table is useful.
