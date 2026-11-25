# UAT tracker

The one ordered path through every UAT scenario and exploratory task (195 in all), in the order to run them. Each scenario builds on the ones before it, so run them in this order, once. The starting point is the accounts GM and P1 to P5 and nothing else; the scenarios build the Campaigns, Characters and Scenes they use. This file is the one record of progress; the orchestrator copies accepted results into the ledger's `uat` items.

When you finish a scenario, whatever the outcome, change its Status from NOT RUN to PASSED, FAILED, BLOCKED (a gap or an earlier failure stopped it) or SKIPPED. The first NOT RUN row is where you left off. The # column is the scenario's path position. Failure details go in the Result block at the end of the scenario's file, with the tester and the scenario ID. A scenario marked "facilitator needed" has the owner act as the GM or another player from a numbered script. How to run: [README](README.md); coverage: [COVERAGE](COVERAGE.md).

## Level 0: Orientation (1 scenario: 1 Solo)

| #   | Scenario                                              | Title                                | Feature     | Mode | Who          | Status  |
| --- | ----------------------------------------------------- | ------------------------------------ | ----------- | ---- | ------------ | ------- |
| 1   | [UAT-ORIENTATION-1](ORIENTATION/UAT-ORIENTATION-1.md) | Sign in and look around your account | ORIENTATION | Solo | any one role | NOT RUN |

## Level 1: Single-user basics (45 scenarios: 36 Solo, 9 Group)

| #   | Scenario                                          | Title                                                                  | Feature   | Mode  | Who                | Status  |
| --- | ------------------------------------------------- | ---------------------------------------------------------------------- | --------- | ----- | ------------------ | ------- |
| 2   | [UAT-ACCOUNTS-1](ACCOUNTS/UAT-ACCOUNTS-1.md)      | Sign in, reload, sign out, sign back in by username                    | ACCOUNTS  | Solo  | P1                 | PASSED  |
| 3   | [UAT-ACCOUNTS-2](ACCOUNTS/UAT-ACCOUNTS-2.md)      | Wrong password and unknown account are refused                         | ACCOUNTS  | Solo  | P1                 | PASSED  |
| 4   | [UAT-ACCOUNTS-4](ACCOUNTS/UAT-ACCOUNTS-4.md)      | Public sign-up is closed                                               | ACCOUNTS  | Solo  | none               | PASSED  |
| 5   | [UAT-ACCOUNTS-6](ACCOUNTS/UAT-ACCOUNTS-6.md)      | Create an account from an invitation                                   | ACCOUNTS  | Solo  | OWN                | NOT RUN |
| 6   | [UAT-ACCOUNTS-5](ACCOUNTS/UAT-ACCOUNTS-5.md)      | Reset a forgotten password (wrong code, mismatch, then success)        | ACCOUNTS  | Solo  | OWN                | NOT RUN |
| 7   | [UAT-ACCOUNTS-14](ACCOUNTS/UAT-ACCOUNTS-14.md)    | Change your password in Account Settings                               | ACCOUNTS  | Solo  | OWN                | NOT RUN |
| 8   | [UAT-ACCOUNTS-15](ACCOUNTS/UAT-ACCOUNTS-15.md)    | Change your email in Account Settings                                  | ACCOUNTS  | Solo  | OWN                | NOT RUN |
| 9   | [UAT-ACCOUNTS-7](ACCOUNTS/UAT-ACCOUNTS-7.md)      | Choose, change and protect a username                                  | ACCOUNTS  | Solo  | OWN                | NOT RUN |
| 10  | [UAT-ACCOUNTS-13](ACCOUNTS/UAT-ACCOUNTS-13.md)    | Campaign text follows the same language rules as usernames             | ACCOUNTS  | Solo  | GM                 | NOT RUN |
| 11  | [UAT-ACCOUNTS-8](ACCOUNTS/UAT-ACCOUNTS-8.md)      | Private profiles stay private; Public profiles show only public fields | ACCOUNTS  | Group | GM, P1, P2         | NOT RUN |
| 12  | [UAT-ACCOUNTS-3](ACCOUNTS/UAT-ACCOUNTS-3.md)      | Sign-out ends every tab of your account and nobody else's              | ACCOUNTS  | Group | P1, GM             | NOT RUN |
| 13  | [UAT-ACCOUNTS-9](ACCOUNTS/UAT-ACCOUNTS-9.md)      | Ordinary users cannot use superadmin tools                             | ACCOUNTS  | Group | GM, P1             | NOT RUN |
| 14  | [UAT-ACCOUNTS-10](ACCOUNTS/UAT-ACCOUNTS-10.md)    | Superadmin moderation                                                  | ACCOUNTS  | Group | GM, P1, SUPERADMIN | NOT RUN |
| 15  | [UAT-PLATFORM-1](PLATFORM/UAT-PLATFORM-1.md)      | SRD content is present and browsable                                   | PLATFORM  | Solo  | GM                 | NOT RUN |
| 16  | [UAT-PLATFORM-2](PLATFORM/UAT-PLATFORM-2.md)      | Upload, replace and remove an avatar                                   | PLATFORM  | Group | P3, P1             | NOT RUN |
| 17  | [UAT-PLATFORM-3](PLATFORM/UAT-PLATFORM-3.md)      | Artwork is private to its owner until shared                           | PLATFORM  | Group | P1, P2             | NOT RUN |
| 18  | [UAT-PLATFORM-4](PLATFORM/UAT-PLATFORM-4.md)      | Password reset email is requested from the app                         | PLATFORM  | Solo  | P3                 | NOT RUN |
| 19  | [UAT-AUTHORING-1](AUTHORING/UAT-AUTHORING-1.md)   | Browse Game Systems and Rules Catalogues                               | AUTHORING | Solo  | GM                 | NOT RUN |
| 20  | [UAT-AUTHORING-2](AUTHORING/UAT-AUTHORING-2.md)   | SRD records are locked but can be copied into an owned draft           | AUTHORING | Solo  | GM                 | NOT RUN |
| 21  | [UAT-AUTHORING-3](AUTHORING/UAT-AUTHORING-3.md)   | Background lifecycle — create, save, publish, replace, export, delete  | AUTHORING | Solo  | P1                 | NOT RUN |
| 22  | [UAT-AUTHORING-10](AUTHORING/UAT-AUTHORING-10.md) | Another account cannot see or edit your drafts                         | AUTHORING | Group | GM, P1, P2         | NOT RUN |
| 23  | [UAT-AUTHORING-4](AUTHORING/UAT-AUTHORING-4.md)   | Author, publish and filter a homebrew Spell with artwork               | AUTHORING | Solo  | P1                 | NOT RUN |
| 24  | [UAT-AUTHORING-5](AUTHORING/UAT-AUTHORING-5.md)   | Author a Class and see the Spell guard                                 | AUTHORING | Solo  | P1                 | NOT RUN |
| 25  | [UAT-AUTHORING-7](AUTHORING/UAT-AUTHORING-7.md)   | Equipment variants, inheritance and item names                         | AUTHORING | Solo  | P1                 | NOT RUN |
| 26  | [UAT-AUTHORING-8](AUTHORING/UAT-AUTHORING-8.md)   | Author a Feat, a Race and a Vehicle                                    | AUTHORING | Solo  | P1                 | NOT RUN |
| 27  | [UAT-AUTHORING-9](AUTHORING/UAT-AUTHORING-9.md)   | Reusable effects, grants and modifiers on a System                     | AUTHORING | Solo  | GM                 | NOT RUN |
| 28  | [UAT-AUTHORING-12](AUTHORING/UAT-AUTHORING-12.md) | Option descriptions and adding a Check and a DC                        | AUTHORING | Solo  | P1                 | NOT RUN |
| 29  | [UAT-AUTHORING-13](AUTHORING/UAT-AUTHORING-13.md) | Author a Fire Bolt-like cantrip from scratch                           | AUTHORING | Solo  | P1                 | NOT RUN |
| 30  | [UAT-AUTHORING-14](AUTHORING/UAT-AUTHORING-14.md) | Author a Fireball-like spell from scratch                              | AUTHORING | Solo  | P1                 | NOT RUN |
| 31  | [UAT-AUTHORING-15](AUTHORING/UAT-AUTHORING-15.md) | Author an Empowered Spell-like feature that spends a resource pool     | AUTHORING | Solo  | P1                 | NOT RUN |
| 32  | [UAT-RULES-1](RULES/UAT-RULES-1.md)               | Authoring forms show, hide and require fields as choices change        | RULES     | Solo  | P1                 | NOT RUN |
| 33  | [UAT-BUILDER-1](BUILDER/UAT-BUILDER-1.md)         | Build a Character, save, resume and commit                             | BUILDER   | Solo  | P1                 | NOT RUN |
| 34  | [UAT-BUILDER-2](BUILDER/UAT-BUILDER-2.md)         | Two windows on one draft cannot overwrite each other                   | BUILDER   | Solo  | P1                 | NOT RUN |
| 35  | [UAT-BUILDER-3](BUILDER/UAT-BUILDER-3.md)         | Choice-heavy builds — multiclass and spellcaster                       | BUILDER   | Solo  | P2                 | NOT RUN |
| 36  | [UAT-BUILDER-7](BUILDER/UAT-BUILDER-7.md)         | Build the Characters P2 and P3 will use in The Campaign                | BUILDER   | Group | P1, P2, P3         | NOT RUN |
| 37  | [UAT-BUILDER-4](BUILDER/UAT-BUILDER-4.md)         | Removing content a Character uses repairs the Character                | BUILDER   | Solo  | P1                 | NOT RUN |
| 38  | [UAT-BUILDER-6](BUILDER/UAT-BUILDER-6.md)         | Imported custom items keep their kind, properties and damage           | BUILDER   | Solo  | P1                 | NOT RUN |
| 39  | [UAT-SHEET-1](SHEET/UAT-SHEET-1.md)               | Edit a personal Sheet and reload                                       | SHEET     | Solo  | P1                 | NOT RUN |
| 40  | [UAT-SHEET-2](SHEET/UAT-SHEET-2.md)               | Short and long rest                                                    | SHEET     | Solo  | P1                 | NOT RUN |
| 41  | [UAT-SHEET-3](SHEET/UAT-SHEET-3.md)               | Learn, prepare and cast spells from the Sheet                          | SHEET     | Solo  | P1                 | NOT RUN |
| 42  | [UAT-SHEET-6](SHEET/UAT-SHEET-6.md)               | Equipment, inventory, attunement and deleting an item                  | SHEET     | Group | P1, P2             | NOT RUN |
| 43  | [UAT-SHEET-7](SHEET/UAT-SHEET-7.md)               | Starting equipment on a new Character                                  | SHEET     | Solo  | P1                 | NOT RUN |
| 44  | [UAT-SHEET-8](SHEET/UAT-SHEET-8.md)               | Hands, two-handed weapons and shields                                  | SHEET     | Solo  | P1                 | NOT RUN |
| 45  | [UAT-SHEET-9](SHEET/UAT-SHEET-9.md)               | Speed on the overview and the Movement panel                           | SHEET     | Solo  | P1                 | NOT RUN |
| 46  | [UAT-SHEET-10](SHEET/UAT-SHEET-10.md)             | Sheet at phone width                                                   | SHEET     | Solo  | P1                 | NOT RUN |

## Level 2: GM setup (26 scenarios: 4 Solo, 22 Group)

| #   | Scenario                                              | Title                                                         | Feature     | Mode  | Who                | Status  |
| --- | ----------------------------------------------------- | ------------------------------------------------------------- | ----------- | ----- | ------------------ | ------- |
| 47  | [UAT-CAMPAIGN-1](CAMPAIGN/UAT-CAMPAIGN-1.md)          | Create, edit, copy, archive and delete a Campaign             | CAMPAIGN    | Solo  | GM                 | NOT RUN |
| 48  | [UAT-CAMPAIGN-2](CAMPAIGN/UAT-CAMPAIGN-2.md)          | Invite, accept, leave, remove, rejoin and transfer            | CAMPAIGN    | Group | GM, P1, P2         | NOT RUN |
| 49  | [UAT-CAMPAIGN-9](CAMPAIGN/UAT-CAMPAIGN-9.md)          | Seat the whole party in The Campaign                          | CAMPAIGN    | Group | GM, P1, P2, P3, P4 | NOT RUN |
| 50  | [UAT-CAMPAIGN-10](CAMPAIGN/UAT-CAMPAIGN-10.md)        | Bench a second Character and mark it active                   | CAMPAIGN    | Group | GM, P1, P2         | NOT RUN |
| 51  | [UAT-SOCIAL-1](SOCIAL/UAT-SOCIAL-1.md)                | Create a listing, apply, accept and fill a table              | SOCIAL      | Group | P3, P1, P2, P5     | NOT RUN |
| 52  | [UAT-SOCIAL-2](SOCIAL/UAT-SOCIAL-2.md)                | Invitations and Social Hub navigation                         | SOCIAL      | Group | P3, P5             | NOT RUN |
| 53  | [UAT-AUTHORING-11](AUTHORING/UAT-AUTHORING-11.md)     | Share homebrew with a Campaign, then withdraw it              | AUTHORING   | Group | GM, P1, P2, P5     | NOT RUN |
| 54  | [UAT-BUILDER-5](BUILDER/UAT-BUILDER-5.md)             | Withdrawing shared content reconciles assigned Characters     | BUILDER     | Group | GM, P1             | NOT RUN |
| 55  | [UAT-CAMPAIGN-4](CAMPAIGN/UAT-CAMPAIGN-4.md)          | Campaign content, sources and removals                        | CAMPAIGN    | Group | GM, P1             | NOT RUN |
| 56  | [UAT-CAMPAIGN-5](CAMPAIGN/UAT-CAMPAIGN-5.md)          | Party inventory and Vehicles                                  | CAMPAIGN    | Group | GM, P1             | NOT RUN |
| 57  | [UAT-CAMPAIGN-7](CAMPAIGN/UAT-CAMPAIGN-7.md)          | The GM plays a Character                                      | CAMPAIGN    | Group | GM, P1             | NOT RUN |
| 58  | [UAT-CAMPAIGN-6](CAMPAIGN/UAT-CAMPAIGN-6.md)          | Announcements                                                 | CAMPAIGN    | Group | GM, P1, P2         | NOT RUN |
| 59  | [UAT-SCENE-1](SCENE/UAT-SCENE-1.md)                   | Upload a map, calibrate and create a Scene                    | SCENE       | Solo  | GM                 | NOT RUN |
| 60  | [UAT-SCENE-2](SCENE/UAT-SCENE-2.md)                   | Map upload refusals                                           | SCENE       | Solo  | GM                 | NOT RUN |
| 61  | [UAT-SCENE-3](SCENE/UAT-SCENE-3.md)                   | Present a Scene and build it live                             | SCENE       | Group | GM, P1, P2         | NOT RUN |
| 62  | [UAT-SCENE-4](SCENE/UAT-SCENE-4.md)                   | Fog of war off, shared and per player                         | SCENE       | Group | GM, P1, P2         | NOT RUN |
| 63  | [UAT-SCENE-5](SCENE/UAT-SCENE-5.md)                   | Doors                                                         | SCENE       | Group | GM, P1             | NOT RUN |
| 64  | [UAT-SCENE-6](SCENE/UAT-SCENE-6.md)                   | Offline edits recover                                         | SCENE       | Group | GM, P1             | NOT RUN |
| 65  | [UAT-SCENE-9](SCENE/UAT-SCENE-9.md)                   | One shared table screen for several players                   | SCENE       | Group | GM, P1, P2, P3     | NOT RUN |
| 66  | [UAT-MOVE-5](MOVE/UAT-MOVE-5.md)                      | Moving outside an Encounter and in a sandbox                  | MOVE        | Group | GM, P1             | NOT RUN |
| 67  | [UAT-MOVE-6](MOVE/UAT-MOVE-6.md)                      | Peers converge, reload and departure                          | MOVE        | Group | GM, P1, P2         | NOT RUN |
| 68  | [UAT-ENCOUNTER-3](ENCOUNTER/UAT-ENCOUNTER-3.md)       | Prepare, start, delete and persist a Run                      | ENCOUNTER   | Group | GM, P1             | NOT RUN |
| 69  | [UAT-ENCOUNTER-7](ENCOUNTER/UAT-ENCOUNTER-7.md)       | Blueprint edits and who can reach them                        | ENCOUNTER   | Group | GM, P1             | NOT RUN |
| 70  | [UAT-BUILDER-8](BUILDER/UAT-BUILDER-8.md)             | Permanently delete a Character that is in a running Encounter | BUILDER     | Group | GM, P1             | NOT RUN |
| 71  | [UAT-RELIABILITY-4](RELIABILITY/UAT-RELIABILITY-4.md) | A new Scene measures lengths correctly in every unit          | RELIABILITY | Solo  | GM                 | NOT RUN |
| 72  | [UAT-SCENE-7](SCENE/UAT-SCENE-7.md)                   | Map ownership and deletion                                    | SCENE       | Group | GM, P1             | NOT RUN |

## Level 3: Core play (73 scenarios: 4 Solo, 69 Group)

| #   | Scenario                                              | Title                                                                | Feature     | Mode  | Who                        | Status  |
| --- | ----------------------------------------------------- | -------------------------------------------------------------------- | ----------- | ----- | -------------------------- | ------- |
| 73  | [UAT-CAMPAIGN-8](CAMPAIGN/UAT-CAMPAIGN-8.md)          | Not a member                                                         | CAMPAIGN    | Group | GM, P5                     | NOT RUN |
| 74  | [UAT-CAMPAIGN-3](CAMPAIGN/UAT-CAMPAIGN-3.md)          | Players see only what the GM made visible                            | CAMPAIGN    | Group | GM, P1, P2                 | NOT RUN |
| 75  | [UAT-ROOM-1](ROOM/UAT-ROOM-1.md)                      | GM and three players join at once                                    | ROOM        | Group | GM, P1, P2, P3             | NOT RUN |
| 76  | [UAT-ROOM-2](ROOM/UAT-ROOM-2.md)                      | Previews and pings                                                   | ROOM        | Group | GM, P1, P2                 | NOT RUN |
| 77  | [UAT-ROOM-4](ROOM/UAT-ROOM-4.md)                      | Chat — Table, Party and Direct                                       | ROOM        | Group | GM, P1, P2, P3             | NOT RUN |
| 78  | [UAT-ROOM-5](ROOM/UAT-ROOM-5.md)                      | Rolls, private GM rolls and chat limits                              | ROOM        | Group | GM, P1, P2                 | NOT RUN |
| 79  | [UAT-ROOM-6](ROOM/UAT-ROOM-6.md)                      | Notes — private and shared                                           | ROOM        | Group | GM, P1, P2                 | NOT RUN |
| 80  | [UAT-ROOM-8](ROOM/UAT-ROOM-8.md)                      | Plan and log Sessions                                                | ROOM        | Group | GM, P1, P2                 | NOT RUN |
| 81  | [UAT-ROOM-9](ROOM/UAT-ROOM-9.md)                      | Live play commands go through the room                               | ROOM        | Group | GM, P1                     | NOT RUN |
| 82  | [UAT-ROOM-7](ROOM/UAT-ROOM-7.md)                      | Show a map to players without presenting                             | ROOM        | Group | GM, P1, P2                 | NOT RUN |
| 83  | [EXPLORATORY-1](EXPLORATORY/EXPLORATORY-1.md)         | Build a level-3 caster and play one round                            | EXPLORATORY | Group | P3, GM, facilitator needed | NOT RUN |
| 84  | [EXPLORATORY-2](EXPLORATORY/EXPLORATORY-2.md)         | Author a homebrew spell from memory and cast it                      | EXPLORATORY | Group | P1, GM, facilitator needed | NOT RUN |
| 85  | [EXPLORATORY-3](EXPLORATORY/EXPLORATORY-3.md)         | Set up a new encounter on an uploaded map as GM                      | EXPLORATORY | Group | P4, P5, facilitator needed | NOT RUN |
| 86  | [EXPLORATORY-4](EXPLORATORY/EXPLORATORY-4.md)         | Run a short session as a first-time player                           | EXPLORATORY | Group | P5, GM, facilitator needed | NOT RUN |
| 87  | [EXPLORATORY-5](EXPLORATORY/EXPLORATORY-5.md)         | Copy and change an existing monster                                  | EXPLORATORY | Solo  | GM, facilitator needed     | NOT RUN |
| 88  | [EXPLORATORY-6](EXPLORATORY/EXPLORATORY-6.md)         | Find out what went wrong                                             | EXPLORATORY | Group | P2, GM, facilitator needed | NOT RUN |
| 89  | [EXPLORATORY-7](EXPLORATORY/EXPLORATORY-7.md)         | Hand over a Character mid-campaign                                   | EXPLORATORY | Group | P2, GM, facilitator needed | NOT RUN |
| 90  | [UAT-ROOM-10](ROOM/UAT-ROOM-10.md)                    | Archiving a Campaign closes its live room                            | ROOM        | Group | P4, P1                     | NOT RUN |
| 91  | [UAT-SHEET-4](SHEET/UAT-SHEET-4.md)                   | Roll from the Sheet and choose who sees it                           | SHEET       | Group | GM, P1, P2                 | NOT RUN |
| 92  | [UAT-SHEET-5](SHEET/UAT-SHEET-5.md)                   | GM Public and Private rolls with reveals                             | SHEET       | Solo  | GM                         | NOT RUN |
| 93  | [UAT-SHEET-11](SHEET/UAT-SHEET-11.md)                 | Sheet during live play and after reconnect                           | SHEET       | Group | GM, P1                     | NOT RUN |
| 94  | [UAT-AUTHORING-6](AUTHORING/UAT-AUTHORING-6.md)       | Creature copy, computed AC and the item loadout                      | AUTHORING   | Solo  | GM                         | NOT RUN |
| 95  | [UAT-ATTACK-1](ATTACK/UAT-ATTACK-1.md)                | Effects, movement, reactions and the turn lifecycle pass end to end  | ATTACK      | Group | GM, P1, P2, P3             | NOT RUN |
| 96  | [UAT-ATTACK-2](ATTACK/UAT-ATTACK-2.md)                | Players control only their own actors                                | ATTACK      | Group | GM, P1, P2, P3             | NOT RUN |
| 97  | [UAT-ATTACK-5](ATTACK/UAT-ATTACK-5.md)                | Targeting, hidden creatures and private roll cards                   | ATTACK      | Group | GM, P1, P2                 | NOT RUN |
| 98  | [UAT-ATTACK-6](ATTACK/UAT-ATTACK-6.md)                | Hiding, invisibility and unseen attackers                            | ATTACK      | Group | GM, P1, P2                 | NOT RUN |
| 99  | [UAT-ATTACK-8](ATTACK/UAT-ATTACK-8.md)                | Grapple, shove and basic actions                                     | ATTACK      | Group | GM, P1, P2                 | NOT RUN |
| 100 | [UAT-ATTACK-10](ATTACK/UAT-ATTACK-10.md)              | Multiattack and SRD monster attacks                                  | ATTACK      | Group | GM, P1                     | NOT RUN |
| 101 | [UAT-PRIVACY-1](PRIVACY/UAT-PRIVACY-1.md)             | What a player sees of the Encounter                                  | PRIVACY     | Group | GM, P1, P2                 | NOT RUN |
| 102 | [UAT-PRIVACY-2](PRIVACY/UAT-PRIVACY-2.md)             | GM private rolls and monster rolls                                   | PRIVACY     | Group | GM, P1, P2                 | NOT RUN |
| 103 | [UAT-PRIVACY-5](PRIVACY/UAT-PRIVACY-5.md)             | Reloads and replays do not leak                                      | PRIVACY     | Group | GM, P1, P2                 | NOT RUN |
| 104 | [UAT-PRIVACY-6](PRIVACY/UAT-PRIVACY-6.md)             | Health display settings                                              | PRIVACY     | Group | GM, P1, P2                 | NOT RUN |
| 105 | [UAT-PRIVACY-7](PRIVACY/UAT-PRIVACY-7.md)             | Other players' Sheets and Campaign roster                            | PRIVACY     | Group | GM, P1, P2                 | NOT RUN |
| 106 | [UAT-MOVE-1](MOVE/UAT-MOVE-1.md)                      | A player moves their own token                                       | MOVE        | Group | GM, P1, P2                 | NOT RUN |
| 107 | [UAT-MOVE-3](MOVE/UAT-MOVE-3.md)                      | Opportunity attack pauses the move                                   | MOVE        | Group | GM, P1, P2                 | NOT RUN |
| 108 | [UAT-MOVE-4](MOVE/UAT-MOVE-4.md)                      | Undo last token move                                                 | MOVE        | Group | GM, P1                     | NOT RUN |
| 109 | [UAT-MOVE-7](MOVE/UAT-MOVE-7.md)                      | Overrun, Shove Aside and Tumble                                      | MOVE        | Group | GM, P1                     | NOT RUN |
| 110 | [UAT-REACTION-2](REACTION/UAT-REACTION-2.md)          | Only the right controller answers; GM Skip decision                  | REACTION    | Group | GM, P1, P2, P3             | NOT RUN |
| 111 | [UAT-REACTION-1](REACTION/UAT-REACTION-1.md)          | Shield prompts the right player while the attacker waits             | REACTION    | Group | GM, P1, P2, P3             | NOT RUN |
| 112 | [UAT-CAMPAIGN-11](CAMPAIGN/UAT-CAMPAIGN-11.md)        | Mid-fight Character swap needs the GM's approval                     | CAMPAIGN    | Group | GM, P1, P2, P3             | NOT RUN |
| 113 | [UAT-CAMPAIGN-12](CAMPAIGN/UAT-CAMPAIGN-12.md)        | Character swap on the player's own turn                              | CAMPAIGN    | Group | GM, P1, P2, P3             | NOT RUN |
| 114 | [UAT-CAMPAIGN-13](CAMPAIGN/UAT-CAMPAIGN-13.md)        | Swap in a Prepared Encounter needs no request                        | CAMPAIGN    | Group | GM, P1                     | NOT RUN |
| 115 | [UAT-REACTION-3](REACTION/UAT-REACTION-3.md)          | Roll prompts, Auto-roll on versus off                                | REACTION    | Group | GM, P1                     | NOT RUN |
| 116 | [UAT-REACTION-5](REACTION/UAT-REACTION-5.md)          | An authored reaction spell (Absorb Elements)                         | REACTION    | Group | GM, P1                     | NOT RUN |
| 117 | [UAT-REACTION-7](REACTION/UAT-REACTION-7.md)          | Reconnect while a decision is open                                   | REACTION    | Group | GM, P1                     | NOT RUN |
| 118 | [UAT-RULES-3](RULES/UAT-RULES-3.md)                   | A reaction pauses a hit; answering resumes it; privacy of the pause  | RULES       | Group | GM, P1, P2, P5             | NOT RUN |
| 119 | [UAT-RULES-4](RULES/UAT-RULES-4.md)                   | Healing keeps its dice and modifier visible in the roll card         | RULES       | Group | GM, P1                     | NOT RUN |
| 120 | [UAT-VTT_UI-1](VTT_UI/UAT-VTT_UI-1.md)                | Token identity, status rings, facing and system state                | VTT_UI      | Group | GM, P1, P2                 | NOT RUN |
| 121 | [UAT-VTT_UI-2](VTT_UI/UAT-VTT_UI-2.md)                | Previews, footprints, large tokens and dragging                      | VTT_UI      | Group | GM, P1, P2                 | NOT RUN |
| 122 | [UAT-VTT_UI-4](VTT_UI/UAT-VTT_UI-4.md)                | Keyboard, screen reader and low zoom                                 | VTT_UI      | Group | GM, P1                     | NOT RUN |
| 123 | [UAT-PRIVACY-9](PRIVACY/UAT-PRIVACY-9.md)             | A hidden Concentration source stays hidden                           | PRIVACY     | Group | GM, P1, P2                 | NOT RUN |
| 124 | [UAT-RELIABILITY-1](RELIABILITY/UAT-RELIABILITY-1.md) | Privacy, replay, rollback, concurrency and performance hold together | RELIABILITY | Group | GM, P1, P2                 | NOT RUN |
| 125 | [UAT-RELIABILITY-2](RELIABILITY/UAT-RELIABILITY-2.md) | Two users act at the same moment                                     | RELIABILITY | Group | GM, P1, P2, P3             | NOT RUN |
| 126 | [UAT-RELIABILITY-3](RELIABILITY/UAT-RELIABILITY-3.md) | The room closes after everyone leaves and reopens with state intact  | RELIABILITY | Group | GM, P1, P3                 | NOT RUN |
| 127 | [UAT-RELIABILITY-6](RELIABILITY/UAT-RELIABILITY-6.md) | A contested passage holds, then spends once                          | RELIABILITY | Group | GM, P1                     | NOT RUN |
| 128 | [UAT-RELIABILITY-8](RELIABILITY/UAT-RELIABILITY-8.md) | The Sheet shows correct rests, ability checks and hit points         | RELIABILITY | Solo  | P1                         | NOT RUN |
| 129 | [UAT-PERF-2](PERF/UAT-PERF-2.md)                      | Four people at a local table feel responsive                         | PERF        | Group | GM, P1, P2, P3             | NOT RUN |
| 130 | [UAT-MOVE-2](MOVE/UAT-MOVE-2.md)                      | Refusals at walls, hostile spaces and the map edge                   | MOVE        | Group | GM, P1                     | NOT RUN |
| 131 | [UAT-MOVE-8](MOVE/UAT-MOVE-8.md)                      | Hidden hazards, traps and auras                                      | MOVE        | Group | GM, P1, P2                 | NOT RUN |
| 132 | [UAT-MOVE-9](MOVE/UAT-MOVE-9.md)                      | Climb onto a larger creature                                         | MOVE        | Group | GM, P1                     | NOT RUN |
| 133 | [UAT-PRIVACY-4](PRIVACY/UAT-PRIVACY-4.md)             | Ownership transfer changes who sees what                             | PRIVACY     | Group | GM, P1                     | NOT RUN |
| 134 | [UAT-ROOM-3](ROOM/UAT-ROOM-3.md)                      | Reconnect after a dropped connection                                 | ROOM        | Group | GM, P1, P2                 | NOT RUN |
| 135 | [UAT-PRIVACY-3](PRIVACY/UAT-PRIVACY-3.md)             | Non-members, removed players and signed-out visitors                 | PRIVACY     | Group | GM, P1, P2, P5             | NOT RUN |
| 136 | [UAT-PRIVACY-8](PRIVACY/UAT-PRIVACY-8.md)             | Campaign content stays hidden until revealed                         | PRIVACY     | Group | GM, P1                     | NOT RUN |
| 137 | [UAT-ATTACK-7](ATTACK/UAT-ATTACK-7.md)                | Optional combat rules in play                                        | ATTACK      | Group | GM, P1, P2                 | NOT RUN |
| 138 | [UAT-ATTACK-9](ATTACK/UAT-ATTACK-9.md)                | Class features in play                                               | ATTACK      | Group | GM, P1                     | NOT RUN |
| 139 | [UAT-ATTACK-11](ATTACK/UAT-ATTACK-11.md)              | Weapons in hand, loadouts and Disarm                                 | ATTACK      | Group | GM, P1                     | NOT RUN |
| 140 | [UAT-ENCOUNTER-5](ENCOUNTER/UAT-ENCOUNTER-5.md)       | Morale                                                               | ENCOUNTER   | Group | GM, P1                     | NOT RUN |
| 141 | [UAT-REACTION-4](REACTION/UAT-REACTION-4.md)          | Counterspell and chains                                              | REACTION    | Group | GM, P1, P2                 | NOT RUN |
| 142 | [UAT-REACTION-6](REACTION/UAT-REACTION-6.md)          | Disarm evidence from participants                                    | REACTION    | Group | GM, P1, P2                 | NOT RUN |
| 143 | [UAT-RELIABILITY-7](RELIABILITY/UAT-RELIABILITY-7.md) | Authored speed and sense bonuses use the right length unit           | RELIABILITY | Group | GM, P1                     | NOT RUN |
| 144 | [UAT-RELIABILITY-9](RELIABILITY/UAT-RELIABILITY-9.md) | Roll reasons and initiative read the right source                    | RELIABILITY | Group | GM, P1                     | NOT RUN |
| 145 | [UAT-VTT_UI-3](VTT_UI/UAT-VTT_UI-3.md)                | Light, fog, senses and the GM's view preview                         | VTT_UI      | Group | GM, P1                     | NOT RUN |

## Level 4: Advanced play (40 scenarios: all Group)

| #   | Scenario                                        | Title                                                                                       | Feature   | Mode  | Who                    | Status  |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------- | --------- | ----- | ---------------------- | ------- |
| 146 | [UAT-ENCOUNTER-6](ENCOUNTER/UAT-ENCOUNTER-6.md) | Roll cards for turn-stage rolls                                                             | ENCOUNTER | Group | GM, P1                 | NOT RUN |
| 147 | [UAT-ENCOUNTER-4](ENCOUNTER/UAT-ENCOUNTER-4.md) | Controllers, dispositions and removing a member                                             | ENCOUNTER | Group | GM, P1, P2, P3         | NOT RUN |
| 148 | [UAT-ENCOUNTER-1](ENCOUNTER/UAT-ENCOUNTER-1.md) | Assisted and Manual Encounter journeys pass                                                 | ENCOUNTER | Group | GM, P1, P2, P3         | NOT RUN |
| 149 | [UAT-ENCOUNTER-2](ENCOUNTER/UAT-ENCOUNTER-2.md) | Initiative and optional-combat combinations pass end to end                                 | ENCOUNTER | Group | GM, P1, P2, P3         | NOT RUN |
| 150 | [UAT-SCENE-8](SCENE/UAT-SCENE-8.md)             | GM loot tables                                                                              | SCENE     | Group | GM, P1                 | NOT RUN |
| 151 | [UAT-ATTACK-3](ATTACK/UAT-ATTACK-3.md)          | Assisted warnings and "Do it anyway"                                                        | ATTACK    | Group | GM, P1, P2             | NOT RUN |
| 152 | [UAT-ATTACK-4](ATTACK/UAT-ATTACK-4.md)          | Undo last action and its refusals                                                           | ATTACK    | Group | GM, P1, P2             | NOT RUN |
| 153 | [UAT-RULES-2](RULES/UAT-RULES-2.md)             | A started Encounter pauses for answers and resumes with nothing half-applied                | RULES     | Group | GM, P2                 | NOT RUN |
| 154 | [UAT-RULES-5](RULES/UAT-RULES-5.md)             | An attack with two damage parts keeps each part visible                                     | RULES     | Group | GM, P2                 | NOT RUN |
| 155 | [UAT-SOCIAL-3](SOCIAL/UAT-SOCIAL-3.md)          | Blocks and what they do                                                                     | SOCIAL    | Group | GM, P1, P2, SUPERADMIN | NOT RUN |
| 156 | [UAT-SOCIAL-4](SOCIAL/UAT-SOCIAL-4.md)          | Private profiles and masking                                                                | SOCIAL    | Group | P1, P2, P5             | NOT RUN |
| 157 | [UAT-SOCIAL-5](SOCIAL/UAT-SOCIAL-5.md)          | Notification feed, read state and preferences                                               | SOCIAL    | Group | GM, P1, P2             | NOT RUN |
| 158 | [UAT-SPELLS-1](SPELLS/UAT-SPELLS-1.md)          | Build the casters and cast from the Sheet outside an Encounter                              | SPELLS    | Group | P1, P2, P3             | NOT RUN |
| 159 | [UAT-SPELLS-2](SPELLS/UAT-SPELLS-2.md)          | Set up the Spell Arena Encounter (Assisted)                                                 | SPELLS    | Group | GM, P1, P2, P3         | NOT RUN |
| 160 | [UAT-SPELLS-3](SPELLS/UAT-SPELLS-3.md)          | Fireball on a group with saves answered by different controllers                            | SPELLS    | Group | GM, P1, P2, P3         | NOT RUN |
| 161 | [UAT-SPELLS-4](SPELLS/UAT-SPELLS-4.md)          | Area caster cannot see a hidden creature                                                    | SPELLS    | Group | GM, P1                 | NOT RUN |
| 162 | [UAT-SPELLS-5](SPELLS/UAT-SPELLS-5.md)          | Cones, lines, Self cubes and aiming on the map                                              | SPELLS    | Group | GM, P1, P2             | NOT RUN |
| 163 | [UAT-SPELLS-6](SPELLS/UAT-SPELLS-6.md)          | Cover from walls and manual cover                                                           | SPELLS    | Group | GM, P1, P2             | NOT RUN |
| 164 | [UAT-SPELLS-7](SPELLS/UAT-SPELLS-7.md)          | Hold Person, Concentration, damage checks, replacement and end                              | SPELLS    | Group | GM, P1, P2             | NOT RUN |
| 165 | [UAT-PLATFORM-5](PLATFORM/UAT-PLATFORM-5.md)    | A Concentration save shows its result on the roll card                                      | PLATFORM  | Group | GM, P1                 | NOT RUN |
| 166 | [UAT-SPELLS-8](SPELLS/UAT-SPELLS-8.md)          | Attack and check modifiers from conditions                                                  | SPELLS    | Group | GM, P1, P2             | NOT RUN |
| 167 | [UAT-SPELLS-9](SPELLS/UAT-SPELLS-9.md)          | Exhaustion 4 and 6, Petrified resistance, nonmagical defenses and automatic failures        | SPELLS    | Group | GM, P1                 | NOT RUN |
| 168 | [UAT-SPELLS-10](SPELLS/UAT-SPELLS-10.md)        | Dying, death saves, healing and kills                                                       | SPELLS    | Group | GM, P1, P2             | NOT RUN |
| 169 | [UAT-SPELLS-11](SPELLS/UAT-SPELLS-11.md)        | Stabilizing: Spare the Dying, Healer's Kit and first aid                                    | SPELLS    | Group | GM, P1, P2, P3         | NOT RUN |
| 170 | [UAT-SPELLS-12](SPELLS/UAT-SPELLS-12.md)        | Single-use items and Antitoxin                                                              | SPELLS    | Group | GM, P1, P2             | NOT RUN |
| 171 | [UAT-SPELLS-13](SPELLS/UAT-SPELLS-13.md)        | Reaction spells: Shield and Counterspell, one-roll grants                                   | SPELLS    | Group | GM, P1, P2, P3         | NOT RUN |
| 172 | [UAT-SPELLS-14](SPELLS/UAT-SPELLS-14.md)        | Reaction countdown timer                                                                    | SPELLS    | Group | GM, P1, P2             | NOT RUN |
| 173 | [UAT-SPELLS-15](SPELLS/UAT-SPELLS-15.md)        | Grant spells and their lifetimes                                                            | SPELLS    | Group | GM, P1, P2, P3         | NOT RUN |
| 174 | [UAT-SPELLS-16](SPELLS/UAT-SPELLS-16.md)        | Grants and Concentration carry over after the Encounter                                     | SPELLS    | Group | GM, P1, P2, P3         | NOT RUN |
| 175 | [UAT-SPELLS-17](SPELLS/UAT-SPELLS-17.md)        | Two Concentrations with an authored ring                                                    | SPELLS    | Group | GM, P1, P2             | NOT RUN |
| 176 | [UAT-SPELLS-18](SPELLS/UAT-SPELLS-18.md)        | Dragons, breath weapons and Legendary Resistance                                            | SPELLS    | Group | GM, P1, P2, P3         | NOT RUN |
| 177 | [UAT-SPELLS-19](SPELLS/UAT-SPELLS-19.md)        | Zones, auras and lasting hazards                                                            | SPELLS    | Group | GM, P1, P2, P3         | NOT RUN |
| 178 | [UAT-SPELLS-20](SPELLS/UAT-SPELLS-20.md)        | Multi-target spells and teleports                                                           | SPELLS    | Group | GM, P1, P2, P3         | NOT RUN |
| 179 | [UAT-SPELLS-21](SPELLS/UAT-SPELLS-21.md)        | Invisibility, Sanctuary, Fear and Blindness                                                 | SPELLS    | Group | GM, P1, P2, P3         | NOT RUN |
| 180 | [UAT-SPELLS-22](SPELLS/UAT-SPELLS-22.md)        | Summons: turns, groups and ends                                                             | SPELLS    | Group | GM, P1, P2, P3         | NOT RUN |
| 181 | [UAT-SPELLS-23](SPELLS/UAT-SPELLS-23.md)        | Manual mode raises no rules prompts                                                         | SPELLS    | Group | GM, P1, P2             | NOT RUN |
| 182 | [UAT-SPELLS-24](SPELLS/UAT-SPELLS-24.md)        | Privacy and permissions refusals                                                            | SPELLS    | Group | GM, P1, P2, P3         | NOT RUN |
| 183 | [UAT-SPELLS-25](SPELLS/UAT-SPELLS-25.md)        | Phone width: Sheet death saves and summons                                                  | SPELLS    | Group | P1, P2                 | NOT RUN |
| 184 | [UAT-SPELLS-26](SPELLS/UAT-SPELLS-26.md)        | Sheet attack rows match the room, and an always-on feature that rests restore (Tranquility) | SPELLS    | Group | GM, P1, P2, P3         | NOT RUN |
| 185 | [UAT-SPELLS-27](SPELLS/UAT-SPELLS-27.md)        | Racial traits, creature traits and Eldritch Blast                                           | SPELLS    | Group | GM, P1, P2, P3         | NOT RUN |

## Level 5: Reliability, performance and release (10 scenarios: all Group)

| #   | Scenario                                                | Title                                                                                                   | Feature     | Mode  | Who                | Status  |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------- | ----- | ------------------ | ------- |
| 186 | [UAT-RELIABILITY-5](RELIABILITY/UAT-RELIABILITY-5.md)   | Forms and sign-out recover without silent data loss                                                     | RELIABILITY | Group | GM, P1             | NOT RUN |
| 187 | [UAT-RELIABILITY-10](RELIABILITY/UAT-RELIABILITY-10.md) | Builder and party inventory values are right                                                            | RELIABILITY | Group | GM, P1             | NOT RUN |
| 188 | [UAT-RELIABILITY-11](RELIABILITY/UAT-RELIABILITY-11.md) | Authoring selects, labels and lists                                                                     | RELIABILITY | Group | GM, P1             | NOT RUN |
| 189 | [UAT-RELIABILITY-12](RELIABILITY/UAT-RELIABILITY-12.md) | Core pages open with their data                                                                         | RELIABILITY | Group | GM, P1             | NOT RUN |
| 190 | [UAT-ACCOUNTS-11](ACCOUNTS/UAT-ACCOUNTS-11.md)          | Refused account deletions                                                                               | ACCOUNTS    | Group | GM, P1, P5         | NOT RUN |
| 191 | [UAT-SOCIAL-6](SOCIAL/UAT-SOCIAL-6.md)                  | Plan limits and capacity                                                                                | SOCIAL      | Group | GM, P1, SUPERADMIN | NOT RUN |
| 192 | [UAT-RELIABILITY-13](RELIABILITY/UAT-RELIABILITY-13.md) | Account deletion closes the live table                                                                  | RELIABILITY | Group | GM, P5             | NOT RUN |
| 193 | [UAT-RELEASE-1](RELEASE/UAT-RELEASE-1.md)               | Exact cleanup and final acceptance                                                                      | RELEASE     | Group | GM, P1, P2, P3     | NOT RUN |
| 194 | [UAT-PERF-1](PERF/UAT-PERF-1.md)                        | Managed three-user live-room journey (needs managed credentials; run only on an approved staging smoke) | PERF        | Group | GM, P1, P2         | NOT RUN |
| 195 | [UAT-ACCOUNTS-12](ACCOUNTS/UAT-ACCOUNTS-12.md)          | Delete my account, shared history survives                                                              | ACCOUNTS    | Group | OWN, P3            | NOT RUN |

# Owner follow-ups: cross-role checks (11)

The tester's Solo run does not cover what the other roles see. After the tester finishes the scenario, the owner signs in as the listed role and runs the scenario's Cross-role check section.

| Scenario                                                           | Title                                                                 | Check as | Status  |
| ------------------------------------------------------------------ | --------------------------------------------------------------------- | -------- | ------- |
| [UAT-AUTHORING-3](AUTHORING/UAT-AUTHORING-3.md#cross-role-check)   | Background lifecycle — create, save, publish, replace, export, delete | P2       | NOT RUN |
| [UAT-AUTHORING-4](AUTHORING/UAT-AUTHORING-4.md#cross-role-check)   | Author, publish and filter a homebrew Spell with artwork              | P2       | NOT RUN |
| [UAT-AUTHORING-7](AUTHORING/UAT-AUTHORING-7.md#cross-role-check)   | Equipment variants, inheritance and item names                        | P2       | NOT RUN |
| [UAT-AUTHORING-8](AUTHORING/UAT-AUTHORING-8.md#cross-role-check)   | Author a Feat, a Race and a Vehicle                                   | P2       | NOT RUN |
| [UAT-AUTHORING-9](AUTHORING/UAT-AUTHORING-9.md#cross-role-check)   | Reusable effects, grants and modifiers on a System                    | P1       | NOT RUN |
| [UAT-AUTHORING-13](AUTHORING/UAT-AUTHORING-13.md#cross-role-check) | Author a Fire Bolt-like cantrip from scratch                          | P2       | NOT RUN |
| [UAT-AUTHORING-14](AUTHORING/UAT-AUTHORING-14.md#cross-role-check) | Author a Fireball-like spell from scratch                             | P2       | NOT RUN |
| [UAT-AUTHORING-15](AUTHORING/UAT-AUTHORING-15.md#cross-role-check) | Author an Empowered Spell-like feature that spends a resource pool    | P2       | NOT RUN |
| [UAT-BUILDER-1](BUILDER/UAT-BUILDER-1.md#cross-role-check)         | Build a Character, save, resume and commit                            | GM       | NOT RUN |
| [UAT-SHEET-5](SHEET/UAT-SHEET-5.md#cross-role-check)               | GM Public and Private rolls with reveals                              | P1       | NOT RUN |
| [UAT-AUTHORING-6](AUTHORING/UAT-AUTHORING-6.md#cross-role-check)   | Creature copy, computed AC and the item loadout                       | P1       | NOT RUN |
