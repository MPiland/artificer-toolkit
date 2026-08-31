import { describe, expect, it } from 'vitest'

import type { EvaluatedMovementReactionCandidate } from '../rules/movementReactionEligibilityService.js'
import {
  ASSISTED_MOVEMENT_REACTION_CHOICE_DEFINITION_ID,
  organizeEncounterMovementReactionDecisions
} from './encounterMovementReactionDecision.js'

const SYSTEM_ID = '00000000-0000-4000-8000-0000000000f1'
const ACTOR_A = '00000000-0000-4000-8000-0000000000f2'
const ACTOR_B = '00000000-0000-4000-8000-0000000000f3'
const TOKEN_A = '00000000-0000-4000-8000-0000000000f4'
const TOKEN_B = '00000000-0000-4000-8000-0000000000f5'

function entry(input: {
  actionId: string
  actorId?: string
  eligible?: boolean
  pathDistance?: number
  selectionPolicy?: 'AUTOMATIC' | 'CHOICE'
  tokenId?: string
}): EvaluatedMovementReactionCandidate {
  const actorId = input.actorId ?? ACTOR_A
  const tokenId = input.tokenId ?? TOKEN_A
  return {
    candidate: {
      contact: { x: input.pathDistance ?? 5, y: 0 },
      movingActorId: '00000000-0000-4000-8000-0000000000f6',
      pathDistance: input.pathDistance ?? 5,
      reactorActorId: actorId,
      reactorTokenId: tokenId,
      sourceId: `${input.actionId}:${tokenId}`,
      stage: 'BEFORE_LEAVE_REACH'
    },
    source: {
      binding: {
        kind: 'MOVEMENT',
        stage: 'BEFORE_LEAVE_REACH',
        perceptionRequirement: 'SEE',
        eligibilityDefinitionId: '00000000-0000-4000-8000-0000000000f7',
        movementInterruption: null
      },
      capability: { actionId: input.actionId, gameSystemId: SYSTEM_ID }
    },
    policy: {
      eligible: input.eligible ?? true,
      allowanceDefinitionId: '00000000-0000-4000-8000-0000000000f9',
      allowanceMaximum: 1,
      allowanceRefreshBoundary: 'START_OF_TURN',
      selectionPolicy: input.selectionPolicy ?? 'CHOICE',
      choiceDefinitionId:
        (input.selectionPolicy ?? 'CHOICE') === 'CHOICE'
          ? '00000000-0000-4000-8000-0000000000fa'
          : null,
      targetPolicy: 'MOVER'
    },
    evidence: {
      source: {
        definitionId: '00000000-0000-4000-8000-0000000000f7',
        gameSystemId: SYSTEM_ID,
        definitionFamilyKey: 'rules-runtime-graph',
        checksum: 'b'.repeat(64)
      },
      capabilityContractVersion: 1,
      facts: {},
      trace: [],
      outputs: {}
    }
  }
}

describe('Encounter movement reaction decision organization', () => {
  it('forms deterministic per-reactor contact choices and excludes ineligible candidates', () => {
    const organized = organizeEncounterMovementReactionDecisions([
      entry({ actionId: 'second' }),
      entry({ actionId: 'ignored', eligible: false }),
      entry({ actionId: 'first' }),
      entry({
        actionId: 'later',
        actorId: ACTOR_B,
        tokenId: TOKEN_B,
        pathDistance: 10
      })
    ])
    expect(organized.automatic).toEqual([])
    expect(organized.choiceGroups).toHaveLength(2)
    expect(
      organized.choiceGroups[0]?.options.map(
        (option) => option.evaluated.source.capability.actionId
      )
    ).toEqual(['first', 'second'])
    expect(organized.choiceGroups[1]).toMatchObject({
      pathDistance: 10,
      reactorActorId: ACTOR_B,
      reactorTokenId: TOKEN_B
    })
  })

  it('retains only explicitly System-authorized automatic candidates in the automatic lane', () => {
    const automatic = entry({
      actionId: 'automatic',
      selectionPolicy: 'AUTOMATIC'
    })
    const organized = organizeEncounterMovementReactionDecisions([
      entry({ actionId: 'choice' }),
      automatic
    ])
    expect(organized.automatic).toEqual([automatic])
    expect(organized.choiceGroups).toHaveLength(1)
  })

  it('converts automatic policies into the existing bounded choice lane for Assisted play', () => {
    const automatic = entry({
      actionId: 'automatic',
      selectionPolicy: 'AUTOMATIC'
    })
    const organized = organizeEncounterMovementReactionDecisions([automatic], 'ASSISTED')

    expect(organized.automatic).toEqual([])
    expect(organized.choiceGroups).toHaveLength(1)
    expect(organized.choiceGroups[0]?.options[0]?.evaluated.policy).toMatchObject({
      selectionPolicy: 'CHOICE',
      choiceDefinitionId: ASSISTED_MOVEMENT_REACTION_CHOICE_DEFINITION_ID
    })
  })

  it('uses one bounded choice wrapper for mixed System selection policies in Assisted play', () => {
    const organized = organizeEncounterMovementReactionDecisions(
      [
        entry({ actionId: 'automatic', selectionPolicy: 'AUTOMATIC' }),
        entry({ actionId: 'choice', selectionPolicy: 'CHOICE' })
      ],
      'ASSISTED'
    )

    expect(organized.choiceGroups[0]?.options).toHaveLength(2)
    expect(
      organized.choiceGroups[0]?.options.map((option) => option.evaluated.policy.choiceDefinitionId)
    ).toEqual([
      ASSISTED_MOVEMENT_REACTION_CHOICE_DEFINITION_ID,
      ASSISTED_MOVEMENT_REACTION_CHOICE_DEFINITION_ID
    ])
  })
})
