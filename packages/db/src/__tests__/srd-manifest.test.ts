import { describe, expect, it } from 'vitest'
import {
  BACKGROUND_IDS,
  CLASS_IDS,
  CREATURE_IDS,
  RACE_IDS,
  SPELL_IDS,
  SUBCLASS_IDS,
  SUBRACE_IDS,
  VEHICLE_IDS
} from '../source-data/srd/ids.js'
import { srdBackgrounds } from '../source-data/srd/backgrounds/index.js'
import { srdClasses } from '../source-data/srd/classes/index.js'
import { srdCreatures } from '../source-data/srd/creatures/index.js'
import { srdFeats } from '../source-data/srd/feats/index.js'
import { srdRaces } from '../source-data/srd/races/index.js'
import { srdSpells } from '../source-data/srd/spells/index.js'
import { srdVehicles } from '../source-data/srd/vehicles/index.js'

function expectUniqueIds(records: Array<{ id: string }>, label: string) {
  const ids = records.map((record) => record.id)
  expect(new Set(ids).size, `${label} contains duplicate ids`).toBe(ids.length)
}

describe('SRD manifest coverage', () => {
  it('keeps completed subject bundles aligned with the canonical manifest', () => {
    expect(srdClasses).toHaveLength(
      Object.keys(CLASS_IDS).length + Object.keys(SUBCLASS_IDS).length
    )
    expect(srdRaces).toHaveLength(
      Object.keys(RACE_IDS).length + Object.keys(SUBRACE_IDS).length
    )
    expect(srdBackgrounds).toHaveLength(Object.keys(BACKGROUND_IDS).length)
    expect(srdFeats).toHaveLength(1)
    expect(srdCreatures).toHaveLength(Object.keys(CREATURE_IDS).length)
    expect(srdVehicles).toHaveLength(Object.keys(VEHICLE_IDS).length)
  })

  it('keeps completed subject bundle ids unique and in-manifest', () => {
    expectUniqueIds(srdClasses, 'srdClasses')
    expectUniqueIds(srdRaces, 'srdRaces')
    expectUniqueIds(srdBackgrounds, 'srdBackgrounds')
    expectUniqueIds(srdFeats, 'srdFeats')
    expectUniqueIds(srdCreatures, 'srdCreatures')
    expectUniqueIds(srdVehicles, 'srdVehicles')

    const allowedClassIds = new Set([
      ...Object.values(CLASS_IDS),
      ...Object.values(SUBCLASS_IDS)
    ])
    const allowedRaceIds = new Set([
      ...Object.values(RACE_IDS),
      ...Object.values(SUBRACE_IDS)
    ])
    const allowedBackgroundIds = new Set(Object.values(BACKGROUND_IDS))
    const allowedCreatureIds = new Set(Object.values(CREATURE_IDS))
    const allowedVehicleIds = new Set(Object.values(VEHICLE_IDS))

    expect(srdClasses.every((record) => allowedClassIds.has(record.id))).toBe(true)
    expect(srdRaces.every((record) => allowedRaceIds.has(record.id))).toBe(true)
    expect(srdBackgrounds.every((record) => allowedBackgroundIds.has(record.id))).toBe(true)
    expect(srdCreatures.every((record) => allowedCreatureIds.has(record.id))).toBe(true)
    expect(srdVehicles.every((record) => allowedVehicleIds.has(record.id))).toBe(true)
  })

  it('keeps spell coverage aligned with the corrected SRD spell manifest', () => {
    expectUniqueIds(srdSpells, 'srdSpells')
    expect(srdSpells.every((record) => Object.values(SPELL_IDS).includes(record.id))).toBe(true)
    expect(srdSpells).toHaveLength(Object.keys(SPELL_IDS).length)
    expect(srdSpells.length).toBe(324)
  })
})
