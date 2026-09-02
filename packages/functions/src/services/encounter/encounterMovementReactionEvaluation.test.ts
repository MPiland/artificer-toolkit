import { describe, expect, it, vi } from 'vitest'

import type { ResolvedRuleCapabilityStateDto } from '@artificer-toolkit/schema/shared/ruleState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import {
  createDnd5eMovementReactionEligibilityDefinition,
  DND5E_ACTOR_ACTION_CAPABILITY_DEFINITION_ID,
  DND5E_REACTION_ALLOWANCE_DEFINITION_ID
} from '../rules/systems/dnd5e/reactionEligibilityPolicy.js'
import { createDnd5eCharacterActionRuntime } from '../rules/systems/dnd5e/characterActionRuntime.js'
import { evaluateEncounterMovementReactionContacts } from './encounterMovementReactionEvaluation.js'
import type { EncounterMovementReactionSource } from './encounterMovementReactionSources.js'

const SYSTEM_ID = '00000000-0000-0000-0000-000000000001'
const OCCURRENCE_ID = '11111111-1111-4111-8111-111111111111'
const DEFINITION_ID = '22222222-2222-4222-8222-222222222222'
const REACTOR_ID = '33333333-3333-4333-8333-333333333333'
const REACTOR_TOKEN_ID = '44444444-4444-4444-8444-444444444444'
const MOVER_ID = '55555555-5555-4555-8555-555555555555'
const CONTACT_SOURCE_ID = 'a'.repeat(64)

function availableCapabilityState(): ResolvedRuleCapabilityStateDto {
  const capability = (
    id: string,
    usage: { maximum: number; refreshBoundary: 'START_OF_TURN' } | null
  ) => {
    const document = {
      schemaVersion: 1 as const,
      kind: 'RULE_CAPABILITY' as const,
      id,
      gameSystemId: SYSTEM_ID,
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
    gameSystemId: SYSTEM_ID,
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

function source(): EncounterMovementReactionSource {
  return {
    reactorActorId: REACTOR_ID,
    reactorTokenId: REACTOR_TOKEN_ID,
    range: {
      id: '66666666-6666-4666-8666-666666666666',
      rangeKind: 'DISTANCE',
      amount: 5,
      unit: 'FEET'
    },
    source: {
      binding: {
        kind: 'MOVEMENT',
        stage: 'BEFORE_LEAVE_REACH',
        perceptionRequirement: 'SEE',
        eligibilityDefinitionId: DEFINITION_ID,
        movementInterruption: null
      },
      capability: {
        actionId: `${REACTOR_ID}:reaction`,
        gameSystemId: SYSTEM_ID
      }
    },
    action: {
      kind: 'ENCOUNTER_FEATURE',
      actorId: REACTOR_ID,
      capability: {}
    } as unknown as EncounterMovementReactionSource['action']
  }
}

function contact() {
  const exactSource = source()
  return {
    candidate: {
      contact: { x: 5, y: 0 },
      movingActorId: MOVER_ID,
      pathDistance: 5,
      reactorActorId: REACTOR_ID,
      reactorTokenId: REACTOR_TOKEN_ID,
      sourceId: CONTACT_SOURCE_ID,
      stage: 'BEFORE_LEAVE_REACH' as const
    },
    contactSourceId: CONTACT_SOURCE_ID,
    source: exactSource
  }
}

describe('Encounter movement reaction evaluation', () => {
  it('binds locked actor state, relationship, and perception before System evaluation', async () => {
    const definition = createDnd5eMovementReactionEligibilityDefinition({
      definitionId: DEFINITION_ID,
      stage: 'BEFORE_LEAVE_REACH'
    })
    const runtime = createDnd5eCharacterActionRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(7),
      definitions: {
        async requireCurrent(definitionId) {
          if (definitionId !== DEFINITION_ID) throw new Error('missing')
          return definition
        }
      }
    })
    const lockRelationship = vi.fn(async () => 'HOSTILE' as const)
    const resolvePerception = vi.fn(async () => true)
    await expect(
      evaluateEncounterMovementReactionContacts({
        runtime,
        occurrenceId: OCCURRENCE_ID,
        movementKind: 'VOLUNTARY',
        contacts: [contact()],
        actorRuleStates: new Map([
          [REACTOR_ID, { capabilityState: availableCapabilityState(), ruleUsage: {} }]
        ]),
        lockRelationship,
        resolvePerception
      })
    ).resolves.toMatchObject([{ policy: { eligible: true } }])
    expect(lockRelationship).toHaveBeenCalledWith({
      reactorActorId: REACTOR_ID,
      movingActorId: MOVER_ID
    })
    expect(resolvePerception).toHaveBeenCalledOnce()
  })

  it('rejects an unlocked reactor before relationship, perception, or runtime work', async () => {
    const lockRelationship = vi.fn()
    const resolvePerception = vi.fn()
    const execute = vi.fn()
    await expect(
      evaluateEncounterMovementReactionContacts({
        runtime: { execute } as never,
        occurrenceId: OCCURRENCE_ID,
        movementKind: 'VOLUNTARY',
        contacts: [contact()],
        actorRuleStates: new Map(),
        lockRelationship,
        resolvePerception
      })
    ).rejects.toThrow('was not resolved under lock')
    expect(lockRelationship).not.toHaveBeenCalled()
    expect(resolvePerception).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
  })
})
