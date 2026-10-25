import { incomingDamageProfileDtoSchema } from '@artificer-toolkit/schema/grants/modifier'
import type {
  CompiledRuleGraph,
  RuleGraphDefinition,
  RuleInputBinding
} from '@artificer-toolkit/shared/rules'
import {
  DND5E_DAMAGE_MULTIPLIER_OPERATION_KEY,
  DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
  DND5E_SAVE_DAMAGE_MULTIPLIER_FACT_KEYS,
  type Dnd5eCompiledEffectActionSource,
  type SpecializedPath,
  unsupported
} from './effectActionContracts.js'
import { DND5E_ABILITY_DEFINITION_ID_BY_CODE } from './identity.js'

/** `amount` times the target's own save-damage multiplier for the save result `path`. */
export function saveDamageMultiplied(
  id: string,
  amount: RuleInputBinding,
  path: keyof typeof DND5E_SAVE_DAMAGE_MULTIPLIER_FACT_KEYS
) {
  return {
    node: {
      id,
      operation: { key: DND5E_DAMAGE_MULTIPLIER_OPERATION_KEY, contractVersion: 1 },
      inputs: {
        amount,
        multiplier: { kind: 'FACT' as const, factKey: DND5E_SAVE_DAMAGE_MULTIPLIER_FACT_KEYS[path] }
      }
    },
    amount: { kind: 'NODE_OUTPUT' as const, nodeId: id, port: 'value' }
  }
}

/**
 * The selected save result of an effect the target saves against for half (it deals damage on a
 * success too), each damage multiplied by the target's own save-damage multiplier first.
 */
export function withSaveDamageMultiplier(input: {
  action: Dnd5eCompiledEffectActionSource
  selectedPath: SpecializedPath
  definition: RuleGraphDefinition
}): RuleGraphDefinition {
  const path = input.selectedPath
  if (path !== 'ON_SAVE_FAIL' && path !== 'ON_SAVE_SUCCESS') return input.definition
  const savesForHalf = input.action.compiledEffect.entries.some(
    (entry) =>
      entry.pathCode === 'ON_SAVE_SUCCESS' &&
      'outcome' in entry &&
      entry.outcome.effectKind === 'DAMAGE'
  )
  if (!savesForHalf) return input.definition
  return {
    ...input.definition,
    nodes: input.definition.nodes.flatMap((node) => {
      if (node.operation.key !== DND5E_DAMAGE_PROPOSAL_OPERATION_KEY) return [node]
      if (!node.inputs.amount) unsupported('D&D save damage needs the amount it multiplies.')
      const multiplied = saveDamageMultiplied(
        `${node.id}-save-multiplied`,
        node.inputs.amount,
        path
      )
      return [multiplied.node, { ...node, inputs: { ...node.inputs, amount: multiplied.amount } }]
    })
  }
}

/**
 * The save-damage multipliers a graph reads, from the target's incoming-damage profile: a
 * save-for-half adjustment covering the save's ability sets its success and failure multipliers.
 */
export function saveDamageMultiplierFacts(
  graph: Pick<CompiledRuleGraph, 'nodes'>,
  target: { abilityDefinitionId: unknown; incomingDamage: unknown }
): Record<string, number> {
  const keys = Object.values(DND5E_SAVE_DAMAGE_MULTIPLIER_FACT_KEYS)
  const read = graph.nodes.some((node) =>
    Object.values(node.inputs).some(
      (binding) => binding.kind === 'FACT' && (keys as readonly string[]).includes(binding.factKey)
    )
  )
  if (!read) return {}
  if (typeof target.abilityDefinitionId !== 'string')
    unsupported('D&D save damage needs the ability of its saving throw.')
  const adjustment = incomingDamageProfileDtoSchema
    .parse(target.incomingDamage)
    .saveForHalf.find(({ saveAbilities }) =>
      saveAbilities.some(
        (code) => DND5E_ABILITY_DEFINITION_ID_BY_CODE[code] === target.abilityDefinitionId
      )
    )
  return {
    [DND5E_SAVE_DAMAGE_MULTIPLIER_FACT_KEYS.ON_SAVE_SUCCESS]:
      adjustment?.onSaveSuccess === 'NONE' ? 0 : 1,
    [DND5E_SAVE_DAMAGE_MULTIPLIER_FACT_KEYS.ON_SAVE_FAIL]:
      adjustment?.onSaveFailure === 'HALF' ? 0.5 : 1
  }
}
