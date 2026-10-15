import { serverPublishedRuleDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import type { ResolvedRuleCapabilityAvailabilityDto } from '@artificer-toolkit/schema/shared/ruleState'
import {
  RULE_VALUE_KIND,
  type GameSystemRuleCapabilityContract,
  type PureRuleOperationContract,
  type RuleGraphDefinition,
  type RuleValue
} from '@artificer-toolkit/shared/rules'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import type {
  MovementReactionEligibilityAdapter,
  MovementReactionEligibilityFacts
} from '../../movementReactionEligibilityService.js'
import { createReactionChoiceDefinition } from '../../reactionChoiceDefinition.js'
import { RULE_RUNTIME_GRAPH_FAMILY_KEY } from '@artificer-toolkit/schema/shared/reusableDefinitionIdentity'
import { requireResolvedRuleCapabilityStateIntegrity } from '../../ruleCapabilityStateService.js'
import { DND5E_SYSTEM_ID, DND5E_REACTION_ALLOWANCE_DEFINITION_ID } from './identity.js'

export const DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID =
  '00000000-0000-4000-8000-0000000000d1'
export const DND5E_MOVEMENT_REACTION_CHOICE_DEFINITION_ID = '00000000-0000-4000-8000-0000000000d3'
export const DND5E_ACTOR_ACTION_CAPABILITY_DEFINITION_ID = '00000000-0000-4000-8000-0000000000d4'
const DND5E_MOVEMENT_REACTION_ELIGIBILITY_OPERATION_KEY = 'dnd5e.movement-reaction-eligibility'

const DND5E_REACTION_STAGE_FACT_KEY = 'dnd5e.reaction-stage'
const DND5E_REACTION_MOVEMENT_KIND_FACT_KEY = 'dnd5e.reaction-movement-kind'
const DND5E_REACTION_CONTACT_VALID_FACT_KEY = 'dnd5e.reaction-contact-valid'
const DND5E_REACTION_PERCEPTION_SATISFIED_FACT_KEY = 'dnd5e.reaction-perception-satisfied'
const DND5E_REACTION_REACTOR_CAN_ACT_FACT_KEY = 'dnd5e.reaction-reactor-can-act'
const DND5E_REACTION_TARGET_HOSTILE_FACT_KEY = 'dnd5e.reaction-target-hostile'
const DND5E_REACTION_ALLOWANCE_AVAILABLE_FACT_KEY = 'dnd5e.reaction-allowance-available'
const DND5E_REACTION_SUPPRESSED_FACT_KEY = 'dnd5e.reaction-suppressed'

type Dnd5eMovementReactionStage = 'BEFORE_LEAVE_REACH' | 'ENTER_REACH'

function requireBoolean(inputs: Readonly<Record<string, RuleValue>>, key: string): boolean {
  const value = inputs[key]
  if (typeof value !== 'boolean') throw new Error(`D&D reaction input "${key}" must be boolean.`)
  return value
}

function requireText(inputs: Readonly<Record<string, RuleValue>>, key: string): string {
  const value = inputs[key]
  if (typeof value !== 'string') throw new Error(`D&D reaction input "${key}" must be text.`)
  return value
}

function requireStage(value: string, label: string): Dnd5eMovementReactionStage {
  if (value !== 'BEFORE_LEAVE_REACH' && value !== 'ENTER_REACH') {
    throw new Error(`${label} is invalid.`)
  }
  return value
}

/**
 * D&D movement-reaction policy over authoritative factual inputs. Geometry,
 * perception, allegiance, actor state, allowance state, and suppression are
 * derived by their owning application/System seams before this operation runs.
 */
export const dnd5eMovementReactionEligibilityOperation: PureRuleOperationContract = {
  key: DND5E_MOVEMENT_REACTION_ELIGIBILITY_OPERATION_KEY,
  contractVersion: 1,
  executionKind: 'PURE',
  inputs: {
    actualStage: RULE_VALUE_KIND.TEXT,
    expectedStage: RULE_VALUE_KIND.TEXT,
    movementKind: RULE_VALUE_KIND.TEXT,
    contactValid: RULE_VALUE_KIND.BOOLEAN,
    perceptionSatisfied: RULE_VALUE_KIND.BOOLEAN,
    reactorCanAct: RULE_VALUE_KIND.BOOLEAN,
    targetHostile: RULE_VALUE_KIND.BOOLEAN,
    allowanceAvailable: RULE_VALUE_KIND.BOOLEAN,
    suppressed: RULE_VALUE_KIND.BOOLEAN
  },
  outputs: { eligible: RULE_VALUE_KIND.BOOLEAN },
  execute(inputs) {
    const actualStage = requireStage(requireText(inputs, 'actualStage'), 'Actual reaction stage')
    const expectedStage = requireStage(
      requireText(inputs, 'expectedStage'),
      'Expected reaction stage'
    )
    const movementKind = requireText(inputs, 'movementKind')
    if (movementKind !== 'VOLUNTARY' && movementKind !== 'FORCED' && movementKind !== 'TELEPORT') {
      throw new Error('D&D reaction movement kind is invalid.')
    }
    return {
      eligible:
        actualStage === expectedStage &&
        movementKind === 'VOLUNTARY' &&
        requireBoolean(inputs, 'contactValid') &&
        requireBoolean(inputs, 'perceptionSatisfied') &&
        requireBoolean(inputs, 'reactorCanAct') &&
        requireBoolean(inputs, 'targetHostile') &&
        requireBoolean(inputs, 'allowanceAvailable') &&
        !requireBoolean(inputs, 'suppressed')
    }
  }
}

export const dnd5eReactionEligibilityCapabilityContribution = {
  definitionFamilyKeys: [RULE_RUNTIME_GRAPH_FAMILY_KEY],
  factContracts: [
    { key: DND5E_REACTION_STAGE_FACT_KEY, valueKind: RULE_VALUE_KIND.TEXT },
    {
      key: DND5E_REACTION_MOVEMENT_KIND_FACT_KEY,
      valueKind: RULE_VALUE_KIND.TEXT
    },
    {
      key: DND5E_REACTION_CONTACT_VALID_FACT_KEY,
      valueKind: RULE_VALUE_KIND.BOOLEAN
    },
    {
      key: DND5E_REACTION_PERCEPTION_SATISFIED_FACT_KEY,
      valueKind: RULE_VALUE_KIND.BOOLEAN
    },
    {
      key: DND5E_REACTION_REACTOR_CAN_ACT_FACT_KEY,
      valueKind: RULE_VALUE_KIND.BOOLEAN
    },
    {
      key: DND5E_REACTION_TARGET_HOSTILE_FACT_KEY,
      valueKind: RULE_VALUE_KIND.BOOLEAN
    },
    {
      key: DND5E_REACTION_ALLOWANCE_AVAILABLE_FACT_KEY,
      valueKind: RULE_VALUE_KIND.BOOLEAN
    },
    {
      key: DND5E_REACTION_SUPPRESSED_FACT_KEY,
      valueKind: RULE_VALUE_KIND.BOOLEAN
    }
  ],
  operationContracts: [
    {
      key: DND5E_MOVEMENT_REACTION_ELIGIBILITY_OPERATION_KEY,
      contractVersion: 1
    }
  ]
} as const satisfies Pick<
  GameSystemRuleCapabilityContract,
  'definitionFamilyKeys' | 'factContracts' | 'operationContracts'
>

function dnd5eMovementReactionEligibilityFacts(input: {
  stage: Dnd5eMovementReactionStage
  movementKind: 'VOLUNTARY' | 'FORCED' | 'TELEPORT'
  facts: MovementReactionEligibilityFacts
}) {
  const capabilityState = requireResolvedRuleCapabilityStateIntegrity(input.facts.capabilityState)
  if (capabilityState.gameSystemId !== DND5E_SYSTEM_ID) {
    throw new Error('D&D reaction capability state integrity is invalid.')
  }
  const requireCapability = (definitionId: string): ResolvedRuleCapabilityAvailabilityDto => {
    const availability = capabilityState.capabilities.find(
      (candidate) => candidate.capability.capabilityDefinitionId === definitionId
    )
    if (
      !availability ||
      availability.capability.document.gameSystemId !== DND5E_SYSTEM_ID ||
      checksumRuleDocument(availability.capability.document) !==
        availability.capability.definitionChecksum
    ) {
      throw new Error('D&D reaction capability definition is unavailable or invalid.')
    }
    return availability
  }
  const actionCapability = requireCapability(DND5E_ACTOR_ACTION_CAPABILITY_DEFINITION_ID)
  const reactionCapability = requireCapability(DND5E_REACTION_ALLOWANCE_DEFINITION_ID)
  const allowancePolicy = reactionCapability.capability.document.usage
  if (!allowancePolicy) throw new Error('D&D reaction allowance usage policy is unavailable.')
  const allowanceUsed = input.facts.ruleUsage[DND5E_REACTION_ALLOWANCE_DEFINITION_ID] ?? 0
  if (!Number.isSafeInteger(allowanceUsed) || allowanceUsed < 0) {
    throw new Error('D&D reaction allowance usage is invalid.')
  }
  return {
    [DND5E_REACTION_STAGE_FACT_KEY]: input.stage,
    [DND5E_REACTION_MOVEMENT_KIND_FACT_KEY]: input.movementKind,
    [DND5E_REACTION_CONTACT_VALID_FACT_KEY]: true,
    [DND5E_REACTION_PERCEPTION_SATISFIED_FACT_KEY]: input.facts.perceptionSatisfied,
    [DND5E_REACTION_REACTOR_CAN_ACT_FACT_KEY]: actionCapability.available,
    [DND5E_REACTION_TARGET_HOSTILE_FACT_KEY]: input.facts.relationshipKind === 'HOSTILE',
    [DND5E_REACTION_ALLOWANCE_AVAILABLE_FACT_KEY]: allowanceUsed < allowancePolicy.maximum,
    [DND5E_REACTION_SUPPRESSED_FACT_KEY]: !reactionCapability.available
  }
}

export const dnd5eMovementReactionEligibilityAdapter: MovementReactionEligibilityAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  requiredCapabilityDefinitionIds: [
    DND5E_REACTION_ALLOWANCE_DEFINITION_ID,
    DND5E_ACTOR_ACTION_CAPABILITY_DEFINITION_ID
  ].sort(),
  async evaluate(input) {
    const result = await input.runtime.execute({
      definitionId: input.source.binding.eligibilityDefinitionId,
      occurrenceId: input.occurrenceId,
      facts: dnd5eMovementReactionEligibilityFacts({
        stage: input.candidate.stage,
        movementKind: input.movementKind,
        facts: input.facts
      })
    })
    if (result.status !== 'COMPLETE') {
      throw new Error('Movement reaction eligibility policy may not request evidence.')
    }
    return {
      policy: { ...result.outputs, choiceDefinitionId: result.outputs.choiceDefinitionId ?? null },
      evidence: result.evidence
    }
  }
}

/**
 * Creates one published D&D eligibility graph for an authored movement stage.
 * The definition identity is the authored binding; labels and feature names do
 * not participate in execution.
 */
export function createDnd5eMovementReactionEligibilityDefinition(input: {
  definitionId: string
  stage: Dnd5eMovementReactionStage
}) {
  const definition: RuleGraphDefinition = {
    schemaVersion: 1,
    id: input.definitionId,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: RULE_RUNTIME_GRAPH_FAMILY_KEY,
    nodes: [
      {
        id: 'eligibility',
        operation: {
          key: DND5E_MOVEMENT_REACTION_ELIGIBILITY_OPERATION_KEY,
          contractVersion: 1
        },
        inputs: {
          actualStage: { kind: 'FACT', factKey: DND5E_REACTION_STAGE_FACT_KEY },
          expectedStage: { kind: 'LITERAL', value: input.stage },
          movementKind: {
            kind: 'FACT',
            factKey: DND5E_REACTION_MOVEMENT_KIND_FACT_KEY
          },
          contactValid: {
            kind: 'FACT',
            factKey: DND5E_REACTION_CONTACT_VALID_FACT_KEY
          },
          perceptionSatisfied: {
            kind: 'FACT',
            factKey: DND5E_REACTION_PERCEPTION_SATISFIED_FACT_KEY
          },
          reactorCanAct: {
            kind: 'FACT',
            factKey: DND5E_REACTION_REACTOR_CAN_ACT_FACT_KEY
          },
          targetHostile: {
            kind: 'FACT',
            factKey: DND5E_REACTION_TARGET_HOSTILE_FACT_KEY
          },
          allowanceAvailable: {
            kind: 'FACT',
            factKey: DND5E_REACTION_ALLOWANCE_AVAILABLE_FACT_KEY
          },
          suppressed: {
            kind: 'FACT',
            factKey: DND5E_REACTION_SUPPRESSED_FACT_KEY
          }
        }
      }
    ],
    outputs: {
      eligible: {
        kind: 'NODE_OUTPUT',
        nodeId: 'eligibility',
        port: 'eligible'
      },
      allowanceDefinitionId: {
        kind: 'LITERAL',
        value: DND5E_REACTION_ALLOWANCE_DEFINITION_ID
      },
      allowanceMaximum: { kind: 'LITERAL', value: 1 },
      allowanceRefreshBoundary: { kind: 'LITERAL', value: 'START_OF_TURN' },
      selectionPolicy: { kind: 'LITERAL', value: 'CHOICE' },
      choiceDefinitionId: {
        kind: 'LITERAL',
        value: DND5E_MOVEMENT_REACTION_CHOICE_DEFINITION_ID
      },
      targetPolicy: { kind: 'LITERAL', value: 'MOVER' }
    }
  }
  return serverPublishedRuleDefinitionDtoSchema.parse({
    id: definition.id,
    gameSystemId: definition.gameSystemId,
    definitionFamilyKey: definition.definitionFamilyKey,
    checksum: checksumRuleDocument(definition),
    definition
  })
}

export function createDnd5eOpportunityReactionEligibilityDefinition() {
  return createDnd5eMovementReactionEligibilityDefinition({
    definitionId: DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID,
    stage: 'BEFORE_LEAVE_REACH'
  })
}

export function createDnd5eReactionChoiceDefinition() {
  return createReactionChoiceDefinition({
    definitionId: DND5E_MOVEMENT_REACTION_CHOICE_DEFINITION_ID,
    gameSystemId: DND5E_SYSTEM_ID
  })
}
