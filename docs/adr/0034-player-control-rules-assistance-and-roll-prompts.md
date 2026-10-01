# ADR 0034: Player-controlled actors, rules assistance modes and roll prompts

- **Status:** decision (approved 2026-09-24; implementation in progress on Phase 8.2)
- **Date:** 2026-09-24
- **Revised:** 2026-09-29
- **Scope:** who may act for an Encounter actor, Encounter automation modes, rule enforcement, roll prompts, roll visibility, door and movement policy for players, and the Encounter's view of Character state
- **Update when:** actor control, automation modes, enforcement, roll-prompt behavior, roll visibility or the Character/Encounter state boundary changes
- **Supersedes:** "Progression remains GM-driven" and "`RESOLVE_ACTION` accepts a GM-selected actor" in the historical `docs/roadmap/07-encounters.md`; the three-mode (`AUTOMATIC | ASSISTED | MANUAL`) Encounter automation model; GM-only door toggling in [live-session coordination](../architecture/live-sessions.md). Other decisions in earlier ADRs remain in force.

## Context

PRODUCT.md makes players equal participants who "resolve actions" during play, and the baseline
competitors (Foundry VTT, Roll20, D&D Beyond Maps, Fantasy Grounds) let players drive their own
Characters with a GM override. The implementation made every Encounter action GM-only, and no Phase 8.2
acceptance case tested player agency, so the gap survived two phases. An audit against PRODUCT.md
(2026-09-24) also found:

- that any Character Sheet write left the Run's Character mirror stale, which refused that Character's
  Encounter commands;
- that players could not commit token moves;
- inconsistent roll ownership;
- no GM undo;
- private-by-default player rolls.

Foundry is the baseline. The goal is a smoother experience, with no module system for now.

## Decision

1. **Control belongs to the actor (Foundry ownership).**
   - Each Run actor has GM-set controller users. A Character actor's Campaign-assigned player is always
     a controller.
   - One predicate answers "can user U act for actor A": the GM (Campaign owner) always can, and a
     controller can for that actor.
   - It governs actions, ending the actor's turn, initiative, the actor's rolls and responses, and
     movement of Encounter-bound tokens.
   - Unbound tokens keep Scene token control.
   - Players act only on actors they control and target only actors visible to them.
   - Every result returned to a non-owner is the redacted player projection.
2. **Two modes, not three.**
   - **Assisted** (default): the app resolves the rules (hit versus AC, damage, saves, conditions,
     slot and resource spending, concentration, action economy) and applies results immediately.
     The app never acts or chooses on anyone's behalf: every reaction, optional feature or triggered
     ability, including authored "automatic" reactions, is offered to the actor's controller (the GM
     for monsters) as a Use/Decline choice.
     Rule checks warn instead of blocking: the actor sees the warning and may choose "Do it anyway".
     Overrides are logged with a badge the GM sees, and the GM can undo or void results and stuck
     prompts.
   - **Manual**: a digital tracker for a table that runs the rules itself (initiative and turns, HP and
     conditions, dice roller, map). The app resolves no attacks and tracks no rules.
   - `AUTOMATIC` is removed. Each person has an "Auto-roll my dice" preference (players for their own
     rolls, the GM for monster rolls). It only produces dice results, recorded as app rolls, and never
     makes a choice.
3. **Roll prompts.**
   - Every roll the app needs is a row with value input(s) and a "Roll dice" button.
   - "Roll dice" is a non-settling server roll (secure RNG), shown with the Character Sheet's 3D dice
     and posted to the table's roll log.
   - Rerolls are allowed, and every attempt is logged. Submit settles each row with the latest app roll
     (verified by id) or with entered values. Labels distinguish "Rolled by the app" from
     "Entered by <name>".
   - Advantage and disadvantage rows take two dice.
   - The rules-derived roll mode is preselected, marked as recommended and shows its reason. The roller
     may change it, and the change is logged.
   - A roll belonging to an actor the initiator does not control goes to that actor's controllers
     (the GM for uncontrolled actors).
4. **Character state is read live.** An Encounter reads a Character's HP and state from the Character
   at capture time, fenced by the revisions that captures already record. The Run keeps no Character HP,
   maximum, condition or stream-version mirror. The Sheet owns play interaction. Convex currently
   writes Character play state; [ADR 0035](0035-room-authoritative-live-encounters.md) supersedes that
   authority while a Character is held by a live Run, routing its play actions through the room.
   - Note (updated 2026-09-29): for display, the `characterPlayStates` row stores effective maximum HP,
     recomputed by the one Character persistence helper on every Character write and on Campaign
     adjustment, attunement and assignment changes. Rules evaluate the maximum live. A published-content
     change reaches the stored value on the Character's next write (accepted lag; publish-time recompute
     is a follow-up).
5. **Table policy.**
   - Players may open and close unlocked doors; locking stays GM-only.
   - Player rolls default to the table, with a "To GM" option. The GM keeps private and blind rolls and
     can reveal a private roll.
   - Rolls that change Character state (short-rest hit dice; death saves in Phase 8.3) are always
     visible to the GM: Table or To GM, never "Just me".
   - Visibility follows Foundry's default privacy:
     - Another player's Character sheet is GM-only by default. Each Character has a "Party can view"
       option on its Sheet. Personality and background are never shown to other players, and the
       Campaign roster shows only public basics (name, portrait, level, class).
     - Health display has four levels: Hidden (default), Descriptive (Unhurt, Hurt, Bloodied, Near
       death), Bar (proportional, no numbers) and Exact (current and max HP).
     - Each player sets the level for their own Character ("Show my health to the party"). The GM sets
       it per Encounter for enemies and NPCs, with a per-actor override (e.g. show the boss bar, hide
       the minions).
     - Separately, the GM can share one enemy's current descriptive state once ("The ogre looks
       bloodied"). It is posted to the table log, and the display level does not change. Bloodied
       stays a rules fact for everyone; only its display is gated.
     - The GM always sees exact values.
   - During an Encounter a player's remaining movement is shown but not enforced.
   - Fog of war is opt-in per Scene. With fog off, players see every non-hidden token, wall, door and
     light, as in Foundry without token vision. With fog on, the existing shared-party or per-player
     exploration model applies.

## Consequences

- Phase 8.2 core includes the stale-mirror fix, player control, soft enforcement with GM undo/void,
  mode consolidation, roll prompts, action-economy and movement display, and the door, roll-visibility
  and movement-gate fixes.
- A launch-gating Phase 8.3 ("Player play parity") follows with spell casting and area targeting,
  death saves, Sheet–tabletop integration, map targeting and non-movement reactions.
- Acceptance scenarios for player agency attach to existing Phase 8.2 cases (the denominator stays
  fixed).
- Removing `AUTOMATIC` deletes code and migrates development Runs; no production data exists.
- Soft enforcement turns throwing rule checks into structured, acknowledgeable warnings on the paths
  players can now reach.
