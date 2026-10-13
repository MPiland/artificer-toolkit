import type { PinnedSenseDefinition } from '@artificer-toolkit/schema/projections/characterMechanics'
import { SRD_SENSE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/senses.js'
import {
  SRD_BLINDSIGHT_SENSE_ID,
  SRD_DARKVISION_SENSE_ID,
  SRD_TREMORSENSE_SENSE_ID,
  SRD_TRUESIGHT_SENSE_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { createActorSensePinner, deriveActorSceneVision } from '../actorSenses.js'
import { currentConditionDefinition } from './srdConditionDefinitions.js'

type Pin = Pick<PinnedSenseDefinition, 'document' | 'range'> & { label: string }
type Range = Extract<PinnedSenseDefinition['range'], { rangeKind: 'DISTANCE' }>

const actorId = '00000000-0000-4000-8000-000000000001'

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
        ? { id: `${senseId}:range`, rangeKind: 'UNLIMITED' }
        : {
            id: `${senseId}:range`,
            rangeKind: 'DISTANCE',
            amount,
            unit,
            calculation: { base: amount, effective: amount, contributions: [], override: null }
          }
  }
}

function senses(pins: readonly Pin[]) {
  return deriveActorSceneVision(actorId, pins).senses
}

describe('createActorSensePinner', () => {
  const gameSystemId = currentConditionDefinition({
    ...definition(SRD_DARKVISION_SENSE_ID),
    definitionFamilyKey: 'sense'
  }).gameSystemId
  const reach = { rangeKind: 'DISTANCE' as const, id: 'range', amount: 60, unit: 'FEET' as const }

  function pinner(
    input: {
      vocabulary?: readonly string[]
      load?: (id: string) => ReturnType<typeof currentConditionDefinition> | null
    } = {}
  ) {
    const loads: string[] = []
    let systemLoads = 0
    const pin = createActorSensePinner({
      gameSystemId,
      loadSystem: async () => {
        systemLoads++
        return {
          senses: (input.vocabulary ?? [SRD_DARKVISION_SENSE_ID, SRD_BLINDSIGHT_SENSE_ID]).map(
            (id) => ({ id })
          )
        }
      },
      loadDefinition: async (id) => {
        loads.push(id)
        return input.load
          ? input.load(id)
          : currentConditionDefinition({ ...definition(id), definitionFamilyKey: 'sense' })
      }
    })
    return { pin, loads, systemLoads: () => systemLoads }
  }

  it('pins each Sense to its definition with the bare range as its calculation', async () => {
    const { pin } = pinner()
    const [pinned] = await pin([{ senseDefinitionId: SRD_DARKVISION_SENSE_ID, range: reach }])
    expect(pinned?.label).toBe('Darkvision')
    expect(pinned?.pin).toMatchObject({
      senseDefinitionId: SRD_DARKVISION_SENSE_ID,
      definitionVersion: 1,
      range: {
        ...reach,
        calculation: { base: 60, effective: 60, contributions: [], override: null }
      }
    })
  })

  it('loads the System and each definition once however many actors share a Sense', async () => {
    const { pin, loads, systemLoads } = pinner()
    const darkvision = { senseDefinitionId: SRD_DARKVISION_SENSE_ID, range: reach }
    await pin([darkvision])
    await pin([darkvision, { senseDefinitionId: SRD_BLINDSIGHT_SENSE_ID, range: reach }])
    await pin([darkvision])
    expect(loads).toEqual([SRD_DARKVISION_SENSE_ID, SRD_BLINDSIGHT_SENSE_ID])
    expect(systemLoads()).toBe(1)
  })

  it('pins nothing, and loads nothing, for an actor without Senses', async () => {
    const { pin, loads, systemLoads } = pinner()
    expect(await pin([])).toEqual([])
    expect(loads).toEqual([])
    expect(systemLoads()).toBe(0)
  })

  it('refuses a duplicate Sense, one outside the System vocabulary, and too many', async () => {
    const darkvision = { senseDefinitionId: SRD_DARKVISION_SENSE_ID, range: reach }
    await expect(pinner().pin([darkvision, darkvision])).rejects.toThrow(
      'Actor Sense is not a unique System vocabulary member.'
    )
    await expect(
      pinner({ vocabulary: [SRD_BLINDSIGHT_SENSE_ID] }).pin([darkvision])
    ).rejects.toThrow('Actor Sense is not a unique System vocabulary member.')
    await expect(
      pinner().pin(
        Array.from({ length: 101 }, (_, index) => ({
          senseDefinitionId: `sense-${index}`,
          range: reach
        }))
      )
    ).rejects.toThrow('Actor Sense limit exceeded.')
  })

  it('refuses a definition that is missing, of another family or System, or stale', async () => {
    const darkvision = { senseDefinitionId: SRD_DARKVISION_SENSE_ID, range: reach }
    const current = currentConditionDefinition({
      ...definition(SRD_DARKVISION_SENSE_ID),
      definitionFamilyKey: 'sense'
    })
    const refusal = (load: () => typeof current | null) =>
      expect(pinner({ load }).pin([darkvision])).rejects
    await refusal(() => null).toThrow('Actor Sense definition is unavailable.')
    await refusal(() => ({ ...current, definitionFamilyKey: 'condition' })).toThrow(
      'Actor Sense definition is unavailable.'
    )
    await refusal(() => ({
      ...current,
      gameSystemId: '00000000-0000-4000-8000-0000000000ff'
    })).toThrow('Actor Sense definition is unavailable.')
    await refusal(() => ({ ...current, checksum: '0'.repeat(64) })).toThrow(
      'Actor Sense definition does not match its current version.'
    )
  })
})

describe('deriveActorSceneVision', () => {
  it('presents 60 ft darkvision as a visual sense that sees ordinary darkness', () => {
    expect(deriveActorSceneVision(actorId, [pin(SRD_DARKVISION_SENSE_ID, 60)])).toEqual({
      actorId,
      senses: [
        {
          channel: 'VISUAL',
          illuminationAccess: 'ORDINARY_DARKNESS',
          label: 'Darkvision',
          range: { rangeKind: 'DISTANCE', amount: 60, unit: 'FEET' },
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
        feet: range.rangeKind === 'DISTANCE' ? range.amount : null
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
      rangeKind: 'DISTANCE',
      amount: 60,
      unit: 'FEET'
    })
    expect(senses([pin(SRD_DARKVISION_SENSE_ID, 720, 'INCHES')])[0]?.range).toEqual({
      rangeKind: 'DISTANCE',
      amount: 60,
      unit: 'FEET'
    })
    expect(senses([pin(SRD_DARKVISION_SENSE_ID, 1, 'MILES')])[0]?.range).toEqual({
      rangeKind: 'DISTANCE',
      amount: 5_280,
      unit: 'FEET'
    })
  })

  it('presents no sense for a zero range', () => {
    expect(deriveActorSceneVision(actorId, [])).toEqual({ actorId, senses: [] })
    expect(senses([pin(SRD_DARKVISION_SENSE_ID, 0)])).toEqual([])
  })

  it('presents an UNLIMITED pinned range as an unlimited Scene sense', () => {
    expect(senses([pin(SRD_DARKVISION_SENSE_ID, null)])).toEqual([
      expect.objectContaining({
        senseId: SRD_DARKVISION_SENSE_ID,
        range: { rangeKind: 'UNLIMITED' }
      })
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
