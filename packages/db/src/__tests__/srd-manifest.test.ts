import { describe, expect, it } from 'vitest'
import {
  SAVING_THROW_DC_BONUS_KIND,
  SAVING_THROW_DC_METHOD,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  type EffectAuthored
} from '@artificer-toolkit/shared'
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

type RecordLike = Record<string, unknown>

function isRecord(value: unknown): value is RecordLike {
  return typeof value === 'object' && value != null && !Array.isArray(value)
}

function collectEffects(value: unknown, seen = new WeakSet<object>()): EffectAuthored[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectEffects(item, seen))
  }

  if (!isRecord(value)) {
    return []
  }

  if (seen.has(value)) {
    return []
  }

  seen.add(value)

  if ('invocation' in value && 'paths' in value) {
    return [value as EffectAuthored]
  }

  return Object.values(value).flatMap((item) => collectEffects(item, seen))
}

function collectTargetingRecords(value: unknown, seen = new WeakSet<object>()): RecordLike[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectTargetingRecords(item, seen))
  }

  if (!isRecord(value)) {
    return []
  }

  if (seen.has(value)) {
    return []
  }

  seen.add(value)

  const selectionKind = value.selectionKind
  const isTargetingSelection = typeof selectionKind === 'string'
    && Object.values(TARGET_SELECTION_KIND).includes(selectionKind as keyof typeof TARGET_SELECTION_KIND)

  if (isTargetingSelection) {
    return [value]
  }

  return Object.values(value).flatMap((item) => collectTargetingRecords(item, seen))
}

function allSrdRecords() {
  return [
    ...srdClasses,
    ...srdRaces,
    ...srdBackgrounds,
    ...srdFeats,
    ...srdCreatures,
    ...srdSpells,
    ...srdVehicles
  ]
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
    expect(srdSpells.length).toBe(313)
  })

  it('models legendary action choices as feature options', () => {
    const legendaryActionFeatures = srdCreatures.flatMap((creature) => (creature.features ?? [])
      .filter((feature) => feature.label === 'Legendary Actions')
      .map((feature) => ({ creature, feature })))
    const adultBrassDragon = srdCreatures.find((creature) => creature.id === CREATURE_IDS.ADULT_BRASS_DRAGON)
    const adultBrassLegendaryActions = adultBrassDragon?.features?.find((feature) => feature.label === 'Legendary Actions')
    const adultBrassLegendaryResistance = adultBrassDragon?.features?.find((feature) => feature.label.startsWith('Legendary Resistance'))

    expect(legendaryActionFeatures.length).toBeGreaterThan(0)

    for (const { creature, feature } of legendaryActionFeatures) {
      expect(feature.options?.length ?? 0, `${creature.label} legendary action options`).toBeGreaterThan(0)
      expect(feature.effects, `${creature.label} feature-level legendary action effects`).toBeUndefined()
    }

    expect(adultBrassLegendaryActions?.options?.map((option) => option.label)).toEqual([
      'Detect',
      'Tail Attack',
      'Wing Attack (Costs 2 Actions)'
    ])
    expect(adultBrassLegendaryActions?.options?.find((option) => option.label === 'Tail Attack')?.effects?.length).toBeGreaterThan(0)
    expect(adultBrassLegendaryResistance).toBeDefined()
  })

  it('models Dragonborn breath weapon as a derived Constitution DC with explicit targeting eligibility', () => {
    const dragonborn = srdRaces.find((race) => race.id === RACE_IDS.DRAGONBORN)
    const blackAncestry = dragonborn && 'ancestry' in dragonborn
      ? dragonborn.ancestry?.options?.find((option) => option.label === 'Black (Acid)')
      : undefined
    const breathWeapon = blackAncestry?.features?.find((feature) => feature.label === 'Breath Weapon')
    const effect = breathWeapon?.effects?.[0]
    const savingThrow = effect?.invocation.triggerCode === 'SAVING_THROW'
      ? effect.invocation.savingThrow
      : undefined

    expect(effect?.invocation.targeting).toMatchObject({
      selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
      dispositionKind: TARGET_DISPOSITION_KIND.ANY
    })
    expect(savingThrow).toMatchObject({
      dcMethod: SAVING_THROW_DC_METHOD.DERIVED_DC,
      ability: 'DEXTERITY',
      baseDc: 8
    })
    expect(savingThrow?.dcMethod === SAVING_THROW_DC_METHOD.DERIVED_DC ? savingThrow.bonuses : []).toEqual([
      {
        id: expect.any(String),
        bonusKind: SAVING_THROW_DC_BONUS_KIND.ABILITY_MODIFIER,
        ability: 'CONSTITUTION'
      },
      {
        id: expect.any(String),
        bonusKind: SAVING_THROW_DC_BONUS_KIND.PROFICIENCY_BONUS
      }
    ])
  })

  it('declares target eligibility for every non-self SRD targeting record', () => {
    const missingEligibility = allSrdRecords().flatMap((record) => collectTargetingRecords(record)
      .filter((targeting) => targeting.selectionKind !== TARGET_SELECTION_KIND.SELF && targeting.dispositionKind == null)
      .map((targeting) => `${record.label}: ${String(targeting.selectionKind)}`))

    expect(missingEligibility).toEqual([])
  })

  it('uses printed fixed DCs for creature saving throws instead of inherited source save DCs', () => {
    const sourceDcCreatureEffects = srdCreatures.flatMap((creature) => collectEffects(creature)
      .filter((effect) => effect.invocation.triggerCode === 'SAVING_THROW'
        && effect.invocation.savingThrow.dcMethod === SAVING_THROW_DC_METHOD.SOURCE_SAVE_DC)
      .map((effect) => `${creature.label}: ${effect.id}`))

    expect(sourceDcCreatureEffects).toEqual([])
  })
})
