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

### Campaign

The private aggregate for one table, whether its format is a one-shot or ongoing game. It owns tone and maturity policy as well as membership, collaboration, preparation, sessions, and play state. An owner may copy reusable Campaign preparation into a fresh aggregate without copying cohort or run state.

### Social profile

The authenticated table-formation identity for an account whose user represents that they are at least 13 under the platform Terms. It exposes only a random public ID and current username. Its private record separately retains the default-Standard viewing preference and an optional adult-attestation timestamp created only when Mature viewing is enabled; a submitted birth date is discarded. It is not the private account profile or an authorization grant.

### Social listing

The discoverable or invitation-only projection for forming a free table. It owns public schedule, location, expectations, safety, capacity, publication, and moderation state while deriving title, format, tone, and maturity from its private Campaign.

### Social application

An applicant's bounded request to join one public Social listing. Acceptance is an explicit, capacity-safe admission into Campaign membership; the application ID alone grants no Campaign access.

### Social block

A directional persisted choice enforced symmetrically across Social discovery and admission. It does not silently change an existing Campaign membership or Campaign communication access.

### Notification projection

A Phase 05 per-recipient presentation derived from an authorized application source such as a Social application, invitation, or Campaign announcement. The source aggregate remains authoritative; protected Postgres tables own feed/read/seen state and channel preferences, while a narrow transactional delivery intent tracks bounded Edge delivery. A notification public source ID or deep link never grants access and must be reauthorized when opened.

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

### Active authored root

A relational envelope for ownership, routing, search, constrained cross-root references, and the active immutable document version. Activation validates a complete authored document, allocates its immutable version, compiles its operational projection, advances the active pointer, and removes the draft in one transaction. During the reset cutover, normalized root/child rows remain a transitional authoring-write implementation; operational and finalized-mechanics reads use the immutable version document and compiled projection rather than child-table hydration.

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

A stable authored root ID plus a binding policy. Draft Builder selections resolve the current active immutable version. A finalized Character mechanics projection records the exact complete authored-version vector used by its rule evaluation, including transitive dependencies; activation of newer content cannot change that vector. An explicit preview, reconciliation, and commit operation is required to advance it. Equipment inputs additionally carry an explicit `ContentRef` with system ID and `ACTIVE` binding. A Character rule-revision pin is separate from authored-content binding.

### Character assembly registry

The compiled content registry supplied to the engine for the character's selected race, classes, features, grants, equipment, and related content.

### Rules evaluator

The embedded, versioned Zen runtime that makes production game-system decisions for Character, Encounter, and future VTT mechanics. It consumes TypeScript-normalized facts with stable IDs/provenance and returns typed mechanics, explanations, and source IDs. Native trace output is diagnostic only. Arbitrary Function nodes and all I/O, wall-clock, random, authentication, persistence, or mutation access are forbidden. The bounded, exact repository-owned `character-grant-fold`, `character-action-resolve`, and `encounter-actor-policy` models are the only Function exceptions; their complete graphs and source are server-locked and hidden from Rule Studio. Application-owned dice is supplied as facts.

### Rule revision pin

The exact activated rule-pack revision, checksum, evaluator kind/version, and model-contract version bound to a Character mechanics projection or Encounter under its existing lifecycle policy. A Character draft preview uses the current compatible active revision; a finalized Character changes pins only through an explicit transactional upgrade/reconciliation command that increments its stream version. Retirement does not invalidate a pin. The rule pin and exact authored-version vector together make the committed mechanical input replayable.

### Derived output

Rules-evaluator-produced values such as derived statistics, proficiencies, senses, spell state, spell slots, resources, and item contributions. Derived output is not authored intent and should not be persisted as a second source of truth.

### Encounter event

An Encounter-scoped immutable fact about an encounter, actor, action, target, roll, or outcome. Encounter events are distinct from Character Sheet commands/history. Pinned rule models resolve mechanics, while Encounter services own sequencing, transactional application, and persistence.

## Architectural invariants

- `apps/apis` is the product-data seam for `apps/web`.
- `packages/schema` owns transport contracts; `packages/shared` owns domain contracts and pure logic.
- `packages/functions` owns use-case orchestration; `packages/db` owns persistence adapters.
- SQL defines schema/bootstrap; Kysely owns application writes.
- Repositories expose authored-shaped interfaces and enforce persistence invariants behind their seam.
- Active authored roots retain relational envelopes and replaceable JSON drafts. Immutable authored document versions and compiled projections are the operational source for mechanics and finalized-content reads; normalized child-table hydration is transitional authoring-write support only.
- The eight authored root domains own their nested features, options, grants, effects, and outcomes.
- Node maps define reusable authored-content structure; character Builder and Sheet remain domain-specific modules.
- Master/seeded records are locked from direct UI editing but copyable into owned drafts.
- Builder owns structural character changes; Sheet owns play-state interaction.
