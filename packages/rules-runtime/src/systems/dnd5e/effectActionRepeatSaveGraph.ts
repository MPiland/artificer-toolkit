import type { ServerPublishedRuleDefinitionDto } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import type { RuleGraphDefinition } from '@artificer-toolkit/shared/rules'

import type { CharacterRuleActionActiveEffectPlan } from '../../characterRuleActionSystemAdapter.js'
import { dnd5eAddedDiceNode } from './d20AddedDiceGraph.js'
import { DND5E_SAVE_TEST_OPERATION_KEY } from './dnd5eTestOperationKeys.js'
import {
  DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY,
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  DND5E_REPEAT_SAVE_ATTEMPT_ALLOWED_FACT_KEY,
  DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY,
  DND5E_SAVE_DC_FACT_KEY,
  DND5E_SAVE_MODIFIER_FACT_KEY,
  DND5E_TARGET_ACTOR_FACT_KEY,
  DND5E_TEST_OUTCOME_RULE_FACT_KEY,
  Dnd5eEffectActionCompilerError,
  UUID,
  type Dnd5eCompiledEffectActionSource
} from './effectActionContracts.js'
import { publishedGraph } from './effectActionPublishedGraph.js'
import { repeatSaveGated } from './effectActionRepeatSaveEvidence.js'
import { DND5E_SYSTEM_ID } from './identity.js'

export function repeatFollowUpSavePublishedGraph(input: {
  action: Dnd5eCompiledEffectActionSource
  plan: Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'>
}): ServerPublishedRuleDefinitionDto {
  const abilityDefinitionId =
    input.plan.adapterFacts[DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY]
  // A turn-end gate rolls a bare d20 against its minimum, so it names no saving throw ability.
  if (
    !input.plan.turnEndGate &&
    (typeof abilityDefinitionId !== 'string' || !UUID.test(abilityDefinitionId))
  ) {
    throw new Dnd5eEffectActionCompilerError('D&D repeat-save facts are unavailable.')
  }
  // A gated repeat settles its d20 without a request on a turn the gate refuses the attempt.
  const gated = repeatSaveGated(input.plan.adapterFacts, input.plan.saveThresholds)
  const definition: RuleGraphDefinition = {
    schemaVersion: 1,
    id: input.action.effectId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes: [
      {
        id: 'repeat-save-d20',
        operation: {
          key: gated ? 'evidence.optional-integer-range' : 'evidence.integer-range',
          contractVersion: 1
        },
        inputs: {
          min: { kind: 'LITERAL', value: 1 },
          max: { kind: 'LITERAL', value: 20 },
          ...(gated
            ? {
                enabled: {
                  kind: 'FACT' as const,
                  factKey: DND5E_REPEAT_SAVE_ATTEMPT_ALLOWED_FACT_KEY
                }
              }
            : {})
        }
      },
      dnd5eAddedDiceNode('repeat-save-d20'),
      {
        id: input.plan.frozenGraphNodeId,
        operation: { key: DND5E_SAVE_TEST_OPERATION_KEY, contractVersion: 3 },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          naturalD20: {
            kind: 'NODE_OUTPUT',
            nodeId: 'repeat-save-d20',
            port: 'value'
          },
          addedTotal: {
            kind: 'NODE_OUTPUT',
            nodeId: 'repeat-save-d20-added-dice',
            port: 'value'
          },
          modifier: { kind: 'FACT', factKey: DND5E_SAVE_MODIFIER_FACT_KEY },
          threshold: { kind: 'FACT', factKey: DND5E_SAVE_DC_FACT_KEY },
          contributorChecksum: {
            kind: 'FACT',
            factKey: DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY
          },
          outcomeRule: { kind: 'FACT', factKey: DND5E_TEST_OUTCOME_RULE_FACT_KEY }
        }
      }
    ],
    outputs: {
      targetActorId: {
        kind: 'NODE_OUTPUT',
        nodeId: input.plan.frozenGraphNodeId,
        port: 'targetActorId'
      },
      naturalD20: {
        kind: 'NODE_OUTPUT',
        nodeId: input.plan.frozenGraphNodeId,
        port: 'naturalD20'
      },
      total: {
        kind: 'NODE_OUTPUT',
        nodeId: input.plan.frozenGraphNodeId,
        port: 'total'
      },
      resultPath: {
        kind: 'NODE_OUTPUT',
        nodeId: input.plan.frozenGraphNodeId,
        port: 'resultPath'
      },
      contributorChecksum: {
        kind: 'NODE_OUTPUT',
        nodeId: input.plan.frozenGraphNodeId,
        port: 'contributorChecksum'
      }
    },
    sourceEntryBindings: [
      {
        sourceEntryId: input.plan.compiledEntryId,
        nodeId: input.plan.frozenGraphNodeId
      }
    ]
  }
  return publishedGraph(definition)
}
