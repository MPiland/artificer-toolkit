import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { SceneGrid } from '@artificer-toolkit/shared/vtt'
import { wardingBond } from '@artificer-toolkit/source-data/srd/spells/warding-bond.js'
import { describe, expect, it } from 'vitest'

import { encounterEndedRelationships } from '../encounterRelationshipEnds.js'
import { plannedGrantEffect } from './antitoxinEffectFixture.js'
import { escapeGrappleEffectDefinition } from '../testing/escapeGrappleEffectFixture.js'

/** 100px cells of 5 feet; a Medium token fills one cell and is anchored at its center. */
const FEET_GRID: SceneGrid = {
  kind: 'SQUARE',
  cellSize: 100,
  diagonalPolicy: 'EQUAL',
  distancePerCell: 5,
  origin: { x: 0, y: 0 },
  unit: 'FEET'
}

const ENCOUNTER = '00000000-0000-4000-8000-000000000001'
const GRAPPLER = 'grappler'
const HELD = 'held'
const OTHER = 'other'

/** A one-cell token whose square is (column, row). */
const placed = (actorId: string, column: number, row = 0) => ({
  actorId,
  position: { x: column * 100 + 50, y: row * 100 + 50 },
  width: 100,
  height: 100,
  rotationDegrees: 0
})

/** The relationship effect `grapplerId` left on a held creature, sealed at the fixture's 5 feet. */
const hold = (id: string, grapplerId = GRAPPLER) => ({
  id,
  definition: escapeGrappleEffectDefinition({
    encounterId: ENCOUNTER,
    grapplerId,
    conditionIds: []
  })
})

function ended(input: {
  effects: [string, Pick<ActiveRuleEffectRecord, 'id' | 'definition'>[]][]
  tokens?: ReturnType<typeof placed>[] | null
  unable?: readonly string[]
}) {
  const asked: string[] = []
  return encounterEndedRelationships({
    activeEffectsByActorId: new Map(input.effects),
    scene: input.tokens === null ? null : { grid: FEET_GRID, tokens: input.tokens ?? [] },
    canAct: async (actorId) => {
      asked.push(actorId)
      return !input.unable?.includes(actorId)
    }
  }).then((ends) => ({ ends, asked }))
}

describe('a relationship ends on its own when its hold breaks (D152)', () => {
  it('keeps a hold whose source can act and whose held creature stands within the sealed reach', async () => {
    const { ends } = await ended({
      effects: [[HELD, [hold('effect')]]],
      tokens: [placed(GRAPPLER, 0), placed(HELD, 1)]
    })
    expect(ends).toEqual([])
  })

  it('ends a hold once the held creature stands beyond the sealed reach, without asking whether the source can act', async () => {
    const { ends, asked } = await ended({
      effects: [[HELD, [hold('effect')]]],
      tokens: [placed(GRAPPLER, 0), placed(HELD, 3)]
    })
    expect(ends).toEqual([{ sourceActorId: GRAPPLER, heldActorId: HELD, activeEffectId: 'effect' }])
    expect(asked).toEqual([])
  })

  it('ends every hold of a source that can no longer act, asking once', async () => {
    const { ends, asked } = await ended({
      effects: [
        [HELD, [hold('first')]],
        [OTHER, [hold('second')]]
      ],
      tokens: [placed(GRAPPLER, 0), placed(HELD, 1), placed(OTHER, 0, 1)],
      unable: [GRAPPLER]
    })
    expect(ends).toEqual([
      { sourceActorId: GRAPPLER, heldActorId: HELD, activeEffectId: 'first' },
      { sourceActorId: GRAPPLER, heldActorId: OTHER, activeEffectId: 'second' }
    ])
    expect(asked).toEqual([GRAPPLER])
  })

  it('does not measure a hold the Scene does not place, but still ends it when the source cannot act', async () => {
    const off = await ended({ effects: [[HELD, [hold('effect')]]], tokens: null })
    expect(off.ends).toEqual([])
    const unplaced = await ended({
      effects: [[HELD, [hold('effect')]]],
      tokens: [placed(HELD, 9)],
      unable: [GRAPPLER]
    })
    expect(unplaced.ends).toEqual([
      { sourceActorId: GRAPPLER, heldActorId: HELD, activeEffectId: 'effect' }
    ])
  })

  it('ends a bond whose authored separation limit its holder stands beyond, and only that', async () => {
    const bond = (id: string) =>
      plannedGrantEffect({
        id,
        holderActorId: HELD,
        effect: wardingBond.effects?.[0],
        sourceLabel: wardingBond.label,
        sourceActorId: GRAPPLER
      })
    const within = await ended({
      effects: [[HELD, [bond('bond')]]],
      tokens: [placed(GRAPPLER, 0), placed(HELD, 12)]
    })
    expect(within.ends).toEqual([])
    const beyond = await ended({
      effects: [[HELD, [bond('bond')]]],
      tokens: [placed(GRAPPLER, 0), placed(HELD, 13)]
    })
    expect(beyond.ends).toEqual([
      { sourceActorId: GRAPPLER, heldActorId: HELD, activeEffectId: 'bond' }
    ])
    const unplaced = await ended({ effects: [[HELD, [bond('bond')]]], tokens: null })
    expect(unplaced.ends).toEqual([])
  })

  it('ends only the broken hold of a source holding two creatures', async () => {
    const { ends } = await ended({
      effects: [
        [HELD, [hold('near')]],
        [OTHER, [hold('far')]]
      ],
      tokens: [placed(GRAPPLER, 0), placed(HELD, 1), placed(OTHER, 4)]
    })
    expect(ends).toEqual([{ sourceActorId: GRAPPLER, heldActorId: OTHER, activeEffectId: 'far' }])
  })
})
