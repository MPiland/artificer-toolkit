import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
import type { RuleGraphDefinition } from '@artificer-toolkit/shared/rules'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import { DND5E_EFFECT_ACTION_FAMILY_KEY, unsupported, uuid } from './effectActionContracts.js'
import { damageDerivedHealProposalNode } from './effectActionDamageDerivedHeal.js'
import { hitPointMaximumReductionProposalNode } from './effectActionOperationRegistry.js'
import { damageSourceOutcomeId, type SpecializedOutcome } from './effectActionTestOutcomes.js'

type DamageSizedOutcome = Extract<
  SpecializedOutcome,
  { kind: 'HIT_POINT_MAXIMUM_REDUCTION' | 'DAMAGE_DERIVED_HEAL' }
>

/**
 * The one-node graph of an outcome sized by the damage a sibling outcome of its result block dealt
 * (a hit point maximum reduction, a damage-derived heal). It reads that sibling's proposal node.
 */
export function damageSizedOutcomeGraph(input: {
  effectId: string
  outcome: DamageSizedOutcome
  entry: CompiledEffectGroup['entries'][number]
  groups: readonly (readonly CompiledEffectGroup['entries'][number][])[]
  /** The prefix of this group's node ids when the block owns several groups. */
  nodePrefix: string
  selectedPath: string
}): RuleGraphDefinition {
  const { outcome, entry } = input
  const damageIndex = input.groups.findIndex(
    ([candidate]) => candidate?.entryId === damageSourceOutcomeId(outcome)
  )
  const damageEntry = input.groups[damageIndex]?.[0]
  if (!damageEntry) unsupported('D&D outcome sized by damage: the damage is not owed.')
  uuid(entry.entryId, 'D&D outcome sized by damage identity')
  const proposalId = `${input.nodePrefix}proposal-${entry.pathCode.toLowerCase()}`
  const sourceDamageNodeId = `outcome${damageIndex + 1}-proposal-${damageEntry.pathCode.toLowerCase()}`
  // The OUTCOME phase runs only on its selected path, so the outcome is authorized by construction.
  const resultPath = { kind: 'LITERAL', value: input.selectedPath } as const
  return {
    schemaVersion: 1,
    id: input.effectId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      outcome.kind === 'HIT_POINT_MAXIMUM_REDUCTION'
        ? hitPointMaximumReductionProposalNode({
            id: proposalId,
            resultPath,
            authorizedPath: input.selectedPath,
            sourceDamageNodeId,
            reduction: outcome
          })
        : damageDerivedHealProposalNode({
            id: proposalId,
            resultPath,
            sourceDamageNodeId,
            heal: outcome
          })
    ],
    outputs: {
      targetActorId: { kind: 'NODE_OUTPUT', nodeId: proposalId, port: 'targetActorId' }
    },
    sourceEntryBindings: [{ sourceEntryId: entry.entryId, nodeId: proposalId }]
  }
}
