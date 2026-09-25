# Future enhancements backlog

> **Status:** proposed enhancements. The Post-launch section holds improvements that are deliberately deferred until after launch; everything needed for a competitive product before closed beta lives in the phase plans, not here.
> **Scope:** product ideas, model redesigns and interactive behavior that are explicitly out of phase

## Interactive `APPLY_GRANT` lifecycle

> **Moved into scope (2026-09-25):** `APPLY_GRANT` effects (Shield, Aid, Shocking Grasp and others) ship in Phase 8.3 with spell casting, before closed beta. The lifecycle notes below are the starting point for that work.

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

## Post-launch

### Rules-engine-native modifier model
Much of the modifier vocabulary predates the rules engine and expresses capability rules as numeric workarounds. For example, Shocking Grasp's "can't take reactions" is authored as `REACTION_COUNT` `SET_VALUE` 0. Review the whole modifier model with the engine in mind:
- capability modifiers (`DISABLE` / `ENABLE` over reactions, bonus actions, movement modes, concentration, and so on) instead of zeroing counts, so effects compose cleanly and the UI can say "Reactions disabled (Shocking Grasp)";
- which kinds should become engine rules instead of authored numbers;
- migrating SRD and homebrew content, with authoring UX that reads like the rules text.

Raised by the user on 2026-09-25 during Phase 8.2.

### Node-map DSL child-scope references
Condition paths resolve one field from the current scope or an enclosing one (`ShallowPath`), never from a child group. So the Equipment effect `grip` field is always visible, although its correct condition is the effect's own `invocation.triggerCode`. Candidate: a bounded, typed child-scope reference. See `docs/architecture/authoring-schema.md`.

### Publish-time recompute of stored Character maximum HP
A Character's stored maximum HP (display only; rules are live) updates on the Character's next write after a content republish. A background recompute of the affected Characters after publish would remove that lag.

### Fog-off Scenes skip unused fog layers
A fog-off Scene that keeps its fog layers still uses full hydration, and players download layers they don't use. Skip or defer them while fog is off.

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
