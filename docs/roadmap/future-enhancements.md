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

## Node-based Campaign management and authoring (user-requested 2026-09-27)

The user wants two React Flow features. Neither starts while ADR 0035 is in flight. Scheduling (user, 2026-10-01, superseding 2026-09-27): **both are pre-launch but post-beta.** They start once Phases 8.2 and 8.3 are done, and are worked while beta testers are being recruited.

- **Advanced authoring node editor.** Authoring is heavy, and a hard Advanced path could put off newer players who want to go beyond the Guided flow.
- **Campaign node map.** A competitor running a Kickstarter has a similar feature, so it must not drift far.
  - The Campaign entry kinds it needs (locations, NPCs, factions and their relationships) are designed together with the Q18 per-Campaign entries limit.

### Campaign management as a node map

GMs organize a Campaign as a graph: locations, NPCs, factions, handouts, Scenes and Encounters as nodes, with relationships as edges ("rules", "located in", "allied with").

- **Differentiator:** it is a visual board like LegendKeeper's and World Anvil's, but connected to live play. A node opens its Scene, starts its Encounter, or reveals its handout.
- **Needs:**
  - Campaign entry kinds for locations, NPCs and factions (the Campaign model has none yet; see the Q18 entries limit);
  - an edge model;
  - a counterpart that works on mobile and with keyboard and screen reader (a list or outline view), because a canvas alone is not accessible.

### Advanced authoring as a contextual node editor

This replaces the long Advanced authoring form with a mind-map editor. Selecting a node shows only the child nodes valid in that context, which is less overwhelming than a 12-step form. The Advanced form is retired only if usage data shows it isn't used.

- **Reuse:** authored forms are already backend-resolved node maps (`steps -> sections -> nodes`, ADR 0004). React Flow should render those same resolved nodes and their visibility and options rules, not a second model.
- **Needs:**
  - the same validation and TanStack Form state as the form platform;
  - a keyboard and screen-reader path;
  - mobile behavior;
  - usage analytics before the form is retired.

## Crowdfunding campaign (user direction, 2026-09-28)

The user wants a Kickstarter campaign with realistic goals to fund finishing the build and early hosting.

- **Timing:** it runs alongside closed beta, not after it. The campaign ends just before beta opens, and higher-tier backers join a Founders' Beta and help shape the product.
- **Guardrails:**
  - rewards are bounded: no lifetime subscriptions, only beta access, time-limited plans, badges and credits;
  - it launches only once there is working footage;
  - the page states plainly what the money funds;
  - the wording is "compatible with 5th edition", never the Dungeons & Dragons trademark.
- **Tracking:** this is a business plan, kept here and out of the Phase 8.2 work-slice registry, whose dashboard tracks dev completion only (user, 2026-10-01). Audience-building comes first. React Flow prototypes may serve as campaign footage; the features themselves keep the schedule in the node-based section above.
- **Next step:** Claude drafts a campaign plan for the user's review. It covers the goal built from real costs, the reward tiers, a timeline tied to the Phase 8.2 and 8.3 finish, a page outline, a video shot list, the waitlist and the risks.

## Post-launch

### Shared live cursors (Q19)

This is a per-person, opt-in "Share my cursor" setting, sent at most 4 times a second and only while the mouse moves. It costs about 2,000–4,000 Durable Object requests per 4-hour session with 6 people. Revisit it when revenue supports the paid Workers plan; the launch matches Roll20, with a ping only.

### Images on notebook entries (D87)

D87 removes Campaign Files, which was the only way to attach an image to a notebook section or session. Notes are text-only at launch.

- **Example:** an NPC portrait on a People section, or a sketch on a Places section.
- **Candidate direction:** one optional image field on the notebook section itself, using the existing media pipeline. It is visible to whoever can see that section, so it needs no separate file list or permission model.

Raised by the user on 2026-10-03.

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

### World time tints the Scene

The Campaign clock knows dawn and dusk, but Scenes look the same at noon and midnight. Foundry lets world time drive Scene darkness. Candidate: a per-Scene opt-in that maps clock time to a lighting tone (day, dusk/dawn, night), applied client-side from the clock the page already reads, so it adds no room or Convex traffic. Raised by the user on 2026-10-01 during Phase 8.2.

### Manual-mode rules cues

Manual mode ([ADR 0034](../adr/0034-player-control-rules-assistance-and-roll-prompts.md)) resolves no rules, so a table running the rules itself gets no hint when a rules moment passes. Candidate: an opt-in Campaign setting (it replaces the removed "Subtle reminders" `manualReminderMode`, which only gated an undisplayed receipt marker) under which the actor's controller, the GM for monsters, sees a quiet note wherever Assisted mode would prompt. Nothing is rolled, chosen or applied.

- **Examples:** "Goblin left Thorin's reach: opportunity attack?"; a start- or end-of-turn effect such as an ongoing save or damage; a Concentration check after damage.
- **Needs:** an amendment to ADR 0034's Manual bullet; detection reuses the Assisted discovery paths (Manual movement skips reaction discovery today); cues are never shown to players who don't control the actor.

Raised by the user on 2026-10-07 during Phase 8.2; post-beta.

### Merchant interface

Players add bought items to their inventory by hand and subtract the coin themselves; there are no merchants. Candidate: a GM-run merchant (a stock list priced from the System's equipment, with optional markups) where a player buys an item and the app adds it to inventory and deducts the coins in one step. A merchant line is just the item, a quantity and a price (Arrow, quantity 20, 1 gp), so items need no sale unit. Raised by the user on 2026-10-08 during Phase 8.2 (Q21); post-launch.

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
