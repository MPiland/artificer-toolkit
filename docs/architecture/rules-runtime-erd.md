# Rules runtime domain ERDs

> **Status:** canonical target; implementation rebaseline in progress
>
> **Scope:** identity and ownership relationships for Systems, authored mechanics, Campaigns, Characters, Encounter Blueprints, Runs, and frozen occurrences
>
> **Update when:** ownership, foreign keys, aggregate boundaries, or occurrence persistence changes
>
> **Verification:** canonical SQL, migrations, repository contracts, and Gate 1/2 database tests

These diagrams show domain ownership, not literal table/column names. Canonical SQL remains the schema
authority.

## System and authored content

```mermaid
erDiagram
  GAME_SYSTEM ||--o{ RULES_CATALOGUE : owns
  GAME_SYSTEM ||--o{ CONTENT_SOURCE : permits
  GAME_SYSTEM ||--o{ REUSABLE_DEFINITION : constrains
  GAME_SYSTEM ||--o{ AUTHORED_ROOT : constrains
  CONTENT_SOURCE ||--o{ AUTHORED_ROOT : originates
  RULES_CATALOGUE }o--o{ AUTHORED_ROOT : includes
  AUTHORED_ROOT ||--o| WORKING_DRAFT : edits
  AUTHORED_ROOT ||--|| CURRENT_DOCUMENT : publishes
  CURRENT_DOCUMENT }o--o{ REUSABLE_DEFINITION : references
```

## Campaign, Character, and reusable preparation

```mermaid
erDiagram
  GAME_SYSTEM ||--o{ CAMPAIGN : binds
  RULES_CATALOGUE ||--o{ CAMPAIGN : primary_for
  CAMPAIGN ||--o{ CAMPAIGN_CATALOGUE : enables
  RULES_CATALOGUE ||--o{ CAMPAIGN_CATALOGUE : selected
  GAME_SYSTEM ||--o{ CHARACTER : binds
  RULES_CATALOGUE ||--o{ CHARACTER : baseline_for
  CAMPAIGN ||--o{ CHARACTER_ASSIGNMENT : admits
  CHARACTER ||--o{ CHARACTER_ASSIGNMENT : assigned
  GAME_SYSTEM ||--o{ ENCOUNTER_BLUEPRINT : constrains
  CAMPAIGN ||--o{ ENCOUNTER_RUN : owns
  ENCOUNTER_BLUEPRINT ||--o{ ENCOUNTER_RUN : instantiates
  ENCOUNTER_RUN ||--o{ ENCOUNTER_ACTOR : contains
  CHARACTER ||--o{ ENCOUNTER_ACTOR : may_back
```

## Aggregate-owned occurrences

```mermaid
erDiagram
  CHARACTER ||--o{ CHARACTER_RULE_OCCURRENCE : owns
  ENCOUNTER_RUN ||--o{ ENCOUNTER_EVENT : records
  ENCOUNTER_RUN ||--o{ SCENE_EVENT : changes
  ENCOUNTER_RUN ||--o{ ENCOUNTER_RULE_OCCURRENCE : owns
  CHARACTER_RULE_OCCURRENCE ||--o| FROZEN_EXECUTION_SNAPSHOT : may_pause_or_recur
  ENCOUNTER_RULE_OCCURRENCE ||--o| FROZEN_EXECUTION_SNAPSHOT : may_pause_or_recur
  CHARACTER_RULE_OCCURRENCE ||--o| RULE_RECEIPT : may_commit
  ENCOUNTER_RULE_OCCURRENCE ||--o| RULE_RECEIPT : may_commit
  ENCOUNTER_RULE_OCCURRENCE ||--o| ACTIVE_EFFECT : may_maintain
  ENCOUNTER_ACTOR ||--o{ AGGREGATE_STATE : owns
  ACTIVE_EFFECT ||--o{ AGGREGATE_STATE : may_modify
  FROZEN_EXECUTION_SNAPSHOT ||--o{ RANDOM_EVIDENCE : awaits
  FROZEN_EXECUTION_SNAPSHOT ||--o{ DECISION_EVIDENCE : awaits
```

`CHARACTER_RULE_OCCURRENCE` and `ENCOUNTER_RULE_OCCURRENCE` are logical aggregate-owned contracts,
not a mandate for one polymorphic universal table. A persistence implementation may use separate
tables/events that enforce each aggregate's authorization, lock order, retention, and privacy.
Previews and simulations remain ephemeral. A frozen execution snapshot exists only while an
occurrence can pause or recur and is removed or terminally closed with that occurrence.

Scene events own genuine Scene state changes. Encounter events and receipts own mechanical evidence.
Transport journals coordinate delivery only and are never gameplay authority.
