import { describe, expect, it } from 'vitest'

import type { EncounterMovementReactionContactSource } from './encounterMovementReactionContacts.js'
import {
  collectEncounterMovementReactionContacts,
  movementReactionContactSourceId
} from './encounterMovementReactionContacts.js'

const REACTOR_ACTOR_ID = '00000000-0000-4000-8000-000000000201'
const REACTOR_TOKEN_ID = '00000000-0000-4000-8000-000000000202'
const MOVER_ACTOR_ID = '00000000-0000-4000-8000-000000000203'
const MOVER_TOKEN_ID = '00000000-0000-4000-8000-000000000204'
const DEFINITION_ID = '00000000-0000-4000-8000-000000000205'
const ACTION_ID = `${REACTOR_ACTOR_ID}:REACTION:${DEFINITION_ID}`

const grid = {
  kind: 'SQUARE' as const,
  origin: { x: 0, y: 0 },
  cellSize: 100,
  distancePerCell: 5,
  diagonalPolicy: 'EQUAL' as const,
  unit: 'FEET' as const
}

const tokens = [
  {
    actorId: REACTOR_ACTOR_ID,
    height: 100,
    id: REACTOR_TOKEN_ID,
    position: { x: 50, y: 50 },
    width: 100
  },
  {
    actorId: MOVER_ACTOR_ID,
    height: 100,
    id: MOVER_TOKEN_ID,
    position: { x: 150, y: 50 },
    width: 100
  }
]
const actorIdByTokenId = new Map([
  [REACTOR_TOKEN_ID, REACTOR_ACTOR_ID],
  [MOVER_TOKEN_ID, MOVER_ACTOR_ID]
])

function source(
  range: EncounterMovementReactionContactSource['range']
): EncounterMovementReactionContactSource {
  return {
    reactorActorId: REACTOR_ACTOR_ID,
    reactorTokenId: REACTOR_TOKEN_ID,
    range,
    source: {
      capability: {
        actionId: ACTION_ID,
        gameSystemId: '00000000-0000-0000-0000-000000000001'
      },
      binding: {
        kind: 'MOVEMENT',
        stage: 'BEFORE_LEAVE_REACH',
        perceptionRequirement: 'SEE',
        eligibilityDefinitionId: DEFINITION_ID,
        movementInterruption: null
      }
    }
  }
}

describe('Encounter movement reaction contacts', () => {
  it('converts normalized authored range and binds the full-footprint contact to its exact source', () => {
    const result = collectEncounterMovementReactionContacts({
      grid,
      actorIdByTokenId,
      movementKind: 'VOLUNTARY',
      movingTokenId: MOVER_TOKEN_ID,
      path: [
        { x: 150, y: 50 },
        { x: 350, y: 50 }
      ],
      tokens,
      sources: [source({ id: 'reach', rangeKind: 'DISTANCE', amount: 5, unit: 'FEET' })]
    })

    expect(result).toHaveLength(1)
    const contactSourceId = movementReactionContactSourceId({
      actionId: ACTION_ID,
      reactorActorId: REACTOR_ACTOR_ID,
      reactorTokenId: REACTOR_TOKEN_ID
    })
    expect(result[0]).toMatchObject({
      candidate: {
        movingActorId: MOVER_ACTOR_ID,
        reactorActorId: REACTOR_ACTOR_ID,
        sourceId: contactSourceId,
        stage: 'BEFORE_LEAVE_REACH'
      },
      contactSourceId,
      source: { source: { capability: { actionId: ACTION_ID } } }
    })
  })

  it('keeps identical actor actions distinct for multiple authoritative reactor tokens', () => {
    const secondTokenId = '00000000-0000-4000-8000-000000000206'
    const result = collectEncounterMovementReactionContacts({
      grid,
      actorIdByTokenId: new Map([...actorIdByTokenId, [secondTokenId, REACTOR_ACTOR_ID]]),
      movementKind: 'VOLUNTARY',
      movingTokenId: MOVER_TOKEN_ID,
      path: [
        { x: 150, y: 50 },
        { x: 350, y: 50 }
      ],
      tokens: [...tokens, { ...tokens[0]!, id: secondTokenId, position: { x: 50, y: 150 } }],
      sources: [
        source({ id: 'reach', rangeKind: 'DISTANCE', amount: 5, unit: 'FEET' }),
        {
          ...source({
            id: 'reach',
            rangeKind: 'DISTANCE',
            amount: 5,
            unit: 'FEET'
          }),
          reactorTokenId: secondTokenId
        }
      ]
    })

    expect(new Set(result.map((entry) => entry.contactSourceId)).size).toBe(result.length)
  })

  it('fails closed for a non-distance authored range', () => {
    expect(
      collectEncounterMovementReactionContacts({
        grid,
        actorIdByTokenId,
        movementKind: 'VOLUNTARY',
        movingTokenId: MOVER_TOKEN_ID,
        path: [
          { x: 150, y: 50 },
          { x: 350, y: 50 }
        ],
        tokens,
        sources: [source({ id: 'special', rangeKind: 'SPECIAL' })]
      })
    ).toEqual([])
  })

  it('rejects a stale reactor-token binding before geometry evaluation', () => {
    expect(() =>
      collectEncounterMovementReactionContacts({
        grid,
        actorIdByTokenId,
        movementKind: 'VOLUNTARY',
        movingTokenId: MOVER_TOKEN_ID,
        path: [
          { x: 150, y: 50 },
          { x: 350, y: 50 }
        ],
        tokens,
        sources: [
          {
            ...source({
              id: 'reach',
              rangeKind: 'DISTANCE',
              amount: 5,
              unit: 'FEET'
            }),
            reactorActorId: MOVER_ACTOR_ID
          }
        ]
      })
    ).toThrow('does not match its authoritative reactor token')
  })
})
