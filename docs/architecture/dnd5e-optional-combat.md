# D&D 2014 optional combat

Status: canonical target guide
Scope: the D&D 2014 miniature and combat options represented by the Phase 8 VTT packet.
Update when: an optional-combat definition, System policy, Campaign setting, Encounter snapshot,
or Gate 2–5 acceptance contract changes.
Verification: compare the definitions and source links with
`packages/schema/src/shared/optionalCombat.ts`, the D&D source adapter, and the fixed Phase 8
acceptance ledger. Source research and focused tests are evidence, not acceptance by themselves.

## Boundary

Campaign settings select UUID-backed System definitions. Encounter admission snapshots the
selected definitions and their checksums; an audited GM override is allowed only when no mechanical
decision is pending. The shared runtime supplies facts, stages, bounded choices, rolls, effects,
receipts, replay, and redaction. The D&D adapter supplies the policy. Labels, editions, and feature
names do not dispatch mechanics.

```mermaid
flowchart LR
    C[Campaign optional-combat settings] --> E[Encounter snapshot and checksum]
    E --> F[Locked actor, Scene, and action facts]
    F --> D[D&D System policy definitions]
    D --> K[Shared rules runtime]
    K --> R[Aggregate-owned receipts and projections]
```

All options are disabled by default. Automatic resolves server-side; Assisted pauses for an
authorized bounded choice or roll and can be passed where the rule permits; Manual leaves the
mechanics inert and may expose only the configured sanitized reminder. Stored settings remain
auditable even when Manual makes them inactive.

## Variant policy matrix

| Definition                 | Automatic inputs and result                                                                                                                                                             | Bounded GM judgment / exclusion                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Flanking                   | Adjacent occupied squares, opposite side/corner, visibility, and non-incapacitation produce melee advantage; reach alone is insufficient.                                               | Unusual geometry or visibility not represented by authoritative Scene facts is manual.                       |
| Alternating diagonals      | Path parity applies the 5/10-foot diagonal sequence consistently to movement and range.                                                                                                 | Uncalibrated or unsupported grid facts are manual.                                                           |
| Facing                     | Authoritative orientation and occupied footprint select front/side/rear arcs; rear attacks and permitted sight checks use the pinned policy.                                            | Unusual arcs, shield-side interpretation, and presentation choices require GM policy/data.                   |
| Climb onto larger creature | Size/suitability and an Athletics/Acrobatics contest create a bounded attached state; movement follows the pinned policy.                                                               | Whether a body is suitable, landing, and dislodging choices can be GM decisions.                             |
| Disarm                     | A qualifying attack replaces damage with an Athletics/Acrobatics contest; size, handedness, and advantage/disadvantage facts are evaluated; success creates a dropped-item disposition. | Item grip, unusual anatomy, and unsupported item state are manual.                                           |
| Mark                       | A qualifying melee attack creates a bounded marker and permits the next eligible opportunity attack under the pinned resource/turn limit.                                               | Mark targets or timing unavailable in structured facts are manual.                                           |
| Overrun                    | A movement attempt resolves the Athletics contest and size modifier, then permits one bounded passage when successful.                                                                  | Legal passage space and unusual body/terrain facts are manual.                                               |
| Shove aside                | A qualifying shove contest resolves the target's legal 5-foot displacement.                                                                                                             | Space selection with no authoritative legal destination is manual.                                           |
| Tumble                     | A movement attempt resolves the Acrobatics contest and permits one bounded passage.                                                                                                     | Unsupported movement/space conditions are manual.                                                            |
| Hitting cover              | For ranged attacks, creature-provided cover is evaluated against the original attack total and cover creature defense; only the typed creature-cover case is automatic.                 | Barriers, terrain, objects, and multiple unmodeled cover providers are manual.                               |
| Cleaving                   | A qualifying melee hit that reduces an eligible target to zero carries remaining damage to a chosen in-reach target through a bounded chain.                                            | Rider interactions, mixed damage, and target selection without structured facts are manual.                  |
| Injuries                   | A configured trigger creates a persistent UUID-backed injury with a finite consequence and recovery state.                                                                              | Trigger discretion, table choice, and recovery adjudication outside the closed consequence set are GM-owned. |
| Massive damage             | A qualifying damage event reaches the configured threshold, then resolves the pinned Constitution check and finite consequence.                                                         | Unavailable Constitution or consequence facts are manual.                                                    |
| Morale                     | A configured morale trigger resolves the pinned check and records a bounded flee/surrender/continue result.                                                                             | Triggering, group leadership, route, surrender terms, and narrative consequences are GM-owned.               |

Damage types, resistance, immunity, vulnerability, reduction, critical handling, and authored
advantage/disadvantage contributors remain shared stage facts or D&D policy modules; they are not
silently redefined by an optional variant. Optional action definitions must use the same action,
target, range, shape, modifier, resource, and effect primitives as ordinary authored content.

## Persistence and ownership

Campaigns store explicit optional-definition selections. Encounters store the effective snapshot,
source revision/checksum, and audited override receipt. Aggregate-owned state is used for persistent
consequences: item dispositions for disarm, attachment for climbing, marks and passage usage for
turn-scoped options, and versioned injury/morale state where the policy requires it. Scene owns
orientation, footprint, grid calibration, and other factual position data. No global workflow table,
feature-name branch, or client-trusted modifier is introduced.

A disarmed Character's held/equipped disposition is a Character Sheet mutation through the scoped
Encounter capability; a Creature or Custom actor's disposition remains Encounter-actor state. This
packet does not create Scene ground-item simulation, so exact drop placement and later pickup are
visible GM adjudications. Climb attachment is Encounter-owned tactical state and never changes the
Character's authored body or inventory. A mark is represented by the existing active-effect lifecycle
with bounded per-turn usage evidence, not by a parallel mark or reaction-economy table.

The D&D policy may be reused by other systems only through the shared typed primitives. Another
System can supply different contest, sense, damage, action-economy, or consequence definitions
without changing the runtime coordinator. Homebrew follows the same UUID-backed authored source,
revision, checksum, and capability validation path.

## Gate ownership

- Gate 2 proves contracts, source pins, policy execution, persistence, authorization, concurrency,
  receipts, replay, rollback, and privacy for representative combinations.
- Gate 3 owns Campaign settings, Encounter overrides, initiative/action controls, and accessible
  selectors.
- Gate 4 owns facing indicators, marks, positional previews, and token presentation.
- Gate 5 owns the local PostgreSQL lifecycle, WebSocket/multi-client behavior, browser journeys,
  replay/privacy/performance, and exact cleanup.

The fixed Phase 8 acceptance ledger remains the quantitative source of completion. Adding a
definition to this guide does not mark its case accepted; each case must advance through its stated
focused, review, and database evidence.

## Sources

- [D&D 2014 Basic Rules: Combat](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/combat)
- [D&D 2014 Basic Rules: Using Ability Scores](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/using-ability-scores)
- [D&D 2014 Dungeon Master's Guide](https://www.dndbeyond.com/sources/dnd/dmg-2014)
- [D&D 2014 DMG reference](https://www.dndbeyond.com/sources/dnd/sae/dungeon-masters-guide-2014)

This guide paraphrases mechanics and records implementation boundaries; it does not reproduce
rulebook text.
