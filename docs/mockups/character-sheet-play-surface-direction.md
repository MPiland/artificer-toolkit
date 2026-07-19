# Character Sheet Play Surface Direction

## Locked references

- [Desktop dashboard](character-sheet-desktop-dashboard-locked.png)
- [Mobile overview](character-sheet-mobile-overview-locked.png)
- [Mobile spells](character-sheet-mobile-spells-locked.png)
- [Mobile features](character-sheet-mobile-features-locked.png)
- [Mobile actions](character-sheet-mobile-actions-locked.png)
- [Mobile notes](character-sheet-mobile-notes-locked.png)
- [Mobile equipment](character-sheet-mobile-equipment-locked.png)
- [Mobile skills](character-sheet-mobile-skills-locked.png)
- [Mobile proficiencies](character-sheet-mobile-proficiencies-locked.png)
- [Tablet overview](character-sheet-tablet-overview-locked.png)
- [Tablet actions](character-sheet-tablet-actions-locked.png)
- [Tablet spells](character-sheet-tablet-spells-locked.png)
- [Tablet equipment](character-sheet-tablet-equipment-locked.png)
- [Tablet features](character-sheet-tablet-features-locked.png)
- [Tablet notes](character-sheet-tablet-notes-locked.png)
- [Tablet skills](character-sheet-tablet-skills-locked.png)
- [Tablet proficiencies](character-sheet-tablet-proficiencies-locked.png)

## Shared mobile structure

- The app footer is the only global navigation: Library, Create, Search, Account.
- The floating dot-grid button is the only character-sheet section navigator; users may also swipe between sheet areas.
- The top-right control is a character gear/edit action. It must never be used for sheet navigation.
- Every sheet view keeps the same character identity and universal quick-reference rail: AC, HP, initiative, speed, and spell DC when relevant.
- Proficiency Bonus and Inspiration are also shared quick-reference state. On mobile, they must fit into the compact approved header treatment without materially increasing its vertical footprint.
- Sheet titles, such as **Overview** and **Spells**, are page-location labels, not navigation controls.
- State editing such as HP, defenses, conditions, exhaustion, and spell selection uses focused drawers rather than expanding the overview into a form.

## Overview

- Ability scores use compact `modifier / score` tiles to preserve vertical room.
- Saving Throws use a readable two-row grid with proficiency status and modifier for all six abilities.
- Defenses, Conditions, Senses, and Exhaustion are compact drawer-entry rows.
- Defenses contains armor, resistances, immunities, and vulnerabilities; Conditions contains active conditions and effects.
- Defenses is limited to resistances, immunities, and vulnerabilities. Armor class, HP, temporary HP, and spell DC belong to their own quick-reference or owning surfaces.

## Spells

- Spell slots belong to the Spells area, not the shared header.
- Slots use a two-row level grid: levels 1-5, then 6-9. Each cell shows current/max and opens management for that level.
- Every spell row shows its base level and source: class, item, race, background, feat, or other grant.
- A spell that consumes a slot exposes a `Cast at <level>` control; the available values are limited to legal upcast levels and available slots.
- Cantrips and non-slot casts say so explicitly. Source grants that are fixed-level or limited-use state the lock level, recharge/use limit, and source.
- **Manage spells** opens a mobile bottom shelf and a tablet side drawer. Its class-aware tabs are Prepared, Known, and Granted.
- Prepared and known spell changes remain inside that shelf. Granted spells are source-derived and read-only. The implementation must continue to enforce Builder/domain invariants behind this UI.

## Desktop

- Desktop is a single, information-dense character canvas. It has no global sheet tab row and no full-page section title.
- The compact header holds app context, character identity, rest controls, Inspiration, HP, and the gear/edit action. The shared stat band immediately follows with ability scores, Proficiency Bonus, Initiative, Armor Class, Speed, and Spell DC.
- Saving Throws, Senses, and proficiency summary form the persistent left reference column. Skills is a tall, internally scrollable center ledger.
- Defenses, Conditions, and Exhaustion are compact persistent status regions above the right-side live-play workspace. Defenses is limited to resistance, immunity, and vulnerability information.
- The live-play workspace is the sole contextual tabbed region: Actions, Spells, Inventory, Features & Traits, Background, Notes, and Extras. Its tabs switch the workspace content only; they are not sheet navigation.
- Actions remains the default workspace view. It is a dense, scrollable table with local filters and correct Roll, Use, or Activate affordances. No combat log, round state, or **Take Action** control belongs on the locked desktop canvas.
- Desktop preserves the approved mobile character data: STR `+1 / 12`, DEX `+3 / 16`, CON `+2 / 14`, INT `+4 / 18`, WIS `+1 / 12`, CHA `+0 / 10`; saving throws are STR `+4`, DEX `+6`, CON `+5`, INT `+8`, WIS `+3`, CHA `+2`.

## Tablet

- Tablet landscape uses a unified horizontal character header with identity, AC, HP, initiative, Proficiency Bonus, speed, spell DC, Inspiration, and the character gear/edit action.
- Tablet landscape uses a horizontal section tab strip; no permanent rail or floating sheet-grid button. Each tab owns the workspace content.
- Tablet Overview keeps Abilities, Saving Throws, and Senses in the left workspace column; Defenses, Conditions, and Exhaustion sit in the right column.
- Ability tiles keep score and modifier compactly paired; Saving Throws omit explanatory helper text.
- Defenses is limited to resistances, immunities, and vulnerabilities. Conditions and Exhaustion remain separate management surfaces.
- Tablet retains the same spell model but uses a side drawer for management, keeping the list visible as context. The spell-slot grid is two rows of level cells (1–5, then 6–9), with direct decrement and increment controls.
- Tablet Actions excludes direct spells. Rows only show **Roll** when a dice roll exists; utility actions use **Use** or **Activate**.
- Tablet Equipment has local Equipped, Containers, and Consumables sections. Containers are expandable and show their own capacity, contents, and currency.
- Tablet Features exposes per-feature current/max charge controls beside the owning feature, while keeping non-charge feature rows quiet.
- Tablet Notes keeps the selected note full-width. **Browse notes** opens the picker as an overlay drawer rather than a permanent list column.
- Tablet Skills is a focused searchable/filterable roll table. Tablet Proficiencies is one scrollable group of collapsible Armor, Weapons, Tools, and Languages sections.

## Features

- Features uses the shared header and a plain page-location title.
- Charges live beside their owning feature as a compact current/max control with direct decrement and increment actions.
- Features without charges do not show a placeholder control.

## Actions

- Actions uses the shared header and a plain page-location title.
- It contains attacks, activated features, item activations, and non-spell utility actions; direct spells remain in Spells.
- Only actions with a dice roll use **Roll**. Non-roll actions use **Use** or **Activate**.
- Per-row ellipsis behavior remains an implementation decision.

## Notes

- Notes uses the shared header and a plain page-location title.
- Local Notes, Backstory, and Journal are local section controls.
- The active note has an explicit **Browse notes** control that opens the note picker as a bottom drawer.
- The picker overlays the full-width note content; it never creates a permanent narrow note-list column on mobile.

## Equipment

- Equipment uses the shared header and a plain page-location title.
- Its local sections are Equipped, Containers, and Consumables; currency is not a standalone section because it belongs to a container.
- Containers show capacity, item count, and container-owned currency. Multiple bags are first-class expandable rows.
- The selected container's management shelf supports item/currency transfers, equip or unequip, adding items, and explicit removal outcomes.
- Attunement is a top-level, tappable summary control.

## Skills

- Skills is a dedicated sheet destination with search and local proficiency/expertise/ability filters.
- Each row shows its ability, modifier, proficiency state, and a restrained roll affordance.

## Proficiencies

- Proficiencies is a dedicated sheet destination, separate from Skills.
- Armor, Weapons, Tools, and Languages are one vertically scrollable set of collapsible categories; it does not use category tabs.

## Next work

- Re-evaluate desktop and tablet shell density so Actions and Spells each own the primary workspace instead of sharing one vertical panel.
- Inventory needs a container-first model: carried root, multiple expandable bags/containers, capacity/item counts, and item movement between containers.
