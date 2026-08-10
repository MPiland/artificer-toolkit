import { describe, expect, it } from 'vitest'

import { DURATION_KIND } from '@artificer-toolkit/shared/core'
import { mapDurationToRow } from '../domains/shared/upserts/characteristic.js'

import { srdBaselineContent } from '../source-data/srd/index.js'
import {
  collectOptionReferences,
  collectStringReferencesByKey,
  collectInvalidEquipmentProficiencySelectors,
  collectDurationKinds,
  collectInvalidEffectPathCodes,
  collectNonIntegerShapeDimensionAmounts,
  collectOptionIds,
  stripHtml
} from './helpers/srdSourceDataHelpers.js'

const CREATURE_ABILITY_SCORE_KEYS = [
  'CHARISMA',
  'CONSTITUTION',
  'DEXTERITY',
  'INTELLIGENCE',
  'STRENGTH',
  'WISDOM'
] as const

describe('SRD source data', () => {
  it('does not include spells absent from the SRD PDF', () => {
    const removedSpellLabels = [
      'Compelled Duel',
      'Conjure Barrage',
      'Conjure Volley',
      'Crown of Madness',
      "Crusader's Mantle",
      'Dissonant Whispers',
      'Feign Death',
      'Grasping Vine',
      'Hex',
      'Hunger of Hadar',
      'Wrathful Smite'
    ]
    const spellLabels = new Set(srdBaselineContent.subjects.spells.map((spell) => spell.label))

    expect(removedSpellLabels.filter((label) => spellLabels.has(label))).toEqual([])
    expect(spellLabels.has('Contagion')).toBe(true)
  })

  it('only references creature type records that exist in the SRD system vocabulary', () => {
    const creatureTypeIds = new Set(
      srdBaselineContent.vocabulary.systems.flatMap((system) =>
        system.creatureTypes.map((creatureType) => creatureType.id)
      )
    )
    const referencedCreatureTypeIds: string[] = []

    collectStringReferencesByKey(srdBaselineContent, 'creatureTypeId', referencedCreatureTypeIds)

    expect([
      ...new Set(referencedCreatureTypeIds.filter((id) => !creatureTypeIds.has(id)))
    ]).toEqual([])
  })

  it('defines only the six SRD ability scores on creature stat blocks', () => {
    const invalidAbilityScoreKeys = srdBaselineContent.subjects.creatures.flatMap((creature) => {
      const keys = Object.keys(creature.abilityScores).sort()

      return keys.join(',') === CREATURE_ABILITY_SCORE_KEYS.join(',')
        ? []
        : [`${creature.label}: ${keys.join(', ')}`]
    })

    expect(invalidAbilityScoreKeys).toEqual([])
  })

  it('only references challenge rating records that exist in the SRD system vocabulary', () => {
    const challengeRatingIds = new Set(
      srdBaselineContent.vocabulary.systems.flatMap((system) =>
        system.challengeRatings.map((challengeRating) => challengeRating.id)
      )
    )
    const referencedChallengeRatingIds: string[] = []

    collectStringReferencesByKey(
      srdBaselineContent,
      'challengeRatingId',
      referencedChallengeRatingIds
    )

    expect([
      ...new Set(referencedChallengeRatingIds.filter((id) => !challengeRatingIds.has(id)))
    ]).toEqual([])
  })

  it('only references speed records that exist in the SRD system vocabulary', () => {
    const speedIds = new Set(
      srdBaselineContent.vocabulary.systems.flatMap((system) =>
        system.speeds.map((speed) => speed.id)
      )
    )
    const referencedSpeedIds: string[] = []

    collectStringReferencesByKey(srdBaselineContent, 'speedId', referencedSpeedIds)

    expect([...new Set(referencedSpeedIds.filter((id) => !speedIds.has(id)))]).toEqual([])
  })

  it('normalizes creature damageability references to SRD damage type IDs', () => {
    const damageTypeIds = new Set(
      srdBaselineContent.vocabulary.systems.flatMap((system) =>
        system.damageTypes.map((damageType) => damageType.id)
      )
    )
    const referencedDamageTypeIds = srdBaselineContent.subjects.creatures.flatMap((creature) => [
      ...(creature.damageResistances ?? []),
      ...(creature.damageImmunities ?? []),
      ...(creature.damageVulnerabilities ?? [])
    ])

    expect([...new Set(referencedDamageTypeIds.filter((id) => !damageTypeIds.has(id)))]).toEqual([])
  })

  it('normalizes creature condition immunities to SRD condition type IDs', () => {
    const conditionTypeIds = new Set(
      srdBaselineContent.vocabulary.systems.flatMap((system) =>
        system.conditionTypes.map((conditionType) => conditionType.id)
      )
    )
    const referencedConditionTypeIds = srdBaselineContent.subjects.creatures.flatMap(
      (creature) => creature.conditionImmunities ?? []
    )

    expect([
      ...new Set(referencedConditionTypeIds.filter((id) => !conditionTypeIds.has(id)))
    ]).toEqual([])
  })

  it('keeps legendary action prose tied to named options', () => {
    const missingLegendaryOptions = srdBaselineContent.subjects.creatures.flatMap((creature) =>
      (creature.features ?? [])
        .filter((feature) => feature.label === 'Legendary Actions')
        .filter((feature) => /options?\s+(listed\s+)?below/i.test(stripHtml(feature.description)))
        .filter((feature) => !feature.options?.length)
        .map(() => creature.label)
    )

    expect(missingLegendaryOptions).toEqual([])
  })

  it('only references option records that exist in the SRD bundle', () => {
    const optionIds = new Set<string>()
    const referencedOptionIds: string[] = []

    collectOptionIds(srdBaselineContent, optionIds)
    collectOptionReferences(srdBaselineContent, referencedOptionIds)

    expect([...new Set(referencedOptionIds.filter((id) => !optionIds.has(id)))]).toEqual([])
  })

  it('uses valid equipment proficiency selectors', () => {
    const invalidValues: string[] = []

    collectInvalidEquipmentProficiencySelectors(
      srdBaselineContent,
      'srdBaselineContent',
      invalidValues
    )

    expect(invalidValues).toEqual([])
  })

  it('keeps shared race ability score increases on the base race', () => {
    const racesByLabel = new Map(
      srdBaselineContent.subjects.races.map((race) => [race.label, race])
    )
    const abilityScoreIncreaseDescriptions = (label: string) =>
      racesByLabel
        .get(label)
        ?.features?.filter((feature) => feature.label === 'Ability Score Increase')
        .map((feature) => feature.description)

    expect(abilityScoreIncreaseDescriptions('Elf')).toEqual([
      'Your Dexterity score increases by 2.'
    ])
    expect(abilityScoreIncreaseDescriptions('High Elf')).toEqual([
      'Your Intelligence score increases by 1.'
    ])
    expect(abilityScoreIncreaseDescriptions('Dwarf')).toEqual([
      'Your Constitution score increases by 2.'
    ])
    expect(abilityScoreIncreaseDescriptions('Hill Dwarf')).toEqual([
      'Your Wisdom score increases by 1.'
    ])
  })

  it('uses duration kinds supported by normalized duration persistence', () => {
    const invalidValues: string[] = []

    collectDurationKinds(srdBaselineContent, 'srdBaselineContent', invalidValues)

    expect(invalidValues).toEqual([])
    expect(
      mapDurationToRow(
        {
          id: '00000000-0000-0000-0000-000000000001',
          durationKind: DURATION_KIND.UNTIL_DISPELLED
        },
        '00000000-0000-0000-0000-000000000001'
      )
    ).toMatchObject({
      kind: DURATION_KIND.UNTIL_DISPELLED,
      amount: null,
      scaling: null
    })
  })

  it('uses effect path codes supported by each invocation trigger', () => {
    const invalidValues: string[] = []

    collectInvalidEffectPathCodes(srdBaselineContent, 'srdBaselineContent', invalidValues)

    expect(invalidValues).toEqual([])
  })

  it('uses integer shape dimensions supported by normalized shape persistence', () => {
    const invalidValues: string[] = []

    collectNonIntegerShapeDimensionAmounts(srdBaselineContent, 'srdBaselineContent', invalidValues)

    expect(invalidValues).toEqual([])
  })
})
