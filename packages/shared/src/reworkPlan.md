# Artificer Toolkit — Engine-First Architecture Plan

This document defines the **canonical build plan** for the Artificer Toolkit.
It is engine-first, domain-driven, and authoring-last.

All prior terminology and data models are deprecated unless explicitly reintroduced here.

---

## Guiding Principles (Non-Negotiable)

- The application is a **value-resolution engine over time**
- System data defines **vocabulary only**
- Behavior lives exclusively in **engine domains**
- Rules respond to events; they never initiate behavior
- Authoring is a projection/compilation layer, not the source of truth

If a concept violates any of these, it is incorrect by definition.

---

## Core Concepts (Locked Vocabulary)

These concepts are global and must not be overloaded.

- **Value Domain**  
  A named value space the engine can read and write  
  (e.g. attack_roll, damage, armor_class, speed)

- **Moment**  
  A label on time (on_hit, start_of_turn, on_cast)  
  Moments do nothing by themselves.

- **Event**  
  A runtime occurrence emitted by engine processes  
  Every Event occurs at a Moment.

- **Applicability**  
  A selector + gates defining which subjects a rule applies to  
  (source-bound, owner-bound, filtered, global; equipped, attuned, once-per-turn)

- **Rule**  
  A declarative responder to Events

- **Effect**  
  A value transformation (add, replace, multiply, set, etc.)

---

## Build Order Overview

You **must** build in this order. Skipping steps causes cascading redesign.

1. Lock vocabulary & principles
2. Define flat system data
3. Define engine timeline (Moments & Events)
4. Define Value Domains
5. Define Applicability model
6. Define Rule engine
7. Build authoring on top
8. Build persistence & DB
9. Build verification harness
10. Migrate content

---

# PHASE 0 — Architecture Lock-In

### 0.1 Confirm Mental Model

- [x] Old terms (scope, context, surface, modifier) are deprecated
- [x] Engine operates on values over time
- [x] Events are runtime facts
- [x] Moments are labels, not logic
- [x] Rules are reactive, never imperative

---

# PHASE 1 — System Data (Flat Vocabulary Only)

System data is **identity only**.
No behavior. No applicability. No timing.

### 1.1 Define SystemOption Base Shape

- [x] id (UUID, storage identity)
- [x] code (semantic identity)
- [x] label (primary display)
- [x] short (optional, canonical abbreviations only)
- [x] description (optional, prose only)
- [x] tooltip (optional, short clarification)

### 1.2 Enforce System Data Rules

- [x] No references to other system entries
- [x] No “applies to”, “only when”, or “requires”
- [x] No mechanical meaning encoded
- [x] Enums mirror `code` values only (never authoritative)

### 1.3 Flat Vocabularies to Define

- [x] Damage Types
- [x] Conditions
- [x] Abilities
- [x] Skills
- [x] Sizes
- [x] Moments
- [x] Effect Operations
- [x] Duration Units
- [x] Action Tags (if needed)
- [x] Range Units
- [x] Shapes
- [x] Speed Types
- [x] Languages
- [x] Terrains
- [x] Rarities
- [x] Senses
- [x] Magic Schools

---

# PHASE 2 — Engine Timeline

### 2.1 Define Moment Vocabulary

Moments are global, flat, reusable.

Examples:

- on_cast
- on_attack
- on_hit
- on_crit
- on_save_fail
- start_of_turn
- end_of_turn
- on_equip
- passive

Checklist:

- [x] Moment enum defined
- [x] No logic attached to Moments
- [x] Used only as labels on Events

### 2.2 Define Event Base Contract

All behavior is expressed through Events.

Checklist:

- [x] Base Event interface
- [x] Every Event has a Moment
- [x] Events carry payload data
- [x] Events are emitted by engine processes only

---

# PHASE 3 — Value Domains

Value Domains define **what rules modify**.
Events define _when_ rules apply.
Effects define _how_ values change.

A Value Domain is NOT:

- an event
- system vocabulary
- character state storage

A Value Domain IS:

- a named, addressable surface
- owned by a subject
- readable and writable by rules
- resolved deterministically during a moment window

---

## 3.1 Define the Value Domain Concept

Checklist:

- [x] Value domains are uniquely named
- [x] Domains are addressable by effects
- [x] Domains are owned by a subject (usually the event subject)
- [x] Domains are resolved deterministically
- [x] Domains are separate from event emission and state persistence

---

## 3.2 Core Value Domains

These domains are required to express standard D&D-style mechanics.

### Combat & Resolution

- [x] attack_roll_bonus (number)
- [x] armor_class (number)
- [x] save_dc (number, parameterized by ability)
- [x] saving_throw_bonus (number, parameterized by ability)

### Damage & Survivability

- [x] damage (structured)
- [x] hit_points_current (number)
- [x] hit_points_max (number)

### Movement

- [x] speed (number, parameterized by movement type)
- [x] movement_remaining (number)

### Action Economy

- [x] can_take_action (boolean)
- [x] can_take_bonus_action (boolean)
- [x] can_take_reaction (boolean)

---

## 3.3 Domain Parameterization

Some domains require parameters rather than separate domain entries.

Examples:

- speed → { mode: WALK | FLY | SWIM | CLIMB }
- save_dc → { ability: STR | DEX | CON | INT | WIS | CHA }
- saving_throw_bonus → { ability: STR | DEX | CON | INT | WIS | CHA }

Checklist:

- [x] Domain keys support parameters
- [x] Parameters are typed
- [x] Domain enum does not explode combinatorially

---

## 3.4 Damage as a Structured Value Domain

Damage is NOT a scalar.
Damage application is an event.
Damage itself is a structured domain resolved by rules.

Rules:

- Damage is composed of components
- Components have semantic roles, not ranks
- Replacement logic is explicit and deterministic
- Repeated damage = repeated DamageAppliedEvents
- No primary / secondary / tertiary damage classification

Example roles:

- BASE
- BONUS
- REPLACEMENT

Checklist:

- [x] DamageDomain exists as a structured value
- [x] Damage components have explicit roles
- [x] Replacement logic is unambiguous
- [x] Damage application remains event-driven

---

## 3.5 Out of Scope for Phase 3

Explicitly excluded:

- targeting logic
- map geometry or line of sight
- attack roll computation
- saving throw rolling
- resource consumption
- feature activation logic

These belong to later phases.

---

# PHASE 4 — Applicability Model (AMENDED)

Applicability answers: **which rules are eligible to execute for a given Event**.

Applicability is a **selection language**, not behavior.

Applicability determines _whether a rule exists_ for an Event.
It never determines _what the rule does_.

---

## 4.1 Applicability Contract

Applicability is a first-class engine primitive.

Rules:

- Applicability is evaluated **per Event**
- Applicability determines **rule inclusion only**
- Applicability never mutates Value Domains
- Applicability is resolved **before** rule execution
- Excluded rules are invisible to the Rule Engine

### Checklist

- [x] Applicability is evaluated per Event
- [x] Applicability determines rule inclusion only
- [x] Applicability does not mutate any Value Domain
- [x] Applicability resolution happens before rule execution
- [x] Excluded rules are not passed to the Rule Engine

---

## 4.2 Subject Resolution Model

Applicability always resolves against a **candidate subject set**.

The engine must explicitly distinguish the following:

- **Event subject** (primary affected entity)
- **Event target(s)** (secondary affected entities, if any)
- **Source entity** (weapon, spell, feature that emitted the Event)
- **Owner entity** (entity that owns the source)

Applicability may **narrow** subject sets.
Applicability may never **expand** subject sets.

### Checklist

- [x] Event subject is explicitly defined
- [x] Event target(s) are explicitly defined
- [x] Source entity is explicitly defined
- [x] Owner entity is explicitly defined
- [x] Applicability always resolves against a known subject set
- [x] Applicability can narrow subject sets
- [x] Applicability cannot expand subject sets

---

## 4.3 Applicability Patterns (AMENDED)

Applicability patterns define **which subject role a rule is scoped to**.

Patterns answer the question:

> “Which entity role does this rule attach to for this Event?”

Patterns do **not** answer:

- whether the rule executes
- whether conditions are met
- how values are changed
- when rules run

Those concerns belong to later phases.

---

## 4.3.1 Pattern Responsibilities

Applicability patterns are responsible for:

- Selecting **one or more subject roles**
- Declaring the **attachment scope** of a rule
- Operating only on **resolved subject roles** from Phase 4.2

Applicability patterns are **not** responsible for:

- Inspecting game state (equipment, conditions, flags)
- Evaluating boolean conditions
- Filtering by attributes, tags, or properties
- Mutating EventContext or Value Domains

---

## 4.3.2 Canonical Subject Roles

Applicability patterns may reference only the following subject roles:

- **Subject**  
  The primary affected entity

- **Source**  
  The entity that caused the Event

- **Owner**  
  The entity that owns the source

- **Targets** _(optional)_  
  Secondary affected entities, if present

- **Global**  
  All valid subjects for the EventContext

Patterns may not invent new roles.

---

## 4.3.3 Supported Applicability Patterns

The engine supports the following applicability patterns.

### Subject-bound

- The rule applies only when evaluating the **event subject**
- Typical use: effects that modify the affected entity

Examples (conceptual):

- “You gain resistance when you are hit”
- “The creature damaged takes ongoing damage”

---

### Source-bound

- The rule applies only when evaluating the **source entity**
- Typical use: weapon-, spell-, or feature-attached rules

Examples (conceptual):

- “This weapon grants a bonus to damage”
- “This spell modifies its own effects”

---

### Owner-bound

- The rule applies to the **owner of the source**
- Independent of which source emitted the Event

Examples (conceptual):

- “While you wear this item, you gain +1 AC”
- “You gain a bonus when any of your spells hit”

---

### Target-bound (Optional)

- The rule applies to **secondary affected entities**
- Only meaningful when `targets` are present in EventContext

Rules:

- Target-bound applicability must not assume targets exist
- Absence of targets results in exclusion, not error

Examples (conceptual):

- “Each creature in the area takes damage”
- “Affected targets gain a condition”

---

### Global

- The rule applies to **all valid subjects**
- Global applicability must be explicit and rare

Rules:

- Global applicability cannot be implicit
- Global rules must be auditable and traceable

Examples (conceptual):

- Global environmental effects
- System-wide passive modifiers

---

## 4.3.4 Pattern Semantics

The following semantics apply to all applicability patterns:

- Patterns select **which subject role(s)** a rule attaches to
- Patterns do not evaluate conditions
- Patterns do not filter by state or properties
- Patterns do not gate execution
- Patterns do not mutate EventContext
- Patterns do not expand subject sets

Patterns only declare **scope**, nothing else.

---

## 4.3.5 Composition Rules

Applicability patterns must be composable.

Rules:

- Multiple applicability patterns combine with logical **AND**
- Composition may narrow applicability
- Composition may never broaden applicability
- Order of pattern evaluation must not affect outcome

---

## 4.3.6 Completion Checklist

Phase 4.3 is complete only when all of the following are true:

- [x] Subject-bound applicability is implemented
- [x] Source-bound applicability is implemented
- [x] Owner-bound applicability is implemented
- [x] Target-bound applicability is implemented (or explicitly deferred)
- [x] Global applicability requires explicit opt-in
- [x] Patterns operate only on resolved subject roles
- [x] Patterns do not inspect game state
- [x] Patterns do not gate execution
- [x] Patterns do not mutate EventContext
- [x] Applicability pattern composition is deterministic

---

## 4.4 Gates & Conditions (AMENDED)

Gates are **boolean predicates** evaluated after Applicability selection and before rule execution.

Gates determine **whether an eligible rule is allowed to execute** for a given EventContext.

---

## 4.4.1 Gate Responsibilities

Gates are responsible for:

- Blocking rule execution when conditions are not met
- Inspecting engine-visible state
- Enforcing temporal and state-based constraints

Gates are not responsible for:

- Selecting subject scope
- Mutating Value Domains
- Ordering rule execution
- Producing side effects
- Emitting Events

---

## 4.4.2 Gate Semantics

The following semantics apply to all gates:

- Gates evaluate to **true** or **false**
- Gates are evaluated **after Applicability**
- Gates are evaluated **before rule execution**
- A rule with any failing gate does not execute
- Gates do not alter rule selection results

---

## 4.4.3 Allowed Gate Inputs

Gates may inspect:

- EventContext (subject, source, owner, targets)
- Engine-maintained state (equipment, attunement, flags)
- Temporal counters (per-turn, per-rest, per-day)
- Concentration or sustain flags

Gates may not inspect:

- Value Domain values
- Effects of other rules
- Execution order
- Random outcomes

---

## 4.4.4 Canonical Gate Categories

The engine supports the following gate categories.

### Equipment Gates

- equipped
- attuned

### Temporal Gates

- once per turn
- once per round
- once per rest

### State Gates

- concentration required
- concentration absent
- specific engine-defined flags

### Custom Engine Gates

- Explicitly defined by the engine
- Must be deterministic and testable

---

## 4.4.5 Gate Composition Rules

- Multiple gates combine with logical **AND**
- Evaluation order must not affect outcome
- Gates may only block execution, never enable otherwise invalid rules
- Gate evaluation must be deterministic

---

## 4.4.6 Completion Checklist

Phase 4.4 is complete only when all of the following are true:

- [x] Gates are boolean predicates
- [x] Gates block rule execution when false
- [x] Gates do not alter subject selection
- [x] Gates do not mutate Value Domains
- [x] Gates evaluate after Applicability
- [x] Gates evaluate before rule execution
- [x] Equipment-based gates are supported
- [x] Temporal gates (e.g. once per turn) are supported
- [x] State-based gates are supported
- [x] Gate composition is deterministic

---

## 4.5 Applicability Composition & Determinism

Applicability must be composable and deterministic.

Rules:

- Multiple applicability clauses combine with logical AND
- Filters only narrow candidate sets
- Gate evaluation never changes selection results
- Applicability resolution is order-independent

### Checklist

- [x] Applicability clauses combine with AND semantics
- [x] Applicability resolution is order-independent
- [x] Applicability resolution is deterministic
- [x] Applicability results are inspectable for debugging

---

## 4.6 Rule Selection Pipeline

Canonical rule selection pipeline for a single Event:

1. Event is emitted at a Moment
2. Rules matching Moment + Value Domain are selected
3. Applicability is evaluated
4. Gates are evaluated
5. Executable rules are passed to the Rule Engine

### Checklist

- [x] Rule selection pipeline is explicitly defined
- [x] Moment + Domain filtering occurs before Applicability
- [x] Applicability filtering occurs before Gate evaluation
- [x] Only executable rules reach the Rule Engine

---

# PHASE 5 — Rule Engine (AMENDED)

The Rule Engine orders and executes **eligible rules** to deterministically
transform Value Domains during Event resolution.

Rules are reactive responders.
Rules never initiate behavior.
Rules never emit Events.

---

## 5.1 Rule Contract (HARDENED)

A Rule is a declarative unit evaluated against a single Event.

A Rule consists of:

- **when** → Moment
- **domain** → Value Domain (including parameters)
- **appliesTo** → Applicability (Phase 4)
- **gates** → optional Gates (Phase 4)
- **effect** → Effect
- **priority** → optional deterministic ordering hint
- **debugLabel** → optional human-readable identifier (trace/debug only)

### Rule Contract Rules

- A Rule targets exactly **one Value Domain**
- A Rule is bound to exactly **one Moment**
- A Rule does not select subjects
- A Rule does not gate itself outside of Gates
- A Rule never emits Events
- A Rule never mutates state outside its Effect

### Checklist

- [x] Rule contract fields are fully defined
- [x] Rules reference exactly one Value Domain
- [x] Rules are bound to exactly one Moment
- [x] Rules include Applicability
- [x] Rules never initiate Events
- [x] Rules never select subjects
- [x] Rules never mutate state outside Effects

---

## 5.2 Rule Execution Window

The Rule Engine operates within a **single Event resolution window**.

Rules are evaluated only against:

- the current Event
- the current EventContext
- the current Value Domain state at window start

Rules do not observe:

- effects of later rules
- future Events
- execution order beyond defined guarantees

### Checklist

- [x] Rule execution is scoped to a single Event
- [x] Rule evaluation does not depend on future Events
- [x] Rule evaluation does not depend on authoring order

---

## 5.3 Deterministic Ordering

The Rule Engine must produce a **stable execution order** for executable rules.

### Ordering Rules

- Rule ordering is explicit
- Rule ordering is deterministic
- Rule ordering is independent of insertion order
- Rule ordering is independent of storage order

If a priority system is used:

- Priority semantics must be explicit
- Priority comparison must be total (no ambiguity)
- Ties must be resolved deterministically

### Checklist

- [x] Rule execution order is deterministic
- [x] Ordering rules are explicit
- [x] Tie-breaking rules are defined
- [x] Same inputs always produce the same execution order

---

## 5.4 Conflict Resolution Semantics

Conflicts occur when multiple rules affect the same Value Domain.

The Rule Engine must define **explicit conflict resolution semantics**.

### Conflict Resolution Rules

- Conflicts are resolved deterministically
- Conflict resolution does not depend on rule discovery order
- Replacement semantics are explicit
- Bonus and additive semantics are explicit
- Multiplicative semantics are explicit

The engine must never:

- implicitly merge conflicting effects
- silently discard effects
- rely on execution order for correctness

### Checklist

- [x] Conflict resolution semantics are explicitly defined
- [x] Replacement behavior is deterministic
- [x] Additive behavior is deterministic
- [x] Multiplicative behavior is deterministic
- [x] Conflicts do not depend on execution order

---

## 5.5 Effects (EXECUTION SEMANTICS)

Effects describe **how a Value Domain is transformed**.

Effects are applied only by the Rule Engine.

### Effect Rules

- Effects only transform Value Domains
- Effects do not select subjects
- Effects do not gate execution
- Effects do not emit Events
- Effects do not mutate engine state outside Value Domains

### Supported Effect Operations

- ADD
- REPLACE
- MULTIPLY
- SET
- Engine-approved extensions only

Effect semantics must be:

- explicit
- deterministic
- testable

### Checklist

- [x] Effect operations are explicitly defined
- [x] Effects only transform Value Domains
- [x] Effects do not affect Applicability
- [x] Effect semantics are deterministic
- [x] Effect behavior is independent of authoring order

---

# PHASE 6 — Authoring Layer (AMENDED)

Authoring is a **compiler**, not a modeling layer.

Authoring produces Rules.
Authoring never invents engine behavior.

---

## 6.1 Authoring Constraints

Rules:

- Authoring cannot create Moments
- Authoring cannot create Value Domains
- Authoring cannot bypass Applicability
- Authoring defaults infer Applicability only

### Checklist

- [x] Authoring emits Rules only
- [x] Authoring does not invent engine primitives
- [x] Authoring defaults compile into explicit Applicability
- [x] Authoring never targets Events directly

---

## 6.2 Compilation

Authoring blocks compile deterministically into Rules.

### Checklist

- [x] Compilation is deterministic
- [x] Same input produces same Rules
- [x] Compilation output is inspectable
- [x] Compilation does not depend on runtime state

---

# PHASE 7 — Rule Ownership & Attachment (NEW)

This phase defines **how Rules are associated with game content**
and how multiple sources contribute behavior to a subject.

This phase completes the **engine-side model** before persistence,
authoring redesign, or migration begins.

---

## 7.1 Rule Ownership Model

Every Rule must have a **single, explicit owner**.

An owner represents the source of authored intent,
not the subject affected at runtime.

Examples of Rule owners:

- Class
- Subclass
- Race
- Background
- Feat
- Feature
- Equipment
- Spell

### Rules

- Every Rule has exactly one owner
- Rule ownership is static and persistent
- Ownership does not affect execution semantics
- Ownership does not affect Applicability
- Ownership is not runtime state

Ownership exists for:

- persistence
- inspection
- migration
- authoring traceability

### Checklist

- [x] Every Rule has a single owner
- [x] Ownership is explicit and inspectable
- [x] Ownership does not alter engine execution
- [x] Ownership is stable across runs
- [x] Features are owners only when mechanically meaningful
- [x] Structural and choice constructs are excluded from ownership

---

## 7.2 Rule Contribution Model

Subjects (e.g. Characters, Creatures) do not contain behavior.
They **aggregate Rules** from owned sources.

At runtime, a subject’s effective rule set is the union of:

- rules from all owned sources
- rules from equipped sources
- rules from granted or learned sources

### Rules

- Subjects never define Rules directly
- Subjects aggregate Rules from multiple owners
- Rule aggregation does not change Rule identity
- Duplicate Rules are resolved by identity, not position

### Checklist

- [x] Subjects aggregate Rules, not logic
- [x] Multiple owners may contribute Rules
- [x] Aggregation does not mutate Rules
- [x] Rule identity is preserved during aggregation
- [x] Equipment rules are always contributed
- [x] Execution is controlled by Applicability and Gates

---

## 7.3 Rule Lifetime & Activation

Rule existence is persistent.
Rule **activation** is controlled exclusively by Applicability and Gates.

### Rules

- Rules always exist once owned
- Rules are never created or destroyed at runtime
- Applicability determines inclusion per Event
- Gates determine execution per Event
- No runtime system enables or disables Rules directly

### Checklist

- [x] Rules always exist once authored
- [x] Rules are never created at runtime
- [x] Rules are never destroyed at runtime
- [x] Rules are never toggled on or off
- [x] Rule execution is Event-scoped
- [x] Temporal behavior is modeled via Moments and Gates
- [x] Runtime rule mutation is forbidden

---

## 7.4 Separation of Ownership and Applicability

Ownership answers **where a Rule comes from**.
Applicability answers **when and to whom it applies**.

These concepts must never be conflated.

# PHASE 7.5 — Progression Compiler

The Progression Compiler determines **what a character owns**
based on class, level, choices, and prerequisites.

It is **not** part of the runtime Rule Engine.

---

## Purpose

The Progression Compiler answers:

- “What features/options are available now?”
- “What choices must the player make?”
- “What rules does the character own after those choices?”

It does **not** answer:

- “What happens when an attack hits?”
- “How damage is calculated”
- “Which rules execute for an Event”

---

## 7.5.1 Responsibilities

The Progression Compiler is responsible for:

- Resolving **level-based grants**
- Resolving **choice buckets** (e.g. Eldritch InvocationAuthoreds)
- Enforcing **progression prerequisites**
- Producing a stable set of **owned Sources**
- Producing a stable set of **owned Rule IDs**

The Progression Compiler is **not** responsible for:

- Emitting Events
- Executing Rules
- Evaluating Applicability
- Evaluating Gates
- Mutating Value Domains

---

## 7.5.2 Inputs

The compiler operates on **authoring-defined progression data** and
**character state**, including:

- Class / Subclass
- Character level
- Previously chosen options
- Replacement allowances
- Progression prerequisites
- Authoring-defined choice structures

Inputs are **static facts**, not runtime state.

---

## 7.5.3 Outputs

The compiler produces:

- A set of **Owned Sources**
  - Classes
  - Subclasses
  - Feats
  - Chosen options (e.g. individual invocations)

- A set of **Owned Rules**
  - Referenced by stable Rule IDs
  - Derived from owned Sources
  - Immutable until progression changes

The output is **pure data**, suitable for persistence.

---

## 7.5.4 Choice Buckets (Authoring-Level Only)

Authoring may define **choice buckets**, such as:

- “Choose 2 Eldritch InvocationAuthoreds at level 2”
- “Choose 1 Fighting Style”
- “Choose 3 skill proficiencies”

Rules:

- Choice buckets are **authoring constructs**
- Choice buckets do **not** exist in the engine
- Choice buckets never own Rules
- Only the **chosen option** becomes an owned Source

Choice structure exists **only to guide progression and UI**.

---

## 7.5.5 Prerequisite Types (Hard Rule)

Prerequisites are split into **two non-overlapping categories**.

### Progression Prerequisites

Evaluated by the Progression Compiler:

- Class level requirements
- Feature known requirements
- Spell known requirements
- Ability score minimums (static)
- System-defined unlock conditions

These **never** become runtime Gates.

---

### Runtime Gates

Evaluated by the Rule Engine:

- Equipped / attuned
- Once per turn
- Concentration
- Temporary state
- Engine-maintained flags

These **never** block option selection.

---

## 7.5.6 Determinism Rules

The Progression Compiler must be deterministic.

Rules:

- Same inputs produce the same outputs
- Ordering of authoring data must not matter
- Choices are resolved explicitly, never implicitly
- Replacement rules are explicit and traceable

---

## 7.5.7 Separation from Runtime Engine

The Progression Compiler:

- Does not emit Events
- Does not reference Moments
- Does not reference Value Domains
- Does not execute Rules

The Runtime Rule Engine:

- Does not resolve progression
- Does not grant or revoke ownership
- Does not inspect authoring structures

These systems are **strictly layered**.

---

## 7.5.8 Completion Checklist

Phase 7.5 is complete only when:

- [ ] Progression and runtime concerns are fully separated
- [ ] Choice buckets exist only at authoring/progression level
- [ ] Owned Sources are explicitly resolved
- [ ] Owned Rules are explicitly resolved
- [ ] Prerequisites are correctly split (progression vs runtime)
- [ ] Outputs are suitable for persistence
- [ ] Runtime engine consumes only owned Rules

---

### Canonical Rule

**Progression determines what you have.  
The engine determines what happens.**

### Rules

- Ownership does not imply Applicability
- Applicability does not imply Ownership
- Changing ownership does not change execution behavior
- Changing Applicability does not change persistence

### Checklist

- [x] Ownership does not imply Applicability
- [x] Applicability does not imply Ownership
- [x] Ownership never encodes targeting
- [x] Applicability never encodes persistence
- [x] Engine treats Ownership and Applicability as orthogonal concepts

---

# PHASE 8 — Persistence & Database (RENAMED, SHIFTED)

Persistence stores **engine definitions**, not runtime behavior.

---

## 8.1 Persistence Scope

Persisted:

- Rules
- Rule ownership references
- Applicability definitions
- Gate definitions
- Effects

Not persisted:

- Events
- EventContext
- Resolved values
- Execution traces
- Runtime domain state

### Checklist

- [ ] Only engine definitions are persisted
- [ ] No runtime state is stored
- [ ] Schema aligns with engine contracts
- [ ] Persistence does not encode behavior implicitly

---

# PHASE 9 — Verification Harness (RENAMED, SHIFTED)

Verification proves correctness and determinism
of the Rule Engine and its contracts.

---

## 9.1 Canonical Test Coverage

### Checklist

- [ ] Single-rule resolution tests
- [ ] Multi-rule conflict tests
- [ ] Applicability inclusion/exclusion tests
- [ ] Gate enforcement tests
- [ ] Replacement vs bonus interaction tests
- [ ] Temporal (once-per-turn) tests

---

## 9.2 Determinism & Traceability

### Checklist

- [ ] Same inputs always produce same outputs
- [ ] Rule execution order is traceable
- [ ] Inclusion/exclusion reasoning is inspectable
- [ ] Failures are explainable

---

# PHASE 10 — Content Migration (RENAMED, SHIFTED)

Legacy data is **compiled** into Rules
that conform to the engine contracts.

Migration preserves meaning, not structure.

---

## 10.1 Migration Principles

- Legacy structure is not preserved
- Legacy behavior is preserved via Rules
- Migration is incremental and testable
- Adapters are temporary and removable

### Checklist

- [ ] Legacy data compiles into Rules
- [ ] Migration output passes verification harness
- [ ] Adapters are isolated and removable
- [ ] Legacy paths are deleted when complete
