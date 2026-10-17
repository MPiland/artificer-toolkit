# Slice workbook: PLATFORM-20 (one flat compile stage: no dead or copy-only compilers)

**Status:** T1 merged in m62 (21d8d8206); 20.1 and 20.2 DONE. **T2 green** on `c1a2fcfad` (`claude/platform-20-t2`, `ci/platform-20-t2`); 20.3 and 20.4 ready to close (2026-10-16).
**Base:** `claude/sweet-cartwright-3b0fe8` at ea6b4a50f.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md). Decisions: [ADR 0003](../adr/0003-vocabulary-authored-compiled-engine-data.md), [engine.md](../architecture/engine.md).

## Resume here

1. Red `2c37820a9` on `ci/platform-20-red`: Tests run 38987927973 fails in `@artificer-toolkit/shared#build` (base has no `ModifierGrantAuthoredFor`; a flat override of a modifier grant is TS2322 across ~1,000 members). Expected red.
2. Green attempt 1 `de1d6d7c7` failed: `REPLACE_RANGE/DURATION/SHAPE/CHARGE_RESET_KIND` had `never` payloads (hidden by the old widened union), and the off-hand `max: 0` override spread an uncorrelated payload. Fixed in `2a4a83fba` (typed payloads; generic `keepNegativeOnly`).
3. Green attempt 2 `2a4a83fba` failed typecheck: the weapon builders returned the wide union (rage.test.ts spread), and `creatureAuthoredDtoSchema` output was not assignable to `CreatureAuthored` because the schema allows `SENSE_RANGE` `SET_VALUE` but the core kind map did not. Fixed in `1da390a7f` (`WeaponAbilityModifier`; `SENSE_RANGE: [BONUS, SET_VALUE]`; schema-authored parity type test).
4. Attempts 3-6 aligned the schema and authored modifier types: `DURATION SET_VALUE` takes a duration payload; `SENSE_RANGE` stays `BONUS`-only (RELIABILITY-5.1) and the schema drops its always-rejected `SET_VALUE` variant, with the per-domain union still naming it "not supported yet"; the parity test names every unauthored variant.
5. **T1 green** on `57625a799`: Tests 38992261820 (attempt 2; attempt 1 hit an unrelated `nativeRoomEscapeAction` console-spy flake), Live 38992261797. Reported to the orchestrator for merge.
6. 20.4 docs are in ADR 0003 (Compile stage as built) and engine.md (Compile stage).
7. Orchestrator ruled option A with a split: **T1** (this branch) is 20.1, 20.2, the flat compiled type, typed fold reads and the builder workarounds removed; report green and the orchestrator merges. **T2** (same session, on merged T1) replaces `grant: boundedJson` in `modifierOperationSchema` with typed `scope`/`payload`, rewrites the rules-runtime consumers without `record()`, migrates stored dev rows idempotently with a test, and checks projection byte budgets. AC 20.3 closes with T2.
8. **T2** on `claude/platform-20-t2`: `modifierOperationSchema` carries typed `scope`, `domain` (`modifierDomainParamsDtoSchema`), optional `payload` (`modifierPayloadDtoSchema`) and `scopeResourceIds`; fold contributions drop `grant`. Every rules-runtime reader narrows the typed fields; `record()` remains only on saving-throw definition rows in `encounterActiveGrants.ts`, not on modifiers. Red goes to `ci/platform-20-t2-red` (tests only), green to `ci/platform-20-t2`.
9. Stored rows: `apps/apis/convex/rules/modifierOperationMigration.ts` rewrites frozen operations in `characterActiveRuleEffects`, `encounterActiveRuleEffects` and `encounterSpatialRuleEffects` from their compiled-grant dump (grant compiler plus fold fact builder), validates the definition and re-checksums it; idempotent, with `modifierOperationMigration.test.ts`. Run it once on the local backend after deploy (`rules/modifierOperationMigration:run`).
10. Not migrated: immutable copies of old definitions in rule receipts (`consumedGrants`, `endedEffect`, `consumedSpatialEffects`), pending snapshot parts and Session Worker room storage. They are chained and checksummed history, so the standard local reset clears them rather than a rewrite. A rewritten spatial `definitionChecksum` also no longer matches a pending occurrence pinned to the old one.
11. Byte budgets: an operation now carries `scope`, `payload` and `scopeResourceIds` instead of a copy of the whole compiled grant (id, order, kinds, domain, payload, authored restrictions), and contributions no longer repeat the grant, so the fold output and frozen definitions only shrink under the 240,000-character fold caps.
12. T2 red `784bb8c4a` on `ci/platform-20-t2-red`: Tests 38996674304 failed as expected, Live 38996674222 green. Green attempt 1 `a97238e19` failed TS2322 (the compiled payload type admitted the `CHARGE_LIMIT` option payload); `d3ca3f665` narrowed `CompiledModifierGrant.payload` to reachable payloads. Its Tests run failed on `payload: undefined` in checksummed rule documents and stale `.grant` reads from the phase merge; `c1a2fcfad` omits the key and reads typed payloads. Live auto-fix committed generated drift as `b3da4bf0f`.
13. **T2 green** on `c1a2fcfad`: Tests 38998774898, Live 38998774862. Next: the orchestrator merges T2, then run `rules/modifierOperationMigration:run` once on the local backend after deploy.

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

## Escalation (resolved by T2)

`CharacterGrantFoldModifier.grant` (and `domain`) are `boundedJson` in `packages/schema/src/api/characterGrantFoldRules.ts` and persisted in Character mechanics, active rule effects, encounter runs, scene live state and spatial effects. About 35 rules-runtime sites read `grant.scope`, `grant.payload` and `grant.domain` through `record()`. Removing the `jsonFact` passthrough means replacing `grant` with typed fields in that persisted contract, rewriting those consumers and migrating stored rows. Ruled 2026-10-16: option A, delivered as T2 (see Resume here, step 6).
