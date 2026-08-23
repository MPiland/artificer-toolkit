import {
  createAuthoredVersionRepository,
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
  AUTHORED_RECORD_STATUS,
  CASTING_TIME_UNIT_REGISTRY,
  CLASS_CATEGORY,
  EQUIPMENT_PROPERTY_REGISTRY,
  MEASUREMENT_UNIT_REGISTRY,
  PROFICIENCY_KIND,
  RACE_CATEGORY_CODE,
  SIZE_OPTIONS,
  SPELL_ATTRIBUTE_REGISTRY,
  type CastingTimeUnitCode,
  type EquipmentCategoryCode,
  type EquipmentPropertyCode,
  type SpellAttribute
} from '@artificer-toolkit/shared/core'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import type {
  ClassAuthored,
  BackgroundAuthored,
  SpellAuthored,
  FeatAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import type { ModifierGrantAuthored } from '@artificer-toolkit/shared/authored'
import type { ResolvedRace } from '@artificer-toolkit/shared/subjects/compilers'
import type { HydratedCampaignBuilderContent } from './campaignCharacterContent.js'
import {
  resolveActiveCharacterEquipment,
  resolveActiveCharacterRaces
} from './versionedCharacterContent.js'

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
      content.spells.map(toCharacterBuilderSpellCatalogRecord)
    )
  }
}

type CharacterBuilderCatalogLoadOptions = {
  includeSpells: boolean
}

export async function loadCharacterBuilderSpellCatalog(
  db: DBLike,
  systemId: string,
  userId: string
): Promise<CharacterBuilderSpellCatalogRecord[]> {
  const { items, meta } = await getSpellListQuery(db, { systemId })
  return items.flatMap((item) => {
    if (
      item.status !== AUTHORED_RECORD_STATUS.ACTIVE ||
      item.systemId !== systemId ||
      (!item.isMaster && item.ownerUserId !== userId) ||
      !item.magicSchoolId ||
      !(item.castingTimeUnit in CASTING_TIME_UNIT_REGISTRY)
    ) {
      return []
    }
    const attributes = meta.attributes.flatMap((attribute) =>
      attribute.spellIds.includes(item.id) && attribute.id in SPELL_ATTRIBUTE_REGISTRY
        ? [attribute.id as SpellAttribute]
        : []
    )
    const classIds = meta.classes.flatMap((classRecord) =>
      classRecord.spellIds.includes(item.id) ? [classRecord.id] : []
    )
    return [
      {
        id: item.id,
        label: item.label,
        attributes,
        castingTime: {
          unit: item.castingTimeUnit as CastingTimeUnitCode,
          amount: item.castingTimeAmount
        },
        classIds,
        description: item.description ?? '',
        level: item.level,
        magicSchoolId: item.magicSchoolId,
        ...(item.materialDescription ? { materialDescription: item.materialDescription } : {})
      }
    ]
  })
}

/**
 * Loads only the spell documents relevant to a structural Character command.
 * The caller supplies the bounded active action/source ids; current authored
 * versions remain the exact source of the rule facts.
 */
export async function loadCharacterStructuralSpellCatalog(input: {
  db: DBLike
  systemId: string
  userId: string
  campaignSpells?: readonly SpellAuthored[]
  spellIds: readonly string[]
}): Promise<SpellAuthored[]> {
  const spellIds = [...new Set(input.spellIds)]
  if (spellIds.length > 500) {
    throw new Error('Character structural spell candidates exceed the bounded catalogue limit.')
  }
  if (spellIds.length === 0) return []
  const requestedIds = new Set(spellIds)
  const campaign = (input.campaignSpells ?? []).flatMap((candidate) => {
    if (!requestedIds.has(candidate.id)) return []
    const parsed = spellAuthoredDtoSchema.safeParse(candidate)
    return parsed.success &&
      parsed.data.id === candidate.id &&
      parsed.data.systemId === input.systemId
      ? [parsed.data as unknown as SpellAuthored]
      : []
  })
  const versions = await createAuthoredVersionRepository(input.db).findActiveByIds({
    subjectKind: 'SPELL',
    subjectIds: spellIds,
    systemId: input.systemId,
    userId: input.userId,
    includeMaster: true
  })
  const canonical = spellIds.flatMap((spellId) => {
    const version = versions.get(spellId)
    if (!version) return []
    const parsed = spellAuthoredDtoSchema.safeParse(version.authored.document)
    return parsed.success && parsed.data.id === spellId && parsed.data.systemId === input.systemId
      ? [parsed.data as unknown as SpellAuthored]
      : []
  })
  return replaceCatalogRecords(canonical, campaign)
}

/** The selected base classes' active subclasses are the only class chooser facts a save needs. */
export async function loadCharacterStructuralSubclassCatalog(input: {
  db: DBLike
  systemId: string
  userId: string
  baseClassIds: readonly string[]
  campaignSubclasses?: readonly Extract<
    ClassAuthored,
    { category: typeof CLASS_CATEGORY.SUBCLASS }
  >[]
}): Promise<CharacterBuilderClassCatalogRecord[]> {
  const baseClassIds = [...new Set(input.baseClassIds)]
  if (baseClassIds.length === 0) return []
  const rows = await input.db
    .selectFrom('classes')
    .select(['id', 'active_version_id'])
    .where('system_id', '=', input.systemId)
    .where('category', '=', CLASS_CATEGORY.SUBCLASS)
    .where('parent_class_id', 'in', baseClassIds)
    .where((expression) =>
      expression.or([expression('is_master', '=', true), expression('user_id', '=', input.userId)])
    )
    .limit(501)
    .execute()
  const ids = rows.flatMap((row) => (row.active_version_id ? [row.id] : []))
  const campaign = (input.campaignSubclasses ?? []).filter((record) =>
    baseClassIds.includes(record.parentClassId)
  )
  if (new Set([...ids, ...campaign.map((record) => record.id)]).size > 500) {
    throw new Error('Character structural subclass candidates exceed the bounded catalogue limit.')
  }
  if (ids.length === 0 && campaign.length === 0) return []
  const versions = await createAuthoredVersionRepository(input.db).findActiveByIds({
    subjectKind: 'CLASS',
    subjectIds: ids,
    systemId: input.systemId,
    userId: input.userId,
    includeMaster: true
  })
  const canonical = ids.flatMap((id) => {
    const record = versions.get(id)?.authored.document as ClassAuthored | undefined
    return record?.category === CLASS_CATEGORY.SUBCLASS
      ? [
          {
            id: record.id,
            label: record.label,
            category: record.category,
            parentClassId: record.parentClassId,
            description: record.description
          }
        ]
      : []
  })
  const campaignCatalog = campaign.map((record) => ({
    id: record.id,
    label: record.label,
    category: record.category,
    parentClassId: record.parentClassId,
    description: record.description
  }))
  return replaceCatalogRecords(canonical, campaignCatalog)
}

export async function loadCharacterBuilderCatalog(
  db: DBLike,
  systemId: string,
  userId: string,
  options: CharacterBuilderCatalogLoadOptions
): Promise<CharacterBuilderCatalog> {
  const [raceResult, classResult, backgroundResult, equipmentResult, featResult, spells] =
    await Promise.all([
      getRaceListQuery(db, { systemId }),
      getClassListQuery(db, { systemId }),
      getBackgroundListQuery(db, { systemId }),
      getEquipmentListQuery(db, { systemId }),
      getFeatListQuery(db, { systemId }),
      options.includeSpells
        ? loadCharacterBuilderSpellCatalog(db, systemId, userId)
        : Promise.resolve([])
    ])

  const versions = createAuthoredVersionRepository(db)
  const [
    resolvedRaces,
    resolvedEquipment,
    classVersions,
    backgroundVersions,
    featVersions,
    system
  ] = await Promise.all([
    resolveActiveCharacterRaces(
      db,
      raceResult.items.map((record) => record.id),
      systemId,
      userId
    ),
    resolveActiveCharacterEquipment(
      db,
      equipmentResult.items.map((record) => record.id),
      systemId,
      userId
    ),
    versions.findActiveByIds({
      subjectKind: 'CLASS',
      subjectIds: classResult.items.map((record) => record.id),
      systemId,
      userId,
      includeMaster: true
    }),
    versions.findActiveByIds({
      subjectKind: 'BACKGROUND',
      subjectIds: backgroundResult.items.map((record) => record.id),
      systemId,
      userId,
      includeMaster: true
    }),
    versions.findActiveByIds({
      subjectKind: 'FEAT',
      subjectIds: featResult.items.map((record) => record.id),
      systemId,
      userId,
      includeMaster: true
    }),
    createSystemRepository(db).findById(systemId)
  ])
  const classesById = new Map(
    [...classVersions.entries()].map(([id, version]) => [
      id,
      version.authored.document as ClassAuthored
    ])
  )
  const backgroundsById = new Map(
    [...backgroundVersions.entries()].map(([id, version]) => [
      id,
      version.authored.document as BackgroundAuthored
    ])
  )
  const featsById = new Map(
    [...featVersions.entries()].map(([id, version]) => [
      id,
      version.authored.document as FeatAuthored
    ])
  )
  const racesById = new Map(resolvedRaces.map((race) => [race.id, race]))
  const equipmentById = new Map(resolvedEquipment.map((equipment) => [equipment.id, equipment]))

  return {
    races: raceResult.items.flatMap((record) => {
      const race = racesById.get(record.id)
      if (!race) return []
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
    classes: classResult.items.flatMap((record) => {
      const classRecord = classesById.get(record.id)
      if (!classRecord) return []
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
    backgrounds: backgroundResult.items.flatMap((record) => {
      const background = backgroundsById.get(record.id)
      if (!background) return []
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
    equipment: equipmentResult.items.flatMap((record) => {
      const equipment = equipmentById.get(record.id)
      if (!equipment) return []
      const maxStack =
        equipment.maxStack != null && equipment.maxStack > 0 ? equipment.maxStack : undefined
      return [
        {
          id: equipment.id,
          label: equipment.label,
          category: equipment.category,
          isContainer: Boolean(equipment.capacity),
          maxStack: equipment.charges ? 1 : maxStack,
          properties: [...equipment.properties],
          requiresAttunement: equipment.requiresAttunement ?? false
        }
      ]
    }),
    feats: featResult.items.flatMap((record) => {
      const feat = featsById.get(record.id)
      return feat ? [{ id: feat.id, label: feat.label }] : []
    }),
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
