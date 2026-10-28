import {
  DND5E_CONDITION_IMMUNE_FACT_KEYS,
  entryDamagePrefix,
  DND5E_MOVEMENT_INTERRUPTION_AUTHORIZATION_OPERATION_KEY,
  DND5E_ATTACK_MODIFIER_FACT_KEY,
  DND5E_SAVE_MODIFIER_FACT_KEY,
  DND5E_TARGET_DEFENSE_FACT_KEY,
  DND5E_SAVE_DC_FACT_KEY,
  CONDITION_PROPOSAL_SUFFIX,
  DND5E_DAMAGE_TOTAL_OPERATION_KEY,
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  DND5E_TARGET_ACTOR_FACT_KEY,
  DND5E_ATTACK_CRITICAL_THRESHOLD_FACT_KEY,
  DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY,
  DND5E_TEST_OUTCOME_RULE_FACT_KEY,
  type TestKind,
  type Outcome,
  type EntryDiceOutcome,
  isEntryDiceOutcome
} from './effectActionContracts.js'
import {
  pathGatedProposalNode,
  rolledDiceNodes,
  multipliedDamage
} from './effectActionOutcomeNodes.js'
import { boundedDiceTerm } from './effectActionScalingFacts.js'
import { checksumRuleDocument, type RuleGraphDefinition } from '@artificer-toolkit/shared/rules'
import type { CharacterRuleActionActiveEffectPlan } from '../../characterRuleActionSystemAdapter.js'
import {
  DND5E_ATTACK_TEST_OPERATION_KEY,
  DND5E_SAVE_TEST_OPERATION_KEY
} from './dnd5eTestOperationKeys.js'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import { dnd5eAddedDiceNode } from './d20AddedDiceGraph.js'
import { testContractVersion } from './effectActionOperationRegistry.js'
import {
  serverPublishedRuleDefinitionDtoSchema,
  type ServerPublishedRuleDefinitionDto
} from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import type { Dnd5eCompiledEffectActionSource } from './effectActionContracts.js'
import { publishedGraph } from './effectActionPublishedGraph.js'
import { saveDamageMultiplied } from './effectActionSaveDamage.js'

export interface TestPlan {
  kind: TestKind
  branches: ReadonlyMap<string, Outcome | EntryDiceOutcome>
  /** The source entry a fixed branch outcome is authored by, where a held effect binds it (a zone's made save). */
  branchEntryIds?: ReadonlyMap<string, string>
  /** A condition a result path applies beside its branch, from a proposal of its own (D142). */
  conditions?: ReadonlyMap<string, { outcome: Outcome; entryId: string }>
}

/** A result path's outcome inside a test graph: proposed only when the test resolves to that path. */
function proposalNode(
  pathCode: string,
  outcome: Outcome | EntryDiceOutcome,
  suffix = '',
  savesForHalf = false
) {
  return pathGatedProposalNode({
    id: `proposal-${pathCode.toLowerCase()}${suffix}`,
    pathCode,
    testNodeId: 'test',
    outcome,
    conditionImmuneFactKey:
      DND5E_CONDITION_IMMUNE_FACT_KEYS[pathCode as keyof typeof DND5E_CONDITION_IMMUNE_FACT_KEYS],
    amount: isEntryDiceOutcome(outcome)
      ? entryDiceDamageGraph(pathCode, outcome, savesForHalf).amount
      : undefined
  })
}

/**
 * The nodes of an entry dice damage outcome and the amount it proposes: the dice are asked for only
 * when the test resolves to its path, their total takes the authored modifier, and a share of it is
 * dealt through the damage multiplier, then, for a save the target makes for half, through the
 * target's own save-damage multiplier.
 */
function entryDiceDamageGraph(pathCode: string, outcome: EntryDiceOutcome, savesForHalf: boolean) {
  const prefix = entryDamagePrefix(pathCode)
  const enabledNodeId = `${prefix}enabled`
  const totalNodeId = `${prefix}total`
  const { term, modifier } = boundedDiceTerm(outcome.diceConfig)
  const dice = rolledDiceNodes(term, prefix, {
    kind: 'NODE_OUTPUT',
    nodeId: enabledNodeId,
    port: 'authorized'
  })
  const totalNodes =
    modifier === 0
      ? []
      : [
          {
            id: totalNodeId,
            operation: { key: DND5E_DAMAGE_TOTAL_OPERATION_KEY, contractVersion: 1 },
            inputs: {
              subtotal: dice.subtotal,
              modifier: { kind: 'LITERAL' as const, value: modifier }
            }
          }
        ]
  const total =
    modifier === 0
      ? dice.subtotal
      : { kind: 'NODE_OUTPUT' as const, nodeId: totalNodeId, port: 'value' }
  const multiplied = multipliedDamage(`${prefix}multiplied`, total, outcome.multiplier)
  const nodes: RuleGraphDefinition['nodes'] = [
    {
      id: enabledNodeId,
      operation: {
        key: DND5E_MOVEMENT_INTERRUPTION_AUTHORIZATION_OPERATION_KEY,
        contractVersion: 1
      },
      inputs: {
        resultPath: { kind: 'NODE_OUTPUT' as const, nodeId: 'test', port: 'resultPath' },
        authoredPath: { kind: 'LITERAL' as const, value: pathCode }
      }
    },
    ...dice.nodes,
    ...totalNodes,
    ...multiplied.nodes
  ]
  // A save multiplier (Evasion) changes damage, never hit points lost directly.
  if (
    !savesForHalf ||
    outcome.kind !== 'ENTRY_DICE_DAMAGE' ||
    (pathCode !== 'ON_SAVE_FAIL' && pathCode !== 'ON_SAVE_SUCCESS')
  )
    return { nodes, amount: multiplied.amount }
  const saved = saveDamageMultiplied(`${prefix}save-multiplied`, multiplied.amount, pathCode)
  return { nodes: [...nodes, saved.node], amount: saved.amount }
}

function entryDiceDamageNodes(pathCode: string, outcome: EntryDiceOutcome, savesForHalf: boolean) {
  return [
    ...entryDiceDamageGraph(pathCode, outcome, savesForHalf).nodes,
    proposalNode(pathCode, outcome, '', savesForHalf)
  ]
}

export function compileTestDefinition(
  action: Dnd5eCompiledEffectActionSource,
  plan: TestPlan,
  recurringPlan: Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'> | null
) {
  const modifierFact =
    plan.kind === 'ATTACK' ? DND5E_ATTACK_MODIFIER_FACT_KEY : DND5E_SAVE_MODIFIER_FACT_KEY
  const thresholdFact =
    plan.kind === 'ATTACK' ? DND5E_TARGET_DEFENSE_FACT_KEY : DND5E_SAVE_DC_FACT_KEY
  const testOperation =
    plan.kind === 'ATTACK' ? DND5E_ATTACK_TEST_OPERATION_KEY : DND5E_SAVE_TEST_OPERATION_KEY
  const conditions = [...(plan.conditions ?? [])]
  const savesForHalf =
    plan.kind === 'SAVE' && plan.branches.get('ON_SAVE_SUCCESS')?.kind === 'ENTRY_DICE_DAMAGE'
  const proposalNodes: RuleGraphDefinition['nodes'] = [
    ...[...plan.branches].flatMap(([pathCode, outcome]) =>
      isEntryDiceOutcome(outcome)
        ? entryDiceDamageNodes(pathCode, outcome, savesForHalf)
        : [proposalNode(pathCode, outcome)]
    ),
    ...conditions.map(([pathCode, { outcome }]) =>
      proposalNode(pathCode, outcome, CONDITION_PROPOSAL_SUFFIX)
    )
  ]
  const definition: RuleGraphDefinition = {
    schemaVersion: 1,
    id: action.effectId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
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
        id: 'test',
        operation: { key: testOperation, contractVersion: testContractVersion(plan.kind) },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'd20', port: 'value' },
          addedTotal: { kind: 'NODE_OUTPUT', nodeId: 'd20-added-dice', port: 'value' },
          modifier: { kind: 'FACT', factKey: modifierFact },
          threshold: { kind: 'FACT', factKey: thresholdFact },
          ...(plan.kind === 'ATTACK'
            ? {
                criticalThreshold: {
                  kind: 'FACT' as const,
                  factKey: DND5E_ATTACK_CRITICAL_THRESHOLD_FACT_KEY
                }
              }
            : {}),
          contributorChecksum: {
            kind: 'FACT',
            factKey: DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY
          },
          outcomeRule: { kind: 'FACT', factKey: DND5E_TEST_OUTCOME_RULE_FACT_KEY }
        }
      },
      ...proposalNodes
    ],
    outputs: {
      targetActorId: {
        kind: 'NODE_OUTPUT',
        nodeId: 'test',
        port: 'targetActorId'
      },
      naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'naturalD20' },
      total: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'total' },
      resultPath: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'resultPath' },
      contributorChecksum: {
        kind: 'NODE_OUTPUT',
        nodeId: 'test',
        port: 'contributorChecksum'
      }
    },
    ...(recurringPlan
      ? {
          sourceEntryBindings: [
            {
              sourceEntryId: recurringPlan.compiledEntryId,
              nodeId: recurringPlan.frozenGraphNodeId
            },
            // A zone's made save deals its own damage from its own proposal node.
            ...[...plan.branches].flatMap(([pathCode, outcome]) => {
              const sourceEntryId = isEntryDiceOutcome(outcome)
                ? outcome.entryId
                : plan.branchEntryIds?.get(pathCode)
              const nodeId = `proposal-${pathCode.toLowerCase()}`
              return sourceEntryId && nodeId !== recurringPlan.frozenGraphNodeId
                ? [{ sourceEntryId, nodeId }]
                : []
            }),
            ...conditions.map(([pathCode, { entryId }]) => ({
              sourceEntryId: entryId,
              nodeId: `proposal-${pathCode.toLowerCase()}${CONDITION_PROPOSAL_SUFFIX}`
            }))
          ]
        }
      : {})
  }
  return publishedGraph(definition)
}

/** Adds the output that stops the mover when the test resolves to `whenResultPath`. */
export function withMovementInterruption(
  published: ServerPublishedRuleDefinitionDto,
  whenResultPath: string
): ServerPublishedRuleDefinitionDto {
  const definition: RuleGraphDefinition = {
    ...published.definition,
    nodes: [
      ...published.definition.nodes,
      {
        id: 'movement-interruption',
        operation: {
          key: DND5E_MOVEMENT_INTERRUPTION_AUTHORIZATION_OPERATION_KEY,
          contractVersion: 1
        },
        inputs: {
          resultPath: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'resultPath' },
          authoredPath: { kind: 'LITERAL', value: whenResultPath }
        }
      }
    ],
    outputs: {
      ...published.definition.outputs,
      movementInterruption: {
        kind: 'NODE_OUTPUT',
        nodeId: 'movement-interruption',
        port: 'authorized'
      }
    }
  }
  return serverPublishedRuleDefinitionDtoSchema.parse({
    ...published,
    checksum: checksumRuleDocument(definition),
    definition
  })
}
