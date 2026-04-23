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
  createCharacterEventRepository,
  createCharacterRepository
} from '@artificer-toolkit/db'
import {
  AUTHORED_RECORD_STATUS,
  type CharacterAuthored,
  type CharacterBuildState,
  buildCharacterHistoryView,
  dnd5e2014RulesSystem,
  runEngine,
  type AuthoredRecordStatus,
  type CharacterAssemblyRegistry
} from '@artificer-toolkit/shared'
import {
  characterAuthoredDtoSchema,
  characterBuilderResolveRequestDtoSchema,
  characterBuilderSaveRequestDtoSchema,
  characterCommandUnionSchema,
  characterDraftRequestDtoSchema,
  createCharacterCommandSchema,
  type CharacterBuilderPayloadDto,
  type CharacterBuilderPreviewPayloadDto,
  type CharacterBuilderResolutionDto,
  type CharacterListResponseDto,
  type CharacterSheetResponseDto
} from '@artificer-toolkit/schema'

type CharacterBuilderMode = 'create' | 'edit'

type CharacterBuilderPreview = ReturnType<typeof createCharacterBuilderChangePreview>

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
  resolution: CharacterBuilderResolution
): CharacterBuilderPayloadDto {
  return {
    character,
    resolution: stripCharacterBuilderResolution(resolution)
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
  const draftResolution = await resolveCharacterBuilder(
    params.db,
    {
      ...reconciled,
      status: AUTHORED_RECORD_STATUS.DRAFT
    },
    params.mode
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

export const listCharacters = handleRequest(
  async (db, userId: string): Promise<CharacterListResponseDto> => {
    const items = await createCharacterRepository(db).listByUser(userId)
    return {
      items: items.map((row) => ({
        id: row.id,
        label: row.label,
        status: row.status === AUTHORED_RECORD_STATUS.ACTIVE
          ? AUTHORED_RECORD_STATUS.ACTIVE
          : AUTHORED_RECORD_STATUS.DRAFT,
        systemId: row.system_id,
        streamVersion: row.stream_version
      })),
      meta: {}
    }
  },
  (_req: Request, userId: string) => [userId] as [string]
)

export const createCharacterDraft = handleAuthoringRequest(
  characterDraftRequestDtoSchema,
  async (db, body, userId): Promise<CharacterBuilderPayloadDto> => {
    const repository = createCharacterRepository(db)
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

    return toCharacterBuilderPayload(character, await resolveCharacterBuilder(db, character, 'create'))
  }
)

export const createCharacter = handleAuthoringRequest(
  characterAuthoredDtoSchema,
  async (db, character, userId): Promise<CharacterBuilderPayloadDto> => {
    const authored = {
      ...character,
      userId
    }

    const repository = createCharacterRepository(db)
    await repository.upsertAuthored(authored)

    const persisted = await repository.findAuthoredById(authored.id)
    const nextCharacter = persisted ?? authored
    return toCharacterBuilderPayload(nextCharacter, await resolveCharacterBuilder(db, nextCharacter, 'create'))
  }
)

export const getCharacter = handleRequest(
  async (db, characterId: string): Promise<CharacterBuilderPayloadDto | null> => {
    const character = await createCharacterRepository(db).findAuthoredById(characterId)
    if (!character) return null

    return toCharacterBuilderPayload(character, await resolveCharacterBuilder(db, character, 'edit'))
  },
  (req: Request) => [extractId(req)] as [string]
)

export const getCharacterSheet = handleRequest(
  async (db, characterId: string): Promise<CharacterSheetResponseDto | null> => {
    const character = await createCharacterRepository(db).findAuthoredById(characterId)
    if (!character) return null

    return toCharacterSheetPayload(character, await resolveCharacterBuilder(db, character, 'edit'))
  },
  (req: Request) => [extractCharacterIdFromSheetRoute(req)] as [string]
)

export const resolveCharacter = handleAuthoringRequest(
  characterBuilderResolveRequestDtoSchema,
  async (db, body, userId): Promise<CharacterBuilderPayloadDto> => {
    const authored = {
      ...body.character,
      userId
    }

    return toCharacterBuilderPayload(authored, await resolveCharacterBuilder(db, authored, body.mode))
  }
)

export const previewCharacterSave = handleAuthoringRequest(
  characterBuilderSaveRequestDtoSchema,
  async (db, body, userId): Promise<CharacterBuilderPreviewPayloadDto> => {
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
)

export const upsertCharacterBuilder = handleAuthoringRequest(
  characterBuilderSaveRequestDtoSchema,
  async (db, body, userId): Promise<CharacterBuilderPayloadDto> => {
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

    await repository.upsertAuthored(payload.character)

    const persisted = await repository.findAuthoredById(payload.character.id)
    const nextCharacter = persisted ?? payload.character
    return toCharacterBuilderPayload(nextCharacter, await resolveCharacterBuilder(db, nextCharacter, body.mode))
  }
)

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

export const createLegacyCharacter = handleAuthoringRequest(
  createCharacterCommandSchema,
  async (db, command, userId) => {
    const { events, newState } = await handleCreateCharacter(
      command,
      {
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
      },
      stubRegistry(),
      dnd5e2014RulesSystem
    )

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
  }
)

export const getLegacyCharacter = handleRequest(
  async (db, characterId: string) => {
    const row = await createCharacterRepository(db).findById(characterId)
    if (!row?.build_state) return null

    const registry = stubRegistry()
    const buildState = row.build_state as unknown as CharacterBuildState
    const snapshot = buildSnapshot(buildState, registry)
    const output = runEngine(snapshot, registry, dnd5e2014RulesSystem)

    return { buildState, engineOutput: output }
  },
  (req: Request) => [extractId(req)] as [string]
)

export const dispatchCommand = handleCommandRequest(
  characterCommandUnionSchema,
  async (characterId, expectedVersion, command, db) => {
    if (command.type === 'CREATE_CHARACTER') {
      throw new NotFoundError(characterId)
    }

    const handler = commandHandlerMap[command.type]
    return dispatchCharacterCommand(
      characterId,
      expectedVersion,
      command,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handler as any,
      db
    )
  }
)

export const getCharacterHistory = handleRequest(
  async (db, characterId: string) => {
    const events = await createCharacterEventRepository(db).listByCharacter(characterId)
    return buildCharacterHistoryView(events)
  },
  (req: Request) => {
    const url = new URL(req.url)
    const segments = url.pathname.split('/').filter(Boolean)
    const historyIdx = segments.lastIndexOf('history')
    const characterId = historyIdx > 0 ? segments[historyIdx - 1] : extractId(req)
    return [characterId] as [string]
  }
)

export { ConcurrencyError }
