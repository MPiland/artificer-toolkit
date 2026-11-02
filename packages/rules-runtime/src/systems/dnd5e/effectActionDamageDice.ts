import { selectNumberRuleOperation, type RuleInputBinding } from '@artificer-toolkit/shared/rules'
import { damageAddedDieOfNode } from '@artificer-toolkit/schema/shared/d20AddedDice'
import type {
  ServerCompletedRuleExecutionDto,
  ServerPublishedRuleDefinitionDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  DND5E_DAMAGE_ADDED_DICE_FACT_KEY,
  DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
  DND5E_DAMAGE_REDUCTION_OPERATION_KEY
} from './effectActionContracts.js'
import { parseDamageAddedDice } from './effectActionScalingFacts.js'

/**
 * The damage dice a completed phase rolled, by request: each die whose kept roll reaches the amount
 * of one of the action's own damage proposals. A die a grant added beside the damage (D156), a die
 * that reduces it, a die only read as a condition, and a branch the roll did not take are not counted.
 */
export function rolledDamageDice(input: {
  published: ServerPublishedRuleDefinitionDto
  execution: ServerCompletedRuleExecutionDto
}): { requestId: string; faces: number; value: number }[] {
  const { nodes } = input.published.definition
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const traced = new Map(input.execution.evidence.trace.map((entry) => [entry.nodeId, entry]))
  const added = parseDamageAddedDice(
    input.execution.evidence.facts[DND5E_DAMAGE_ADDED_DICE_FACT_KEY]
  )
  const visited = new Set<string>()
  const dice: { requestId: string; faces: number; value: number }[] = []
  const visit = (binding: RuleInputBinding | undefined) => {
    if (binding?.kind !== 'NODE_OUTPUT' || visited.has(binding.nodeId)) return
    visited.add(binding.nodeId)
    const node = byId.get(binding.nodeId)
    const entry = traced.get(binding.nodeId)
    if (!node || !entry) return
    if (entry.evidence) {
      const faces = entry.inputs.max
      if (typeof faces !== 'number') throw new Error('A rolled damage die has no size.')
      dice.push({ requestId: entry.evidence.requestId, faces, value: entry.evidence.value })
      return
    }
    const untaken =
      node.operation.key === selectNumberRuleOperation.key
        ? entry.inputs.condition === true
          ? 'whenFalse'
          : 'whenTrue'
        : null
    for (const [port, input] of Object.entries(node.inputs)) {
      if (port === 'enabled' || port === 'condition' || port === untaken) continue
      if (node.operation.key === DND5E_DAMAGE_REDUCTION_OPERATION_KEY && port === 'reduction')
        continue
      visit(input)
    }
  }
  for (const node of nodes)
    if (
      node.operation.key === DND5E_DAMAGE_PROPOSAL_OPERATION_KEY &&
      !damageAddedDieOfNode(added, node.id)
    )
      visit(node.inputs.amount)
  return dice
}
