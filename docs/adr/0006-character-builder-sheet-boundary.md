# ADR 0006: Character Builder and Sheet are distinct from Authoring Schema authoring

- **Status:** decision
- **Date:** 2026-07-24
- **Scope:** character creation, play-state interaction, and shared authored-content platform
- **Update when:** character intent/state ownership, preview/commit flow, sheet commands, or Authoring Schema reuse boundaries change
- **Verification:** `packages/shared/src/domains/subjects/authored/character`; `packages/schema/src/api/characters`; `packages/rules-runtime/src/character`; `apps/apis/convex/characters/builder.ts`; `apps/apis/convex/characters/sheet.ts`; `apps/apis/convex/characters/sheetCommands.ts`

## Context

Character creation combines player intent, choices, advancement, provenance, and validation. In-play sheet interaction is a different concern: it changes usage state such as hit points, equipment, resources, conditions, and spell-slot consumption. Authored content forms edit reusable system/content records. Making all three use one generic Authoring Schema workflow would blur ownership and produce the wrong persistence and UX semantics.

## Decision

The **Builder** owns structural character changes and intent: race/background/class choices, ability-generation method and assignments, feature selections, feats, spells, starting-equipment/progression decisions, and advancement decisions. Builder operations validate and reconcile intent into the canonical persisted character aggregate and can produce preview/commit results.

The **Sheet** owns play-state interaction: runtime inventory ownership and item add/remove/update, equipment placement/equipped/attuned state, container currency, hit points, resources, spell casting and slots, conditions, exhaustion, titled play notes, typed per-character mechanical adjustments, panel customizations/preferences, and other commands represented by character events/state. Sheet commands do not silently rewrite Builder intent, starting-equipment decisions, profile, personality, or backstory content. Commands that consume or create state are atomic and retry-idempotent by character and command ID.

Typed resource definitions come from structural grants and engine resolution. Their current usage is persisted through the typed resource repository path; the Sheet reducer validates resource and limited-use spell commands without copying that usage into `CharacterAuthored.state.resources`. This keeps one canonical usage store while preserving pure command validation.

Campaign-owner Sheet access is a mechanical play surface, not access to the player's private presentation data. Actor-aware projection removes private inventory names/notes, spell customizations, and labels derived from them. Campaign owners cannot mutate those fields. Completed-rest preview and execution keep character adjustments separate from Campaign overlays, and a Campaign owner cannot reset the Character owner's private maximum-hit-point adjustment or receive its source metadata.

The character model keeps these views explicit:

- `CharacterAuthored` contains the character's profile, intent, and state;
- `CharacterAuthored.intent` and Builder drafts are the persisted structural editing truth;
- `CharacterSheetAdjustment` records are a separate Sheet-owned aggregate and never appear in Builder drafts or `CharacterAuthored`;
- `CharacterHistoryView` is a derived event-log view;
- `CharacterBuildSnapshot` is ephemeral engine input;
- `EngineCharacterOutput` is derived sheet output.

Character structural selections currently use stable authored root IDs and follow active content. Equipment engine inputs additionally carry an explicit active `ContentRef`; other compiled records are supplied through the assembly registry. Historical pinning is unsupported without a separate authored history store, character DTO/persistence bindings, and revision-aware loading.

Character screens may reuse lower-level controls, vocabulary selectors, authored-content DTOs, and engine output. They may use Authoring Schemas for isolated authored-content editors where that is a good fit, but the character workflow itself remains domain-specific and typed rather than being encoded as an Authoring Schema graph.

Sheet editing has no general Save action. Text and numeric values commit on blur or Enter; discrete controls commit immediately. Only rest configuration is a preview until the explicit take-rest command. One mutation is active at a time, and a successful command returns authoritative Sheet/panel state. A failed command restores server truth. This interaction rule does not change ownership: immediate persistence still flows through typed, versioned, idempotent Sheet commands.

## Consequences

Builder and Sheet APIs can evolve independently while sharing stable content references and engine contracts. Clearing an adjustment restores current Builder-authored and engine-derived behavior without copying or rewriting Builder intent. Every adjustment family may retain only an optional `sourceNote` as Sheet metadata; typed mechanical values enter snapshot calculation, while authored provenance remains in calculation breakdowns. A new character step should be modeled as an explicit intent/state/event contract and orchestrated through the character application path. A new reusable content field should extend the Authoring Schema platform only when its semantics belong to authored content generally.
