# Saves, conditions and spells — UAT scenarios

Feature `SPELLS` in the [phase ledger](../../../roadmap/08-phase-ledger.json). Every role is a different person on their own device, signed in to their own account.

These scenarios play real casters and monsters through saves, conditions, dying, Concentration, areas, grants, zones and summons so a GM and players can trust the spell and rules layer at a live table. Scenarios 1 and 2 build the shared casters and arena that most later scenarios reuse; see [accounts](../README.md#roles-and-accounts). The Campaign is the free-plan Campaign hosted by GM with P1, P2 and P3 seated; every Character is built by its player in the Character Builder, and Aria (P1), Bryn (P2) and Cade (P3) are the level 1 Fighters the players seated first. A free account holds 6 personal Characters, which is enough for every player in this series. Record outcomes as described in [recording results](../TESTERS.md#recording-results); known holes are in [known UAT gaps](../OPERATOR.md#known-uat-gaps).

**Shared cast (built once in scenario 1, reused everywhere).** Spell lists are for setup; if a Character cannot prepare them all at once, prepare only what the running scenario names and swap on the Sheet.

- **Sage** (P1): Wizard, Evocation school, level 9, quarterstaff. Spells: Fireball, Lightning Bolt, Burning Hands, Thunderwave, Magic Missile, Scorching Ray, Shield, Counterspell, Charm Person, Hold Person, Fear, Blindness/Deafness, Invisibility, Misty Step, Dimension Door, Telepathic Bond, Find Familiar, Darkvision, Fly, Ray of Frost, Shocking Grasp, and any other cantrips you like. Equipment: Caltrops (bag of 20), Oil (flask), Hunting Trap. (Absorb Elements is not an SRD spell; the reaction-spell journey that needs it is [UAT-REACTION-5](../REACTION/README.md).)
- **Hale** (P2): Cleric, level 13 (needed for the 7th-level Plane Shift), mace. Spells: Spare the Dying, Aid, Bless, Protection from Energy, Spirit Guardians, Sanctuary, Shield of Faith, Blade Barrier, Word of Recall, Plane Shift, Guidance. Equipment: a Healer's Kit, 2 Antitoxin (vial) and 1 Potion of Healing.
- **Vex** (P3): Bard, level 5. Spells: Vicious Mockery, Heroism, Longstrider, Hold Person, Fear.
- **Moss** (P3's second Character): Druid, level 9. Spells: Conjure Animals, Entangle, Spike Growth, Moonbeam, Giant Insect, Insect Plague, Longstrider, Darkvision.
- **Kade** (P2's second Character): Monk, Way of the Open Hand, level 11 (holds Tranquility); only used in scenario 26.
- Scenario 27 builds three more one-off Characters for P3 (a Hill Dwarf, a Lightfoot Halfling and a Warlock).
- GM Creatures used (add from the SRD list): Goblin, Wolf, Bandit, Ogre, Gargoyle, Zombie, Giant Spider, Magma Mephit, Unicorn, Adult Red Dragon, Silver Dragon Wyrmling, Gorgon.

**Which Campaign, which Character, and when to swap.** Every scenario from 2 on runs in **The Campaign** (members P1, P2, P3). A player can keep several Characters in a Campaign, but only one is the Active Character that plays at the table; the others are Benched. A player adds a Character with the Party roster's **Add Character** button (pick it from the Character picker; it lands on the bench) and chooses **Mark active** on it, and a Character can sit in only one Campaign. Each player brings in the Character for the next arc **only between Encounters** (GM chooses **Complete encounter**, the player marks the new Character active, the GM rebuilds the arena with scenario 2 steps 4 and 5), so no GM approval is involved (a swap during a running Encounter is covered in [UAT-CAMPAIGN-11](../CAMPAIGN/UAT-CAMPAIGN-11.md)):

- **P1** plays **Sage** in every scenario (she becomes P1's Active Character in scenario 2; Aria, Bryn and Cade stay on the bench, so their tokens are removed from the arena).
- **P2** plays **Hale** in every scenario except scenario 26 part B, where P2 marks **Kade** active (and ends the scenario as Kade).
- **P3** plays **Vex** in scenarios 2 to 18, marks **Moss** active at the start of scenario 19 and stays Moss through scenario 26. Scenario 27 brings P3 through three one-off Characters.
- Where a scenario completes the Encounter (6, 12, 16, 22 part B, 23), its last step says to rebuild the arena. A rebuilt arena keeps hit points, slots and conditions the Characters already have; if a caster runs short of slots, take a **Long Rest** on the Sheet between scenarios. Remove stray conditions and Exhaustion from a Character before the next scenario.
- The Encounter, the Auto-roll switch and Undo are the GM's. Players cannot undo anything.

All accounts start with Roll my dice automatically OFF, so roll prompts appear and you can type physical dice. Scenarios that need it ON say so.

## Covered elsewhere

| AC          | Why not a UAT step                                                                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SPELLS-4.1  | Corpus-wide conversion of CLOSED_RULE to authored options, proved by authoring-parity tests; nothing differs on screen for the tester.                                                                  |
| SPELLS-6.1  | A rules audit whose output is a slice list; no tester-visible behaviour.                                                                                                                                |
| SPELLS-25.1 | Schema and corpus check that every zone sets attachmentKind; a failing zone cannot be built, so there is no screen to compare. Scenario 19 shows the zones that work.                                   |
| SPELLS-31.1 | TODO in the ledger: corpus conversion of class and subclass feature closed rules with authoring-parity proofs. Run a UAT spot check (for example Open Hand Tranquility in scenario 26) once it is DONE. |
