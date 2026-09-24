import type { EncounterFeatureActionCapabilityAdapter } from '../../encounterFeatureActionCapabilityDiscovery.js'
import {
  DND5E_SYSTEM_ID,
  resolveDnd5eSavingThrowAbilityDefinitionId
} from './characterActionCapabilityDiscovery.js'

export const dnd5eEncounterFeatureActionCapabilityAdapter: EncounterFeatureActionCapabilityAdapter =
  {
    gameSystemId: DND5E_SYSTEM_ID,
    compile: ({ compiledEffect, conditionDefinitionIds, abilityDefinitions }) => ({
      conditionDefinitionIds,
      savingThrowAbilityDefinitionId: resolveDnd5eSavingThrowAbilityDefinitionId({
        effectId: compiledEffect.id,
        abilityDefinitionId:
          compiledEffect.invocation.triggerCode === 'SAVING_THROW'
            ? compiledEffect.invocation.savingThrow.abilityDefinitionId
            : null,
        abilityDefinitions
      })
    })
  }
