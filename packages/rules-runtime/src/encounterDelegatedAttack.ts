import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import { delegatedAttackPayloadDtoSchema } from '@artificer-toolkit/schema/grants/modifier'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { holderStateRestrictionsHold } from './encounterActiveGrants.js'

/**
 * Whether `delegate` makes an attack in place of one of `holder`'s Attack action (DELEGATED_ATTACK,
 * D156): the holder summoned it with an effect it still holds, and one of the holder's grants names
 * that effect. A grant bound to the holder's own active effect holds only while that effect is
 * active; its other deferred holder conditions fail closed.
 */
export function encounterAttackDelegated(input: {
  holder: Pick<EncounterRunActorState, 'id'>
  delegate: Pick<EncounterRunActorState, 'owner'>
  holderModifiers: readonly CharacterGrantFoldOutput['modifiers'][number][]
  holderEffects: readonly (Pick<ActiveRuleEffectRecord, 'id'> & {
    definition: Pick<ActiveRuleEffectRecord['definition'], 'authoredEffectId'>
  })[]
}): boolean {
  const { owner } = input.delegate
  if (owner?.ownerActorId !== input.holder.id || !owner.sourceEffectId) return false
  const carrier = input.holderEffects.find((effect) => effect.id === owner.sourceEffectId)
  if (!carrier) return false
  const activeAuthoredEffectIds = input.holderEffects.map(
    ({ definition }) => definition.authoredEffectId
  )
  return input.holderModifiers.some(
    (modifier) =>
      modifier.valueDomainCode === 'DELEGATED_ATTACK' &&
      modifier.source.kind === 'AUTHORED' &&
      holderStateRestrictionsHold(modifier.deferredRequirements, { activeAuthoredEffectIds }) &&
      delegatedAttackPayloadDtoSchema
        .parse(modifier.payload)
        .effectIds.includes(carrier.definition.authoredEffectId)
  )
}
