import { describe, expect, it } from 'vitest'

import {
  AUTHORING_MODE_KIND,
  CLASS_CATEGORY,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  FEATURE_ATTRIBUTE,
  SCALING_AMOUNT_KIND
} from '@artificer-toolkit/shared/core'
import { srdBaselineContent } from '../source-data/srd/index.js'
import {
  collectEquipmentReferences,
  collectGrantedRecordsWithCounts,
  getSrdEquipment,
  getSrdClass
} from './helpers/srdSourceDataHelpers.js'

describe('SRD source data', () => {
  it('only references equipment records that exist in the SRD equipment bundle', () => {
    const equipmentIds = new Set(
      srdBaselineContent.subjects.equipment.map((equipment) => equipment.id)
    )
    const referencedEquipmentIds: string[] = []

    collectEquipmentReferences(srdBaselineContent, referencedEquipmentIds)

    expect([...new Set(referencedEquipmentIds.filter((id) => !equipmentIds.has(id)))]).toEqual([])
  })

  it('defines Barbarian starting equipment choices', () => {
    const barbarian = getSrdClass('Barbarian')

    expect(barbarian.category).toBe(CLASS_CATEGORY.BASE)
    if (barbarian.category !== CLASS_CATEGORY.BASE) {
      throw new Error('Expected Barbarian to be a base class.')
    }

    const [weaponGroup, secondaryWeaponGroup, fixedGearGroup] =
      barbarian.startingEquipment.sets.flatMap((set) => set.groups)

    expect(weaponGroup?.options).toHaveLength(2)
    expect(weaponGroup?.options[0]?.items[0]).toMatchObject({
      startingEquipmentKind: 'EQUIPMENT',
      selectionKind: 'GRANTED',
      quantity: 1,
      equipmentIds: [getSrdEquipment('Greataxe').id]
    })
    expect(weaponGroup?.options[1]?.items[0]).toMatchObject({
      startingEquipmentKind: 'EQUIPMENT',
      selectionKind: 'CHOSEN',
      category: EQUIPMENT_CATEGORY_CODE.WEAPON,
      properties: [EQUIPMENT_PROPERTY_CODE.MARTIAL, EQUIPMENT_PROPERTY_CODE.MELEE],
      count: 1
    })

    expect(secondaryWeaponGroup?.options).toHaveLength(2)
    expect(secondaryWeaponGroup?.options[0]?.items[0]).toMatchObject({
      startingEquipmentKind: 'EQUIPMENT',
      selectionKind: 'GRANTED',
      quantity: 2,
      equipmentIds: [getSrdEquipment('Handaxe').id]
    })
    expect(secondaryWeaponGroup?.options[1]?.items[0]).toMatchObject({
      startingEquipmentKind: 'EQUIPMENT',
      selectionKind: 'CHOSEN',
      category: EQUIPMENT_CATEGORY_CODE.WEAPON,
      properties: [EQUIPMENT_PROPERTY_CODE.SIMPLE],
      count: 1
    })

    expect(fixedGearGroup?.options).toHaveLength(1)
    expect(fixedGearGroup?.options[0]?.items).toMatchObject([
      {
        startingEquipmentKind: 'EQUIPMENT',
        selectionKind: 'GRANTED',
        quantity: 1,
        equipmentIds: [getSrdEquipment("Explorer's Pack").id]
      },
      {
        startingEquipmentKind: 'EQUIPMENT',
        selectionKind: 'GRANTED',
        quantity: 4,
        equipmentIds: [getSrdEquipment('Javelin').id]
      }
    ])
  })

  it('defines satisfiable starting equipment for every base class', () => {
    const equipmentById = new Map(
      srdBaselineContent.subjects.equipment.map((equipment) => [equipment.id, equipment])
    )
    const failures: string[] = []
    const baseClasses = srdBaselineContent.subjects.classes.filter(
      (classRecord) => classRecord.category === CLASS_CATEGORY.BASE
    )

    expect(baseClasses).toHaveLength(12)

    for (const classRecord of baseClasses) {
      if (classRecord.startingEquipment.sets.length === 0) {
        failures.push(`${classRecord.label}: no starting equipment sets`)
      }

      for (const set of classRecord.startingEquipment.sets) {
        for (const group of set.groups) {
          for (const option of group.options) {
            for (const item of option.items) {
              if (!('authoringModeKind' in item)) continue

              if (item.authoringModeKind === AUTHORING_MODE_KIND.SELECTED) {
                for (const equipmentId of 'equipmentIds' in item ? item.equipmentIds : []) {
                  if (!equipmentById.has(equipmentId)) {
                    failures.push(`${classRecord.label}: missing equipment ${equipmentId}`)
                  }
                }
                continue
              }

              const candidates = srdBaselineContent.subjects.equipment.filter(
                (equipment) =>
                  (!item.category || equipment.category === item.category) &&
                  (!item.properties ||
                    item.properties.every((property) =>
                      (equipment.properties ?? []).includes(property)
                    ))
              )
              if (candidates.length === 0) {
                failures.push(
                  `${classRecord.label}: empty ${item.category ?? 'any'} / ${(item.properties ?? []).join(',')} filter`
                )
              }
            }
          }
        }
      }
    }

    expect(failures).toEqual([])
  })

  it('gates conditional Cleric equipment through exact-or-property proficiency', () => {
    const cleric = getSrdClass('Cleric')
    if (cleric.category !== CLASS_CATEGORY.BASE) {
      throw new Error('Expected Cleric to be a base class.')
    }

    const options = cleric.startingEquipment.sets.flatMap((set) =>
      set.groups.flatMap((group) => group.options)
    )
    const eligibilityForEquipment = (equipmentId: string) =>
      options.find((option) =>
        option.items.some(
          (item) =>
            'authoringModeKind' in item &&
            item.authoringModeKind === AUTHORING_MODE_KIND.SELECTED &&
            'equipmentIds' in item &&
            item.equipmentIds.includes(equipmentId)
        )
      )?.eligibility

    const warhammerId = getSrdEquipment('Warhammer').id
    const chainMailId = getSrdEquipment('Chain Mail').id
    const warhammerEligibility = eligibilityForEquipment(warhammerId)
    const chainMailEligibility = eligibilityForEquipment(chainMailId)

    expect(warhammerEligibility?.groups).toHaveLength(2)
    expect(chainMailEligibility?.groups).toHaveLength(2)
    expect(
      warhammerEligibility?.groups.every(
        (group) => group.contexts.length === 1 && (group.contexts[0]?.conditions ?? []).length === 1
      )
    ).toBe(true)
    expect(
      chainMailEligibility?.groups.every(
        (group) => group.contexts.length === 1 && (group.contexts[0]?.conditions ?? []).length === 1
      )
    ).toBe(true)

    const warhammerConditions = warhammerEligibility?.groups.flatMap((group) =>
      group.contexts.flatMap((context) => context.conditions)
    )
    expect(warhammerConditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          predicateCode: 'EQUIPMENT_PROFICIENCY',
          authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
          equipmentIds: [warhammerId],
          level: SCALING_AMOUNT_KIND.FULL
        }),
        expect.objectContaining({
          predicateCode: 'EQUIPMENT_PROPERTY_PROFICIENCY',
          authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
          category: EQUIPMENT_CATEGORY_CODE.WEAPON,
          properties: [EQUIPMENT_PROPERTY_CODE.MARTIAL]
        })
      ])
    )

    const chainMailConditions = chainMailEligibility?.groups.flatMap((group) =>
      group.contexts.flatMap((context) => context.conditions)
    )
    expect(chainMailConditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          predicateCode: 'EQUIPMENT_PROFICIENCY',
          authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
          equipmentIds: [chainMailId],
          level: SCALING_AMOUNT_KIND.FULL
        }),
        expect.objectContaining({
          predicateCode: 'EQUIPMENT_PROPERTY_PROFICIENCY',
          authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
          category: EQUIPMENT_CATEGORY_CODE.ARMOR,
          properties: [EQUIPMENT_PROPERTY_CODE.HEAVY]
        })
      ])
    )
  })

  it('defines the 2014 subclass selection level for every base class', () => {
    const expectedLevels = new Map<string, number>([
      ['Barbarian', 3],
      ['Bard', 3],
      ['Cleric', 1],
      ['Druid', 2],
      ['Fighter', 3],
      ['Monk', 3],
      ['Paladin', 3],
      ['Ranger', 3],
      ['Rogue', 3],
      ['Sorcerer', 1],
      ['Warlock', 1],
      ['Wizard', 2]
    ])
    const actualLevels = new Map(
      srdBaselineContent.subjects.classes
        .filter((classRecord) => classRecord.category === CLASS_CATEGORY.BASE)
        .map((classRecord) => [classRecord.label, classRecord.subclassSelectionLevel])
    )

    expect(actualLevels).toEqual(expectedLevels)
  })

  it('marks exactly one subclass-selection feature for every base class', () => {
    const baseClasses = srdBaselineContent.subjects.classes.filter(
      (classRecord) => classRecord.category === CLASS_CATEGORY.BASE
    )

    for (const classRecord of baseClasses) {
      const selectionFeatures = (classRecord.features ?? []).filter((feature) =>
        feature.attributes?.includes(FEATURE_ATTRIBUTE.SUBCLASS_SELECTION)
      )

      expect(selectionFeatures, classRecord.label).toHaveLength(1)
      expect(selectionFeatures[0]?.availableAtLevel, classRecord.label).toBe(
        classRecord.subclassSelectionLevel
      )
    }
  })

  it('does not put choice counts on granted authoring selections', () => {
    const invalidValues: string[] = []

    collectGrantedRecordsWithCounts(srdBaselineContent, 'srdBaselineContent', invalidValues)

    expect(invalidValues).toEqual([])
  })
})
