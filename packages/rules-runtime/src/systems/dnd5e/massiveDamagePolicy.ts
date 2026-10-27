import type { RuleGraphDefinition } from '@artificer-toolkit/shared/rules'

import type {
  MassiveDamageRule,
  OptionalCombatPolicyCapabilityAdapter,
  OptionalCombatPolicyInput
} from '../../optionalCombatPolicyCapability.js'
import { dnd5eConcentrationHolderSaves, resolveDnd5eHolderSave } from './concentrationPolicy.js'
import { derivedAddedDice, dnd5eAddedDiceFacts, dnd5eAddedDiceNode } from './d20AddedDiceGraph.js'
import { DND5E_SAVE_TEST_OPERATION_KEY } from './dnd5eTestOperationKeys.js'
import {
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY,
  DND5E_SAVE_DC_FACT_KEY,
  DND5E_SAVE_MODIFIER_FACT_KEY,
  DND5E_TARGET_ACTOR_FACT_KEY
} from './effectActionContracts.js'
import { publishedGraph } from './effectActionPublishedGraph.js'
import { DND5E_SYSTEM_ID } from './identity.js'
import {
  exactOptionalCombatDefinition,
  optionalCombatPolicyPin
} from './optionalCombatDefinition.js'
import { DND5E_MASSIVE_DAMAGE_POLICY_MODULE } from './policyModuleRegistration.js'

/**
 * The save graph one massive-damage definition rolls: the holder's save of the rule's ability
 * against the rule's DC. The graph is the definition's own, so its checksum moves with the rule.
 */
function massiveDamageSaveGraph(input: {
  definitionId: string
  savingThrowAbilityDefinitionId: string
}) {
  const definition: RuleGraphDefinition = {
    schemaVersion: 1,
    id: input.definitionId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    vocabularyBindings: [{ kind: 'ABILITY', definitionId: input.savingThrowAbilityDefinitionId }],
    nodes: [
      {
        id: 'd20',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: {
          min: { kind: 'LITERAL', value: 1 },
          max: { kind: 'LITERAL', value: 20 }
        }
      },
      dnd5eAddedDiceNode('d20'),
      {
        id: 'save',
        operation: { key: DND5E_SAVE_TEST_OPERATION_KEY, contractVersion: 3 },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'd20', port: 'value' },
          addedTotal: { kind: 'NODE_OUTPUT', nodeId: 'd20-added-dice', port: 'value' },
          modifier: { kind: 'FACT', factKey: DND5E_SAVE_MODIFIER_FACT_KEY },
          threshold: { kind: 'FACT', factKey: DND5E_SAVE_DC_FACT_KEY },
          contributorChecksum: { kind: 'FACT', factKey: DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY },
          outcomeRule: { kind: 'LITERAL', value: 'NONE' }
        }
      }
    ],
    outputs: {
      targetActorId: { kind: 'NODE_OUTPUT', nodeId: 'save', port: 'targetActorId' },
      dc: { kind: 'FACT', factKey: DND5E_SAVE_DC_FACT_KEY },
      naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'save', port: 'naturalD20' },
      total: { kind: 'NODE_OUTPUT', nodeId: 'save', port: 'total' },
      resultPath: { kind: 'NODE_OUTPUT', nodeId: 'save', port: 'resultPath' },
      contributorChecksum: { kind: 'NODE_OUTPUT', nodeId: 'save', port: 'contributorChecksum' }
    }
  }
  return publishedGraph(definition)
}

/** The Run's exact MASSIVE_DAMAGE definition as a rule; null when it is off or tampered with. */
export function dnd5eMassiveDamageRule(input: OptionalCombatPolicyInput): MassiveDamageRule | null {
  const definition = exactOptionalCombatDefinition({
    ...input,
    kind: 'MASSIVE_DAMAGE',
    module: DND5E_MASSIVE_DAMAGE_POLICY_MODULE
  })
  const parameters = definition?.document.parameters
  if (!definition || parameters?.kind !== 'MASSIVE_DAMAGE') return null
  return {
    pin: optionalCombatPolicyPin(definition),
    threshold: parameters.threshold,
    savingThrowAbilityDefinitionId: parameters.savingThrowAbilityDefinitionId,
    difficultyClass: parameters.savingThrowDifficultyClass,
    published: massiveDamageSaveGraph({
      definitionId: definition.definitionId,
      savingThrowAbilityDefinitionId: parameters.savingThrowAbilityDefinitionId
    }),
    failedSaveEffectId: parameters.failedSaveEffectId ?? null
  }
}

/** The holder's save of the rule's ability, scoped to the rule when the holder has such a save. */
export const dnd5eMassiveDamageSaveFacts: OptionalCombatPolicyCapabilityAdapter['massiveDamageSaveFacts'] =
  (input) => {
    const abilityDefinitionId = input.rule.savingThrowAbilityDefinitionId
    const addedDice = derivedAddedDice(
      input.target.targetDerivedFacts.savingThrowAddedDice,
      abilityDefinitionId
    )
    const save = resolveDnd5eHolderSave({
      abilityDefinitionId,
      ruleDefinitionId: input.rule.pin.definitionId,
      rulePolicyOutput: dnd5eConcentrationHolderSaves(input.target)
    })
    if (!save) throw new Error('D&D massive-damage saving throw is unavailable.')
    return {
      addedDice,
      facts: {
        [DND5E_TARGET_ACTOR_FACT_KEY]: input.targetActorId,
        [DND5E_SAVE_MODIFIER_FACT_KEY]: save.modifier,
        [DND5E_SAVE_DC_FACT_KEY]: input.rule.difficultyClass,
        [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: save.contributorChecksum,
        ...dnd5eAddedDiceFacts(addedDice)
      },
      ...save
    }
  }
