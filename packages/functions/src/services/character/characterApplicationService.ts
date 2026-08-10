import {
  createEmptyCharacterAuthored,
  loadCharacterBuilderContext,
  resolveCharacterBuilder,
  type CharacterBuilderResolution
} from './builderService.js'
import { reconcileCharacterBuilderCharacter } from './builderReconciliation.js'
import {
  stripCharacterBuilderResolution,
  toCharacterBuilderPayload
} from './characterBuilderView.js'
import {
  createCharacterBuilderChangePreview,
  resolveRecommendedCharacterBuilderSection
} from './builderPresentation.js'
import { executeCharacterSheetCommand } from './sheetService.js'
import { resolveCharacterSheetEngine } from './characterEngine.js'
import { buildCharacterSheetResponse } from './sheetProjection.js'
import { previewCharacterRest } from './sheetRestService.js'
import {
  buildCharacterSheetPanel,
  getAffectedCharacterSheetPanelTargets
} from './sheetPanelService.js'
import {
  type Json,
  createAuthoredRouteIdRepository,
  createCharacterBuilderDraftRepository,
  type CharacterBuilderDraft,
  createCharacterEventRepository,
  createCharacterRepository,
  createCharacterSheetAdjustmentRepository,
  createCharacterSheetPlayStateRepository
} from '@artificer-toolkit/db'
import {
  AUTHORED_RECORD_STATUS,
  CLASS_CATEGORY,
  buildCharacterHistoryView,
  type AuthoredRecordStatus
} from '@artificer-toolkit/shared/core'
import {
  type CharacterAuthored,
  type ParentClassAuthored
} from '@artificer-toolkit/shared/subjects/authored'
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
  type CharacterListResponseDto,
  type CharacterRestPreviewRequestDto,
  type CharacterRestPreviewResponseDto,
  type CharacterSheetCommandResponseDto,
  characterSheetCommandInputDtoSchema,
  type CharacterSheetResponseDto,
  type CharacterHistoryResponseDto
} from '@artificer-toolkit/schema/api/characters'
import type {
  CharacterSheetPanelDto,
  CharacterSheetPanelTargetDto
} from '@artificer-toolkit/schema/api/characterSheetPanel'
import { assertCharacterBuilderDraftRevisionFresh } from './characterBuilderDraftConflict.js'
import { withPersonalCharacterLimit } from '../account/entitlementService.js'
import {
  lockCampaignCharacterContentForSave,
  replaceCampaignCharacterContentBindings
} from './campaignCharacterContent.js'
import {
  filterCharacterHistoryForViewer,
  getCharacterSheetDisplayAdjustments,
  getVisibleCampaignConditions,
  mergeCampaignSheetAdjustments,
  projectCharacterSheetForViewer,
  resolveCharacterSheetCampaignContext
} from './campaignCharacterSheet.js'
import { materializeCharacterStartingEquipment } from './characterStartingEquipmentState.js'

type CharacterBuilderMode = 'create' | 'edit'

type CharacterBuilderPreview = ReturnType<typeof createCharacterBuilderChangePreview>

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  let draftResolution = await resolveCharacterBuilder(
    params.db,
    {
      ...reconciled,
      status: AUTHORED_RECORD_STATUS.DRAFT
    },
    params.mode,
    context,
    params.existing
  )
  const persistedStatus = resolvePersistedCharacterStatus({
    existingStatus: params.existing?.status,
    targetStatus: params.targetStatus,
    ready: draftResolution.readiness.ready
  })
  let character: CharacterAuthored = {
    ...reconciled,
    status: persistedStatus
  }
  if (persistedStatus === AUTHORED_RECORD_STATUS.ACTIVE) {
    const primaryClassId = character.intent.classes[0]?.classId
    const primaryClass = draftResolution.registry.classes.find(
      (record): record is ParentClassAuthored =>
        record.id === primaryClassId && record.category === CLASS_CATEGORY.BASE
    )
    const selectedBackground = draftResolution.registry.backgrounds.find(
      (record) => record.id === character.intent.background.backgroundId
    )
    const materialized = materializeCharacterStartingEquipment(character, {
      classStartingEquipment: primaryClass?.startingEquipment,
      classStartingGold: primaryClass?.startingGold,
      backgroundStartingEquipment: selectedBackground?.startingEquipment
    })
    character = materialized.character
    if (materialized.changed) {
      const materializedContext = await loadCharacterBuilderContext(params.db, character)
      draftResolution = await resolveCharacterBuilder(
        params.db,
        { ...character, status: AUTHORED_RECORD_STATUS.DRAFT },
        params.mode,
        materializedContext,
        params.existing
      )
    }
    const adjustments = await createCharacterSheetAdjustmentRepository(params.db).listByCharacter(
      character.id
    )
    const effectiveMaxHitPoints = Math.max(
      resolveCharacterSheetEngine({
        character,
        resolution: draftResolution,
        adjustments
      }).derivedStats.maxHitPoints,
      0
    )

    character = {
      ...character,
      state: {
        ...character.state,
        hitpoints: {
          ...character.state.hitpoints,
          current: Math.min(Math.max(character.state.hitpoints.current, 0), effectiveMaxHitPoints)
        }
      }
    }
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

  return withPersonalCharacterLimit(params.db, params.userId, params.characterId, (trx) =>
    createCharacterBuilderDraftRepository(trx).save({
      characterId: params.characterId,
      userId: params.userId,
      systemId: character.systemId,
      label: character.label || 'Untitled Character',
      mode: params.mode,
      payload: payload as unknown as Json,
      baseActiveUpdatedAt: params.baseActiveUpdatedAt ?? null
    })
  )
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
    if (existing.userId !== userId) {
      throw createNamedError(
        'AuthoredContentOwnershipError',
        `Character "${body.id}" cannot be edited by the current user.`
      )
    }
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

export async function getCharacterForUser(
  db: Parameters<typeof createCharacterRepository>[0],
  characterId: string,
  userId: string
): Promise<CharacterBuilderPayloadDto | null> {
  const resolvedCharacterId = await resolveCharacterRouteSubjectId(db, characterId)
  if (!resolvedCharacterId) return null

  const repository = createCharacterRepository(db)
  const [character, activeUpdatedAt] = await Promise.all([
    repository.findAuthoredById(resolvedCharacterId),
    repository.findUpdatedAtById(resolvedCharacterId)
  ])
  if (!character || character.userId !== userId) {
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
  characterId: string,
  userId: string
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
  const campaignContext = await resolveCharacterSheetCampaignContext(db, character, userId)

  const draft = await createCharacterBuilderDraftRepository(db).findByCharacter({
    characterId: resolvedCharacterId,
    userId: character.userId
  })
  const routeIdentity = await createAuthoredRouteIdRepository(db).ensure({
    subjectKind: 'CHARACTER',
    subjectId: character.id
  })

  const adjustmentRepository = createCharacterSheetAdjustmentRepository(db)
  const playStateRepository = createCharacterSheetPlayStateRepository(db)
  const [adjustments, movementDisplayPreference, resourceUsage, spellCustomizations] =
    await Promise.all([
      adjustmentRepository.listByCharacter(character.id),
      adjustmentRepository.getMovementPreference(character.id),
      playStateRepository.listResourceUsage(character.id),
      playStateRepository.listSpellCustomizations(character.id)
    ])

  const sheet = await buildCharacterSheetResponse({
    db,
    character,
    resolution: await resolveCharacterBuilder(db, character, 'edit'),
    streamVersion: row?.stream_version ?? 0,
    hasBuilderDraft: Boolean(draft),
    adjustments: mergeCampaignSheetAdjustments(adjustments, campaignContext.adjustments),
    movementDisplayPreference,
    resourceUsage,
    spellCustomizations,
    additionalConditions: getVisibleCampaignConditions(campaignContext)
  })

  return projectCharacterSheetForViewer(
    {
      ...sheet,
      publicId: routeIdentity.publicId,
      meta: { ...sheet.meta, campaignId: campaignContext.campaignId }
    },
    campaignContext
  )
}

export async function previewCharacterRestForUser(
  db: Parameters<typeof createCharacterRepository>[0],
  characterId: string,
  input: CharacterRestPreviewRequestDto,
  userId: string
): Promise<CharacterRestPreviewResponseDto> {
  const resolvedCharacterId = await resolveCharacterRouteSubjectId(db, characterId)
  if (!resolvedCharacterId) {
    throw createNamedError('NotFoundError', `Character "${characterId}" was not found.`)
  }
  return previewCharacterRest({
    db,
    characterId: resolvedCharacterId,
    input,
    userId
  })
}

export async function getCharacterSheetPanelForUser(
  db: Parameters<typeof createCharacterRepository>[0],
  characterId: string,
  target: CharacterSheetPanelTargetDto,
  userId: string
): Promise<CharacterSheetPanelDto> {
  const resolvedCharacterId = await resolveCharacterRouteSubjectId(db, characterId)
  if (!resolvedCharacterId) {
    throw createNamedError('NotFoundError', `Character "${characterId}" was not found.`)
  }

  const repository = createCharacterRepository(db)
  const [row, character] = await Promise.all([
    repository.findById(resolvedCharacterId),
    repository.findAuthoredById(resolvedCharacterId)
  ])
  if (
    !row ||
    !character ||
    (character.status ?? AUTHORED_RECORD_STATUS.ACTIVE) !== AUTHORED_RECORD_STATUS.ACTIVE
  ) {
    throw createNamedError('NotFoundError', `Character "${characterId}" was not found.`)
  }
  const campaignContext = await resolveCharacterSheetCampaignContext(db, character, userId)

  const adjustmentRepository = createCharacterSheetAdjustmentRepository(db)
  const playStateRepository = createCharacterSheetPlayStateRepository(db)
  const [resolution, adjustments, movementDisplayPreference, resourceUsage, spellCustomizations] =
    await Promise.all([
      resolveCharacterBuilder(db, character, 'edit'),
      adjustmentRepository.listByCharacter(resolvedCharacterId),
      adjustmentRepository.getMovementPreference(resolvedCharacterId),
      playStateRepository.listResourceUsage(resolvedCharacterId),
      playStateRepository.listSpellCustomizations(resolvedCharacterId)
    ])
  const sheet = await buildCharacterSheetResponse({
    db,
    character,
    resolution,
    streamVersion: row.stream_version,
    adjustments: mergeCampaignSheetAdjustments(adjustments, campaignContext.adjustments),
    movementDisplayPreference,
    resourceUsage,
    spellCustomizations,
    additionalConditions: getVisibleCampaignConditions(campaignContext)
  })
  return buildCharacterSheetPanel({
    character,
    resolution,
    sheet: projectCharacterSheetForViewer(sheet, campaignContext),
    adjustments: getCharacterSheetDisplayAdjustments(adjustments, campaignContext),
    engineAdjustments: mergeCampaignSheetAdjustments(adjustments, campaignContext.adjustments),
    movementDisplayPreference,
    target,
    editable:
      campaignContext.viewer === 'CHARACTER_OWNER' ||
      (campaignContext.viewer === 'CAMPAIGN_OWNER' &&
        campaignContext.campaignStatus === 'ACTIVE' &&
        target.kind === 'SPELLS')
  })
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
  const existing =
    body.mode === 'edit' ? await createCharacterRepository(db).findAuthoredById(authored.id) : null

  return toCharacterBuilderPayload(
    authored,
    await resolveCharacterBuilder(
      db,
      authored,
      body.mode,
      undefined,
      existing?.userId === userId ? existing : null
    )
  )
}

export async function previewCharacterSaveForUser(
  db: Parameters<typeof createCharacterRepository>[0],
  body: ReturnType<typeof characterBuilderSaveRequestDtoSchema.parse>,
  userId: string
): Promise<CharacterBuilderPreviewPayloadDto> {
  const repository = createCharacterRepository(db)
  const existing = await repository.findAuthoredById(body.character.id)
  if (existing && existing.userId !== userId) {
    throw createNamedError(
      'AuthoredContentOwnershipError',
      `Character "${body.character.id}" cannot be edited by the current user.`
    )
  }
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
  const existing = await repository.findAuthoredById(body.character.id)
  if (existing && existing.userId !== userId) {
    throw createNamedError(
      'AuthoredContentOwnershipError',
      `Character "${body.character.id}" cannot be edited by the current user.`
    )
  }
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

  const routeIdentity = await withPersonalCharacterLimit(
    db,
    userId,
    payload.character.id,
    async (trx) => {
      const lockedRepository = createCharacterRepository(trx)
      const lockedDraftRepository = createCharacterBuilderDraftRepository(trx)
      // Entitlements are locked before this Character row lock by withPersonalCharacterLimit.
      await lockCampaignCharacterContentForSave(trx, payload.character.id)
      const activeUpdatedAt = await lockedRepository.findUpdatedAtByIdForUpdate(
        payload.character.id
      )
      const draft = await lockedDraftRepository.findByCharacter({
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

      await lockedRepository.upsertAuthored(payload.character, {
        incrementStreamVersion: true
      })
      await replaceCampaignCharacterContentBindings(trx, payload.character)
      const identity = await createAuthoredRouteIdRepository(trx).ensure({
        subjectKind: 'CHARACTER',
        subjectId: payload.character.id
      })
      await lockedDraftRepository.delete({
        characterId: payload.character.id,
        userId
      })
      return identity
    }
  )

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
  const panelTargets = getAffectedCharacterSheetPanelTargets(command)
  const panels =
    panelTargets.length > 0
      ? await Promise.all(
          panelTargets.map((target) =>
            getCharacterSheetPanelForUser(db, resolvedCharacterId, target, userId)
          )
        )
      : undefined

  return {
    ...result,
    ...(panels ? { panels } : {}),
    sheet: {
      ...result.sheet,
      meta: {
        ...result.sheet.meta,
        hasBuilderDraft: result.sheet.meta.viewer === 'CHARACTER_OWNER' && Boolean(draft)
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
  const campaignContext = await resolveCharacterSheetCampaignContext(db, character, userId)
  const events = await createCharacterEventRepository(db).listByCharacter(resolvedCharacterId)
  return buildCharacterHistoryView(
    filterCharacterHistoryForViewer(events, character.userId, campaignContext.viewer),
    resolvedCharacterId
  )
}
