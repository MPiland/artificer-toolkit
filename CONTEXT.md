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

### Live table

The Campaign's live play room: the Session Durable Object in `apps/session-worker` plus
`apps/apis/convex/liveSessions`. The technical name "live session" is retained. Transitional: the
current implementation opens one room per OPEN Campaign Session;
[ADR 0033](docs/adr/0033-campaign-owned-play-and-session-log.md) (implemented locally) makes it one room
per Campaign that any ACTIVE member may open.

### Session

A Campaign Session record for scheduling, RSVP, attendance, notes, references and recap. Under
[ADR 0033](docs/adr/0033-campaign-owned-play-and-session-log.md) it becomes an optional log that no
longer gates live play, Scene presentation or Encounter Runs, which become Campaign-owned.

### Social profile

The authenticated table-formation identity for an account whose user represents that they are at least 13 under the platform Terms. It exposes only a random public ID and current username. Its private record separately retains the default-Standard viewing preference and an optional adult-attestation timestamp created only when Mature viewing is enabled; a submitted birth date is discarded. It is not the private account profile or an authorization grant.

### Social listing

The discoverable or invitation-only projection for forming a free table. It owns public schedule, location, expectations, safety, capacity, publication, and moderation state while deriving title, format, tone, and maturity from its private Campaign.

### Social application

An applicant's bounded request to join one public Social listing. Acceptance is an explicit, capacity-safe admission into Campaign membership; the application ID alone grants no Campaign access.

### Social block

A directional persisted choice enforced symmetrically across Social discovery and admission. It does not silently change an existing Campaign membership or Campaign communication access.

### Notification projection

A Phase 05 per-recipient presentation derived from an authorized application source such as a Social application, invitation, or Campaign announcement. The source aggregate remains authoritative; Convex feed items own read/seen state, the account profile owns channel preferences, and a narrow transactional delivery intent tracks bounded Resend email delivery. A notification public source ID or deep link never grants access and must be reauthorized when opened.

## Data model

### Game System

A mechanically compatible product family, such as D&D 5e or Fate. A reviewed platform-owned Game
System capability contract declares its supported authored domains, reusable definition families,
authoring recipes, rule modules, state shapes, Campaign settings, and VTT capabilities. Users cannot
create or install Game Systems or arbitrary rules plugins.

The capability publishes `contentKinds`, the authored content kinds (Spell, Race, Creature and so
on) the System offers, read through `content.systems.capability`. The app shell navigation is
System-aware and capability-driven: its Content group is the union of `contentKinds` across the
Systems the user can see, in a fixed presentation order (`apps/web/src/shell/navigation.ts`, keyed
exhaustively by kind), with an explicit empty state when no System publishes any. No System is
selected by default and no navigation entry is hardcoded to a System.

### Rules Catalogue

A core rules lineage inside one Game System, such as D&D 2014 or D&D 2024. Catalogue identity is
metadata and policy selection within the owning Game System; it never selects a different shared
engine. Compatible catalogues may coexist in one Campaign, which has one current primary catalogue.

### Content Source

The publication or creator collection from which authored content originates, such as an SRD, a
rulebook, or a homebrew collection. A Content Source is provenance, not automatically a Rules
Catalogue or runtime dispatch key.

### Reusable definition

A UUID-backed, Game-System-bound concept that can be independently authored, referenced, shared,
overridden, or lifecycle-managed, such as a sense, skill, condition, or damage type. Labels and codes
are display/search metadata and never dispatch mechanics. Inline configured values such as `60 feet`,
`3d6`, or a cone size remain typed data inside their owning item rather than separate records.

Reusable definitions are the System's vocabulary. Their contract lives in `packages/schema`, and the SRD
entries have one home, the seed content in `packages/source-data`. Runtime code reads them from the
System record and never holds a list of them. When System behaviour needs a specific entry, such as
the D&D prone condition, the System capability in `rules-runtime/systems/<id>` names its definition
ID ([ADR 0039](docs/adr/0039-composable-system-neutral-rules-engine.md#amendment-2026-10-22-vocabulary-and-core-codes)).

### Core code

A fixed code with no ID that engine behaviour branches on, such as a roll mode, an action economy
slot, an event kind or an outcome kind. A campaign could not add one without new code. Neutral core
codes live in `packages/schema` enum schemas or `packages/shared` core; System-specific core codes
live in `rules-runtime/systems/<id>` behind the capability registry. A core code that later becomes
authorable is promoted to a reusable definition by giving it an ID.

### Authored object

The human-authorable contract for content. It uses meaningful domain shapes, keeps parent ownership explicit, and avoids exposing normalized join-table details. Features, grants, effects, outcomes, subjects, and character intent/state are authored objects or authored aggregates.

The authored root families available in a product surface come from the selected Game System
capability contract. Background, Class, Creature, Equipment, Feat, Race, Spell, and Vehicle are D&D
domain adapters, not universal rules-kernel concepts. Features, options, grants, effects, outcomes,
details, and other non-independent records remain owned parts of their aggregate.

### Authored draft

A complete working payload for a new authored root or an edit of a published root. A source has at
most one autosaved edit draft. Runtime never reads the draft; explicit Publish is the live-change
boundary.

### Active authored root

A relational envelope for UUID identity, Game System, ownership, routing, search, constrained
references, one working draft, and one current published document. Publish validates the complete
typed rule graph and atomically replaces current behavior; it does not create user-visible historical
versions or consumer upgrade workflows. Future uses read the current document. Already issued
decisions, rolls, active effects, and receipts retain their frozen occurrence data.

### Validated rule definition

The current published authored document after bounded graph, port, primitive-contract, UUID-reference,
same-System, and dependency validation. Validation proves that the runtime can evaluate the graph; it
does not bind an actor, target, Scene, choice, roll, or result and does not create a persistent prepared
execution plan.

### Persisted object

The validated native document representation. Convex domain functions hydrate persisted documents into
authored or play contracts; callers do not depend on table layout or storage internals.

### Master data and source data

Seeded baseline content, such as SRD records, is master data. Version-controlled bundles in
`packages/source-data` express that content in authored/domain shapes before native Convex seed and
audit. Master records are locked from direct UI editing but may be copied into owned drafts.

### Grant, effect, and outcome

- A grant adds passive or persistent access, proficiency, sense, modifier, feat, or spell information.
- An effect describes an activated, triggered, or adjudicated mechanic, including its delivery paths and resolution structure.
- An outcome describes what an effect result branch actually does.

Prefer typed grants, effects, paths, result branches, and outcomes over prose-only mechanics or ad-hoc subject-root fields.

## Structural authoring

### Node map

A shared structural definition of authored content: steps, sections, nodes, paths, conditions, required state, option sources, relationships, nested groups, and hidden-value behavior. Node maps are the interface between authored domain shape and the generic authoring renderer.

### Authoring Schema runtime resolver

The backend module that turns a shared node-map definition plus runtime scope and authorized native
option sources into a transport-safe Authoring Schema result: root steps/sections/nodes, absolute nested
scopes, and clear paths. It owns visibility, required state, relationship execution, option lookup, and
normalization of values that are no longer valid. Rendering, navigation, and progress consume the same
resolved scopes.

### Resolver

Use the specific resolver name when possible:

- node-runtime resolver: structural form state and options;
- authored inheritance resolver: parent/child authored content composition;
- character Builder resolver: eligible choices, provenance, reconciliation, readiness;
- choice resolver: chosen-grant or selection-specific resolution;
- persistence hydrator: native documents back to authored or play shape;
- engine resolver: compiled grants and rules into derived character output.

Do not use “resolver” as an unqualified name for unrelated behavior.

### Orchestrator

An application module that composes validation, native reads, compilation, persistence, reconciliation,
or engine execution for a use case. Orchestration belongs in the owning `apps/apis/convex` domain
function; public functions remain thin validated entry points.

### Rule-definition validator

A shared deterministic module that validates an authored modular graph at Publish. It resolves and
checks reference compatibility and graph structure, but runtime capability discovery and execution
bind all live facts.

### Rules Kernel

The Game-System-agnostic runtime protocol for walking validated modular graphs, requesting bounded
facts or random evidence, pausing for decisions, and proposing state changes plus serializable
continuation/receipt data. The owning application transaction persists those proposals. The Kernel
does not access repositories and does not own D&D concepts such as attacks, spell slots,
concentration, or reactions.

### Mechanics operation

A reusable typed operation, such as comparison, opposed testing, dice-pool result bands, contributor
aggregation, spatial contact, or bounded state mutation. Primitive keys and contract versions are
code-owned. Game System modules compose operations into named mechanics.

### Capability discovery

The runtime process that determines which validated entry points an actor currently has from its
sources, grants, equipment, effects, overrides, Campaign policy, and Scene context. A derived UI
projection may list current options, but every command revalidates discovery and authority.

### Execution instance

One runtime invocation created only after an actor uses a capability and supplies the required current
context. It binds actors, targets, Scene facts, selections, state, Campaign policy, and roll evidence,
then walks the rule graph until completion or a bounded pause.

### Frozen occurrence

An issued decision, roll request, active effect, continuation, or completed receipt that retains the
exact facts and rule identity required for deterministic resume or audit. Frozen occurrences are not
historical versions of authored content.

## Character model

### Character intent

Structural and progression decisions: identity, race, classes, background, abilities, starting-equipment choices, feature selections, spell selections, and provenance. Character progression truth belongs here.

### Character state

Mutable play state: hit points, conditions, resource usage, prepared/known spell state, runtime inventory ownership/placement/equipped/attuned state, and similar sheet interaction state. It must not duplicate progression truth from intent.

### Character build snapshot

The engine-facing snapshot assembled from authored character intent/state and compiled content. It is an explicit input to the pure engine.

### Content reference

A stable UUID-backed definition or authored-root ID bound to one Game System. Runtime capability
discovery resolves the current published document. A published source update affects future uses and
derived/passive facts immediately after typed reconciliation; frozen occurrences remain unchanged.

### Character assembly registry

The compiled content registry supplied to the engine for the character's selected race, classes, features, grants, equipment, and related content.

### Rules runtime

The server runtime that performs capability discovery and executes validated rule graphs using the
shared Rules Kernel, mechanics operations, and the selected platform-owned Game System module. It is
native TypeScript in `packages/rules-runtime`; the retired GoRules/Zen evaluator is not a runtime
dependency. I/O, authorization, persistence, mutation, clocks, and random generation remain application
owned. Arbitrary authored code is forbidden.

### Derived output

Rules-evaluator-produced values such as derived statistics, proficiencies, senses, spell state, spell slots, resources, and item contributions. Derived output is not authored intent and should not be persisted as a second source of truth.

### Encounter event

An Encounter-scoped immutable fact about an Encounter Run, actor, action, target, roll, decision, or
outcome. Encounter events are distinct from Character Sheet history. Rules runtime resolves mechanics;
Encounter services own sequencing, authorization, transactional application, persistence, replay, and
privacy.

## Architectural invariants

- `apps/apis/convex` is the product-data, authentication, persistence and orchestration seam for
  `apps/web`.
- `packages/schema` owns transport contracts; `packages/shared` owns domain contracts and pure logic.
- `packages/authoring` owns pure Authoring Schema resolution and publication validation.
- `packages/rules-runtime` owns installed System policies and Kernel execution.
- Convex domain functions enforce authorization, indexed reads, atomic writes, replay and cleanup.
- Active authored roots retain one stable UUID, one working draft and one current published typed
  document. Runtime does not expose authored version selection or upgrade workflows.
- The selected Game System capability contract declares its root-domain adapters and reusable
  definition families. D&D's eight current roots are not universal engine concepts.
- Node maps define reusable authored-content structure; character Builder and Sheet remain domain-specific modules.
- Master/seeded records are locked from direct UI editing but copyable into owned drafts.
- Builder owns structural character changes; Sheet owns play-state interaction.
- Overrides, source edits, and new reusable content are distinct authoring operations that share the
  same typed mechanics contracts.
- Runtime capability discovery and execution bind actors, targets, Scene facts, choices, state, and
  rolls; Publish validates structure but never precomputes an Encounter execution plan.
- Architecture decisions belong to the primary architect. Implementers escalate only changes to
  product behavior, public/persisted contracts, security, concurrency, load-bearing ownership, or
  frozen acceptance—not ordinary implementation details.
