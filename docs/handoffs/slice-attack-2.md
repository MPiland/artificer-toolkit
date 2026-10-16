# Slice ATTACK-2.T1 and T2: player play parity

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

- T1 closes part of AC ATTACK-2.5 (a player can do everything the GM can for their own Characters in play; launch-gating, ADR 0034 inventory section 7). Build a parity matrix test derived from the real Encounter command registry, not a hand-written list: every command the GM can issue for a Character is accepted from that Character's controlling player (own actor; own turn or an open reaction window) and refused for another player's or an uncontrolled actor. Each GM-only gap the matrix finds is fixed through the player path, never by widening authorization. Commands that are legitimately GM-only (adjudication, reveal, undo) are listed with the decision that makes them GM-only.
- T2 (after ATTACK-2.T1, ATTACK-17.T3 and REACTION-4.T3b) closes the rest: a browser journey on the player client in which a player, on their own Character, casts an area spell, takes a death save, uses a non-movement reaction and targets from the map, with no GM step.

## Log

- T1 matrix: `apps/session-worker/test/nativeRoomPlayerParity.test.ts`. Command types come from `encounterCommandInputDtoSchema` and `encounterActorTokenBindingCommandInputDtoSchema` (30 types); a drift test fails when a type has no classification. Each type is `CONTROLLER` (the controlling player is treated as the GM is; another player and an uncontrolled actor get `NOT_ACTOR_CONTROLLER`), `GM_ONLY` (with the covering decision, or `null` for an open question pinned in a list) or `CREATURE_ONLY` (the GM cannot issue it for a Character either; the Sheet owns Character play state). Refusals assert the Run version is unchanged.
- Covering decisions: undo/void and stuck prompts, ADR 0034 decision 2 (`REVERT_LAST_ACTION`, `VOID_RULE_OCCURRENCE`); D103 (`REMOVE_AREA_TARGET`); D116 (`SET_CONCEALMENT_OBSERVERS`); D87 (`UPDATE_ACTOR`).
- Suspected gaps (blanket GM gate in `recordEncounterToolCommand`): `ROLL_ACTOR_INITIATIVE`, `SET_INITIATIVE`.
