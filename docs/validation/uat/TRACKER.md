# UAT tracker

Every UAT scenario and exploratory task (185 in all), grouped by feature in the order to run them. This file is the single record of UAT progress; the orchestrator copies accepted results into the ledger's `uat` items.

For each line:

- Tick the box once the scenario has been run, whatever the outcome.
- Replace **NOT RUN** with **PASSED**, **FAILED**, **BLOCKED** (a gap or an earlier failure stopped it) or **SKIPPED**, and add the date and build after it, for example `**PASSED** 2026-11-04 487524e5a`.
- For anything but PASSED, write the details in the feature file's **Run notes** section and link them at the end of the line, for example `[notes](AUTHORING.md#uat-authoring-15)`.
- When a failure is fixed and the scenario passes on a rerun, set it to **PASSED** with the new date and build; keep the old run note.

How to run the scenarios, the accounts and the review data are in the [README](README.md). Exploratory tasks are not pass/fail: tick them when done, use **PASSED** for "done", and put the time, outcome, rating and confusion points in [EXPLORATORY.md](EXPLORATORY.md#run-notes).

## EXPLORATORY

- [ ] [EXPLORATORY-1](EXPLORATORY.md#exploratory-1-build-a-level-3-caster-and-play-one-round): Build a level-3 caster and play one round - **NOT RUN**
- [ ] [EXPLORATORY-2](EXPLORATORY.md#exploratory-2-author-a-homebrew-spell-from-memory-and-cast-it): Author a homebrew spell from memory and cast it - **NOT RUN**
- [ ] [EXPLORATORY-3](EXPLORATORY.md#exploratory-3-set-up-a-new-encounter-on-an-uploaded-map-as-gm): Set up a new encounter on an uploaded map as GM - **NOT RUN**
- [ ] [EXPLORATORY-4](EXPLORATORY.md#exploratory-4-run-a-short-session-as-a-first-time-player): Run a short session as a first-time player - **NOT RUN**
- [ ] [EXPLORATORY-5](EXPLORATORY.md#exploratory-5-copy-and-change-an-existing-monster): Copy and change an existing monster - **NOT RUN**
- [ ] [EXPLORATORY-6](EXPLORATORY.md#exploratory-6-find-out-what-went-wrong): Find out what went wrong - **NOT RUN**
- [ ] [EXPLORATORY-7](EXPLORATORY.md#exploratory-7-hand-over-a-character-mid-campaign): Hand over a Character mid-campaign - **NOT RUN**

## AUTHORING

- [ ] [UAT-AUTHORING-1](AUTHORING.md#uat-authoring-1-browse-game-systems-and-rules-catalogues): Browse Game Systems and Rules Catalogues - **NOT RUN**
- [ ] [UAT-AUTHORING-2](AUTHORING.md#uat-authoring-2-srd-records-are-locked-but-can-be-copied-into-an-owned-draft): SRD records are locked but can be copied into an owned draft - **NOT RUN**
- [ ] [UAT-AUTHORING-3](AUTHORING.md#uat-authoring-3-background-lifecycle--create-save-publish-replace-export-delete): Background lifecycle — create, save, publish, replace, export, delete - **NOT RUN**
- [ ] [UAT-AUTHORING-4](AUTHORING.md#uat-authoring-4-author-publish-and-filter-a-homebrew-spell-with-artwork): Author, publish and filter a homebrew Spell with artwork - **NOT RUN**
- [ ] [UAT-AUTHORING-5](AUTHORING.md#uat-authoring-5-author-a-class-and-see-the-spell-guard): Author a Class and see the Spell guard - **NOT RUN**
- [ ] [UAT-AUTHORING-6](AUTHORING.md#uat-authoring-6-creature-copy-computed-ac-and-the-item-loadout): Creature copy, computed AC and the item loadout - **NOT RUN**
- [ ] [UAT-AUTHORING-7](AUTHORING.md#uat-authoring-7-equipment-variants-inheritance-and-item-names): Equipment variants, inheritance and item names - **NOT RUN**
- [ ] [UAT-AUTHORING-8](AUTHORING.md#uat-authoring-8-author-a-feat-a-race-and-a-vehicle): Author a Feat, a Race and a Vehicle - **NOT RUN**
- [ ] [UAT-AUTHORING-9](AUTHORING.md#uat-authoring-9-reusable-effects-grants-and-modifiers-on-a-system): Reusable effects, grants and modifiers on a System - **NOT RUN**
- [ ] [UAT-AUTHORING-10](AUTHORING.md#uat-authoring-10-another-account-cannot-see-or-edit-your-drafts): Another account cannot see or edit your drafts - **NOT RUN**
- [ ] [UAT-AUTHORING-11](AUTHORING.md#uat-authoring-11-share-homebrew-with-a-campaign-then-withdraw-it): Share homebrew with a Campaign, then withdraw it - **NOT RUN**
- [ ] [UAT-AUTHORING-12](AUTHORING.md#uat-authoring-12-option-descriptions-and-adding-a-check-and-a-dc): Option descriptions and adding a Check and a DC - **NOT RUN**
- [ ] [UAT-AUTHORING-13](AUTHORING.md#uat-authoring-13-author-a-fire-bolt-like-cantrip-from-scratch): Author a Fire Bolt-like cantrip from scratch - **NOT RUN**
- [ ] [UAT-AUTHORING-14](AUTHORING.md#uat-authoring-14-author-a-fireball-like-spell-from-scratch): Author a Fireball-like spell from scratch - **NOT RUN**
- [ ] [UAT-AUTHORING-15](AUTHORING.md#uat-authoring-15-author-an-empowered-spell-like-feature-that-spends-a-resource-pool): Author an Empowered Spell-like feature that spends a resource pool - **NOT RUN**

## PLATFORM

- [ ] [UAT-PLATFORM-1](PLATFORM.md#uat-platform-1-srd-content-is-present-and-browsable): SRD content is present and browsable - **NOT RUN**
- [ ] [UAT-PLATFORM-2](PLATFORM.md#uat-platform-2-upload-replace-and-remove-an-avatar): Upload, replace and remove an avatar - **NOT RUN**
- [ ] [UAT-PLATFORM-3](PLATFORM.md#uat-platform-3-artwork-is-private-to-its-owner-until-shared): Artwork is private to its owner until shared - **NOT RUN**
- [ ] [UAT-PLATFORM-4](PLATFORM.md#uat-platform-4-password-reset-email-is-requested-from-the-app): Password reset email is requested from the app - **NOT RUN**
- [ ] [UAT-PLATFORM-5](PLATFORM.md#uat-platform-5-a-concentration-save-shows-its-result-on-the-roll-card): A Concentration save shows its result on the roll card - **NOT RUN**

## ACCOUNTS

- [ ] [UAT-ACCOUNTS-1](ACCOUNTS.md#uat-accounts-1-sign-in-reload-sign-out-sign-back-in-by-username): Sign in, reload, sign out, sign back in by username - **NOT RUN**
- [ ] [UAT-ACCOUNTS-2](ACCOUNTS.md#uat-accounts-2-wrong-password-and-unknown-account-are-refused): Wrong password and unknown account are refused - **NOT RUN**
- [ ] [UAT-ACCOUNTS-3](ACCOUNTS.md#uat-accounts-3-two-accounts-at-once-stay-isolated-and-sign-out-ends-every-tab): Two accounts at once stay isolated, and sign-out ends every tab - **NOT RUN**
- [ ] [UAT-ACCOUNTS-4](ACCOUNTS.md#uat-accounts-4-public-sign-up-is-closed): Public sign-up is closed - **NOT RUN**
- [ ] [UAT-ACCOUNTS-5](ACCOUNTS.md#uat-accounts-5-reset-a-forgotten-password-wrong-code-mismatch-then-success): Reset a forgotten password (wrong code, mismatch, then success) - **NOT RUN**
- [ ] [UAT-ACCOUNTS-6](ACCOUNTS.md#uat-accounts-6-create-an-account-from-an-invitation): Create an account from an invitation - **NOT RUN**
- [ ] [UAT-ACCOUNTS-7](ACCOUNTS.md#uat-accounts-7-choose-change-and-protect-a-username): Choose, change and protect a username - **NOT RUN**
- [ ] [UAT-ACCOUNTS-8](ACCOUNTS.md#uat-accounts-8-private-profiles-stay-private-public-profiles-show-only-public-fields): Private profiles stay private; Public profiles show only public fields - **NOT RUN**
- [ ] [UAT-ACCOUNTS-9](ACCOUNTS.md#uat-accounts-9-ordinary-users-cannot-use-superadmin-tools): Ordinary users cannot use superadmin tools - **NOT RUN**
- [ ] [UAT-ACCOUNTS-10](ACCOUNTS.md#uat-accounts-10-superadmin-moderation): Superadmin moderation - **NOT RUN**
- [ ] [UAT-ACCOUNTS-11](ACCOUNTS.md#uat-accounts-11-refused-account-deletions): Refused account deletions - **NOT RUN**
- [ ] [UAT-ACCOUNTS-12](ACCOUNTS.md#uat-accounts-12-delete-my-account-shared-history-survives): Delete my account, shared history survives - **NOT RUN**
- [ ] [UAT-ACCOUNTS-13](ACCOUNTS.md#uat-accounts-13-campaign-text-follows-the-same-language-rules-as-usernames): Campaign text follows the same language rules as usernames - **NOT RUN**

## BUILDER

- [ ] [UAT-BUILDER-1](BUILDER.md#uat-builder-1-build-a-character-for-a-review-player-save-resume-and-commit): Build a Character for a review player, save, resume and commit - **NOT RUN**
- [ ] [UAT-BUILDER-2](BUILDER.md#uat-builder-2-two-windows-on-one-draft-cannot-overwrite-each-other): Two windows on one draft cannot overwrite each other - **NOT RUN**
- [ ] [UAT-BUILDER-3](BUILDER.md#uat-builder-3-choice-heavy-builds--multiclass-and-spellcaster): Choice-heavy builds — multiclass and spellcaster - **NOT RUN**
- [ ] [UAT-BUILDER-4](BUILDER.md#uat-builder-4-removing-content-a-character-uses-repairs-the-character): Removing content a Character uses repairs the Character - **NOT RUN**
- [ ] [UAT-BUILDER-5](BUILDER.md#uat-builder-5-withdrawing-shared-content-reconciles-assigned-characters): Withdrawing shared content reconciles assigned Characters - **NOT RUN**
- [ ] [UAT-BUILDER-6](BUILDER.md#uat-builder-6-imported-custom-items-keep-their-kind-properties-and-damage): Imported custom items keep their kind, properties and damage - **NOT RUN**

## RULES

- [ ] [UAT-RULES-1](RULES.md#uat-rules-1-authoring-forms-show-hide-and-require-fields-as-choices-change): Authoring forms show, hide and require fields as choices change - **NOT RUN**
- [ ] [UAT-RULES-2](RULES.md#uat-rules-2-a-started-encounter-pauses-for-answers-and-resumes-with-nothing-half-applied): A started Encounter pauses for answers and resumes with nothing half-applied - **NOT RUN**
- [ ] [UAT-RULES-3](RULES.md#uat-rules-3-a-reaction-pauses-a-hit-answering-resumes-it-privacy-of-the-pause): A reaction pauses a hit; answering resumes it; privacy of the pause - **NOT RUN**
- [ ] [UAT-RULES-4](RULES.md#uat-rules-4-healing-keeps-its-dice-and-modifier-visible-in-the-roll-card): Healing keeps its dice and modifier visible in the roll card - **NOT RUN**
- [ ] [UAT-RULES-5](RULES.md#uat-rules-5-an-attack-with-two-damage-parts-keeps-each-part-visible): An attack with two damage parts keeps each part visible - **NOT RUN**

## SHEET

- [ ] [UAT-SHEET-1](SHEET.md#uat-sheet-1-edit-a-personal-sheet-and-reload): Edit a personal Sheet and reload - **NOT RUN**
- [ ] [UAT-SHEET-2](SHEET.md#uat-sheet-2-short-and-long-rest): Short and long rest - **NOT RUN**
- [ ] [UAT-SHEET-3](SHEET.md#uat-sheet-3-learn-prepare-and-cast-spells-from-the-sheet): Learn, prepare and cast spells from the Sheet - **NOT RUN**
- [ ] [UAT-SHEET-4](SHEET.md#uat-sheet-4-roll-from-the-sheet-and-choose-who-sees-it): Roll from the Sheet and choose who sees it - **NOT RUN**
- [ ] [UAT-SHEET-5](SHEET.md#uat-sheet-5-gm-public-and-private-rolls-with-reveals): GM Public and Private rolls with reveals - **NOT RUN**
- [ ] [UAT-SHEET-6](SHEET.md#uat-sheet-6-equipment-inventory-attunement-and-deleting-an-item): Equipment, inventory, attunement and deleting an item - **NOT RUN**
- [ ] [UAT-SHEET-7](SHEET.md#uat-sheet-7-starting-equipment-on-a-new-character): Starting equipment on a new Character - **NOT RUN**
- [ ] [UAT-SHEET-8](SHEET.md#uat-sheet-8-hands-two-handed-weapons-and-shields): Hands, two-handed weapons and shields - **NOT RUN**
- [ ] [UAT-SHEET-9](SHEET.md#uat-sheet-9-speed-on-the-overview-and-the-movement-panel): Speed on the overview and the Movement panel - **NOT RUN**
- [ ] [UAT-SHEET-10](SHEET.md#uat-sheet-10-sheet-at-phone-width): Sheet at phone width - **NOT RUN**
- [ ] [UAT-SHEET-11](SHEET.md#uat-sheet-11-sheet-during-live-play-and-after-reconnect): Sheet during live play and after reconnect - **NOT RUN**

## CAMPAIGN

- [ ] [UAT-CAMPAIGN-1](CAMPAIGN.md#uat-campaign-1-create-edit-copy-archive-and-delete-a-campaign): Create, edit, copy, archive and delete a Campaign - **NOT RUN**
- [ ] [UAT-CAMPAIGN-2](CAMPAIGN.md#uat-campaign-2-invite-accept-leave-remove-rejoin-and-transfer): Invite, accept, leave, remove, rejoin and transfer - **NOT RUN**
- [ ] [UAT-CAMPAIGN-3](CAMPAIGN.md#uat-campaign-3-players-see-only-what-the-gm-made-visible): Players see only what the GM made visible - **NOT RUN**
- [ ] [UAT-CAMPAIGN-4](CAMPAIGN.md#uat-campaign-4-campaign-content-sources-and-removals): Campaign content, sources and removals - **NOT RUN**
- [ ] [UAT-CAMPAIGN-5](CAMPAIGN.md#uat-campaign-5-party-inventory-and-vehicles): Party inventory and Vehicles - **NOT RUN**
- [ ] [UAT-CAMPAIGN-6](CAMPAIGN.md#uat-campaign-6-announcements): Announcements - **NOT RUN**
- [ ] [UAT-CAMPAIGN-7](CAMPAIGN.md#uat-campaign-7-the-gm-plays-a-character): The GM plays a Character - **NOT RUN**
- [ ] [UAT-CAMPAIGN-8](CAMPAIGN.md#uat-campaign-8-not-a-member): Not a member - **NOT RUN**

## SOCIAL

- [ ] [UAT-SOCIAL-1](SOCIAL.md#uat-social-1-create-a-listing-apply-accept-and-fill-a-table): Create a listing, apply, accept and fill a table - **NOT RUN**
- [ ] [UAT-SOCIAL-2](SOCIAL.md#uat-social-2-invitations-and-social-hub-navigation): Invitations and Social Hub navigation - **NOT RUN**
- [ ] [UAT-SOCIAL-3](SOCIAL.md#uat-social-3-blocks-and-what-they-do): Blocks and what they do - **NOT RUN**
- [ ] [UAT-SOCIAL-4](SOCIAL.md#uat-social-4-private-profiles-and-masking): Private profiles and masking - **NOT RUN**
- [ ] [UAT-SOCIAL-5](SOCIAL.md#uat-social-5-notification-feed-read-state-and-preferences): Notification feed, read state and preferences - **NOT RUN**
- [ ] [UAT-SOCIAL-6](SOCIAL.md#uat-social-6-plan-limits-and-capacity): Plan limits and capacity - **NOT RUN**

## ROOM

- [ ] [UAT-ROOM-1](ROOM.md#uat-room-1-gm-and-three-players-join-at-once): GM and three players join at once - **NOT RUN**
- [ ] [UAT-ROOM-2](ROOM.md#uat-room-2-previews-and-pings): Previews and pings - **NOT RUN**
- [ ] [UAT-ROOM-3](ROOM.md#uat-room-3-reconnect-after-a-dropped-connection): Reconnect after a dropped connection - **NOT RUN**
- [ ] [UAT-ROOM-4](ROOM.md#uat-room-4-chat--table-party-and-direct): Chat — Table, Party and Direct - **NOT RUN**
- [ ] [UAT-ROOM-5](ROOM.md#uat-room-5-rolls-private-gm-rolls-and-chat-limits): Rolls, private GM rolls and chat limits - **NOT RUN**
- [ ] [UAT-ROOM-6](ROOM.md#uat-room-6-notes--private-and-shared): Notes — private and shared - **NOT RUN**
- [ ] [UAT-ROOM-7](ROOM.md#uat-room-7-show-a-map-to-players-without-presenting): Show a map to players without presenting - **NOT RUN**
- [ ] [UAT-ROOM-8](ROOM.md#uat-room-8-plan-and-log-sessions): Plan and log Sessions - **NOT RUN**
- [ ] [UAT-ROOM-9](ROOM.md#uat-room-9-live-play-commands-go-through-the-room): Live play commands go through the room - **NOT RUN**
- [ ] [UAT-ROOM-10](ROOM.md#uat-room-10-archiving-a-campaign-closes-its-live-room): Archiving a Campaign closes its live room - **NOT RUN**

## SCENE

- [ ] [UAT-SCENE-1](SCENE.md#uat-scene-1-upload-a-map-calibrate-and-create-a-scene): Upload a map, calibrate and create a Scene - **NOT RUN**
- [ ] [UAT-SCENE-2](SCENE.md#uat-scene-2-map-upload-refusals): Map upload refusals - **NOT RUN**
- [ ] [UAT-SCENE-3](SCENE.md#uat-scene-3-present-a-scene-and-build-it-live): Present a Scene and build it live - **NOT RUN**
- [ ] [UAT-SCENE-4](SCENE.md#uat-scene-4-fog-of-war-off-shared-and-per-player): Fog of war off, shared and per player - **NOT RUN**
- [ ] [UAT-SCENE-5](SCENE.md#uat-scene-5-doors): Doors - **NOT RUN**
- [ ] [UAT-SCENE-6](SCENE.md#uat-scene-6-offline-edits-recover): Offline edits recover - **NOT RUN**
- [ ] [UAT-SCENE-7](SCENE.md#uat-scene-7-map-ownership-and-deletion): Map ownership and deletion - **NOT RUN**
- [ ] [UAT-SCENE-8](SCENE.md#uat-scene-8-gm-loot-tables): GM loot tables - **NOT RUN**
- [ ] [UAT-SCENE-9](SCENE.md#uat-scene-9-one-shared-table-screen-for-several-players): One shared table screen for several players - **NOT RUN**

## MOVE

- [ ] [UAT-MOVE-1](MOVE.md#uat-move-1-a-player-moves-their-own-token): A player moves their own token - **NOT RUN**
- [ ] [UAT-MOVE-2](MOVE.md#uat-move-2-refusals-at-walls-hostile-spaces-and-the-map-edge): Refusals at walls, hostile spaces and the map edge - **NOT RUN**
- [ ] [UAT-MOVE-3](MOVE.md#uat-move-3-opportunity-attack-pauses-the-move): Opportunity attack pauses the move - **NOT RUN**
- [ ] [UAT-MOVE-4](MOVE.md#uat-move-4-undo-last-token-move): Undo last token move - **NOT RUN**
- [ ] [UAT-MOVE-5](MOVE.md#uat-move-5-moving-outside-an-encounter-and-in-a-sandbox): Moving outside an Encounter and in a sandbox - **NOT RUN**
- [ ] [UAT-MOVE-6](MOVE.md#uat-move-6-peers-converge-reload-and-departure): Peers converge, reload and departure - **NOT RUN**
- [ ] [UAT-MOVE-7](MOVE.md#uat-move-7-overrun-shove-aside-and-tumble): Overrun, Shove Aside and Tumble - **NOT RUN**
- [ ] [UAT-MOVE-8](MOVE.md#uat-move-8-hidden-hazards-traps-and-auras): Hidden hazards, traps and auras - **NOT RUN**
- [ ] [UAT-MOVE-9](MOVE.md#uat-move-9-climb-onto-a-larger-creature): Climb onto a larger creature - **NOT RUN**

## ENCOUNTER

- [ ] [UAT-ENCOUNTER-1](ENCOUNTER.md#uat-encounter-1-assisted-and-manual-encounter-journeys-pass): Assisted and Manual Encounter journeys pass - **NOT RUN**
- [ ] [UAT-ENCOUNTER-2](ENCOUNTER.md#uat-encounter-2-initiative-and-optional-combat-combinations-pass-end-to-end): Initiative and optional-combat combinations pass end to end - **NOT RUN**
- [ ] [UAT-ENCOUNTER-3](ENCOUNTER.md#uat-encounter-3-prepare-start-delete-and-persist-a-run): Prepare, start, delete and persist a Run - **NOT RUN**
- [ ] [UAT-ENCOUNTER-4](ENCOUNTER.md#uat-encounter-4-controllers-dispositions-and-removing-a-member): Controllers, dispositions and removing a member - **NOT RUN**
- [ ] [UAT-ENCOUNTER-5](ENCOUNTER.md#uat-encounter-5-morale): Morale - **NOT RUN**
- [ ] [UAT-ENCOUNTER-6](ENCOUNTER.md#uat-encounter-6-roll-cards-for-turn-stage-rolls): Roll cards for turn-stage rolls - **NOT RUN**
- [ ] [UAT-ENCOUNTER-7](ENCOUNTER.md#uat-encounter-7-blueprint-edits-and-who-can-reach-them): Blueprint edits and who can reach them - **NOT RUN**

## ATTACK

- [ ] [UAT-ATTACK-1](ATTACK.md#uat-attack-1-effects-movement-reactions-and-the-turn-lifecycle-pass-end-to-end): Effects, movement, reactions and the turn lifecycle pass end to end - **NOT RUN**
- [ ] [UAT-ATTACK-2](ATTACK.md#uat-attack-2-players-control-only-their-own-actors): Players control only their own actors - **NOT RUN**
- [ ] [UAT-ATTACK-3](ATTACK.md#uat-attack-3-assisted-warnings-and-do-it-anyway): Assisted warnings and "Do it anyway" - **NOT RUN**
- [ ] [UAT-ATTACK-4](ATTACK.md#uat-attack-4-undo-last-action-and-its-refusals): Undo last action and its refusals - **NOT RUN**
- [ ] [UAT-ATTACK-5](ATTACK.md#uat-attack-5-targeting-hidden-creatures-and-private-roll-cards): Targeting, hidden creatures and private roll cards - **NOT RUN**
- [ ] [UAT-ATTACK-6](ATTACK.md#uat-attack-6-hiding-invisibility-and-unseen-attackers): Hiding, invisibility and unseen attackers - **NOT RUN**
- [ ] [UAT-ATTACK-7](ATTACK.md#uat-attack-7-optional-combat-rules-in-play): Optional combat rules in play - **NOT RUN**
- [ ] [UAT-ATTACK-8](ATTACK.md#uat-attack-8-grapple-shove-and-basic-actions): Grapple, shove and basic actions - **NOT RUN**
- [ ] [UAT-ATTACK-9](ATTACK.md#uat-attack-9-class-features-in-play): Class features in play - **NOT RUN**
- [ ] [UAT-ATTACK-10](ATTACK.md#uat-attack-10-multiattack-and-srd-monster-attacks): Multiattack and SRD monster attacks - **NOT RUN**
- [ ] [UAT-ATTACK-11](ATTACK.md#uat-attack-11-weapons-in-hand-loadouts-and-disarm): Weapons in hand, loadouts and Disarm - **NOT RUN**

## SPELLS

- [ ] [UAT-SPELLS-1](SPELLS.md#uat-spells-1-build-the-casters-and-cast-from-the-sheet-outside-an-encounter): Build the casters and cast from the Sheet outside an Encounter - **NOT RUN**
- [ ] [UAT-SPELLS-2](SPELLS.md#uat-spells-2-set-up-the-spell-arena-encounter-assisted): Set up the Spell Arena Encounter (Assisted) - **NOT RUN**
- [ ] [UAT-SPELLS-3](SPELLS.md#uat-spells-3-fireball-on-a-group-with-saves-answered-by-different-controllers): Fireball on a group with saves answered by different controllers - **NOT RUN**
- [ ] [UAT-SPELLS-4](SPELLS.md#uat-spells-4-area-caster-cannot-see-a-hidden-creature): Area caster cannot see a hidden creature - **NOT RUN**
- [ ] [UAT-SPELLS-5](SPELLS.md#uat-spells-5-cones-lines-self-cubes-and-aiming-on-the-map): Cones, lines, Self cubes and aiming on the map - **NOT RUN**
- [ ] [UAT-SPELLS-6](SPELLS.md#uat-spells-6-cover-from-walls-and-manual-cover): Cover from walls and manual cover - **NOT RUN**
- [ ] [UAT-SPELLS-7](SPELLS.md#uat-spells-7-hold-person-concentration-damage-checks-replacement-and-end): Hold Person, Concentration, damage checks, replacement and end - **NOT RUN**
- [ ] [UAT-SPELLS-8](SPELLS.md#uat-spells-8-attack-and-check-modifiers-from-conditions): Attack and check modifiers from conditions - **NOT RUN**
- [ ] [UAT-SPELLS-9](SPELLS.md#uat-spells-9-exhaustion-4-and-6-petrified-resistance-nonmagical-defenses-and-automatic-failures): Exhaustion 4 and 6, Petrified resistance, nonmagical defenses and automatic failures - **NOT RUN**
- [ ] [UAT-SPELLS-10](SPELLS.md#uat-spells-10-dying-death-saves-healing-and-kills): Dying, death saves, healing and kills - **NOT RUN**
- [ ] [UAT-SPELLS-11](SPELLS.md#uat-spells-11-stabilizing-spare-the-dying-healers-kit-and-first-aid): Stabilizing: Spare the Dying, Healer's Kit and first aid - **NOT RUN**
- [ ] [UAT-SPELLS-12](SPELLS.md#uat-spells-12-single-use-items-and-antitoxin): Single-use items and Antitoxin - **NOT RUN**
- [ ] [UAT-SPELLS-13](SPELLS.md#uat-spells-13-reaction-spells-shield-and-counterspell-one-roll-grants): Reaction spells: Shield and Counterspell, one-roll grants - **NOT RUN**
- [ ] [UAT-SPELLS-14](SPELLS.md#uat-spells-14-reaction-countdown-timer): Reaction countdown timer - **NOT RUN**
- [ ] [UAT-SPELLS-15](SPELLS.md#uat-spells-15-grant-spells-and-their-lifetimes): Grant spells and their lifetimes - **NOT RUN**
- [ ] [UAT-SPELLS-16](SPELLS.md#uat-spells-16-grants-and-concentration-carry-over-after-the-encounter): Grants and Concentration carry over after the Encounter - **NOT RUN**
- [ ] [UAT-SPELLS-17](SPELLS.md#uat-spells-17-two-concentrations-with-an-authored-ring): Two Concentrations with an authored ring - **NOT RUN**
- [ ] [UAT-SPELLS-18](SPELLS.md#uat-spells-18-dragons-breath-weapons-and-legendary-resistance): Dragons, breath weapons and Legendary Resistance - **NOT RUN**
- [ ] [UAT-SPELLS-19](SPELLS.md#uat-spells-19-zones-auras-and-lasting-hazards): Zones, auras and lasting hazards - **NOT RUN**
- [ ] [UAT-SPELLS-20](SPELLS.md#uat-spells-20-multi-target-spells-and-teleports): Multi-target spells and teleports - **NOT RUN**
- [ ] [UAT-SPELLS-21](SPELLS.md#uat-spells-21-invisibility-sanctuary-fear-and-blindness): Invisibility, Sanctuary, Fear and Blindness - **NOT RUN**
- [ ] [UAT-SPELLS-22](SPELLS.md#uat-spells-22-summons-turns-groups-and-ends): Summons: turns, groups and ends - **NOT RUN**
- [ ] [UAT-SPELLS-23](SPELLS.md#uat-spells-23-manual-mode-raises-no-rules-prompts): Manual mode raises no rules prompts - **NOT RUN**
- [ ] [UAT-SPELLS-24](SPELLS.md#uat-spells-24-privacy-and-permissions-refusals): Privacy and permissions refusals - **NOT RUN**
- [ ] [UAT-SPELLS-25](SPELLS.md#uat-spells-25-phone-width-sheet-death-saves-and-summons): Phone width: Sheet death saves and summons - **NOT RUN**
- [ ] [UAT-SPELLS-26](SPELLS.md#uat-spells-26-sheet-attack-rows-match-the-room-and-an-always-on-feature-that-rests-restore-tranquility): Sheet attack rows match the room, and an always-on feature that rests restore (Tranquility) - **NOT RUN**
- [ ] [UAT-SPELLS-27](SPELLS.md#uat-spells-27-racial-traits-creature-traits-and-eldritch-blast): Racial traits, creature traits and Eldritch Blast - **NOT RUN**

## REACTION

- [ ] [UAT-REACTION-1](REACTION.md#uat-reaction-1-shield-prompts-the-right-player-while-the-attacker-waits): Shield prompts the right player while the attacker waits - **NOT RUN**
- [ ] [UAT-REACTION-2](REACTION.md#uat-reaction-2-only-the-right-controller-answers-gm-skip-decision): Only the right controller answers; GM Skip decision - **NOT RUN**
- [ ] [UAT-REACTION-3](REACTION.md#uat-reaction-3-roll-prompts-auto-roll-on-versus-off): Roll prompts, Auto-roll on versus off - **NOT RUN**
- [ ] [UAT-REACTION-4](REACTION.md#uat-reaction-4-counterspell-and-chains): Counterspell and chains - **NOT RUN**
- [ ] [UAT-REACTION-5](REACTION.md#uat-reaction-5-an-authored-reaction-spell-absorb-elements): An authored reaction spell (Absorb Elements) - **NOT RUN**
- [ ] [UAT-REACTION-6](REACTION.md#uat-reaction-6-disarm-evidence-from-participants): Disarm evidence from participants - **NOT RUN**
- [ ] [UAT-REACTION-7](REACTION.md#uat-reaction-7-reconnect-while-a-decision-is-open): Reconnect while a decision is open - **NOT RUN**

## PRIVACY

- [ ] [UAT-PRIVACY-1](PRIVACY.md#uat-privacy-1-what-a-player-sees-of-the-encounter): What a player sees of the Encounter - **NOT RUN**
- [ ] [UAT-PRIVACY-2](PRIVACY.md#uat-privacy-2-gm-private-rolls-and-monster-rolls): GM private rolls and monster rolls - **NOT RUN**
- [ ] [UAT-PRIVACY-3](PRIVACY.md#uat-privacy-3-non-members-removed-players-and-signed-out-visitors): Non-members, removed players and signed-out visitors - **NOT RUN**
- [ ] [UAT-PRIVACY-4](PRIVACY.md#uat-privacy-4-ownership-transfer-changes-who-sees-what): Ownership transfer changes who sees what - **NOT RUN**
- [ ] [UAT-PRIVACY-5](PRIVACY.md#uat-privacy-5-reloads-and-replays-do-not-leak): Reloads and replays do not leak - **NOT RUN**
- [ ] [UAT-PRIVACY-6](PRIVACY.md#uat-privacy-6-health-display-settings): Health display settings - **NOT RUN**
- [ ] [UAT-PRIVACY-7](PRIVACY.md#uat-privacy-7-other-players-sheets-and-campaign-roster): Other players' Sheets and Campaign roster - **NOT RUN**
- [ ] [UAT-PRIVACY-8](PRIVACY.md#uat-privacy-8-campaign-content-stays-hidden-until-revealed): Campaign content stays hidden until revealed - **NOT RUN**
- [ ] [UAT-PRIVACY-9](PRIVACY.md#uat-privacy-9-a-hidden-concentration-source-stays-hidden): A hidden Concentration source stays hidden - **NOT RUN**

## RELIABILITY

- [ ] [UAT-RELIABILITY-1](RELIABILITY.md#uat-reliability-1-privacy-replay-rollback-concurrency-and-performance-hold-together): Privacy, replay, rollback, concurrency and performance hold together - **NOT RUN**
- [ ] [UAT-RELIABILITY-2](RELIABILITY.md#uat-reliability-2-two-users-act-at-the-same-moment): Two users act at the same moment - **NOT RUN**
- [ ] [UAT-RELIABILITY-3](RELIABILITY.md#uat-reliability-3-the-room-closes-after-everyone-leaves-and-reopens-with-state-intact): The room closes after everyone leaves and reopens with state intact - **NOT RUN**
- [ ] [UAT-RELIABILITY-4](RELIABILITY.md#uat-reliability-4-a-new-scene-measures-lengths-correctly-in-every-unit): A new Scene measures lengths correctly in every unit - **NOT RUN**
- [ ] [UAT-RELIABILITY-5](RELIABILITY.md#uat-reliability-5-forms-and-sign-out-recover-without-silent-data-loss): Forms and sign-out recover without silent data loss - **NOT RUN**
- [ ] [UAT-RELIABILITY-6](RELIABILITY.md#uat-reliability-6-a-contested-passage-holds-then-spends-once): A contested passage holds, then spends once - **NOT RUN**
- [ ] [UAT-RELIABILITY-7](RELIABILITY.md#uat-reliability-7-authored-speed-and-sense-bonuses-use-the-right-length-unit): Authored speed and sense bonuses use the right length unit - **NOT RUN**
- [ ] [UAT-RELIABILITY-8](RELIABILITY.md#uat-reliability-8-the-sheet-shows-correct-rests-ability-checks-and-hit-points): The Sheet shows correct rests, ability checks and hit points - **NOT RUN**
- [ ] [UAT-RELIABILITY-9](RELIABILITY.md#uat-reliability-9-roll-reasons-and-initiative-read-the-right-source): Roll reasons and initiative read the right source - **NOT RUN**
- [ ] [UAT-RELIABILITY-10](RELIABILITY.md#uat-reliability-10-builder-and-party-inventory-values-are-right): Builder and party inventory values are right - **NOT RUN**
- [ ] [UAT-RELIABILITY-11](RELIABILITY.md#uat-reliability-11-authoring-selects-labels-and-lists): Authoring selects, labels and lists - **NOT RUN**
- [ ] [UAT-RELIABILITY-12](RELIABILITY.md#uat-reliability-12-core-pages-open-with-their-data): Core pages open with their data - **NOT RUN**
- [ ] [UAT-RELIABILITY-13](RELIABILITY.md#uat-reliability-13-account-deletion-closes-the-live-table): Account deletion closes the live table - **NOT RUN**

## VTT_UI

- [ ] [UAT-VTT_UI-1](VTT_UI.md#uat-vttui-1-token-identity-status-rings-facing-and-system-state): Token identity, status rings, facing and system state - **NOT RUN**
- [ ] [UAT-VTT_UI-2](VTT_UI.md#uat-vttui-2-previews-footprints-large-tokens-and-dragging): Previews, footprints, large tokens and dragging - **NOT RUN**
- [ ] [UAT-VTT_UI-3](VTT_UI.md#uat-vttui-3-light-fog-senses-and-the-gms-view-preview): Light, fog, senses and the GM's view preview - **NOT RUN**
- [ ] [UAT-VTT_UI-4](VTT_UI.md#uat-vttui-4-keyboard-screen-reader-and-low-zoom): Keyboard, screen reader and low zoom - **NOT RUN**

## PERF

- [ ] [UAT-PERF-1](PERF.md#uat-perf-1-managed-three-user-live-room-journey-needs-managed-credentials-run-only-on-an-approved-staging-smoke): Managed three-user live-room journey (needs managed credentials; run only on an approved staging smoke) - **NOT RUN**
- [ ] [UAT-PERF-2](PERF.md#uat-perf-2-four-people-at-a-local-table-feel-responsive): Four people at a local table feel responsive - **NOT RUN**

## RELEASE

- [ ] [UAT-RELEASE-1](RELEASE.md#uat-release-1-exact-cleanup-and-final-acceptance): Exact cleanup and final acceptance - **NOT RUN**
