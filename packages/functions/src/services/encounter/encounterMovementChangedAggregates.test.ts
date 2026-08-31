import { describe, expect, it } from 'vitest'

import {
  movementCommandCharacterAggregateVersions,
  movementPendingCharacterAggregateVersions,
  terminalMovementChangedAggregates
} from './encounterMovementChangedAggregates.js'

const ids = {
  characterA: '00000000-0000-4000-8000-000000000001',
  characterB: '00000000-0000-4000-8000-000000000002',
  encounter: '00000000-0000-4000-8000-000000000003',
  scene: '00000000-0000-4000-8000-000000000004',
  command: '00000000-0000-4000-8000-000000000005'
}

describe('movement changed aggregates', () => {
  it('retains committed spatial-prefix and automatic-reaction Character transitions before a pause', () => {
    expect(
      movementPendingCharacterAggregateVersions({
        appliedSpatialPrefix: {
          status: 'BATCH_COMPLETE',
          batchKind: 'ENCOUNTER_SPATIAL_MOVEMENT',
          characterTransitions: [
            {
              characterId: ids.characterA,
              beforeStreamVersion: 1,
              afterStreamVersion: 2
            }
          ]
        } as never,
        reactionExecutions: [
          {
            characterTransitions: [
              {
                characterId: ids.characterA,
                beforeStreamVersion: 2,
                afterStreamVersion: 3
              },
              {
                characterId: ids.characterB,
                beforeStreamVersion: 4,
                afterStreamVersion: 5
              }
            ]
          }
        ] as never
      })
    ).toEqual([
      {
        aggregateId: ids.characterA,
        aggregateKind: 'CHARACTER',
        beforeVersion: 1,
        version: 3
      },
      {
        aggregateId: ids.characterB,
        aggregateKind: 'CHARACTER',
        beforeVersion: 4,
        version: 5
      }
    ])
  })

  it('retains each command-local spatial prefix and reaction transition exactly once', () => {
    expect(
      movementCommandCharacterAggregateVersions([
        {
          kind: 'SPATIAL_PREFIX',
          result: {
            status: 'BATCH_COMPLETE',
            batchKind: 'ENCOUNTER_SPATIAL_MOVEMENT',
            characterTransitions: [
              {
                characterId: ids.characterA,
                beforeStreamVersion: 1,
                afterStreamVersion: 2
              }
            ]
          } as never
        },
        {
          kind: 'REACTION',
          execution: {
            characterTransitions: [
              {
                characterId: ids.characterA,
                beforeStreamVersion: 2,
                afterStreamVersion: 3
              }
            ]
          } as never
        },
        {
          kind: 'SPATIAL_PREFIX',
          result: {
            status: 'BATCH_COMPLETE',
            batchKind: 'ENCOUNTER_SPATIAL_MOVEMENT',
            characterTransitions: [
              {
                characterId: ids.characterB,
                beforeStreamVersion: 4,
                afterStreamVersion: 5
              }
            ]
          } as never
        }
      ])
    ).toEqual([
      {
        aggregateId: ids.characterA,
        aggregateKind: 'CHARACTER',
        beforeVersion: 1,
        version: 3
      },
      {
        aggregateId: ids.characterB,
        aggregateKind: 'CHARACTER',
        beforeVersion: 4,
        version: 5
      }
    ])
  })

  it('does not republish cumulative continuation history when the current command settles nothing', () => {
    expect(movementCommandCharacterAggregateVersions([])).toEqual([])
  })

  it('retains the final reaction Character versions without reporting an unchanged Scene', () => {
    const result = {
      status: 'MOVEMENT_COMPLETE',
      encounterVersion: 7,
      sceneId: ids.scene,
      sceneVersion: 4,
      reactionExecutions: [
        {
          sourceCommandId: ids.command,
          characterTransitions: [
            {
              characterId: ids.characterA,
              beforeStreamVersion: 1,
              afterStreamVersion: 2
            },
            {
              characterId: ids.characterB,
              beforeStreamVersion: 4,
              afterStreamVersion: 5
            }
          ]
        },
        {
          sourceCommandId: ids.command,
          characterTransitions: [
            {
              characterId: ids.characterA,
              beforeStreamVersion: 2,
              afterStreamVersion: 3
            }
          ]
        }
      ]
    } as never

    expect(
      terminalMovementChangedAggregates({
        encounter: { id: ids.encounter },
        result,
        expectedEncounterVersion: 6,
        expectedSceneVersion: 4,
        sourceCommandId: ids.command
      })
    ).toEqual([
      {
        aggregateId: ids.characterA,
        aggregateKind: 'CHARACTER',
        beforeVersion: 1,
        version: 3
      },
      {
        aggregateId: ids.characterB,
        aggregateKind: 'CHARACTER',
        beforeVersion: 4,
        version: 5
      },
      {
        aggregateId: ids.encounter,
        aggregateKind: 'ENCOUNTER',
        beforeVersion: 6,
        version: 7
      }
    ])
  })

  it('deduplicates reaction and later spatial changes at the final Character version', () => {
    const result = {
      status: 'BATCH_COMPLETE',
      encounterVersion: 8,
      sceneId: ids.scene,
      sceneVersion: 5,
      reactionExecutions: [
        {
          sourceCommandId: ids.command,
          characterTransitions: [
            {
              characterId: ids.characterA,
              beforeStreamVersion: 1,
              afterStreamVersion: 2
            }
          ]
        }
      ],
      characterTransitions: [
        {
          characterId: ids.characterA,
          beforeStreamVersion: 2,
          afterStreamVersion: 3
        }
      ]
    } as never

    expect(
      terminalMovementChangedAggregates({
        encounter: { id: ids.encounter },
        result,
        expectedEncounterVersion: 7,
        expectedSceneVersion: 4,
        sourceCommandId: ids.command
      })
    ).toEqual([
      {
        aggregateId: ids.characterA,
        aggregateKind: 'CHARACTER',
        beforeVersion: 1,
        version: 3
      },
      {
        aggregateId: ids.encounter,
        aggregateKind: 'ENCOUNTER',
        beforeVersion: 7,
        version: 8
      },
      {
        aggregateId: ids.scene,
        aggregateKind: 'SCENE',
        beforeVersion: 4,
        version: 5
      }
    ])
  })
})
