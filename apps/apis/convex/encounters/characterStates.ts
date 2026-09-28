import type { EncounterProjectionCharacterStates } from '@artificer-toolkit/schema/projections/encounterProjectionInput'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { clampCharacterCurrentHitPoints } from '@artificer-toolkit/shared/character'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { QueryCtx } from '../_generated/server'
import { readCharacterMaximumHitPoints } from '../characters/characterMaximumHitPoints'
import { readCharacterRecord } from '../characters/stateDocuments'
import { requireSystem } from '../content/systemDocuments'
import { readRunProjection } from '@artificer-toolkit/encounter-persistence/documents'

/**
 * Projects a Character's hit points over its effective maximum, as the Sheet shows them, and its
 * Sheet conditions with their System labels.
 */
export function characterProjectionState(
  character: Pick<CharacterAuthored, 'state'>,
  maximumHitPoints: number,
  conditionTypes: SystemAuthoredDto['conditionTypes']
) {
  const { hitpoints, conditions = [] } = character.state
  return {
    current: clampCharacterCurrentHitPoints(hitpoints.current, maximumHitPoints),
    temporary: Math.max(hitpoints.temp ?? 0, 0),
    maximum: maximumHitPoints,
    conditions: conditions.map((condition) => {
      const definition = conditionTypes.find((entry) => entry.id === condition.conditionTypeId)
      return {
        conditionTypeId: condition.conditionTypeId,
        label: definition?.label ?? 'Unknown condition',
        ...(definition?.description ? { description: definition.description } : {}),
        ...(condition.notes ? { notes: condition.notes } : {})
      }
    })
  }
}

/**
 * Reads each Character actor's current hit points and conditions for a Run projection (ADR 0034
 * decision 4). A detached Character grants no current Sheet access, so it keeps its last projected
 * values.
 */
export async function readEncounterCharacterStates(
  ctx: QueryCtx,
  state: Pick<EncounterRunState, 'id' | 'campaignId' | 'gameSystemId'>,
  actors: readonly EncounterRunActorState[]
): Promise<EncounterProjectionCharacterStates> {
  const states = new Map<
    string,
    { current: number; temporary: number; maximum: number; conditions: unknown }
  >()
  let conditionTypes: SystemAuthoredDto['conditionTypes'] | null = null
  let stored: ReturnType<typeof readRunProjection> | null = null
  for (const actor of actors) {
    if (actor.kind !== 'CHARACTER') continue
    const characterId = actor.sourceId
    const assignment = await ctx.db
      .query('campaignCharacterAssignments')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .unique()
    if (assignment?.campaignId === state.campaignId) {
      const record = await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', characterId))
        .unique()
      if (!record || record.userId !== assignment.userId || record.systemId !== state.gameSystemId)
        throw new Error('Stored Encounter Character source is unavailable.')
      conditionTypes ??= (await requireSystem(ctx, state.gameSystemId)).conditionTypes
      states.set(
        characterId,
        characterProjectionState(
          readCharacterRecord(record),
          await readCharacterMaximumHitPoints(ctx, record),
          conditionTypes
        )
      )
      continue
    }
    if (!stored) {
      const run = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', state.id))
        .unique()
      if (!run) throw new Error('Encounter is unavailable.')
      stored = readRunProjection(run)
    }
    const projected = stored.actors.find((candidate) => candidate.id === actor.id)
    if (!projected) throw new Error('Encounter Character state is unavailable.')
    states.set(characterId, {
      current: projected.currentHitPoints,
      temporary: projected.tempHitPoints,
      maximum: projected.maxHitPoints,
      conditions: projected.conditions
    })
  }
  return states
}
