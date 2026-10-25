# Slice RULES-2.T9f, T12 and AUTHORING-1.T2: the neutral tracer System

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md). ADR 0039 governs this slice. The ledger text of each task is its scope. Run the tasks in this order:

1. **RULES-2.T9f1, T9f2 and T9f3** (D192 split, user-approved): T9f1 makes sizes System core codes. T9f2 keys ability-score records by definition id and reseeds. T9f3 changes authored ability references to `abilityDefinitionId` and reseeds, and the D192 codemod exception covers it. List every golden flip.
2. **RULES-2.T12:** a second neutral tracer System, a Fate-like test fixture, drives the Encounter pipeline through the adapters.
3. **AUTHORING-1.T2** (AC AUTHORING-1.5): the same tracer System also travels the real publication, capability, catalogue and shell reads. The docs and ERDs describe the System-neutral model. Use one tracer fixture for both tasks, never a second one.

The tracer is a test fixture and is not seeded content.

## Log

### 2026-10-24: T9f split proposed

T9f is too large for one task. I sent the orchestrator the split packet `rules-2-t9f-split-packet.md` in the shared notes folder. My recommendation is option B, three tasks:

- **T9f1:** sizes become System core codes. No reseed.
- **T9f2:** ability-score records are keyed by the ability definition id. Needs a reseed.
- **T9f3:** authored ability references become `abilityDefinitionId`. Needs a reseed.

T9f1 does not depend on the ruling, so I started it. T9f2 and T9f3 wait for the reply.

Ruling D192 (user approved): split B. The order is T9f1 (size 3), then T9f2 (5), then T9f3 (5), and each is reported green-ready on its own. T12 follows T9f1 and T9f2, and T9f3 may run beside T12. A one-off ts-morph codemod is allowed for the mechanical rewrite in T9f2 and T9f3 only. It stays in the scratchpad and is not committed, the full diff is reviewed before commit, and this log records its summary and the count of changed sites.

### 2026-10-24: T9f1, sizes are System core codes

What changed:

- **Size list.** Sizes are a `size` core-code kind on the System. The D&D 5e list is `DND5E_SIZES` in `rules-runtime/systems/dnd5e/coreCodes.ts`. It runs smallest first, and each size carries `spaceFeet` where it has one. Neutral code reads a size's rank and space only through `sizeRank` and `sizeSpaceFeet(gameSystemId, size)` in `systemSizes.ts`. Both throw on a System that defines no sizes.
- **Encounter callers** (reach, grapple, drag, passage, attack slots, area, rule warnings, disarm, optional contests) pass `gameSystemId` through to those lookups. The rule-warnings input changed from `actorSize`/`targetSize` to `sizes: { gameSystemId, actor, target }`.
- **Wire types.** The schema types a size as `systemCoreCodeSchema`. Shared `SizeCode` is now `string`. Deleted `shared/domains/core/size.ts` (`SIZE_REGISTRY`, `SIZE_OPTIONS`, `sizeRank`) and its test.
- **Authoring.** New System source table `sizes`. The node maps draw size selects from `table('sizes', …)`.
- **Character sheet and builder.** They read size labels and options from `systemCoreCodeRegistry.entries(systemId, 'size')`. A `SIZE_OVERRIDE` outside the System's list is refused.
  - `sheetPanel` gained `vocabularyOptions`, shared by the alignment and creature-type options.
  - The web `SIZE_OVERRIDE` commit now goes through the generic path with the other vocabulary overrides.
- **SRD content.** It authors with source-data's own `srd/sizes.ts` (`SIZE_CODE`). A parity test in `systemSizes.test.ts` proves the System defines every size the SRD authors.
- **Session Worker.** I moved the action persistence builders out of `nativeEncounterRules.ts` and into a new `nativeEncounterActionPersistence.ts`, to keep `nativeEncounterRules.ts` within its size budget. Their behavior did not change.
- **Size budget.** I lowered the `fileSizeBudget.json` caps on files that shrank:

  | File                      | Old cap | New cap |
  | ------------------------- | ------- | ------- |
  | `nativeEncounterRules.ts` | 1749    | 1655    |
  | `sheetPanel.ts`           | 1691    | 1688    |
  | `path.ts`                 | 3620    | 3619    |
  | `facet.ts`                | 2513    | 2512    |

- **Docs.** I updated `docs/architecture/rules-runtime.md`, in the System vocabulary paragraph.

Behavior:

- One change is visible to users: size dropdowns now list sizes smallest first. They used to list TINY through GIANT, then FINE, DIMUNITIVE and COLOSSAL.
- No other behavior changes, and nothing needs reseeding. Stored size codes are the same strings as before.
- Golden and snapshot flips: none.
- Moved assertions. Four schema tests expected an unknown size (`NOT_A_SIZE`, `AVERAGE`, `ENORMOUS`) to fail parsing. The schema now checks only the core-code shape, so those samples became malformed codes (`not a size`, `average`, `enormous`) that it still rejects. System membership has new proofs at its owners: node-map normalization clears a size the System does not list (`systemVocabularyOptions.test.ts`), and a `SIZE_OVERRIDE` of `AVERAGE` is refused (`sheetExtras.test.ts`). `sizeRank` already returned null for `ENORMOUS` (`systemSizes.test.ts`).

Proposed follow-up (ledger proposal, out of scope by review): retire FINE, DIMUNITIVE, GIANT and COLOSSAL from the D&D 5e size list. No SRD content uses them, and DIMUNITIVE is misspelled.

Merge risk: the sibling T9e lane may also edit `fileSizeBudget.json` and `nativeEncounterRules.ts`.

### 2026-10-24: T9f1 review fixes (approved with fixes at 54c5e468b)

- **Ingress rejection restored.** `requireAuthoredSizes` (`systemSizes.ts`) refuses a Creature, Race or Vehicle size, or a `TARGET_SIZE_AT_MOST` attack-slot condition in their Features, that the System does not list. Publication (`normalizePublicationDocument`) and import staging (`stageCustomAuthored.prepareActive`) call it before node-map normalization, which would otherwise clear the code. Draft saves store raw work-in-progress JSON and stay unchecked; publication is the gate.
- **Companion rule policy.** `characterCompanionMechanicsRuleFacts` refuses an unlisted companion size and an unlisted `SIZE_OVERRIDE`.
- **Attack slots fail closed.** `TARGET_SIZE_AT_MOST` refuses an unlisted condition size, and an unlisted target size never satisfies it (it used to rank -1, which always passed).
- **Web defaults.** A System marks one size `isDefault` (D&D 5e: MEDIUM). `defaultSize(systemId)` feeds `createEmptyCreature`, `createEmptyBaseRace` and `normalizeRaceForSubmit`. The guided Creature and Race size lists come from `sceneSizes(systemId)`, the System's sizes that fill a Scene space, through `guidedSizeOptions`.
- **Proofs:** `systemSizes.test.ts` (authored refusals, default, scene sizes), `encounterAttackSlots.test.ts` (fail closed), `characterCompanionMechanicsRuleFacts.test.ts` (new), `creaturePublication.test.ts` (publish refuses `ENORMOUS`), `systemVocabularyOptions.test.ts` (normalization clears an unlisted size on the creature, race, vehicle and attackSlotCondition maps), `guidedValues.test.ts`. Web fixtures that used unregistered System ids (`dnd-5e-srd`, `system-1`, a random UUID) now use `DND5E_SYSTEM_ID`, since the default size needs a registered System.
- **Residual size paths not covered by `requireAuthoredSizes`:** facet `sizes`, manifest `statBlock.size` and `maximumTargetSize`, and effect `appliesWhen` size conditions. Node-map normalization still clears unlisted codes there.
