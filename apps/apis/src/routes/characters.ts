import {
  NotFoundError,
  buildSnapshot,
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
  resolveCharacterBuilder
} from '@artificer-toolkit/functions'
import {
  type Json,
  ConcurrencyError,
  createCharacterEventRepository,
  createCharacterRepository
} from '@artificer-toolkit/db'
import {
  type CharacterBuildState,
  buildCharacterHistoryView,
  dnd5e2014RulesSystem,
  runEngine,
  type CharacterAssemblyRegistry
} from '@artificer-toolkit/shared'
import {
  characterAuthoredDtoSchema,
  characterCommandUnionSchema,
  createCharacterCommandSchema
} from '@artificer-toolkit/schema'

function extractId(req: Request): string {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  return segments[segments.length - 1]
}

function stubRegistry(): CharacterAssemblyRegistry {
  return { features: {}, classes: {}, feats: {}, races: {}, equipment: {}, spells: {} }
}

export const listCharacters = handleRequest(
  async (db, userId: string) => {
    const items = await createCharacterRepository(db).listByUser(userId)
    return {
      items: items.map((row) => ({
        id: row.id,
        label: row.label,
        systemId: row.system_id,
        streamVersion: row.stream_version
      })),
      meta: {}
    }
  },
  (_req: Request, userId: string) => [userId] as [string]
)

export const createCharacter = handleAuthoringRequest(
  characterAuthoredDtoSchema,
  async (db, character, userId) => {
    const authored = {
      ...character,
      userId
    }

    const repository = createCharacterRepository(db)
    await repository.upsertAuthored(authored)

    const persisted = await repository.findAuthoredById(authored.id)
    const resolved = await resolveCharacterBuilder(db, persisted ?? authored, 'create')

    return {
      character: persisted ?? authored,
      resolution: resolved
    }
  }
)

export const getCharacter = handleRequest(
  async (db, characterId: string) => {
    const character = await createCharacterRepository(db).findAuthoredById(characterId)
    if (!character) return null

    return {
      character,
      resolution: await resolveCharacterBuilder(db, character, 'edit')
    }
  },
  (req: Request) => [extractId(req)] as [string]
)

export const resolveCharacter = handleAuthoringRequest(
  characterAuthoredDtoSchema,
  async (db, character, userId) => {
    const authored = {
      ...character,
      userId
    }

    return {
      character: authored,
      resolution: await resolveCharacterBuilder(db, authored, 'create')
    }
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return dispatchCharacterCommand(characterId, expectedVersion, command, handler as any, db)
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
