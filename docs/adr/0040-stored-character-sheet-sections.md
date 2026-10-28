# ADR 0040: Stored Character Sheet sections

- **Status:** decision (RELIABILITY-21.T16, AC RELIABILITY-21.16 and 21.3)
- **Date:** 2026-10-28
- **Scope:** `apps/apis/convex/characters` (Character writes and Sheet reads), `campaigns/characterSheet.ts`, `packages/schema/src/projections/characterSheetSections.ts`
- **Builds on:** [ADR 0036](0036-versioned-content-snapshots-and-browser-builder.md), whose content-snapshot heads stand for the authored content a Sheet resolves against
- **Verification:** `apps/apis/convex/characters/sheetSections.test.ts` (stored and live parity for owner, GM and party viewers; a stored read's I/O budget; fallback once an input changes outside a Character write)

## Context

Every Sheet query re-derived the whole Sheet: it loaded the Character, its sources, the System and every class-list Spell, then evaluated rules (350–400 ms on a level 1 Cleric beside the SRD) to return one slice of 1–24 KB. A Sheet page issues six slice queries plus a panel and preparation query per open surface, and each Sheet command invalidates all of them reactively. In builder-browser and character-sheet-browser the re-derivations queued behind each other until `characters/sheetSlices:get` neared the 1 s query limit and journeys needed reruns.

Projection after derivation costs under 1 ms per section. Rules evaluation does not depend on the viewer; only the viewer projection (visible conditions, display adjustments, private fields) and panel command filters do.

## Decision

1. **A Character write derives the Sheet once and stores it per section.** A write that evaluated the Sheet itself (active sources with their prose: most Sheet commands, GM writes and Campaign refreshes) ends in `writeCharacterRecord` with `storeCharacterSheetSections`. Every other Character write queues the internal mutation `characters/sheetSectionDerivation:store`, which derives the Sheet once and stores it. Those writes are a Builder commit (it reads only referenced content, ADR 0036 S7, and stays inside its read budget), a resolution-scope command, and the focused inspiration, party-visibility and note writes. Reads in the moment before it runs derive live. Each store projects its one evaluation for each viewer that can read the Character: `CHARACTER_OWNER`; `CAMPAIGN_OWNER` when the Campaign owner is someone else; and `PARTY_MEMBER` slices while "Party can view" is on. For each viewer it stores every slice except Notes, the panel for every target the Sheet lists (`listCharacterSheetPanelTargets`) and the preparation options.
2. **Two tables.** `characterSheetSections` holds one row per `(characterId, viewer, section)` with the section's canonical JSON and checksum. `characterSheetDerivations` holds one row per Character: the input fingerprint and the list of stored section checksums. A write replaces only the rows whose checksum changed, deletes rows that no longer exist and rewrites the derivation row only when its fingerprint or list changed.
3. **The fingerprint covers every stored input the derivation reads.** It checksums:
   - the Character document, Sheet state and play checksums and its stream version;
   - whether a Builder draft exists, and the route id;
   - the System document checksum;
   - the content-snapshot head revision of each source and of the Campaign;
   - only the Campaign fields the Sheet reads (owner, System, status, maturity, attunement override, catalogues), so notebook and counter patches do not miss;
   - the Campaign Character state and currency options;
   - the Character's active and carried rule effects.
4. **Reads serve a stored section only while it is current.** `sheetSlices:get`, `panels:get`, `preparationOptions:get` and the Campaign `panel` and `preparationOptions` queries call `readStoredCharacterSheetSection`. It applies the same authority the derived read applies (`readAuthorizedCharacterSheetState`, plus the party visibility check), recomputes the fingerprint and returns the stored section when it matches. On any miss the query derives live as before, so a miss is slower but never wrong, and the derived path still reports access errors.
5. **Snapshot heads are read current.** An owner's preparation options carry the content-snapshot manifest. Builds finish without a Character write, so a stored read takes the manifest from the current heads (`readStoredCharacterPreparationOptions`). The fingerprint covers only head revisions.
6. **Not stored.** Notes (private, read without sources); the Proficiencies panel (it resolves the whole catalogue); panel targets the Sheet does not list (cast-level and passive entries). These always derive live.

## Consequences

- A Sheet read touches no authored content: it reads authority rows, the fingerprint inputs and one section.
- Writes do more work (one projection per viewer and section, and the changed rows). Most already evaluated the Character; the others pay one scheduled derivation. A Sheet command evaluates once to validate the command; its write reuses that evaluation's source context, so authored content is read once per command.
- Accepted residuals, each a correct live fallback until the next Character write:
  - a write that queues the derivation, until that derivation runs;
  - live-table checkpoint writes to a held Character's play state;
  - Campaign or source changes outside a Character write (catalogue edits, membership changes, published content) change the fingerprint.
- No migration: pre-launch local data is reset after merge (D196). A Character without stored sections reads live until its next write.
