# SPELLS-4.T2d2 (move a held effect to a new target as a granted action)

- Status: design ruled (orchestrator, option A, 2026-10-20); not built. Resume after SPELLS-4.T2lb merges to `codex/phase-08-2-convex-cutover`, then sync and build on its `grantedActions` offer seam. Cites D156 (class B generic option), D160 (granted actions, shared effect-release seam).
- Rejected: option B (a separate offer and pending-decision path, duplicates the T2lb seam); option C (T2lb2 repeat-source-path offers, which cast a new path rather than move an existing effect).

## Design (option A)

- **Authored field:** result block `lifecycle.moveOnHolderZeroHp { activation: ActivationAuthored, range }`, beside `onEnd` in `PathLifecycleAuthored` (`packages/shared/src/domains/effects/authored/path.ts`) and its node map (`maps/path.ts`, same `groupObject` pattern as `onEnd`). Only an `APPLY_GRANT` effect carries it. The name is generic: the trigger is "the holder drops to 0 HP", nothing spell-specific.
- **Compile target:** a field on the stored active-effect definition (frozen with it, as `onEnd` is on the `MODIFIER_GRANT` contribution), read by the runtime from the held record. Schema in `packages/schema/src/shared/activeRuleEffects`.
- **Trigger:** when a committed outcome drops the holder to 0 HP, the effect is not ended (its Concentration and duration keep running). The source is offered the move.
- **Offer kind:** `MOVE_HELD_EFFECT` on T2lb's granted-action offer seam: one use, costing `activation`, available on a subsequent turn of the source, with a fresh single-target pick within `range`. Decline or no pick leaves the effect on the downed holder.
- **Re-home semantics:** the same active-effect id, remaining duration and Concentration identity move to the new holder (the effect store re-homes the record; no end, no `onEnd` follow-on, no new Concentration). Undo restores the previous holder.
- **Proofs to write:** parity proof (authored node map keeps the field; compiled definition carries it), rules-runtime unit tests for the offer and re-home, encounter-persistence test for re-home and undo, and a session-worker room journey (target to 0 HP, offer on a later turn, move to a new target, Concentration and duration preserved, decline path).
- **Conversion:** Hunter's Mark authors the field; its description-only re-mark text is replaced. Remove the T2d2 line from the slice-spells-4 deferred list on merge.
