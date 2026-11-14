import type { EncounterSettledIncomingGateDto } from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import { heldIncomingGate, type HeldIncomingGate } from './encounterIncomingAttackGate.js'
import { characterRuleActionSystemAdapterRegistry } from './platformEncounterPolicy.js'

/**
 * The ward the holder carries now, from stored state, that the gate an attack passed names; null when
 * the pass names none of the wards it holds. The commit re-derives it, so a pass never carries the
 * ward's payload itself.
 */
export function passedHeldWard(
  input: Parameters<typeof heldIncomingGate>[0] & {
    passed: Pick<EncounterSettledIncomingGateDto, 'origin'> | undefined
  }
): HeldIncomingGate | null {
  const { passed, ...held } = input
  const ward = heldIncomingGate(held)
  return ward && passed?.origin.kind === 'WARD' && passed.origin.effectId === ward.wardId
    ? ward
    : null
}

/**
 * The immunity a creature that passed a ward carrying a success immunity (Nature's Sanctuary) leaves
 * on the ward's holder, so it is not asked for the save again; null when no ward was passed or it
 * carries none. The Run's System plans it, and one that cannot count the duration fails closed.
 */
export function passedWardImmunityPlan(input: {
  gameSystemId: string
  ward: { wardId: string; payload: Pick<HeldIncomingGate['payload'], 'successImmunity'> } | null
}) {
  const successImmunity = input.ward?.payload.successImmunity
  if (!input.ward || !successImmunity) return null
  const plan = characterRuleActionSystemAdapterRegistry
    .require(input.gameSystemId)
    .incomingGateImmunityPlan?.({ wardId: input.ward.wardId, duration: successImmunity.duration })
  if (!plan) throw new Error('The ward success immunity has no countable duration.')
  return plan
}
