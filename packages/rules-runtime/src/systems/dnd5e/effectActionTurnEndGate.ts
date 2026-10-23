import type { ActiveRuleEffectDefinitionDto } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import type { CharacterRuleActionActiveEffectPlan } from '../../characterRuleActionSystemAdapter.js'
import {
  DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY,
  DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY,
  DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
  DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY,
  DND5E_SAVE_DC_FACT_KEY,
  DND5E_SAVE_MODIFIER_FACT_KEY,
  DND5E_TEST_OUTCOME_RULE_FACT_KEY,
  Dnd5eEffectActionCompilerError,
  unsupported
} from './effectActionContracts.js'
import { durationPublishedGraph } from './effectActionLifetime.js'
import { resolveDnd5eRollMode } from './rollModePolicy.js'

const GATE_REQUEST_NODE_ID = 'repeat-save-d20'

/**
 * The plan of a result block with a turn-end roll gate (D178): a recurring effect that rolls a bare
 * d20 at the end of the holder's turn, and the child it makes on a pass. The child holds the
 * authored removal from play until the holder's next turn starts, so the gate holds nothing else.
 */
export function turnEndGatePlan(input: {
  effectId: string
  entryId: string
  minimumRoll: number
  keepsTurn: boolean | undefined
  heldAlone: boolean
  initialRemaining: number | null
  lifecycle: CharacterRuleActionActiveEffectPlan['lifecycle']
}): Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'> {
  if (input.keepsTurn === undefined || !input.heldAlone || input.initialRemaining === null)
    unsupported('D&D turn-end roll gates one removal from play held for a timed duration.')
  return {
    authoredEffectId: input.effectId,
    compiledEntryId: input.entryId,
    frozenGraphNodeId: 'repeat-save-test',
    capabilityContractVersion: DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
    recurrenceStage: 'END_OF_TURN',
    initialRemaining: input.initialRemaining,
    adapterFacts: {
      [DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY]: GATE_REQUEST_NODE_ID,
      [DND5E_SAVE_DC_FACT_KEY]: input.minimumRoll
    },
    turnEndGate: {
      minimumRoll: input.minimumRoll,
      child: {
        frozenGraphNodeId: 'condition-duration',
        frozenGraph: durationPublishedGraph({
          effectId: input.effectId,
          plan: {
            compiledEntryId: input.entryId,
            frozenGraphNodeId: 'condition-duration',
            marginRiders: []
          }
        }),
        playAbsence: { keepsTurn: input.keepsTurn }
      }
    },
    lifecycle: input.lifecycle,
    perceptionContributions: [],
    maintenance: null,
    marginRiders: []
  }
}

/** The gate's d20 test: no ability, modifier or contributors, a total at or above the minimum passes. */
export function turnEndGateEvidenceBinding<Facts extends object>(
  definition: ActiveRuleEffectDefinitionDto,
  baseFacts: Facts
) {
  const { turnEndGate } = definition.recurrence
  const { adapterFacts } = definition
  const requestNodeId = adapterFacts[DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY]
  const dc = adapterFacts[DND5E_SAVE_DC_FACT_KEY]
  if (
    !turnEndGate ||
    adapterFacts[DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY] !== undefined ||
    requestNodeId !== GATE_REQUEST_NODE_ID ||
    dc !== turnEndGate.minimumRoll ||
    definition.frozenGraph.nodes.filter(
      (node) =>
        node.id === requestNodeId &&
        node.operation.key === 'evidence.integer-range' &&
        node.operation.contractVersion === 1
    ).length !== 1
  )
    throw new Dnd5eEffectActionCompilerError('D&D turn-end roll binding is invalid.')
  const contributorChecksum = checksumRuleDocument([])
  return {
    facts: {
      ...baseFacts,
      [DND5E_SAVE_MODIFIER_FACT_KEY]: 0,
      [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: contributorChecksum,
      [DND5E_TEST_OUTCOME_RULE_FACT_KEY]: 'NONE'
    },
    evidencePolicy: {
      requestNodeId,
      ...resolveDnd5eRollMode([]),
      contributors: [],
      contributorChecksum,
      modifier: 0,
      dc
    }
  }
}
