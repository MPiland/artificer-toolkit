import type { EncounterProjectionCharacterStates } from '@artificer-toolkit/schema/projections/encounterProjectionInput'
import {
  encounterRunActorStateSchema,
  type EncounterRunCharacterActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { clampCharacterCurrentHitPoints } from '@artificer-toolkit/shared/character'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { readCharacterMaximumHitPoints } from './characterMaximumHitPoints.js'
import { readRunActors, replaceRunActor } from './documents.js'
import type { EncounterReadTransaction, EncounterWriteTransaction } from './ports.js'

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
 * decision 4). A completed Run, and an open Run whose Character left the Campaign, show the values
 * frozen when the Run stopped reading it: a detached Character grants no current Sheet access.
 */
export async function readEncounterCharacterStates(
  ctx: EncounterReadTransaction,
  state: Pick<EncounterRunState, 'campaignId' | 'gameSystemId' | 'status'>,
  actors: readonly (
    | Pick<EncounterRunCharacterActorState, 'kind' | 'sourceId' | 'frozenState'>
    | { kind: 'CREATURE' | 'CUSTOM' }
  )[]
): Promise<EncounterProjectionCharacterStates> {
  const states = new Map<
    string,
    { current: number; temporary: number; maximum: number; conditions: unknown }
  >()
  let conditionTypes: SystemAuthoredDto['conditionTypes'] | null = null
  for (const actor of actors) {
    if (actor.kind !== 'CHARACTER') continue
    const characterId = actor.sourceId
    const assignment =
      state.status === 'COMPLETED'
        ? null
        : await ctx.db
            .query('campaignCharacterAssignments')
            .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
            .unique()
    if (assignment?.campaignId !== state.campaignId) {
      if (!actor.frozenState) throw new Error('Encounter Character state is unavailable.')
      states.set(characterId, {
        current: actor.frozenState.currentHitPoints,
        temporary: actor.frozenState.tempHitPoints,
        maximum: actor.frozenState.maxHitPoints,
        conditions: actor.frozenState.conditions
      })
      continue
    }
    const record = await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', characterId))
      .unique()
    if (!record || record.userId !== assignment.userId || record.systemId !== state.gameSystemId)
      throw new Error('Stored Encounter Character source is unavailable.')
    conditionTypes ??= (await ctx.ports.requireSystem(state.gameSystemId)).conditionTypes
    states.set(
      characterId,
      characterProjectionState(
        ctx.ports.readCharacterRecord(record),
        await readCharacterMaximumHitPoints(ctx, record),
        conditionTypes
      )
    )
  }
  return states
}

/**
 * Freezes Character actors' current projected values into the actors, for an open Run that stops
 * reading those Characters: every Character when the Run completes, or `characterId` alone when it
 * leaves the Campaign. The Run version is unchanged: the projection shows the same values before
 * and after.
 */
export async function freezeEncounterCharacterStates(
  ctx: EncounterWriteTransaction,
  state: EncounterRunState,
  characterId?: string
): Promise<void> {
  const targets = (await readRunActors(ctx, state)).flatMap((actor) =>
    actor.kind === 'CHARACTER' && (characterId === undefined || actor.sourceId === characterId)
      ? [actor]
      : []
  )
  const current = await readEncounterCharacterStates(ctx, state, targets)
  for (const actor of targets) {
    const values = current.get(actor.sourceId)!
    const frozen = encounterRunActorStateSchema.parse({
      ...actor,
      frozenState: {
        currentHitPoints: values.current,
        maxHitPoints: values.maximum,
        tempHitPoints: values.temporary,
        conditions: values.conditions
      }
    })
    if (checksumCanonicalJson(frozen) !== checksumCanonicalJson(actor))
      await replaceRunActor(ctx, actor, frozen)
  }
}
