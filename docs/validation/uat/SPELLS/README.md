# Saves, conditions and spells — UAT scenarios

Feature `SPELLS` in the [phase ledger](../../../roadmap/08-phase-ledger.json). Set up first: [README](../OPERATOR.md#setup).

These scenarios play real casters and monsters through saves, conditions, dying, Concentration, areas, grants, zones and summons so a GM and players can trust the spell and rules layer at a live table. Scenarios 1 and 2 build the shared casters and arena that most later scenarios reuse; see [accounts](../README.md#roles-and-accounts), [review data](../OPERATOR.md#review-data) and [running several users side by side](../README.md#role-setup-for-the-owner). Record outcomes as described in [recording results](../README.md#recording-results); known holes are in [known UAT gaps](../OPERATOR.md#known-uat-gaps).

**Shared cast (built once in scenario 1, reused everywhere).** Spell lists are for setup; if a Character cannot prepare them all at once, prepare only what the running scenario names and swap on the Sheet.

- **Sage** (P1): Wizard, Evocation school, level 9, quarterstaff. Spells: Fireball, Lightning Bolt, Burning Hands, Thunderwave, Magic Missile, Scorching Ray, Shield, Counterspell, Charm Person, Hold Person, Fear, Blindness/Deafness, Invisibility, Misty Step, Dimension Door, Telepathic Bond, Find Familiar, Darkvision, Fly, Ray of Frost, Shocking Grasp, and any other cantrips you like. Equipment: Caltrops (bag of 20), Oil (flask), Hunting Trap. (Absorb Elements is not an SRD spell; the reaction-spell journey that needs it is [UAT-REACTION-5](../REACTION/README.md).)
- **Hale** (P2): Cleric, level 13 (needed for the 7th-level Plane Shift), mace. Spells: Spare the Dying, Aid, Bless, Protection from Energy, Spirit Guardians, Sanctuary, Shield of Faith, Blade Barrier, Word of Recall, Plane Shift, Guidance. Equipment: a Healer's Kit, 2 Antitoxin (vial) and 1 Potion of Healing.
- **Vex** (P3): Bard, level 5. Spells: Vicious Mockery, Heroism, Longstrider, Hold Person, Fear.
- **Moss** (P3's second Character): Druid, level 9. Spells: Conjure Animals, Entangle, Spike Growth, Moonbeam, Giant Insect, Insect Plague, Longstrider, Darkvision.
- **Kade** (P2's second Character): Monk, Way of the Open Hand, level 11 (holds Tranquility); only used in scenario 26.
- Scenario 27 builds three more one-off Characters for P3 (a Hill Dwarf, a Lightfoot Halfling and a Warlock).
- GM Creatures used (add from the SRD list): Goblin, Wolf, Bandit, Ogre, Gargoyle, Zombie, Giant Spider, Magma Mephit, Unicorn, Adult Red Dragon, Silver Dragon Wyrmling, Gorgon.

**Which Campaign, which Character, and when to swap.** Every scenario from 2 on runs in **Review: Party in the Field** (members P1, P2, P3). A player can have only one Character assigned to a Campaign at a time (the Party roster's **Add Character** / **Change Character** button, then pick from the Character picker), and a Character can sit in only one Campaign. So nobody ever has two Characters in this Campaign at once; they swap, and **only between Encounters** (GM chooses **Complete encounter**, the player changes Character, the GM rebuilds the arena with scenario 2 steps 4 and 5):

- **P1** plays **Sage** in every scenario (she replaces Aria in scenario 2; Aria's, Bryn's and Cade's tokens are removed from the arena because they are no longer in the Party).
- **P2** plays **Hale** in every scenario except scenario 26 part B, where P2 swaps to **Kade** (and ends the scenario as Kade).
- **P3** plays **Vex** in scenarios 2 to 18, swaps to **Moss** at the start of scenario 19 and stays Moss through scenario 26. Scenario 27 swaps P3 through three one-off Characters.
- Where a scenario completes the Encounter (6, 12, 16, 22 part B, 23), its last step says to rebuild the arena. A rebuilt arena keeps hit points, slots and conditions the Characters already have; if a caster runs short of slots, take a **Long Rest** on the Sheet between scenarios. Remove stray conditions and Exhaustion from a Character before the next scenario.
- The Encounter, the Auto-roll switch and Undo are the GM's. Players cannot undo anything.

All four accounts start with Roll my dice automatically OFF, so roll prompts appear and you can type physical dice. Scenarios that need it ON say so.

## Scenarios

One file per scenario, listed in the order the [tracker](../TRACKER.md) runs them. Each file ends with a Result block to fill in.

| Path position | Level | Scenario                          | Title                                                                                       |
| ------------- | ----- | --------------------------------- | ------------------------------------------------------------------------------------------- |
| 151           | 4     | [UAT-SPELLS-1](UAT-SPELLS-1.md)   | Build the casters and cast from the Sheet outside an Encounter                              |
| 152           | 4     | [UAT-SPELLS-2](UAT-SPELLS-2.md)   | Set up the Spell Arena Encounter (Assisted)                                                 |
| 153           | 4     | [UAT-SPELLS-3](UAT-SPELLS-3.md)   | Fireball on a group with saves answered by different controllers                            |
| 154           | 4     | [UAT-SPELLS-4](UAT-SPELLS-4.md)   | Area caster cannot see a hidden creature                                                    |
| 155           | 4     | [UAT-SPELLS-5](UAT-SPELLS-5.md)   | Cones, lines, Self cubes and aiming on the map                                              |
| 156           | 4     | [UAT-SPELLS-6](UAT-SPELLS-6.md)   | Cover from walls and manual cover                                                           |
| 157           | 4     | [UAT-SPELLS-7](UAT-SPELLS-7.md)   | Hold Person, Concentration, damage checks, replacement and end                              |
| 159           | 4     | [UAT-SPELLS-8](UAT-SPELLS-8.md)   | Attack and check modifiers from conditions                                                  |
| 160           | 4     | [UAT-SPELLS-9](UAT-SPELLS-9.md)   | Exhaustion 4 and 6, Petrified resistance, nonmagical defenses and automatic failures        |
| 161           | 4     | [UAT-SPELLS-10](UAT-SPELLS-10.md) | Dying, death saves, healing and kills                                                       |
| 162           | 4     | [UAT-SPELLS-11](UAT-SPELLS-11.md) | Stabilizing: Spare the Dying, Healer's Kit and first aid                                    |
| 163           | 4     | [UAT-SPELLS-12](UAT-SPELLS-12.md) | Single-use items and Antitoxin                                                              |
| 164           | 4     | [UAT-SPELLS-13](UAT-SPELLS-13.md) | Reaction spells: Shield and Counterspell, one-roll grants                                   |
| 165           | 4     | [UAT-SPELLS-14](UAT-SPELLS-14.md) | Reaction countdown timer                                                                    |
| 166           | 4     | [UAT-SPELLS-15](UAT-SPELLS-15.md) | Grant spells and their lifetimes                                                            |
| 167           | 4     | [UAT-SPELLS-16](UAT-SPELLS-16.md) | Grants and Concentration carry over after the Encounter                                     |
| 168           | 4     | [UAT-SPELLS-17](UAT-SPELLS-17.md) | Two Concentrations with an authored ring                                                    |
| 169           | 4     | [UAT-SPELLS-18](UAT-SPELLS-18.md) | Dragons, breath weapons and Legendary Resistance                                            |
| 170           | 4     | [UAT-SPELLS-19](UAT-SPELLS-19.md) | Zones, auras and lasting hazards                                                            |
| 171           | 4     | [UAT-SPELLS-20](UAT-SPELLS-20.md) | Multi-target spells and teleports                                                           |
| 172           | 4     | [UAT-SPELLS-21](UAT-SPELLS-21.md) | Invisibility, Sanctuary, Fear and Blindness                                                 |
| 173           | 4     | [UAT-SPELLS-22](UAT-SPELLS-22.md) | Summons: turns, groups and ends                                                             |
| 174           | 4     | [UAT-SPELLS-23](UAT-SPELLS-23.md) | Manual mode raises no rules prompts                                                         |
| 175           | 4     | [UAT-SPELLS-24](UAT-SPELLS-24.md) | Privacy and permissions refusals                                                            |
| 176           | 4     | [UAT-SPELLS-25](UAT-SPELLS-25.md) | Phone width: Sheet death saves and summons                                                  |
| 177           | 4     | [UAT-SPELLS-26](UAT-SPELLS-26.md) | Sheet attack rows match the room, and an always-on feature that rests restore (Tranquility) |
| 178           | 4     | [UAT-SPELLS-27](UAT-SPELLS-27.md) | Racial traits, creature traits and Eldritch Blast                                           |

## Covered elsewhere

| AC          | Why not a UAT step                                                                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SPELLS-4.1  | Corpus-wide conversion of CLOSED_RULE to authored options, proved by authoring-parity tests; nothing differs on screen for the tester.                                                                  |
| SPELLS-6.1  | A rules audit whose output is a slice list; no tester-visible behaviour.                                                                                                                                |
| SPELLS-25.1 | Schema and corpus check that every zone sets attachmentKind; a failing zone cannot be built, so there is no screen to compare. Scenario 19 shows the zones that work.                                   |
| SPELLS-31.1 | TODO in the ledger: corpus conversion of class and subclass feature closed rules with authoring-parity proofs. Run a UAT spot check (for example Open Hand Tranquility in scenario 26) once it is DONE. |
