import type { CharacterBuilderResolution } from './builderTypes.js'
import { withGrantProse, type CharacterPresentationLookup } from './characterRuleContext.js'
import { getAvailableSubclassesForClass } from './builderEligibility.js'
import { evaluateMulticlassRequirements } from '@artificer-toolkit/shared/character'
import {
  ADVANCEMENT_METHOD_OPTIONS,
  CHARACTER_ABILITY_GENERATION_METHOD_OPTIONS,
  CLASS_CATEGORY,
  EQUIPMENT_CATEGORY_REGISTRY,
  EQUIPMENT_PROPERTY_REGISTRY,
  FEATURE_ATTRIBUTE,
  GRANT_KIND,
  HITPOINT_CALC_METHOD_OPTIONS,
  POINT_BUY_SCORE_OPTIONS,
  POINT_BUY_TOTAL_POINTS,
  SPELLCASTING_ATTRIBUTE,
  SPELL_ATTRIBUTE,
  STANDARD_ARRAY_SCORE_OPTIONS
} from '@artificer-toolkit/shared/core'
import {
  isSameCharacterProvenanceIdentity,
  type BackgroundAuthored,
  type CharacterAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import type { StartingEquipmentAuthored } from '@artificer-toolkit/shared/authored'
import type { CompiledFeature } from '@artificer-toolkit/shared/compilers'
import type { CompiledClass } from '@artificer-toolkit/shared/subjects/compilers'
import { startingEquipmentDtoSchema } from '@artificer-toolkit/schema/shared/startingEquipment'
import type {
  CharacterBuilderChoiceOptionDto,
  CharacterBuilderChosenGrantChoiceViewDto,
  CharacterBuilderFeatureChoiceViewDto,
  CharacterBuilderGrantSummaryItemDto,
  CharacterBuilderIntentCacheDto,
  CharacterBuilderPayloadDto,
  CharacterBuilderReferencesDto,
  CharacterBuilderResolutionDto,
  CharacterBuilderSpellChoiceViewDto,
  CharacterBuilderSpellOptionDto,
  CharacterBuilderViewDto
} from '@artificer-toolkit/schema/api/characterBuilder'
import type { CharacterBuilderClassCatalogRecord } from './builderCatalog.js'
import { findCurrentCharacterFeatureAcquisition } from './characterBuilderSelections.js'

type CharacterFeatureAcquisition = CharacterAuthored['intent']['featureAcquisitions'][number]

function toStartingEquipmentDto(startingEquipment: StartingEquipmentAuthored) {
  return startingEquipmentDtoSchema.parse(startingEquipment)
}

function buildStartingEquipmentChoiceLabels(
  startingEquipment: StartingEquipmentAuthored,
  equipmentOptions: CharacterBuilderChoiceOptionDto[]
): Record<string, string> {
  const equipmentLabels = new Map(equipmentOptions.map((option) => [option.id, option.label]))
  const labels: Record<string, string> = {}

  for (const item of startingEquipment.sets.flatMap((set) =>
    set.groups.flatMap((group) => group.options.flatMap((option) => option.items))
  )) {
    if (
      item.startingEquipmentKind !== 'EQUIPMENT' ||
      !('selectionKind' in item) ||
      item.selectionKind !== 'CHOSEN' ||
      !('count' in item)
    )
      continue

    const properties = item.properties ?? []
    if (
      item.authoringModeKind === 'ALL' &&
      item.count === 1 &&
      !item.category &&
      properties.length === 1
    ) {
      const propertyLabel = EQUIPMENT_PROPERTY_REGISTRY[properties[0]]?.label
      if (propertyLabel) {
        labels[item.id] = `Any ${propertyLabel.toLocaleLowerCase()}`
        continue
      }
    }

    const target =
      item.authoringModeKind === 'SELECTED'
        ? item.equipmentIds
            .map((equipmentId) => equipmentLabels.get(equipmentId) ?? equipmentId)
            .join(' or ')
        : [
            properties
              .map(
                (property) =>
                  EQUIPMENT_PROPERTY_REGISTRY[property]?.label.toLocaleLowerCase() ??
                  property.toLocaleLowerCase().replaceAll('_', ' ')
              )
              .join(' '),
            item.category
              ? (EQUIPMENT_CATEGORY_REGISTRY[item.category]?.label.toLocaleLowerCase() ??
                item.category.toLocaleLowerCase().replaceAll('_', ' '))
              : 'equipment'
          ]
            .filter(Boolean)
            .join(' ')

    labels[item.id] = `Choose ${item.count} ${target}`
  }

  return labels
}
type CharacterSpellSelection = NonNullable<CharacterAuthored['intent']['spellSelections']>[number]
type CharacterProvenance = CharacterFeatureAcquisition['source']

const FEATURE_CHOICE_SELECTION_KEY = 'options'

function getSelectedClassProficiencyGroups(
  classRecord: CharacterBuilderClassCatalogRecord | undefined,
  classId: string,
  choices: CharacterBuilderResolution['chosenGrantChoices']
): Array<{
  category: string
  label: string
  grantedEntries: string[]
  choiceInstructions: Array<{ label: string; required: boolean }>
  choiceIds: string[]
}> {
  if (!classRecord || classRecord.category !== CLASS_CATEGORY.BASE) return []
  const groups = new Map([
    [
      'ARMOR',
      {
        category: 'ARMOR',
        label: 'Armor',
        grantedEntries: [] as string[],
        choiceInstructions: [] as Array<{ label: string; required: boolean }>,
        choiceIds: [] as string[]
      }
    ],
    [
      'WEAPONS',
      {
        category: 'WEAPONS',
        label: 'Weapons',
        grantedEntries: [] as string[],
        choiceInstructions: [] as Array<{ label: string; required: boolean }>,
        choiceIds: [] as string[]
      }
    ],
    [
      'TOOLS',
      {
        category: 'TOOLS',
        label: 'Tools',
        grantedEntries: [] as string[],
        choiceInstructions: [] as Array<{ label: string; required: boolean }>,
        choiceIds: [] as string[]
      }
    ],
    [
      'SAVING_THROWS',
      {
        category: 'SAVING_THROWS',
        label: 'Saving Throws',
        grantedEntries: [] as string[],
        choiceInstructions: [] as Array<{ label: string; required: boolean }>,
        choiceIds: [] as string[]
      }
    ],
    [
      'SKILLS',
      {
        category: 'SKILLS',
        label: 'Skills',
        grantedEntries: [] as string[],
        choiceInstructions: [] as Array<{ label: string; required: boolean }>,
        choiceIds: [] as string[]
      }
    ],
    [
      'LANGUAGES',
      {
        category: 'LANGUAGES',
        label: 'Languages',
        grantedEntries: [] as string[],
        choiceInstructions: [] as Array<{ label: string; required: boolean }>,
        choiceIds: [] as string[]
      }
    ],
    [
      'OTHER',
      {
        category: 'OTHER',
        label: 'Other',
        grantedEntries: [] as string[],
        choiceInstructions: [] as Array<{ label: string; required: boolean }>,
        choiceIds: [] as string[]
      }
    ]
  ])
  const categoryFor = (kind: string, category?: string): string => {
    if (kind === 'SAVE_ABILITY') return 'SAVING_THROWS'
    if (kind === 'SKILL') return 'SKILLS'
    if (kind === 'LANGUAGE') return 'LANGUAGES'
    if (category === 'ARMOR' || category === 'SHIELD') return 'ARMOR'
    if (category === 'WEAPON') return 'WEAPONS'
    if (category === 'TOOL') return 'TOOLS'
    return 'OTHER'
  }
  const categoryForLabel = new Map([
    ['Armor', 'ARMOR'],
    ['Weapons', 'WEAPONS'],
    ['Tools', 'TOOLS'],
    ['Skills', 'SKILLS'],
    ['Languages', 'LANGUAGES'],
    ['Other', 'OTHER']
  ])

  for (const proficiencyGroup of classRecord.proficiencyGroups ?? []) {
    const category = categoryForLabel.get(proficiencyGroup.label) ?? 'OTHER'
    const group = groups.get(category)
    group?.grantedEntries.push(...proficiencyGroup.grantedEntries)
    group?.choiceInstructions.push(
      ...proficiencyGroup.entries
        .filter((entry) => !proficiencyGroup.grantedEntries.includes(entry))
        .map((label) => ({ label, required: true }))
    )
  }
  groups.get('SAVING_THROWS')?.grantedEntries.push(...(classRecord.savingThrowLabels ?? []))

  for (const choice of choices) {
    if (
      choice.grantKind !== GRANT_KIND.PROFICIENCY_GRANT ||
      choice.ownerFeatureId !== undefined ||
      choice.source.kind !== 'CLASS' ||
      choice.source.classId !== classId ||
      !choice.proficiencyKind
    )
      continue

    groups
      .get(categoryFor(choice.proficiencyKind, choice.displayCategory))
      ?.choiceIds.push(choice.id)
  }
  return [...groups.values()].filter(
    (group) =>
      group.grantedEntries.length > 0 ||
      group.choiceInstructions.length > 0 ||
      group.choiceIds.length > 0
  )
}

export function stripCharacterBuilderResolution(
  resolution: CharacterBuilderResolution
): CharacterBuilderResolutionDto {
  return {
    mode: resolution.mode,
    summary: resolution.summary,
    grants: resolution.grants,
    outstandingChoices: resolution.outstandingChoices,
    validations: resolution.validations,
    readiness: resolution.readiness,
    recommendedSectionId: resolution.recommendedSectionId
  }
}

export function toCharacterBuilderPayload(
  character: CharacterAuthored,
  resolution: CharacterBuilderResolution,
  presentation: CharacterPresentationLookup,
  builderIntent?: CharacterBuilderIntentCacheDto,
  baseActiveUpdatedAt?: string | null,
  publicId?: string
): CharacterBuilderPayloadDto {
  return {
    publicId,
    character,
    resolution: stripCharacterBuilderResolution(resolution),
    references: toCharacterBuilderReferences(resolution, presentation),
    view: buildCharacterBuilderView(character, resolution, presentation),
    builderIntent,
    baseActiveUpdatedAt
  }
}

function toChoiceOption(params: {
  id: string
  label: string
  category?: string
  disabledReason?: string
  properties?: readonly string[]
}): CharacterBuilderChoiceOptionDto {
  return {
    id: params.id,
    label: params.label,
    category: params.category,
    disabled: params.disabledReason ? true : undefined,
    disabledReason: params.disabledReason,
    properties: params.properties ? [...params.properties] : undefined
  }
}

function isBaseClass(
  classRecord: CompiledClass
): classRecord is Extract<CompiledClass, { category: typeof CLASS_CATEGORY.BASE }> {
  return classRecord.category === CLASS_CATEGORY.BASE
}

function formatMulticlassRequirementGroups(
  groups: readonly { requirements: readonly { ability: string; min: number }[] }[]
): string {
  return groups
    .map((group) =>
      group.requirements
        .map((requirement) => `${requirement.ability} ${requirement.min}`)
        .join(' and ')
    )
    .filter(Boolean)
    .join(' or ')
}

function getClassDisabledReason(
  classRecord: CharacterBuilderClassCatalogRecord,
  character: CharacterAuthored,
  resolution: CharacterBuilderResolution,
  params: {
    replacementIndex?: number
  } = {}
): string | undefined {
  const selectedClassIndex = character.intent.classes.findIndex(
    (row) => row.classId === classRecord.id
  )
  if (selectedClassIndex >= 0 && selectedClassIndex !== params.replacementIndex) {
    return 'Already selected.'
  }

  if (selectedClassIndex === params.replacementIndex) {
    return undefined
  }

  const proposedClassIds = character.intent.classes.map((row) => row.classId)
  if (params.replacementIndex === undefined) {
    proposedClassIds.push(classRecord.id)
  } else {
    proposedClassIds[params.replacementIndex] = classRecord.id
  }

  if (proposedClassIds.length <= 1) {
    return undefined
  }

  if (Object.keys(resolution.summary.abilities).length < 6) {
    return 'Assign all six ability scores before adding another class.'
  }

  const proposedClasses = proposedClassIds.flatMap((classId) => {
    const candidate = resolution.registry.classes.find((record) => record.id === classId)
    return candidate && isBaseClass(candidate) ? [candidate] : []
  })
  const unmetClass = proposedClasses.find(
    (candidate) =>
      !evaluateMulticlassRequirements(
        candidate.multiclass.requirementGroups,
        resolution.summary.abilities
      ).passes
  )

  if (!unmetClass) {
    return undefined
  }

  const evaluation = evaluateMulticlassRequirements(
    unmetClass.multiclass.requirementGroups,
    resolution.summary.abilities
  )

  return `${unmetClass.label} requires ${formatMulticlassRequirementGroups(
    evaluation.unmetRequirementGroups
  )}.`
}

function getChosenGrantChoiceViews(params: {
  character: CharacterAuthored
  resolution: CharacterBuilderResolution
  includeSource: (source: CharacterProvenance) => boolean
}): CharacterBuilderChosenGrantChoiceViewDto[] {
  return params.resolution.chosenGrantChoices
    .filter((choice) => params.includeSource(choice.source))
    .map((choice) => {
      const spellIdsSelectedElsewhere =
        choice.grantKind === GRANT_KIND.SPELL_GRANT
          ? getSpellSourceLabelsSelectedElsewhere(
              params.character,
              params.resolution,
              choice.source
            )
          : new Map<string, string>()
      return {
        ...choice,
        options: choice.options.map((option) => {
          const disabledReason =
            choice.grantKind !== GRANT_KIND.SPELL_GRANT
              ? option.disabledReason
              : choice.selectedTargetIds.includes(option.id)
                ? undefined
                : (option.disabledReason ??
                  (spellIdsSelectedElsewhere.has(option.id)
                    ? `Granted by ${spellIdsSelectedElsewhere.get(option.id)}`
                    : undefined))

          return toChoiceOption({
            ...option,
            disabledReason
          })
        })
      }
    })
}

function getSpellSourceLabelsSelectedElsewhere(
  character: CharacterAuthored,
  resolution: CharacterBuilderResolution,
  source: CharacterProvenance
): Map<string, string> {
  const sourceLabelsBySpellId = new Map<string, string>()
  for (const choice of resolution.chosenGrantChoices) {
    if (
      choice.grantKind === GRANT_KIND.SPELL_GRANT &&
      !isSameCharacterProvenanceIdentity(choice.source, source)
    ) {
      for (const spellId of choice.selectedTargetIds) {
        sourceLabelsBySpellId.set(spellId, choice.sourceLabel)
      }
    }
  }
  for (const selection of character.intent.spellSelections ?? []) {
    if (!isSameCharacterProvenanceIdentity(selection.source, source)) {
      const sourceLabel = getSourceLabel(resolution, selection.source)
      for (const spellId of selection.spells) sourceLabelsBySpellId.set(spellId, sourceLabel)
    }
  }
  return sourceLabelsBySpellId
}

function getSourceLabel(
  resolution: CharacterBuilderResolution,
  source: CharacterProvenance
): string {
  switch (source.kind) {
    case 'CLASS':
      return (
        resolution.registry.classes.find((record) => record.id === source.classId)?.label ??
        'another source'
      )
    case 'SUBCLASS':
      return (
        resolution.registry.classes.find((record) => record.id === source.subclassId)?.label ??
        'another source'
      )
    case 'RACE':
      return (
        resolution.registry.races.find((record) => record.id === source.raceId)?.label ??
        'another source'
      )
    case 'SUBRACE':
      return (
        resolution.registry.races.find((record) => record.id === source.subraceId)?.label ??
        'another source'
      )
    case 'ANCESTRY':
      return (
        resolution.registry.races
          .flatMap((race) => race.ancestry?.options ?? [])
          .find((option) => option.id === source.optionId)?.label ?? 'another source'
      )
    case 'BACKGROUND':
      return (
        resolution.registry.backgrounds.find((record) => record.id === source.backgroundId)
          ?.label ?? 'another source'
      )
    default:
      return 'another source'
  }
}
function getFeatureChoiceViews(params: {
  character: CharacterAuthored
  resolution: CharacterBuilderResolution
  includeSource: (source: CharacterProvenance) => boolean
}): CharacterBuilderFeatureChoiceViewDto[] {
  return params.resolution.grants.features
    .filter((grant) => params.includeSource(grant.source))
    .flatMap((grant) => {
      const feature = findGrantedFeature(params.resolution, grant.id)
      if (!feature?.options?.length) return []

      const requiredCount = getRequiredFeatureOptionCount({
        character: params.character,
        feature,
        source: grant.source,
        resolution: params.resolution
      })
      if (requiredCount <= 0) return []

      const acquisition = findCurrentCharacterFeatureAcquisition(
        params.character,
        grant.id,
        grant.source
      )

      return [
        {
          featureId: grant.id,
          featureLabel: grant.label,
          sourceLabel: grant.sourceLabel,
          source: grant.source,
          selectionKey: FEATURE_CHOICE_SELECTION_KEY,
          requiredCount,
          selectedOptionIds: getSelectedFeatureOptionIds(acquisition),
          options: feature.options.map((option) =>
            toChoiceOption({ id: option.id, label: option.label })
          )
        }
      ]
    })
}

function getGrantedFeatureViews(params: {
  resolution: CharacterBuilderResolution
  presentation: CharacterPresentationLookup
  includeSource: (source: CharacterProvenance) => boolean
}): CharacterBuilderGrantSummaryItemDto[] {
  return params.resolution.grants.features
    .filter((grant) => params.includeSource(grant.source))
    .map((grant) => withGrantProse(params.presentation, grant, 'FEATURE'))
}

function getGrantedClassContentViews(params: {
  resolution: CharacterBuilderResolution
  presentation: CharacterPresentationLookup
  includeSource: (source: CharacterProvenance) => boolean
}): CharacterBuilderGrantSummaryItemDto[] {
  const uniqueItems = new Map<string, { item: CharacterBuilderGrantSummaryItemDto; kind: string }>()
  const featureItems = params.resolution.grants.features.filter((item) =>
    params.includeSource(item.source)
  )
  const featureKeysByIdentity = new Map<string, string>()

  for (const item of featureItems) {
    const key = `${item.id}:${JSON.stringify(item.source)}`
    featureKeysByIdentity.set(
      `${JSON.stringify(item.source)}:${item.label.toLocaleLowerCase()}`,
      key
    )
    uniqueItems.set(key, {
      item: withGrantProse(params.presentation, item, 'FEATURE'),
      kind: 'FEATURE'
    })
  }

  for (const [kind, items] of [
    ['RESOURCE', params.resolution.grants.resources],
    ['SPELLCASTING', params.resolution.grants.spellcasting]
  ] as const)
    for (const grant of items) {
      if (!params.includeSource(grant.source)) continue
      const item = withGrantProse(params.presentation, grant, kind)
      const matchingFeatureKey = featureKeysByIdentity.get(
        `${JSON.stringify(item.source)}:${item.label.toLocaleLowerCase()}`
      )
      if (matchingFeatureKey) {
        const feature = uniqueItems.get(matchingFeatureKey)
        if (feature) {
          uniqueItems.set(matchingFeatureKey, {
            ...feature,
            item: {
              ...feature.item,
              description: feature.item.description ?? item.description,
              details: feature.item.details ?? item.details,
              sortOrder: feature.item.sortOrder ?? item.sortOrder,
              availableAtLevel: feature.item.availableAtLevel ?? item.availableAtLevel
            }
          })
        }
        continue
      }
      uniqueItems.set(`${item.id}:${JSON.stringify(item.source)}`, { item, kind })
    }

  return [...uniqueItems.values()]
    .sort(
      (left, right) =>
        (left.item.availableAtLevel ?? 0) - (right.item.availableAtLevel ?? 0) ||
        (left.item.sortOrder ?? 0) - (right.item.sortOrder ?? 0) ||
        left.kind.localeCompare(right.kind) ||
        left.item.id.localeCompare(right.item.id)
    )
    .map((entry) => entry.item)
}

function findGrantedFeature(
  resolution: CharacterBuilderResolution,
  featureId: string
): CompiledFeature | undefined {
  return [
    ...resolution.registry.features,
    ...resolution.registry.races.flatMap((race) => [
      ...(race.features ?? []),
      ...(race.ancestry?.options.flatMap((option) => option.features ?? []) ?? [])
    ]),
    ...resolution.registry.classes.flatMap((classRecord) => classRecord.features ?? []),
    ...resolution.registry.backgrounds.flatMap((background) => background.features ?? [])
  ].find((feature) => feature.id === featureId)
}

function getRequiredFeatureOptionCount({
  character,
  feature,
  resolution,
  source
}: {
  character: CharacterAuthored
  feature: CompiledFeature
  resolution: CharacterBuilderResolution
  source: CharacterProvenance
}): number {
  const level = getFeatureChoiceLevel(character, resolution, source)

  return (feature.optionChoices ?? [])
    .filter((choice) => choice.level <= level)
    .reduce((total, choice) => total + choice.count, 0)
}

function getFeatureChoiceLevel(
  character: CharacterAuthored,
  resolution: CharacterBuilderResolution,
  source: CharacterProvenance
): number {
  if (source.kind === 'CLASS') {
    return (
      source.classLevel ??
      character.intent.classes.find((row) => row.classId === source.classId)?.classLevel ??
      1
    )
  }

  if (source.kind === 'SUBCLASS') {
    return (
      source.classLevel ??
      character.intent.classes.find((row) => row.subclassId === source.subclassId)?.classLevel ??
      1
    )
  }

  return Math.max(resolution.summary.totalLevel, 1)
}

function getSelectedFeatureOptionIds(
  acquisition: CharacterFeatureAcquisition | undefined
): string[] {
  return (
    acquisition?.selections
      ?.filter((selection) => selection.selectionKey === FEATURE_CHOICE_SELECTION_KEY)
      .flatMap((selection) =>
        selection.values.flatMap((value) => {
          if (value.kind === 'ID') return [value.id]
          if (value.kind === 'IDS') return value.ids

          return []
        })
      ) ?? []
  )
}

function getSpellChoiceViews(params: {
  character: CharacterAuthored
  classRecord: CompiledClass | undefined
  classId: string
  classLevel: number
  resolution: CharacterBuilderResolution
  source: CharacterSpellSelection['source']
  sourceLabel: string
}): CharacterBuilderSpellChoiceViewDto[] {
  const spellcasting = params.classRecord?.spellcasting
  if (!spellcasting) return []

  const activeLimit = spellcasting.spellLimits
    .filter((limit) => limit.classLevel <= params.classLevel)
    .sort((left, right) => right.classLevel - left.classLevel)[0]
  if (!activeLimit) return []

  const cantripLimit = activeLimit.cantripsLimit ?? 0
  const learnedSpellLimit = activeLimit.learnedSpellsLimit ?? 0
  if (cantripLimit <= 0 && learnedSpellLimit <= 0) return []

  const selectedSpellIds =
    params.character.intent.spellSelections?.find((selection) =>
      isSameCharacterProvenanceIdentity(selection.source, params.source)
    )?.spells ?? []
  const selectedCantripIds = selectedSpellIds.filter((spellId) => {
    const spell = params.resolution.catalog.spells.find((record) => record.id === spellId)
    return spell?.level === 0
  })
  const selectedLeveledSpellIds = selectedSpellIds.filter((spellId) => {
    const spell = params.resolution.catalog.spells.find((record) => record.id === spellId)
    return spell && spell.level > 0
  })
  const spellSlotLevels = activeLimit.slots.map((slot) => slot.spellLevel)
  const maxSpellLevel = Math.max(...spellSlotLevels, 0) || spellcasting.maxSpellLevel
  const spellSourceLabelsSelectedElsewhere = getSpellSourceLabelsSelectedElsewhere(
    params.character,
    params.resolution,
    params.source
  )
  const classSpellOptions = params.resolution.catalog.spells.filter(
    (spell) =>
      spell.classIds.includes(params.classId) ||
      spell.classIds.includes(params.classRecord?.id ?? '') ||
      spellcasting.availableSpellIds?.includes(spell.id)
  )
  const toSpellOption = (
    spell: (typeof classSpellOptions)[number]
  ): CharacterBuilderSpellOptionDto => ({
    ...toChoiceOption({
      id: spell.id,
      label: spell.label,
      disabledReason: selectedSpellIds.includes(spell.id)
        ? undefined
        : spellSourceLabelsSelectedElsewhere.has(spell.id)
          ? `Granted by ${spellSourceLabelsSelectedElsewhere.get(spell.id)}`
          : undefined
    }),
    level: spell.level,
    schoolLabel: params.resolution.registry.system?.magicSchools.find(
      (school) => school.id === spell.magicSchoolId
    )?.label,
    ritual: spell.attributes ? spell.attributes.includes(SPELL_ATTRIBUTE.RITUAL) : undefined,
    concentration: spell.attributes
      ? spell.attributes.includes(SPELL_ATTRIBUTE.CONCENTRATION)
      : undefined
  })

  return [
    {
      id: `${params.classRecord?.id ?? params.classId}:spellcasting`,
      label: spellcasting.magicName ?? 'Spellcasting',
      sourceLabel: params.sourceLabel,
      source: params.source,
      cantripLimit,
      learnedSpellLimit,
      spellCollectionLabel: spellcasting.attributes?.includes(SPELLCASTING_ATTRIBUTE.USES_SPELLBOOK)
        ? 'Spellbook'
        : 'Known spells',
      selectedCantripIds,
      selectedSpellIds: selectedLeveledSpellIds,
      cantripOptions: classSpellOptions.filter((spell) => spell.level === 0).map(toSpellOption),
      spellOptions: classSpellOptions
        .filter((spell) => spell.level > 0 && spell.level <= maxSpellLevel)
        .map(toSpellOption)
    }
  ]
}

function getBackgroundDetailSections(
  details: NonNullable<BackgroundAuthored['details']>
): Array<{ label: string; details: Array<{ id: string; label: string; description: string }> }> {
  const groups = new Map<string, Array<{ id: string; label: string; description: string }>>()
  for (const detail of details.slice().sort((left, right) => left.order - right.order)) {
    const normalizedLabel = detail.label.toLowerCase()
    const sectionLabel = normalizedLabel.startsWith('personality trait')
      ? 'Personality Traits'
      : normalizedLabel.startsWith('ideal')
        ? 'Ideals'
        : normalizedLabel.startsWith('bond')
          ? 'Bonds'
          : normalizedLabel.startsWith('flaw')
            ? 'Flaws'
            : 'Other'
    const section = groups.get(sectionLabel) ?? []
    section.push({ id: detail.id, label: detail.label, description: detail.description })
    groups.set(sectionLabel, section)
  }

  return ['Personality Traits', 'Ideals', 'Bonds', 'Flaws', 'Other'].flatMap((label) => {
    const section = groups.get(label)
    return section ? [{ label, details: section }] : []
  })
}

function buildCharacterBuilderView(
  character: CharacterAuthored,
  resolution: CharacterBuilderResolution,
  presentation: CharacterPresentationLookup
): CharacterBuilderViewDto {
  const equipmentOptions = resolution.catalog.equipment.map((equipment) =>
    toChoiceOption({
      id: equipment.id,
      label: equipment.label,
      category: equipment.category,
      properties: equipment.properties
    })
  )
  const baseRaces = resolution.catalog.races.filter((race) => race.category !== 'SUBRACE')
  const selectedRaceId = character.intent.race.raceId
  const selectedAncestryRace = resolution.registry.races.find(
    (race) => race.id === (character.intent.race.subraceId ?? selectedRaceId)
  )
  const ancestrySelection = character.intent.ancestrySelections?.find(
    (selection) => selection.ancestryId === selectedAncestryRace?.ancestry?.id
  )
  const baseClasses = resolution.catalog.classes.filter(
    (classRecord) => classRecord.category === CLASS_CATEGORY.BASE
  )
  const primaryClass = character.intent.classes[0]?.classId
    ? resolution.registry.classes.find(
        (classRecord) => classRecord.id === character.intent.classes[0]?.classId
      )
    : undefined
  const primaryBaseClass = primaryClass && isBaseClass(primaryClass) ? primaryClass : undefined
  const selectedBackground = character.intent.background.backgroundId
    ? resolution.registry.backgrounds.find(
        (background) => background.id === character.intent.background.backgroundId
      )
    : undefined
  const backgroundProse = selectedBackground
    ? presentation.backgrounds[selectedBackground.id]
    : undefined
  if (selectedBackground && !backgroundProse)
    throw new Error(
      `Character Builder background presentation is missing: ${selectedBackground.id}`
    )
  const backgroundStartingEquipmentRequired = resolution.outstandingChoices.some(
    (choice) => choice.code === 'BACKGROUND_STARTING_EQUIPMENT_REQUIRED'
  )
  const classStartingEquipmentRequired = resolution.outstandingChoices.some(
    (choice) => choice.code === 'CLASS_STARTING_EQUIPMENT_REQUIRED'
  )

  return {
    race: {
      raceOptions: baseRaces.map((race) => toChoiceOption({ id: race.id, label: race.label })),
      subraceOptions: resolution.catalog.races
        .filter((race) => race.parentRaceId === selectedRaceId)
        .map((race) => toChoiceOption({ id: race.id, label: race.label })),
      ancestry: selectedAncestryRace?.ancestry
        ? {
            ancestryId: selectedAncestryRace.ancestry.id,
            label: selectedAncestryRace.ancestry.label,
            selectedOptionId: ancestrySelection?.optionId,
            options: selectedAncestryRace.ancestry.options.map((option) =>
              toChoiceOption({ id: option.id, label: option.label })
            )
          }
        : null,
      features: getGrantedFeatureViews({
        resolution,
        presentation,
        includeSource: (source) =>
          source.kind === 'RACE' || source.kind === 'SUBRACE' || source.kind === 'ANCESTRY'
      }),
      grantChoices: getChosenGrantChoiceViews({
        character,
        resolution,
        includeSource: (source) =>
          source.kind === 'RACE' || source.kind === 'SUBRACE' || source.kind === 'ANCESTRY'
      }),
      featureChoices: getFeatureChoiceViews({
        character,
        resolution,
        includeSource: (source) =>
          source.kind === 'RACE' || source.kind === 'SUBRACE' || source.kind === 'ANCESTRY'
      })
    },
    classes: {
      classOptions: baseClasses.map((classRecord) =>
        toChoiceOption({
          id: classRecord.id,
          label: classRecord.label,
          disabledReason: getClassDisabledReason(classRecord, character, resolution)
        })
      ),
      selectedClasses: character.intent.classes.map((classRecord, index) => {
        const summary = resolution.summary.classes.find(
          (candidate) => candidate.classId === classRecord.classId
        )
        const selectedClass = resolution.registry.classes.find(
          (candidate) => candidate.id === classRecord.classId
        )
        const selectedSubclass = classRecord.subclassId
          ? resolution.registry.classes.find((candidate) => candidate.id === classRecord.subclassId)
          : undefined
        const spellChoices = [
          ...getSpellChoiceViews({
            character,
            classRecord: selectedClass,
            classId: classRecord.classId,
            classLevel: classRecord.classLevel,
            resolution,
            source: {
              kind: 'CLASS',
              classId: classRecord.classId,
              classLevel: classRecord.classLevel
            },
            sourceLabel: selectedClass?.label ?? 'Class'
          }),
          ...getSpellChoiceViews({
            character,
            classRecord: selectedSubclass,
            classId: classRecord.classId,
            classLevel: classRecord.classLevel,
            resolution,
            source: {
              kind: 'SUBCLASS',
              subclassId: classRecord.subclassId ?? '',
              classLevel: classRecord.classLevel
            },
            sourceLabel: selectedSubclass?.label ?? 'Subclass'
          })
        ]
        const features = getGrantedClassContentViews({
          resolution,
          presentation,
          includeSource: (source) => {
            if (source.kind === 'CLASS') return source.classId === classRecord.classId
            if (source.kind === 'SUBCLASS') return source.subclassId === classRecord.subclassId

            return false
          }
        })

        return {
          classId: classRecord.classId,
          classLabel: summary?.classLabel ?? selectedClass?.label ?? classRecord.classId,
          classLevel: classRecord.classLevel,
          classOptions: baseClasses.map((baseClass) =>
            toChoiceOption({
              id: baseClass.id,
              label: baseClass.label,
              disabledReason: getClassDisabledReason(baseClass, character, resolution, {
                replacementIndex: index
              })
            })
          ),
          subclassOptions: getAvailableSubclassesForClass({
            classId: classRecord.classId,
            classLevel: classRecord.classLevel,
            catalog: resolution.catalog,
            registry: resolution.registry
          }).map((subclass) => toChoiceOption({ id: subclass.id, label: subclass.label })),
          specializationOptions:
            selectedSubclass && 'specializations' in selectedSubclass
              ? (selectedSubclass.specializations?.map((specialization) =>
                  toChoiceOption({ id: specialization.id, label: specialization.label })
                ) ?? [])
              : [],
          subclassSelectionFeatureId: features.find(
            (feature) =>
              feature.source.kind === 'CLASS' &&
              feature.source.classId === classRecord.classId &&
              feature.attributes?.includes(FEATURE_ATTRIBUTE.SUBCLASS_SELECTION)
          )?.id,
          proficiencyGroups: getSelectedClassProficiencyGroups(
            baseClasses.find((candidate) => candidate.id === classRecord.classId),
            classRecord.classId,
            resolution.chosenGrantChoices
          ),
          featureLabels: summary?.featureLabels ?? [],
          features,
          grantChoices: getChosenGrantChoiceViews({
            character,
            resolution,
            includeSource: (source) => {
              if (source.kind === 'CLASS') return source.classId === classRecord.classId
              if (source.kind === 'SUBCLASS') return source.subclassId === classRecord.subclassId

              return false
            }
          }),
          featureChoices: getFeatureChoiceViews({
            character,
            resolution,
            includeSource: (source) => {
              if (source.kind === 'CLASS') return source.classId === classRecord.classId
              if (source.kind === 'SUBCLASS') return source.subclassId === classRecord.subclassId

              return false
            }
          }),
          spellChoices: classRecord.subclassId
            ? spellChoices
            : spellChoices.filter((choice) => choice.source.kind === 'CLASS')
        }
      })
    },
    background: {
      backgroundOptions: resolution.catalog.backgrounds.map((background) =>
        toChoiceOption({ id: background.id, label: background.label })
      ),
      description: backgroundProse?.description,
      detailSections: getBackgroundDetailSections(backgroundProse?.details ?? []),
      features: getGrantedFeatureViews({
        resolution,
        presentation,
        includeSource: (source) => source.kind === 'BACKGROUND'
      }),
      grantChoices: getChosenGrantChoiceViews({
        character,
        resolution,
        includeSource: (source) => source.kind === 'BACKGROUND'
      }),
      featureChoices: getFeatureChoiceViews({
        character,
        resolution,
        includeSource: (source) => source.kind === 'BACKGROUND'
      })
    },
    equipment: {
      classStartingEquipmentRequired,
      backgroundStartingEquipmentRequired,
      classStartingEquipment: primaryBaseClass?.startingEquipment.sets.length
        ? {
            source: 'CLASS',
            sourceLabel: primaryBaseClass.label,
            startingGold: primaryBaseClass.startingGold,
            startingEquipment: toStartingEquipmentDto(primaryBaseClass.startingEquipment),
            choiceLabels: buildStartingEquipmentChoiceLabels(
              primaryBaseClass.startingEquipment,
              equipmentOptions
            )
          }
        : null,
      backgroundStartingEquipment: selectedBackground?.startingEquipment?.sets.length
        ? {
            source: 'BACKGROUND',
            sourceLabel: selectedBackground.label,
            startingEquipment: toStartingEquipmentDto(selectedBackground.startingEquipment),
            choiceLabels: buildStartingEquipmentChoiceLabels(
              selectedBackground.startingEquipment,
              equipmentOptions
            )
          }
        : null,
      equipmentOptions,
      currencyOptions:
        resolution.registry.system?.currencies.map((currency) =>
          toChoiceOption({ id: currency.id, label: currency.label })
        ) ?? []
    },
    review: {
      blockers: [
        ...resolution.readiness.blockingIssues,
        ...resolution.readiness.outstandingRequiredChoices
      ],
      warnings: resolution.validations
        .filter((validation) => validation.severity === 'warning')
        .map((validation) => validation.message),
      ready: resolution.readiness.ready
    }
  }
}

function toCharacterBuilderReferences(
  resolution: CharacterBuilderResolution,
  presentation: CharacterPresentationLookup
): CharacterBuilderReferencesDto {
  return {
    abilities: (resolution.registry.system?.abilities ?? []).map(({ code, label }) => ({
      id: code,
      label
    })),
    advancementMethods: ADVANCEMENT_METHOD_OPTIONS.map((option) => ({
      id: option.code,
      label: option.label
    })),
    abilityGenerationMethods: CHARACTER_ABILITY_GENERATION_METHOD_OPTIONS.map((option) => ({
      id: option.code,
      label: option.label
    })),
    hitpointCalculationMethods: HITPOINT_CALC_METHOD_OPTIONS.map((option) => ({
      id: option.code,
      label: option.label
    })),
    standardArrayScores: STANDARD_ARRAY_SCORE_OPTIONS.map((option) => ({
      id: option.code,
      label: option.label
    })),
    pointBuyScores: POINT_BUY_SCORE_OPTIONS.map((option) => ({
      id: option.code,
      label: option.label,
      cost: option.cost
    })),
    pointBuyTotalPoints: POINT_BUY_TOTAL_POINTS,
    races: resolution.catalog.races.map((race) => {
      const resolvedRace = resolution.registry.races.find((record) => record.id === race.id)
      const raceProse = resolvedRace ? presentation.races[resolvedRace.id] : undefined
      if (resolvedRace && !raceProse)
        throw new Error(`Character Builder race presentation is missing: ${resolvedRace.id}`)
      return {
        id: race.id,
        label: race.label,
        category: race.category,
        description: race.description,
        parentRaceId: race.parentRaceId,
        selectionMode: race.selectionMode,
        sizeLabel: race.sizeLabel,
        speedLabels: race.speedLabels ?? [],
        abilityScoreIncreaseFacts: race.abilityScoreIncreaseFacts ?? [],
        ancestry: resolvedRace?.ancestry
          ? {
              id: resolvedRace.ancestry.id,
              label: resolvedRace.ancestry.label,
              options: resolvedRace.ancestry.options.map((option) => ({
                id: option.id,
                label: option.label,
                description: raceProse?.ancestry?.options.find(({ id }) => id === option.id)
                  ?.description,
                features: (option.features ?? []).map((feature) =>
                  withGrantProse(
                    presentation,
                    {
                      id: feature.id,
                      label: feature.label,
                      attributes: feature.attributes,
                      sourceLabel: option.label,
                      source: {
                        kind: 'ANCESTRY',
                        ancestryId: resolvedRace.ancestry!.id,
                        optionId: option.id
                      }
                    },
                    'FEATURE'
                  )
                )
              }))
            }
          : undefined
      }
    }),
    classes: resolution.catalog.classes.map((classRecord) => {
      const resolvedClass = resolution.registry.classes.find(
        (record) => record.id === classRecord.id
      )
      return {
        id: classRecord.id,
        label: classRecord.label,
        category: classRecord.category,
        description: classRecord.description,
        hitpoint: classRecord.hitpoint,
        parentClassId: classRecord.parentClassId,
        savingThrowLabels: classRecord.savingThrowLabels ?? [],
        requirementGroups: classRecord.requirementGroups,
        proficiencyGroups: classRecord.proficiencyGroups ?? [],
        specializations:
          resolvedClass && 'specializations' in resolvedClass
            ? resolvedClass.specializations?.map((specialization) => ({
                id: specialization.id,
                label: specialization.label
              }))
            : undefined
      }
    }),
    backgrounds: resolution.catalog.backgrounds.map((background) => ({
      id: background.id,
      label: background.label,
      description: background.description,
      summary: background.summary,
      grantFacts: background.grantFacts,
      featureLabels: background.featureLabels,
      hiddenGrantFactCount: background.hiddenGrantFactCount,
      hiddenFeatureCount: background.hiddenFeatureCount
    })),
    equipment: resolution.catalog.equipment.map((equipment) => ({
      id: equipment.id,
      label: equipment.label
    })),
    currencies:
      resolution.registry.system?.currencies.map((currency) => ({
        id: currency.id,
        label: currency.label
      })) ?? [],
    alignments:
      resolution.registry.system?.alignments.map((alignment) => ({
        id: alignment.id,
        label: alignment.label
      })) ?? [],
    lifestyles:
      resolution.registry.system?.lifestyles.map((lifestyle) => ({
        id: lifestyle.id,
        label: lifestyle.label
      })) ?? []
  }
}
