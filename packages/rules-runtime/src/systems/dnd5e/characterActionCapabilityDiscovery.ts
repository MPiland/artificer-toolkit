import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import type { CharacterActionCapabilityAdapter } from '../../characterActionCapabilityDiscovery.js'

import { DND5E_SYSTEM_ID } from './identity.js'
export { DND5E_SYSTEM_ID } from './identity.js'

export function resolveDnd5eSavingThrowAbilityDefinitionId(input: {
  effectId: string
  abilityDefinitionId: unknown
  abilityDefinitions: readonly { id: string; code: string }[]
}): string | null {
  if (input.abilityDefinitionId === undefined || input.abilityDefinitionId === null) return null
  if (typeof input.abilityDefinitionId !== 'string')
    throw new Error(
      `D&D saving throw for Effect ${input.effectId} has no UUID-backed ability definition.`
    )
  const abilityId = postgresUuidSchema.parse(input.abilityDefinitionId)
  if (abilityId !== input.abilityDefinitionId)
    throw new Error(
      `D&D saving throw for Effect ${input.effectId} has a noncanonical ability definition.`
    )
  if (!input.abilityDefinitions.some((ability) => ability.id === abilityId))
    throw new Error(
      `D&D saving throw for Effect ${input.effectId} has no exact System ability definition.`
    )
  return abilityId
}

export const dnd5eCharacterActionCapabilityAdapter: CharacterActionCapabilityAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  discover: ({ candidates, conditionDefinitionIds = [], abilityDefinitions = [], entryPoints }) =>
    candidates.map((candidate, index) => {
      const entryPoint = entryPoints[index]
      if (!entryPoint)
        throw new Error(`Missing exact Character action entry point at index ${index}.`)
      const invocation = entryPoint.compiledEffect.invocation
      const authoredSaveAbility =
        invocation.triggerCode === 'SAVING_THROW'
          ? invocation.savingThrow.abilityDefinitionId
          : null
      const savingThrowAbilityDefinitionId = resolveDnd5eSavingThrowAbilityDefinitionId({
        effectId: candidate.effectId,
        abilityDefinitionId: authoredSaveAbility,
        abilityDefinitions
      })
      return {
        kind: 'CHARACTER_ACTION',
        gameSystemId: DND5E_SYSTEM_ID,
        authoredRootKind: 'effect',
        entryPointDefinitionId: candidate.effectId,
        effectId: candidate.effectId,
        actionId: candidate.actionId,
        sourceId: candidate.sourceId,
        source: candidate.source,
        mechanicsOwner: candidate.mechanicsOwner,
        activationSourceKind: candidate.activationSourceKind,
        mechanicFacts: candidate.mechanicFacts,
        conditionDefinitionIds,
        savingThrowAbilityDefinitionId,
        compiledEffect: entryPoint.compiledEffect,
        ...(entryPoint.spellCastLevel === undefined
          ? {}
          : { spellCastLevel: entryPoint.spellCastLevel }),
        ...(entryPoint.characterLevel === undefined
          ? {}
          : { characterLevel: entryPoint.characterLevel }),
        ...(entryPoint.perTargetLockout && { perTargetLockout: entryPoint.perTargetLockout })
      }
    })
}
