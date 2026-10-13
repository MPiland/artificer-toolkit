import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { SRD_DARKVISION_SENSE_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { snapshotStatBlock } from '../encounterProjection.js'
import { srdCreatureActor, testUuid } from '../testing/dnd5eSrdEncounter.js'

const ogre = srdBaselineContent.subjects.creatures.find(({ label }) => label === 'Ogre')
if (!ogre) throw new Error('Missing SRD Ogre.')
const actor = srdCreatureActor({ id: testUuid(1), creature: ogre })

function withSenses(senses: unknown) {
  if (!actor.snapshot || !('payload' in actor.snapshot)) throw new Error('Missing snapshot.')
  return { ...actor, snapshot: { ...actor.snapshot, payload: { ...actor.snapshot.payload, senses } } }
}

describe('Creature snapshot senses', () => {
  it('reads the structured senses of the snapshot', () => {
    expect(snapshotStatBlock(actor)?.senses).toEqual([
      expect.objectContaining({
        senseDefinitionId: SRD_DARKVISION_SENSE_ID,
        range: expect.objectContaining({ rangeKind: 'DISTANCE', amount: 60, unit: 'FEET' })
      })
    ])
  })

  it('fails closed on a malformed sense instead of dropping it', () => {
    expect(() => snapshotStatBlock(withSenses([{ senseDefinitionId: SRD_DARKVISION_SENSE_ID }]))).toThrow()
    expect(() => snapshotStatBlock(withSenses(['darkvision 60 ft.']))).toThrow()
  })
})
