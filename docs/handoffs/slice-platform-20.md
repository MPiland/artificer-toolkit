# Slice workbook: PLATFORM-20 (one flat compile stage: no dead or copy-only compilers)

**Status:** green candidate in progress (2026-10-16). The persisted fold `grant` passthrough is frozen pending an architect ruling (see Open escalation).
**Base:** `claude/sweet-cartwright-3b0fe8` at ea6b4a50f.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md). Decisions: [ADR 0003](../adr/0003-vocabulary-authored-compiled-engine-data.md), [engine.md](../architecture/engine.md).

## Resume here

1. Red: the two new test files alone on base, pushed to `ci/platform-20-red`.
2. Green: the full change on `ci/platform-20`; watch with `pwsh -NoProfile -File scripts/watchCi.ps1`.
3. Fix CI failures; then 20.4 docs; then report to the orchestrator.

## ACs

- **20.1** No unused compiler code.
- **20.2** No copy-only compilers.
- **20.3** Modifier grants compile to one flat shape; the fold builder reads typed fields.
- **20.4** ADR 0003 and engine.md describe the compile stage as built.

## Compilers deleted

| Compiler                                               | Reason                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| Character compilers (`subjects/compilers/character/*`) | No production caller.                                              |
| `compileShape` / `CompiledShape`                       | No production caller.                                              |
| `ForbidIfMissing`, `compileScalingSource`              | Unused type; the compiler returned its input unchanged.            |
| `compileSpeed`                                         | Copy-only; callers use `SpeedAuthored`.                            |
| `compileRange`                                         | Copy-only for every sense range; callers use `SenseRangeAuthored`. |
| `compileStartingEquipment` and helpers                 | Copy-only; callers use `StartingEquipmentAuthored`.                |
| `compileFeatureOption`                                 | Wrapper around `compileFeatureBase`.                               |

## Compilers kept (each validates, resolves or reshapes)

| Compiler                                                                               | Why it stays                                                          |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `compileDuration`                                                                      | Strips authoring node ids; deleting it changes ~292 stored durations. |
| `compileCharge`                                                                        | Strips bonus node ids.                                                |
| `compileModifierGrant`                                                                 | Validates the kind against its value domain; flat shape.              |
| Grant compilers (feat, sense, spell, proficiency)                                      | Resolve selection, scaling and target mode.                           |
| Subject compilers (background, vehicle, class, race, creature, feat, spell, equipment) | Drop presentation metadata and compose grant compilers.               |
| Damage, condition, effect compilers                                                    | Resolve and validate authored effects.                                |

## 20.3 design

- `MODIFIER_KINDS_BY_DOMAIN` is `as const satisfies Record<ValueDomainCode, readonly ModifierKind[]>`. The old annotation widened every domain to every kind, so `ModifierGrantAuthored` was ~960 uncorrelated members (TS2590 source).
- `ModifierGrantAuthoredFor<V>` is one member per supported kind with that kind's payload; `ModifierGrantAuthored` is the union over domains.
- `CompiledModifierGrant` is flat: independent `valueDomainCode` and `modifierKind`, validated `domain` and `payload`. Stored compiled JSON is unchanged, so no recompile migration.
- The fold builder reads proficiency and scaling targets through typed narrowing; no `Record<string, unknown>` casts remain.

## Open escalation

`CharacterGrantFoldModifier.grant` (and `domain`) are `boundedJson` in `packages/schema/src/api/characterGrantFoldRules.ts` and persisted in Character mechanics, active rule effects, encounter runs, scene live state and spatial effects. About 35 rules-runtime sites read `grant.scope`, `grant.payload` and `grant.domain` through `record()`. Removing the `jsonFact` passthrough means replacing `grant` with typed fields in that persisted contract, rewriting those consumers and migrating stored rows. Asked the orchestrator (option A vs B); not changed in this slice until ruled.
