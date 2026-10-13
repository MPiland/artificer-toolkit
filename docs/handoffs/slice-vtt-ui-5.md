# Slice workbook: VTT_UI-5 (Creatures see with their stat-block senses)

**Status:** OPEN (started 2026-10-13)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

Creature senses are free-text display strings today (`subjects/creature.ts`, `snapshotStatBlock`), and `roomSceneVision` binds Character actors only, so a Creature token has only its authored token sight.

1. **VTT_UI-5.1.** Creature senses are authored as structured entries: a sense definition reference and a range, the same shape a Character's sense grant resolves to (a range is DISTANCE or UNLIMITED, lane 3 ruling 3; lengths bounded by `AUTHORED_LENGTH_AMOUNT_MAX`). Every SRD Creature's senses migrate to them. The printed stat-block text is derived from the structured entries, not stored beside them (no duplicate field). Passive Perception stays where it is today. A source-data test proves each SRD Creature's structured senses match its printed senses (oracle `SRD_CREATURE_STAT_BLOCKS`, as `creatureSrdArmorClass.test.ts` does for AC). The Creature editor authors the entries through the node map (shared renderer, no domain wrapper).
2. **VTT_UI-5.2.** A Creature token on a Scene carries its senses like a Character token, derived by the same function that composes Character token senses (VTT_UI-3.4, `sceneStoredTokenDtoSchema` keeps senses unpersisted), redacted per viewer by ADR 0034 control. The GM's preview of a Creature's view and combat perception both use them, replacing the D100 "undecided sight for unmodeled free-text Creature Senses" case where the senses are now modeled.

Out of scope: Devil's Sight (VTT_UI-3.5, queued after this slice) and RELIABILITY-5 (sense modifier units). The SRD monster trait "magical darkness doesn't impede its darkvision" (imps, devils) is in scope only as data if the sense model already expresses it; otherwise record it for VTT_UI-3.5.

Read first: D100, D108 and the VTT_UI-3.4 notes in `docs/handoffs/phase-08-2-decisions.md`; `docs/architecture/live-sessions.md` (Scene token senses); ADR 0034; AUTHORING-17 slice B notes in the main handoff (the Creature AC pattern to copy).

## Closes

- VTT_UI-5.1, VTT_UI-5.2.

## File scope

`packages/schema` (Creature senses), `packages/shared` sense and token-sense composition, `packages/source-data/src/srd/creatures/**`, `packages/rules-runtime` combat perception sense inputs, the Session Worker's `roomSceneVision`, Convex Creature publication and stat-block snapshot, the Creature node map and editor. Out of scope: basic actions (parallel ATTACK-18 slice E), the action drawer and stage overlays (parallel VTT session).

## Red-first checklist

1. SRD source-data test: structured senses match printed senses for all SRD Creatures (red before migration).
2. A Creature with darkvision 60 ft perceives a token in darkness 50 ft away and not one 70 ft away in combat perception (red today: undecided).
3. A Creature token's Scene DTO carries its senses for the GM and for a controlling player, and not for a player without control.
4. The Creature and Character token senses come from one function (a test exercises both through it).
5. Publication refuses a malformed sense entry (unknown sense definition, out-of-bounds range).
6. Editor: a Creature author adds a sense entry and it reaches the published Creature.

Dev data changes: the main session resets and reseeds after merge.

## Status log

- 2026-10-13: workbook written; session started.

## Proposed ledger edits (filled by the slice session)
