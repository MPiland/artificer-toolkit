import { brownBear } from '@artificer-toolkit/source-data/srd/creatures/brown-bear.js'
import { dwarf } from '@artificer-toolkit/source-data/srd/races/dwarf.js'
import { SIZE_CODE } from '@artificer-toolkit/source-data/srd/sizes.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { SRD_SYSTEM_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { parsePublicationDocument } from '../authoredPublicationRead.js'
import { systemCoreCodeRegistry } from '../platformSystemCoreCodes.js'
import {
  defaultSize,
  requireAuthoredSizes,
  sceneSizes,
  sizeRank,
  sizeSpaceFeet
} from '../systemSizes.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'

const UNKNOWN_SYSTEM_ID = '00000000-0000-4000-8000-0000000000ff'

describe('System sizes', () => {
  it('lists the sizes the System defines, smallest first', () => {
    expect(systemCoreCodeRegistry.entries(DND5E_SYSTEM_ID, 'size').map(({ code }) => code)).toEqual(
      [
        'FINE',
        'DIMUNITIVE',
        'TINY',
        'SMALL',
        'MEDIUM',
        'LARGE',
        'HUGE',
        'GARGANTUAN',
        'GIANT',
        'COLOSSAL'
      ]
    )
    expect(systemCoreCodeRegistry.requireCode(DND5E_SYSTEM_ID, 'size', 'LARGE')).toEqual({
      code: 'LARGE',
      label: 'Large',
      description: 'Larger than humanoid.',
      spaceFeet: 10
    })
  })

  it('orders every size code from smallest to largest', () => {
    const ordered = systemCoreCodeRegistry.entries(DND5E_SYSTEM_ID, 'size').map(({ code }) => code)
    const ranks = ordered.map((code) => sizeRank(DND5E_SYSTEM_ID, code))
    expect(ranks.every((rank) => rank !== null)).toBe(true)
    expect(ranks).toEqual([...ranks].sort((left, right) => left! - right!))
    expect(new Set(ranks).size).toBe(ordered.length)
  })

  it('puts the SRD sizes one step apart', () => {
    expect(sizeRank(DND5E_SYSTEM_ID, 'LARGE')! - sizeRank(DND5E_SYSTEM_ID, 'MEDIUM')!).toBe(1)
    expect(sizeRank(DND5E_SYSTEM_ID, 'GARGANTUAN')! - sizeRank(DND5E_SYSTEM_ID, 'TINY')!).toBe(5)
  })

  it('defines every size the SRD content authors', () => {
    const codes = systemCoreCodeRegistry.entries(SRD_SYSTEM_ID, 'size').map(({ code }) => code)
    expect(Object.values(SIZE_CODE).filter((code) => !codes.includes(code))).toEqual([])
  })

  it('returns null for an unknown or missing size', () => {
    expect(sizeRank(DND5E_SYSTEM_ID, 'ENORMOUS')).toBeNull()
    expect(sizeRank(DND5E_SYSTEM_ID, null)).toBeNull()
    expect(sizeRank(DND5E_SYSTEM_ID, undefined)).toBeNull()
  })

  it('gives the edge of the square a creature of each size fills, and null for no size', () => {
    expect(sizeSpaceFeet(DND5E_SYSTEM_ID, 'TINY')).toBe(2.5)
    expect(sizeSpaceFeet(DND5E_SYSTEM_ID, 'MEDIUM')).toBe(5)
    expect(sizeSpaceFeet(DND5E_SYSTEM_ID, 'LARGE')).toBe(10)
    expect(sizeSpaceFeet(DND5E_SYSTEM_ID, 'GARGANTUAN')).toBe(20)
    expect(sizeSpaceFeet(DND5E_SYSTEM_ID, 'GIANT')).toBeNull()
    expect(sizeSpaceFeet(DND5E_SYSTEM_ID, undefined)).toBeNull()
    expect(sizeSpaceFeet(DND5E_SYSTEM_ID, 'toString')).toBeNull()
  })

  describe('on authored content', () => {
    const refusal = 'The Game System does not define the size "ENORMOUS".'
    const multiattack = {
      ...brownBear.features[0],
      attackSlots: {
        alternatives: [
          {
            slots: [
              {
                count: 1,
                fillers: [{ kind: 'ANY_ATTACK' as const }],
                condition: { kind: 'TARGET_SIZE_AT_MOST' as const, size: 'ENORMOUS' }
              }
            ]
          }
        ]
      }
    }

    it('accepts the SRD sizes', () => {
      for (const subject of [
        parsePublicationDocument('CREATURE', brownBear),
        parsePublicationDocument('RACE', dwarf),
        parsePublicationDocument('VEHICLE', cart)
      ])
        expect(() => requireAuthoredSizes(subject)).not.toThrow()
    })

    it('refuses a Creature size the System does not list', () => {
      const creature = parsePublicationDocument('CREATURE', { ...brownBear, size: 'ENORMOUS' })
      expect(() => requireAuthoredSizes(creature)).toThrow(refusal)
    })

    it('refuses a Race size the System does not list', () => {
      const race = parsePublicationDocument('RACE', { ...dwarf, size: 'ENORMOUS' })
      expect(() => requireAuthoredSizes(race)).toThrow(refusal)
    })

    it('refuses a Vehicle size the System does not list', () => {
      const vehicle = parsePublicationDocument('VEHICLE', { ...cart, size: 'ENORMOUS' })
      expect(() => requireAuthoredSizes(vehicle)).toThrow(refusal)
    })

    it('refuses an attack-slot size condition the System does not list', () => {
      const creature = parsePublicationDocument('CREATURE', {
        ...brownBear,
        features: [multiattack, ...brownBear.features.slice(1)]
      })
      expect(() => requireAuthoredSizes(creature)).toThrow(refusal)
    })
  })

  it('gives a new Creature or Race the System default size', () => {
    expect(defaultSize(DND5E_SYSTEM_ID)).toBe('MEDIUM')
  })

  it('lists the sizes that fill a space a Scene models', () => {
    expect(sceneSizes(DND5E_SYSTEM_ID).map(({ code }) => code)).toEqual([
      'TINY',
      'SMALL',
      'MEDIUM',
      'LARGE',
      'HUGE',
      'GARGANTUAN'
    ])
  })

  it('fails closed on a System with no sizes', () => {
    expect(() => defaultSize(UNKNOWN_SYSTEM_ID)).toThrow(
      'The Game System does not provide vocabulary policy.'
    )
    expect(() => sizeRank(UNKNOWN_SYSTEM_ID, 'MEDIUM')).toThrow(
      'The Game System does not provide vocabulary policy.'
    )
    expect(() => sizeSpaceFeet(UNKNOWN_SYSTEM_ID, 'MEDIUM')).toThrow(
      'The Game System does not provide vocabulary policy.'
    )
  })
})
