import { describe, expect, it } from 'vitest'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { movementReactionChoiceGroupDtoSchema } from '../shared/reaction.js'
import {
  movementReactionResolutionCommandDtoSchema,
  serverRuleExecutionPendingApplicationContextDtoSchema
} from '../shared/rulesExecution.js'

const ACTOR_ID = '00000000-0000-4000-8000-000000000101'
const MOVER_ID = '00000000-0000-4000-8000-000000000102'
const TOKEN_ID = '00000000-0000-4000-8000-000000000103'
const CHARACTER_ID = '00000000-0000-4000-8000-000000000104'
const ELIGIBILITY_ID = '00000000-0000-4000-8000-000000000105'
const ALLOWANCE_ID = '00000000-0000-4000-8000-000000000106'
const CHOICE_DEFINITION_ID = '00000000-0000-4000-8000-000000000111'
const COMMAND_ID = '00000000-0000-4000-8000-000000000107'
const ENCOUNTER_ID = '00000000-0000-4000-8000-000000000108'
const SCENE_ID = '00000000-0000-4000-8000-000000000109'
const USER_ID = '00000000-0000-4000-8000-000000000110'

function option(actionId: string, optionId: string, contactSourceId = 'c'.repeat(64)) {
  return {
    optionId,
    contactSourceId,
    actionId,
    actionSourceKind: 'CHARACTER_ACTION' as const,
    actionSourceCurrentnessChecksum: 'a'.repeat(64),
    candidate: {
      contact: { x: 5, y: 0 },
      movingActorId: MOVER_ID,
      pathDistance: 5,
      reactorActorId: ACTOR_ID,
      reactorTokenId: TOKEN_ID,
      sourceId: contactSourceId,
      stage: 'BEFORE_LEAVE_REACH' as const
    },
    binding: {
      kind: 'MOVEMENT' as const,
      stage: 'BEFORE_LEAVE_REACH' as const,
      perceptionRequirement: 'SEE' as const,
      eligibilityDefinitionId: ELIGIBILITY_ID
    },
    policy: {
      eligible: true,
      allowanceDefinitionId: ALLOWANCE_ID,
      allowanceMaximum: 1,
      allowanceRefreshBoundary: 'START_OF_TURN' as const,
      selectionPolicy: 'CHOICE' as const,
      choiceDefinitionId: CHOICE_DEFINITION_ID,
      targetPolicy: 'MOVER' as const
    },
    eligibilityEvidenceChecksum: 'b'.repeat(64),
    authority: {
      kind: 'CHARACTER_CONTROLLER' as const,
      characterId: CHARACTER_ID
    },
    visibility: 'CONTROLLER' as const
  }
}

describe('movement reaction persisted choice contracts', () => {
  it('records Decline or one issued option as a closed movement occurrence resolution', () => {
    const command = {
      commandId: COMMAND_ID,
      commandFingerprint: '3'.repeat(64),
      actorUserId: USER_ID,
      correlationId: null,
      expectedOccurrenceVersion: 0
    }

    expect(
      movementReactionResolutionCommandDtoSchema.parse({
        ...command,
        kind: 'DECLINE'
      })
    ).toMatchObject({ kind: 'DECLINE' })
    expect(
      movementReactionResolutionCommandDtoSchema.parse({
        ...command,
        kind: 'OPTION',
        optionId: '1'.repeat(64)
      })
    ).toMatchObject({ kind: 'OPTION', optionId: '1'.repeat(64) })
    expect(
      movementReactionResolutionCommandDtoSchema.safeParse({
        ...command,
        kind: 'DECLINE',
        optionId: '1'.repeat(64)
      }).success
    ).toBe(false)
  })

  it('accepts a bounded canonical contact group whose index zero is implicitly Decline', () => {
    expect(
      movementReactionChoiceGroupDtoSchema.parse({
        pathDistance: 5,
        reactorActorId: ACTOR_ID,
        reactorTokenId: TOKEN_ID,
        options: [option('first', '1'.repeat(64)), option('second', '2'.repeat(64))]
      })
    ).toMatchObject({
      options: [{ actionId: 'first' }, { actionId: 'second' }]
    })
  })

  it('rejects mismatched contacts, duplicate identities, and noncanonical action order', () => {
    const first = option('second', '1'.repeat(64))
    const second = option('first', '1'.repeat(64), 'd'.repeat(64))
    expect(
      movementReactionChoiceGroupDtoSchema.safeParse({
        pathDistance: 6,
        reactorActorId: ACTOR_ID,
        reactorTokenId: TOKEN_ID,
        options: [first, second]
      }).success
    ).toBe(false)
  })

  it('rejects a contact whose source identity is detached from its choice option', () => {
    const detached = option('first', '1'.repeat(64))
    detached.candidate.sourceId = 'd'.repeat(64)

    expect(
      movementReactionChoiceGroupDtoSchema.safeParse({
        pathDistance: 5,
        reactorActorId: ACTOR_ID,
        reactorTokenId: TOKEN_ID,
        options: [detached]
      }).success
    ).toBe(false)
  })

  it('requires exactly one published choice definition only for choice policy', () => {
    const missingChoiceDefinition = option('first', '1'.repeat(64))
    missingChoiceDefinition.policy.choiceDefinitionId = null as never
    expect(
      movementReactionChoiceGroupDtoSchema.safeParse({
        pathDistance: 5,
        reactorActorId: ACTOR_ID,
        reactorTokenId: TOKEN_ID,
        options: [missingChoiceDefinition]
      }).success
    ).toBe(false)
  })

  it('retains one frozen movement timeline across choice and action-evidence phases', () => {
    const currentChoice = movementReactionChoiceGroupDtoSchema.parse({
      pathDistance: 5,
      reactorActorId: ACTOR_ID,
      reactorTokenId: TOKEN_ID,
      options: [option('first', '1'.repeat(64))]
    })
    const root = {
      commandId: COMMAND_ID,
      commandFingerprint: '3'.repeat(64),
      initiatorUserId: USER_ID,
      correlationId: null,
      encounterId: ENCOUNTER_ID,
      sceneId: SCENE_ID,
      tokenId: TOKEN_ID,
      expectedEncounterVersion: 2,
      expectedSceneVersion: 3,
      currentSceneVersion: 4,
      movementKind: 'VOLUNTARY' as const,
      originalPath: [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ],
      pathChecksum: checksumRuleDocument([
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ]),
      pathStartDistance: 5,
      currentPosition: { x: 5, y: 0 },
      resolutionCommands: []
    }
    const reactionTimeline = [{ kind: 'CONTROLLER_CHOICE' as const, group: currentChoice }]
    const common = {
      kind: 'ENCOUNTER_MOVEMENT_REACTION' as const,
      schemaVersion: 1 as const,
      root,
      spatialSelectionChecksum: '4'.repeat(64),
      spatialCurrentnessChecksum: '7'.repeat(64),
      reactionSelectionChecksum: checksumRuleDocument(reactionTimeline),
      completedSpatialExecutions: [],
      remainingSpatialCandidates: [],
      reactionTimeline
    }

    expect(
      serverRuleExecutionPendingApplicationContextDtoSchema.parse({
        ...common,
        phase: { kind: 'CHOICE' }
      })
    ).toMatchObject({ phase: { kind: 'CHOICE' } })
    expect(
      serverRuleExecutionPendingApplicationContextDtoSchema.parse({
        ...common,
        phase: {
          kind: 'ACTION_EVIDENCE',
          selectedOptionId: currentChoice.options[0]!.optionId,
          rollerActorId: ACTOR_ID,
          d20Policy: {
            requestNodeId: 'choice',
            rollMode: 'NORMAL',
            keep: 'FIRST',
            contributors: [],
            contributorChecksum: checksumRuleDocument([]),
            modifier: 0,
            dc: 10
          }
        }
      })
    ).toMatchObject({ phase: { kind: 'ACTION_EVIDENCE' } })
    expect(
      serverRuleExecutionPendingApplicationContextDtoSchema.safeParse({
        ...common,
        reactionSelectionChecksum: '5'.repeat(64),
        phase: {
          kind: 'ACTION_EVIDENCE',
          selectedOptionId: '6'.repeat(64),
          rollerActorId: ACTOR_ID,
          d20Policy: {
            requestNodeId: 'choice',
            rollMode: 'NORMAL',
            keep: 'FIRST',
            contributors: [],
            contributorChecksum: checksumRuleDocument([]),
            modifier: 0,
            dc: 10
          }
        }
      }).success
    ).toBe(false)
  })
})
