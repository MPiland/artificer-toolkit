import type {
  EncounterSpellCastingStateDto,
  EncounterSpellCastingTransitionDto
} from '@artificer-toolkit/schema/projections/encounterSpellCasting'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  encounterSpellCastingState,
  withEncounterSpellCastingState
} from './encounterActorState.js'
import { actionEconomyCapabilityRegistry } from './platformPolicyModules.js'

/**
 * Whether the System's limit on spells cast in one turn allows this cast, and the record it leaves.
 * The record is turn-scoped: one written on an earlier turn is ignored and replaced.
 */
export function evaluateEncounterSpellCasting(input: {
  actor: EncounterRunActorState
  state: Pick<EncounterRunState, 'gameSystemId' | 'turnSequence'>
  activation: { code: string; amount: number }
  cantrip: boolean
}): { refusal: string | null; transition: EncounterSpellCastingTransitionDto | null } {
  const limit = actionEconomyCapabilityRegistry.require(input.state.gameSystemId).spellCastingLimit
  if (!limit) return { refusal: null, transition: null }
  const before = encounterSpellCastingState(input.actor)
  const held =
    before?.turnSequence === input.state.turnSequence
      ? before
      : { bonusActionSpell: false, actionSpell: false }
  const { refusal, marks } = limit({
    activationKind: input.activation.code,
    activationAmount: input.activation.amount,
    cantrip: input.cantrip,
    held
  })
  return {
    refusal,
    transition: marks
      ? {
          before,
          after: {
            turnSequence: input.state.turnSequence,
            bonusActionSpell: held.bonusActionSpell || marks === 'bonusActionSpell',
            actionSpell: held.actionSpell || marks === 'actionSpell'
          }
        }
      : null
  }
}

function sameSpellCasting(
  left: EncounterSpellCastingStateDto | null,
  right: EncounterSpellCastingStateDto | null
) {
  return checksumCanonicalJson(left) === checksumCanonicalJson(right)
}

/** Writes the record a spell cast settled; the actor must still hold the state it was planned on. */
export function applyEncounterSpellCastingTransition(
  actor: EncounterRunActorState,
  transition: EncounterSpellCastingTransitionDto
): EncounterRunActorState {
  if (!sameSpellCasting(encounterSpellCastingState(actor), transition.before))
    throw new Error("The actor's spell-casting record changed before settlement.")
  return encounterRunActorStateSchema.parse({
    ...actor,
    resources: withEncounterSpellCastingState(actor, transition.after)
  })
}

/** Restores the record an undone cast changed; null when a later cast has changed it again. */
export function revertEncounterSpellCastingTransition(
  actor: EncounterRunActorState,
  transition: EncounterSpellCastingTransitionDto
): EncounterRunActorState | null {
  if (!sameSpellCasting(encounterSpellCastingState(actor), transition.after)) return null
  return encounterRunActorStateSchema.parse({
    ...actor,
    resources: withEncounterSpellCastingState(actor, transition.before)
  })
}
