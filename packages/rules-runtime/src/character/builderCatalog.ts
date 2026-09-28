import {
  ABILITY_OPTIONS,
  CLASS_CATEGORY,
  EQUIPMENT_PROPERTY_REGISTRY,
  MEASUREMENT_UNIT_REGISTRY,
  PROFICIENCY_KIND,
  RACE_CATEGORY_CODE,
  SIZE_OPTIONS,
  type EquipmentCategoryCode,
  type EquipmentPropertyCode
} from '@artificer-toolkit/shared/core'
import type {
  ClassAuthored,
  BackgroundAuthored,
  SpellAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import type { ModifierGrantAuthored } from '@artificer-toolkit/shared/authored'
import type { ResolvedRace, ResolvedEquipment } from '@artificer-toolkit/shared/subjects/compilers'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'

export type CharacterBuilderRaceCatalogRecord = {
  id: string
  label: string
  category: ResolvedRace['category']
  parentRaceId?: string
  description?: string
  selectionMode?: 'DIRECT' | 'REQUIRES_SUBRACE'
  sizeLabel?: string
  speedLabels?: string[]
  abilityScoreIncreaseFacts?: Array<{ label: string; value: string }>
}

export type CharacterBuilderClassCatalogRecord = {
  id: string
  label: string
  category: ClassAuthored['category']
  parentClassId?: string
  subclassSelectionLevel?: number
  description?: string
  hitpoint?: Extract<ClassAuthored, { category: typeof CLASS_CATEGORY.BASE }>['hitpoint']
  requirementGroups?: Extract<
    ClassAuthored,
    { category: typeof CLASS_CATEGORY.BASE }
  >['multiclass']['requirementGroups']
  savingThrowLabels?: string[]
  proficiencyGroups?: Array<{ label: string; entries: string[]; grantedEntries: string[] }>
}

export type CharacterBuilderBackgroundCatalogRecord = {
  id: string
  label: string
  description?: string
  summary: string
  grantFacts: Array<{ label: string; value: string }>
  featureLabels: string[]
  hiddenGrantFactCount: number
  hiddenFeatureCount: number
}

export type CharacterBuilderEquipmentCatalogRecord = {
  id: string
  label: string
  category?: EquipmentCategoryCode
  isContainer: boolean
  maxStack?: number
  properties: EquipmentPropertyCode[]
  requiresAttunement: boolean
}

export function toCharacterBuilderEquipmentCatalogRecord(
  equipment: ResolvedEquipment | CharacterBuilderEquipmentCatalogRecord
): CharacterBuilderEquipmentCatalogRecord {
  if ('isContainer' in equipment) return { ...equipment, properties: [...equipment.properties] }
  const maxStack =
    equipment.maxStack != null && equipment.maxStack > 0 ? equipment.maxStack : undefined
  return {
    id: equipment.id,
    label: equipment.label,
    category: equipment.category,
    isContainer: Boolean(equipment.capacity),
    maxStack: equipment.charges ? 1 : maxStack,
    properties: [...equipment.properties],
    requiresAttunement: equipment.requiresAttunement ?? false
  }
}
export type CharacterBuilderFeatCatalogRecord = {
  id: string
  label: string
}

export type CharacterBuilderSpellCatalogRecord = Pick<
  SpellAuthored,
  | 'attributes'
  | 'castingTime'
  | 'classIds'
  | 'components'
  | 'description'
  | 'id'
  | 'label'
  | 'level'
  | 'magicSchoolId'
  | 'materialDescription'
>

export function toCharacterBuilderSpellCatalogRecord(
  spell: SpellAuthored
): CharacterBuilderSpellCatalogRecord {
  return {
    id: spell.id,
    label: spell.label,
    attributes: spell.attributes,
    castingTime: spell.castingTime,
    classIds: spell.classIds,
    components: spell.components,
    description: spell.description,
    level: spell.level,
    magicSchoolId: spell.magicSchoolId,
    materialDescription: spell.materialDescription
  }
}

export interface CharacterBuilderCatalog {
  races: CharacterBuilderRaceCatalogRecord[]
  classes: CharacterBuilderClassCatalogRecord[]
  backgrounds: CharacterBuilderBackgroundCatalogRecord[]
  equipment: CharacterBuilderEquipmentCatalogRecord[]
  feats: CharacterBuilderFeatCatalogRecord[]
  spells: CharacterBuilderSpellCatalogRecord[]
}

export function createCharacterBuilderCatalog({
  system,
  races,
  classes,
  backgrounds,
  equipment,
  feats,
  spells
}: {
  system: SystemAuthoredDto | null
  races: readonly ResolvedRace[]
  classes: readonly ClassAuthored[]
  backgrounds: readonly BackgroundAuthored[]
  equipment: readonly (ResolvedEquipment | CharacterBuilderEquipmentCatalogRecord)[]
  feats: readonly CharacterBuilderFeatCatalogRecord[]
  spells: CharacterBuilderSpellCatalogRecord[]
}): CharacterBuilderCatalog {
  const equipmentById = new Map(
    equipment.map((item) => [item.id, { label: item.label, category: item.category ?? null }])
  )
  return {
    races: races.flatMap((race) => {
      return [
        {
          id: race.id,
          label: race.label,
          category: race.category,
          parentRaceId:
            race.category === RACE_CATEGORY_CODE.SUBRACE ? race.parentRaceId : undefined,
          description: race.description,
          selectionMode: race.category === RACE_CATEGORY_CODE.BASE ? race.selectionMode : undefined,
          sizeLabel: SIZE_OPTIONS.find((size) => size.code === race.size)?.label,
          speedLabels: (race.speeds ?? []).map((speed) => {
            const speedLabel = system?.speeds.find(
              (candidate) => candidate.id === speed.speedId
            )?.label
            return `${speedLabel ?? 'Speed'} ${speed.amount} ${MEASUREMENT_UNIT_REGISTRY[speed.unit].short}`
          }),
          abilityScoreIncreaseFacts: getRaceAbilityScoreIncreaseFacts(race)
        }
      ]
    }),
    classes: classes.flatMap((classRecord) => {
      const proficiencies = 'proficiencies' in classRecord ? (classRecord.proficiencies ?? []) : []
      return [
        {
          id: classRecord.id,
          label: classRecord.label,
          category: classRecord.category,
          parentClassId:
            classRecord.category === CLASS_CATEGORY.SUBCLASS
              ? classRecord.parentClassId
              : undefined,
          subclassSelectionLevel:
            classRecord.category === CLASS_CATEGORY.BASE
              ? classRecord.subclassSelectionLevel
              : undefined,
          description: classRecord.description,
          hitpoint: classRecord.category === CLASS_CATEGORY.BASE ? classRecord.hitpoint : undefined,
          requirementGroups:
            classRecord.category === CLASS_CATEGORY.BASE
              ? classRecord.multiclass.requirementGroups
              : undefined,
          savingThrowLabels: proficiencies
            .flatMap((proficiency) =>
              proficiency.proficiencyKind === PROFICIENCY_KIND.SAVE_ABILITY &&
              'abilities' in proficiency
                ? (proficiency.abilities ?? [])
                : []
            )
            .map(
              (ability) =>
                ABILITY_OPTIONS.find((candidate) => candidate.code === ability)?.label ?? ability
            ),
          proficiencyGroups: getClassProficiencyGroups(
            proficiencies,
            system?.skills ?? [],
            system?.languages ?? [],
            equipmentById
          )
        }
      ]
    }),
    backgrounds: backgrounds.flatMap((background) => {
      const grantFacts = getBackgroundGrantFacts(
        background,
        system?.skills ?? [],
        system?.languages ?? [],
        equipmentById
      )
      const featureLabels = (background.features ?? []).map((feature) => feature.label)
      return [
        {
          id: background.id,
          label: background.label,
          description: background.description,
          summary: toPlainText(background.description ?? ''),
          grantFacts: grantFacts.slice(0, 4),
          featureLabels: featureLabels.slice(0, 2),
          hiddenGrantFactCount: Math.max(0, grantFacts.length - 4),
          hiddenFeatureCount: Math.max(0, featureLabels.length - 2)
        }
      ]
    }),
    equipment: equipment.map(toCharacterBuilderEquipmentCatalogRecord),
    feats: feats.map(({ id, label }) => ({ id, label })),
    spells
  }
}

type ClassProficiency = NonNullable<
  Extract<ClassAuthored, { category: typeof CLASS_CATEGORY.BASE }>['proficiencies']
>[number]

export function getRaceAbilityScoreIncreaseFacts(
  race: Pick<ResolvedRace, 'features'> | undefined
): Array<{ label: string; value: string }> {
  const facts: Array<{ label: string; value: string }> = []

  for (const feature of race?.features ?? []) {
    if (feature.label !== 'Ability Score Increase') continue

    const fixedFacts = (feature.grants?.modifiers ?? []).flatMap((modifier) => {
      const fact = getFixedAbilityScoreIncreaseFact(modifier)
      return fact ? [fact] : []
    })
    const uniformValue = fixedFacts[0]?.value
    const fixedLabels = new Set(fixedFacts.map((fact) => fact.label))
    if (
      uniformValue &&
      fixedFacts.every((fact) => fact.value === uniformValue) &&
      ABILITY_OPTIONS.every((ability) => fixedLabels.has(ability.label))
    ) {
      facts.push({ label: 'All abilities', value: uniformValue })
    } else {
      facts.push(...fixedFacts)
    }

    const optionAmounts = [
      ...new Set(
        (feature.options ?? [])
          .flatMap((option) => option.grants?.modifiers ?? [])
          .flatMap((modifier) => {
            const fact = getFixedAbilityScoreIncreaseFact(modifier)
            return fact ? [fact.value] : []
          })
      )
    ]

    for (const choice of feature.optionChoices ?? []) {
      if (choice.count < 1) continue
      facts.push({
        label: `Choose ${choice.count} ${choice.count === 1 ? 'ability' : 'abilities'}`,
        value: optionAmounts.length === 1 ? `${optionAmounts[0]} each` : 'See options'
      })
    }
  }

  return facts
}

function getFixedAbilityScoreIncreaseFact(
  modifier: ModifierGrantAuthored
): { label: string; value: string } | null {
  if (modifier.valueDomainCode !== 'ABILITY_SCORE' || modifier.modifierKind !== 'BONUS') {
    return null
  }
  if (
    typeof modifier.payload !== 'object' ||
    modifier.payload === null ||
    !('valueKind' in modifier.payload) ||
    modifier.payload.valueKind !== 'FIXED' ||
    !('amount' in modifier.payload) ||
    typeof modifier.payload.amount !== 'number'
  ) {
    return null
  }

  return {
    label:
      ABILITY_OPTIONS.find((ability) => ability.code === modifier.domain.ability)?.label ??
      modifier.domain.ability,
    value: `+${modifier.payload.amount}`
  }
}

function getClassProficiencyGroups(
  proficiencies: ClassProficiency[],
  skills: Array<{ id: string; label: string }>,
  languages: Array<{ id: string; label: string }>,
  equipmentById: Map<string, { category: string | null; label: string }>
): Array<{ label: string; entries: string[]; grantedEntries: string[] }> {
  const entriesByGroup = new Map<string, string[]>([
    ['Armor', []],
    ['Weapons', []],
    ['Tools', []],
    ['Skills', []],
    ['Languages', []],
    ['Other', []]
  ])
  const grantedEntriesByGroup = new Map(
    [...entriesByGroup.keys()].map((group) => [group, [] as string[]])
  )
  const append = (group: string, entries: string[], granted = true) => {
    entriesByGroup.get(group)?.push(...entries)
    if (granted) grantedEntriesByGroup.get(group)?.push(...entries)
  }

  for (const proficiency of proficiencies) {
    if (proficiency.proficiencyKind === PROFICIENCY_KIND.SAVE_ABILITY) continue

    if (proficiency.proficiencyKind === PROFICIENCY_KIND.SKILL) {
      const skillIds =
        'skillIds' in proficiency ? (proficiency.skillIds ?? []) : skills.map((skill) => skill.id)
      append(
        'Skills',
        formatChosenProficiency(proficiency, skillIds, skills),
        proficiency.selectionKind !== 'CHOSEN'
      )
      continue
    }
    if (proficiency.proficiencyKind === PROFICIENCY_KIND.LANGUAGE) {
      const languageIds =
        'languageIds' in proficiency
          ? (proficiency.languageIds ?? [])
          : languages.map((language) => language.id)
      append(
        'Languages',
        formatChosenProficiency(proficiency, languageIds, languages),
        proficiency.selectionKind !== 'CHOSEN'
      )
      continue
    }
    if (
      proficiency.proficiencyKind === PROFICIENCY_KIND.EQUIPMENT_PROPERTY &&
      'properties' in proficiency
    ) {
      const group =
        proficiency.category === 'SHIELD' || proficiency.category === 'ARMOR'
          ? 'Armor'
          : proficiency.category === 'WEAPON'
            ? 'Weapons'
            : proficiency.category === 'TOOL'
              ? 'Tools'
              : 'Other'
      append(
        group,
        proficiency.properties.map((property) => {
          const propertyLabel =
            property in EQUIPMENT_PROPERTY_REGISTRY
              ? EQUIPMENT_PROPERTY_REGISTRY[property as EquipmentPropertyCode].label
              : formatCatalogLabel(property)
          if (group === 'Armor') return `${propertyLabel} armor`
          if (group === 'Weapons') return `${propertyLabel} weapons`
          if (group === 'Tools') return `${propertyLabel} tools`
          return propertyLabel
        }),
        proficiency.selectionKind !== 'CHOSEN'
      )
      continue
    }
    if (proficiency.proficiencyKind === PROFICIENCY_KIND.EQUIPMENT) {
      if (!('equipmentIds' in proficiency) || !proficiency.equipmentIds?.length) {
        const group =
          proficiency.category === 'SHIELD' || proficiency.category === 'ARMOR'
            ? 'Armor'
            : proficiency.category === 'WEAPON'
              ? 'Weapons'
              : proficiency.category === 'TOOL'
                ? 'Tools'
                : 'Other'
        const entry =
          proficiency.category === 'SHIELD'
            ? 'Shields'
            : proficiency.category === 'ARMOR'
              ? 'Armor'
              : proficiency.category === 'WEAPON'
                ? 'Weapons'
                : proficiency.category === 'TOOL'
                  ? 'Tools'
                  : 'Equipment'
        append(group, [entry], proficiency.selectionKind !== 'CHOSEN')
        continue
      }
      const grouped = new Map<string, string[]>()
      for (const equipmentId of proficiency.equipmentIds ?? []) {
        const equipment = equipmentById.get(equipmentId)
        const group =
          equipment?.category === 'SHIELD' || equipment?.category === 'ARMOR'
            ? 'Armor'
            : equipment?.category === 'WEAPON'
              ? 'Weapons'
              : equipment?.category === 'TOOL'
                ? 'Tools'
                : 'Other'
        const entries = grouped.get(group) ?? []
        entries.push(equipment?.label ?? equipmentId)
        grouped.set(group, entries)
      }
      for (const [group, entries] of grouped) {
        append(group, entries, proficiency.selectionKind !== 'CHOSEN')
      }
      continue
    }
    append(
      'Other',
      [formatCatalogLabel(proficiency.proficiencyKind)],
      proficiency.selectionKind !== 'CHOSEN'
    )
  }

  return [...entriesByGroup]
    .filter(([, entries]) => entries.length > 0)
    .map(([label, entries]) => ({
      label,
      entries,
      grantedEntries: grantedEntriesByGroup.get(label) ?? []
    }))
}

function getBackgroundGrantFacts(
  background: BackgroundAuthored | undefined,
  skills: Array<{ id: string; label: string }>,
  languages: Array<{ id: string; label: string }>,
  equipmentById: Map<string, { category: string | null; label: string }>
): Array<{ label: string; value: string }> {
  return getClassProficiencyGroups(
    background?.proficiencies ?? [],
    skills,
    languages,
    equipmentById
  )
    .filter((group) => group.entries.length > 0)
    .map((group) => ({ label: group.label, value: group.entries.join(', ') }))
}

export function toPlainText(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatChosenProficiency(
  proficiency: ClassProficiency,
  ids: string[],
  vocabulary: Array<{ id: string; label: string }>
): string[] {
  const labels = ids
    .map((id) => vocabulary.find((entry) => entry.id === id)?.label ?? id)
    .sort((left, right) => left.localeCompare(right, 'en'))
  if (proficiency.selectionKind !== 'CHOSEN') return labels
  const count = 'count' in proficiency ? proficiency.count : 0
  const hasEveryVocabularyEntry =
    vocabulary.length > 0 && vocabulary.every((entry) => ids.includes(entry.id))
  return [
    hasEveryVocabularyEntry ? `Choose any ${count}` : `Choose ${count} from ${labels.join(', ')}`
  ]
}

function formatCatalogLabel(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}
