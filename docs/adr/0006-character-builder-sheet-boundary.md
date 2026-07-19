# ADR 0006: Character Builder and Sheet are distinct from Authoring Schema authoring

- **Status:** decision
- **Date:** 2026-07-10
- **Scope:** character creation, play-state interaction, and shared authored-content platform
- **Update when:** character intent/state ownership, preview/commit flow, sheet commands, or Authoring Schema reuse boundaries change
- **Verification:** `packages/shared/src/domains/subjects/authored/character`; `packages/shared/src/domains/character/events`; `packages/shared/src/domains/engine/snapshot.ts`; `packages/functions/src/services/character`; `apps/apis/src/routes/characters.ts`

## Context

Character creation combines player intent, choices, advancement, provenance, and validation. In-play sheet interaction is a different concern: it changes usage state such as hit points, equipment, resources, conditions, and spell-slot consumption. Authored content forms edit reusable system/content records. Making all three use one generic Authoring Schema workflow would blur ownership and produce the wrong persistence and UX semantics.

## Decision

The **Builder** owns structural character changes and intent: race/background/class choices, ability-generation method and assignments, feature selections, feats, spells, starting-equipment/progression decisions, and advancement decisions. Builder operations validate and reconcile intent into the canonical persisted character aggregate and can produce preview/commit results.

The **Sheet** owns play-state interaction: runtime inventory ownership and item add/remove/update, equipment placement/equipped/attuned state, container currency, hit points, resources, spell casting and slots, conditions, exhaustion, titled play notes, and other commands represented by character events/state. Sheet commands do not silently rewrite Builder intent, starting-equipment decisions, profile, personality, or backstory content. Commands that consume or create state are atomic and retry-idempotent by character and command ID.

The character model keeps these views explicit:

- `CharacterAuthored` contains the character's profile, intent, and state;
- `CharacterAuthored.intent` and Builder drafts are the persisted structural editing truth;
- `CharacterHistoryView` is a derived event-log view;
- `CharacterBuildSnapshot` is ephemeral engine input;
- `EngineCharacterOutput` is derived sheet output.

Character structural selections currently use stable authored-definition IDs and follow active content. Equipment engine inputs additionally carry an explicit active `ContentRef`; other compiled records are supplied through the assembly registry. Persisted active-or-pinned bindings across all selections are target work and require character DTO/persistence plus revision-aware loading changes.

Character screens may reuse lower-level controls, vocabulary selectors, authored-content DTOs, and engine output. They may use Authoring Schemas for isolated authored-content editors where that is a good fit, but the character workflow itself remains domain-specific and typed rather than being encoded as an Authoring Schema graph.

## Consequences

Builder and Sheet APIs can evolve independently while sharing stable content references and engine contracts. A new character step should be modeled as an explicit intent/state/event contract and orchestrated through the character application path. A new reusable content field should extend the Authoring Schema platform only when its semantics belong to authored content generally.
