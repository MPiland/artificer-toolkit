import { describe, expect, it } from 'vitest'
import type { MovementReactionEligibilityOutputDto } from '@artificer-toolkit/schema/shared/reaction'

import {
  ASSISTED_MOVEMENT_REACTION_CHOICE_DEFINITION_ID,
  organizeEncounterMovementReactionDecisions
} from '../encounterMovementReactionDecision.js'
import type { EvaluatedMovementReactionCandidate } from '../movementReactionEligibilityService.js'

const AUTHORED_CHOICE_DEFINITION_ID = '00000000-0000-4000-8000-0000000000c1'

function evaluated(input: {
  actionId: string
  reactorActorId: string
  eligible?: boolean
  selectionPolicy: MovementReactionEligibilityOutputDto['selectionPolicy']
}): EvaluatedMovementReactionCandidate {
  return {
    candidate: {
      contact: { x: 5, y: 0 },
      movingActorId: 'mover',
      pathDistance: 5,
      reactorActorId: input.reactorActorId,
      reactorTokenId: `${input.reactorActorId}-token`,
      sourceId: `${input.reactorActorId}-reach`,
      stage: 'BEFORE_LEAVE_REACH'
    },
    source: {
      binding: {
        kind: 'MOVEMENT',
        stage: 'BEFORE_LEAVE_REACH',
        perceptionRequirement: null,
        eligibilityDefinitionId: '00000000-0000-4000-8000-0000000000e1',
        movementInterruption: null
      },
      capability: { actionId: input.actionId, gameSystemId: 'system' }
    },
    policy: {
      eligible: input.eligible ?? true,
      allowanceDefinitionId: '00000000-0000-4000-8000-0000000000a1',
      allowanceMaximum: 1,
      allowanceRefreshBoundary: 'START_OF_TURN',
      selectionPolicy: input.selectionPolicy,
      choiceDefinitionId: input.selectionPolicy === 'CHOICE' ? AUTHORED_CHOICE_DEFINITION_ID : null,
      targetPolicy: 'MOVER'
    },
    evidence: { inputs: {}, outputs: {} }
  }
}

describe('assisted movement reaction decisions', () => {
  it('offers an authored automatic reaction to its controller as a Use/Decline choice', () => {
    const choiceGroups = organizeEncounterMovementReactionDecisions([
      evaluated({
        actionId: 'opportunity-attack',
        reactorActorId: 'guard',
        selectionPolicy: 'AUTOMATIC'
      })
    ])

    expect(choiceGroups).toHaveLength(1)
    expect(choiceGroups[0]).toMatchObject({ reactorActorId: 'guard', pathDistance: 5 })
    expect(choiceGroups[0]!.options[0]!.evaluated.policy).toMatchObject({
      selectionPolicy: 'CHOICE',
      choiceDefinitionId: ASSISTED_MOVEMENT_REACTION_CHOICE_DEFINITION_ID
    })
  })

  it('keeps an authored choice definition and drops ineligible reactions', () => {
    const choiceGroups = organizeEncounterMovementReactionDecisions([
      evaluated({ actionId: 'sentinel', reactorActorId: 'knight', selectionPolicy: 'CHOICE' }),
      evaluated({
        actionId: 'opportunity-attack',
        reactorActorId: 'spent-guard',
        eligible: false,
        selectionPolicy: 'AUTOMATIC'
      })
    ])

    expect(choiceGroups.map((group) => group.reactorActorId)).toEqual(['knight'])
    expect(choiceGroups[0]!.options[0]!.evaluated.policy.choiceDefinitionId).toBe(
      AUTHORED_CHOICE_DEFINITION_ID
    )
  })
})
