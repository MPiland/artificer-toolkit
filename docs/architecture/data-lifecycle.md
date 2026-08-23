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
  A --> D[JSON draft\nnew item or active edit]
  D --> P[Canonical active aggregate\nPostgres rows + child rows]
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
- **Authored draft** is a complete JSON payload for a new root or an edit of an active Background, Class, Creature, Equipment, Feat, Race, Spell, or Vehicle. An active root has at most one edit draft.
- **Active aggregate** is the canonical normalized relational shape: a root row plus owned feature, option, grant, effect, and link rows. It is replaced transactionally by aggregate upsert when a draft activates.
- **Hydrated authored** is the repository boundary: repositories reconstruct authored-shaped objects from rows and related rows. Callers should not learn table layouts.
- **CharacterBuildSnapshot** is ephemeral. It is assembled from current character state and compiled registry content before each engine run and is never persisted (`packages/shared/src/domains/engine/snapshot.ts`).
- **Engine output** is derived play state (ability modifiers, proficiencies, spell slots, resources, senses, and item contributions). It is recomputed; it is not a second source of authored truth.

## Invariants

- Vocabulary IDs/codes are references; authored data chooses them, and compilers/engine interpret them through the active system.
- Authored data is the source of user intent. Compilation may add normalized values, but a compiler must not silently rewrite the draft.
- Recoverable legacy or editor-only input shapes may be normalized at the shared schema boundary when the canonical authored output remains stable. For example, Creature logistics-note editor rows normalize to canonical `string[]` before compilation and persistence.
- Persisted rows are replaced/rebuilt by repository upserts where the authored aggregate owns the child collection. See [persistence](persistence.md).
- Active aggregate replacement and draft deletion share one transaction. An edit draft's base active timestamp must still match before replacement.
- Features, feature options, grants, effects, outcomes, and details are nested aggregate content. They do not receive independent draft lifecycles.
- Duplicating an authored aggregate gives the root and every nested owned record a new ID and rewrites internal references; a copy never shares mutable owned identity with its source.
- The engine consumes a snapshot plus a registry and must not query or mutate persistence.
- Provenance on character acquisitions explains why a grant exists and allows reconciliation when an upstream choice changes.

## Character content pins and Campaign authority

Structural Character selections keep stable authored root IDs. Draft previews and newly added sources resolve current `ACTIVE` owner, Master, or direct Campaign-shared roots. First finalization stores the exact immutable authored-version vector; finalized reads and source-preserving commands validate those exact versions without requiring the roots' active pointers to remain unchanged.

`campaign_content_shares` grants Campaign-scoped authority to a root, not to a version snapshot. While the share remains valid, a finalized Character may keep using its pinned historical version. Authored activation changes the root's current version for drafts and future admission but does not rewrite finalized Characters.

Unshare, sharing-member removal, and authored deletion discover only actual dependents and reconcile inside the owning transaction. Reconciliation removes unavailable roots, preserves unrelated exact pins, republishes valid `ACTIVE` Characters, and uses the existing `DRAFT` repair path with live-projection deletion for structural or required transitive source loss.
