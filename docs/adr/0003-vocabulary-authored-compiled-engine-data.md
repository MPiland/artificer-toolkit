# ADR 0003: Distinct data layers from vocabulary to engine input

- **Status:** decision
- **Date:** 2026-07-10
- **Scope:** domain data lifecycle and cross-package model boundaries
- **Update when:** a model is reused across vocabulary, authored, compiled, persistence, or engine layers
- **Verification:** `packages/schema/src/vocabulary`; `packages/shared/src/domains/**/authored`; `packages/shared/src/domains/**/compilers`; `packages/shared/src/domains/engine`; `packages/db/src/repositories/contracts.ts`

## Context

The application has a shared dictionary of system-owned terms and authored content that references those terms. Compilers and the character engine need more operational shapes than an authoring form or persistence row. Treating these as one universal DTO makes ownership, editing, and rule evaluation ambiguous.

## Decision

Keep these layers explicit:

1. **Vocabulary** is system-owned dictionary data (for example damage types, skills, languages, currencies, and senses). It is referenced by stable IDs/codes and is not copied into every authored object.
2. **Authored data** is user- or seed-owned content. Background, Class, Creature, Equipment, Feat, Race, Spell, and Vehicle are revisioned roots; their features, options, grants, effects, and outcomes are nested aggregate parts. Characters use their own Builder/Sheet lifecycle.
3. **Compiled data** is the validated/normalized operational form produced from authored content for downstream resolution. It is not an authoring payload and should not be edited directly.
4. **Persistence data** is the normalized row and join-table representation owned by `packages/db`. It is an implementation detail behind authored-shaped repositories.
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
