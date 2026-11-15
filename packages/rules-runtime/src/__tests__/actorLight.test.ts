import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { nightmare } from '@artificer-toolkit/source-data/srd/creatures/nightmare.js'
import { ogre } from '@artificer-toolkit/source-data/srd/creatures/ogre.js'
import { willOWisp } from '@artificer-toolkit/source-data/srd/creatures/will-o-wisp.js'
import { describe, expect, it } from 'vitest'

import { actorEmittedLight, actorTokenLights } from '../actorLight.js'
import { srdCreatureActor, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { activeEffect } from './encounterActiveEffectFixtures.js'

const feet = (amount: number) => ({ amount, unit: 'FEET' })

type Attachment = 'SOURCE' | 'PRIMARY_TARGET' | 'PLACED_SPACE' | 'TOUCHED_OBJECT' | null

/** A held object manifestation lit `bright` feet bright and `dimAdditional` more feet dim. */
function heldLight(
  seed: number,
  bright: number,
  dimAdditional: number,
  attachmentKind: Attachment = 'TOUCHED_OBJECT'
): ActiveRuleEffectRecord {
  return activeEffect({
    id: testUuid(0xc00 + seed),
    owner: { kind: 'CHARACTER', characterId: testUuid(0xc01) },
    createdOrdinal: seed,
    stateContributions: [
      {
        kind: 'OBJECT_MANIFESTATION',
        manifestationOutcomeId: testUuid(0xc10 + seed),
        label: 'Light',
        attachmentKind,
        light: { bright: feet(bright), dimAdditional: feet(dimAdditional) },
        properties: []
      }
    ]
  })
}

describe('the light an actor sheds from its authored MANIFEST light (SPELLS-33.T6j)', () => {
  it('reads the SRD Nightmare and Will-o’-wisp lights, dim outermost, and none for the Ogre', () => {
    const light = (creature: Parameters<typeof srdCreatureActor>[0]['creature']) =>
      actorEmittedLight(srdCreatureActor({ id: testUuid(1), creature }), [])

    expect(light(nightmare)).toEqual({ bright: feet(10), dim: feet(20) })
    expect(light(willOWisp)).toEqual({ bright: feet(20), dim: feet(40) })
    expect(light(ogre)).toBeUndefined()
  })

  it('pairs each bound actor that sheds light with its token', () => {
    const actors = [
      srdCreatureActor({ id: testUuid(1), creature: nightmare }),
      srdCreatureActor({ id: testUuid(2), creature: ogre })
    ]

    expect(
      actorTokenLights(
        [
          { actorId: testUuid(1), tokenId: testUuid(11) },
          { actorId: testUuid(2), tokenId: testUuid(12) },
          { actorId: testUuid(3), tokenId: testUuid(13) }
        ],
        actors,
        new Map()
      )
    ).toEqual([{ tokenId: testUuid(11), light: { bright: feet(10), dim: feet(20) } }])
  })
})

describe('the light an actor sheds from a held object manifestation (QUALITY-15.T3j2)', () => {
  const ogreActor = srdCreatureActor({ id: testUuid(2), creature: ogre })

  it('lights an actor with no light of its own from the object it holds', () => {
    expect(actorEmittedLight(ogreActor, [heldLight(1, 20, 20)])).toEqual({
      bright: feet(20),
      dim: feet(40)
    })
  })

  it('sheds the farthest-reaching of its own light and every light it holds', () => {
    const nightmareActor = srdCreatureActor({ id: testUuid(1), creature: nightmare })
    expect(actorEmittedLight(nightmareActor, [heldLight(1, 5, 5)])).toEqual({
      bright: feet(10),
      dim: feet(20)
    })
    expect(actorEmittedLight(nightmareActor, [heldLight(1, 5, 5), heldLight(2, 30, 10)])).toEqual({
      bright: feet(30),
      dim: feet(40)
    })
  })

  it('lights a token for an object held on it or on its target, never in a placed space', () => {
    for (const attachment of ['SOURCE', 'PRIMARY_TARGET', 'TOUCHED_OBJECT'] as const)
      expect(actorEmittedLight(ogreActor, [heldLight(1, 20, 20, attachment)])).toEqual({
        bright: feet(20),
        dim: feet(40)
      })
    expect(actorEmittedLight(ogreActor, [heldLight(1, 20, 20, 'PLACED_SPACE')])).toBeUndefined()
    expect(actorEmittedLight(ogreActor, [heldLight(1, 20, 20, null)])).toBeUndefined()
  })

  it('sheds nothing for a held object that gives no light', () => {
    const lightless = activeEffect({
      id: testUuid(0xc40),
      owner: { kind: 'CHARACTER', characterId: testUuid(0xc01) },
      createdOrdinal: 1,
      stateContributions: [
        {
          kind: 'OBJECT_MANIFESTATION',
          manifestationOutcomeId: testUuid(0xc41),
          label: 'Spectral Hand',
          attachmentKind: 'TOUCHED_OBJECT',
          light: null,
          properties: []
        }
      ]
    })
    expect(actorEmittedLight(ogreActor, [lightless])).toBeUndefined()
  })

  it('lights only the token of the actor whose effects hold the object', () => {
    const lit = srdCreatureActor({ id: testUuid(1), creature: ogre })
    expect(
      actorTokenLights(
        [
          { actorId: testUuid(1), tokenId: testUuid(11) },
          { actorId: testUuid(2), tokenId: testUuid(12) }
        ],
        [lit, ogreActor],
        new Map([[testUuid(1), [heldLight(1, 20, 20)]]])
      )
    ).toEqual([{ tokenId: testUuid(11), light: { bright: feet(20), dim: feet(40) } }])
  })
})
