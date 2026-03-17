import type { DBLike } from '@artificer-toolkit/db'
import {
  createCharacterRepository,
  createCharacterEventRepository,
  ConcurrencyError,
} from '@artificer-toolkit/db'
import type {
  CharacterBuildState,
  CharacterEvent,
  CharacterAssemblyRegistry,
} from '@artificer-toolkit/shared'
import { dnd5e2014RulesSystem } from '@artificer-toolkit/shared'
import type { CommandHandler } from './commands/index.js'

export { ConcurrencyError }

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
async function buildRegistry(_db: DBLike, _state: CharacterBuildState): Promise<CharacterAssemblyRegistry> {
  // Phase 7 stub — registry has empty maps; enough for commands that don't need
  // compiled content (createCharacter, assignAbilityScores, gainClassLevel, etc.)
  // Full registry assembly requires the content assembly pipeline (Phase 7 follow-up).
  return {
    features: {},
    classes: {},
    feats: {},
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
  const currentState = row.build_state

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
    buildState: newState,
    expectedVersion,
  })

  return { newState, events, result }
}
