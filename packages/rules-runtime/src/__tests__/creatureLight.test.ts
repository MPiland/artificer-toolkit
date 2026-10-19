import { nightmare } from '@artificer-toolkit/source-data/srd/creatures/nightmare.js'
import { ogre } from '@artificer-toolkit/source-data/srd/creatures/ogre.js'
import { willOWisp } from '@artificer-toolkit/source-data/srd/creatures/will-o-wisp.js'
import { describe, expect, it } from 'vitest'

import { creatureEmittedLight, creatureTokenLights } from '../creatureLight.js'
import { srdCreatureActor, testUuid } from '../testing/dnd5eSrdEncounter.js'

const feet = (amount: number) => ({ amount, unit: 'FEET' })

describe('the light a Creature sheds from its authored MANIFEST light (SPELLS-33.T6j)', () => {
  it('reads the SRD Nightmare and Will-o’-wisp lights, dim outermost, and none for the Ogre', () => {
    const light = (creature: Parameters<typeof srdCreatureActor>[0]['creature']) =>
      creatureEmittedLight(srdCreatureActor({ id: testUuid(1), creature }))

    expect(light(nightmare)).toEqual({ bright: feet(10), dim: feet(20) })
    expect(light(willOWisp)).toEqual({ bright: feet(20), dim: feet(40) })
    expect(light(ogre)).toBeUndefined()
  })

  it('pairs each bound Creature that sheds light with its token', () => {
    const actors = [
      srdCreatureActor({ id: testUuid(1), creature: nightmare }),
      srdCreatureActor({ id: testUuid(2), creature: ogre })
    ]

    expect(
      creatureTokenLights(
        [
          { actorId: testUuid(1), tokenId: testUuid(11) },
          { actorId: testUuid(2), tokenId: testUuid(12) },
          { actorId: testUuid(3), tokenId: testUuid(13) }
        ],
        actors
      )
    ).toEqual([{ tokenId: testUuid(11), light: { bright: feet(10), dim: feet(20) } }])
  })
})
