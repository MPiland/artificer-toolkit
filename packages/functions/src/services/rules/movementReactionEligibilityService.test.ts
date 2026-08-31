import { describe, expect, it, vi } from 'vitest'

import type { ResolvedRuleCapabilityStateDto } from '@artificer-toolkit/schema/shared/ruleState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import type { RulesRuntimeService } from './rulesRuntimeService.js'
import { evaluateMovementReactionEligibility } from './movementReactionEligibilityRegistry.js'
import {
  createDnd5eMovementReactionEligibilityDefinition,
  DND5E_ACTOR_ACTION_CAPABILITY_DEFINITION_ID,
  DND5E_REACTION_ALLOWANCE_DEFINITION_ID
} from './systems/dnd5e/reactionEligibilityPolicy.js'
import { createDnd5eCharacterActionRuntime } from './systems/dnd5e/characterActionRuntime.js'

const OCCURRENCE_ID = '00000000-0000-4000-8000-0000000000e1'
const DEFINITION_ID = '00000000-0000-4000-8000-0000000000e2'
const SYSTEM_ID = '00000000-0000-0000-0000-000000000001'
const ACTOR_ID = '00000000-0000-4000-8000-0000000000e3'
const MOVER_ID = '00000000-0000-4000-8000-0000000000e4'
const TOKEN_ID = '00000000-0000-4000-8000-0000000000e5'
const ACTION_ID = `${ACTOR_ID}:REACTION:${DEFINITION_ID}`
const CONTACT_SOURCE_ID = 'f'.repeat(64)

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

const definition = createDnd5eMovementReactionEligibilityDefinition({
  definitionId: DEFINITION_ID,
  stage: 'BEFORE_LEAVE_REACH'
})

function runtime(): RulesRuntimeService {
  return createDnd5eCharacterActionRuntime({
    continuationIntegrityKey: new Uint8Array(32).fill(9),
    definitions: {
      async requireCurrent(definitionId) {
        if (definitionId !== DEFINITION_ID) throw new Error('Definition not found.')
        return definition
      }
    }
  })
}

function entry(
  overrides: Partial<
    Parameters<typeof evaluateMovementReactionEligibility>[0]['candidates'][number]['facts']
  > = {}
) {
  return {
    candidate: {
      contact: { x: 10, y: 0 },
      movingActorId: MOVER_ID,
      pathDistance: 10,
      reactorActorId: ACTOR_ID,
      reactorTokenId: TOKEN_ID,
      sourceId: CONTACT_SOURCE_ID,
      stage: 'BEFORE_LEAVE_REACH' as const
    },
    contactSourceId: CONTACT_SOURCE_ID,
    source: {
      capability: { actionId: ACTION_ID, gameSystemId: SYSTEM_ID },
      binding: {
        kind: 'MOVEMENT' as const,
        stage: 'BEFORE_LEAVE_REACH' as const,
        perceptionRequirement: 'SEE' as const,
        eligibilityDefinitionId: DEFINITION_ID,
        movementInterruption: null
      }
    },
    facts: {
      capabilityState: availableCapabilityState(),
      perceptionSatisfied: true,
      relationshipKind: 'HOSTILE' as const,
      ruleUsage: {},
      ...overrides
    }
  }
}

describe('movement reaction eligibility service', () => {
  it('binds an exact contact to its UUID-selected System policy and retains private evidence', async () => {
    await expect(
      evaluateMovementReactionEligibility({
        runtime: runtime(),
        occurrenceId: OCCURRENCE_ID,
        movementKind: 'VOLUNTARY',
        candidates: [entry()]
      })
    ).resolves.toMatchObject([
      {
        candidate: { sourceId: CONTACT_SOURCE_ID },
        policy: {
          eligible: true,
          allowanceDefinitionId: DND5E_REACTION_ALLOWANCE_DEFINITION_ID,
          allowanceMaximum: 1,
          allowanceRefreshBoundary: 'START_OF_TURN',
          selectionPolicy: 'CHOICE',
          choiceDefinitionId: '00000000-0000-4000-8000-0000000000d3',
          targetPolicy: 'MOVER'
        },
        evidence: {
          source: { definitionId: DEFINITION_ID, gameSystemId: SYSTEM_ID }
        }
      }
    ])
  })

  it('retains an ineligible result rather than hiding the exact evaluated contact', async () => {
    const [result] = await evaluateMovementReactionEligibility({
      runtime: runtime(),
      occurrenceId: OCCURRENCE_ID,
      movementKind: 'VOLUNTARY',
      candidates: [entry({ perceptionSatisfied: false })]
    })
    expect(result?.policy.eligible).toBe(false)
  })

  it('rejects a mismatched contact before invoking the Rules Runtime', async () => {
    const execute = vi.fn()
    await expect(
      evaluateMovementReactionEligibility({
        runtime: { execute } as unknown as RulesRuntimeService,
        occurrenceId: OCCURRENCE_ID,
        movementKind: 'VOLUNTARY',
        candidates: [
          {
            ...entry(),
            candidate: { ...entry().candidate, sourceId: 'different-action' }
          }
        ]
      })
    ).rejects.toThrow('does not match its exact authored capability')
    expect(execute).not.toHaveBeenCalled()
  })
})
