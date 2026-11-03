# UAT tracker

The ordered path through every UAT scenario and exploratory task (188 in all). Run them top to bottom, once; later levels build on earlier ones. This file is the one record of progress; the orchestrator copies accepted results into the ledger's `uat` items.

For each line: tick the box once the scenario has been run, whatever the outcome, and replace **NOT RUN** with **PASSED**, **FAILED**, **BLOCKED** (a gap or an earlier failure stopped it) or **SKIPPED**, plus the date and build, for example `**PASSED** 2026-11-04 487524e5a`. Failure details go in the Result block at the end of the scenario's file, not here. How to run, the accounts and the review data: [README](README.md) and [OPERATOR](OPERATOR.md). Which scenario covers which AC: [COVERAGE](COVERAGE.md).

## Level 0: Orientation and exploratory tasks

- [ ] [UAT-ORIENTATION-1](ORIENTATION/UAT-ORIENTATION-1.md): Sign in as each role and find the review Campaigns (ORIENTATION) - **NOT RUN**
- [ ] [EXPLORATORY-1](EXPLORATORY/EXPLORATORY-1.md): Build a level-3 caster and play one round (EXPLORATORY) - **NOT RUN**
- [ ] [EXPLORATORY-2](EXPLORATORY/EXPLORATORY-2.md): Author a homebrew spell from memory and cast it (EXPLORATORY) - **NOT RUN**
- [ ] [EXPLORATORY-3](EXPLORATORY/EXPLORATORY-3.md): Set up a new encounter on an uploaded map as GM (EXPLORATORY) - **NOT RUN**
- [ ] [EXPLORATORY-4](EXPLORATORY/EXPLORATORY-4.md): Run a short session as a first-time player (EXPLORATORY) - **NOT RUN**
- [ ] [EXPLORATORY-5](EXPLORATORY/EXPLORATORY-5.md): Copy and change an existing monster (EXPLORATORY) - **NOT RUN**
- [ ] [EXPLORATORY-6](EXPLORATORY/EXPLORATORY-6.md): Find out what went wrong (EXPLORATORY) - **NOT RUN**
- [ ] [EXPLORATORY-7](EXPLORATORY/EXPLORATORY-7.md): Hand over a Character mid-campaign (EXPLORATORY) - **NOT RUN**

## Level 1: Single-user basics

- [ ] [UAT-ACCOUNTS-1](ACCOUNTS/UAT-ACCOUNTS-1.md): Sign in, reload, sign out, sign back in by username (ACCOUNTS) - **NOT RUN**
- [ ] [UAT-ACCOUNTS-2](ACCOUNTS/UAT-ACCOUNTS-2.md): Wrong password and unknown account are refused (ACCOUNTS) - **NOT RUN**
- [ ] [UAT-ACCOUNTS-4](ACCOUNTS/UAT-ACCOUNTS-4.md): Public sign-up is closed (ACCOUNTS) - **NOT RUN**
- [ ] [UAT-ACCOUNTS-13](ACCOUNTS/UAT-ACCOUNTS-13.md): Campaign text follows the same language rules as usernames (ACCOUNTS) - **NOT RUN**
- [ ] [UAT-ACCOUNTS-7](ACCOUNTS/UAT-ACCOUNTS-7.md): Choose, change and protect a username (ACCOUNTS) - **NOT RUN**
- [ ] [UAT-ACCOUNTS-8](ACCOUNTS/UAT-ACCOUNTS-8.md): Private profiles stay private; Public profiles show only public fields (ACCOUNTS) - **NOT RUN**
- [ ] [UAT-ACCOUNTS-3](ACCOUNTS/UAT-ACCOUNTS-3.md): Two accounts at once stay isolated, and sign-out ends every tab (ACCOUNTS) - **NOT RUN**
- [ ] [UAT-ACCOUNTS-9](ACCOUNTS/UAT-ACCOUNTS-9.md): Ordinary users cannot use superadmin tools (ACCOUNTS) - **NOT RUN**
- [ ] [UAT-ACCOUNTS-10](ACCOUNTS/UAT-ACCOUNTS-10.md): Superadmin moderation (ACCOUNTS) - **NOT RUN**
- [ ] [UAT-PLATFORM-1](PLATFORM/UAT-PLATFORM-1.md): SRD content is present and browsable (PLATFORM) - **NOT RUN**
- [ ] [UAT-PLATFORM-2](PLATFORM/UAT-PLATFORM-2.md): Upload, replace and remove an avatar (PLATFORM) - **NOT RUN**
- [ ] [UAT-PLATFORM-3](PLATFORM/UAT-PLATFORM-3.md): Artwork is private to its owner until shared (PLATFORM) - **NOT RUN**
- [ ] [UAT-PLATFORM-4](PLATFORM/UAT-PLATFORM-4.md): Password reset email is requested from the app (PLATFORM) - **NOT RUN**
- [ ] [UAT-AUTHORING-1](AUTHORING/UAT-AUTHORING-1.md): Browse Game Systems and Rules Catalogues (AUTHORING) - **NOT RUN**
- [ ] [UAT-AUTHORING-2](AUTHORING/UAT-AUTHORING-2.md): SRD records are locked but can be copied into an owned draft (AUTHORING) - **NOT RUN**
- [ ] [UAT-AUTHORING-3](AUTHORING/UAT-AUTHORING-3.md): Background lifecycle — create, save, publish, replace, export, delete (AUTHORING) - **NOT RUN**
- [ ] [UAT-AUTHORING-10](AUTHORING/UAT-AUTHORING-10.md): Another account cannot see or edit your drafts (AUTHORING) - **NOT RUN**
- [ ] [UAT-AUTHORING-4](AUTHORING/UAT-AUTHORING-4.md): Author, publish and filter a homebrew Spell with artwork (AUTHORING) - **NOT RUN**
- [ ] [UAT-AUTHORING-5](AUTHORING/UAT-AUTHORING-5.md): Author a Class and see the Spell guard (AUTHORING) - **NOT RUN**
- [ ] [UAT-AUTHORING-7](AUTHORING/UAT-AUTHORING-7.md): Equipment variants, inheritance and item names (AUTHORING) - **NOT RUN**
- [ ] [UAT-AUTHORING-8](AUTHORING/UAT-AUTHORING-8.md): Author a Feat, a Race and a Vehicle (AUTHORING) - **NOT RUN**
- [ ] [UAT-AUTHORING-9](AUTHORING/UAT-AUTHORING-9.md): Reusable effects, grants and modifiers on a System (AUTHORING) - **NOT RUN**
- [ ] [UAT-AUTHORING-12](AUTHORING/UAT-AUTHORING-12.md): Option descriptions and adding a Check and a DC (AUTHORING) - **NOT RUN**
- [ ] [UAT-AUTHORING-13](AUTHORING/UAT-AUTHORING-13.md): Author a Fire Bolt-like cantrip from scratch (AUTHORING) - **NOT RUN**
- [ ] [UAT-AUTHORING-14](AUTHORING/UAT-AUTHORING-14.md): Author a Fireball-like spell from scratch (AUTHORING) - **NOT RUN**
- [ ] [UAT-AUTHORING-15](AUTHORING/UAT-AUTHORING-15.md): Author an Empowered Spell-like feature that spends a resource pool (AUTHORING) - **NOT RUN**
- [ ] [UAT-RULES-1](RULES/UAT-RULES-1.md): Authoring forms show, hide and require fields as choices change (RULES) - **NOT RUN**
- [ ] [UAT-BUILDER-1](BUILDER/UAT-BUILDER-1.md): Build a Character for a review player, save, resume and commit (BUILDER) - **NOT RUN**
- [ ] [UAT-BUILDER-2](BUILDER/UAT-BUILDER-2.md): Two windows on one draft cannot overwrite each other (BUILDER) - **NOT RUN**
- [ ] [UAT-BUILDER-3](BUILDER/UAT-BUILDER-3.md): Choice-heavy builds — multiclass and spellcaster (BUILDER) - **NOT RUN**
- [ ] [UAT-BUILDER-7](BUILDER/UAT-BUILDER-7.md): Build the Characters P2 and P3 will use in the Sandbox Campaign (BUILDER) - **NOT RUN**
- [ ] [UAT-BUILDER-4](BUILDER/UAT-BUILDER-4.md): Removing content a Character uses repairs the Character (BUILDER) - **NOT RUN**
- [ ] [UAT-BUILDER-6](BUILDER/UAT-BUILDER-6.md): Imported custom items keep their kind, properties and damage (BUILDER) - **NOT RUN**
- [ ] [UAT-SHEET-1](SHEET/UAT-SHEET-1.md): Edit a personal Sheet and reload (SHEET) - **NOT RUN**
- [ ] [UAT-SHEET-2](SHEET/UAT-SHEET-2.md): Short and long rest (SHEET) - **NOT RUN**
- [ ] [UAT-SHEET-3](SHEET/UAT-SHEET-3.md): Learn, prepare and cast spells from the Sheet (SHEET) - **NOT RUN**
- [ ] [UAT-SHEET-6](SHEET/UAT-SHEET-6.md): Equipment, inventory, attunement and deleting an item (SHEET) - **NOT RUN**
- [ ] [UAT-SHEET-7](SHEET/UAT-SHEET-7.md): Starting equipment on a new Character (SHEET) - **NOT RUN**
- [ ] [UAT-SHEET-8](SHEET/UAT-SHEET-8.md): Hands, two-handed weapons and shields (SHEET) - **NOT RUN**
- [ ] [UAT-SHEET-9](SHEET/UAT-SHEET-9.md): Speed on the overview and the Movement panel (SHEET) - **NOT RUN**
- [ ] [UAT-SHEET-10](SHEET/UAT-SHEET-10.md): Sheet at phone width (SHEET) - **NOT RUN**

## Level 2: GM setup

- [ ] [UAT-CAMPAIGN-1](CAMPAIGN/UAT-CAMPAIGN-1.md): Create, edit, copy, archive and delete a Campaign (CAMPAIGN) - **NOT RUN**
- [ ] [UAT-CAMPAIGN-2](CAMPAIGN/UAT-CAMPAIGN-2.md): Invite, accept, leave, remove, rejoin and transfer (CAMPAIGN) - **NOT RUN**
- [ ] [UAT-CAMPAIGN-9](CAMPAIGN/UAT-CAMPAIGN-9.md): Seat the whole party in the Sandbox Campaign (CAMPAIGN) - **NOT RUN**
- [ ] [UAT-SOCIAL-1](SOCIAL/UAT-SOCIAL-1.md): Create a listing, apply, accept and fill a table (SOCIAL) - **NOT RUN**
- [ ] [UAT-SOCIAL-2](SOCIAL/UAT-SOCIAL-2.md): Invitations and Social Hub navigation (SOCIAL) - **NOT RUN**
- [ ] [UAT-AUTHORING-11](AUTHORING/UAT-AUTHORING-11.md): Share homebrew with a Campaign, then withdraw it (AUTHORING) - **NOT RUN**
- [ ] [UAT-BUILDER-5](BUILDER/UAT-BUILDER-5.md): Withdrawing shared content reconciles assigned Characters (BUILDER) - **NOT RUN**
- [ ] [UAT-CAMPAIGN-4](CAMPAIGN/UAT-CAMPAIGN-4.md): Campaign content, sources and removals (CAMPAIGN) - **NOT RUN**
- [ ] [UAT-CAMPAIGN-5](CAMPAIGN/UAT-CAMPAIGN-5.md): Party inventory and Vehicles (CAMPAIGN) - **NOT RUN**
- [ ] [UAT-CAMPAIGN-7](CAMPAIGN/UAT-CAMPAIGN-7.md): The GM plays a Character (CAMPAIGN) - **NOT RUN**
- [ ] [UAT-CAMPAIGN-6](CAMPAIGN/UAT-CAMPAIGN-6.md): Announcements (CAMPAIGN) - **NOT RUN**
- [ ] [UAT-SCENE-1](SCENE/UAT-SCENE-1.md): Upload a map, calibrate and create a Scene (SCENE) - **NOT RUN**
- [ ] [UAT-SCENE-2](SCENE/UAT-SCENE-2.md): Map upload refusals (SCENE) - **NOT RUN**
- [ ] [UAT-SCENE-3](SCENE/UAT-SCENE-3.md): Present a Scene and build it live (SCENE) - **NOT RUN**
- [ ] [UAT-SCENE-4](SCENE/UAT-SCENE-4.md): Fog of war off, shared and per player (SCENE) - **NOT RUN**
- [ ] [UAT-SCENE-5](SCENE/UAT-SCENE-5.md): Doors (SCENE) - **NOT RUN**
- [ ] [UAT-SCENE-6](SCENE/UAT-SCENE-6.md): Offline edits recover (SCENE) - **NOT RUN**
- [ ] [UAT-SCENE-9](SCENE/UAT-SCENE-9.md): One shared table screen for several players (SCENE) - **NOT RUN**
- [ ] [UAT-MOVE-5](MOVE/UAT-MOVE-5.md): Moving outside an Encounter and in a sandbox (MOVE) - **NOT RUN**
- [ ] [UAT-MOVE-6](MOVE/UAT-MOVE-6.md): Peers converge, reload and departure (MOVE) - **NOT RUN**
- [ ] [UAT-ENCOUNTER-3](ENCOUNTER/UAT-ENCOUNTER-3.md): Prepare, start, delete and persist a Run (ENCOUNTER) - **NOT RUN**
- [ ] [UAT-ENCOUNTER-7](ENCOUNTER/UAT-ENCOUNTER-7.md): Blueprint edits and who can reach them (ENCOUNTER) - **NOT RUN**
- [ ] [UAT-RELIABILITY-4](RELIABILITY/UAT-RELIABILITY-4.md): A new Scene measures lengths correctly in every unit (RELIABILITY) - **NOT RUN**
- [ ] [UAT-SCENE-7](SCENE/UAT-SCENE-7.md): Map ownership and deletion (SCENE) - **NOT RUN**

## Level 3: Core play

- [ ] [UAT-CAMPAIGN-8](CAMPAIGN/UAT-CAMPAIGN-8.md): Not a member (CAMPAIGN) - **NOT RUN**
- [ ] [UAT-CAMPAIGN-3](CAMPAIGN/UAT-CAMPAIGN-3.md): Players see only what the GM made visible (CAMPAIGN) - **NOT RUN**
- [ ] [UAT-ROOM-1](ROOM/UAT-ROOM-1.md): GM and three players join at once (ROOM) - **NOT RUN**
- [ ] [UAT-ROOM-2](ROOM/UAT-ROOM-2.md): Previews and pings (ROOM) - **NOT RUN**
- [ ] [UAT-ROOM-4](ROOM/UAT-ROOM-4.md): Chat — Table, Party and Direct (ROOM) - **NOT RUN**
- [ ] [UAT-ROOM-5](ROOM/UAT-ROOM-5.md): Rolls, private GM rolls and chat limits (ROOM) - **NOT RUN**
- [ ] [UAT-ROOM-6](ROOM/UAT-ROOM-6.md): Notes — private and shared (ROOM) - **NOT RUN**
- [ ] [UAT-ROOM-8](ROOM/UAT-ROOM-8.md): Plan and log Sessions (ROOM) - **NOT RUN**
- [ ] [UAT-ROOM-9](ROOM/UAT-ROOM-9.md): Live play commands go through the room (ROOM) - **NOT RUN**
- [ ] [UAT-ROOM-7](ROOM/UAT-ROOM-7.md): Show a map to players without presenting (ROOM) - **NOT RUN**
- [ ] [UAT-ROOM-10](ROOM/UAT-ROOM-10.md): Archiving a Campaign closes its live room (ROOM) - **NOT RUN**
- [ ] [UAT-SHEET-4](SHEET/UAT-SHEET-4.md): Roll from the Sheet and choose who sees it (SHEET) - **NOT RUN**
- [ ] [UAT-SHEET-5](SHEET/UAT-SHEET-5.md): GM Public and Private rolls with reveals (SHEET) - **NOT RUN**
- [ ] [UAT-SHEET-11](SHEET/UAT-SHEET-11.md): Sheet during live play and after reconnect (SHEET) - **NOT RUN**
- [ ] [UAT-AUTHORING-6](AUTHORING/UAT-AUTHORING-6.md): Creature copy, computed AC and the item loadout (AUTHORING) - **NOT RUN**
- [ ] [UAT-ATTACK-1](ATTACK/UAT-ATTACK-1.md): Effects, movement, reactions and the turn lifecycle pass end to end (ATTACK) - **NOT RUN**
- [ ] [UAT-ATTACK-2](ATTACK/UAT-ATTACK-2.md): Players control only their own actors (ATTACK) - **NOT RUN**
- [ ] [UAT-ATTACK-5](ATTACK/UAT-ATTACK-5.md): Targeting, hidden creatures and private roll cards (ATTACK) - **NOT RUN**
- [ ] [UAT-ATTACK-6](ATTACK/UAT-ATTACK-6.md): Hiding, invisibility and unseen attackers (ATTACK) - **NOT RUN**
- [ ] [UAT-ATTACK-8](ATTACK/UAT-ATTACK-8.md): Grapple, shove and basic actions (ATTACK) - **NOT RUN**
- [ ] [UAT-ATTACK-10](ATTACK/UAT-ATTACK-10.md): Multiattack and SRD monster attacks (ATTACK) - **NOT RUN**
- [ ] [UAT-PRIVACY-1](PRIVACY/UAT-PRIVACY-1.md): What a player sees of the Encounter (PRIVACY) - **NOT RUN**
- [ ] [UAT-PRIVACY-2](PRIVACY/UAT-PRIVACY-2.md): GM private rolls and monster rolls (PRIVACY) - **NOT RUN**
- [ ] [UAT-PRIVACY-5](PRIVACY/UAT-PRIVACY-5.md): Reloads and replays do not leak (PRIVACY) - **NOT RUN**
- [ ] [UAT-PRIVACY-6](PRIVACY/UAT-PRIVACY-6.md): Health display settings (PRIVACY) - **NOT RUN**
- [ ] [UAT-PRIVACY-7](PRIVACY/UAT-PRIVACY-7.md): Other players' Sheets and Campaign roster (PRIVACY) - **NOT RUN**
- [ ] [UAT-MOVE-1](MOVE/UAT-MOVE-1.md): A player moves their own token (MOVE) - **NOT RUN**
- [ ] [UAT-MOVE-3](MOVE/UAT-MOVE-3.md): Opportunity attack pauses the move (MOVE) - **NOT RUN**
- [ ] [UAT-MOVE-4](MOVE/UAT-MOVE-4.md): Undo last token move (MOVE) - **NOT RUN**
- [ ] [UAT-MOVE-7](MOVE/UAT-MOVE-7.md): Overrun, Shove Aside and Tumble (MOVE) - **NOT RUN**
- [ ] [UAT-REACTION-2](REACTION/UAT-REACTION-2.md): Only the right controller answers; GM Skip decision (REACTION) - **NOT RUN**
- [ ] [UAT-REACTION-1](REACTION/UAT-REACTION-1.md): Shield prompts the right player while the attacker waits (REACTION) - **NOT RUN**
- [ ] [UAT-REACTION-3](REACTION/UAT-REACTION-3.md): Roll prompts, Auto-roll on versus off (REACTION) - **NOT RUN**
- [ ] [UAT-REACTION-5](REACTION/UAT-REACTION-5.md): An authored reaction spell (Absorb Elements) (REACTION) - **NOT RUN**
- [ ] [UAT-REACTION-7](REACTION/UAT-REACTION-7.md): Reconnect while a decision is open (REACTION) - **NOT RUN**
- [ ] [UAT-RULES-3](RULES/UAT-RULES-3.md): A reaction pauses a hit; answering resumes it; privacy of the pause (RULES) - **NOT RUN**
- [ ] [UAT-RULES-4](RULES/UAT-RULES-4.md): Healing keeps its dice and modifier visible in the roll card (RULES) - **NOT RUN**
- [ ] [UAT-VTT_UI-1](VTT_UI/UAT-VTT_UI-1.md): Token identity, status rings, facing and system state (VTT_UI) - **NOT RUN**
- [ ] [UAT-VTT_UI-2](VTT_UI/UAT-VTT_UI-2.md): Previews, footprints, large tokens and dragging (VTT_UI) - **NOT RUN**
- [ ] [UAT-VTT_UI-4](VTT_UI/UAT-VTT_UI-4.md): Keyboard, screen reader and low zoom (VTT_UI) - **NOT RUN**
- [ ] [UAT-PRIVACY-9](PRIVACY/UAT-PRIVACY-9.md): A hidden Concentration source stays hidden (PRIVACY) - **NOT RUN**
- [ ] [UAT-RELIABILITY-1](RELIABILITY/UAT-RELIABILITY-1.md): Privacy, replay, rollback, concurrency and performance hold together (RELIABILITY) - **NOT RUN**
- [ ] [UAT-RELIABILITY-2](RELIABILITY/UAT-RELIABILITY-2.md): Two users act at the same moment (RELIABILITY) - **NOT RUN**
- [ ] [UAT-RELIABILITY-3](RELIABILITY/UAT-RELIABILITY-3.md): The room closes after everyone leaves and reopens with state intact (RELIABILITY) - **NOT RUN**
- [ ] [UAT-RELIABILITY-6](RELIABILITY/UAT-RELIABILITY-6.md): A contested passage holds, then spends once (RELIABILITY) - **NOT RUN**
- [ ] [UAT-RELIABILITY-8](RELIABILITY/UAT-RELIABILITY-8.md): The Sheet shows correct rests, ability checks and hit points (RELIABILITY) - **NOT RUN**
- [ ] [UAT-PERF-2](PERF/UAT-PERF-2.md): Four people at a local table feel responsive (PERF) - **NOT RUN**
- [ ] [UAT-MOVE-2](MOVE/UAT-MOVE-2.md): Refusals at walls, hostile spaces and the map edge (MOVE) - **NOT RUN**
- [ ] [UAT-MOVE-8](MOVE/UAT-MOVE-8.md): Hidden hazards, traps and auras (MOVE) - **NOT RUN**
- [ ] [UAT-MOVE-9](MOVE/UAT-MOVE-9.md): Climb onto a larger creature (MOVE) - **NOT RUN**
- [ ] [UAT-PRIVACY-4](PRIVACY/UAT-PRIVACY-4.md): Ownership transfer changes who sees what (PRIVACY) - **NOT RUN**
- [ ] [UAT-ROOM-3](ROOM/UAT-ROOM-3.md): Reconnect after a dropped connection (ROOM) - **NOT RUN**
- [ ] [UAT-PRIVACY-3](PRIVACY/UAT-PRIVACY-3.md): Non-members, removed players and signed-out visitors (PRIVACY) - **NOT RUN**
- [ ] [UAT-PRIVACY-8](PRIVACY/UAT-PRIVACY-8.md): Campaign content stays hidden until revealed (PRIVACY) - **NOT RUN**
- [ ] [UAT-ATTACK-7](ATTACK/UAT-ATTACK-7.md): Optional combat rules in play (ATTACK) - **NOT RUN**
- [ ] [UAT-ATTACK-9](ATTACK/UAT-ATTACK-9.md): Class features in play (ATTACK) - **NOT RUN**
- [ ] [UAT-ATTACK-11](ATTACK/UAT-ATTACK-11.md): Weapons in hand, loadouts and Disarm (ATTACK) - **NOT RUN**
- [ ] [UAT-ENCOUNTER-5](ENCOUNTER/UAT-ENCOUNTER-5.md): Morale (ENCOUNTER) - **NOT RUN**
- [ ] [UAT-REACTION-4](REACTION/UAT-REACTION-4.md): Counterspell and chains (REACTION) - **NOT RUN**
- [ ] [UAT-REACTION-6](REACTION/UAT-REACTION-6.md): Disarm evidence from participants (REACTION) - **NOT RUN**
- [ ] [UAT-RELIABILITY-7](RELIABILITY/UAT-RELIABILITY-7.md): Authored speed and sense bonuses use the right length unit (RELIABILITY) - **NOT RUN**
- [ ] [UAT-RELIABILITY-9](RELIABILITY/UAT-RELIABILITY-9.md): Roll reasons and initiative read the right source (RELIABILITY) - **NOT RUN**
- [ ] [UAT-VTT_UI-3](VTT_UI/UAT-VTT_UI-3.md): Light, fog, senses and the GM's view preview (VTT_UI) - **NOT RUN**

## Level 4: Advanced play

- [ ] [UAT-ENCOUNTER-6](ENCOUNTER/UAT-ENCOUNTER-6.md): Roll cards for turn-stage rolls (ENCOUNTER) - **NOT RUN**
- [ ] [UAT-ENCOUNTER-4](ENCOUNTER/UAT-ENCOUNTER-4.md): Controllers, dispositions and removing a member (ENCOUNTER) - **NOT RUN**
- [ ] [UAT-ENCOUNTER-1](ENCOUNTER/UAT-ENCOUNTER-1.md): Assisted and Manual Encounter journeys pass (ENCOUNTER) - **NOT RUN**
- [ ] [UAT-ENCOUNTER-2](ENCOUNTER/UAT-ENCOUNTER-2.md): Initiative and optional-combat combinations pass end to end (ENCOUNTER) - **NOT RUN**
- [ ] [UAT-SCENE-8](SCENE/UAT-SCENE-8.md): GM loot tables (SCENE) - **NOT RUN**
- [ ] [UAT-ATTACK-3](ATTACK/UAT-ATTACK-3.md): Assisted warnings and "Do it anyway" (ATTACK) - **NOT RUN**
- [ ] [UAT-ATTACK-4](ATTACK/UAT-ATTACK-4.md): Undo last action and its refusals (ATTACK) - **NOT RUN**
- [ ] [UAT-RULES-2](RULES/UAT-RULES-2.md): A started Encounter pauses for answers and resumes with nothing half-applied (RULES) - **NOT RUN**
- [ ] [UAT-RULES-5](RULES/UAT-RULES-5.md): An attack with two damage parts keeps each part visible (RULES) - **NOT RUN**
- [ ] [UAT-SOCIAL-3](SOCIAL/UAT-SOCIAL-3.md): Blocks and what they do (SOCIAL) - **NOT RUN**
- [ ] [UAT-SOCIAL-4](SOCIAL/UAT-SOCIAL-4.md): Private profiles and masking (SOCIAL) - **NOT RUN**
- [ ] [UAT-SOCIAL-5](SOCIAL/UAT-SOCIAL-5.md): Notification feed, read state and preferences (SOCIAL) - **NOT RUN**
- [ ] [UAT-SPELLS-1](SPELLS/UAT-SPELLS-1.md): Build the casters and cast from the Sheet outside an Encounter (SPELLS) - **NOT RUN**
- [ ] [UAT-SPELLS-2](SPELLS/UAT-SPELLS-2.md): Set up the Spell Arena Encounter (Assisted) (SPELLS) - **NOT RUN**
- [ ] [UAT-SPELLS-3](SPELLS/UAT-SPELLS-3.md): Fireball on a group with saves answered by different controllers (SPELLS) - **NOT RUN**
- [ ] [UAT-SPELLS-4](SPELLS/UAT-SPELLS-4.md): Area caster cannot see a hidden creature (SPELLS) - **NOT RUN**
- [ ] [UAT-SPELLS-5](SPELLS/UAT-SPELLS-5.md): Cones, lines, Self cubes and aiming on the map (SPELLS) - **NOT RUN**
- [ ] [UAT-SPELLS-6](SPELLS/UAT-SPELLS-6.md): Cover from walls and manual cover (SPELLS) - **NOT RUN**
- [ ] [UAT-SPELLS-7](SPELLS/UAT-SPELLS-7.md): Hold Person, Concentration, damage checks, replacement and end (SPELLS) - **NOT RUN**
- [ ] [UAT-PLATFORM-5](PLATFORM/UAT-PLATFORM-5.md): A Concentration save shows its result on the roll card (PLATFORM) - **NOT RUN**
- [ ] [UAT-SPELLS-8](SPELLS/UAT-SPELLS-8.md): Attack and check modifiers from conditions (SPELLS) - **NOT RUN**
- [ ] [UAT-SPELLS-9](SPELLS/UAT-SPELLS-9.md): Exhaustion 4 and 6, Petrified resistance, nonmagical defenses and automatic failures (SPELLS) - **NOT RUN**
- [ ] [UAT-SPELLS-10](SPELLS/UAT-SPELLS-10.md): Dying, death saves, healing and kills (SPELLS) - **NOT RUN**
- [ ] [UAT-SPELLS-11](SPELLS/UAT-SPELLS-11.md): Stabilizing: Spare the Dying, Healer's Kit and first aid (SPELLS) - **NOT RUN**
- [ ] [UAT-SPELLS-12](SPELLS/UAT-SPELLS-12.md): Single-use items and Antitoxin (SPELLS) - **NOT RUN**
- [ ] [UAT-SPELLS-13](SPELLS/UAT-SPELLS-13.md): Reaction spells: Shield and Counterspell, one-roll grants (SPELLS) - **NOT RUN**
- [ ] [UAT-SPELLS-14](SPELLS/UAT-SPELLS-14.md): Reaction countdown timer (SPELLS) - **NOT RUN**
- [ ] [UAT-SPELLS-15](SPELLS/UAT-SPELLS-15.md): Grant spells and their lifetimes (SPELLS) - **NOT RUN**
- [ ] [UAT-SPELLS-16](SPELLS/UAT-SPELLS-16.md): Grants and Concentration carry over after the Encounter (SPELLS) - **NOT RUN**
- [ ] [UAT-SPELLS-17](SPELLS/UAT-SPELLS-17.md): Two Concentrations with an authored ring (SPELLS) - **NOT RUN**
- [ ] [UAT-SPELLS-18](SPELLS/UAT-SPELLS-18.md): Dragons, breath weapons and Legendary Resistance (SPELLS) - **NOT RUN**
- [ ] [UAT-SPELLS-19](SPELLS/UAT-SPELLS-19.md): Zones, auras and lasting hazards (SPELLS) - **NOT RUN**
- [ ] [UAT-SPELLS-20](SPELLS/UAT-SPELLS-20.md): Multi-target spells and teleports (SPELLS) - **NOT RUN**
- [ ] [UAT-SPELLS-21](SPELLS/UAT-SPELLS-21.md): Invisibility, Sanctuary, Fear and Blindness (SPELLS) - **NOT RUN**
- [ ] [UAT-SPELLS-22](SPELLS/UAT-SPELLS-22.md): Summons: turns, groups and ends (SPELLS) - **NOT RUN**
- [ ] [UAT-SPELLS-23](SPELLS/UAT-SPELLS-23.md): Manual mode raises no rules prompts (SPELLS) - **NOT RUN**
- [ ] [UAT-SPELLS-24](SPELLS/UAT-SPELLS-24.md): Privacy and permissions refusals (SPELLS) - **NOT RUN**
- [ ] [UAT-SPELLS-25](SPELLS/UAT-SPELLS-25.md): Phone width: Sheet death saves and summons (SPELLS) - **NOT RUN**
- [ ] [UAT-SPELLS-26](SPELLS/UAT-SPELLS-26.md): Sheet attack rows match the room, and an always-on feature that rests restore (Tranquility) (SPELLS) - **NOT RUN**
- [ ] [UAT-SPELLS-27](SPELLS/UAT-SPELLS-27.md): Racial traits, creature traits and Eldritch Blast (SPELLS) - **NOT RUN**

## Level 5: Reliability, performance and release

- [ ] [UAT-RELIABILITY-5](RELIABILITY/UAT-RELIABILITY-5.md): Forms and sign-out recover without silent data loss (RELIABILITY) - **NOT RUN**
- [ ] [UAT-RELIABILITY-10](RELIABILITY/UAT-RELIABILITY-10.md): Builder and party inventory values are right (RELIABILITY) - **NOT RUN**
- [ ] [UAT-RELIABILITY-11](RELIABILITY/UAT-RELIABILITY-11.md): Authoring selects, labels and lists (RELIABILITY) - **NOT RUN**
- [ ] [UAT-RELIABILITY-12](RELIABILITY/UAT-RELIABILITY-12.md): Core pages open with their data (RELIABILITY) - **NOT RUN**
- [ ] [UAT-ACCOUNTS-5](ACCOUNTS/UAT-ACCOUNTS-5.md): Reset a forgotten password (wrong code, mismatch, then success) (ACCOUNTS) - **NOT RUN**
- [ ] [UAT-ACCOUNTS-6](ACCOUNTS/UAT-ACCOUNTS-6.md): Create an account from an invitation (ACCOUNTS) - **NOT RUN**
- [ ] [UAT-ACCOUNTS-11](ACCOUNTS/UAT-ACCOUNTS-11.md): Refused account deletions (ACCOUNTS) - **NOT RUN**
- [ ] [UAT-ACCOUNTS-12](ACCOUNTS/UAT-ACCOUNTS-12.md): Delete my account, shared history survives (ACCOUNTS) - **NOT RUN**
- [ ] [UAT-SOCIAL-6](SOCIAL/UAT-SOCIAL-6.md): Plan limits and capacity (SOCIAL) - **NOT RUN**
- [ ] [UAT-RELIABILITY-13](RELIABILITY/UAT-RELIABILITY-13.md): Account deletion closes the live table (RELIABILITY) - **NOT RUN**
- [ ] [UAT-RELEASE-1](RELEASE/UAT-RELEASE-1.md): Exact cleanup and final acceptance (RELEASE) - **NOT RUN**
- [ ] [UAT-PERF-1](PERF/UAT-PERF-1.md): Managed three-user live-room journey (needs managed credentials; run only on an approved staging smoke) (PERF) - **NOT RUN**
