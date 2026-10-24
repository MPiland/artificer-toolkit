# Slice RELIABILITY-12: Convex infers real authoring DTO and speed types

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

- **RELIABILITY-12.T1** closes ACs RELIABILITY-12.1 and 12.2.
  - The intersection-built schemas in `packages/shared` `facet.ts` and `effects/path.ts`, recursion included, become flat unions. Convex `_generated/api.d.ts` then has no `any` for facet restrictions or effect paths (`BASIC_ACTION`). The authoring contract and publication tests stay unchanged.
  - An encounter stat block's `speeds` is typed from the stored authored creature speed shape instead of `z.array(z.unknown())`. Derive that shape; do not invent one.
  - The `generatedApiTypes` type test proves both. RELIABILITY-11 found the same Convex intersection-to-`any` defect earlier; follow its fix pattern ([slice-reliability-11.md](slice-reliability-11.md)).

## Log

- 2026-10-24, AC 12.2: the encounter GM actor's `statBlock.speeds` (`packages/schema/src/api/encounterData.ts`) is now `z.array(speedDtoSchema)`, the stored Creature speed shape (`subjects/creature.ts`). `encounterSourceProjectionFactsSchema` picks it, so stored facts and the projection share the shape. `snapshotStatBlock` (`rules-runtime/src/encounterProjection.ts`) parses each stored speed as it already did for senses. `EncounterEnemyStatBlock` formats a typed `SpeedDto` instead of narrowing `unknown`. Proof: `apps/apis/convex/generatedApiTypes.test.ts` "types an encounter stat block speed as the stored Creature speed". The five generated `speeds: Array<any>` lines in `api.d.ts` were hand-set to the real shape, and CI's live-backend auto-fix corrects any codegen formatting drift.
- 2026-10-24, AC 12.1 escalated to Lane 1 (contradiction). A throwaway light-lane measurement walked the zod defs the way `zodToConvex` expands them: intersections become cross products, non-cyclic shared lazies are inlined, and a cycle counts as one node. Today's whole BASIC_ACTION document validator is 9,114 nodes (488 KB JSON), because its intersections stop at `v.any()`. Fully flat unions would reach 474,478 nodes for one `facetDtoSchema`, 4.9×10¹¹ for `pathDtoSchema`, and 4.5×10⁷ for `pathDtoSchema` even with every facet kept opaque. The reason is that Convex validators have no references: every shared subtree is inlined at each use. Two more blockers:
  - The outcome payloads hold true cycles (`followUpSave` and `followUpCheck` reach outcomes, and manifest reaches behavior paths), which a Convex validator cannot express, so some `v.any()` leaf stays.
  - `facetDtoSchema` is `pipe(transform(rejectExcessiveFacetNesting), object)`, and its input-side transform maps to `any` whatever comes after it. The depth guard must still reject structurally invalid deep input (`authored-limits.test.ts`), so it cannot simply move to a post-parse refine.

  Waiting on the ruling. Options sent: A, a bounded typed shell with named opaque leaves; B, keep facet and paths opaque at the Convex boundary and recover types from the DTO at the web data adapter; C, a compact persisted authoring contract, which does not remove the inlining or the cycles.
