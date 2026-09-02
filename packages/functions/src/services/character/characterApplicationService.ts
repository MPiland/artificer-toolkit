import {
  createEmptyCharacterAuthored,
  loadCharacterStructuralRuleContext,
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
import {
  executeCharacterSheetCommand,
  type CharacterSheetCommittedRuleSnapshot,
  type CharacterSheetCommandServiceTiming
} from './sheetService.js'
import { buildCharacterSheetBundle } from './sheetProjection.js'
import { assembleCharacterSheetBundleForRuleContext } from './characterSheetBundleAssembly.js'
import { previewCharacterRest } from './sheetRestService.js'
import {
  buildCharacterSheetPanel,
  getAffectedCharacterSheetPanelTargets
} from './sheetPanelService.js'
import {
  type Json,
  checksumCanonicalJson,
  ConcurrencyError,
  createCampaignCharacterMechanicsProjectionRepository,
  createCampaignContentShareRepository,
  createCampaignRepository,
  createAuthoredRouteIdRepository,
  createCharacterBuilderDraftRepository,
  type CharacterBuilderDraft,
  createCharacterEventRepository,
  createCharacterMechanicsProjectionRepository,
  createCharacterRepository,
  createCharacterSheetAdjustmentRepository,
  createCharacterSheetPlayStateRepository,
  createSystemRepository,
  getCharacterPreparationOptionsQuery,
  getCharacterSheetExtraOptionsQuery,
  withTransaction
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
import type {
  CharacterMovementDisplayPreference,
  CharacterSheetAdjustment
} from '@artificer-toolkit/shared/character'
import {
  characterBuilderDraftPayloadDtoSchema,
  characterBuilderResolveRequestDtoSchema,
  characterBuilderDraftSaveRequestDtoSchema,
  characterBuilderCommitRequestDtoSchema,
  characterBuilderSaveRequestDtoSchema,
  characterDraftRequestDtoSchema,
  type CharacterBuilderPayloadDto,
  type CharacterBuilderCommitReceiptDto,
  type CharacterBuilderDraftPayloadDto,
  type CharacterBuilderDraftDto,
  type CharacterBuilderDraftSummaryDto,
  type CharacterBuilderIntentCacheDto,
  type CharacterBuilderPreviewPayloadDto,
  type CharacterListResponseDto,
  type CharacterRestPreviewRequestDto,
  type CharacterRestPreviewResponseDto,
  type CharacterRuleRevisionIdentityDto,
  type CharacterRuleUpgradePreviewRequestDto,
  type CharacterRuleUpgradePreviewResponseDto,
  type CharacterSheetCommandResponseDto,
  characterSheetCommandInputDtoSchema,
  type CharacterSheetExtraCatalogInputDto,
  type CharacterSheetExtraCatalogResponseDto,
  type CharacterSheetResponseDto,
  type CharacterPreparationOptionsResponseDto,
  type CharacterHistoryResponseDto
} from '@artificer-toolkit/schema/api/characters'
import type {
  CharacterSheetPanelDto,
  CharacterSheetPanelTargetDto
} from '@artificer-toolkit/schema/api/characterSheetPanel'
import { assertCharacterBuilderDraftRevisionFresh } from './characterBuilderDraftConflict.js'
import { resolveCharacterRuleBinding, type CharacterRuleBinding } from './characterRuleBinding.js'
import {
  evaluateCharacterRulePolicy,
  type CharacterRuleEvaluationResult
} from './characterRuleEvaluation.js'
import {
  compileCharacterMechanicsProjection,
  carryPinnedCharacterSenseDefinitions,
  loadCurrentCharacterAuthoredVersionVector,
  resolvePinnedCharacterSenseDefinitions
} from './characterMechanicsCompiler.js'
import { compileCharacterSpellCastEntryPoints } from '../rules/characterActionEntryPointCompiler.js'
import { deriveCharacterSceneVision } from './characterSceneVision.js'
import type { CharacterMechanicsProjection } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { AuthoredVersionVector } from '@artificer-toolkit/schema/projections/identity'
import { withPersonalCharacterLimit } from '../account/entitlementService.js'
import {
  CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION,
  prepareCampaignCharacterMechanicsProjection
} from '../campaign/campaignCharacterMechanicsProjection.js'
import {
  lockCampaignCharacterContentForSave,
  loadCampaignCharacterContentOverlay
} from './campaignCharacterContent.js'
import {
  checksumCampaignCharacterMechanicalContext,
  filterCharacterHistoryForViewer,
  getCharacterSheetDisplayAdjustments,
  getVisibleCampaignConditions,
  mergeCampaignSheetAdjustments,
  projectCharacterSheetForViewer,
  resolveCharacterSheetCampaignContext,
  type CharacterSheetCampaignContext
} from './campaignCharacterSheet.js'
import {
  presentCampaignCharacterHistory,
  presentCampaignCharacterText
} from './campaignCharacterPresentation.js'
import { loadActiveCharacterCreatures } from './characterActiveAuthoredSources.js'
import type { CharacterSheetRuleProjection } from './characterSheetRuleProjection.js'
import { materializeCharacterStartingEquipment } from './characterStartingEquipmentState.js'
import { classifyCharacterSheetCommandRuleResponsibility } from './characterSheetCommandResponsibility.js'
import { collectCharacterSpellPreparationEligibility } from './characterSpellPreparationEligibility.js'

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

function toCharacterRuleRevisionIdentity(
  binding: CharacterRuleBinding
): CharacterRuleRevisionIdentityDto {
  return {
    revisionId: binding.revisionId,
    checksum: binding.checksum,
    evaluatorKind: binding.evaluatorKind,
    evaluatorVersion: binding.evaluatorVersion,
    modelContractVersion: binding.modelContractVersion
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
  authoredContentUpgrade?: NonNullable<CharacterBuilderPreviewPayloadDto['authoredContentUpgrade']>
}): CharacterBuilderPreviewPayloadDto {
  return {
    character: params.character,
    resolution: stripCharacterBuilderResolution(params.resolution),
    preview: params.preview,
    ...(params.authoredContentUpgrade
      ? { authoredContentUpgrade: params.authoredContentUpgrade }
      : {})
  }
}

export function createAuthoredContentUpgradePreview(input: {
  candidateCharacter: CharacterAuthored
  candidateVector: AuthoredVersionVector
  characterId: string
  currentVector: AuthoredVersionVector
  streamVersion: number
}): NonNullable<CharacterBuilderPreviewPayloadDto['authoredContentUpgrade']> | undefined {
  const currentByRoot = new Map(
    input.currentVector.map((entry) => [`${entry.subjectKind}:${entry.subjectId}`, entry] as const)
  )
  const candidateByRoot = new Map(
    input.candidateVector.map(
      (entry) => [`${entry.subjectKind}:${entry.subjectId}`, entry] as const
    )
  )
  const changes = [...new Set([...currentByRoot.keys(), ...candidateByRoot.keys()])]
    .sort((left, right) => left.localeCompare(right))
    .flatMap((key) => {
      const previous = currentByRoot.get(key) ?? null
      const next = candidateByRoot.get(key) ?? null
      if (
        previous?.versionId === next?.versionId &&
        previous?.version === next?.version &&
        previous?.checksum === next?.checksum
      ) {
        return []
      }
      const subjectKind = previous?.subjectKind ?? next?.subjectKind
      const subjectId = previous?.subjectId ?? next?.subjectId
      if (!subjectKind || !subjectId) {
        throw new Error(`Invalid authored version vector key "${key}".`)
      }
      return [{ subjectKind, subjectId, previous, next }]
    })
  if (changes.length === 0) return undefined

  return {
    currentVector: input.currentVector,
    candidateVector: input.candidateVector,
    changes,
    previewChecksum: checksumCanonicalJson({
      characterId: input.characterId,
      streamVersion: input.streamVersion,
      candidateCharacter: input.candidateCharacter,
      currentVector: input.currentVector,
      candidateVector: input.candidateVector
    })
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
  existingRevisionId: string | null
  userId: string
}): Promise<{
  character: CharacterAuthored
  resolution: CharacterBuilderResolution
  preview: CharacterBuilderPreview
  ruleBinding?: CharacterRuleBinding
  ruleEvaluation?: CharacterRuleEvaluationResult
}> {
  const authored = {
    ...params.character,
    status: params.existing?.status ?? AUTHORED_RECORD_STATUS.DRAFT,
    userId: params.userId
  }
  let context = await loadCharacterStructuralRuleContext(params.db, authored, [], {
    includeEffects: true
  })
  const reconciled = await reconcileCharacterBuilderCharacter(
    params.db,
    authored,
    params.existing,
    context,
    params.existingRevisionId
  )
  let draftResolution = await resolveCharacterBuilder(
    params.db,
    {
      ...reconciled,
      status: AUTHORED_RECORD_STATUS.DRAFT
    },
    params.mode,
    context,
    params.existing,
    params.existingRevisionId
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
      context = await loadCharacterStructuralRuleContext(params.db, character, [], {
        includeEffects: true
      })
      draftResolution = await resolveCharacterBuilder(
        params.db,
        { ...character, status: AUTHORED_RECORD_STATUS.DRAFT },
        params.mode,
        context,
        params.existing,
        params.existingRevisionId
      )
    }
    const creatureIds = [
      ...new Set((character.state.creatures ?? []).map((entry) => entry.creatureId))
    ]
    const [adjustments, resourceUsage, creaturesById] = await Promise.all([
      createCharacterSheetAdjustmentRepository(params.db).listByCharacter(character.id),
      createCharacterSheetPlayStateRepository(params.db).listResourceUsage(character.id),
      loadActiveCharacterCreatures({
        characterId: character.id,
        db: params.db,
        creatureIds,
        systemId: character.systemId,
        userId: character.userId
      })
    ])
    if (creaturesById.size !== creatureIds.length) {
      throw new Error(`Character "${character.id}" requires active Creature versions.`)
    }
    const ruleEvaluation = await evaluateCharacterRulePolicy({
      db: params.db,
      character,
      context,
      existingRevisionId: params.existingRevisionId,
      adjustments,
      creaturesById,
      resourceUsage
    })
    const effectiveMaxHitPoints = Math.max(
      ruleEvaluation.output.derivedStats.maxHitPoints.effective,
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

    const resolution = {
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
      ruleBinding: ruleEvaluation.binding,
      ruleEvaluation,
      preview: createCharacterBuilderChangePreview({
        previousCharacter: params.existing,
        nextCharacter: character,
        predictedStatus: persistedStatus,
        context
      })
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

async function requireCharacterRuleBinding(
  db: Parameters<typeof createCharacterRepository>[0],
  input: { systemId: string; primaryRulesCatalogueId: string }
): Promise<void> {
  const systems = createSystemRepository(db)
  if (!(await systems.findById(input.systemId))) {
    throw createNamedError('CharacterRuleBindingError', 'The selected Game System is unavailable.')
  }
  if (
    !(await systems.hasRulesCatalogue({
      gameSystemId: input.systemId,
      rulesCatalogueId: input.primaryRulesCatalogueId
    }))
  ) {
    throw createNamedError(
      'CharacterRuleBindingError',
      'The selected primary Rules Catalogue is unavailable for the Game System.'
    )
  }
}

function assertImmutableCharacterRuleBinding(
  candidate: Pick<CharacterAuthored, 'systemId' | 'primaryRulesCatalogueId'>,
  authoritative: { systemId: string; primaryRulesCatalogueId: string },
  source: 'active Character' | 'Character draft'
): void {
  if (
    candidate.systemId !== authoritative.systemId ||
    candidate.primaryRulesCatalogueId !== authoritative.primaryRulesCatalogueId
  ) {
    throw createNamedError(
      'CharacterRuleBindingError',
      `Character Game System and primary Rules Catalogue must match the existing ${source}.`
    )
  }
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

  return withPersonalCharacterLimit(params.db, params.userId, params.characterId, async (trx) => {
    const assignedCampaignId = await lockCampaignCharacterContentForSave(trx, params.characterId)
    const characterRepository = createCharacterRepository(trx)
    const draftRepository = createCharacterBuilderDraftRepository(trx)
    if (assignedCampaignId) {
      await createCampaignCharacterMechanicsProjectionRepository(trx).lockAssignment({
        campaignId: assignedCampaignId,
        characterId: params.characterId
      })
    }
    await characterRepository.findUpdatedAtByIdForUpdate(params.characterId)
    const [lockedCharacter, lockedDraft] = await Promise.all([
      characterRepository.findById(params.characterId),
      draftRepository.lockByCharacter({
        characterId: params.characterId,
        userId: params.userId
      })
    ])
    if (lockedCharacter) {
      assertImmutableCharacterRuleBinding(
        character,
        {
          systemId: lockedCharacter.system_id,
          primaryRulesCatalogueId: lockedCharacter.primary_rules_catalogue_id
        },
        'active Character'
      )
    }
    if (lockedDraft) {
      const lockedPayload = parseStoredCharacterBuilderDraftPayload(lockedDraft.payload)
      if (!lockedPayload) {
        throw createNamedError(
          'CharacterBuilderDraftPayloadError',
          `Character builder draft "${lockedDraft.characterId}" is malformed.`
        )
      }
      assertImmutableCharacterRuleBinding(
        character,
        {
          systemId: lockedDraft.systemId,
          primaryRulesCatalogueId: lockedPayload.character.primaryRulesCatalogueId
        },
        'Character draft'
      )
    }
    return draftRepository.save({
      characterId: params.characterId,
      userId: params.userId,
      systemId: character.systemId,
      label: character.label || 'Untitled Character',
      mode: params.mode,
      payload: payload as unknown as Json,
      baseActiveUpdatedAt: params.baseActiveUpdatedAt ?? null
    })
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

    if (
      body.systemId !== draft.systemId ||
      body.primaryRulesCatalogueId !== parsedDraftPayload.character.primaryRulesCatalogueId
    ) {
      throw createNamedError(
        'CharacterRuleBindingError',
        'The requested Character rule binding does not match the existing draft.'
      )
    }

    const character = normalizeCharacterDraftPayload({
      character: parsedDraftPayload.character,
      characterId: draft.characterId,
      userId,
      systemId: draft.systemId,
      label: draft.label
    })

    const row = await repository.findById(draft.characterId)
    const resolution = await resolveCharacterBuilder(
      db,
      character,
      draft.mode,
      undefined,
      null,
      row?.rule_pack_revision_id ?? null
    )
    return toCharacterBuilderPayload(character, resolution, parsedDraftPayload.builderIntent)
  }

  const [existing, existingRow] = await Promise.all([
    repository.findAuthoredById(body.id),
    repository.findById(body.id)
  ])
  if (existing) {
    if (existing.userId !== userId) {
      throw createNamedError(
        'AuthoredContentOwnershipError',
        `Character "${body.id}" cannot be edited by the current user.`
      )
    }
    if (
      body.systemId !== existing.systemId ||
      body.primaryRulesCatalogueId !== existing.primaryRulesCatalogueId
    ) {
      throw createNamedError(
        'CharacterRuleBindingError',
        'The requested Character rule binding does not match the existing Character.'
      )
    }
    return toCharacterBuilderPayload(
      existing,
      await resolveCharacterBuilder(
        db,
        existing,
        'create',
        undefined,
        null,
        existingRow?.rule_pack_revision_id ?? null
      )
    )
  }

  if (!body.systemId || !body.primaryRulesCatalogueId) {
    throw new Error(
      'System id and primary Rules Catalogue id are required when creating a new character draft.'
    )
  }

  await requireCharacterRuleBinding(db, {
    systemId: body.systemId,
    primaryRulesCatalogueId: body.primaryRulesCatalogueId
  })

  const character = createEmptyCharacterAuthored({
    id: body.id,
    primaryRulesCatalogueId: body.primaryRulesCatalogueId,
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
  if (existing) {
    assertImmutableCharacterRuleBinding(body.character, existing, 'active Character')
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
  const [character, row, activeUpdatedAt] = await Promise.all([
    repository.findAuthoredById(resolvedCharacterId),
    repository.findById(resolvedCharacterId),
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
    await resolveCharacterBuilder(
      db,
      character,
      'edit',
      undefined,
      null,
      row?.rule_pack_revision_id ?? null
    ),
    undefined,
    activeUpdatedAt,
    routeIdentity.publicId
  )
}

export interface CharacterSheetForUserBundle {
  response: CharacterSheetResponseDto
  ruleSnapshot: CharacterSheetCommittedRuleSnapshot
  panelSources: {
    campaignContext: CharacterSheetCampaignContext
    character: CharacterAuthored
    characterAdjustments: readonly CharacterSheetAdjustment[]
    movementDisplayPreference: CharacterMovementDisplayPreference
    ruleProjection: CharacterSheetRuleProjection
  }
}

export async function getCharacterSheetBundleForUser(
  db: Parameters<typeof createCharacterRepository>[0],
  characterId: string,
  userId: string
): Promise<CharacterSheetForUserBundle | null> {
  const resolvedCharacterId = await resolveCharacterRouteSubjectId(db, characterId)
  if (!resolvedCharacterId) return null

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
    return null
  }
  if (!row.rule_pack_revision_id) {
    throw createNamedError(
      'CharacterRuleBindingError',
      `Active Character "${character.id}" does not have a pinned rule revision.`
    )
  }
  const campaignContext = await resolveCharacterSheetCampaignContext(db, character, userId)

  const routeIdentity = await createAuthoredRouteIdRepository(db).ensure({
    subjectKind: 'CHARACTER',
    subjectId: character.id
  })

  const {
    bundle,
    campaignMechanics,
    mechanics,
    resolution,
    characterAdjustments,
    movementDisplayPreference
  } = await assembleCharacterSheetBundleForRuleContext({
    db,
    character,
    campaignId: campaignContext.campaignId,
    row,
    revisionId: row.rule_pack_revision_id,
    ruleContext: {
      adjustments: campaignContext.adjustments,
      additionalConditions: getVisibleCampaignConditions(campaignContext),
      attunementSlotOverride: campaignContext.attunementSlotOverride
    }
  })

  return {
    response: projectCharacterSheetForViewer(
      {
        ...bundle.sheet,
        publicId: routeIdentity.publicId,
        meta: { ...bundle.sheet.meta, campaignId: campaignContext.campaignId }
      },
      campaignContext
    ),
    ruleSnapshot: {
      effectiveSceneVision: deriveCharacterSceneVision(
        character.id,
        carryPinnedCharacterSenseDefinitions({
          prior: mechanics.pinnedSenseDefinitions,
          senses: campaignMechanics?.rulePolicyOutput.senses ?? mechanics.rulePolicyOutput.senses
        })
      ),
      mechanicsProjectionChecksum: mechanics.projectionChecksum,
      mechanicsCommandLaneChecksum: mechanics.commandLaneChecksum,
      mechanicsPayload: {
        ruleSnapshot: mechanics.ruleSnapshot,
        rulePolicyInput: mechanics.rulePolicyInput,
        rulePolicyOutput: mechanics.rulePolicyOutput,
        initiativeActorFacts: mechanics.initiativeActorFacts,
        pinnedSenseDefinitions: mechanics.pinnedSenseDefinitions,
        ruleRegistry: mechanics.ruleRegistry,
        compiledActionEntryPoints: mechanics.compiledActionEntryPoints
      },
      campaignMechanicalContextChecksum: campaignContext.campaignId
        ? checksumCampaignCharacterMechanicalContext({
            adjustments: campaignContext.adjustments,
            attunementSlotOverride: campaignContext.attunementSlotOverride
          })
        : null,
      campaignMechanicsProjectionChecksum: campaignMechanics?.projectionChecksum ?? null,
      streamVersion: row.stream_version,
      evaluation: bundle.ruleEvaluation,
      resolution
    },
    panelSources: {
      campaignContext,
      character,
      characterAdjustments,
      movementDisplayPreference,
      ruleProjection: bundle.ruleProjection
    }
  }
}

export async function getCharacterSheetForUser(
  db: Parameters<typeof createCharacterRepository>[0],
  characterId: string,
  userId: string
): Promise<CharacterSheetResponseDto | null> {
  return (await getCharacterSheetBundleForUser(db, characterId, userId))?.response ?? null
}

export async function getCharacterSheetActionsForUser(
  db: Parameters<typeof createCharacterRepository>[0],
  characterId: string,
  userId: string
): Promise<CharacterSheetResponseDto['actions']['items'] | null> {
  return (await getCharacterSheetForUser(db, characterId, userId))?.actions.items ?? null
}

export async function getCharacterSheetExtraOptionsForUser(
  db: Parameters<typeof createCharacterRepository>[0],
  characterId: string,
  input: CharacterSheetExtraCatalogInputDto,
  userId: string
): Promise<CharacterSheetExtraCatalogResponseDto> {
  const resolvedCharacterId = await resolveCharacterRouteSubjectId(db, characterId)
  if (!resolvedCharacterId) {
    throw createNamedError('NotFoundError', `Character "${characterId}" was not found.`)
  }
  const character = await createCharacterRepository(db).findAuthoredById(resolvedCharacterId)
  if (
    !character ||
    (character.status ?? AUTHORED_RECORD_STATUS.ACTIVE) !== AUTHORED_RECORD_STATUS.ACTIVE
  ) {
    throw createNamedError('NotFoundError', `Character "${characterId}" was not found.`)
  }
  await resolveCharacterSheetCampaignContext(db, character, userId)
  return getCharacterSheetExtraOptionsQuery(db, {
    ...input,
    systemId: character.systemId,
    userId: character.userId
  })
}

export async function getCharacterPreparationOptionsForUser(
  db: Parameters<typeof createCharacterRepository>[0],
  characterId: string,
  userId: string
): Promise<CharacterPreparationOptionsResponseDto> {
  return withTransaction(db, async (trx) => {
    const resolvedCharacterId = await resolveCharacterRouteSubjectId(trx, characterId)
    if (!resolvedCharacterId) {
      throw createNamedError('NotFoundError', `Character "${characterId}" was not found.`)
    }

    const character = await createCharacterRepository(trx).findAuthoredById(resolvedCharacterId)
    if (
      !character ||
      (character.status ?? AUTHORED_RECORD_STATUS.ACTIVE) !== AUTHORED_RECORD_STATUS.ACTIVE
    ) {
      throw createNamedError('NotFoundError', `Character "${characterId}" was not found.`)
    }

    const assignment =
      await createCampaignRepository(trx).findCampaignByCharacter(resolvedCharacterId)
    if (assignment) {
      const access = await createCampaignContentShareRepository(
        trx
      ).lockCampaignMemberForContentRead({
        campaignId: assignment.campaignId,
        userId
      })
      if (!access.campaignExists || !access.memberActive) {
        throw createNamedError('NotFoundError', `Character "${characterId}" was not found.`)
      }
    }

    const bundle = await getCharacterSheetBundleForUser(trx, resolvedCharacterId, userId)
    if (!bundle) {
      throw createNamedError('NotFoundError', `Character "${characterId}" was not found.`)
    }

    const eligibility = collectCharacterSpellPreparationEligibility({
      rulePolicyInput: bundle.ruleSnapshot.evaluation.facts,
      rulePolicyOutput: bundle.ruleSnapshot.evaluation.output
    })
    const summaries = await getCharacterPreparationOptionsQuery(trx, {
      spellIds: eligibility.flatMap((source) => source.eligibleSpellIds),
      systemId: character.systemId,
      ownerUserId: character.userId,
      viewerUserId: userId,
      campaignId: assignment?.campaignId ?? null
    })
    const summariesById = new Map(summaries.map((spell) => [spell.id, spell]))
    const committedSpellsById = new Map(
      bundle.response.spells.spells.map((spell) => [spell.id, spell])
    )
    const classLabelsById = new Map(
      bundle.ruleSnapshot.resolution.registry.classes.map((record) => [record.id, record.label])
    )

    return {
      characterId: resolvedCharacterId,
      streamVersion: bundle.response.meta.streamVersion,
      classes: eligibility.map((source) => {
        const label = classLabelsById.get(source.classId)
        if (!label) {
          throw createNamedError(
            'CharacterRuleEvaluationError',
            `Preparation source class "${source.classId}" is unavailable.`
          )
        }
        return {
          classId: source.classId,
          label,
          preparedSpellLimit: source.preparedSpellLimit,
          options: source.eligibleSpellIds
            .flatMap((spellId) => {
              const summary = summariesById.get(spellId)
              if (!summary) return []
              const committed = committedSpellsById.get(spellId)
              return [
                {
                  spellId,
                  label: committed?.label ?? summary.label,
                  level: committed?.level ?? summary.level,
                  prepared: source.preparedSpellIds.includes(spellId),
                  committed: committed !== undefined
                }
              ]
            })
            .sort(
              (left, right) =>
                left.level - right.level ||
                left.label.localeCompare(right.label) ||
                left.spellId.localeCompare(right.spellId)
            )
        }
      })
    }
  })
}

export async function previewCharacterRuleUpgradeForUser(
  db: Parameters<typeof createCharacterRepository>[0],
  characterId: string,
  input: CharacterRuleUpgradePreviewRequestDto,
  userId: string
): Promise<CharacterRuleUpgradePreviewResponseDto> {
  const resolvedCharacterId = await resolveCharacterRouteSubjectId(db, characterId)
  if (!resolvedCharacterId) {
    throw createNamedError('NotFoundError', `Character "${characterId}" was not found.`)
  }
  const currentBundle = await getCharacterSheetBundleForUser(db, resolvedCharacterId, userId)
  if (!currentBundle) {
    throw createNamedError('NotFoundError', `Character "${characterId}" was not found.`)
  }
  if (currentBundle.ruleSnapshot.streamVersion !== input.expectedVersion) {
    throw new ConcurrencyError(resolvedCharacterId, input.expectedVersion)
  }
  const { campaignContext, character, characterAdjustments, movementDisplayPreference } =
    currentBundle.panelSources
  const playStateRepository = createCharacterSheetPlayStateRepository(db)
  const [targetRevision, resourceUsage, spellCustomizations] = await Promise.all([
    resolveCharacterRuleBinding({
      db,
      systemId: character.systemId,
      existingRevisionId: null
    }),
    playStateRepository.listResourceUsage(character.id),
    playStateRepository.listSpellCustomizations(character.id)
  ])
  const { sheet } = await buildCharacterSheetBundle({
    db,
    character,
    resolution: currentBundle.ruleSnapshot.resolution,
    streamVersion: currentBundle.ruleSnapshot.streamVersion,
    hasBuilderDraft: currentBundle.response.meta.hasBuilderDraft,
    adjustments: mergeCampaignSheetAdjustments(characterAdjustments, campaignContext.adjustments),
    movementDisplayPreference,
    resourceUsage,
    spellCustomizations,
    additionalConditions: getVisibleCampaignConditions(campaignContext),
    ruleEvaluation: {
      context: currentBundle.ruleSnapshot.evaluation.context,
      revisionId: targetRevision.revisionId,
      attunementSlotOverride: campaignContext.attunementSlotOverride
    }
  })

  return {
    characterId: character.id,
    streamVersion: currentBundle.ruleSnapshot.streamVersion,
    currentRevision: toCharacterRuleRevisionIdentity(currentBundle.ruleSnapshot.evaluation.binding),
    targetRevision: toCharacterRuleRevisionIdentity(targetRevision),
    upgradeAvailable:
      currentBundle.ruleSnapshot.evaluation.binding.revisionId !== targetRevision.revisionId,
    sheet: projectCharacterSheetForViewer(
      {
        ...sheet,
        publicId: currentBundle.response.publicId,
        meta: { ...sheet.meta, campaignId: campaignContext.campaignId }
      },
      campaignContext
    )
  }
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
  const bundle = await getCharacterSheetBundleForUser(db, resolvedCharacterId, userId)
  if (!bundle) {
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
  const bundle = await getCharacterSheetBundleForUser(db, characterId, userId)
  if (!bundle) {
    throw createNamedError('NotFoundError', `Character "${characterId}" was not found.`)
  }
  const {
    campaignContext,
    character,
    characterAdjustments,
    movementDisplayPreference,
    ruleProjection
  } = bundle.panelSources
  return presentCampaignCharacterText(
    buildCharacterSheetPanel({
      character,
      resolution: bundle.ruleSnapshot.resolution,
      sheet: bundle.response,
      ruleProjection,
      adjustments: getCharacterSheetDisplayAdjustments(characterAdjustments, campaignContext),
      movementDisplayPreference,
      target,
      editable:
        campaignContext.viewer === 'CHARACTER_OWNER' ||
        (campaignContext.viewer === 'CAMPAIGN_OWNER' &&
          campaignContext.campaignStatus === 'ACTIVE' &&
          target.kind === 'SPELLS')
    }),
    campaignContext.contentMaturity
  )
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
  const repository = createCharacterRepository(db)
  const [existing, row] =
    body.mode === 'edit'
      ? await Promise.all([
          repository.findAuthoredById(authored.id),
          repository.findById(authored.id)
        ])
      : [null, null]

  return toCharacterBuilderPayload(
    authored,
    await resolveCharacterBuilder(
      db,
      authored,
      body.mode,
      undefined,
      existing?.userId === userId ? existing : null,
      existing?.userId === userId ? (row?.rule_pack_revision_id ?? null) : null
    )
  )
}

export async function previewCharacterSaveForUser(
  db: Parameters<typeof createCharacterRepository>[0],
  body: ReturnType<typeof characterBuilderSaveRequestDtoSchema.parse>,
  userId: string
): Promise<CharacterBuilderPreviewPayloadDto> {
  const repository = createCharacterRepository(db)
  const [existing, row] = await Promise.all([
    repository.findAuthoredById(body.character.id),
    repository.findById(body.character.id)
  ])
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
    existingRevisionId: row?.rule_pack_revision_id ?? null,
    userId
  })

  let currentMechanicsSource: {
    authoredVersionVector: AuthoredVersionVector
  } | null = null
  if (existing?.status === AUTHORED_RECORD_STATUS.ACTIVE && row?.rule_pack_revision_id) {
    const mechanicsRepository = createCharacterMechanicsProjectionRepository(db)
    try {
      currentMechanicsSource = await mechanicsRepository.requireCurrent({
        characterId: existing.id,
        expectedRuleRevisionId: row.rule_pack_revision_id,
        expectedStreamVersion: row.stream_version
      })
    } catch {
      currentMechanicsSource = await mechanicsRepository.requireLegacyFinalizationUpgradeSource({
        characterId: existing.id,
        expectedRuleRevisionId: row.rule_pack_revision_id,
        expectedStreamVersion: row.stream_version,
        expectedSystemId: row.system_id
      })
    }
  }
  const authoredContentUpgrade =
    currentMechanicsSource &&
    row &&
    payload.character.status === AUTHORED_RECORD_STATUS.ACTIVE &&
    payload.ruleEvaluation
      ? createAuthoredContentUpgradePreview({
          characterId: payload.character.id,
          streamVersion: row.stream_version,
          currentVector: currentMechanicsSource.authoredVersionVector,
          candidateVector: await loadCurrentCharacterAuthoredVersionVector({
            db,
            character: payload.character,
            rulePolicyOutput: payload.ruleEvaluation.output,
            ruleRegistry: payload.ruleEvaluation.registry,
            campaignContent: await loadCampaignCharacterContentOverlay(db, payload.character)
          }),
          candidateCharacter: payload.character
        })
      : undefined

  return toCharacterBuilderPreviewPayload({
    ...payload,
    authoredContentUpgrade
  })
}

export async function upsertCharacterBuilderForUser(
  db: Parameters<typeof createCharacterRepository>[0],
  body: ReturnType<typeof characterBuilderCommitRequestDtoSchema.parse>,
  userId: string
): Promise<CharacterBuilderCommitReceiptDto> {
  const repository = createCharacterRepository(db)
  const existing = await repository.findAuthoredById(body.character.id)
  if (existing && existing.userId !== userId) {
    throw createNamedError(
      'AuthoredContentOwnershipError',
      `Character "${body.character.id}" cannot be edited by the current user.`
    )
  }
  const committed = await withPersonalCharacterLimit(db, userId, body.character.id, async (trx) => {
    const lockedRepository = createCharacterRepository(trx)
    const lockedDraftRepository = createCharacterBuilderDraftRepository(trx)
    // Entitlements precede Campaign content, assignment, and Character locks.
    const assignedCampaignId = await lockCampaignCharacterContentForSave(trx, body.character.id)
    if (assignedCampaignId) {
      await createCampaignCharacterMechanicsProjectionRepository(trx).lockAssignment({
        campaignId: assignedCampaignId,
        characterId: body.character.id
      })
    }
    const activeUpdatedAt = await lockedRepository.findUpdatedAtByIdForUpdate(body.character.id)
    const lockedCharacter = await lockedRepository.findById(body.character.id)
    const draft = await lockedDraftRepository.lockByCharacter({
      characterId: body.character.id,
      userId
    })
    if (lockedCharacter) {
      assertImmutableCharacterRuleBinding(
        body.character,
        {
          systemId: lockedCharacter.system_id,
          primaryRulesCatalogueId: lockedCharacter.primary_rules_catalogue_id
        },
        'active Character'
      )
    }
    if (draft) {
      const draftPayload = parseStoredCharacterBuilderDraftPayload(draft.payload)
      if (!draftPayload) {
        throw createNamedError(
          'CharacterBuilderDraftPayloadError',
          `Character builder draft "${draft.characterId}" is malformed.`
        )
      }
      assertImmutableCharacterRuleBinding(
        body.character,
        {
          systemId: draft.systemId,
          primaryRulesCatalogueId: draftPayload.character.primaryRulesCatalogueId
        },
        'Character draft'
      )
    }
    const baseActiveUpdatedAt = draft?.baseActiveUpdatedAt ?? body.baseActiveUpdatedAt ?? null
    assertCharacterBuilderDraftRevisionFresh({
      activeUpdatedAt,
      baseActiveUpdatedAt,
      characterId: body.character.id,
      shouldCheckRevision: draft != null || body.baseActiveUpdatedAt != null
    })

    let currentMechanics: CharacterMechanicsProjection | null = null
    let legacyUpgradeSource: {
      authoredVersionVector: AuthoredVersionVector
      projectionChecksum: string
    } | null = null
    if (lockedCharacter?.status === AUTHORED_RECORD_STATUS.ACTIVE) {
      if (!lockedCharacter.rule_pack_revision_id) {
        throw createNamedError(
          'CharacterRuleBindingError',
          `Active Character "${body.character.id}" does not have a pinned rule revision.`
        )
      }
      const mechanicsRepository = createCharacterMechanicsProjectionRepository(trx)
      try {
        currentMechanics = await mechanicsRepository.requireCurrent({
          characterId: body.character.id,
          expectedRuleRevisionId: lockedCharacter.rule_pack_revision_id,
          expectedStreamVersion: lockedCharacter.stream_version
        })
      } catch {
        legacyUpgradeSource = await mechanicsRepository.requireLegacyFinalizationUpgradeSource({
          characterId: body.character.id,
          expectedRuleRevisionId: lockedCharacter.rule_pack_revision_id,
          expectedStreamVersion: lockedCharacter.stream_version,
          expectedSystemId: lockedCharacter.system_id
        })
      }
    }
    const campaignContext = await resolveCharacterSheetCampaignContext(
      trx,
      { id: body.character.id, userId },
      userId
    )
    let priorCampaignOverlayChecksum: string | null = null
    if (campaignContext.campaignId) {
      const campaignMechanicsRepository = createCampaignCharacterMechanicsProjectionRepository(trx)
      if (currentMechanics) {
        const overlay = await campaignMechanicsRepository.requireCurrent({
          campaignId: campaignContext.campaignId,
          characterId: body.character.id,
          expectedBaseMechanicsProjectionChecksum: currentMechanics.projectionChecksum,
          expectedCharacterStreamVersion: currentMechanics.characterStreamVersion,
          expectedMechanicalContextChecksum: checksumCampaignCharacterMechanicalContext({
            adjustments: campaignContext.adjustments,
            attunementSlotOverride: campaignContext.attunementSlotOverride
          }),
          expectedProjectionSchemaVersion: CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION,
          baseMechanicsProjection: currentMechanics
        })
        priorCampaignOverlayChecksum = overlay.projectionChecksum
      } else if (legacyUpgradeSource) {
        priorCampaignOverlayChecksum =
          await campaignMechanicsRepository.requireFinalizationUpgradeChecksum({
            campaignId: campaignContext.campaignId,
            characterId: body.character.id,
            expectedBaseMechanicsProjectionChecksum: legacyUpgradeSource.projectionChecksum,
            expectedCharacterStreamVersion: lockedCharacter?.stream_version ?? 0,
            expectedMechanicalContextChecksum: checksumCampaignCharacterMechanicalContext({
              adjustments: campaignContext.adjustments,
              attunementSlotOverride: campaignContext.attunementSlotOverride
            })
          })
      }
    }

    const payload = await buildCharacterBuilderSavePayload({
      db: trx,
      character: body.character,
      mode: body.mode,
      targetStatus: body.targetStatus ?? AUTHORED_RECORD_STATUS.ACTIVE,
      existing,
      existingRevisionId: lockedCharacter?.rule_pack_revision_id ?? null,
      userId
    })
    if (!payload.resolution.readiness.ready) {
      throw createNamedError(
        'NodeRuntimeInputError',
        'Character cannot be finalized until all required builder choices are complete.'
      )
    }
    if (!payload.ruleBinding || !payload.ruleEvaluation) {
      throw createNamedError(
        'CharacterRuleBindingError',
        'An active Character save did not produce a mechanics evaluation.'
      )
    }
    const ruleEvaluation = payload.ruleEvaluation
    const authoredVersionVector = await loadCurrentCharacterAuthoredVersionVector({
      db: trx,
      character: payload.character,
      rulePolicyOutput: ruleEvaluation.output,
      ruleRegistry: ruleEvaluation.registry,
      campaignContent: await loadCampaignCharacterContentOverlay(trx, payload.character)
    })
    const authoredContentUpgrade =
      (currentMechanics || legacyUpgradeSource) && lockedCharacter
        ? createAuthoredContentUpgradePreview({
            characterId: payload.character.id,
            streamVersion: lockedCharacter.stream_version,
            currentVector:
              currentMechanics?.authoredVersionVector ?? legacyUpgradeSource!.authoredVersionVector,
            candidateVector: authoredVersionVector,
            candidateCharacter: payload.character
          })
        : undefined
    if (
      authoredContentUpgrade &&
      body.authoredContentUpgradePreviewChecksum !== authoredContentUpgrade.previewChecksum
    ) {
      throw createNamedError(
        'CharacterAuthoredContentUpgradeRequiredError',
        `Character "${payload.character.id}" requires an authored-content upgrade preview before it can be committed.`
      )
    }

    const ruleBinding = await resolveCharacterRuleBinding({
      db: trx,
      systemId: payload.character.systemId,
      existingRevisionId: lockedCharacter?.rule_pack_revision_id ?? null,
      expectedRevisionId: payload.ruleBinding.revisionId
    })
    const pinnedSenseDefinitions = await resolvePinnedCharacterSenseDefinitions({
      db: trx,
      gameSystemId: payload.character.systemId,
      senses: ruleEvaluation.output.senses
    })
    let nextStreamVersion: number | null = null
    await lockedRepository.upsertAuthored(payload.character, {
      incrementStreamVersion: true,
      rulePackRevisionId: ruleBinding.revisionId,
      afterPersist: async (_persistDb, persistedStreamVersion) => {
        nextStreamVersion = persistedStreamVersion
      }
    })
    if (nextStreamVersion === null) {
      throw createNamedError(
        'CharacterRuleBindingError',
        `Character "${payload.character.id}" did not publish a stream version.`
      )
    }
    const vocabularySnapshot = ruleEvaluation.vocabularySnapshot
    if (!vocabularySnapshot) {
      throw createNamedError(
        'CharacterRuleBindingError',
        `Character "${payload.character.id}" did not retain its structural vocabulary snapshot.`
      )
    }
    const publishedMechanics = await createCharacterMechanicsProjectionRepository(trx).publish(
      compileCharacterMechanicsProjection({
        characterId: payload.character.id,
        characterCommandState: payload.character,
        characterStreamVersion: nextStreamVersion,
        vocabularySnapshot,
        ruleBinding,
        rulePolicyInput: ruleEvaluation.facts,
        rulePolicyOutput: ruleEvaluation.output,
        pinnedSenseDefinitions,
        compiledActionEntryPoints: ruleEvaluation.compiledActionEntryPoints,
        compiledSpellActionEntryPoints: compileCharacterSpellCastEntryPoints({
          gameSystemId: payload.character.systemId,
          candidates: ruleEvaluation.facts.spellCastCandidates,
          decisions: ruleEvaluation.output.spellCastDecisions,
          mechanics: ruleEvaluation.output.spellCastMechanics,
          spellActionFacts: ruleEvaluation.facts.spellActionFacts,
          spells: ruleEvaluation.spellsWithEffects,
          authoredVersionVector
        }),
        ruleRegistry: ruleEvaluation.registry,
        ruleSnapshot: ruleEvaluation.snapshot,
        authoredVersionVector
      }),
      legacyUpgradeSource
        ? {
            expectedPriorProjectionChecksum: legacyUpgradeSource.projectionChecksum
          }
        : undefined
    )
    if (campaignContext.campaignId) {
      const overlay = await prepareCampaignCharacterMechanicsProjection({
        db: trx,
        campaignId: campaignContext.campaignId,
        character: payload.character,
        characterStreamVersion: nextStreamVersion,
        mechanics: publishedMechanics,
        campaignAdjustments: campaignContext.adjustments,
        attunementSlotOverride: campaignContext.attunementSlotOverride
      })
      await createCampaignCharacterMechanicsProjectionRepository(trx).publish({
        projection: overlay,
        expectedPriorOverlayChecksum: priorCampaignOverlayChecksum
      })
    }
    const identity = await createAuthoredRouteIdRepository(trx).ensure({
      subjectKind: 'CHARACTER',
      subjectId: payload.character.id
    })
    await lockedDraftRepository.delete({
      characterId: payload.character.id,
      userId
    })
    return {
      identity,
      payload,
      mechanicsProjectionChecksum: publishedMechanics.projectionChecksum,
      streamVersion: nextStreamVersion
    }
  })

  const persisted = await repository.findAuthoredById(committed.payload.character.id)
  const nextCharacter = persisted ?? committed.payload.character
  return {
    character: nextCharacter,
    publicId: committed.identity.publicId,
    streamVersion: committed.streamVersion,
    mechanicsProjectionChecksum: committed.mechanicsProjectionChecksum
  }
}

export async function dispatchCommandForUser(
  db: Parameters<typeof createCharacterRepository>[0],
  characterId: string,
  command: ReturnType<typeof characterSheetCommandInputDtoSchema.parse>,
  userId: string,
  options?: {
    onServiceTiming?: (timing: CharacterSheetCommandServiceTiming) => void
  }
): Promise<CharacterSheetCommandResponseDto> {
  const resolvedCharacterId = await resolveCharacterRouteSubjectId(db, characterId)
  if (!resolvedCharacterId) {
    throw createNamedError('NotFoundError', `Character "${characterId}" was not found.`)
  }

  const panelTargets = getAffectedCharacterSheetPanelTargets(command)
  const ruleResponsibility = classifyCharacterSheetCommandRuleResponsibility(command)
  const usesCommittedRuleSources =
    ruleResponsibility === 'COMMITTED_SNAPSHOT' || command.type === 'UPGRADE_RULE_PACK'
  const committedRuleSnapshot = usesCommittedRuleSources
    ? (await getCharacterSheetBundleForUser(db, resolvedCharacterId, userId))?.ruleSnapshot
    : undefined
  if (usesCommittedRuleSources && !committedRuleSnapshot) {
    throw createNamedError('NotFoundError', `Character "${characterId}" was not found.`)
  }
  const result = await executeCharacterSheetCommand({
    db,
    characterId: resolvedCharacterId,
    command,
    userId,
    panelTargets,
    ...(committedRuleSnapshot ? { committedRuleSnapshot } : {}),
    onTiming: options?.onServiceTiming
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
  return presentCampaignCharacterHistory(
    buildCharacterHistoryView(
      filterCharacterHistoryForViewer(events, character.userId, campaignContext.viewer),
      resolvedCharacterId
    ),
    campaignContext.contentMaturity
  )
}
