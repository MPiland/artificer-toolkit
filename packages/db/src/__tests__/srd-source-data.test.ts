import { describe, expect, it } from 'vitest'

import {
  DURATION_KIND,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  PATH_CODES_BY_TRIGGER,
  PROFICIENCY_KIND
} from '@artificer-toolkit/shared/core'

import { mapDurationToRow } from '../domains/shared/upserts/characteristic.js'
import { srdBaselineContent } from '../source-data/srd/index.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const RESULT_BLOCK_ID_SUFFIX = '__result'

function isUuidKey(key: string): boolean {
  return key === 'id' || key === 'userId' || key === 'systemId' || key.endsWith('Id') || key.endsWith('Ids')
}

function isValidUuidValue(path: string, key: string, value: string): boolean {
  if (UUID_PATTERN.test(value)) {
    return true
  }

  if (key === 'id' && path.endsWith('.resultBlock.id') && value.endsWith(RESULT_BLOCK_ID_SUFFIX)) {
    return UUID_PATTERN.test(value.slice(0, -RESULT_BLOCK_ID_SUFFIX.length))
  }

  return false
}

function collectInvalidUuidValues(value: unknown, path: string, invalidValues: string[]) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectInvalidUuidValues(item, `${path}[${index}]`, invalidValues)
    })

    return
  }

  if (!value || typeof value !== 'object') {
    return
  }

  for (const [key, entry] of Object.entries(value)) {
    const entryPath = path ? `${path}.${key}` : key

    if (isUuidKey(key)) {
      if (Array.isArray(entry)) {
        entry.forEach((item, index) => {
          if (typeof item === 'string' && !isValidUuidValue(`${entryPath}[${index}]`, key, item)) {
            invalidValues.push(`${entryPath}[${index}]: ${item}`)
          }
        })
      } else if (typeof entry === 'string' && !isValidUuidValue(entryPath, key, entry)) {
        invalidValues.push(`${entryPath}: ${entry}`)
      }
    }

    collectInvalidUuidValues(entry, entryPath, invalidValues)
  }
}

function collectEquipmentReferences(value: unknown, references: string[]) {
  if (Array.isArray(value)) {
    value.forEach((item) => {
      collectEquipmentReferences(item, references)
    })

    return
  }

  if (!value || typeof value !== 'object') {
    return
  }

  for (const [key, entry] of Object.entries(value)) {
    if (key === 'equipmentId' && typeof entry === 'string') {
      references.push(entry)
    }

    if (key === 'equipmentIds' && Array.isArray(entry)) {
      entry.forEach((item) => {
        if (typeof item === 'string') {
          references.push(item)
        }
      })
    }

    collectEquipmentReferences(entry, references)
  }
}

function collectOptionReferences(value: unknown, references: string[]) {
  if (Array.isArray(value)) {
    value.forEach((item) => {
      collectOptionReferences(item, references)
    })

    return
  }

  if (!value || typeof value !== 'object') {
    return
  }

  for (const [key, entry] of Object.entries(value)) {
    if (key === 'optionId' && typeof entry === 'string') {
      references.push(entry)
    }

    if (key === 'optionIds' && Array.isArray(entry)) {
      entry.forEach((item) => {
        if (typeof item === 'string') {
          references.push(item)
        }
      })
    }

    collectOptionReferences(entry, references)
  }
}

function collectStringReferencesByKey(value: unknown, referenceKey: string, references: string[]) {
  if (Array.isArray(value)) {
    value.forEach((item) => {
      collectStringReferencesByKey(item, referenceKey, references)
    })

    return
  }

  if (!value || typeof value !== 'object') {
    return
  }

  for (const [key, entry] of Object.entries(value)) {
    if (key === referenceKey && typeof entry === 'string') {
      references.push(entry)
    }

    collectStringReferencesByKey(entry, referenceKey, references)
  }
}

function collectDuplicateValues(values: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  values.forEach((value) => {
    if (seen.has(value)) {
      duplicates.add(value)
      return
    }

    seen.add(value)
  })

  return [...duplicates].sort()
}

interface NestedFeatureReference {
  id: string
  path: string
}

function collectNestedFeatureReferences(
  value: unknown,
  path: string,
  references: NestedFeatureReference[]
) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectNestedFeatureReferences(item, `${path}[${index}]`, references)
    })

    return
  }

  if (!isRecord(value)) {
    return
  }

  if (Array.isArray(value.features)) {
    value.features.forEach((feature, index) => {
      if (isRecord(feature) && typeof feature.id === 'string') {
        references.push({
          id: feature.id,
          path: `${path}.features[${index}]`
        })
      }
    })
  }

  for (const [key, entry] of Object.entries(value)) {
    collectNestedFeatureReferences(entry, path ? `${path}.${key}` : key, references)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function collectGrantedRecordsWithCounts(
  value: unknown,
  path: string,
  invalidValues: string[]
) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectGrantedRecordsWithCounts(item, `${path}[${index}]`, invalidValues)
    })

    return
  }

  if (!isRecord(value)) {
    return
  }

  if (value.selectionKind === 'GRANTED' && 'count' in value) {
    invalidValues.push(`${path}.count`)
  }

  for (const [key, entry] of Object.entries(value)) {
    collectGrantedRecordsWithCounts(entry, path ? `${path}.${key}` : key, invalidValues)
  }
}

function collectInvalidEquipmentProficiencySelectors(
  value: unknown,
  path: string,
  invalidValues: string[]
) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectInvalidEquipmentProficiencySelectors(item, `${path}[${index}]`, invalidValues)
    })

    return
  }

  if (!isRecord(value)) {
    return
  }

  if (value.grantKind === 'PROFICIENCY_GRANT') {
    if (typeof value.category === 'string' && !(value.category in EQUIPMENT_CATEGORY_CODE)) {
      invalidValues.push(`${path}.category: ${value.category}`)
    }

    if (Array.isArray(value.properties)) {
      value.properties.forEach((property, index) => {
        if (typeof property === 'string' && !(property in EQUIPMENT_PROPERTY_CODE)) {
          invalidValues.push(`${path}.properties[${index}]: ${property}`)
        }
      })
    }

    if (
      value.proficiencyKind === PROFICIENCY_KIND.EQUIPMENT
      && value.authoringModeKind === 'SELECTED'
      && (!Array.isArray(value.equipmentIds) || value.equipmentIds.length === 0)
    ) {
      invalidValues.push(`${path}.equipmentIds: SELECTED equipment proficiency requires equipment IDs`)
    }
  }

  for (const [key, entry] of Object.entries(value)) {
    collectInvalidEquipmentProficiencySelectors(entry, path ? `${path}.${key}` : key, invalidValues)
  }
}

function collectDurationKinds(
  value: unknown,
  path: string,
  invalidValues: string[]
) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectDurationKinds(item, `${path}[${index}]`, invalidValues)
    })

    return
  }

  if (!isRecord(value)) {
    return
  }

  if (typeof value.durationKind === 'string' && !(value.durationKind in DURATION_KIND)) {
    invalidValues.push(`${path}.durationKind: ${value.durationKind}`)
  }

  for (const [key, entry] of Object.entries(value)) {
    collectDurationKinds(entry, path ? `${path}.${key}` : key, invalidValues)
  }
}

function collectInvalidEffectPathCodes(
  value: unknown,
  path: string,
  invalidValues: string[]
) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectInvalidEffectPathCodes(item, `${path}[${index}]`, invalidValues)
    })

    return
  }

  if (!isRecord(value)) {
    return
  }

  const invocation = value.invocation

  if (isRecord(invocation) && Array.isArray(value.paths) && typeof invocation.triggerCode === 'string') {
    const allowedPathCodes: ReadonlySet<string> = new Set(
      PATH_CODES_BY_TRIGGER[invocation.triggerCode as keyof typeof PATH_CODES_BY_TRIGGER] ?? []
    )

    value.paths.forEach((effectPath, index) => {
      if (isRecord(effectPath) && typeof effectPath.pathCode === 'string' && !allowedPathCodes.has(effectPath.pathCode)) {
        invalidValues.push(`${path}.paths[${index}]: ${invocation.triggerCode}/${effectPath.pathCode}`)
      }
    })
  }

  for (const [key, entry] of Object.entries(value)) {
    collectInvalidEffectPathCodes(entry, path ? `${path}.${key}` : key, invalidValues)
  }
}

function collectNonIntegerShapeDimensionAmounts(
  value: unknown,
  path: string,
  invalidValues: string[]
) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectNonIntegerShapeDimensionAmounts(item, `${path}[${index}]`, invalidValues)
    })

    return
  }

  if (!isRecord(value)) {
    return
  }

  for (const key of [
    'edgeLength', 'height', 'length', 'radius', 'thickness'
  ]) {
    const dimension = value[key]

    if (isRecord(dimension) && typeof dimension.amount === 'number' && !Number.isInteger(dimension.amount)) {
      invalidValues.push(`${path}.${key}.amount: ${dimension.amount}`)
    }
  }

  for (const [key, entry] of Object.entries(value)) {
    collectNonIntegerShapeDimensionAmounts(entry, path ? `${path}.${key}` : key, invalidValues)
  }
}

function collectOptionIds(value: unknown, optionIds: Set<string>) {
  if (Array.isArray(value)) {
    value.forEach((item) => {
      collectOptionIds(item, optionIds)
    })

    return
  }

  if (!isRecord(value)) {
    return
  }

  for (const [key, entry] of Object.entries(value)) {
    if (key === 'options' && Array.isArray(entry)) {
      entry.forEach((item) => {
        if (isRecord(item) && typeof item.id === 'string') {
          optionIds.add(item.id)
        }
      })
    }

    collectOptionIds(entry, optionIds)
  }
}

function hasSpellCastLevelScaling(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasSpellCastLevelScaling)
  }

  if (!isRecord(value)) {
    return false
  }

  if (value.scalingSource === 'SPELL_CAST_LEVEL') {
    return true
  }

  return Object.values(value).some(hasSpellCastLevelScaling)
}

function stripHtml(value: string | null | undefined): string {
  return (value ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function paragraphCount(value: string | null | undefined): number {
  if (!value) return 0
  return value.match(/<p\b/gi)?.length ?? (stripHtml(value) ? 1 : 0)
}

function getSrdEquipment(label: string) {
  const equipment = srdBaselineContent.subjects.equipment.find((item) => item.label === label)

  if (!equipment) {
    throw new Error(`Expected SRD equipment "${label}" to exist.`)
  }

  return equipment
}

function getSrdClass(label: string) {
  const classRecord = srdBaselineContent.subjects.classes.find((item) => item.label === label)

  if (!classRecord) {
    throw new Error(`Expected SRD class "${label}" to exist.`)
  }

  return classRecord
}

function getSrdDamageTypeId(code: string): string {
  const damageType = srdBaselineContent.vocabulary.systems
    .flatMap((system) => system.damageTypes)
    .find((entry) => entry.code === code)

  if (!damageType) {
    throw new Error(`Expected SRD damage type "${code}" to exist.`)
  }

  return damageType.id
}

function hasDamageOutcome(value: unknown, damageTypeId: string, diceConfig: string): boolean {
  if (Array.isArray(value)) return value.some((item) => hasDamageOutcome(item, damageTypeId, diceConfig))
  if (!isRecord(value)) return false

  if (
    value.effectKind === 'DAMAGE'
    && value.damageTypeId === damageTypeId
    && value.diceConfig === diceConfig
  ) {
    return true
  }

  return Object.values(value).some((entry) => hasDamageOutcome(entry, damageTypeId, diceConfig))
}

function hasHealOutcome(value: unknown, diceConfig: string): boolean {
  if (Array.isArray(value)) return value.some((item) => hasHealOutcome(item, diceConfig))
  if (!isRecord(value)) return false

  if (value.effectKind === 'HEAL' && value.diceConfig === diceConfig) {
    return true
  }

  return Object.values(value).some((entry) => hasHealOutcome(entry, diceConfig))
}

function hasRuleOutcome(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasRuleOutcome)
  if (!isRecord(value)) return false

  if (value.effectKind === 'RULE') {
    return true
  }

  return Object.values(value).some(hasRuleOutcome)
}

describe('SRD source data', () => {
  it('uses valid UUID strings for deterministic ID fields', () => {
    const invalidValues: string[] = []

    collectInvalidUuidValues(srdBaselineContent, 'srdBaselineContent', invalidValues)

    expect(invalidValues).toEqual([])
  })

  it('does not define duplicate subject IDs', () => {
    const subjectGroups = Object.values(srdBaselineContent.subjects) as readonly (readonly { id: string }[])[]
    const subjectIds = subjectGroups
      .flatMap((subjects) => subjects.map((subject) => subject.id))

    expect(collectDuplicateValues(subjectIds)).toEqual([])
  })

  it('marks seeded subject records active', () => {
    const subjectGroups = Object.entries(srdBaselineContent.subjects) as readonly [
      string,
      readonly { label: string, status: string }[]
    ][]
    const inactiveSubjects = subjectGroups.flatMap(([subjectKind, subjects]) => subjects
      .filter((subject) => subject.status !== 'ACTIVE')
      .map((subject) => `${subjectKind}: ${subject.label} (${subject.status})`))

    expect(inactiveSubjects).toEqual([])
  })

  it('does not define duplicate nested feature IDs', () => {
    const featureReferences: NestedFeatureReference[] = []

    collectNestedFeatureReferences(srdBaselineContent.subjects, 'subjects', featureReferences)

    const duplicateFeatureIds = new Set(collectDuplicateValues(featureReferences.map((reference) => reference.id)))
    expect(featureReferences
      .filter((reference) => duplicateFeatureIds.has(reference.id))
      .map((reference) => `${reference.path}: ${reference.id}`)).toEqual([])
  })

  it('keeps creature feature IDs scoped to their owning creature', () => {
    const mismatchedFeatureIds = srdBaselineContent.subjects.creatures.flatMap((creature) => {
      const creatureOwnerSegment = creature.id.slice(24, 28)

      return (creature.features ?? [])
        .filter((feature) => feature.id.slice(24, 28) !== creatureOwnerSegment)
        .map((feature) => `${creature.label}: ${feature.label} (${feature.id})`)
    })

    expect(mismatchedFeatureIds).toEqual([])
  })

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

  it('only references equipment records that exist in the SRD equipment bundle', () => {
    const equipmentIds = new Set(srdBaselineContent.subjects.equipment.map((equipment) => equipment.id))
    const referencedEquipmentIds: string[] = []

    collectEquipmentReferences(srdBaselineContent, referencedEquipmentIds)

    expect([...new Set(referencedEquipmentIds.filter((id) => !equipmentIds.has(id)))]).toEqual([])
  })

  it('does not put choice counts on granted authoring selections', () => {
    const invalidValues: string[] = []

    collectGrantedRecordsWithCounts(srdBaselineContent, 'srdBaselineContent', invalidValues)

    expect(invalidValues).toEqual([])
  })

  it('keeps SRD spell mechanics populated', () => {
    const spellsWithoutEffects = srdBaselineContent.subjects.spells
      .filter((spell) => !spell.effects?.length)
      .map((spell) => spell.label)
    const classLabelById = new Map(srdBaselineContent.subjects.classes.map((classRecord) => [
      classRecord.id,
      classRecord.label
    ]))
    const spellClassLabels = (label: string) => srdBaselineContent.subjects.spells
      .find((spell) => spell.label === label)
      ?.classIds.map((classId) => classLabelById.get(classId))
      .sort()

    expect(spellsWithoutEffects).toEqual([])

    expect(srdBaselineContent.subjects.spells.find((spell) => spell.label === 'Acid Arrow')).toMatchObject({
      components: ['VERBAL', 'SOMATIC', 'MATERIAL'],
      description: expect.stringContaining('<strong>At Higher Levels.</strong>'),
      materialDescription: "powdered rhubarb leaf and an adder's stomach",
      magicSchoolId: expect.stringMatching(/00000000-0000-0000-0007-000500000000/i),
      effects: expect.arrayContaining([
        expect.objectContaining({ id: expect.any(String) })
      ])
    })
    expect(srdBaselineContent.subjects.spells.find((spell) => spell.label === 'Contagion')).toMatchObject({
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
    const acolyte = srdBaselineContent.subjects.backgrounds.find((background) => background.label === 'Acolyte')

    expect(acolyte).toBeDefined()
    expect(paragraphCount(acolyte?.description)).toBe(2)
    expect(acolyte?.details).toHaveLength(26)
    expect(acolyte?.features?.[0]?.details?.[0]?.description).toContain('<p>')
  })

  it('keeps SRD spellcasting class prose and Bardic Inspiration resource data populated', () => {
    const spellcastingClassLabels = ['Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger', 'Sorcerer', 'Warlock', 'Wizard']
    const classesMissingSpellcastingDetails = spellcastingClassLabels
      .map((label) => getSrdClass(label))
      .filter((classRecord) => !classRecord.spellcasting?.details?.length)
      .map((classRecord) => classRecord.label)

    const bard = getSrdClass('Bard')
    const bardFeatureLabels = new Set((bard.features ?? []).map((feature) => feature.label))
    const fontOfInspiration = bard.features?.find((feature) => feature.label === 'Font of Inspiration')

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
    expect(bard.spellcasting?.details?.find((detail) => detail.label === 'Spellcasting Ability')?.description)
      .toContain('Spell save DC')
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
    expect(bardFeatureLabels.has('Bardic Inspiration')).toBe(false)
    expect(fontOfInspiration?.grants?.modifiers?.[0]).toMatchObject({
      valueDomainCode: 'CHARGE_RESET',
      modifierKind: 'REPLACE_CHARGE_RESET_KIND',
      payload: { resetKind: 'SHORT_REST' }
    })
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
      description: expect.stringContaining('This sticky, adhesive fluid ignites when exposed to air.'),
      properties: expect.arrayContaining([EQUIPMENT_PROPERTY_CODE.FLASK])
    })
    expect(hasDamageOutcome(alchemistsFire, getSrdDamageTypeId('FIRE'), '1d4')).toBe(true)
    expect(hasRuleOutcome(alchemistsFire)).toBe(true)

    expect(antitoxin).toMatchObject({
      description: expect.stringContaining('gains advantage on saving throws against poison for 1 hour'),
      properties: expect.arrayContaining([EQUIPMENT_PROPERTY_CODE.VIAL, EQUIPMENT_PROPERTY_CODE.DRINK])
    })
    expect(hasRuleOutcome(antitoxin)).toBe(true)

    expect(ballBearings.description).toContain('cover a level, square area that is 10 feet on a side')
    expect(hasRuleOutcome(ballBearings)).toBe(true)

    expect(caltrops.description).toContain('take 1 piercing damage')
    expect(hasRuleOutcome(caltrops)).toBe(true)

    expect(holyWater).toMatchObject({
      description: expect.stringContaining('If the target is a fiend or undead, it takes 2d6 radiant damage.'),
      properties: expect.arrayContaining([EQUIPMENT_PROPERTY_CODE.FLASK])
    })
    expect(hasDamageOutcome(holyWater, getSrdDamageTypeId('RADIANT'), '2d6')).toBe(true)

    expect(huntingTrap.description).toContain('take 1d4 piercing damage and stop moving')
    expect(hasRuleOutcome(huntingTrap)).toBe(true)

    expect(oil).toMatchObject({
      description: expect.stringContaining('If the target takes any fire damage before the oil dries after 1 minute'),
      properties: expect.arrayContaining([EQUIPMENT_PROPERTY_CODE.FLASK])
    })
    expect(hasRuleOutcome(oil)).toBe(true)

    expect(poison).toMatchObject({
      description: expect.stringContaining('take 1d4 poison damage'),
      properties: expect.arrayContaining([EQUIPMENT_PROPERTY_CODE.VIAL, EQUIPMENT_PROPERTY_CODE.POISON])
    })
    expect(hasRuleOutcome(poison)).toBe(true)

    expect(potion).toMatchObject({
      description: expect.stringContaining('regains 2d4 + 2 hit points'),
      properties: expect.arrayContaining([EQUIPMENT_PROPERTY_CODE.POTION, EQUIPMENT_PROPERTY_CODE.VIAL])
    })
    expect(hasHealOutcome(potion, '2d4+2')).toBe(true)
  })

  it('uses SRD container properties for equipment labels that name their vessel', () => {
    const missingContainerProperties = srdBaselineContent.subjects.equipment.flatMap((equipment) => {
      const expectedProperties = [
        ...(/\(vial\)$/i.test(equipment.label) || equipment.label === 'VIAL' ? [EQUIPMENT_PROPERTY_CODE.VIAL] : []),
        ...(/\(flask\)$/i.test(equipment.label) || equipment.label === 'Flask or Tankard' ? [EQUIPMENT_PROPERTY_CODE.FLASK] : []),
        ...(/^Potion\b/i.test(equipment.label) ? [EQUIPMENT_PROPERTY_CODE.POTION] : []),
        ...(/^Poison,\s*Basic/i.test(equipment.label) ? [EQUIPMENT_PROPERTY_CODE.POISON] : [])
      ]

      return expectedProperties
        .filter((property) => !equipment.properties?.includes(property))
        .map((property) => `${equipment.label}: missing ${property}`)
    })

    expect(missingContainerProperties).toEqual([])
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
    const rarityIds = new Set(srdBaselineContent.vocabulary.systems.flatMap((system) => system.rarities.map((rarity) => rarity.id)))
    const referencedRarityIds = srdBaselineContent.subjects.equipment.map((equipment) => equipment.rarityId)

    expect([...new Set(referencedRarityIds.filter((id) => !rarityIds.has(id)))]).toEqual([])
  })

  it('only references creature type records that exist in the SRD system vocabulary', () => {
    const creatureTypeIds = new Set(
      srdBaselineContent.vocabulary.systems.flatMap((system) => system.creatureTypes.map((creatureType) => creatureType.id))
    )
    const referencedCreatureTypeIds: string[] = []

    collectStringReferencesByKey(srdBaselineContent, 'creatureTypeId', referencedCreatureTypeIds)

    expect([...new Set(referencedCreatureTypeIds.filter((id) => !creatureTypeIds.has(id)))]).toEqual([])
  })

  it('only references challenge rating records that exist in the SRD system vocabulary', () => {
    const challengeRatingIds = new Set(
      srdBaselineContent.vocabulary.systems.flatMap((system) => system.challengeRatings.map((challengeRating) => challengeRating.id))
    )
    const referencedChallengeRatingIds: string[] = []

    collectStringReferencesByKey(srdBaselineContent, 'challengeRatingId', referencedChallengeRatingIds)

    expect([...new Set(referencedChallengeRatingIds.filter((id) => !challengeRatingIds.has(id)))]).toEqual([])
  })

  it('only references speed records that exist in the SRD system vocabulary', () => {
    const speedIds = new Set(srdBaselineContent.vocabulary.systems.flatMap((system) => system.speeds.map((speed) => speed.id)))
    const referencedSpeedIds: string[] = []

    collectStringReferencesByKey(srdBaselineContent, 'speedId', referencedSpeedIds)

    expect([...new Set(referencedSpeedIds.filter((id) => !speedIds.has(id)))]).toEqual([])
  })

  it('normalizes creature damageability references to SRD damage type IDs', () => {
    const damageTypeIds = new Set(
      srdBaselineContent.vocabulary.systems.flatMap((system) => system.damageTypes.map((damageType) => damageType.id))
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
      srdBaselineContent.vocabulary.systems.flatMap((system) => system.conditionTypes.map((conditionType) => conditionType.id))
    )
    const referencedConditionTypeIds = srdBaselineContent.subjects.creatures.flatMap((creature) => creature.conditionImmunities ?? [])

    expect([...new Set(referencedConditionTypeIds.filter((id) => !conditionTypeIds.has(id)))]).toEqual([])
  })

  it('keeps legendary action prose tied to named options', () => {
    const missingLegendaryOptions = srdBaselineContent.subjects.creatures.flatMap((creature) => (creature.features ?? [])
      .filter((feature) => feature.label === 'Legendary Actions')
      .filter((feature) => /options?\s+(listed\s+)?below/i.test(stripHtml(feature.description)))
      .filter((feature) => !feature.options?.length)
      .map(() => creature.label))

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

    collectInvalidEquipmentProficiencySelectors(srdBaselineContent, 'srdBaselineContent', invalidValues)

    expect(invalidValues).toEqual([])
  })

  it('uses duration kinds supported by normalized duration persistence', () => {
    const invalidValues: string[] = []

    collectDurationKinds(srdBaselineContent, 'srdBaselineContent', invalidValues)

    expect(invalidValues).toEqual([])
    expect(mapDurationToRow({
      id: '00000000-0000-0000-0000-000000000001',
      durationKind: DURATION_KIND.UNTIL_DISPELLED
    }, '00000000-0000-0000-0000-000000000001')).toMatchObject({
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
