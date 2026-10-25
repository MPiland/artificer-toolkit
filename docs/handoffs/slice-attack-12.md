# Slice ATTACK-12: Token facing and arcs

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

- T1: per-token facing state set at the end of a move and changeable as a reaction, in Convex and the Worker.
- T2: attack resolution with arcs: rear-arc advantage, a token cannot target its own rear arc, and the evidence names the arc.
- T3: integrate in the table and settings; journey test.

Base: `origin/codex/phase-08-2-convex-cutover`. CI branch `ci/attack-12`.

## Rulings (orchestrator, 2026-10-25)

- **Facing state.** Facing is the token's existing `rotationDegrees`. There is no second field. Outside an Encounter, facing changes only through the GM's `UPSERT_SCENE_TOKEN`.
- **Facing at the end of a move.** `MOVE_SCENE_TOKEN` takes an optional `facingDegrees`.
  - It is accepted only on an Encounter move while the frozen FACING definition is active.
  - It is written as an optional `rotationDegrees` on the terminal `TOKEN_MOVED` delta, so the move and its facing are one delta with one undo.
- **Facing as a reaction.** The Encounter rule command `CHANGE_FACING` follows the holder-command reaction path.
  - It is admitted by `admitCurrentActorCommand` with `anyTurn`.
  - It spends `REACTION` through `spendNativeHolderActivation`.
  - It writes a `TOKEN_FACING_SET` delta.
  - It adds no new pause or trigger.
  - A test proves that a rotation never counts as turn movement.
- **Arc parameters are authored data.**
  - The FACING parameters carry `facingStepDegrees`, the arc table, the attacker-in-target-arc roll influence and the arcs a source cannot target.
  - `classifyFacingArcAt` takes the arc table.
  - The SRD checksum changes, so local development data is reseeded (standing approval).
  - A homebrew variant is the parity proof.
- **Attack resolution (T2).**
  - One `positionalAttackContributors` replaces `flankingContributor`; the old function is deleted, not wrapped. It runs through the existing suppression and `resolveDnd5eRollMode` chain.
  - The own-rear-arc refusal lives in the target-legality policy, and its message and evidence name the arc.
  - The evidence is an additive optional `positional: { arc }` on `ReceiptD20ContributorDto`.
  - Receipt fixtures migrate in the same change.
- **Positional home (ruling 2, superseding the `flankingContributor` replacement above).**
  - `flankingContributor` reads compiler-only `positionalFacts` that no live path supplies, so it never applies at the table. The facing contributor therefore does not replace it.
  - Instead, `encounterActionPositionalContributors` (next to `encounterActionLongRangeContributor`) is the live merge's single home for positional contributors. It reads `encounterFacingRule(state)`, the Scene tokens' `rotationDegrees` and the rule's arc table, and its contributors carry `positional: { arc }`.
  - `flankingContributor` stays untouched in this slice.
  - Live flanking is a separate bug (settings list the rule as integrated, but it never applies). Its fix moves flanking into the positional home and deletes the compiler-only path. The orchestrator registers it as its own task once the user approves.

## Deferred edge cases

- A move that a reaction stops before the token leaves its square ends with no Scene delta, so the facing it chose is not applied. The creature can still turn with Change facing, which costs its reaction. This is rare and recoverable (triage by likelihood).

## T1 shape

- The room writes a facing change as the Scene command `SET_SCENE_TOKEN_FACING`. Only an Encounter action origin may issue it; it is not in the client Scene command unions.
- The stored geometry command keeps `priorRotationDegrees`. A Scene undo of a move that chose a facing restores it, and the action undo of `CHANGE_FACING` restores it through the room-only port `restoreActionFacing`. Either undo is refused once the token was moved or turned since.

## T2 shape

- `evaluateEncounterActionTargetPolicy` takes the Encounter's Facing rule (`encounterFacingRule(state)`, or null where no Scene exists). When the source's arc toward the target is one the rule lists in `sourceCannotTargetInOwnArcs`, it raises the overridable `TARGET_FACING_ARC` warning, whose message names the arc. A self target and an unmapped token raise nothing.
- Every live targeting path passes the rule: single-target and chosen-creature actions, cast reactions, moving a held effect and Disarm. Legendary-action discovery has no Scene and passes null.
- Arcs are read from the authored arc table (`encounterFacingArcs`): on a square grid, from the closest occupied cells of both tokens; elsewhere, from the token centres.
- On an attack, `prepareEncounterActionMechanics` merges `encounterActionPositionalContributors`.
  - It adds one rules-owned contributor (`rule:facing`) for each `attackerInTargetArc` entry whose arc the attacker stands in.
  - The dnd5e compiler keeps `positional` when it copies the contributors into the d20 audit, so the receipt names the arc.
  - The roll reason reads "Facing (rear arc)".
