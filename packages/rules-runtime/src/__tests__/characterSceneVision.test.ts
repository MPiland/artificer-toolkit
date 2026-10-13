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

type Pin = Pick<PinnedSenseDefinition, 'document' | 'range'> & { label: string }
type Range = NonNullable<PinnedSenseDefinition['range']>

const characterId = '00000000-0000-4000-8000-000000000001'

function definition(senseId: string) {
  const found = SRD_SENSE_DEFINITIONS.find((candidate) => candidate.id === senseId)
  if (!found) throw new Error(`Missing SRD sense ${senseId}.`)
  return found
}

function pin(senseId: string, amount: number | null, unit: Range['unit'] = 'FEET'): Pin {
  const { document, label } = definition(senseId)
  return {
    document,
    label,
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

function senses(pins: readonly Pin[]) {
  return deriveCharacterSceneVision(characterId, pins).senses
}

describe('deriveCharacterSceneVision', () => {
  it('presents 60 ft darkvision as a visual sense that sees ordinary darkness', () => {
    expect(deriveCharacterSceneVision(characterId, [pin(SRD_DARKVISION_SENSE_ID, 60)])).toEqual({
      characterId,
      senses: [
        {
          channel: 'VISUAL',
          illuminationAccess: 'ORDINARY_DARKNESS',
          label: 'Darkvision',
          range: { amount: 60, unit: 'FEET' },
          senseId: SRD_DARKVISION_SENSE_ID
        }
      ]
    })
  })

  it('presents every ranged sense, not only the ones that see in darkness', () => {
    expect(
      senses([
        pin(SRD_DARKVISION_SENSE_ID, 60),
        pin(SRD_BLINDSIGHT_SENSE_ID, 30),
        pin(SRD_TREMORSENSE_SENSE_ID, 20),
        pin(SRD_TRUESIGHT_SENSE_ID, 120)
      ]).map(({ senseId, channel, illuminationAccess, range }) => ({
        senseId,
        channel,
        illuminationAccess,
        feet: range?.amount
      }))
    ).toEqual([
      {
        senseId: SRD_DARKVISION_SENSE_ID,
        channel: 'VISUAL',
        illuminationAccess: 'ORDINARY_DARKNESS',
        feet: 60
      },
      {
        senseId: SRD_BLINDSIGHT_SENSE_ID,
        channel: 'NONVISUAL',
        illuminationAccess: 'IGNORE',
        feet: 30
      },
      {
        senseId: SRD_TREMORSENSE_SENSE_ID,
        channel: 'VIBRATION',
        illuminationAccess: 'IGNORE',
        feet: 20
      },
      {
        senseId: SRD_TRUESIGHT_SENSE_ID,
        channel: 'VISUAL',
        illuminationAccess: 'MAGICAL_DARKNESS',
        feet: 120
      }
    ])
  })

  it('converts length units to feet', () => {
    expect(senses([pin(SRD_DARKVISION_SENSE_ID, 20, 'YARDS')])[0]?.range).toEqual({
      amount: 60,
      unit: 'FEET'
    })
    expect(senses([pin(SRD_DARKVISION_SENSE_ID, 720, 'INCHES')])[0]?.range).toEqual({
      amount: 60,
      unit: 'FEET'
    })
    expect(senses([pin(SRD_DARKVISION_SENSE_ID, 1, 'MILES')])[0]?.range).toEqual({
      amount: 5_280,
      unit: 'FEET'
    })
  })

  it('presents no sense for a zero range', () => {
    expect(deriveCharacterSceneVision(characterId, [])).toEqual({ characterId, senses: [] })
    expect(senses([pin(SRD_DARKVISION_SENSE_ID, 0)])).toEqual([])
  })

  it('presents a sense with no pinned range as unlimited', () => {
    expect(senses([pin(SRD_DARKVISION_SENSE_ID, null)])).toEqual([
      expect.objectContaining({ senseId: SRD_DARKVISION_SENSE_ID, range: null })
    ])
  })

  it('presents the strongest capability of a sense with several', () => {
    const darkvision = definition(SRD_DARKVISION_SENSE_ID)
    const [visual] = darkvision.document.capabilities
    if (!visual) throw new Error('Darkvision has no capability.')
    const multi = (...capabilities: (typeof visual)[]): Pin => ({
      ...pin(SRD_DARKVISION_SENSE_ID, 60),
      document: { ...darkvision.document, capabilities }
    })
    const keen = { ...visual, channel: 'AUDITORY' as const }
    const located = {
      ...visual,
      accessGrade: 'LOCATED' as const,
      satisfies: ['DETECT' as const, 'LOCATE' as const],
      illuminationAccess: 'IGNORE' as const
    }
    const dim = { ...visual, illuminationAccess: 'DIM' as const }
    const widerDarkness = { ...visual, illuminationAccess: 'MAGICAL_DARKNESS' as const }

    // Access grade first: the precise visual capability beats a wider located one.
    expect(senses([multi(located, visual)])[0]).toMatchObject({
      channel: 'VISUAL',
      illuminationAccess: 'ORDINARY_DARKNESS'
    })
    // Then the widest illumination access, regardless of listing order.
    expect(senses([multi(dim, widerDarkness, visual)])[0]).toMatchObject({
      illuminationAccess: 'MAGICAL_DARKNESS'
    })
    expect(senses([multi(widerDarkness, dim, visual)])[0]).toMatchObject({
      illuminationAccess: 'MAGICAL_DARKNESS'
    })
    // Then the first listed.
    expect(senses([multi(keen, visual)])[0]).toMatchObject({ channel: 'AUDITORY' })
    expect(senses([multi(visual, keen)])[0]).toMatchObject({ channel: 'VISUAL' })
  })
})
