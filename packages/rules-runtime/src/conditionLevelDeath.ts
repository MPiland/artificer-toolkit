import type { CharacterSheetCommandInputDto } from '@artificer-toolkit/schema/api/characters'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'

import { readEncounterActorConditionState } from './encounterCharacterMechanicsBatch.js'
import {
  activeEncounterConditionMechanics,
  encounterConditionLevels,
  pinEncounterConditionDefinitions
} from './encounterConditionMechanics.js'
import { creatureConditionCapabilityRegistry } from './platformPolicyModules.js'

type ReadCurrentDefinition = (definitionId: string) => Promise<ReusableDefinitionCurrentDto | null>

/**
 * Whether raising a condition from `before` to `after` crosses an authored DEATH mechanic. Only the
 * crossing kills, so a Character revived while it holds the level (D96) stays alive. A condition
 * with no rule-state definition has no mechanics.
 */
async function conditionRaiseReachesDeath(input: {
  conditionId: string
  before: number
  after: number
  gameSystemId: string
  readCurrentDefinition: ReadCurrentDefinition
}): Promise<boolean> {
  const { conditionId, before, after } = input
  if (after <= before) return false
  const current = await input.readCurrentDefinition(conditionId)
  if (!current) return false
  const conditionDefinitions = await pinEncounterConditionDefinitions({
    conditionLevels: new Map([[conditionId, after]]),
    gameSystemId: input.gameSystemId,
    definitions: { requireCurrent: async () => current }
  })
  const kills = (level: number) =>
    level > 0 &&
    activeEncounterConditionMechanics({
      conditionDefinitions,
      conditionLevels: new Map([[conditionId, level]])
    }).some(({ mechanic }) => mechanic.kind === 'DEATH')
  return kills(after) && !kills(before)
}

/** Whether a Sheet command reaches an authored DEATH mechanic; hosts pass the answer to the reducer. */
export async function sheetCommandReachesConditionDeath(input: {
  character: {
    systemId: string
    state: { exhaustion?: { level: number } | null }
  }
  command:
    | { type: 'SET_EXHAUSTION'; level: number }
    | { type: Exclude<CharacterSheetCommandInputDto['type'], 'SET_EXHAUSTION'> }
  readCurrentDefinition: ReadCurrentDefinition
}): Promise<boolean> {
  const { character, command, readCurrentDefinition } = input
  if (command.type !== 'SET_EXHAUSTION') return false
  const gameSystemId = character.systemId
  const conditionId =
    creatureConditionCapabilityRegistry.find(gameSystemId)?.exhaustionConditionDefinitionId
  return conditionId
    ? conditionRaiseReachesDeath({
        conditionId,
        before: character.state.exhaustion?.level ?? 0,
        after: command.level,
        gameSystemId,
        readCurrentDefinition
      })
    : false
}

/** Whether a GM condition edit on a Creature raises any condition onto an authored DEATH mechanic. */
export async function creatureConditionEditReachesDeath(input: {
  beforeRows: readonly unknown[]
  afterRows: readonly unknown[]
  gameSystemId: string
  readCurrentDefinition: ReadCurrentDefinition
}): Promise<boolean> {
  const { gameSystemId, readCurrentDefinition } = input
  const levels = (rows: readonly unknown[]) =>
    encounterConditionLevels({
      conditionIds: readEncounterActorConditionState(rows).ids,
      conditionRows: rows,
      exhaustionLevel: 0,
      gameSystemId
    })
  const before = levels(input.beforeRows)
  for (const [conditionId, after] of levels(input.afterRows))
    if (
      await conditionRaiseReachesDeath({
        conditionId,
        before: before.get(conditionId) ?? 0,
        after,
        gameSystemId,
        readCurrentDefinition
      })
    )
      return true
  return false
}
