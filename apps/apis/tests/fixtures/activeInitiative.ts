import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  createStagedInitiativeRoundState,
  hydrateStagedState,
  inMemoryInitiativeRepository,
  serializeStagedInitiativeRoundState
} from '@artificer-toolkit/rules-runtime/encounterInitiativeStaging'
import { settleEncounterInitiativeRound } from '@artificer-toolkit/rules-runtime/encounterInitiativeStateSettlement'
import type { MutationCtx } from '../../convex/_generated/server'
import { readRunActors } from '../../convex/encounters/documents'
import { createEncounterInitiativeStore } from '../../convex/encounters/initiativeStore'

export async function seedActiveInitiative(
  ctx: MutationCtx,
  state: EncounterRunState,
  actorIds: readonly string[]
): Promise<void> {
  if (state.status !== 'ACTIVE' || actorIds[0] !== state.currentActorId)
    throw new Error('Active fixture initiative must begin with the current Encounter actor.')
  const actors = await readRunActors(ctx, state)
  const expectedActorIds = actors.map((actor) => actor.id).sort()
  const orderedActorIds = [...actorIds]
  if (
    orderedActorIds.length !== expectedActorIds.length ||
    new Set(orderedActorIds).size !== orderedActorIds.length ||
    orderedActorIds.some((actorId) => !expectedActorIds.includes(actorId))
  )
    throw new Error('Active fixture initiative must retain the full Encounter actor cohort.')
  const staged = inMemoryInitiativeRepository(
    hydrateStagedState(
      createStagedInitiativeRoundState({
        encounter: {
          ...state,
          actors: actors.map((actor) => ({ id: actor.id, sideId: actor.sideId }))
        },
        round: state.round
      })
    )
  )
  const settled = await settleEncounterInitiativeRound({
    repository: staged.repository,
    state: staged.read(),
    orderedActorIds
  })
  await createEncounterInitiativeStore(ctx).persistStagedInitiativeRound(
    serializeStagedInitiativeRoundState(settled)
  )
  const row = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', state.id))
    .unique()
  if (!row) throw new Error('Active fixture Encounter Run was not found.')
  const projection = encounterGmProjectionDtoSchema.parse(JSON.parse(row.projectionJson))
  const projectionByActorId = new Map(projection.actors.map((actor) => [actor.id, actor]))
  if (projectionByActorId.size !== orderedActorIds.length)
    throw new Error('Active fixture projection actor cohort is inconsistent.')
  const orderedActors = orderedActorIds.map((actorId) => {
    const actor = projectionByActorId.get(actorId)
    if (!actor) throw new Error('Active fixture projection actor cohort is inconsistent.')
    return actor
  })
  const nextProjection = encounterGmProjectionDtoSchema.parse({
    ...projection,
    actors: orderedActors
  })
  await ctx.db.patch(row._id, {
    projectionJson: JSON.stringify(nextProjection),
    projectionChecksum: checksumCanonicalJson(nextProjection)
  })
}
