import { describe, expect, it } from 'vitest'

import type { SceneGrid } from '@artificer-toolkit/shared/vtt'

import {
  collectEncounterMovementReactionContacts,
  type EncounterMovementReactionContactSource
} from '../encounterMovementReactionContacts.js'

const REACTOR_ACTOR_ID = '00000000-0000-4000-8000-00000000d001'
const REACTOR_TOKEN_ID = '00000000-0000-4000-8000-00000000d002'
const MOVER_TOKEN_ID = '00000000-0000-4000-8000-00000000d003'
const MOVER_ACTOR_ID = '00000000-0000-4000-8000-00000000d004'

const square = {
  kind: 'SQUARE',
  origin: { x: 0, y: 0 },
  cellSize: 100,
  distancePerCell: 5,
  diagonalPolicy: 'EQUAL'
} as const
const feetGrid: SceneGrid = { ...square, unit: 'FEET' }
const squaresGrid: SceneGrid = { ...square, unit: 'SQUARES' }

const tokens = [
  { id: REACTOR_TOKEN_ID, position: { x: 50, y: 50 }, width: 100, height: 100 },
  { id: MOVER_TOKEN_ID, position: { x: 150, y: 50 }, width: 100, height: 100 }
]

const distanceSource: EncounterMovementReactionContactSource = {
  reactorActorId: REACTOR_ACTOR_ID,
  reactorTokenId: REACTOR_TOKEN_ID,
  range: { id: 'opportunity-reach', rangeKind: 'DISTANCE', amount: 5, unit: 'FEET' },
  source: {
    capability: { actionId: 'opportunity-attack', gameSystemId: 'system' },
    binding: {
      kind: 'MOVEMENT',
      stage: 'BEFORE_LEAVE_REACH',
      perceptionRequirement: null,
      eligibilityDefinitionId: '00000000-0000-4000-8000-00000000d005',
      movementInterruption: null
    }
  }
}

function contactsOn(grid: SceneGrid) {
  return collectEncounterMovementReactionContacts({
    grid,
    movementKind: 'VOLUNTARY',
    movingTokenId: MOVER_TOKEN_ID,
    path: [
      { x: 150, y: 50 },
      { x: 450, y: 50 }
    ],
    actorIdByTokenId: new Map([
      [REACTOR_TOKEN_ID, REACTOR_ACTOR_ID],
      [MOVER_TOKEN_ID, MOVER_ACTOR_ID]
    ]),
    tokens,
    sources: [distanceSource]
  })
}

describe('Movement reaction contacts', () => {
  it('finds the contact of a distance reach on a calibrated Scene', () => {
    expect(contactsOn(feetGrid)).toHaveLength(1)
  })

  it('yields no contact for a distance reach on an uncalibrated SQUARES Scene', () => {
    expect(contactsOn(squaresGrid)).toEqual([])
  })
})
