import { describe, expect, it } from 'vitest'

import type { ResolvedRuleCapabilityStateDto } from '@artificer-toolkit/schema/shared/ruleState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { createDnd5eCharacterActionRuntime } from './characterActionRuntime.js'
import {
  createDnd5eMovementReactionEligibilityDefinition,
  createDnd5eMovementReactionChoiceDefinition,
  createDnd5eOpportunityReactionEligibilityDefinition,
  DND5E_ACTOR_ACTION_CAPABILITY_DEFINITION_ID,
  DND5E_MOVEMENT_REACTION_CHOICE_DEFINITION_ID,
  DND5E_MOVEMENT_REACTION_ELIGIBILITY_OPERATION_KEY,
  DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID,
  DND5E_REACTION_ALLOWANCE_AVAILABLE_FACT_KEY,
  DND5E_REACTION_ALLOWANCE_DEFINITION_ID,
  DND5E_REACTION_CONTACT_VALID_FACT_KEY,
  DND5E_REACTION_MOVEMENT_KIND_FACT_KEY,
  DND5E_REACTION_PERCEPTION_SATISFIED_FACT_KEY,
  DND5E_REACTION_REACTOR_CAN_ACT_FACT_KEY,
  DND5E_REACTION_STAGE_FACT_KEY,
  DND5E_REACTION_SUPPRESSED_FACT_KEY,
  DND5E_REACTION_TARGET_HOSTILE_FACT_KEY,
  dnd5eMovementReactionEligibilityAdapter,
  dnd5eMovementReactionEligibilityOperation
} from './reactionEligibilityPolicy.js'

const OCCURRENCE_ID = '00000000-0000-4000-8000-0000000000d3'
const ENTER_DEFINITION_ID = '00000000-0000-4000-8000-0000000000d4'

function availableCapabilityState(): ResolvedRuleCapabilityStateDto {
  const capability = (
    id: string,
    usage: { maximum: number; refreshBoundary: 'START_OF_TURN' } | null
  ) => {
    const document = {
      schemaVersion: 1 as const,
      kind: 'RULE_CAPABILITY' as const,
      id,
      gameSystemId: '00000000-0000-0000-0000-000000000001',
      usage
    }
    return {
      capability: {
        capabilityDefinitionId: id,
        definitionVersion: 1,
        definitionContractVersion: 1,
        definitionChecksum: checksumRuleDocument(document),
        document
      },
      available: true,
      suppressingConditionDefinitionIds: [],
      suppressingActiveEffectIds: [],
      contributionIds: []
    }
  }
  const unsigned = {
    schemaVersion: 1 as const,
    gameSystemId: '00000000-0000-0000-0000-000000000001',
    conditionDefinitions: [],
    capabilities: [
      capability(DND5E_REACTION_ALLOWANCE_DEFINITION_ID, {
        maximum: 1,
        refreshBoundary: 'START_OF_TURN'
      }),
      capability(DND5E_ACTOR_ACTION_CAPABILITY_DEFINITION_ID, null)
    ]
  }
  return { ...unsigned, checksum: checksumRuleDocument(unsigned) }
}

const eligibleInputs = {
  actualStage: 'BEFORE_LEAVE_REACH',
  expectedStage: 'BEFORE_LEAVE_REACH',
  movementKind: 'VOLUNTARY',
  contactValid: true,
  perceptionSatisfied: true,
  reactorCanAct: true,
  targetHostile: true,
  allowanceAvailable: true,
  suppressed: false
} as const

function facts(overrides: Partial<Record<string, string | boolean>> = {}) {
  return {
    [DND5E_REACTION_STAGE_FACT_KEY]: 'BEFORE_LEAVE_REACH',
    [DND5E_REACTION_MOVEMENT_KIND_FACT_KEY]: 'VOLUNTARY',
    [DND5E_REACTION_CONTACT_VALID_FACT_KEY]: true,
    [DND5E_REACTION_PERCEPTION_SATISFIED_FACT_KEY]: true,
    [DND5E_REACTION_REACTOR_CAN_ACT_FACT_KEY]: true,
    [DND5E_REACTION_TARGET_HOSTILE_FACT_KEY]: true,
    [DND5E_REACTION_ALLOWANCE_AVAILABLE_FACT_KEY]: true,
    [DND5E_REACTION_SUPPRESSED_FACT_KEY]: false,
    ...overrides
  }
}

describe('D&D movement-reaction eligibility policy', () => {
  it('accepts only an exact voluntary, perceptible, unsuppressed hostile reach contact', () => {
    expect(dnd5eMovementReactionEligibilityOperation.execute(eligibleInputs)).toEqual({
      eligible: true
    })

    for (const inputs of [
      { ...eligibleInputs, actualStage: 'ENTER_REACH' },
      { ...eligibleInputs, movementKind: 'FORCED' },
      { ...eligibleInputs, movementKind: 'TELEPORT' },
      { ...eligibleInputs, contactValid: false },
      { ...eligibleInputs, perceptionSatisfied: false },
      { ...eligibleInputs, reactorCanAct: false },
      { ...eligibleInputs, targetHostile: false },
      { ...eligibleInputs, allowanceAvailable: false },
      { ...eligibleInputs, suppressed: true }
    ]) {
      expect(dnd5eMovementReactionEligibilityOperation.execute(inputs)).toEqual({ eligible: false })
    }
  })

  it('rejects unknown lifecycle and movement facts instead of inferring policy', () => {
    expect(() =>
      dnd5eMovementReactionEligibilityOperation.execute({
        ...eligibleInputs,
        actualStage: 'UNKNOWN'
      })
    ).toThrow('Actual reaction stage is invalid')
    expect(() =>
      dnd5eMovementReactionEligibilityOperation.execute({
        ...eligibleInputs,
        movementKind: 'UNKNOWN'
      })
    ).toThrow('movement kind is invalid')
  })

  it('compiles and executes exact UUID-backed exit and entry definitions', async () => {
    const exitDefinition = createDnd5eOpportunityReactionEligibilityDefinition()
    const enterDefinition = createDnd5eMovementReactionEligibilityDefinition({
      definitionId: ENTER_DEFINITION_ID,
      stage: 'ENTER_REACH'
    })
    expect(exitDefinition).toMatchObject({
      id: DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID,
      definition: {
        nodes: [
          {
            operation: {
              key: DND5E_MOVEMENT_REACTION_ELIGIBILITY_OPERATION_KEY
            }
          }
        ]
      }
    })
    expect(exitDefinition.checksum).toBe(checksumRuleDocument(exitDefinition.definition))

    const runtime = createDnd5eCharacterActionRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(2),
      definitions: {
        async requireCurrent(definitionId) {
          if (definitionId === exitDefinition.id) return exitDefinition
          if (definitionId === enterDefinition.id) return enterDefinition
          throw new Error('Definition not found.')
        }
      }
    })

    await expect(
      runtime.execute({
        definitionId: exitDefinition.id,
        occurrenceId: OCCURRENCE_ID,
        facts: facts()
      })
    ).resolves.toMatchObject({
      status: 'COMPLETE',
      outputs: {
        eligible: true,
        allowanceDefinitionId: DND5E_REACTION_ALLOWANCE_DEFINITION_ID,
        allowanceMaximum: 1,
        allowanceRefreshBoundary: 'START_OF_TURN',
        selectionPolicy: 'CHOICE',
        choiceDefinitionId: DND5E_MOVEMENT_REACTION_CHOICE_DEFINITION_ID,
        targetPolicy: 'MOVER'
      }
    })

    await expect(
      runtime.execute({
        definitionId: enterDefinition.id,
        occurrenceId: '00000000-0000-4000-8000-0000000000d5',
        facts: facts({ [DND5E_REACTION_STAGE_FACT_KEY]: 'ENTER_REACH' })
      })
    ).resolves.toMatchObject({
      status: 'COMPLETE',
      outputs: { eligible: true }
    })

    await expect(
      dnd5eMovementReactionEligibilityAdapter.evaluate({
        runtime,
        occurrenceId: '00000000-0000-4000-8000-0000000000d6',
        movementKind: 'VOLUNTARY',
        candidate: {
          contact: { x: 5, y: 0 },
          movingActorId: '00000000-0000-4000-8000-0000000000d7',
          pathDistance: 5,
          reactorActorId: '00000000-0000-4000-8000-0000000000d8',
          reactorTokenId: '00000000-0000-4000-8000-0000000000d8',
          sourceId: 'contact-source',
          stage: 'BEFORE_LEAVE_REACH'
        },
        source: {
          binding: {
            kind: 'MOVEMENT',
            stage: 'BEFORE_LEAVE_REACH',
            perceptionRequirement: 'SEE',
            eligibilityDefinitionId: exitDefinition.id,
            movementInterruption: null
          },
          capability: {
            actionId: 'reaction-action',
            gameSystemId: exitDefinition.gameSystemId
          }
        },
        facts: {
          capabilityState: availableCapabilityState(),
          perceptionSatisfied: true,
          relationshipKind: 'HOSTILE',
          ruleUsage: { [DND5E_REACTION_ALLOWANCE_DEFINITION_ID]: 1 }
        }
      })
    ).resolves.toMatchObject({ policy: { eligible: false } })

    expect(createDnd5eMovementReactionChoiceDefinition()).toMatchObject({
      id: DND5E_MOVEMENT_REACTION_CHOICE_DEFINITION_ID,
      gameSystemId: exitDefinition.gameSystemId
    })
  })
})
