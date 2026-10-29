# ADR 0041: Stored Character Sheet sections

- **Status:** decision (RELIABILITY-21.T16, AC RELIABILITY-21.16 and 21.3)
- **Date:** 2026-10-28
- **Scope:** `apps/apis/convex/characters` (Character writes and Sheet reads), `campaigns/characterSheet.ts`, `packages/schema/src/projections/characterSheetSections.ts`
- **Builds on:** [ADR 0036](0036-versioned-content-snapshots-and-browser-builder.md), whose content-snapshot heads stand for the authored content a Sheet resolves against
- **Verification:** `apps/apis/convex/characters/sheetSections.test.ts` (stored and live parity for owner, GM and party viewers; a stored read's I/O budget; fallback once an input changes outside a Character write)

## Context

Every Sheet query re-derived the whole Sheet: it loaded the Character, its sources, the System and every class-list Spell, then evaluated rules (350–400 ms on a level 1 Cleric beside the SRD) to return one slice of 1–24 KB. A Sheet page issues six slice queries plus a panel and preparation query per open surface, and each Sheet command invalidates all of them reactively. In builder-browser and character-sheet-browser the re-derivations queued behind each other until `characters/sheetSlices:get` neared the 1 s query limit and journeys needed reruns.

Projection after derivation costs under 1 ms per section. Rules evaluation does not depend on the viewer; only the viewer projection (visible conditions, display adjustments, private fields) and panel command filters do.

## Decision

1. **A Character write queues one derivation, which stores the Sheet per section.** Every write of an `ACTIVE` Character (`writeCharacterRecord`, and the focused inspiration, party-visibility and note writes) queues the internal mutation `characters/sheetSectionDerivation:store` about 300 ms ahead (`CHARACTER_SHEET_STORE_DELAY_MS`). A Character has at most one queued derivation, recorded in `characterSheetPendingStores` with its scheduled id and a token: a newer write cancels it and queues its own, so a burst of writes (a Builder session, a run of Sheet commands) derives once. A derivation that started before it could be cancelled sees a newer token and stores nothing. Builder draft saves are not Character writes and queue nothing. Reads before the derivation lands derive live (decision 7). Each store projects its one evaluation for each viewer that can read the Character: `CHARACTER_OWNER`; `CAMPAIGN_OWNER` when the Campaign owner is someone else; and `PARTY_MEMBER` slices while "Party can view" is on. For each viewer it stores every slice except Notes, the panel for every target the Sheet lists (`listCharacterSheetPanelTargets`) and the preparation options.
2. **Two tables.** `characterSheetSections` holds one row per `(characterId, viewer, section)` with the section's JSON and checksum. `characterSheetDerivations` holds one row per Character: the input fingerprint and the list of stored section checksums. A write replaces only the rows whose checksum changed, deletes rows that no longer exist and rewrites the derivation row only when its fingerprint or list changed.
3. **The fingerprint covers every stored input the derivation reads.** It checksums:
   - the Character document, Sheet state and play checksums;
   - whether a Builder draft exists, and the route id;
   - the System document checksum;
   - the content-snapshot head revision of each source and of the Campaign;
   - only the Campaign fields the Sheet reads (owner, System, status, maturity, attunement override, catalogues), so notebook and counter patches do not miss;
   - the Campaign Character state and currency options;
   - the Character's active and carried rule effects.
4. **Reads serve a stored section only while it is current.** `sheetSlices:get`, `panels:get`, `preparationOptions:get` and the Campaign `panel` and `preparationOptions` queries call `readStoredCharacterSheetSection`. It applies the same authority the derived read applies (`readAuthorizedCharacterSheetState`, plus the party visibility check), recomputes the fingerprint and returns the stored section when it matches. On any miss the query derives live as before, so a miss is slower but never wrong, and the derived path still reports access errors.
5. **Snapshot heads are read current.** An owner's preparation options carry the content-snapshot manifest. Builds finish without a Character write, so a stored read takes the manifest from the current heads (`readStoredCharacterPreparationOptions`). The fingerprint covers only head revisions.
6. **The stream version is added at read.** Every play write bumps it, so stored rows and the fingerprint leave it out and a read sets it from the Character's play record. A write then rewrites only the sections whose content changed: an HP change rewrites each viewer's COMMON slice, bounded at 12 KB per viewer beside the unchanged 800 B play-record budget (`playStateBudget.test.ts`).
7. **Sheet commands no longer store sections inline (amended 2026-10-29, RELIABILITY-21.T16).** The first version stored every section, panels included, in the Sheet command's own transaction, because a queued store per write re-evaluated the whole Sheet and its second invalidation reran every subscribed slice read past Convex's 1 s query limit (vtt-browser run 40756050318). Storing inline kept that cost in the write instead: on CI, `sheetCommands:execute` ran at a median of 468 ms and a maximum of 1123 ms, and the queued stores from a Builder burst retried on optimistic-concurrency conflicts up to 1073 ms (BJ 40899882538). The scheduled store of decision 1 now does it for every writer, once per burst. The trade-off: until the store lands, about 300 ms after the last write plus its own run, every Sheet read derives live, at the pre-ADR cost, and the store's invalidation reruns subscribed reads once more. That is one extra rerun per burst rather than per write. A store serializes each section once, with plain `JSON.stringify`, and checksums that string. Projection builds each section in a fixed key order, so a checksum is stable across derivations; canonical JSON cost about 5 ms of each command for no gain (RELIABILITY-21.16). The store fingerprints the row the write produced instead of reading the Character back.
8. **Not stored.** Notes (private, read without sources); the Proficiencies panel (it resolves the whole catalogue); panel targets the Sheet does not list (cast-level and passive entries); and the panel of a listed Spell the Character does not reference (a full-list Spell not learned or prepared), since the Sheet evaluates only referenced Spells (`collectCharacterReferencedSpellIds`). These always derive live.

## Consequences

- A Sheet read touches no authored content: it reads authority rows, the fingerprint inputs and one section.
- Writes stay small: they queue one derivation, and a burst of writes pays one derivation (one projection per viewer and section, and the changed rows).
- Accepted residuals, each a correct live fallback until the next Character write:
  - every write, until its queued derivation runs (decision 7);
  - live-table checkpoint writes to a held Character's play state;
  - Campaign or source changes outside a Character write (catalogue edits, membership changes, published content) change the fingerprint.
- No migration: pre-launch local data is reset after merge (D196). A Character without stored sections reads live until its next write.
