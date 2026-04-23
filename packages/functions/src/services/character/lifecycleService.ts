import type { DBLike, Json } from '@artificer-toolkit/db'
import {
  createCharacterRepository,
  createCharacterEventRepository,
  createClassRepository,
  createFeatRepository,
  createRaceRepository,
  ConcurrencyError,
} from '@artificer-toolkit/db'
import type {
  CharacterBuildState,
  CharacterEvent,
  CharacterAssemblyRegistry,
} from '@artificer-toolkit/shared'
import {
  compileClass,
  compileFeat,
  compileRace,
  dnd5e2014RulesSystem
} from '@artificer-toolkit/shared'
import type { CommandHandler } from './commands/index.js'
import { CommandValidationError } from './commands/index.js'

export { ConcurrencyError }
export { CommandValidationError }

export class NotFoundError extends Error {
  constructor(characterId: string) {
    super(`Character "${characterId}" not found or not yet initialized.`)
    this.name = 'NotFoundError'
  }
}

export interface LifecycleResult<TResult = void> {
  newState: CharacterBuildState
  events: CharacterEvent[]
  result: TResult
}

/**
 * Builds a minimal CharacterAssemblyRegistry from the DB for command dispatch.
 *
 * Phase 7: stubs class/feat/spell/equipment lookups from their repositories.
 * Full feature assembly (class features → snapshot.features[]) is wired in a follow-up.
 */
async function buildRegistry(db: DBLike, state: CharacterBuildState): Promise<CharacterAssemblyRegistry> {
  const [classRecords, featRecords, raceRecords] = await Promise.all([
    createClassRepository(db).findAll({ systemId: state.systemId }),
    createFeatRepository(db).findAll({ systemId: state.systemId }),
    createRaceRepository(db).findResolvedAll({ systemId: state.systemId })
  ])

  const classes = Object.fromEntries(
    classRecords.map((record) => [record.id, compileClass(record)])
  )

  const feats = Object.fromEntries(
    featRecords.map((record) => [record.id, compileFeat(record)])
  )

  const races = Object.fromEntries(
    raceRecords.map((record) => [record.id, compileRace(record)])
  )

  return {
    features: {},
    classes,
    feats,
    races,
    equipment: {},
    spells: {},
  }
}

/**
 * Dispatches a character build command through the full lifecycle:
 * load state → run handler → concurrency check → persist events → update snapshot.
 *
 * Returns the new build state, emitted events, and the handler's result.
 * Throws NotFoundError if the character doesn't exist.
 * Throws ConcurrencyError if stream_version has advanced since expectedVersion.
 */
export async function dispatchCharacterCommand<TCommand, TResult>(
  characterId: string,
  expectedVersion: number,
  command: TCommand,
  handler: CommandHandler<TCommand, TResult>,
  db: DBLike
): Promise<LifecycleResult<TResult>> {
  const charRepo = createCharacterRepository(db)
  const eventRepo = createCharacterEventRepository(db)

  // 1. Load current state
  const row = await charRepo.findById(characterId)
  if (!row?.build_state) {
    throw new NotFoundError(characterId)
  }
  const currentState = row.build_state as unknown as CharacterBuildState

  // 2. Verify optimistic concurrency before running handler
  if (currentState.streamVersion !== expectedVersion) {
    throw new ConcurrencyError(characterId, expectedVersion)
  }

  // 3. Build registry and run command handler
  const registry = await buildRegistry(db, currentState)
  const { events, newState, result } = await handler(
    command,
    currentState,
    registry,
    dnd5e2014RulesSystem
  )

  // 4. Persist events then update snapshot (events first for audit integrity)
  await eventRepo.appendBatch(events)
  await charRepo.updateBuildState({
    id: characterId,
    buildState: newState as unknown as Json,
    expectedVersion,
  })

  return { newState, events, result }
}
