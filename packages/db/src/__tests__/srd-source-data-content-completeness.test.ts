import { describe, expect, it } from 'vitest'

import { DURATION_KIND, EQUIPMENT_PROPERTY_CODE } from '@artificer-toolkit/shared/core'
import { compileVehicle } from '@artificer-toolkit/shared/compilers'
import { cloneAuthoredItem } from '@artificer-toolkit/shared/utils'
import { srdBaselineContent } from '../source-data/srd/index.js'
import {
  hasSpellCastLevelScaling,
  stripHtml,
  paragraphCount,
  getSrdEquipment,
  getSrdClass,
  getSrdDamageTypeId,
  hasDamageOutcome,
  hasHealOutcome,
  hasManualAdjudicationOutcome
} from './helpers/srdSourceDataHelpers.js'

describe('SRD source data', () => {
  it('preserves the exact SRD vehicle logistics through authored and compiled data', () => {
    const vehicles = new Map(
      srdBaselineContent.subjects.vehicles.map((vehicle) => [vehicle.label, vehicle])
    )
    const expectedLandWeights = new Map([
      ['Carriage', 600],
      ['Cart', 200],
      ['Chariot', 100],
      ['Sled', 300],
      ['Wagon', 400]
    ])

    for (const [label, amount] of expectedLandWeights) {
      const vehicle = vehicles.get(label)
      expect(vehicle?.weight).toEqual({ amount, unit: 'POUNDS' })
      expect(compileVehicle(vehicle!).features?.[0]?.effects?.[0]?.entries[0]).toMatchObject({
        outcome: {
          effectKind: 'CLOSED_RULE',
          ruleKind: 'VEHICLE_DRAFT_ANIMAL_CAPACITY'
        }
      })
    }

    const rowboat = vehicles.get('Rowboat')
    const warship = vehicles.get('Warship')
    if (!rowboat || !warship) throw new Error('SRD rowboat and warship records are required.')

    expect(rowboat).toMatchObject({
      speed: 1.5,
      speedNote: '1½ mph',
      weight: { amount: 100, unit: 'POUNDS' }
    })
    expect(warship).toMatchObject({ speed: 2.5, speedNote: '2½ mph' })
    expect(compileVehicle(rowboat).features?.[0]?.effects?.[0]?.entries[0]).toMatchObject({
      outcome: {
        effectKind: 'CLOSED_RULE',
        ruleKind: 'VEHICLE_ROWED_VESSEL_CURRENT'
      }
    })

    for (const vehicle of vehicles.values()) {
      expect(vehicle).not.toHaveProperty('armorClass')
      expect(vehicle).not.toHaveProperty('hitPoints')
      expect(vehicle).not.toHaveProperty('crewMin')
      expect(vehicle).not.toHaveProperty('crewMax')
      expect(vehicle).not.toHaveProperty('passengerCapacity')
    }

    const clonedRowboat = cloneAuthoredItem(rowboat)
    expect(clonedRowboat.features?.[0]?.id).not.toBe(rowboat.features?.[0]?.id)
    expect(clonedRowboat.features?.[0]?.effects?.[0]?.paths[0]).toMatchObject({
      resultBlock: {
        outcomes: [
          expect.objectContaining({
            effectKind: 'CLOSED_RULE',
            ruleKind: 'VEHICLE_ROWED_VESSEL_CURRENT'
          })
        ]
      }
    })
  })

  it('keeps SRD spell mechanics populated', () => {
    const spellsWithoutEffects = srdBaselineContent.subjects.spells
      .filter((spell) => !spell.effects?.length)
      .map((spell) => spell.label)
    const classLabelById = new Map(
      srdBaselineContent.subjects.classes.map((classRecord) => [classRecord.id, classRecord.label])
    )
    const spellClassLabels = (label: string) =>
      srdBaselineContent.subjects.spells
        .find((spell) => spell.label === label)
        ?.classIds.map((classId) => classLabelById.get(classId))
        .sort()

    expect(spellsWithoutEffects).toEqual([])

    expect(
      srdBaselineContent.subjects.spells.find((spell) => spell.label === 'Acid Arrow')
    ).toMatchObject({
      components: ['VERBAL', 'SOMATIC', 'MATERIAL'],
      description: expect.stringContaining('At Higher Levels.'),
      materialDescription: "powdered rhubarb leaf and an adder's stomach",
      magicSchoolId: expect.stringMatching(/00000000-0000-0000-0007-000500000000/i),
      effects: expect.arrayContaining([expect.objectContaining({ id: expect.any(String) })])
    })
    expect(
      srdBaselineContent.subjects.spells.find((spell) => spell.label === 'Contagion')
    ).toMatchObject({
      components: ['VERBAL', 'SOMATIC'],
      effects: expect.arrayContaining([
        expect.objectContaining({
          paths: expect.arrayContaining([
            expect.objectContaining({
              resultBlock: expect.objectContaining({
                duration: expect.objectContaining({
                  amount: 7,
                  durationKind: DURATION_KIND.DAY
                })
              })
            })
          ])
        })
      ])
    })
    expect(spellClassLabels('Acid Arrow')).toEqual(['Wizard'])
    expect(spellClassLabels('Fireball')).toEqual(['Sorcerer', 'Wizard'])
    expect(spellClassLabels('Thaumaturgy')).toEqual(['Cleric'])
  })

  it('includes higher-level text for spells with spell-slot scaling', () => {
    const missingHigherLevelText = srdBaselineContent.subjects.spells
      .filter((spell) => hasSpellCastLevelScaling(spell.effects))
      .filter((spell) => !spell.description.includes('At Higher Levels'))
      .map((spell) => spell.label)
      .sort()

    expect(missingHigherLevelText).toEqual([])
  })

  it('keeps SRD background prose and detail tables populated', () => {
    const acolyte = srdBaselineContent.subjects.backgrounds.find(
      (background) => background.label === 'Acolyte'
    )

    expect(acolyte).toBeDefined()
    expect(paragraphCount(acolyte?.description)).toBe(2)
    expect(acolyte?.details).toHaveLength(26)
    expect(acolyte?.features?.[0]?.details?.[0]?.description).toContain('<p>')
  })

  it('keeps SRD spellcasting class prose and Bardic Inspiration resource data populated', () => {
    const spellcastingClassLabels = [
      'Bard',
      'Cleric',
      'Druid',
      'Paladin',
      'Ranger',
      'Sorcerer',
      'Warlock',
      'Wizard'
    ]
    const classesMissingSpellcastingDetails = spellcastingClassLabels
      .map((label) => getSrdClass(label))
      .filter((classRecord) => !classRecord.spellcasting?.details?.length)
      .map((classRecord) => classRecord.label)

    const bard = getSrdClass('Bard')
    const bardFeatureLabels = new Set((bard.features ?? []).map((feature) => feature.label))
    const fontOfInspiration = bard.features?.find(
      (feature) => feature.label === 'Font of Inspiration'
    )

    expect(classesMissingSpellcastingDetails).toEqual([])
    expect(bard.spellcasting?.details?.map((detail) => detail.label)).toEqual([
      'Spellcasting',
      'Cantrips',
      'Spell Slots',
      'Spells Known of 1st Level and Higher',
      'Spellcasting Ability',
      'Ritual Casting',
      'Spellcasting Focus'
    ])
    expect(
      bard.spellcasting?.details?.find((detail) => detail.label === 'Spellcasting Ability')
        ?.description
    ).toContain('Spell save DC')
    expect(bard.resources).toMatchObject({
      label: 'Bardic Inspiration',
      availableAtLevel: 1,
      charges: expect.objectContaining({
        resetKind: 'LONG_REST',
        limitKind: 'ABILITY_MODIFIER',
        ability: 'CHARISMA',
        min: 1
      })
    })
    expect(bardFeatureLabels.has('Bardic Inspiration')).toBe(true)
    expect(fontOfInspiration?.grants?.modifiers?.[0]).toMatchObject({
      valueDomainCode: 'CHARGE_RESET',
      modifierKind: 'REPLACE_CHARGE_RESET_KIND',
      payload: { resetKind: 'SHORT_REST' }
    })
  })

  it('matches the SRD Warlock Pact Magic slot progression', () => {
    const warlock = getSrdClass('Warlock')
    const expectedSlotCounts = [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4]
    const expectedSlotLevels = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]
    const charges = warlock.spellcasting?.charges

    if (charges?.limitKind !== 'FIXED_AMOUNT' || charges.scalingKind !== 'PER_LEVEL') {
      throw new Error('Warlock Pact Magic must use fixed per-level charges.')
    }

    expect(charges.levels.map((level) => level.amount)).toEqual(expectedSlotCounts)
    expect(warlock.spellcasting?.spellLimits?.map((limit) => limit.slots[0]?.slotCount)).toEqual(
      expectedSlotCounts
    )
    expect(warlock.spellcasting?.spellLimits?.map((limit) => limit.slots[0]?.spellLevel)).toEqual(
      expectedSlotLevels
    )
  })

  it('requires the complete SRD Wizard spellbook progression', () => {
    const wizard = getSrdClass('Wizard')

    expect(wizard.spellcasting?.spellLimits.map((limit) => limit.learnedSpellsLimit)).toEqual(
      Array.from({ length: 20 }, (_, index) => 6 + index * 2)
    )
  })

  it('keeps rules-heavy SRD equipment prose, properties, and mechanics populated', () => {
    const acid = getSrdEquipment('Acid (vial)')
    const alchemistsFire = getSrdEquipment("Alchemist's Fire (flask)")
    const antitoxin = getSrdEquipment('Antitoxin (vial)')
    const ballBearings = getSrdEquipment('Ball Bearings (bag of 1000)')
    const caltrops = getSrdEquipment('Caltrops (bag of 20)')
    const holyWater = getSrdEquipment('Holy Water (flask)')
    const huntingTrap = getSrdEquipment('Hunting Trap')
    const oil = getSrdEquipment('Oil (flask)')
    const poison = getSrdEquipment('Poison, Basic (vial)')
    const potion = getSrdEquipment('Potion of Healing')

    expect(acid).toMatchObject({
      description: expect.stringContaining('splash the contents of this vial'),
      properties: expect.arrayContaining([EQUIPMENT_PROPERTY_CODE.VIAL])
    })
    expect(acid.properties).not.toContain('ACID')
    expect(hasDamageOutcome(acid, getSrdDamageTypeId('ACID'), '2d6')).toBe(true)

    expect(alchemistsFire).toMatchObject({
      description: expect.stringContaining(
        'This sticky, adhesive fluid ignites when exposed to air.'
      ),
      properties: expect.arrayContaining([EQUIPMENT_PROPERTY_CODE.FLASK])
    })
    expect(hasDamageOutcome(alchemistsFire, getSrdDamageTypeId('FIRE'), '1d4')).toBe(true)
    expect(hasManualAdjudicationOutcome(alchemistsFire)).toBe(false)

    expect(antitoxin).toMatchObject({
      description: expect.stringContaining(
        'gains advantage on saving throws against poison for 1 hour'
      ),
      properties: expect.arrayContaining([
        EQUIPMENT_PROPERTY_CODE.VIAL,
        EQUIPMENT_PROPERTY_CODE.DRINK
      ])
    })
    expect(hasManualAdjudicationOutcome(antitoxin)).toBe(false)

    expect(ballBearings.description).toContain(
      'cover a level, square area that is 10 feet on a side'
    )
    expect(hasManualAdjudicationOutcome(ballBearings)).toBe(false)

    expect(caltrops.description).toContain('take 1 piercing damage')
    expect(hasManualAdjudicationOutcome(caltrops)).toBe(false)

    expect(holyWater).toMatchObject({
      description: expect.stringContaining(
        'If the target is a fiend or undead, it takes 2d6 radiant damage.'
      ),
      properties: expect.arrayContaining([EQUIPMENT_PROPERTY_CODE.FLASK])
    })
    expect(hasDamageOutcome(holyWater, getSrdDamageTypeId('RADIANT'), '2d6')).toBe(true)

    expect(huntingTrap.description).toContain('take 1d4 piercing damage and stop moving')
    expect(hasManualAdjudicationOutcome(huntingTrap)).toBe(false)

    expect(oil).toMatchObject({
      description: expect.stringContaining(
        'If the target takes any fire damage before the oil dries (after 1 minute)'
      ),
      properties: expect.arrayContaining([EQUIPMENT_PROPERTY_CODE.FLASK])
    })
    expect(hasManualAdjudicationOutcome(oil)).toBe(false)

    expect(poison).toMatchObject({
      description: expect.stringContaining('take 1d4 poison damage'),
      properties: expect.arrayContaining([
        EQUIPMENT_PROPERTY_CODE.VIAL,
        EQUIPMENT_PROPERTY_CODE.POISON
      ])
    })
    expect(hasManualAdjudicationOutcome(poison)).toBe(false)

    expect(potion).toMatchObject({
      description: expect.stringContaining('regains 2d4 + 2 hit points'),
      properties: expect.arrayContaining([
        EQUIPMENT_PROPERTY_CODE.POTION,
        EQUIPMENT_PROPERTY_CODE.VIAL
      ])
    })
    expect(hasHealOutcome(potion, '2d4+2')).toBe(true)
  })

  it('uses SRD container properties for equipment labels that name their vessel', () => {
    const missingContainerProperties = srdBaselineContent.subjects.equipment.flatMap(
      (equipment) => {
        const expectedProperties = [
          ...(/\(vial\)$/i.test(equipment.label) || equipment.label === 'VIAL'
            ? [EQUIPMENT_PROPERTY_CODE.VIAL]
            : []),
          ...(/\(flask\)$/i.test(equipment.label) || equipment.label === 'Flask or Tankard'
            ? [EQUIPMENT_PROPERTY_CODE.FLASK]
            : []),
          ...(/^Potion\b/i.test(equipment.label) ? [EQUIPMENT_PROPERTY_CODE.POTION] : []),
          ...(/^Poison,\s*Basic/i.test(equipment.label) ? [EQUIPMENT_PROPERTY_CODE.POISON] : [])
        ]

        return expectedProperties
          .filter((property) => !equipment.properties?.includes(property))
          .map((property) => `${equipment.label}: missing ${property}`)
      }
    )

    expect(missingContainerProperties).toEqual([])
  })

  it('models Half-Elf ability score choices as distinct feature options', () => {
    const halfElf = srdBaselineContent.subjects.races.find((race) => race.label === 'Half-Elf')
    const abilityScoreIncrease = halfElf?.features?.find(
      (feature) => feature.label === 'Ability Score Increase'
    )

    expect(abilityScoreIncrease?.optionChoices).toEqual([{ level: 1, count: 2 }])
    expect(abilityScoreIncrease?.grants?.modifiers).toMatchObject([
      {
        selectionKind: 'GRANTED',
        domain: { ability: 'CHARISMA' },
        payload: { valueKind: 'FIXED', amount: 2 }
      }
    ])
    expect(
      abilityScoreIncrease?.options?.map((option) => ({
        label: option.label,
        modifier: option.grants?.modifiers?.[0]
      }))
    ).toMatchObject([
      {
        label: 'Strength',
        modifier: {
          selectionKind: 'GRANTED',
          domain: { ability: 'STRENGTH' },
          payload: { amount: 1 }
        }
      },
      {
        label: 'Dexterity',
        modifier: {
          selectionKind: 'GRANTED',
          domain: { ability: 'DEXTERITY' },
          payload: { amount: 1 }
        }
      },
      {
        label: 'Constitution',
        modifier: {
          selectionKind: 'GRANTED',
          domain: { ability: 'CONSTITUTION' },
          payload: { amount: 1 }
        }
      },
      {
        label: 'Intelligence',
        modifier: {
          selectionKind: 'GRANTED',
          domain: { ability: 'INTELLIGENCE' },
          payload: { amount: 1 }
        }
      },
      {
        label: 'Wisdom',
        modifier: {
          selectionKind: 'GRANTED',
          domain: { ability: 'WISDOM' },
          payload: { amount: 1 }
        }
      }
    ])
  })

  it('keeps SRD base race descriptions and details populated', () => {
    const baseRaces = srdBaselineContent.subjects.races.filter((race) => race.category === 'BASE')
    const racesMissingDescription = baseRaces
      .filter((race) => !stripHtml(race.description))
      .map((race) => race.label)
    const racesMissingDetails = baseRaces
      .filter((race) => !race.details?.length)
      .map((race) => race.label)

    expect(racesMissingDescription).toEqual([])
    expect(racesMissingDetails).toEqual([])
  })

  it('only references rarity records that exist in the SRD system vocabulary', () => {
    const rarityIds = new Set(
      srdBaselineContent.vocabulary.systems.flatMap((system) =>
        system.rarities.map((rarity) => rarity.id)
      )
    )
    const referencedRarityIds = srdBaselineContent.subjects.equipment.map(
      (equipment) => equipment.rarityId
    )

    expect([...new Set(referencedRarityIds.filter((id) => !rarityIds.has(id)))]).toEqual([])
  })
})
