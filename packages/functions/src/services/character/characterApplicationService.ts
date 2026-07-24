import {
  createCharacterBuilderChangePreview,
  createEmptyCharacterAuthored,
  getAvailableSubclassesForClass,
  loadCharacterBuilderContext,
  reconcileCharacterBuilderCharacter,
  resolveCharacterBuilder,
  resolveRecommendedCharacterBuilderSection,
  type CharacterBuilderResolution
} from './builderService.js'
import { buildCharacterSheetResponse, executeCharacterSheetCommand } from './sheetService.js'
import {
  type Json,
  createAuthoredRouteIdRepository,
  createCharacterBuilderDraftRepository,
  type CharacterBuilderDraft,
  createCharacterEventRepository,
  createCharacterRepository
} from '@artificer-toolkit/db'
import {
  ABILITY_OPTIONS,
  ADVANCEMENT_METHOD_OPTIONS,
  AUTHORED_RECORD_STATUS,
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
  STANDARD_ARRAY_SCORE_OPTIONS,
  buildCharacterHistoryView,
  type AuthoredRecordStatus
} from '@artificer-toolkit/shared/core'
import { evaluateMulticlassRequirements } from '@artificer-toolkit/shared/character'
import {
  isSameCharacterProvenanceIdentity,
  type BackgroundAuthored,
  type CharacterAuthored,
  type ClassAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import type { FeatureAuthored, StartingEquipmentAuthored } from '@artificer-toolkit/shared/authored'
import { startingEquipmentDtoSchema } from '@artificer-toolkit/schema/shared/startingEquipment'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import {
  characterBuilderDraftPayloadDtoSchema,
  characterBuilderResolveRequestDtoSchema,
  characterBuilderDraftSaveRequestDtoSchema,
  characterBuilderCommitRequestDtoSchema,
  characterBuilderSaveRequestDtoSchema,
  characterDraftRequestDtoSchema,
  type CharacterBuilderPayloadDto,
  type CharacterBuilderDraftPayloadDto,
  type CharacterBuilderDraftDto,
  type CharacterBuilderDraftSummaryDto,
  type CharacterBuilderIntentCacheDto,
  type CharacterBuilderPreviewPayloadDto,
  type CharacterBuilderReferencesDto,
  type CharacterBuilderResolutionDto,
  type CharacterBuilderViewDto,
  type CharacterBuilderChoiceOptionDto,
  type CharacterBuilderGrantSummaryItemDto,
  type CharacterBuilderFeatureChoiceViewDto,
  type CharacterBuilderChosenGrantChoiceViewDto,
  type CharacterBuilderSpellOptionDto,
  type CharacterBuilderSpellChoiceViewDto,
  type CharacterListResponseDto,
  type CharacterSheetCommandResponseDto,
  characterSheetCommandInputDtoSchema,
  type CharacterSheetResponseDto,
  type CharacterHistoryResponseDto
} from '@artificer-toolkit/schema/api/characters'
import { assertCharacterBuilderDraftRevisionFresh } from './characterBuilderDraftConflict.js'
import type { CharacterBuilderClassCatalogRecord } from './builderCatalog.js'

type CharacterBuilderMode = 'create' | 'edit'

type CharacterBuilderPreview = ReturnType<typeof createCharacterBuilderChangePreview>
type CharacterFeatureAcquisition = CharacterAuthored['intent']['featureAcquisitions'][number]

type StartingEquipmentItem = StartingEquipmentAuthored['sets'][number]['groups'][number]['options'][number]['items'][number]

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
      item.startingEquipmentKind !== 'EQUIPMENT'
      || !('selectionKind' in item)
      || item.selectionKind !== 'CHOSEN'
      || !('count' in item)
    ) continue

    const properties = item.properties ?? []
    if (item.authoringModeKind === 'ALL' && item.count === 1 && !item.category && properties.length === 1) {
      const propertyLabel = EQUIPMENT_PROPERTY_REGISTRY[properties[0]]?.label
      if (propertyLabel) {
        labels[item.id] = `Any ${propertyLabel.toLocaleLowerCase()}`
        continue
      }
    }

    const target = item.authoringModeKind === 'SELECTED'
      ? item.equipmentIds.map((equipmentId) => equipmentLabels.get(equipmentId) ?? equipmentId).join(' or ')
      : [
          properties
            .map((property) => EQUIPMENT_PROPERTY_REGISTRY[property]?.label.toLocaleLowerCase() ?? property.toLocaleLowerCase().replaceAll('_', ' '))
            .join(' '),
          item.category
            ? EQUIPMENT_CATEGORY_REGISTRY[item.category]?.label.toLocaleLowerCase() ?? item.category.toLocaleLowerCase().replaceAll('_', ' ')
            : 'equipment'
        ].filter(Boolean).join(' ')

    labels[item.id] = `Choose ${item.count} ${target}`
  }

  return labels
}
type CharacterSpellSelection = NonNullable<CharacterAuthored['intent']['spellSelections']>[number]
type CharacterProvenance = CharacterFeatureAcquisition['source']

const FEATURE_CHOICE_SELECTION_KEY = 'options'
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
    ['ARMOR', { category: 'ARMOR', label: 'Armor', grantedEntries: [] as string[], choiceInstructions: [] as Array<{ label: string; required: boolean }>, choiceIds: [] as string[] }],
    ['WEAPONS', { category: 'WEAPONS', label: 'Weapons', grantedEntries: [] as string[], choiceInstructions: [] as Array<{ label: string; required: boolean }>, choiceIds: [] as string[] }],
    ['TOOLS', { category: 'TOOLS', label: 'Tools', grantedEntries: [] as string[], choiceInstructions: [] as Array<{ label: string; required: boolean }>, choiceIds: [] as string[] }],
    ['SAVING_THROWS', { category: 'SAVING_THROWS', label: 'Saving Throws', grantedEntries: [] as string[], choiceInstructions: [] as Array<{ label: string; required: boolean }>, choiceIds: [] as string[] }],
    ['SKILLS', { category: 'SKILLS', label: 'Skills', grantedEntries: [] as string[], choiceInstructions: [] as Array<{ label: string; required: boolean }>, choiceIds: [] as string[] }],
    ['LANGUAGES', { category: 'LANGUAGES', label: 'Languages', grantedEntries: [] as string[], choiceInstructions: [] as Array<{ label: string; required: boolean }>, choiceIds: [] as string[] }],
    ['OTHER', { category: 'OTHER', label: 'Other', grantedEntries: [] as string[], choiceInstructions: [] as Array<{ label: string; required: boolean }>, choiceIds: [] as string[] }]
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
    group?.choiceInstructions.push(...proficiencyGroup.entries
      .filter((entry) => !proficiencyGroup.grantedEntries.includes(entry))
      .map((label) => ({ label, required: true })))
  }
  groups.get('SAVING_THROWS')?.grantedEntries.push(...(classRecord.savingThrowLabels ?? []))

  for (const choice of choices) {
    if (
      choice.grantKind !== GRANT_KIND.PROFICIENCY_GRANT
      || choice.ownerFeatureId !== undefined
      || choice.source.kind !== 'CLASS'
      || choice.source.classId !== classId
      || !choice.proficiencyKind
    ) continue

    groups
      .get(categoryFor(choice.proficiencyKind, choice.displayCategory))
      ?.choiceIds.push(choice.id)
  }
  return [...groups.values()].filter((group) => (
    group.grantedEntries.length > 0
    || group.choiceInstructions.length > 0
    || group.choiceIds.length > 0
  ))
}

async function resolveCharacterRouteSubjectId(
  db: Parameters<typeof createCharacterRepository>[0],
  routeId: string
): Promise<string | null> {
  if (uuidPattern.test(routeId)) return routeId.toLowerCase()

  const routeIdentity = await createAuthoredRouteIdRepository(db).resolveByPublicIdForUser({
    subjectKind: 'CHARACTER',
    publicId: routeId
  })

  return routeIdentity?.subjectId ?? null
}

function stripCharacterBuilderResolution(
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

function toCharacterBuilderPayload(
  character: CharacterAuthored,
  resolution: CharacterBuilderResolution,
  builderIntent?: CharacterBuilderIntentCacheDto,
  baseActiveUpdatedAt?: string | null,
  publicId?: string
): CharacterBuilderPayloadDto {
  return {
    publicId,
    character,
    resolution: stripCharacterBuilderResolution(resolution),
    references: toCharacterBuilderReferences(resolution),
    view: buildCharacterBuilderView(character, resolution),
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
  classRecord: ClassAuthored
): classRecord is Extract<ClassAuthored, { category: typeof CLASS_CATEGORY.BASE }> {
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
  const unmetClass = proposedClasses.find((candidate) =>
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
        options: choice.options.map((option) =>
          toChoiceOption({
            ...option,
            disabledReason:
              choice.selectedTargetIds.includes(option.id) || choice.grantKind !== GRANT_KIND.SPELL_GRANT
                ? undefined
                : spellIdsSelectedElsewhere.has(option.id)
                  ? `Granted by ${spellIdsSelectedElsewhere.get(option.id)}`
                  : undefined
          })
        )
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
      return resolution.registry.classes.find((record) => record.id === source.classId)?.label ?? 'another source'
    case 'SUBCLASS':
      return resolution.registry.classes.find((record) => record.id === source.subclassId)?.label ?? 'another source'
    case 'RACE':
      return resolution.registry.races.find((record) => record.id === source.raceId)?.label ?? 'another source'
    case 'SUBRACE':
      return resolution.registry.races.find((record) => record.id === source.subraceId)?.label ?? 'another source'
    case 'ANCESTRY':
      return resolution.registry.races
        .flatMap((race) => race.ancestry?.options ?? [])
        .find((option) => option.id === source.optionId)?.label ?? 'another source'
    case 'BACKGROUND':
      return resolution.registry.backgrounds.find((record) => record.id === source.backgroundId)?.label ?? 'another source'
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

      const acquisition = params.character.intent.featureAcquisitions.find(
        (record) =>
          record.featureId === grant.id &&
          isSameCharacterProvenanceIdentity(record.source, grant.source)
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
  includeSource: (source: CharacterProvenance) => boolean
}): CharacterBuilderGrantSummaryItemDto[] {
  return params.resolution.grants.features
    .filter((grant) => params.includeSource(grant.source))
    .map((grant) => toFeatureGrantSummary(params.resolution, grant))
}

function toFeatureGrantSummary(
  resolution: CharacterBuilderResolution,
  grant: CharacterBuilderGrantSummaryItemDto
): CharacterBuilderGrantSummaryItemDto {
  const feature = findGrantedFeature(resolution, grant.id)
  return {
    ...grant,
    details: feature?.details
      ?.slice()
      .sort((left, right) => left.order - right.order)
      .map((detail) => ({
        id: detail.id,
        label: detail.label,
        description: detail.description
      })) ?? grant.details
  }
}

function getGrantedClassContentViews(params: {
  resolution: CharacterBuilderResolution
  includeSource: (source: CharacterProvenance) => boolean
}): CharacterBuilderGrantSummaryItemDto[] {
  const uniqueItems = new Map<string, { item: CharacterBuilderGrantSummaryItemDto; kind: string }>()
  const featureItems = params.resolution.grants.features.filter((item) =>
    params.includeSource(item.source)
  )
  const featureKeysByIdentity = new Map<string, string>()

  for (const item of featureItems) {
    const key = `${item.id}:${JSON.stringify(item.source)}`
    featureKeysByIdentity.set(`${JSON.stringify(item.source)}:${item.label.toLocaleLowerCase()}`, key)
    uniqueItems.set(
      key,
      { item: toFeatureGrantSummary(params.resolution, item), kind: 'FEATURE' }
    )
  }

  for (const [kind, items] of [
    ['RESOURCE', params.resolution.grants.resources],
    ['SPELLCASTING', params.resolution.grants.spellcasting]
  ] as const) for (const item of items) {
    if (!params.includeSource(item.source)) continue
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
    uniqueItems.set(`${item.id}:${JSON.stringify(item.source)}`, {
      item: toFeatureGrantSummary(params.resolution, item),
      kind
    })
  }

  return [...uniqueItems.values()]
    .sort((left, right) =>
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
): FeatureAuthored | undefined {
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
  feature: FeatureAuthored
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
  classRecord: ClassAuthored | undefined
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
    const spell = params.resolution.catalog.spells.find(
      (record) => record.id === spellId
    )
    return spell?.level === 0
  })
  const selectedLeveledSpellIds = selectedSpellIds.filter((spellId) => {
    const spell = params.resolution.catalog.spells.find(
      (record) => record.id === spellId
    )
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
      (spell.classIds.includes(params.classId) ||
        spell.classIds.includes(params.classRecord?.id ?? ''))
  )
  const toSpellOption = (spell: (typeof classSpellOptions)[number]): CharacterBuilderSpellOptionDto => ({
    ...toChoiceOption({
      id: spell.id,
      label: spell.label,
      disabledReason:
        selectedSpellIds.includes(spell.id)
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
      cantripOptions: classSpellOptions
        .filter((spell) => spell.level === 0)
        .map(toSpellOption),
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

export function buildCharacterBuilderView(
  character: CharacterAuthored,
  resolution: CharacterBuilderResolution
): CharacterBuilderViewDto {
  const equipmentOptions = resolution.catalog.equipment.map((equipment) =>
    toChoiceOption({
      id: equipment.id,
      label: equipment.label,
      category: equipment.category,
      properties: equipment.properties
    })
  )
  const baseRaces = resolution.catalog.races.filter(
    (race) => race.category !== 'SUBRACE'
  )
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
      description: selectedBackground?.description,
      detailSections: getBackgroundDetailSections(selectedBackground?.details ?? []),
      features: getGrantedFeatureViews({
        resolution,
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
            choiceLabels: buildStartingEquipmentChoiceLabels(primaryBaseClass.startingEquipment, equipmentOptions)
          }
        : null,
      backgroundStartingEquipment: selectedBackground?.startingEquipment?.sets.length
        ? {
            source: 'BACKGROUND',
            sourceLabel: selectedBackground.label,
            startingEquipment: toStartingEquipmentDto(selectedBackground.startingEquipment),
            choiceLabels: buildStartingEquipmentChoiceLabels(selectedBackground.startingEquipment, equipmentOptions)
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
  resolution: CharacterBuilderResolution
): CharacterBuilderReferencesDto {
  return {
    abilities: ABILITY_OPTIONS.map((option) => ({ id: option.code, label: option.label })),
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
      return {
        id: race.id,
        label: race.label,
        category: race.category,
        description: race.description,
        parentRaceId: race.parentRaceId,
        selectionMode: race.selectionMode,
        sizeLabel: race.sizeLabel,
        speedLabels: race.speedLabels ?? [],
        abilityScoreIncreaseDescriptions: race.abilityScoreIncreaseDescriptions ?? [],
        ancestry: resolvedRace?.ancestry
          ? {
              id: resolvedRace.ancestry.id,
              label: resolvedRace.ancestry.label,
              options: resolvedRace.ancestry.options.map((option) => ({
                id: option.id,
                label: option.label,
                description: option.description,
                features: (option.features ?? []).map((feature) =>
                  toFeatureGrantSummary(resolution, {
                    id: feature.id,
                    label: feature.label,
                    description: feature.description,
                    attributes: feature.attributes,
                    sourceLabel: option.label,
                    source: {
                      kind: 'ANCESTRY',
                      ancestryId: resolvedRace.ancestry!.id,
                      optionId: option.id
                    }
                  })
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

function toCharacterBuilderDraftSummary(
  draft: CharacterBuilderDraft,
  publicId = draft.characterId
): CharacterBuilderDraftSummaryDto {
  return {
    characterId: draft.characterId,
    publicId,
    userId: draft.userId,
    systemId: draft.systemId,
    label: draft.label,
    status: draft.status,
    draftState: draft.draftState,
    baseActiveUpdatedAt: draft.baseActiveUpdatedAt,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt
  }
}

function toCharacterBuilderDraftDto(
  draft: CharacterBuilderDraft,
  publicId = draft.characterId
): CharacterBuilderDraftDto {
  return {
    ...toCharacterBuilderDraftSummary(draft, publicId),
    id: draft.id,
    mode: draft.mode,
    payload: characterBuilderDraftPayloadDtoSchema.parse(toDraftPayloadObject(draft.payload))
  }
}

function toDraftPayloadObject(payload: Json): Record<string, unknown> {
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {}
}

function parseStoredCharacterBuilderDraftPayload(
  payload: Json
): CharacterBuilderDraftPayloadDto | null {
  const objectPayload = toDraftPayloadObject(payload)
  const parsedDraftPayload = characterBuilderDraftPayloadDtoSchema.safeParse(objectPayload)
  return parsedDraftPayload.success ? parsedDraftPayload.data : null
}

function toCharacterBuilderPreviewPayload(params: {
  character: CharacterAuthored
  resolution: CharacterBuilderResolution
  preview: CharacterBuilderPreview
}): CharacterBuilderPreviewPayloadDto {
  return {
    character: params.character,
    resolution: stripCharacterBuilderResolution(params.resolution),
    preview: params.preview
  }
}

function resolvePersistedCharacterStatus(params: {
  existingStatus?: AuthoredRecordStatus
  targetStatus?: AuthoredRecordStatus
  ready: boolean
}): AuthoredRecordStatus {
  if (params.targetStatus === AUTHORED_RECORD_STATUS.ACTIVE) {
    return params.ready ? AUTHORED_RECORD_STATUS.ACTIVE : AUTHORED_RECORD_STATUS.DRAFT
  }

  if (params.existingStatus === AUTHORED_RECORD_STATUS.ACTIVE) {
    return params.ready ? AUTHORED_RECORD_STATUS.ACTIVE : AUTHORED_RECORD_STATUS.DRAFT
  }

  return AUTHORED_RECORD_STATUS.DRAFT
}

async function buildCharacterBuilderSavePayload(params: {
  db: Parameters<typeof createCharacterRepository>[0]
  character: CharacterAuthored
  mode: CharacterBuilderMode
  targetStatus?: AuthoredRecordStatus
  existing: CharacterAuthored | null
  userId: string
}): Promise<{
  character: CharacterAuthored
  resolution: CharacterBuilderResolution
  preview: CharacterBuilderPreview
}> {
  const authored = {
    ...params.character,
    userId: params.userId
  }
  const context = await loadCharacterBuilderContext(params.db, authored)
  const reconciled = await reconcileCharacterBuilderCharacter(
    params.db,
    authored,
    params.existing,
    context
  )
  const draftResolution = await resolveCharacterBuilder(
    params.db,
    {
      ...reconciled,
      status: AUTHORED_RECORD_STATUS.DRAFT
    },
    params.mode,
    context
  )
  const persistedStatus = resolvePersistedCharacterStatus({
    existingStatus: params.existing?.status,
    targetStatus: params.targetStatus,
    ready: draftResolution.readiness.ready
  })
  const character = {
    ...reconciled,
    status: persistedStatus
  }
  const resolution =
    persistedStatus === AUTHORED_RECORD_STATUS.DRAFT
      ? draftResolution
      : {
          ...draftResolution,
          recommendedSectionId: resolveRecommendedCharacterBuilderSection(
            character,
            params.mode,
            draftResolution.summary,
            draftResolution.validations,
            draftResolution.outstandingChoices
          )
        }

  return {
    character,
    resolution,
    preview: createCharacterBuilderChangePreview({
      previousCharacter: params.existing,
      nextCharacter: character,
      predictedStatus: persistedStatus,
      context: {
        catalog: resolution.catalog,
        registry: resolution.registry
      }
    })
  }
}

function normalizeCharacterDraftPayload(params: {
  character: CharacterAuthored
  characterId: string
  userId: string
  systemId?: string
  label?: string
}): CharacterAuthored {
  return {
    ...params.character,
    id: params.characterId,
    userId: params.userId,
    systemId: params.systemId ?? params.character.systemId,
    label: params.label ?? params.character.label,
    status: AUTHORED_RECORD_STATUS.DRAFT
  }
}

function createNamedError(name: string, message: string): Error {
  const error = new Error(message)
  error.name = name
  return error
}

async function saveCharacterBuilderDraftRecord(params: {
  db: Parameters<typeof createCharacterRepository>[0]
  character: CharacterAuthored
  builderIntent?: CharacterBuilderIntentCacheDto
  characterId: string
  mode: CharacterBuilderMode
  userId: string
  baseActiveUpdatedAt?: string | null
}): Promise<CharacterBuilderDraft> {
  const character = normalizeCharacterDraftPayload({
    character: params.character,
    characterId: params.characterId,
    userId: params.userId
  })
  const payload = characterBuilderDraftPayloadDtoSchema.parse({
    character,
    builderIntent: params.builderIntent
  })

  return createCharacterBuilderDraftRepository(params.db).save({
    characterId: params.characterId,
    userId: params.userId,
    systemId: character.systemId,
    label: character.label || 'Untitled Character',
    mode: params.mode,
    payload: payload as unknown as Json,
    baseActiveUpdatedAt: params.baseActiveUpdatedAt ?? null
  })
}

export async function listCharactersForUser(
  db: Parameters<typeof createCharacterRepository>[0],
  userId: string
): Promise<CharacterListResponseDto> {
  const items = await createCharacterRepository(db).listByUser(userId)
  const drafts = await createCharacterBuilderDraftRepository(db).listByUser(userId)
  const publicIdByCharacterId = await createAuthoredRouteIdRepository(db).ensureMany('CHARACTER', [
    ...items.map((row) => row.id),
    ...drafts.map((draft) => draft.characterId)
  ])
  const getPublicId = (characterId: string) =>
    publicIdByCharacterId.get(characterId)?.publicId ?? characterId
  const draftByCharacterId = new Map(drafts.map((draft) => [draft.characterId, draft]))
  const activeIds = new Set(items.map((row) => row.id))
  const activeItems = items.map((row) => {
    const draft = draftByCharacterId.get(row.id)
    const publicId = getPublicId(row.id)

    return {
      id: row.id,
      publicId,
      label: draft?.label ?? row.label,
      status:
        row.status === AUTHORED_RECORD_STATUS.ACTIVE
          ? AUTHORED_RECORD_STATUS.ACTIVE
          : AUTHORED_RECORD_STATUS.DRAFT,
      systemId: draft?.systemId ?? row.system_id,
      streamVersion: row.stream_version,
      draft: draft ? toCharacterBuilderDraftSummary(draft, publicId) : undefined
    }
  })
  const draftOnlyItems = drafts
    .filter((draft) => !activeIds.has(draft.characterId))
    .map((draft) => {
      const publicId = getPublicId(draft.characterId)

      return {
        id: draft.characterId,
        publicId,
        label: draft.label,
        status: AUTHORED_RECORD_STATUS.DRAFT,
        systemId: draft.systemId,
        streamVersion: 0,
        draft: toCharacterBuilderDraftSummary(draft, publicId)
      }
    })

  return {
    items: [...activeItems, ...draftOnlyItems],
    meta: {}
  }
}

export async function createCharacterDraftForUser(
  db: Parameters<typeof createCharacterRepository>[0],
  body: ReturnType<typeof characterDraftRequestDtoSchema.parse>,
  userId: string
): Promise<CharacterBuilderPayloadDto> {
  const repository = createCharacterRepository(db)
  const draftRepository = createCharacterBuilderDraftRepository(db)
  const draft = await draftRepository.findByCharacter({
    characterId: body.id,
    userId
  })
  if (draft) {
    const parsedDraftPayload = parseStoredCharacterBuilderDraftPayload(draft.payload)
    if (!parsedDraftPayload) {
      throw createNamedError(
        'CharacterBuilderDraftPayloadError',
        `Character builder draft "${draft.characterId}" is malformed.`
      )
    }

    const character = normalizeCharacterDraftPayload({
      character: parsedDraftPayload.character,
      characterId: draft.characterId,
      userId,
      systemId: draft.systemId,
      label: draft.label
    })

    const resolution = await resolveCharacterBuilder(db, character, draft.mode)
    return toCharacterBuilderPayload(character, resolution, parsedDraftPayload.builderIntent)
  }

  const existing = await repository.findAuthoredById(body.id)
  if (existing) {
    return toCharacterBuilderPayload(
      existing,
      await resolveCharacterBuilder(db, existing, 'create')
    )
  }

  if (!body.systemId) {
    throw new Error('System id is required when creating a new character draft.')
  }

  const character = createEmptyCharacterAuthored({
    id: body.id,
    systemId: body.systemId,
    userId
  })
  await saveCharacterBuilderDraftRecord({
    db,
    character,
    characterId: body.id,
    mode: 'create',
    userId
  })
  const routeIdentity = await createAuthoredRouteIdRepository(db).ensure({
    subjectKind: 'CHARACTER',
    subjectId: body.id
  })

  return toCharacterBuilderPayload(
    character,
    await resolveCharacterBuilder(db, character, 'create'),
    undefined,
    undefined,
    routeIdentity.publicId
  )
}

export async function getCharacterBuilderDraftForUser(
  db: Parameters<typeof createCharacterRepository>[0],
  characterId: string,
  userId: string
): Promise<CharacterBuilderDraftDto | null> {
  const resolvedCharacterId = await resolveCharacterRouteSubjectId(db, characterId)
  if (!resolvedCharacterId) return null

  const draft = await createCharacterBuilderDraftRepository(db).findByCharacter({
    characterId: resolvedCharacterId,
    userId
  })

  if (!draft) return null

  const routeIdentity = await createAuthoredRouteIdRepository(db).ensure({
    subjectKind: 'CHARACTER',
    subjectId: draft.characterId
  })

  return toCharacterBuilderDraftDto(draft, routeIdentity.publicId)
}

export async function saveCharacterBuilderDraftForUser(
  db: Parameters<typeof createCharacterRepository>[0],
  characterId: string,
  body: ReturnType<typeof characterBuilderDraftSaveRequestDtoSchema.parse>,
  userId: string
): Promise<CharacterBuilderDraftDto> {
  if (characterId !== body.character.id) {
    throw createNamedError(
      'AuthoredDraftSubjectMismatchError',
      `Character builder draft route id "${characterId}" does not match payload id "${body.character.id}".`
    )
  }

  const existing = await createCharacterRepository(db).findAuthoredById(characterId)
  if (existing && existing.userId !== userId) {
    throw createNamedError(
      'AuthoredContentOwnershipError',
      `Character "${characterId}" cannot be edited by the current user.`
    )
  }

  const draft = await saveCharacterBuilderDraftRecord({
    db,
    character: body.character,
    builderIntent: body.builderIntent,
    characterId,
    mode: body.mode,
    userId,
    baseActiveUpdatedAt: body.baseActiveUpdatedAt ?? null
  })

  const routeIdentity = await createAuthoredRouteIdRepository(db).ensure({
    subjectKind: 'CHARACTER',
    subjectId: draft.characterId
  })

  return toCharacterBuilderDraftDto(draft, routeIdentity.publicId)
}

export async function discardCharacterBuilderDraftForUser(
  db: Parameters<typeof createCharacterRepository>[0],
  characterId: string,
  userId: string
): Promise<{ ok: true }> {
  await createCharacterBuilderDraftRepository(db).delete({
    characterId,
    userId
  })
  return { ok: true }
}

export async function createCharacterForUser(
  db: Parameters<typeof createCharacterRepository>[0],
  character: ReturnType<typeof characterAuthoredDtoSchema.parse>,
  userId: string
): Promise<CharacterBuilderPayloadDto> {
  const authored = {
    ...character,
    userId
  }

  const repository = createCharacterRepository(db)
  await repository.upsertAuthored(authored)
  const routeIdentity = await createAuthoredRouteIdRepository(db).ensure({
    subjectKind: 'CHARACTER',
    subjectId: authored.id
  })

  const persisted = await repository.findAuthoredById(authored.id)
  const nextCharacter = persisted ?? authored
  return toCharacterBuilderPayload(
    nextCharacter,
    await resolveCharacterBuilder(db, nextCharacter, 'create'),
    undefined,
    undefined,
    routeIdentity.publicId
  )
}

export async function getCharacterForUser(
  db: Parameters<typeof createCharacterRepository>[0],
  characterId: string
): Promise<CharacterBuilderPayloadDto | null> {
  const resolvedCharacterId = await resolveCharacterRouteSubjectId(db, characterId)
  if (!resolvedCharacterId) return null

  const repository = createCharacterRepository(db)
  const [character, activeUpdatedAt] = await Promise.all([
    repository.findAuthoredById(resolvedCharacterId),
    repository.findUpdatedAtById(resolvedCharacterId)
  ])
  if (!character) {
    return null
  }
  const routeIdentity = await createAuthoredRouteIdRepository(db).ensure({
    subjectKind: 'CHARACTER',
    subjectId: character.id
  })

  return toCharacterBuilderPayload(
    character,
    await resolveCharacterBuilder(db, character, 'edit'),
    undefined,
    activeUpdatedAt,
    routeIdentity.publicId
  )
}

export async function getCharacterSheetForUser(
  db: Parameters<typeof createCharacterRepository>[0],
  characterId: string
): Promise<CharacterSheetResponseDto | null> {
  const resolvedCharacterId = await resolveCharacterRouteSubjectId(db, characterId)
  if (!resolvedCharacterId) return null

  const repository = createCharacterRepository(db)
  const [row, character] = await Promise.all([
    repository.findById(resolvedCharacterId),
    repository.findAuthoredById(resolvedCharacterId)
  ])
  if (
    !character ||
    (character.status ?? AUTHORED_RECORD_STATUS.ACTIVE) !== AUTHORED_RECORD_STATUS.ACTIVE
  ) {
    return null
  }

  const draft = await createCharacterBuilderDraftRepository(db).findByCharacter({
    characterId: resolvedCharacterId,
    userId: character.userId
  })
  const routeIdentity = await createAuthoredRouteIdRepository(db).ensure({
    subjectKind: 'CHARACTER',
    subjectId: character.id
  })

  return {
    ...(await buildCharacterSheetResponse({
      db,
      character,
      resolution: await resolveCharacterBuilder(db, character, 'edit'),
      streamVersion: row?.stream_version ?? 0,
      hasBuilderDraft: Boolean(draft)
    })),
    publicId: routeIdentity.publicId
  }
}

export async function resolveCharacterForUser(
  db: Parameters<typeof createCharacterRepository>[0],
  body: ReturnType<typeof characterBuilderResolveRequestDtoSchema.parse>,
  userId: string
): Promise<CharacterBuilderPayloadDto> {
  const authored = {
    ...body.character,
    userId
  }

  return toCharacterBuilderPayload(authored, await resolveCharacterBuilder(db, authored, body.mode))
}

export async function previewCharacterSaveForUser(
  db: Parameters<typeof createCharacterRepository>[0],
  body: ReturnType<typeof characterBuilderSaveRequestDtoSchema.parse>,
  userId: string
): Promise<CharacterBuilderPreviewPayloadDto> {
  const repository = createCharacterRepository(db)
  const existing = await repository.findAuthoredById(body.character.id)
  const payload = await buildCharacterBuilderSavePayload({
    db,
    character: body.character,
    mode: body.mode,
    targetStatus: body.targetStatus,
    existing,
    userId
  })

  return toCharacterBuilderPreviewPayload(payload)
}

export async function upsertCharacterBuilderForUser(
  db: Parameters<typeof createCharacterRepository>[0],
  body: ReturnType<typeof characterBuilderCommitRequestDtoSchema.parse>,
  userId: string
): Promise<CharacterBuilderPayloadDto> {
  const repository = createCharacterRepository(db)
  const draftRepository = createCharacterBuilderDraftRepository(db)
  const existing = await repository.findAuthoredById(body.character.id)
  const payload = await buildCharacterBuilderSavePayload({
    db,
    character: body.character,
    mode: body.mode,
    targetStatus: body.targetStatus ?? AUTHORED_RECORD_STATUS.ACTIVE,
    existing,
    userId
  })

  if (!payload.resolution.readiness.ready) {
    throw createNamedError(
      'NodeRuntimeInputError',
      'Character cannot be finalized until all required builder choices are complete.'
    )
  }

  // Hold the active row lock through upsertAuthored so the revision check and write are atomic.
  const activeUpdatedAt = await repository.findUpdatedAtByIdForUpdate(payload.character.id)
  const draft = await draftRepository.findByCharacter({
    characterId: payload.character.id,
    userId
  })
  const baseActiveUpdatedAt = draft?.baseActiveUpdatedAt ?? body.baseActiveUpdatedAt ?? null
  assertCharacterBuilderDraftRevisionFresh({
    activeUpdatedAt,
    baseActiveUpdatedAt,
    characterId: payload.character.id,
    shouldCheckRevision: draft != null || body.baseActiveUpdatedAt != null
  })

  await repository.upsertAuthored(payload.character, {
    incrementStreamVersion: true
  })
  const routeIdentity = await createAuthoredRouteIdRepository(db).ensure({
    subjectKind: 'CHARACTER',
    subjectId: payload.character.id
  })
  await draftRepository.delete({
    characterId: payload.character.id,
    userId
  })

  const persisted = await repository.findAuthoredById(payload.character.id)
  const nextCharacter = persisted ?? payload.character
  return toCharacterBuilderPayload(
    nextCharacter,
    payload.resolution,
    undefined,
    undefined,
    routeIdentity.publicId
  )
}

export async function dispatchCommandForUser(
  db: Parameters<typeof createCharacterRepository>[0],
  characterId: string,
  command: ReturnType<typeof characterSheetCommandInputDtoSchema.parse>,
  userId: string
): Promise<CharacterSheetCommandResponseDto> {
  const resolvedCharacterId = await resolveCharacterRouteSubjectId(db, characterId)
  if (!resolvedCharacterId) {
    throw createNamedError('NotFoundError', `Character "${characterId}" was not found.`)
  }

  const result = await executeCharacterSheetCommand({
    db,
    characterId: resolvedCharacterId,
    command,
    userId
  })
  const [draft, routeIdentity] = await Promise.all([
    createCharacterBuilderDraftRepository(db).findByCharacter({
      characterId: resolvedCharacterId,
      userId
    }),
    createAuthoredRouteIdRepository(db).ensure({
      subjectKind: 'CHARACTER',
      subjectId: resolvedCharacterId
    })
  ])

  return {
    ...result,
    sheet: {
      ...result.sheet,
      meta: {
        ...result.sheet.meta,
        hasBuilderDraft: Boolean(draft)
      },
      publicId: routeIdentity.publicId
    }
  }
}

export async function getCharacterHistoryForUser(
  db: Parameters<typeof createCharacterRepository>[0],
  characterId: string,
  userId: string
): Promise<CharacterHistoryResponseDto> {
  const resolvedCharacterId = await resolveCharacterRouteSubjectId(db, characterId)
  if (!resolvedCharacterId) {
    throw createNamedError('NotFoundError', `Character "${characterId}" was not found.`)
  }

  const character = await createCharacterRepository(db).findAuthoredById(resolvedCharacterId)
  if (!character) {
    throw createNamedError('NotFoundError', `Character "${resolvedCharacterId}" was not found.`)
  }
  if (character.userId !== userId) {
    throw createNamedError(
      'AuthoredContentOwnershipError',
      `Character "${resolvedCharacterId}" cannot be viewed by the current user.`
    )
  }
  const events = await createCharacterEventRepository(db).listByCharacter(resolvedCharacterId)
  return buildCharacterHistoryView(events, resolvedCharacterId)
}
