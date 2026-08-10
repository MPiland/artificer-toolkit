import { describe, expect, it } from 'vitest'
import {
  compileBackground,
  compileClass,
  compileEquipment,
  compileFeat,
  compileRace,
  compileSpell,
  resolveRaceAuthored
} from '@artificer-toolkit/shared/compilers'
import { abilityScoreImprovementOptions } from '../source-data/srd/classes/mechanics.js'

import { srdBaselineContent } from '../source-data/srd/index.js'

describe('SRD source data', () => {
  it('builds every legal SRD ability score improvement choice', () => {
    const options = abilityScoreImprovementOptions(
      (entry) => `00000000-0000-0000-0000-${entry.toString().padStart(12, '0')}`,
      'SRD ability score improvement.'
    )

    expect(options).toHaveLength(21)
    expect(options.map((option) => option.label)).toEqual(
      expect.arrayContaining(['Strength +2', 'Strength +1, Dexterity +1', 'Wisdom +1, Charisma +1'])
    )
    expect(
      options.every((option) =>
        option.grants?.modifiers?.every(
          (modifier) =>
            modifier.payload !== undefined &&
            'valueKind' in modifier.payload &&
            modifier.payload.valueKind === 'FIXED' &&
            'amount' in modifier.payload &&
            [1, 2].includes(modifier.payload.amount)
        )
      )
    ).toBe(true)
  })

  it('compiles every background root', () => {
    for (const record of srdBaselineContent.subjects.backgrounds) {
      expect(compileBackground(record).id).toBe(record.id)
    }
  })

  it('keeps Shelter of the Faithful as an explicit external-world exception', () => {
    const entry = compileBackground(srdBaselineContent.subjects.backgrounds[0]!).features?.[0]
      ?.effects?.[0]?.entries[0]

    expect(entry && 'outcome' in entry ? entry.outcome : undefined).toMatchObject({
      effectKind: 'MANUAL_ADJUDICATION',
      label: 'Shelter of the Faithful',
      reasonCode: 'EXTERNAL_WORLD_STATE'
    })
  })

  it('compiles every class root', () => {
    for (const record of srdBaselineContent.subjects.classes) {
      expect(compileClass(record).id).toBe(record.id)
    }
  })

  it('compiles every equipment root', () => {
    for (const record of srdBaselineContent.subjects.equipment) {
      expect(compileEquipment(record).id).toBe(record.id)
    }
  })

  it('compiles both Grappler benefits as closed deterministic rules', () => {
    const compiled = compileFeat(srdBaselineContent.subjects.feats[0]!)
    const outcomes =
      compiled.features?.flatMap(
        (feature) =>
          feature.effects?.flatMap((effect) =>
            effect.entries.flatMap((entry) => ('outcome' in entry ? [entry.outcome] : []))
          ) ?? []
      ) ?? []

    expect(outcomes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          effectKind: 'CLOSED_RULE',
          ruleKind: 'GRAPPLER_ADVANTAGE_ON_GRAPPLED_TARGET'
        }),
        expect.objectContaining({ effectKind: 'CLOSED_RULE', ruleKind: 'GRAPPLER_PIN' })
      ])
    )
  })

  it('resolves inheritance and compiles every race root', () => {
    const racesById = new Map(
      srdBaselineContent.subjects.races.map((record) => [record.id, record])
    )

    for (const record of srdBaselineContent.subjects.races) {
      expect(compileRace(resolveRaceAuthored(record, (id) => racesById.get(id))).id).toBe(record.id)
    }
  })

  it('compiles every spell root', () => {
    for (const record of srdBaselineContent.subjects.spells) {
      expect(compileSpell(record).id).toBe(record.id)
    }
  })

  it('omits empty optional spell attribute collections', () => {
    const emptyAttributeSpells = srdBaselineContent.subjects.spells
      .filter((spell) => spell.attributes?.length === 0)
      .map((spell) => spell.label)

    expect(emptyAttributeSpells).toEqual([])
  })
})
