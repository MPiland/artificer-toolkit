# Artificer Toolkit Context

This file is the canonical domain glossary for the repository. Use these terms consistently in code comments, documentation, tests, and agent instructions. Product-facing language comes from [PRODUCT.md](PRODUCT.md); architecture terms such as module, interface, seam, adapter, depth, leverage, and locality describe how the implementation is shaped.

## Product model

### Library

The signed-in browsing surface for authored domains and drafts.

### Create

The signed-in entry point for starting authored content or a character.

### Authoring Workspace

The canonical content-creation surface: structure rail, editor canvas, optional context/preview rail, and persistent action bar. It is modular content authoring, not generic CRUD.

### Builder

The character-construction workflow. It coordinates selections, provenance, reconciliation, readiness, drafts, previews, and commits against reusable authored content.

### Sheet

The character play surface. It exposes mutable play-state interaction through commands and renders derived output from the character engine.

## Data model

### System

A rules/content universe that owns vocabulary and supplies the rules-system context used by compilation and engine resolution.

### Vocabulary

System-owned reusable dictionary data—skills, senses, languages, damage types, magic schools, and similar values. Authored content references vocabulary by stable ID; vocabulary entries are not authored grants or engine-derived results.

### Authored object

The human-authorable contract for content. It uses meaningful domain shapes, keeps parent ownership explicit, and avoids exposing normalized join-table details. Features, grants, effects, outcomes, subjects, and character intent/state are authored objects or authored aggregates.

The active authored roots are Background, Class, Creature, Equipment, Feat, Race, Spell, and Vehicle. Features, feature options, grants, effects, outcomes, details, and other child records are owned parts of those aggregates, not independent products.

### Authored draft

A complete JSON payload for a new authored root or an edit of an active root. A user may own many new-item drafts, while an active root has at most one edit draft. An edit draft records the active root timestamp on which editing began so activation can reject stale replacements.

### Active authored aggregate

The canonical normalized root, feature, grant, effect, and link rows hydrated by repositories. Activation validates a draft, replaces the aggregate, and removes the draft in one transaction.

### Compiled object

The deterministic engine-oriented transformation of authored content. Compilation may resolve inheritance, normalize authored choices, or prepare grant/effect data, but it does not perform persistence or transport work.

### Persisted object

The normalized database representation. Repositories hydrate persisted rows back into authored-shaped contracts; callers should not need to understand row layout to use a repository interface.

### Master data and source data

Seeded baseline content, such as SRD records, is master data. Repository-owned TypeScript source-data bundles express that content in authored/domain shapes before Kysely persistence. Master records are locked from direct UI editing but may be copied into owned drafts.

### Grant, effect, and outcome

- A grant adds passive or persistent access, proficiency, sense, modifier, feat, or spell information.
- An effect describes an activated, triggered, or adjudicated mechanic, including its delivery paths and resolution structure.
- An outcome describes what an effect result branch actually does.

Prefer typed grants, effects, paths, result branches, and outcomes over prose-only mechanics or ad-hoc subject-root fields.

## Structural authoring

### Node map

A shared structural definition of authored content: steps, sections, nodes, paths, conditions, required state, option sources, relationships, nested groups, and hidden-value behavior. Node maps are the interface between authored domain shape and the generic authoring renderer.

### Authoring Schema runtime resolver

The backend module that turns a shared node-map definition plus runtime scope and database-backed option sources into a transport-safe Authoring Schema result: root steps/sections/nodes, absolute nested scopes, and clear paths. It owns visibility, required state, relationship execution, option lookup, and normalization of values that are no longer valid. Rendering, navigation, and progress consume the same resolved scopes.

### Resolver

Use the specific resolver name when possible:

- node-runtime resolver: structural form state and options;
- authored inheritance resolver: parent/child authored content composition;
- character Builder resolver: eligible choices, provenance, reconciliation, readiness;
- choice resolver: chosen-grant or selection-specific resolution;
- repository hydrator: normalized rows back to authored shape;
- engine resolver: compiled grants and rules into derived character output.

Do not use “resolver” as an unqualified name for unrelated behavior.

### Orchestrator

An application module that composes validation, repository reads, compilation, persistence, reconciliation, or engine execution for a use case. Orchestration belongs in `packages/functions`; transport modules delegate to it.

### Compiler

A shared, deterministic module that transforms authored contracts into compiled contracts. Compilers are transport-agnostic and persistence-agnostic.

## Character model

### Character intent

Structural and progression decisions: identity, race, classes, background, abilities, starting-equipment choices, feature selections, spell selections, and provenance. Character progression truth belongs here.

### Character state

Mutable play state: hit points, conditions, resource usage, prepared/known spell state, runtime inventory ownership/placement/equipped/attuned state, and similar sheet interaction state. It must not duplicate progression truth from intent.

### Character build snapshot

The engine-facing snapshot assembled from authored character intent/state and compiled content. It is an explicit input to the pure engine.

### Content reference

A stable authored root ID plus a binding policy. Current structural character selections store stable root IDs and resolve them against `ACTIVE` content. Equipment engine inputs additionally carry an explicit `ContentRef` with system ID and `ACTIVE` binding. Historical revision pinning is unsupported because authored revision history is not retained.

### Character assembly registry

The compiled content registry supplied to the engine for the character's selected race, classes, features, grants, equipment, and related content.

### Rules system

The D&D-5e-family policy contract supplied to the pure character engine. The current engine is deterministic and side-effect-free and injects 5e policy such as arithmetic, stacking, and grant ordering. Future non-5e games should use system-specific engine contracts behind the ruleset registry seam rather than being forced through this D&D-shaped kernel.

### Derived output

Engine-produced values such as derived statistics, proficiencies, senses, spell state, spell slots, resources, and item contributions. Derived output is not authored intent and should not be persisted as a second source of truth.

### Encounter event

A future VTT-scoped immutable fact about an encounter, actor, action, target, roll, or outcome. Encounter events are distinct from character Sheet commands/history. The pure character engine may help resolve actor state, but it does not own encounter sequencing or persistence.

## Architectural invariants

- `apps/apis` is the product-data seam for `apps/web`.
- `packages/schema` owns transport contracts; `packages/shared` owns domain contracts and pure logic.
- `packages/functions` owns use-case orchestration; `packages/db` owns persistence adapters.
- SQL defines schema/bootstrap; Kysely owns application writes.
- Repositories expose authored-shaped interfaces and enforce persistence invariants behind their seam.
- Normalized domain aggregates are canonical active authored content; JSON drafts are replaceable staging records.
- The eight authored root domains own their nested features, options, grants, effects, and outcomes.
- Node maps define reusable authored-content structure; character Builder and Sheet remain domain-specific modules.
- Master/seeded records are locked from direct UI editing but copyable into owned drafts.
- Builder owns structural character changes; Sheet owns play-state interaction.
