import type { EncounterFeatureActionCapabilityAdapter } from '../../encounterFeatureActionCapabilityDiscovery.js'
import {
  DND5E_SYSTEM_ID,
  resolveDnd5eSavingThrowAbilityDefinitionId
} from './characterActionCapabilityDiscovery.js'

export const dnd5eEncounterFeatureActionCapabilityAdapter: EncounterFeatureActionCapabilityAdapter =
  {
    gameSystemId: DND5E_SYSTEM_ID,
    compile: ({ compiledEffect, conditionDefinitionIds, abilityDefinitions }) => {
      const invocation = compiledEffect.invocation
      const authoredSaveAbility =
        invocation.triggerCode === 'SAVING_THROW'
          ? invocation.savingThrow.abilityDefinitionId
          : null
      return {
        conditionDefinitionIds,
        savingThrowAbilityDefinitionId: resolveDnd5eSavingThrowAbilityDefinitionId({
          effectId: compiledEffect.id,
          abilityDefinitionId: authoredSaveAbility,
          abilityDefinitions
        })
      }
    }
  }
