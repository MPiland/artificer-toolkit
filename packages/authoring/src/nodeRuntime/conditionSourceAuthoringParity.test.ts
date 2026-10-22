import { describe, expect, it } from 'vitest'

import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { adultRedDragon } from '@artificer-toolkit/source-data/srd/creatures/adult-red-dragon.js'
import { drow } from '@artificer-toolkit/source-data/srd/creatures/drow.js'
import { giantCentipede } from '@artificer-toolkit/source-data/srd/creatures/giant-centipede.js'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'
import { awaken } from '@artificer-toolkit/source-data/srd/spells/awaken.js'
import { colorSpray } from '@artificer-toolkit/source-data/srd/spells/color-spray.js'
import { contactOtherPlane } from '@artificer-toolkit/source-data/srd/spells/contact-other-plane.js'
import { fear } from '@artificer-toolkit/source-data/srd/spells/fear.js'
import { holdPerson } from '@artificer-toolkit/source-data/srd/spells/hold-person.js'
import { sleep } from '@artificer-toolkit/source-data/srd/spells/sleep.js'
import {
  SRD_CONDITION_TYPES,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

/** Every outcome of `effectKind` the value nests, wherever it sits. */
function outcomesOf(
  value: unknown,
  effectKind: 'CONDITION' | 'FOLLOW_UP_SAVE'
): Record<string, unknown>[] {
  if (typeof value !== 'object' || value === null) return []
  const own =
    'effectKind' in value && value.effectKind === effectKind
      ? [value as Record<string, unknown>]
      : []
  return [...own, ...Object.values(value).flatMap((entry) => outcomesOf(entry, effectKind))]
}

/** Equipment authoring the given effects: the effect list every owner shares. */
function equipmentWith(effects: unknown): EquipmentAuthored {
  return { ...structuredClone(caltropsBagOf20), effects } as EquipmentAuthored
}

function normalize(mapId: 'equipment' | 'creature', values: unknown) {
  return normalizeNodeRuntimeValues(reader, {
    mapId,
    systemId: srdSystemRecord.id,
    values: structuredClone(values) as Record<string, unknown>
  })
}

describe('a condition that records its source through the effect node map (SPELLS-29, ADR 0038)', () => {
  it('keeps the SRD Fear effect, whose Frightened records its caster, exactly as authored', async () => {
    expect(outcomesOf(fear.effects, 'CONDITION').map((outcome) => outcome.recordsSource)).toEqual([
      true
    ])
    const authored = equipmentWith(fear.effects)
    const result = await normalize('equipment', authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })

  it("keeps a dragon's Frightful Presence recording the dragon", async () => {
    expect(outcomesOf(adultRedDragon, 'CONDITION').map((outcome) => outcome.recordsSource)).toEqual(
      [true]
    )
    const result = await normalize('creature', adultRedDragon)
    expect(result.clearedPaths).toEqual([])
    expect(outcomesOf(result.values, 'CONDITION').map((outcome) => outcome.recordsSource)).toEqual([
      true
    ])
  })

  it('lets an author record the source of any condition, so a homebrew fear builds what the SRD does', async () => {
    const poisoned = SRD_CONDITION_TYPES.find((entry) => entry.code === 'POISONED')
    if (!poisoned) throw new Error('Missing Poisoned.')
    const effects = structuredClone(fear.effects)
    for (const outcome of outcomesOf(effects, 'CONDITION'))
      Object.assign(outcome, { conditionId: poisoned.id, recordsSource: true })
    const authored = equipmentWith(effects)
    const result = await normalize('equipment', authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })
})

describe('a repeat save attempted only by what the target perceives (SPELLS-29.T1a)', () => {
  const when = { kind: 'PERCEPTION', observer: 'TARGET', subject: 'SOURCE' } as const

  it("gates SRD Fear's repeat save on the target not seeing its caster", () => {
    expect(
      outcomesOf(fear.effects, 'FOLLOW_UP_SAVE').map((save) => save.repeatAttemptGate)
    ).toEqual([{ allow: 'WHEN_UNMET', when: { ...when, requirement: 'SEE' } }])
  })

  it('lets an author gate any repeated save from the same core options', async () => {
    const effects = structuredClone(holdPerson.effects)
    const saves = outcomesOf(effects, 'FOLLOW_UP_SAVE')
    expect(saves).toHaveLength(1)
    for (const save of saves)
      save.repeatAttemptGate = { allow: 'WHEN_MET', when: { ...when, requirement: 'DETECT' } }
    const authored = equipmentWith(effects)
    const result = await normalize('equipment', authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })
})

describe('a condition whose holder flees its source through the effect node map (SPELLS-29.T2)', () => {
  it('keeps SRD Fear, whose Frightened flees its caster, exactly as authored', async () => {
    expect(outcomesOf(fear.effects, 'CONDITION').map((outcome) => outcome.fleesSource)).toEqual([
      true
    ])
    const authored = equipmentWith(fear.effects)
    const result = await normalize('equipment', authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })

  it("leaves a dragon's Frightful Presence from fleeing", () => {
    expect(outcomesOf(adultRedDragon, 'CONDITION').map((outcome) => outcome.fleesSource)).toEqual([
      undefined
    ])
  })

  it('lets an author make any sourced condition flee, so a homebrew Panicked builds what Fear does', async () => {
    const poisoned = SRD_CONDITION_TYPES.find((entry) => entry.code === 'POISONED')
    if (!poisoned) throw new Error('Missing Poisoned.')
    const effects = structuredClone(fear.effects)
    for (const outcome of outcomesOf(effects, 'CONDITION'))
      Object.assign(outcome, { conditionId: poisoned.id, recordsSource: true, fleesSource: true })
    const authored = equipmentWith(effects)
    const result = await normalize('equipment', authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })

  it('clears fleesSource when the source is not recorded', async () => {
    const effects = structuredClone(fear.effects)
    for (const outcome of outcomesOf(effects, 'CONDITION')) outcome.recordsSource = false
    const result = await normalize('equipment', equipmentWith(effects))
    expect(
      outcomesOf(getValueAtPath(result.values, ['effects']), 'CONDITION').map(
        (outcome) => outcome.fleesSource
      )
    ).toEqual([undefined])
  })
})

describe('a hit-point pool that passes over conditions, and a condition counted on its caster’s turns (SPELLS-4.T2a1)', () => {
  it.each([
    ['Sleep', sleep],
    ['Color Spray', colorSpray],
    ['Awaken', awaken]
  ])('keeps the SRD %s effect exactly as authored', async (_name, spell) => {
    const authored = equipmentWith(spell.effects)
    const result = await normalize('equipment', authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })
})

describe('a self save whose failure holds a condition until a long rest (SPELLS-4.T2a1b)', () => {
  it('keeps the SRD Contact Other Plane effect, ending on a long rest, exactly as authored', async () => {
    const authored = equipmentWith(contactOtherPlane.effects)
    const result = await normalize('equipment', authored)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['effects'])).toEqual(authored.effects)
  })
})

describe('a timed condition in a gated band (SPELLS-33 T4i3e, D172)', () => {
  it('keeps the Giant Centipede’s poison for an hour and the paralysis that ends with it, as authored', async () => {
    const timed = outcomesOf(giantCentipede, 'CONDITION').filter((outcome) => outcome.duration)
    expect(timed).toHaveLength(2)
    const result = await normalize('creature', giantCentipede)
    expect(result.clearedPaths).toEqual([])
    expect(
      outcomesOf(result.values, 'CONDITION').map(({ duration, endsWithOutcomeId }) => ({
        duration,
        endsWithOutcomeId
      }))
    ).toEqual(timed.map(({ duration, endsWithOutcomeId }) => ({ duration, endsWithOutcomeId })))
  })
})

describe('a failure-margin rider that ends with its save’s condition (SPELLS-33 T4i3f, D172)', () => {
  it('keeps the Drow’s sleep naming the poison it ends with, as authored', async () => {
    const [save] = outcomesOf(drow, 'FOLLOW_UP_SAVE')
    expect(save?.failureMarginRider).toMatchObject({ endsWithOutcomeId: expect.any(String) })
    const result = await normalize('creature', drow)
    expect(result.clearedPaths).toEqual([])
    expect(outcomesOf(result.values, 'FOLLOW_UP_SAVE')[0]?.failureMarginRider).toEqual(
      save?.failureMarginRider
    )
  })
})
