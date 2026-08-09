import {
  createClassRepository,
  createBackgroundRepository,
  createRaceRepository,
  createSystemRepository,
  getBackgroundListQuery,
  getClassListQuery,
  getEquipmentListQuery,
  getFeatListQuery,
  getRaceListQuery,
  getSpellListQuery,
  type DBLike
} from '@artificer-toolkit/db'
import {
  ABILITY_OPTIONS,
  CASTING_TIME_UNIT_CODE,
  CLASS_CATEGORY,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  EQUIPMENT_PROPERTY_REGISTRY,
  MEASUREMENT_UNIT_REGISTRY,
  PROFICIENCY_KIND,
  RACE_CATEGORY_CODE,
  SIZE_OPTIONS,
  SPELL_ATTRIBUTE,
  SPELL_COMPONENT,
  type EquipmentCategoryCode,
  type EquipmentPropertyCode
} from '@artificer-toolkit/shared/core'
import type {
  ClassAuthored,
  BackgroundAuthored,
  SpellAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import type { ModifierGrantAuthored } from '@artificer-toolkit/shared/authored'
import type { ResolvedRace } from '@artificer-toolkit/shared/subjects/compilers'
import type { HydratedCampaignBuilderContent } from './campaignCharacterContent.js'

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

export interface CharacterBuilderCatalog {
  races: CharacterBuilderRaceCatalogRecord[]
  classes: CharacterBuilderClassCatalogRecord[]
  backgrounds: CharacterBuilderBackgroundCatalogRecord[]
  equipment: CharacterBuilderEquipmentCatalogRecord[]
  feats: CharacterBuilderFeatCatalogRecord[]
  spells: CharacterBuilderSpellCatalogRecord[]
}

function replaceCatalogRecords<T extends { id: string }>(
  current: readonly T[],
  campaign: readonly T[]
): T[] {
  const campaignIds = new Set(campaign.map((record) => record.id))
  return [...current.filter((record) => !campaignIds.has(record.id)), ...campaign]
}

export function mergeCampaignContentIntoCharacterBuilderCatalog(
  catalog: CharacterBuilderCatalog,
  content: HydratedCampaignBuilderContent
): CharacterBuilderCatalog {
  return {
    races: replaceCatalogRecords(
      catalog.races,
      content.races.map((race) => ({
        id: race.id,
        label: race.label,
        category: race.category,
        parentRaceId: race.category === RACE_CATEGORY_CODE.SUBRACE ? race.parentRaceId : undefined,
        description: race.description,
        selectionMode: race.category === RACE_CATEGORY_CODE.BASE ? race.selectionMode : undefined,
        sizeLabel: SIZE_OPTIONS.find((size) => size.code === race.size)?.label,
        abilityScoreIncreaseFacts: getRaceAbilityScoreIncreaseFacts(race)
      }))
    ),
    classes: replaceCatalogRecords(
      catalog.classes,
      content.classes.map((record) => ({
        id: record.id,
        label: record.label,
        category: record.category,
        parentClassId:
          record.category === CLASS_CATEGORY.SUBCLASS ? record.parentClassId : undefined,
        subclassSelectionLevel:
          record.category === CLASS_CATEGORY.BASE ? record.subclassSelectionLevel : undefined,
        description: record.description,
        hitpoint: record.category === CLASS_CATEGORY.BASE ? record.hitpoint : undefined,
        requirementGroups:
          record.category === CLASS_CATEGORY.BASE ? record.multiclass.requirementGroups : undefined
      }))
    ),
    backgrounds: replaceCatalogRecords(
      catalog.backgrounds,
      content.backgrounds.map((record) => ({
        id: record.id,
        label: record.label,
        description: record.description,
        summary: toPlainText(record.description ?? ''),
        grantFacts: [],
        featureLabels: (record.features ?? []).slice(0, 2).map((feature) => feature.label),
        hiddenGrantFactCount: 0,
        hiddenFeatureCount: Math.max(0, (record.features?.length ?? 0) - 2)
      }))
    ),
    equipment: replaceCatalogRecords(
      catalog.equipment,
      content.equipment.map((record) => ({
        id: record.id,
        label: record.label,
        category: record.category,
        isContainer: Boolean(record.capacity),
        maxStack: record.maxStack,
        properties: [...record.properties],
        requiresAttunement: record.requiresAttunement ?? false
      }))
    ),
    feats: replaceCatalogRecords(
      catalog.feats,
      content.feats.map((record) => ({ id: record.id, label: record.label }))
    ),
    spells: replaceCatalogRecords(
      catalog.spells,
      content.spells.map((record) => ({
        id: record.id,
        label: record.label,
        attributes: record.attributes,
        castingTime: record.castingTime,
        classIds: record.classIds,
        components: record.components,
        description: record.description,
        level: record.level,
        magicSchoolId: record.magicSchoolId,
        materialDescription: record.materialDescription
      }))
    )
  }
}

type CharacterBuilderCatalogLoadOptions = {
  includeSpells: boolean
}

function requireRaceCategory(id: string, value: string): ResolvedRace['category'] {
  if (!(value in RACE_CATEGORY_CODE)) {
    throw new Error(`Race "${id}" has unsupported category "${value}".`)
  }

  return value as ResolvedRace['category']
}

function requireClassCategory(id: string, value: string | null): ClassAuthored['category'] {
  if (!value || !(value in CLASS_CATEGORY)) {
    throw new Error(`Class "${id}" has unsupported category "${value ?? 'null'}".`)
  }

  return value as ClassAuthored['category']
}

function requireEquipmentCategory(
  id: string,
  value: string | null
): EquipmentCategoryCode | undefined {
  if (value === null) return undefined
  if (!(value in EQUIPMENT_CATEGORY_CODE)) {
    throw new Error(`Equipment "${id}" has unsupported category "${value}".`)
  }

  return value as EquipmentCategoryCode
}

function requireEquipmentProperty(id: string, value: string): EquipmentPropertyCode {
  if (!(value in EQUIPMENT_PROPERTY_CODE)) {
    throw new Error(`Equipment "${id}" has unsupported property "${value}".`)
  }

  return value as EquipmentPropertyCode
}

function requireSpellCastingTimeUnit(
  spellId: string,
  value: string
): SpellAuthored['castingTime']['unit'] {
  if (!(value in CASTING_TIME_UNIT_CODE)) {
    throw new Error(`Spell "${spellId}" has unsupported casting time unit "${value}".`)
  }

  return value as SpellAuthored['castingTime']['unit']
}

function requireSpellMagicSchool(
  spellId: string,
  value: string | null
): SpellAuthored['magicSchoolId'] {
  if (!value) {
    throw new Error(`Spell "${spellId}" is missing its magic school.`)
  }

  return value
}

export async function loadCharacterBuilderSpellCatalog(
  db: DBLike,
  systemId: string
): Promise<CharacterBuilderSpellCatalogRecord[]> {
  const { items, meta } = await getSpellListQuery(db, { systemId })
  const attributeCodesBySpellId = new Map<string, string[]>()
  const classIdsBySpellId = new Map<string, string[]>()

  for (const group of meta.attributes) {
    for (const spellId of group.spellIds) {
      const codes = attributeCodesBySpellId.get(spellId) ?? []
      codes.push(group.id)
      attributeCodesBySpellId.set(spellId, codes)
    }
  }
  for (const group of meta.classes) {
    for (const spellId of group.spellIds) {
      const classIds = classIdsBySpellId.get(spellId) ?? []
      classIds.push(group.id)
      classIdsBySpellId.set(spellId, classIds)
    }
  }

  return items.map((item) => {
    const codes = attributeCodesBySpellId.get(item.id) ?? []
    const attributes = codes.filter(
      (code): code is NonNullable<SpellAuthored['attributes']>[number] => code in SPELL_ATTRIBUTE
    )
    const components = codes.filter(
      (code): code is NonNullable<SpellAuthored['components']>[number] => code in SPELL_COMPONENT
    )

    return {
      id: item.id,
      label: item.label,
      description: item.description ?? '',
      level: item.level,
      magicSchoolId: requireSpellMagicSchool(item.id, item.magicSchoolId),
      castingTime: {
        unit: requireSpellCastingTimeUnit(item.id, item.castingTimeUnit),
        amount: item.castingTimeAmount
      },
      classIds: classIdsBySpellId.get(item.id) ?? [],
      attributes: attributes.length > 0 ? attributes : undefined,
      components: components.length > 0 ? components : undefined,
      materialDescription: item.materialDescription ?? undefined
    }
  })
}

export async function loadCharacterBuilderCatalog(
  db: DBLike,
  systemId: string,
  options: CharacterBuilderCatalogLoadOptions
): Promise<CharacterBuilderCatalog> {
  const [raceResult, classResult, backgroundResult, equipmentResult, featResult, spells] =
    await Promise.all([
      getRaceListQuery(db, { systemId }),
      getClassListQuery(db, { systemId }),
      getBackgroundListQuery(db, { systemId }),
      getEquipmentListQuery(db, { systemId }),
      getFeatListQuery(db, { systemId }),
      options.includeSpells ? loadCharacterBuilderSpellCatalog(db, systemId) : Promise.resolve([])
    ])

  const [resolvedRaces, classesById, backgroundsById, system] = await Promise.all([
    createRaceRepository(db).findResolvedAll({ systemId, includeFeatureEffects: false }),
    createClassRepository(db).findByIds(
      classResult.items.map((record) => record.id),
      { systemId, allowedFeatureIds: new Set(), includeFeatureEffects: false }
    ),
    createBackgroundRepository(db).findByIds(
      backgroundResult.items.map((record) => record.id),
      { systemId, includeFeatureEffects: false }
    ),
    createSystemRepository(db).findById(systemId)
  ])
  const racesById = new Map(resolvedRaces.map((race) => [race.id, race]))
  const equipmentById = new Map(equipmentResult.items.map((item) => [item.id, item]))
  const effectiveMaxStackByEquipmentId = new Map<string, number | undefined>()
  const resolveEffectiveMaxStack = (
    equipmentId: string,
    lineage: ReadonlySet<string> = new Set()
  ): number | undefined => {
    if (effectiveMaxStackByEquipmentId.has(equipmentId)) {
      return effectiveMaxStackByEquipmentId.get(equipmentId)
    }
    if (lineage.has(equipmentId)) return undefined

    const equipment = equipmentById.get(equipmentId)
    if (!equipment) return undefined

    const authoredMaxStack =
      equipment.maxStack != null && equipment.maxStack > 0 ? equipment.maxStack : undefined
    const maxStack = equipment.chargeId
      ? 1
      : (authoredMaxStack ??
        (equipment.parentEquipmentId
          ? resolveEffectiveMaxStack(
              equipment.parentEquipmentId,
              new Set([...lineage, equipmentId])
            )
          : undefined))
    effectiveMaxStackByEquipmentId.set(equipmentId, maxStack)
    return maxStack
  }

  return {
    races: raceResult.items.map((record) => {
      const race = racesById.get(record.id)
      return {
        id: record.id,
        label: record.label,
        category: requireRaceCategory(record.id, record.category),
        parentRaceId: record.parentRaceId ?? undefined,
        description: race?.description,
        selectionMode: race?.category === RACE_CATEGORY_CODE.BASE ? race.selectionMode : undefined,
        sizeLabel: race ? SIZE_OPTIONS.find((size) => size.code === race.size)?.label : undefined,
        speedLabels: (race?.speeds ?? []).map((speed) => {
          const speedLabel = system?.speeds.find(
            (candidate) => candidate.id === speed.speedId
          )?.label
          return `${speedLabel ?? 'Speed'} ${speed.amount} ${MEASUREMENT_UNIT_REGISTRY[speed.unit].short}`
        }),
        abilityScoreIncreaseFacts: getRaceAbilityScoreIncreaseFacts(race)
      }
    }),
    classes: classResult.items.map((record) => {
      const classRecord = classesById.get(record.id)
      const proficiencies =
        classRecord && 'proficiencies' in classRecord ? (classRecord.proficiencies ?? []) : []
      return {
        id: record.id,
        label: record.label,
        category: requireClassCategory(record.id, record.category),
        parentClassId: record.parentClassId ?? undefined,
        subclassSelectionLevel: record.subclassSelectionLevel ?? undefined,
        description: classRecord?.description,
        hitpoint: classRecord && 'hitpoint' in classRecord ? classRecord.hitpoint : undefined,
        requirementGroups:
          classRecord && classRecord.category === CLASS_CATEGORY.BASE
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
    }),
    backgrounds: backgroundResult.items.map((record) => {
      const background = backgroundsById.get(record.id)
      const grantFacts = getBackgroundGrantFacts(
        background,
        system?.skills ?? [],
        system?.languages ?? [],
        equipmentById
      )
      const featureLabels = (background?.features ?? []).map((feature) => feature.label)
      return {
        id: record.id,
        label: record.label,
        description: background?.description,
        summary: toPlainText(background?.description ?? ''),
        grantFacts: grantFacts.slice(0, 4),
        featureLabels: featureLabels.slice(0, 2),
        hiddenGrantFactCount: Math.max(0, grantFacts.length - 4),
        hiddenFeatureCount: Math.max(0, featureLabels.length - 2)
      }
    }),
    equipment: equipmentResult.items.map((record) => ({
      id: record.id,
      label: record.label,
      category: requireEquipmentCategory(record.id, record.category),
      isContainer: record.capacityAmount !== null,
      maxStack: resolveEffectiveMaxStack(record.id),
      properties: record.properties.map((property) =>
        requireEquipmentProperty(record.id, property)
      ),
      requiresAttunement: record.requiresAttunement
    })),
    feats: featResult.items.map((record) => ({
      id: record.id,
      label: record.label
    })),
    spells
  }
}

type ClassProficiency = NonNullable<
  Extract<ClassAuthored, { category: typeof CLASS_CATEGORY.BASE }>['proficiencies']
>[number]

function getRaceAbilityScoreIncreaseFacts(
  race: ResolvedRace | undefined
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

function toPlainText(value: string): string {
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
