# Slice workbook: PLATFORM-20 (one flat compile stage: no dead or copy-only compilers)

**Status:** T1 green candidate in progress (2026-10-16); T2 (typed persisted fold `grant`) follows on merged T1.
**Base:** `claude/sweet-cartwright-3b0fe8` at ea6b4a50f.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md). Decisions: [ADR 0003](../adr/0003-vocabulary-authored-compiled-engine-data.md), [engine.md](../architecture/engine.md).

## Resume here

1. Red `2c37820a9` on `ci/platform-20-red`: Tests run 38987927973 fails in `@artificer-toolkit/shared#build` (base has no `ModifierGrantAuthoredFor`; a flat override of a modifier grant is TS2322 across ~1,000 members). Expected red.
2. Green attempt 1 `de1d6d7c7` failed: `REPLACE_RANGE/DURATION/SHAPE/CHARGE_RESET_KIND` had `never` payloads (hidden by the old widened union), and the off-hand `max: 0` override spread an uncorrelated payload. Fixed in `2a4a83fba` (typed payloads; generic `keepNegativeOnly`).
3. Green attempt 2 `2a4a83fba` failed typecheck: the weapon builders returned the wide union (rage.test.ts spread), and `creatureAuthoredDtoSchema` output was not assignable to `CreatureAuthored` because the schema allows `SENSE_RANGE` `SET_VALUE` but the core kind map did not. Fixed in `1da390a7f` (`WeaponAbilityModifier`; `SENSE_RANGE: [BONUS, SET_VALUE]`; schema-authored parity type test).
4. Green attempt 3 `1da390a7f` on `ci/platform-20`: watching (log `local-validation/platform-20/watch-green-3.log`).
5. 20.4 docs are in ADR 0003 (Compile stage as built) and engine.md (Compile stage).
6. Orchestrator ruled option A with a split: **T1** (this branch) is 20.1, 20.2, the flat compiled type, typed fold reads and the builder workarounds removed; report green and the orchestrator merges. **T2** (same session, on merged T1) replaces `grant: boundedJson` in `modifierOperationSchema` with typed `scope`/`payload`, rewrites the rules-runtime consumers without `record()`, migrates stored dev rows idempotently with a test, and checks projection byte budgets. AC 20.3 closes with T2.

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

`CharacterGrantFoldModifier.grant` (and `domain`) are `boundedJson` in `packages/schema/src/api/characterGrantFoldRules.ts` and persisted in Character mechanics, active rule effects, encounter runs, scene live state and spatial effects. About 35 rules-runtime sites read `grant.scope`, `grant.payload` and `grant.domain` through `record()`. Removing the `jsonFact` passthrough means replacing `grant` with typed fields in that persisted contract, rewriting those consumers and migrating stored rows. Ruled 2026-10-16: option A, delivered as T2 (see Resume here, step 6).
