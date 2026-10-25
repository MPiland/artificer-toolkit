# Rules runtime domain ERDs

> **Status:** canonical current Convex domain model; managed promotion remains in Phase 8.2
>
> **Scope:** identity and ownership relationships for Systems, authored mechanics, Campaigns, Characters, Encounter Blueprints, Runs, frozen occurrences, and cleanup state
>
> **Update when:** ownership, indexed relationships, aggregate boundaries, occurrence persistence, or cleanup state changes
>
> **Verification:** `apps/apis/convex/schema.ts`, domain schemas/functions under `apps/apis/convex`, shared validators under `packages/schema`, and focused Convex tests

These diagrams show validated Convex document relationships rather than literal field lists. Convex
schemas and shared validators define stored shapes; application transactions enforce referential
integrity, authorization, cleanup order, atomicity, and replay.

## Identity, Campaign ownership, and membership

```mermaid
erDiagram
  BETTER_AUTH_USER ||--|| USER_PROFILE : maps_by_authUserId
  USER_PROFILE ||--o{ CAMPAIGN : owns_by_ownerUserId
  USER_PROFILE ||--o{ CAMPAIGN_MEMBERSHIP : joins_by_userId
  CAMPAIGN ||--o{ CAMPAIGN_MEMBERSHIP : contains_by_campaignId
  CAMPAIGN ||--o{ CHARACTER_ASSIGNMENT : admits
  USER_PROFILE ||--o{ CHARACTER_ASSIGNMENT : controls
```

The authenticated Better Auth user resolves through `userProfiles.by_authUserId` to the public app
`userId`. Campaign functions derive authority from `campaigns.ownerUserId` and the exact indexed
`campaignMemberships` document. Public input never supplies the acting identity, and a downstream
document reference never grants authority by itself.

## System and authored content

```mermaid
erDiagram
  GAME_SYSTEM ||--o{ RULES_CATALOGUE : owns
  GAME_SYSTEM ||--o{ CONTENT_SOURCE : permits
  GAME_SYSTEM ||--o{ REUSABLE_DEFINITION : constrains
  GAME_SYSTEM ||--o{ AUTHORED_ROOT : constrains
  GAME_SYSTEM ||--o{ SENSE_CATALOGUE_ENTRY : owns
  GAME_SYSTEM ||--o{ ABILITY_DEFINITION : owns
  GAME_SYSTEM ||--o{ SAVING_THROW : owns
  CONTENT_SOURCE ||--o{ AUTHORED_ROOT : originates
  RULES_CATALOGUE }o--o{ CONTENT_SOURCE : includes
  CONTENT_SOURCE ||--o{ REUSABLE_DEFINITION : supplies
  REUSABLE_DEFINITION ||--o| SENSE_CATALOGUE_ENTRY : same_uuid_supplies_behavior
  AUTHORED_ROOT ||--o| WORKING_DRAFT : edits
  AUTHORED_ROOT ||--|| CURRENT_DOCUMENT : publishes
  REUSABLE_DEFINITION ||--o| REUSABLE_DEFINITION_DRAFT : edits
  REUSABLE_DEFINITION ||--o| CURRENT_DOCUMENT : publishes
  AUTHORED_ROOT ||--o{ AUTHORED_EFFECT : contains
  AUTHORED_EFFECT ||--o| SAVING_THROW : invokes
  ABILITY_DEFINITION ||--o{ SAVING_THROW : selects
  SAVING_THROW ||--o{ SAVE_DC_BONUS : has
  ABILITY_DEFINITION ||--o{ SAVE_DC_BONUS : contributes
```

The model is System-neutral. A `GAME_SYSTEM` row is imported data; what the System can do is the
rule capability its installed code declares (`systems/installedGameSystems/` in `packages/rules-runtime`,
read through `content/systems:capability`): its content kinds, authored root kinds, reusable-definition
families, facts and operations. Every relationship above keys by `gameSystemId`, and each write checks that
capability: the shell offers only declared content kinds, `content/definitions:create` refuses an undeclared
family, and publication compiles a graph against the System's own fact and operation contracts. Nothing in
the model names D&D 5e. Senses, abilities and saving throws are System lists that may be empty, and
D&D-only families such as `dnd5e-encounter-lifecycle` exist only because the dnd5e capability declares
them. A test-only second System, never seeded or built, proves this through the real Convex reads and
publication (D195; `apps/apis/convex/content/systemPortability.tracer.test.ts`).

For a typed reusable vocabulary family such as `sense`, the catalogue entry and reusable-definition
root share the exact `(id, gameSystemId)` identity. The catalogue entry is selectable metadata; the
published family document is mechanics. Grants keep their existing UUID reference, and no code/label
lookup selects behavior.

Ability definitions use the same stable System-owned UUID rule. Authored saving throws and
ability-modifier DC bonuses reference those UUIDs; parent-bound hydration validates the complete chain
against the authoritative authored root System. UUID ownership is immutable across Systems.

## Campaign, Character, and reusable preparation

```mermaid
erDiagram
  GAME_SYSTEM ||--o{ CAMPAIGN : binds
  RULES_CATALOGUE ||--o{ CAMPAIGN : primary_for
  CAMPAIGN ||--o{ CAMPAIGN_CATALOGUE : enables
  RULES_CATALOGUE ||--o{ CAMPAIGN_CATALOGUE : selected
  GAME_SYSTEM ||--o{ CHARACTER : binds
  CAMPAIGN ||--o{ CHARACTER_ASSIGNMENT : admits
  CHARACTER ||--o{ CHARACTER_ASSIGNMENT : assigned
  GAME_SYSTEM ||--o{ ENCOUNTER_BLUEPRINT : constrains
  CAMPAIGN ||--o{ ENCOUNTER_RUN : owns
  CAMPAIGN ||--|| CAMPAIGN_PLAY_SETTINGS : configures
  REUSABLE_DEFINITION ||--o{ CAMPAIGN_PLAY_SETTINGS : initiative_override
  REUSABLE_DEFINITION ||--o{ CAMPAIGN_PLAY_SETTINGS : optional_combat_selection
  REUSABLE_DEFINITION ||--o{ ENCOUNTER_RUN : initiative_snapshot_source
  REUSABLE_DEFINITION ||--o{ ENCOUNTER_RUN : optional_combat_snapshot_source
  ENCOUNTER_BLUEPRINT ||--o{ ENCOUNTER_RUN : instantiates
  ENCOUNTER_RUN ||--o{ ENCOUNTER_SIDE : owns
  ENCOUNTER_RUN ||--o{ SIDE_RELATIONSHIP : owns
  ENCOUNTER_SIDE ||--o{ SIDE_RELATIONSHIP : first_side
  ENCOUNTER_SIDE ||--o{ SIDE_RELATIONSHIP : second_side
  ENCOUNTER_SIDE ||--o{ ENCOUNTER_ACTOR : groups
  ENCOUNTER_RUN ||--o{ ENCOUNTER_ACTOR : contains
  CHARACTER ||--o{ ENCOUNTER_ACTOR : may_back
  ENCOUNTER_RUN ||--o{ INITIATIVE_ROUND : owns
  INITIATIVE_ROUND ||--o{ INITIATIVE_PARTICIPANT : snapshots
  INITIATIVE_ROUND ||--o{ INITIATIVE_SIDE : snapshots
  ENCOUNTER_ACTOR ||--o{ INITIATIVE_PARTICIPANT : participates
  ENCOUNTER_SIDE ||--o{ INITIATIVE_PARTICIPANT : groups
  ENCOUNTER_SIDE ||--o{ INITIATIVE_SIDE : participates
  ENCOUNTER_RULE_OCCURRENCE ||--o{ INITIATIVE_PARTICIPANT : supplies_evidence
  ENCOUNTER_RULE_OCCURRENCE ||--o{ INITIATIVE_SIDE : supplies_evidence
```

Encounter-side UUIDs are aggregate content, not Rules Kernel primitives. A relationship document stores one
canonical unordered pair and one closed factual code (`ALLIED`, `NEUTRAL`, or `HOSTILE`); same-side
actors are implicitly allied. Targeting, reactions, and side-based initiative read the same locked
relationship. Game System policy interprets it, while actor kind and side labels remain non-mechanical.

Campaign initiative fields are nullable UUID selections into same-System reusable definitions. They are
current settings for future runs, not historical Campaign revisions. An Encounter copies the selected
initiative policy and exact evaluation/order-choice/tie graph documents into one checksum-protected
server snapshot. The policy names the numeric evaluation and tie score outputs, Boolean
automatic-availability outputs, ascending/descending order, the numeric bounded order-choice output,
the exact numeric minimum/maximum choice-index fact bindings, and a finite tie-attempt policy;
application services do not infer those ports or
invent an actor-ID tiebreak. The snapshot therefore retains the complete execution authority while
later System or Campaign publication cannot repin that run. Recipient projections expose only the
compact policy summary, never executable graph documents. The policy and every referenced graph retain
their Content Source identity; those sources must be present in the Campaign's enabled catalogues, and
current settings plus prepared/active Encounter snapshots block removal of a required catalogue.

Each initiative round is aggregate-owned current state, not a workflow or event log. Its header pins
the Encounter's initiative-policy checksum and owns the current procedure, cadence, lifecycle status,
version, and monotonic next-turn ordinal. Participant documents snapshot exact actor/side membership and
retain only current score, final turn ordinal, lifecycle status, and checksum-bound occurrence pointers.
An actor-side correction updates only the Encounter actor for future-round construction; it never
rewrites a non-completed round's participant side snapshot, side order, or pending side-order choice.
Side documents provide the equivalent normalized state for side-roll procedures. Exact rule receipts remain
the evidence and replay authority; round documents never embed executable graphs, continuations, or mutable
decision history. A new round either evaluates according to `EACH_ROUND` cadence or carries forward the
already-settled order under `ENCOUNTER_START`; it never rereads terminal receipt JSON as current state.

One Encounter-owned occurrence coordinates a pending initiative lifecycle. It may retain the exact
current evaluation, bounded tie/order-choice suffix, or subsequent turn-effect continuation, but never
duplicates normalized round state. `START_OF_TURN` is not selected until the normalized order is final;
at an `EACH_ROUND` wrap, the outgoing `END_OF_TURN` settles before the next round's initiative work.
Evaluated outgoing effects, proposed initiative state, incoming Feature-owned Recharge recovery, and
incoming effects remain occurrence-owned staged plans until one terminal transaction applies them in
that order. A pause leaves the Encounter, initiative documents, active effects, and Feature charges
unchanged. Advancing pauses retain separate command receipts with a public pending summary only; the
sealed execution and staged plans remain in the occurrence snapshot.

## Aggregate-owned occurrences

```mermaid
erDiagram
  CHARACTER ||--o{ CHARACTER_RULE_OCCURRENCE : owns
  CHARACTER_RULE_OCCURRENCE ||--o{ CHARACTER_RULE_RECEIPT : records
  ENCOUNTER_RUN ||--o{ ENCOUNTER_EVENT : records
  ENCOUNTER_RUN ||--o{ SCENE_EVENT : changes
  ENCOUNTER_RUN ||--o{ ENCOUNTER_RULE_OCCURRENCE : owns
  ENCOUNTER_RULE_OCCURRENCE ||--o{ ENCOUNTER_RULE_RECEIPT : records
  CHARACTER_RULE_OCCURRENCE ||--o| FROZEN_EXECUTION_SNAPSHOT : may_pause_or_recur
  ENCOUNTER_RULE_OCCURRENCE ||--o| FROZEN_EXECUTION_SNAPSHOT : may_pause_or_recur
  CHARACTER ||--o{ CHARACTER_ACTIVE_RULE_EFFECT : owns
  ENCOUNTER_RUN ||--o{ CHARACTER_ACTIVE_RULE_EFFECT : cleanup_source_reference
  ENCOUNTER_ACTOR ||--o{ ENCOUNTER_ACTIVE_RULE_EFFECT : owns
  ENCOUNTER_RUN ||--o{ ENCOUNTER_SPATIAL_RULE_EFFECT : owns
  ENCOUNTER_SCENE ||--o{ ENCOUNTER_SPATIAL_RULE_EFFECT : contains
  ENCOUNTER_RUN ||--o{ ENCOUNTER_MAINTAINED_EFFECT_STATE : owns
  ENCOUNTER_ACTOR ||--o{ ENCOUNTER_MAINTAINED_EFFECT_STATE : maintains
  ENCOUNTER_MAINTAINED_EFFECT_STATE ||--o{ CHARACTER_ACTIVE_RULE_EFFECT : depends_on
  ENCOUNTER_MAINTAINED_EFFECT_STATE ||--o{ ENCOUNTER_ACTIVE_RULE_EFFECT : depends_on
  ACTIVE_RULE_EFFECT ||--o| IMMUTABLE_EFFECT_DEFINITION : retains
  ACTIVE_RULE_EFFECT ||--o| MUTABLE_EFFECT_LIFECYCLE : retains
  ENCOUNTER_ACTOR ||--o{ AGGREGATE_STATE : owns
  ACTIVE_EFFECT ||--o{ AGGREGATE_STATE : may_modify
  FROZEN_EXECUTION_SNAPSHOT ||--o{ RANDOM_EVIDENCE : awaits
  FROZEN_EXECUTION_SNAPSHOT ||--o{ DECISION_EVIDENCE : awaits
```

`CHARACTER_RULE_OCCURRENCE` and `ENCOUNTER_RULE_OCCURRENCE` are logical aggregate-owned contracts,
not a mandate for one polymorphic universal collection. Their separate receipt documents retain start/resume
receipts and enforce each aggregate's authorization, lock order, retention, and privacy.
Each advancing or re-pausing resume owns a command-specific receipt with its closed actor-filtered
occurrence result. Later advancement or completion cannot rewrite it, so lost-response retries resolve
by aggregate plus command identity before Scene access, Kernel execution, randomness, or settlement.
Movement receipts retain the exact sorted before/after version transitions committed by their own root
or resume command. Earlier receipts never derive changed roots from a later terminal occurrence result;
the latter remains complete audit evidence only. Live coordinator snapshots collapse those transitions
to each aggregate's current final version after atomic application.
Character outcome events emitted by movement reaction and spatial mechanics use phase- and
ordinal-scoped deterministic child command UUIDs. Their source command and occurrence remain audit
correlation; separate movement phases and resumes never share the Character event uniqueness key.
An Encounter has at most one pending occurrence, enforced by the Encounter command transaction
before fresh source or Kernel work. Matching
receipt replay precedes that gate. A terminal occurrence may be receipt-only when its pure applicator
intent declines an aggregate version advance; application and terminal receipt still commit together
at the unchanged aggregate version.
Previews and simulations remain ephemeral. A frozen execution snapshot exists only while an
occurrence can pause or recur and is removed or terminally closed with that occurrence.

Scene events own genuine Scene state changes. Encounter events own genuine Encounter state/projection
changes; rule receipts own mechanical evidence and replay state.
Transport journals coordinate delivery only and are never gameplay authority.

```mermaid
erDiagram
  CAMPAIGN ||--o{ CAMPAIGN_SCENE_DEFINITION : authors
  CAMPAIGN ||--o{ CAMPAIGN_LIVE_SCENE : owns
  CAMPAIGN_SCENE_DEFINITION o|--o{ CAMPAIGN_LIVE_SCENE : materializes
  CAMPAIGN_SESSION ||--o| SESSION_SCENE_PRESENTATION : selects
  CAMPAIGN_LIVE_SCENE ||--o{ SESSION_SCENE_PRESENTATION : is_presented
  CAMPAIGN_LIVE_SCENE ||--o{ CAMPAIGN_SCENE_EVENT : records
  ENCOUNTER ||--o| ENCOUNTER_SCENE_BINDING : optionally_uses
  CAMPAIGN_LIVE_SCENE ||--o{ ENCOUNTER_SCENE_BINDING : supplies_facts
  ENCOUNTER_SCENE_BINDING ||--o{ ENCOUNTER_ACTOR_TOKEN_BINDING : maps
  ENCOUNTER_ACTOR ||--o| ENCOUNTER_ACTOR_TOKEN_BINDING : controls
  ENCOUNTER_SCENE_BINDING ||--o{ ENCOUNTER_SPATIAL_RULE_EFFECT : scopes
```

The Campaign live Scene is the physical aggregate. A Session presentation and an Encounter binding
both reference it without copying its projection. Scene-token UUIDs remain stable; temporary
Encounter actor identity exists only in `ENCOUNTER_ACTOR_TOKEN_BINDING`. Scene definitions are
versioned authoring sources and may be deleted without deleting a materialized live Scene, whose
source snapshot remains audit provenance.

`CHARACTER_ACTIVE_RULE_EFFECT` and `ENCOUNTER_ACTIVE_RULE_EFFECT` are separate current-state document families;
they do not reference an occurrence from another aggregate. Each persists separate immutable
`definition`/`definitionChecksum` and mutable `lifecycle`/`lifecycleChecksum` fields. The definition
contains one `SINGLE_GRAPH` graph/source/provenance/recurrence plan plus the UUID-backed result-block
identity and its local frozen-graph node binding, recorded as a one-to-one frozen graph source-entry
binding. The originating action selects that result block before creation; the effect document never retains an
action-level `TEST_OUTCOME` specialization plan. Lifecycle carries only remaining ticks. Character effect documents may retain a `sourceEncounterId` only for an Encounter-lifetime
definition. Its Encounter-first index locates distinct Character owners after actor removal. Cleanup
then validates and removes each affected effect through the owning Character or Encounter transaction;
document references never create an implicit cascade. Future tick and terminal transitions remain owned by their Character or Encounter root receipt
and use owner-scoped lifecycle-only CAS.
`ENCOUNTER_SPATIAL_RULE_EFFECT` is the third current-state surface for an untargeted spatial root.
It belongs to the locked Encounter and references its exact Campaign Scene binding, never to an actor
and never to an occurrence. It retains the same frozen active-effect definition/lifecycle contract plus separately
checksummed placement and mutable reveal state. Contact evaluation binds an actor only in the
Encounter occurrence that resolves the contact; no target actor is stored on the spatial root.
Scene-scoped ordinal allocation and current-state CAS are both exact `(encounter, bound scene)` operations.

Frozen active-effect evaluation is a pure application-service boundary: it reads the immutable
definition and mutable lifecycle, returns applications plus an `UPDATE` or `EXPIRE` proposal, and
does not directly own a stored write, projection, event, or receipt.
The immutable definition may also carry bounded typed perception contributions. They remain part of
the existing checksummed definition document rather than a new document family. A locked Encounter
application derives observer, subject, and local-area relation arrays from exact actor ownership and
spatial geometry, retaining effect identity/version/checksum; the relation itself is runtime-only.

## Durable cleanup continuation

```mermaid
flowchart TD
  Command["Authorized deletion, departure, or source loss"] --> Scope["Capture exact authority and affected scope"]
  Scope --> Atomic{"Complete work fits one mutation?"}
  Atomic -->|yes| Apply["Validate and commit all relationship changes"]
  Atomic -->|oversized cargo| Job["campaignVehicleCleanupJobs + totals + segments"]
  Job --> Lock["Mark only affected Vehicle, container, group, or destination documents"]
  Lock --> Page["Scheduled bounded page"]
  Page --> Check["Recheck job grant, markers, versions, checksums, and custody"]
  Check -->|more| Page
  Check -->|complete| Release["Publish complete custody and release markers"]
  Check -->|retryable failure| Retry["Owner retry reuses the same durable job"]
  Retry --> Check
```

Ordinary cleanup remains one atomic Convex mutation. Oversized inventory cleanup exposes an updating
state only for the affected slice; unrelated inventory stays readable and editable. Job grants and document
markers are trusted server state, so continuation can outlive the initiating source without acquiring
new authority. A retry resumes the same idempotent plan. Shared Campaign history survives account
deletion with deleted-user presentation, while private account state and active actor participation are
removed through validated application cleanup.

**Current native implementation:** `ENCOUNTER_MAINTAINED_EFFECT_STATE` is an Encounter-owned,
server-only current-state document with a UUID-backed System maintenance-definition identity and
immutable descriptor checksum. It is not a Rules Kernel primitive and it has no public projection.
A maintained document may own dependent Character or Encounter-actor active effects. Cleanup discovers
those dependents, validates their owner and checksums, applies owner-root CAS deletion first, and removes
the maintained state in the same application transaction. The direct-action replacement path records
only typed state/effect identity transitions in its terminal receipt.
