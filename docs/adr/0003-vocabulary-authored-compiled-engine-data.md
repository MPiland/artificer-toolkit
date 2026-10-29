# ADR 0003: Distinct data layers from vocabulary to engine input

- **Status:** decision — data-layer vocabulary retained; SQL row ownership superseded by [ADR 0029](0029-convex-backend-cutover.md)
- **Date:** 2026-07-10
- **Scope:** domain data lifecycle and cross-package model boundaries
- **Update when:** a model is reused across vocabulary, authored, compiled, persistence, or engine layers
- **Verification:** `packages/schema/src/vocabulary`; `packages/shared/src/domains/**/authored`; `packages/shared/src/domains/**/compilers`; `packages/rules-runtime`; `apps/apis/convex`
- **Amended:** [ADR 0022](0022-versioned-domain-documents-and-correctness-projections.md) replaced active normalized authored operational reads and ephemeral-only mechanics assembly with domain-specific versioned projections. [ADR 0029](0029-convex-backend-cutover.md) replaces the SQL persistence representation with Convex documents. PLATFORM-20 (2026-10-16) removed dead and copy-only compilers and records the compile stage as built below.

## Context

The application has a shared dictionary of system-owned terms and authored content that references those terms. Compilers and the character engine need more operational shapes than an authoring form or persistence row. Treating these as one universal DTO makes ownership, editing, and rule evaluation ambiguous.

## Decision

Keep these layers explicit:

1. **Vocabulary** is system-owned dictionary data (for example damage types, skills, languages, currencies, and senses). It is referenced by stable IDs/codes and is not copied into every authored object.
2. **Authored data** is user- or seed-owned content. Background, Class, Creature, Equipment, Feat, Race, Spell, and Vehicle are revisioned roots; their features, options, grants, effects, and outcomes are nested aggregate parts. Characters use their own Builder/Sheet lifecycle.
3. **Compiled data** is the validated/normalized operational form produced from authored content for downstream resolution. It is not an authoring payload and should not be edited directly.
4. **Persistence data** is the current Convex document representation. The former normalized row and join-table representation owned by `packages/db` was an implementation detail of the superseded SQL topology.
5. **Engine data** is ephemeral runtime input/output: `CharacterBuildSnapshot`, `CharacterAssemblyRegistry`, and `EngineCharacterOutput`. It is assembled for deterministic resolution and is not persisted as the authored aggregate.

The lifecycle is:

```text
vocabulary + authored input
          → validate/resolve
          → compile
          → persist or hydrate
          → assemble engine snapshot/registry
          → resolve derived output
```

## Consequences

Vocabulary references remain stable and deduplicated. Authoring APIs can expose human-readable authored DTOs without leaking compiler or engine internals. Engine changes do not force persistence schema changes unless the canonical authored contract changes. A conversion between layers should be named and located at the owning boundary; do not add a universal “record” type to avoid writing the conversion.

## Compile stage as built (current, PLATFORM-20)

Compilers live in `packages/shared/src/domains/**/compilers` and are exported through `@artificer-toolkit/shared/compilers`. Every compiler has a production caller and validates, resolves or reshapes its input; a compiled type that would equal its authored type is not a compiler, and callers use the authored type directly (speed, sense range, scaling source, starting equipment and feature options).

| Compiler                                                                                                     | What it does                                                                                                                                                                           | Consumed by                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Subject compilers: background, class, race (with subrace sources), creature, feat, spell, equipment, vehicle | Drop presentation metadata, compose the grant, feature and effect compilers below                                                                                                      | `compileSubjectWithMechanicsIndex`, which `compilePublicationDocument` (`apps/apis/convex/content`) stores as the `authoredVersionCompilations` projection; `characterRuleSnapshot` compiles background, class, feat, feature and race records again when it builds the Character registry |
| `compileFeature`, `compileFeatureBase`                                                                       | Compile a feature's grants and nested options                                                                                                                                          | Subject compilers; `characterRuleSnapshot`                                                                                                                                                                                                                                                 |
| Grant compilers: proficiency, sense, spell, feat                                                             | Resolve selection kind, `ALL`/`SELECTED` target mode, level scaling and charge use                                                                                                     | Subject and feature compilers; the grant fold builder (`characterGrantFoldSourceFacts`) reads their targets                                                                                                                                                                                |
| `compileModifierGrant`                                                                                       | Rejects a modifier kind its value domain does not support; emits one flat shape with independent `valueDomainCode` and `modifierKind`, the validated `domain` and the kind's `payload` | Subject and feature compilers; `effectActionCompiler` for effect grants; the grant fold builder                                                                                                                                                                                            |
| Effect compilers: effect, damage, condition                                                                  | Resolve authored effects into invocation, targeting, path entries and outcomes                                                                                                         | Spell and equipment compilers; Encounter action discovery and the effect graph behind effect plans and placed zones                                                                                                                                                                        |
| `compileDuration`                                                                                            | Strips authoring node ids from durations                                                                                                                                               | Effect compilers                                                                                                                                                                                                                                                                           |
| `compileCharge`, `compileChargeUse`                                                                          | Strip bonus node ids from charges                                                                                                                                                      | Feat, equipment and grant compilers; Character resource facts                                                                                                                                                                                                                              |

`ModifierGrantAuthored` is the union of `ModifierGrantAuthoredFor<V>` over value domains; each member pairs one supported modifier kind with that kind's payload, derived from `MODIFIER_KINDS_BY_DOMAIN`. Builders that author one domain use `ModifierGrantAuthoredFor<V>` directly.

The grant fold carries a modifier grant as typed fields, not a JSON copy of the grant. A fold modifier operation (`modifierOperationSchema` in `@artificer-toolkit/schema/api/characterGrantFoldRules`) holds `grantId`, `valueDomainCode`, `modifierKind`, `scope`, the domain parameters (`modifierDomainParamsDtoSchema`), the optional kind `payload` (`modifierPayloadDtoSchema`), the normalized restrictions (a `SPELL` context becomes conditions on the cast spell, SPELLS-31.T5i1), and the class-resource ids its restriction selects (`scopeResourceIds`). Accepted modifiers in the fold result carry the same fields, and a contribution names its accepted modifier by index and grant id. Rules-runtime readers narrow `payload` and `domain` by their members; none casts them to a record. Active rule effects freeze these operations in their definitions; `apps/apis/convex/rules/modifierOperationMigration.ts` rewrote stored development rows from the earlier JSON-copy shape.

The Character registry still compiles authored records per assembly; compiling once at publication and hydrating the stored projection is PLATFORM-21 (target, not current).

Current (PLATFORM-21.T1a, D163): the Character registry holds compiled records only (`subject-compiler-v2` shapes, compiled per assembly by `compileCharacterRuleSources` in `rules-runtime/character/contextPreparation.ts`), and Builder and rules reads use those shapes. Prose is not compiled: the context carries a separate `CharacterPresentationLookup` of the authored records by id, which only view surfaces (Builder view, Sheet, panels) read. Commit and other rule paths run without it and persist no prose-derived value. T1b replaces the per-assembly compile with the stored projection. Retained acquired rules (`retainedRulesJson`, ruling C) already hydrate without compiling: each pins a copy of the stored compilation of its version plus a small prose block, and the engine reads the projection as is.
