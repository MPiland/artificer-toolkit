import {
  handleRequest,
  handleAuthoringRequest,
  handleCommandRequest,
  dispatchCharacterCommand,
  handleCreateCharacter,
  handleAssignAbilityScores,
  handleGainClassLevel,
  handleApplyHitPoints,
  handleMakeFeatureSelection,
  handleChooseFeat,
  handleUpdateSpellSelection,
  handleAcquireEquipment,
  handleEquipItem,
  handleUnequipItem,
  buildSnapshot,
  NotFoundError,
} from '@artificer-toolkit/functions'
import {
  createCharacterRepository,
  createCharacterEventRepository,
} from '@artificer-toolkit/db'
import {
  runEngine,
  dnd5e2014RulesSystem,
  buildCharacterHistoryView,
  type CharacterAssemblyRegistry,
} from '@artificer-toolkit/shared'
import {
  createCharacterCommandSchema,
  characterCommandUnionSchema,
} from '@artificer-toolkit/schema'

function extractId(req: Request): string {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  return segments[segments.length - 1]
}

/** Minimal stub registry — enough for commands that don't need compiled content. */
function stubRegistry(): CharacterAssemblyRegistry {
  return { features: {}, classes: {}, feats: {}, equipment: {}, spells: {} }
}

/* ──────────────────────────────────────────────
 * GET /characters — list user's characters
 * ────────────────────────────────────────────── */

export const listCharacters = handleRequest(
  async (db, userId: string) => createCharacterRepository(db).listByUser(userId),
  (_req: Request, userId: string) => [userId] as [string]
)

/* ──────────────────────────────────────────────
 * POST /characters — create a new character
 * ────────────────────────────────────────────── */

export const createCharacter = handleAuthoringRequest(
  createCharacterCommandSchema,
  async (db, command, _userId) => {
    const { events, newState } = await handleCreateCharacter(
      command,
      // createCharacter ignores currentState — pass an empty shell
      { characterId: command.characterId, systemId: command.systemId, streamVersion: 0, name: '', classes: [], abilityScores: {}, abilityGenerationMethod: 'STANDARD_ARRAY', hitpointsByLevel: [], featureSelections: [], featRefs: [], spellRefs: [], ownedEquipment: [] },
      stubRegistry(),
      dnd5e2014RulesSystem
    )

    const charRepo = createCharacterRepository(db)
    const eventRepo = createCharacterEventRepository(db)

    await charRepo.create({
      id: command.characterId,
      systemId: command.systemId,
      userId: _userId,
      label: command.name,
      buildState: newState,
    })

    await eventRepo.appendBatch(events)

    return { characterId: command.characterId, streamVersion: newState.streamVersion }
  }
)

/* ──────────────────────────────────────────────
 * GET /characters/:id — get resolved character sheet
 * ────────────────────────────────────────────── */

export const getCharacter = handleRequest(
  async (db, characterId: string) => {
    const row = await createCharacterRepository(db).findById(characterId)
    if (!row?.build_state) return null

    const registry = stubRegistry()
    const snapshot = buildSnapshot(row.build_state, registry)
    const output = runEngine(snapshot, registry, dnd5e2014RulesSystem)

    return { buildState: row.build_state, engineOutput: output }
  },
  (req: Request) => [extractId(req)] as [string]
)

/* ──────────────────────────────────────────────
 * POST /characters/:id/commands — dispatch a build command
 * ────────────────────────────────────────────── */

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
  UNEQUIP_ITEM: handleUnequipItem,
} as const

export const dispatchCommand = handleCommandRequest(
  characterCommandUnionSchema,
  async (characterId, expectedVersion, command, db) => {
    // CREATE_CHARACTER is handled separately (no existing character to load)
    if (command.type === 'CREATE_CHARACTER') {
      throw new NotFoundError(characterId)
    }

    const handler = commandHandlerMap[command.type]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return dispatchCharacterCommand(characterId, expectedVersion, command, handler as any, db)
  }
)

/* ──────────────────────────────────────────────
 * GET /characters/:id/history — event log as history view
 * ────────────────────────────────────────────── */

export const getCharacterHistory = handleRequest(
  async (db, characterId: string) => {
    const events = await createCharacterEventRepository(db).listByCharacter(characterId)
    return buildCharacterHistoryView(events)
  },
  (req: Request) => [extractId(req)] as [string]
)
