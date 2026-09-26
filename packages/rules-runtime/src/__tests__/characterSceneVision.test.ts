import type { PinnedSenseDefinition } from '@artificer-toolkit/schema/projections/characterMechanics'
import { SRD_SENSE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/senses.js'
import {
  SRD_BLINDSIGHT_SENSE_ID,
  SRD_DARKVISION_SENSE_ID,
  SRD_TREMORSENSE_SENSE_ID,
  SRD_TRUESIGHT_SENSE_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { deriveCharacterSceneVision } from '../character/characterSceneVision.js'

type Pin = Pick<PinnedSenseDefinition, 'document' | 'range'>
type Range = NonNullable<PinnedSenseDefinition['range']>

const characterId = '00000000-0000-4000-8000-000000000001'

function document(senseId: string): PinnedSenseDefinition['document'] {
  const definition = SRD_SENSE_DEFINITIONS.find((candidate) => candidate.id === senseId)
  if (!definition) throw new Error(`Missing SRD sense ${senseId}.`)
  return definition.document
}

function pin(senseId: string, amount: number | null, unit: Range['unit'] = 'FEET'): Pin {
  return {
    document: document(senseId),
    range:
      amount === null
        ? null
        : {
            id: `${senseId}:range`,
            amount,
            unit,
            calculation: { base: amount, effective: amount, contributions: [], override: null }
          }
  }
}

function dimRange(pins: readonly Pin[]) {
  return deriveCharacterSceneVision(characterId, pins).dimRange
}

describe('deriveCharacterSceneVision', () => {
  it('turns 60 ft darkvision into a 60 ft dim vision range for the Character', () => {
    expect(deriveCharacterSceneVision(characterId, [pin(SRD_DARKVISION_SENSE_ID, 60)])).toEqual({
      characterId,
      dimRange: { amount: 60, unit: 'FEET' }
    })
  })

  it('converts length units to feet and ignores a range that is not a length', () => {
    expect(dimRange([pin(SRD_DARKVISION_SENSE_ID, 20, 'YARDS')])).toEqual({
      amount: 60,
      unit: 'FEET'
    })
    expect(dimRange([pin(SRD_DARKVISION_SENSE_ID, 720, 'INCHES')])).toEqual({
      amount: 60,
      unit: 'FEET'
    })
    expect(dimRange([pin(SRD_DARKVISION_SENSE_ID, 1, 'MILES')])).toEqual({
      amount: 5_280,
      unit: 'FEET'
    })
    expect(dimRange([pin(SRD_DARKVISION_SENSE_ID, 60, 'POUNDS')])).toBeNull()
  })

  it('has no Scene vision without senses, without a range or with a zero range', () => {
    expect(deriveCharacterSceneVision(characterId, [])).toEqual({ characterId, dimRange: null })
    expect(dimRange([pin(SRD_DARKVISION_SENSE_ID, null)])).toBeNull()
    expect(dimRange([pin(SRD_DARKVISION_SENSE_ID, 0)])).toBeNull()
  })

  it('gives non-visual senses no Scene vision range', () => {
    // Blindsight is NONVISUAL and tremorsense is VIBRATION; neither draws a sight polygon.
    expect(dimRange([pin(SRD_BLINDSIGHT_SENSE_ID, 30)])).toBeNull()
    expect(dimRange([pin(SRD_TREMORSENSE_SENSE_ID, 60)])).toBeNull()
    expect(dimRange([pin(SRD_BLINDSIGHT_SENSE_ID, 120), pin(SRD_DARKVISION_SENSE_ID, 60)])).toEqual(
      { amount: 60, unit: 'FEET' }
    )
  })

  it('ignores visual capabilities that cannot see in darkness', () => {
    const darkvision = document(SRD_DARKVISION_SENSE_ID)
    const dimOnly: Pin = {
      ...pin(SRD_DARKVISION_SENSE_ID, 90),
      document: {
        ...darkvision,
        capabilities: darkvision.capabilities.map((capability) => ({
          ...capability,
          illuminationAccess: 'DIM' as const
        }))
      }
    }
    expect(dimRange([dimOnly])).toBeNull()
  })

  it('uses the longest qualifying visual range, including truesight', () => {
    expect(dimRange([pin(SRD_DARKVISION_SENSE_ID, 60), pin(SRD_TRUESIGHT_SENSE_ID, 120)])).toEqual({
      amount: 120,
      unit: 'FEET'
    })
    expect(dimRange([pin(SRD_TRUESIGHT_SENSE_ID, 30), pin(SRD_DARKVISION_SENSE_ID, 60)])).toEqual({
      amount: 60,
      unit: 'FEET'
    })
  })
})
