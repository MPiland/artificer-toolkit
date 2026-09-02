import { describe, expect, it } from 'vitest'

import {
  createEncounterMovementPassageChoice,
  resolveEncounterMovementPassageChoice
} from './encounterMovementPassageChoice.js'

const id = (tail: string) => `00000000-0000-4000-8000-000000000${tail}`
const checksum = (value: string) => value.repeat(64)

function movement() {
  const root = {
    commandId: id('001'),
    commandFingerprint: checksum('a'),
    initiatorUserId: id('002'),
    correlationId: null,
    encounterId: id('003'),
    sceneId: id('004'),
    tokenId: id('005'),
    expectedEncounterVersion: 2,
    expectedSceneVersion: 3,
    currentSceneVersion: 4,
    movementKind: 'VOLUNTARY' as const,
    originalPath: [
      { x: 0, y: 0 },
      { x: 3, y: 0 }
    ],
    pathChecksum: checksum('b'),
    pathStartDistance: 3,
    currentPosition: { x: 3, y: 0 },
    resolutionCommands: []
  }
  return {
    root,
    blockerActorId: id('006'),
    blockerTokenId: id('007'),
    contact: { x: 3, y: 0 },
    contactPathDistance: 3,
    blockerCurrentnessChecksum: checksum('c'),
    spatialSelectionChecksum: checksum('d'),
    spatialCurrentnessChecksum: checksum('e'),
    completedSpatialExecutions: [],
    appliedSpatialPrefix: null,
    completedReactionExecutions: [],
    remainingSpatialCandidates: [],
    reactionTimeline: []
  }
}

describe('Encounter movement passage choice', () => {
  it('seals sorted deterministic options and does not treat decline as a use', () => {
    const choice = createEncounterMovementPassageChoice({
      movement: movement(),
      sourceActorId: id('008'),
      sourceControllerCharacterId: id('009'),
      options: [
        {
          ruleKind: 'TUMBLE',
          economy: 'BONUS_ACTION',
          definitionId: id('010'),
          definitionVersion: 1,
          definitionChecksum: checksum('f'),
          moduleKey: 'scene.movement.tumble',
          moduleContractVersion: 1
        },
        {
          ruleKind: 'OVERRUN',
          economy: 'ACTION',
          definitionId: id('011'),
          definitionVersion: 1,
          definitionChecksum: checksum('0'),
          moduleKey: 'scene.movement.overrun',
          moduleContractVersion: 1
        }
      ]
    })
    expect(choice.options.map((option) => option.optionId)).toEqual(
      [...choice.options.map((option) => option.optionId)].sort()
    )
    expect(
      resolveEncounterMovementPassageChoice({ context: choice, selection: { kind: 'DECLINE' } })
    ).toEqual({ kind: 'DECLINED' })
    expect(() =>
      resolveEncounterMovementPassageChoice({
        context: choice,
        selection: { kind: 'OPTION', optionId: checksum('1') }
      })
    ).toThrow('unavailable')
  })
})
