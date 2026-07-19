# Data lifecycle and model boundaries

> Status: canonical (current working-tree baseline)
>
> Scope: vocabulary, authored content, compilation, persistence, and engine input
>
> Update when: a model is renamed, a compiler changes output, or a new persistence/engine boundary is added
>
> Verification: `packages/shared/src/domains/subjects`, `packages/shared/src/domains/features`, `packages/shared/src/domains/grants`, `packages/db/src/repositories`, and `packages/shared/src/domains/engine/snapshot.ts`

The same game concept appears in several representations. Names are intentional; do not collapse them because their fields look similar.

```mermaid
flowchart LR
  V[Vocabulary\nstable codes + labels] --> A[Authored\nuser-owned intent/content]
  A --> C[Compiled\nvalidated/resolved content]
  A --> Rev[Immutable full-payload revision]
  Rev --> P[Active projection\nPostgres rows + child rows]
  C --> R[Registry\nloaded compiled references]
  P --> H[Hydrated authored\nrepository result]
  H --> C
  A --> B[Builder/character intent]
  B --> S[CharacterBuildSnapshot\nephemeral engine input]
  R --> E[Pure engine output]
  S --> E
```

## Definitions

- **Vocabulary** is controlled system data: ability codes, skills, damage types, currencies, senses, categories, statuses, and similar identifiers. SRD seed data lives in `packages/db/src/source-data/srd`; API vocabulary contracts live under `packages/schema/src/vocabulary`.
- **Authored** is the user-facing domain shape. `CharacterAuthored`, `SpellAuthored`, `ClassAuthored`, and feature/grant authored types retain intent, provenance, selection records, and relationships in a form that can be edited and round-tripped.
- **Compiled** is a normalized/validated representation used by resolution. Subject and feature compilers are in `packages/shared/src/domains/**/compilers`; compiled records are suitable for a registry and do not represent the editable draft contract.
- **Authored definition** is the stable identity and ownership record for one of the eight revisioned roots: Background, Class, Creature, Equipment, Feat, Race, Spell, or Vehicle.
- **Authored revision** is an immutable, complete authored payload. A definition points to its active revision and at most one replaceable draft revision.
- **Active projection** is the normalized relational storage shape: a root row plus owned feature, option, grant, effect, and link rows. It is rebuilt by aggregate upsert when a revision activates and is not an independent source of truth.
- **Hydrated authored** is the repository boundary: repositories reconstruct authored-shaped objects from rows and related rows. Callers should not learn table layouts.
- **CharacterBuildSnapshot** is ephemeral. It is assembled from current character state and compiled registry content before each engine run and is never persisted (`packages/shared/src/domains/engine/snapshot.ts`).
- **Engine output** is derived play state (ability modifiers, proficiencies, spell slots, resources, senses, and item contributions). It is recomputed; it is not a second source of authored truth.

## Invariants

- Vocabulary IDs/codes are references; authored data chooses them, and compilers/engine interpret them through the active system.
- Authored data is the source of user intent. Compilation may add normalized values, but a compiler must not silently rewrite the draft.
- Recoverable legacy or editor-only input shapes may be normalized at the shared schema boundary when the canonical authored output remains stable. For example, Creature logistics-note editor rows normalize to canonical `string[]` before compilation and persistence.
- Persisted rows are replaced/rebuilt by repository upserts where the authored aggregate owns the child collection. See [persistence](persistence.md).
- Projection replacement and active-revision promotion share one transaction. A caller must never observe a promoted revision paired with a projection from another revision.
- Features, feature options, grants, effects, outcomes, and details are nested aggregate content. They do not receive independent authored-definition revisions.
- Duplicating an authored aggregate gives the root and every nested owned record a new ID and rewrites internal references; a copy never shares mutable owned identity with its source.
- The engine consumes a snapshot plus a registry and must not query or mutate persistence.
- Provenance on character acquisitions explains why a grant exists and allows reconciliation when an upstream choice changes.

## Character content binding

Current structural character selections store stable authored-definition IDs and resolve them against `ACTIVE` content. Equipment engine inputs additionally use `ContentRef` to carry the definition ID, system ID, and explicit `ACTIVE` binding alongside the compiled item used by that run. Other compiled records are supplied through the assembly registry.

Persisted `REVISION` binding is target work. Supporting campaign or character pinning requires explicit binding fields in character DTOs and persistence plus revision-aware registry loading and snapshot assembly; the current raw selection IDs must not be described as already pinned-capable.
