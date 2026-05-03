import {
  NotFoundError,
  buildSnapshot,
  createCharacterBuilderChangePreview,
  createEmptyCharacterAuthored,
  dispatchCharacterCommand,
  handleAcquireEquipment,
  handleApplyHitPoints,
  handleAssignAbilityScores,
  handleAuthoringRequest,
  handleChooseFeat,
  handleCommandRequest,
  handleCreateCharacter,
  handleEquipItem,
  handleGainClassLevel,
  handleMakeFeatureSelection,
  handleRequest,
  handleUnequipItem,
  handleUpdateSpellSelection,
  reconcileCharacterBuilderCharacter,
  resolveCharacterBuilder,
  type CharacterBuilderResolution
} from '@artificer-toolkit/functions'
import {
  type Json,
  ConcurrencyError,
  createCharacterBuilderDraftRepository,
  type CharacterBuilderDraft,
  createCharacterEventRepository,
  createCharacterRepository
} from '@artificer-toolkit/db'
import {
  AUTHORED_RECORD_STATUS,
  CLASS_CATEGORY,
  type CharacterBuildState,
  buildCharacterHistoryView,
  dnd5e2014RulesSystem,
  runEngine,
  type AuthoredRecordStatus,
  type CharacterAssemblyRegistry
} from '@artificer-toolkit/shared/core'
import {
  isSameCharacterProvenanceIdentity,
  type CharacterAuthored,
  type ClassAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
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
  type CharacterBuilderFeatureChoiceViewDto,
  type CharacterBuilderSpellChoiceViewDto,
  type CharacterListResponseDto,
  type CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characters'
import {
  characterCommandUnionSchema,
  createCharacterCommandSchema
} from '@artificer-toolkit/schema/domains/character/commands'

type CharacterBuilderMode = 'create' | 'edit'

type CharacterBuilderPreview = ReturnType<typeof createCharacterBuilderChangePreview>
type CharacterFeatureAcquisition = CharacterAuthored['intent']['featureAcquisitions'][number]
type CharacterSpellSelection = NonNullable<CharacterAuthored['intent']['spellSelections']>[number]
type CharacterProvenance = CharacterFeatureAcquisition['source']

const FEATURE_CHOICE_SELECTION_KEY = 'options'

function extractId(req: Request): string {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  return segments[segments.length - 1]
}

function extractCharacterIdFromSheetRoute(req: Request): string {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  const sheetIdx = segments.lastIndexOf('sheet')
  return sheetIdx > 0 ? segments[sheetIdx - 1] : extractId(req)
}

function extractCharacterIdFromBuilderDraftRoute(req: Request): string {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  const draftIdx = segments.lastIndexOf('builder-draft')
  return draftIdx > 0 ? segments[draftIdx - 1] : extractId(req)
}

function stubRegistry(): CharacterAssemblyRegistry {
  return { features: {}, classes: {}, feats: {}, races: {}, equipment: {}, spells: {} }
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
  builderIntent?: CharacterBuilderIntentCacheDto
): CharacterBuilderPayloadDto {
  return {
    character,
    resolution: stripCharacterBuilderResolution(resolution),
    references: toCharacterBuilderReferences(resolution),
    view: toCharacterBuilderView(character, resolution),
    builderIntent
  }
}

function toChoiceOption(params: {
  id: string
  label: string
  disabledReason?: string
}): CharacterBuilderChoiceOptionDto {
  return {
    id: params.id,
    label: params.label,
    disabled: params.disabledReason ? true : undefined,
    disabledReason: params.disabledReason
  }
}

function isBaseClass(classRecord: ClassAuthored): classRecord is Extract<ClassAuthored, { category: typeof CLASS_CATEGORY.BASE }> {
  return classRecord.category === CLASS_CATEGORY.BASE
}

function formatMulticlassRequirement(classRecord: Extract<ClassAuthored, { category: typeof CLASS_CATEGORY.BASE }>): string {
  return classRecord.multiclass.requirementGroups.groups
    .map((group) => group.requirements.map((requirement) => `${requirement.ability} ${requirement.min}`).join(' and '))
    .filter(Boolean)
    .join(' or ')
}

function getClassDisabledReason(
  classRecord: ClassAuthored,
  character: CharacterAuthored,
  resolution: CharacterBuilderResolution
): string | undefined {
  if (character.intent.classes.some((row) => row.classId === classRecord.id)) {
    return 'Already selected.'
  }

  if (!isBaseClass(classRecord) || character.intent.classes.length === 0) {
    return undefined
  }

  const passes = classRecord.multiclass.requirementGroups.groups.some((group) => group.requirements.every((requirement) => (resolution.summary.abilities[requirement.ability] ?? 0) >= requirement.min))

  return passes ? undefined : `Requires ${formatMulticlassRequirement(classRecord)}.`
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

      const acquisition = params.character.intent.featureAcquisitions.find((record) => (
        record.featureId === grant.id && isSameCharacterProvenanceIdentity(record.source, grant.source)
      ))

      return [
        {
          featureId: grant.id,
          featureLabel: grant.label,
          sourceLabel: grant.sourceLabel,
          source: grant.source,
          selectionKey: FEATURE_CHOICE_SELECTION_KEY,
          requiredCount,
          selectedOptionIds: getSelectedFeatureOptionIds(acquisition),
          options: feature.options.map((option) => toChoiceOption({ id: option.id, label: option.label }))
        }
      ]
    })
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
    return source.classLevel ?? character.intent.classes.find((row) => row.classId === source.classId)?.classLevel ?? 1
  }

  if (source.kind === 'SUBCLASS') {
    return source.classLevel ?? character.intent.classes.find((row) => row.subclassId === source.subclassId)?.classLevel ?? 1
  }

  return Math.max(resolution.summary.totalLevel, 1)
}

function getSelectedFeatureOptionIds(
  acquisition: CharacterFeatureAcquisition | undefined
): string[] {
  return acquisition?.selections
    ?.filter((selection) => selection.selectionKey === FEATURE_CHOICE_SELECTION_KEY)
    .flatMap((selection) => selection.values.flatMap((value) => {
      if (value.kind === 'ID') return [value.id]
      if (value.kind === 'IDS') return value.ids

      return []
    })) ?? []
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

  const selectedSpellIds = params.character.intent.spellSelections
    ?.find((selection) => isSameCharacterProvenanceIdentity(selection.source, params.source))
    ?.spells ?? []
  const selectedCantripIds = selectedSpellIds.filter((spellId) => {
    const spell = params.resolution.registry.spells.find((record) => record.id === spellId)
    return spell?.level === 0
  })
  const selectedLeveledSpellIds = selectedSpellIds.filter((spellId) => {
    const spell = params.resolution.registry.spells.find((record) => record.id === spellId)
    return spell && spell.level > 0
  })
  const spellSlotLevels = activeLimit.slots.map((slot) => slot.spellLevel)
  const maxSpellLevel = Math.max(...spellSlotLevels, 0) || spellcasting.maxSpellLevel
  const classSpellOptions = params.resolution.registry.spells.filter((spell) => (
    spell.classIds.includes(params.classId) || spell.classIds.includes(params.classRecord?.id ?? '')
  ))

  return [
    {
      id: `${params.classRecord?.id ?? params.classId}:spellcasting`,
      label: spellcasting.magicName ?? `${params.sourceLabel} Spellcasting`,
      sourceLabel: params.sourceLabel,
      source: params.source,
      cantripLimit,
      learnedSpellLimit,
      selectedCantripIds,
      selectedSpellIds: selectedLeveledSpellIds,
      cantripOptions: classSpellOptions
        .filter((spell) => spell.level === 0)
        .map((spell) => toChoiceOption({ id: spell.id, label: spell.label })),
      spellOptions: classSpellOptions
        .filter((spell) => spell.level > 0 && spell.level <= maxSpellLevel)
        .map((spell) => toChoiceOption({ id: spell.id, label: spell.label }))
    }
  ]
}

function toCharacterBuilderView(
  character: CharacterAuthored,
  resolution: CharacterBuilderResolution
): CharacterBuilderViewDto {
  const baseRaces = resolution.registry.races.filter((race) => race.category !== 'SUBRACE')
  const selectedRaceId = character.intent.race.raceId
  const selectedAncestryRace = resolution.registry.races.find((race) => race.id === (character.intent.race.subraceId ?? selectedRaceId))
  const ancestrySelection = character.intent.ancestrySelections?.find((selection) => selection.ancestryId === selectedAncestryRace?.ancestry?.id)
  const baseClasses = resolution.registry.classes.filter(isBaseClass)
  const primaryClass = character.intent.classes[0]?.classId
    ? resolution.registry.classes.find((classRecord) => classRecord.id === character.intent.classes[0]?.classId)
    : undefined
  const primaryBaseClass = primaryClass && isBaseClass(primaryClass) ? primaryClass : undefined
  const selectedBackground = character.intent.background.backgroundId
    ? resolution.registry.backgrounds.find((background) => background.id === character.intent.background.backgroundId)
    : undefined
  const backgroundStartingEquipmentRequired = resolution.outstandingChoices.some((choice) => choice.code === 'BACKGROUND_STARTING_EQUIPMENT_REQUIRED')
  const classStartingEquipmentRequired = resolution.outstandingChoices.some((choice) => choice.code === 'CLASS_STARTING_EQUIPMENT_REQUIRED')

  return {
    race: {
      raceOptions: baseRaces.map((race) => toChoiceOption({ id: race.id, label: race.label })),
      subraceOptions: resolution.registry.races
        .filter((race) => 'subrace' in race && race.subrace.parentRaceId === selectedRaceId)
        .map((race) => toChoiceOption({ id: race.id, label: race.label })),
      ancestry: selectedAncestryRace?.ancestry
        ? {
            ancestryId: selectedAncestryRace.ancestry.id,
            label: selectedAncestryRace.ancestry.label,
            selectedOptionId: ancestrySelection?.optionId,
            options: selectedAncestryRace.ancestry.options.map((option) => toChoiceOption({ id: option.id, label: option.label }))
          }
        : null,
      featureChoices: getFeatureChoiceViews({
        character,
        resolution,
        includeSource: (source) => source.kind === 'RACE' || source.kind === 'SUBRACE' || source.kind === 'ANCESTRY'
      })
    },
    classes: {
      classOptions: baseClasses.map((classRecord) => toChoiceOption({
        id: classRecord.id,
        label: classRecord.label,
        disabledReason: getClassDisabledReason(classRecord, character, resolution)
      })),
      selectedClasses: character.intent.classes.map((classRecord) => {
        const summary = resolution.summary.classes.find((candidate) => candidate.classId === classRecord.classId)
        const selectedClass = resolution.registry.classes.find((candidate) => candidate.id === classRecord.classId)
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
            source: { kind: 'CLASS', classId: classRecord.classId, classLevel: classRecord.classLevel },
            sourceLabel: selectedClass?.label ?? 'Class'
          }),
          ...getSpellChoiceViews({
            character,
            classRecord: selectedSubclass,
            classId: classRecord.classId,
            classLevel: classRecord.classLevel,
            resolution,
            source: { kind: 'SUBCLASS', subclassId: classRecord.subclassId ?? '', classLevel: classRecord.classLevel },
            sourceLabel: selectedSubclass?.label ?? 'Subclass'
          })
        ]

        return {
          classId: classRecord.classId,
          classLabel: summary?.classLabel ?? selectedClass?.label ?? classRecord.classId,
          classLevel: classRecord.classLevel,
          subclassOptions: resolution.registry.classes
            .filter((candidate) => candidate.category === CLASS_CATEGORY.SUBCLASS && candidate.parentClassId === classRecord.classId)
            .map((subclass) => toChoiceOption({ id: subclass.id, label: subclass.label })),
          specializationOptions: selectedSubclass && 'specializations' in selectedSubclass
            ? selectedSubclass.specializations?.map((specialization) => toChoiceOption({ id: specialization.id, label: specialization.label })) ?? []
            : [],
          featureLabels: summary?.featureLabels ?? [],
          featureChoices: getFeatureChoiceViews({
            character,
            resolution,
            includeSource: (source) => {
              if (source.kind === 'CLASS') return source.classId === classRecord.classId
              if (source.kind === 'SUBCLASS') return source.subclassId === classRecord.subclassId

              return false
            }
          }),
          spellChoices: classRecord.subclassId ? spellChoices : spellChoices.filter((choice) => choice.source.kind === 'CLASS'),
          resourceLabels: summary?.resourceLabels ?? [],
          spellcastingLabels: summary?.spellcastingLabels ?? []
        }
      })
    },
    background: {
      backgroundOptions: resolution.registry.backgrounds.map((background) => toChoiceOption({ id: background.id, label: background.label })),
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
            startingEquipment: primaryBaseClass.startingEquipment
          }
        : null,
      backgroundStartingEquipment: selectedBackground?.startingEquipment?.sets.length
        ? {
            source: 'BACKGROUND',
            sourceLabel: selectedBackground.label,
            startingEquipment: selectedBackground.startingEquipment
          }
        : null,
      equipmentOptions: resolution.registry.equipment.map((equipment) => toChoiceOption({ id: equipment.id, label: equipment.label })),
      currencyOptions: resolution.registry.system?.currencies.map((currency) => toChoiceOption({ id: currency.id, label: currency.label })) ?? []
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
    races: resolution.registry.races.map((race) => ({
      id: race.id,
      label: race.label,
      category: race.category,
      parentRaceId: 'subrace' in race ? race.subrace.parentRaceId : undefined,
      ancestry: race.ancestry
        ? {
            id: race.ancestry.id,
            label: race.ancestry.label,
            options: race.ancestry.options.map((option) => ({
              id: option.id,
              label: option.label
            }))
          }
        : undefined
    })),
    classes: resolution.registry.classes.map((classRecord) => ({
      id: classRecord.id,
      label: classRecord.label,
      category: classRecord.category,
      parentClassId: 'parentClassId' in classRecord ? classRecord.parentClassId : undefined,
      specializations: 'specializations' in classRecord
        ? classRecord.specializations?.map((specialization) => ({
            id: specialization.id,
            label: specialization.label
          }))
        : undefined
    })),
    backgrounds: resolution.registry.backgrounds.map((background) => ({
      id: background.id,
      label: background.label
    })),
    equipment: resolution.registry.equipment.map((equipment) => ({
      id: equipment.id,
      label: equipment.label
    })),
    currencies: resolution.registry.system?.currencies.map((currency) => ({
      id: currency.id,
      label: currency.label
    })) ?? []
  }
}

function toCharacterBuilderDraftSummary(draft: CharacterBuilderDraft): CharacterBuilderDraftSummaryDto {
  return {
    characterId: draft.characterId,
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

function toCharacterBuilderDraftDto(draft: CharacterBuilderDraft): CharacterBuilderDraftDto {
  return {
    ...toCharacterBuilderDraftSummary(draft),
    id: draft.id,
    mode: draft.mode,
    payload: toDraftPayloadObject(draft.payload)
  }
}

function toDraftPayloadObject(payload: Json): Record<string, unknown> {
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {}
}

function parseStoredCharacterBuilderDraftPayload(payload: Json): CharacterBuilderDraftPayloadDto | null {
  const objectPayload = toDraftPayloadObject(payload)
  const parsedDraftPayload = characterBuilderDraftPayloadDtoSchema.safeParse(objectPayload)
  if (parsedDraftPayload.success) {
    return parsedDraftPayload.data
  }

  const parsedLegacyCharacter = characterAuthoredDtoSchema.safeParse(objectPayload)
  if (!parsedLegacyCharacter.success) {
    return null
  }

  return {
    character: parsedLegacyCharacter.data
  }
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

function toCharacterSheetPayload(
  character: CharacterAuthored,
  resolution: CharacterBuilderResolution
): CharacterSheetResponseDto {
  return {
    character,
    resolution: stripCharacterBuilderResolution(resolution),
    playState: character.state
  }
}

function resolvePersistedCharacterStatus(params: {
  existingStatus?: AuthoredRecordStatus
  targetStatus?: AuthoredRecordStatus
  ready: boolean
}): AuthoredRecordStatus {
  if (params.targetStatus === AUTHORED_RECORD_STATUS.ACTIVE) {
    return params.ready
      ? AUTHORED_RECORD_STATUS.ACTIVE
      : AUTHORED_RECORD_STATUS.DRAFT
  }

  if (params.existingStatus === AUTHORED_RECORD_STATUS.ACTIVE) {
    return params.ready
      ? AUTHORED_RECORD_STATUS.ACTIVE
      : AUTHORED_RECORD_STATUS.DRAFT
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
  const reconciled = await reconcileCharacterBuilderCharacter(params.db, authored, params.existing)
  const draftResolution = await resolveCharacterBuilder(params.db, {
    ...reconciled,
    status: AUTHORED_RECORD_STATUS.DRAFT
  }, params.mode)
  const persistedStatus = resolvePersistedCharacterStatus({
    existingStatus: params.existing?.status,
    targetStatus: params.targetStatus,
    ready: draftResolution.readiness.ready
  })
  const character = {
    ...reconciled,
    status: persistedStatus
  }
  const resolution = await resolveCharacterBuilder(params.db, character, params.mode)

  return {
    character,
    resolution,
    preview: createCharacterBuilderChangePreview({
      previousCharacter: params.existing,
      nextCharacter: character,
      predictedStatus: persistedStatus,
      registry: resolution.registry
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

export const listCharacters = handleRequest(async (db, userId: string): Promise<CharacterListResponseDto> => {
  const items = await createCharacterRepository(db).listByUser(userId)
  const drafts = await createCharacterBuilderDraftRepository(db).listByUser(userId)
  const draftByCharacterId = new Map(drafts.map((draft) => [draft.characterId, draft]))
  const activeIds = new Set(items.map((row) => row.id))
  const activeItems = items.map((row) => {
    const draft = draftByCharacterId.get(row.id)

    return {
      id: row.id,
      label: draft?.label ?? row.label,
      status: row.status === AUTHORED_RECORD_STATUS.ACTIVE
        ? AUTHORED_RECORD_STATUS.ACTIVE
        : AUTHORED_RECORD_STATUS.DRAFT,
      systemId: draft?.systemId ?? row.system_id,
      streamVersion: row.stream_version,
      draft: draft ? toCharacterBuilderDraftSummary(draft) : undefined
    }
  })
  const draftOnlyItems = drafts
    .filter((draft) => !activeIds.has(draft.characterId))
    .map((draft) => ({
      id: draft.characterId,
      label: draft.label,
      status: AUTHORED_RECORD_STATUS.DRAFT,
      systemId: draft.systemId,
      streamVersion: 0,
      draft: toCharacterBuilderDraftSummary(draft)
    }))

  return {
    items: [
      ...activeItems,
      ...draftOnlyItems
    ],
    meta: {}
  }
}, (_req: Request, userId: string) => [userId] as [string])

export const createCharacterDraft = handleAuthoringRequest(characterDraftRequestDtoSchema, async (db, body, userId): Promise<CharacterBuilderPayloadDto> => {
  const repository = createCharacterRepository(db)
  const draftRepository = createCharacterBuilderDraftRepository(db)
  const draft = await draftRepository.findByCharacter({
    characterId: body.id,
    userId
  })
  if (draft) {
    const parsedDraftPayload = parseStoredCharacterBuilderDraftPayload(draft.payload)
    if (!parsedDraftPayload) {
      throw createNamedError('CharacterBuilderDraftPayloadError', `Character builder draft "${draft.characterId}" is malformed.`)
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
    return toCharacterBuilderPayload(existing, await resolveCharacterBuilder(db, existing, 'create'))
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

  return toCharacterBuilderPayload(character, await resolveCharacterBuilder(db, character, 'create'))
})

export const getCharacterBuilderDraft = handleRequest(async (db, characterId: string, userId: string): Promise<CharacterBuilderDraftDto | null> => {
  const draft = await createCharacterBuilderDraftRepository(db).findByCharacter({
    characterId,
    userId
  })

  return draft ? toCharacterBuilderDraftDto(draft) : null
}, (req: Request, userId: string) => [extractCharacterIdFromBuilderDraftRoute(req), userId] as [string, string])

export const saveCharacterBuilderDraft = handleAuthoringRequest(characterBuilderDraftSaveRequestDtoSchema, async (db, body, userId, request): Promise<CharacterBuilderDraftDto> => {
  const characterId = extractCharacterIdFromBuilderDraftRoute(request)
  if (characterId !== body.character.id) {
    throw createNamedError('AuthoredDraftSubjectMismatchError', `Character builder draft route id "${characterId}" does not match payload id "${body.character.id}".`)
  }

  const existing = await createCharacterRepository(db).findAuthoredById(characterId)
  if (existing && existing.userId !== userId) {
    throw createNamedError('AuthoredContentOwnershipError', `Character "${characterId}" cannot be edited by the current user.`)
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

  return toCharacterBuilderDraftDto(draft)
})

export const discardCharacterBuilderDraft = handleRequest(async (db, characterId: string, userId: string): Promise<{ ok: true }> => {
  await createCharacterBuilderDraftRepository(db).delete({
    characterId,
    userId
  })
  return { ok: true }
}, (req: Request, userId: string) => [extractCharacterIdFromBuilderDraftRoute(req), userId] as [string, string])

export const createCharacter = handleAuthoringRequest(characterAuthoredDtoSchema, async (db, character, userId): Promise<CharacterBuilderPayloadDto> => {
  const authored = {
    ...character,
    userId
  }

  const repository = createCharacterRepository(db)
  await repository.upsertAuthored(authored)

  const persisted = await repository.findAuthoredById(authored.id)
  const nextCharacter = persisted ?? authored
  return toCharacterBuilderPayload(nextCharacter, await resolveCharacterBuilder(db, nextCharacter, 'create'))
})

export const getCharacter = handleRequest(async (db, characterId: string): Promise<CharacterBuilderPayloadDto | null> => {
  const character = await createCharacterRepository(db).findAuthoredById(characterId)
  if (!character) return null

  return toCharacterBuilderPayload(character, await resolveCharacterBuilder(db, character, 'edit'))
}, (req: Request) => [extractId(req)] as [string])

export const getCharacterSheet = handleRequest(async (db, characterId: string): Promise<CharacterSheetResponseDto | null> => {
  const character = await createCharacterRepository(db).findAuthoredById(characterId)
  if (!character) return null

  return toCharacterSheetPayload(character, await resolveCharacterBuilder(db, character, 'edit'))
}, (req: Request) => [extractCharacterIdFromSheetRoute(req)] as [string])

export const resolveCharacter = handleAuthoringRequest(characterBuilderResolveRequestDtoSchema, async (db, body, userId): Promise<CharacterBuilderPayloadDto> => {
  const authored = {
    ...body.character,
    userId
  }

  return toCharacterBuilderPayload(authored, await resolveCharacterBuilder(db, authored, body.mode))
})

export const previewCharacterSave = handleAuthoringRequest(characterBuilderSaveRequestDtoSchema, async (db, body, userId): Promise<CharacterBuilderPreviewPayloadDto> => {
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
})

export const upsertCharacterBuilder = handleAuthoringRequest(characterBuilderCommitRequestDtoSchema, async (db, body, userId): Promise<CharacterBuilderPayloadDto> => {
  const repository = createCharacterRepository(db)
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
    throw createNamedError('NodeRuntimeInputError', 'Character cannot be finalized until all required builder choices are complete.')
  }

  await repository.upsertAuthored(payload.character)
  await createCharacterBuilderDraftRepository(db).delete({
    characterId: payload.character.id,
    userId
  })

  const persisted = await repository.findAuthoredById(payload.character.id)
  const nextCharacter = persisted ?? payload.character
  return toCharacterBuilderPayload(nextCharacter, await resolveCharacterBuilder(db, nextCharacter, body.mode))
})

const commandHandlerMap = {
  CREATE_CHARACTER: handleCreateCharacter,
  ASSIGN_ABILITY_SCORES: handleAssignAbilityScores,
  GAIN_CLASS_LEVEL: handleGainClassLevel,
  APPLY_HIT_POINTS: handleApplyHitPoints,
  MAKE_FEATURE_SELECTION: handleMakeFeatureSelection,
  CHOOSE_FEAT: handleChooseFeat,
  UPDATE_SPELL_SELECTION: handleUpdateSpellSelection,
  ACQUIRE_EQUIPMENT: handleAcquireEquipment,
  EQUIP_ITEM: handleEquipItem,
  UNEQUIP_ITEM: handleUnequipItem
} as const

export const createLegacyCharacter = handleAuthoringRequest(createCharacterCommandSchema, async (db, command, userId) => {
  const { events, newState } = await handleCreateCharacter(command, {
    characterId: command.characterId,
    systemId: command.systemId,
    streamVersion: 0,
    name: '',
    classes: [],
    abilityScores: {},
    abilityGenerationMethod: 'STANDARD_ARRAY',
    hitpointsByLevel: [],
    featureSelections: [],
    featRefs: [],
    spellRefs: [],
    ownedEquipment: []
  }, stubRegistry(), dnd5e2014RulesSystem)

  const repository = createCharacterRepository(db)
  const eventRepository = createCharacterEventRepository(db)

  await repository.create({
    id: command.characterId,
    systemId: command.systemId,
    userId,
    label: command.name,
    buildState: newState as unknown as Json
  })

  await eventRepository.appendBatch(events)

  return {
    characterId: command.characterId,
    streamVersion: newState.streamVersion
  }
})

export const getLegacyCharacter = handleRequest(async (db, characterId: string) => {
  const row = await createCharacterRepository(db).findById(characterId)
  if (!row?.build_state) return null

  const registry = stubRegistry()
  const buildState = row.build_state as unknown as CharacterBuildState
  const snapshot = buildSnapshot(buildState, registry)
  const output = runEngine(snapshot, registry, dnd5e2014RulesSystem)

  return { buildState, engineOutput: output }
}, (req: Request) => [extractId(req)] as [string])

export const dispatchCommand = handleCommandRequest(characterCommandUnionSchema, async (characterId, expectedVersion, command, db) => {
  if (command.type === 'CREATE_CHARACTER') {
    throw new NotFoundError(characterId)
  }

  const handler = commandHandlerMap[command.type]
  const commandHandler = handler as Parameters<typeof dispatchCharacterCommand<unknown, unknown>>[3]
  return dispatchCharacterCommand(characterId, expectedVersion, command, commandHandler, db)
})

export const getCharacterHistory = handleRequest(async (db, characterId: string) => {
  const events = await createCharacterEventRepository(db).listByCharacter(characterId)
  return buildCharacterHistoryView(events)
}, (req: Request) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  const historyIdx = segments.lastIndexOf('history')
  const characterId = historyIdx > 0 ? segments[historyIdx - 1] : extractId(req)
  return [characterId] as [string]
})

export { ConcurrencyError }
