import {
  encounterRunActorStateSchema,
  encounterRunStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  createStagedInitiativeRoundState,
  hydrateStagedState,
  inMemoryInitiativeRepository,
  serializeStagedInitiativeRoundState
} from '@artificer-toolkit/rules-runtime/encounterInitiativeStaging'
import { settleEncounterInitiativeRound } from '@artificer-toolkit/rules-runtime/encounterInitiativeStateSettlement'
import type { MutationCtx } from '../../convex/_generated/server'
import {
  readRunActors,
  readRunState,
  replaceRunActor
} from '@artificer-toolkit/encounter-persistence/documents'
import { createEncounterInitiativeStore } from '@artificer-toolkit/encounter-persistence/initiativeStore'

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
}

async function readFixtureRun(ctx: MutationCtx, runId: string) {
  const row = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', runId))
    .unique()
  if (!row) throw new Error('Fixture Encounter Run is unavailable.')
  return { row, state: readRunState(row) }
}

/**
 * Puts a fixture Run in the ACTIVE state START leaves: `fields` on the Run state, and a settled
 * initiative round in which `order` takes turns. `order` defaults to the Run's actors with the
 * current actor first; the current actor defaults to the first in `order`.
 */
export async function activateFixtureRun(
  ctx: MutationCtx,
  runId: string,
  fields: Partial<Pick<EncounterRunState, 'automationMode' | 'round' | 'currentActorId'>> = {},
  order?: readonly string[]
): Promise<EncounterRunState> {
  const { row, state } = await readFixtureRun(ctx, runId)
  const currentActorId = fields.currentActorId ?? order?.[0] ?? state.actorIds[0] ?? null
  const active = encounterRunStateSchema.parse({
    ...state,
    ...fields,
    status: 'ACTIVE',
    round: fields.round ?? Math.max(state.round, 1),
    currentActorId
  })
  await ctx.db.patch(row._id, {
    status: 'ACTIVE',
    stateJson: JSON.stringify(active),
    stateChecksum: checksumCanonicalJson(active)
  })
  await seedActiveInitiative(
    ctx,
    active,
    order ?? [currentActorId!, ...active.actorIds.filter((id) => id !== currentActorId)]
  )
  return active
}

/** Rewrites fixture Run actors in place, as GM tools would, without advancing the Run. */
export async function updateFixtureRunActors(
  ctx: MutationCtx,
  runId: string,
  update: (actor: EncounterRunActorState) => EncounterRunActorState
): Promise<EncounterRunActorState[]> {
  const { state } = await readFixtureRun(ctx, runId)
  const actors = await readRunActors(ctx, state)
  const updated = actors.map((actor) => encounterRunActorStateSchema.parse(update(actor)))
  for (const [index, actor] of actors.entries())
    if (checksumCanonicalJson(updated[index]) !== checksumCanonicalJson(actor))
      await replaceRunActor(ctx, actor, updated[index]!)
  return updated
}
