# Campaign and interactive-play extension backlog

> **Status:** proposed enhancements
> **Scope:** product ideas and interactive effect behavior that are explicitly out of phase and can be deferred until after Phase 06 live loops are in place

## Interactive `APPLY_GRANT` lifecycle

This was previously labeled in source as a "Phase 8+ interactive runtime" follow-up. The current
roadmap's Phase 09 is billing and subscriptions, so this backlog is the canonical replacement for
that older phase note.

`ApplyGrantAuthored` currently represents permanent grants only. When the Encounter and character event pipelines support interactive effect consumption and expiry, add lifecycle metadata local to `APPLY_GRANT` rather than overloading the existing authored `Duration.durationKind` contract.

The deferred authored shape is:

```ts
lifetime?: {
  mode: 'PERMANENT' | 'TEMPORARY'
  lastsUntil?:
    | 'NEXT_ATTACK'
    | 'END_OF_ROUND'
    | 'START_OF_NEXT_TURN'
    | 'END_OF_NEXT_TURN'
    | 'NEXT_SAVE'
}
```

Permanent remains the default. Temporary consumption and expiry must be explicit, replayable Encounter or Character events; they must not be client-only timers or inferred from mutable current state.

## Campaign Features (GM-directed)

Campaigns will support a campaign-level **Feature** concept that applies temporary grants to participating characters. This is intentionally separate from encounters, inventory, or core entitlement behavior.

### Why this fits later

- It should stay out of the core phase scope so Campaign and Encounter can ship with deterministic, small contracts.
- It creates a clean seam for future GM creativity without rewiring sheet/engine structure.

### Intended behavior

- A Feature is owned by a Campaign.
- A Feature can be declared as:
  - Campaign-wide (applies to all eligible participants), or
  - Character-scoped (applies to selected character(s)).
- A Feature can expose one or more grant packages. Grants can include:
  - feature-like permissions,
  - behavior flags,
  - mechanical modifiers,
  - or other explicit, versioned campaign mechanics.
- A Feature can define prerequisites (class, race, level, or other stable predicates).
- The feature evaluator applies grants when prerequisites are met.
- Granted visibility and effect are explicit and auditable.
- Granting or ungranting does not rewrite core character structure.

### Open questions

- Are grants only mechanical, only informational, or both?
- Should characters see grant sources in their sheet projection?
- Do we need grant expiration / session-bound grant windows in phase 1?

## Other future enhancements (parked)

### Adventure Module Packages

Allow creators to assemble reusable Game-System-bound packages for GMs from existing UUID-backed
content: NPCs, Encounter Blueprints, maps, handouts, reference material, and Campaign preparation.
Packages compose and share existing authored objects; they do not introduce another mechanics engine,
historical source versions, arbitrary scripts, or user-created Game Systems. Define licensing,
ownership, dependency updates, installation, and Marketplace behavior only after the core rules
lifecycle and Encounter Blueprint model are accepted.

- Rich chat extensions: typing indicators, reactions, threads, and attachments.
- Semantic note links/hover tooltips (campaign places, people, and lore references).
- Multi-calendar support and reversible GM clock editing.
- Additional notification channels beyond Phase 05 in-app/email and Phase 11 native push.
- Structured Campaign knowledge beyond notes: NPCs/people, places/settlements, factions, quests/conflicts, relationships, timelines, and player-knowledge versus GM-secret projections.
- Session-prep templates that a GM can customize or duplicate after the flexible Phase 06 prep blocks prove useful; no single prescribed prep method.
- Scheduling polls, recurring-session generation, external calendar subscriptions, and delegated scheduling roles after the Phase 06 schedule and RSVP model is proven.
- Privacy-aware post-session feedback such as stars/wishes or anonymous safety check-ins after the table-safety policy and moderation boundaries are defined.
- Professional-GM retention, onboarding, schedule-health, and table-performance analytics after paid-table operations produce enough data to define honest metrics without ranking GMs prematurely.
- Travel planning, weather, encounter/name/treasure tables, and other system-aware GM quick generators.
- Campaign-wide search and backlinks across notes, sessions, Characters, authored content, handouts, and future world entities.
- “View as player” and deliberate co-GM/assistant-GM roles with a separate permission model rather than treating every helper as the owner.
- Ambience libraries, playlists, scene audio, and player presentation controls after the VTT/media usage model is known.
- Optional session recording, transcription, recap drafting, and continuity extraction only after consent, privacy, retention, and cost policy are approved.
- Home-base, settlement, bastion, faction-reputation, and downtime trackers after Campaign and Vehicle ownership seams are stable.
