import type { MovementTarget } from './movementTargets'
import type { Doc } from '../_generated/dataModel'
import { settleNativeEncounterActionMechanics } from './actionMechanics'
import { replaceNativeActionMaintenance, finishNativeActionMaintenance } from './actionMaintenance'
import { persistNativeMovementReactionEffects } from './movementReactionEffects'
import {
  requireCompletedMovementReaction,
  reactionMechanicsInput,
  movementReactionActors,
  movementReactionSettlement,
  planEncounterMovementReactionAction,
  type MovementReactionSettlementInput
} from '@artificer-toolkit/rules-runtime/encounterMovementReactionPlan'
import { readCharacterRecord } from '../characters/documents'
import { requireIdentity } from '../lib/identity'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { MutationCtx } from '../_generated/server'
import { planEncounterMovementReactionEffects } from '@artificer-toolkit/rules-runtime/encounterMovementReactionEffects'

/** A reaction the room planned against Convex's own Character facts and rows. */
export type NativeMovementReactionSettlementInput = MovementReactionSettlementInput<
  NonNullable<MovementTarget['characterFacts']>,
  Doc<'characters'>
>

/** Predicts one completed reaction using the same resource, allowance and receipt calculation. */
function planNativeMovementReactionAction(
  input: NativeMovementReactionSettlementInput,
  userId: string
) {
  return planEncounterMovementReactionAction(input, userId, readCharacterRecord)
}

/** Applies one completed reaction inside the enclosing Scene publication transaction. */
export async function settleNativeMovementReactionAction(
  ctx: MutationCtx,
  input: NativeMovementReactionSettlementInput
) {
  const execution = requireCompletedMovementReaction(input)
  const effects = planEncounterMovementReactionEffects({ ...input, execution })
  const { userId } = await requireIdentity(ctx)
  const forecast = planNativeMovementReactionAction(input, userId)
  const settled = await settleNativeEncounterActionMechanics(
    ctx,
    reactionMechanicsInput(input, effects)
  )
  if (effects.maintainedState && input.prepared.maintenance) {
    const state = await replaceNativeActionMaintenance(ctx, {
      prepared: input.prepared.prepared,
      maintenance: input.prepared.maintenance,
      policy: input.prepared.maintenance.policy,
      actionId: input.prepared.option.actionId,
      occurrenceId: input.occurrenceId,
      id: effects.maintainedState.id,
      occurredAt: input.occurredAt
    })
    if (checksumCanonicalJson(state) !== checksumCanonicalJson(effects.maintainedState))
      throw new Error('Movement maintained-state forecast changed before settlement.')
  }
  await persistNativeMovementReactionEffects(ctx, effects.createdEffects)
  const { sourceActor, targetActor } = movementReactionActors(input, settled)
  if (
    checksumCanonicalJson(targetActor) !== checksumCanonicalJson(settled.mechanics.updatedActor)
  ) {
    const targetRow = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (query) =>
        query.eq('encounterId', targetActor.encounterId).eq('id', targetActor.id)
      )
      .unique()
    if (
      !targetRow ||
      targetRow.stateChecksum !== checksumCanonicalJson(settled.mechanics.updatedActor)
    )
      throw new Error('The Legendary Resistance target changed before settlement.')
    await ctx.db.patch(targetRow._id, {
      stateJson: JSON.stringify(targetActor),
      stateChecksum: checksumCanonicalJson(targetActor)
    })
  }
  const sourceRow = await ctx.db
    .query('encounterRunActors')
    .withIndex('by_encounterId_id', (query) =>
      query.eq('encounterId', sourceActor.encounterId).eq('id', sourceActor.id)
    )
    .unique()
  if (!sourceRow || sourceRow.stateChecksum !== checksumCanonicalJson(settled.settledSource))
    throw new Error('The movement reaction allowance changed before settlement.')
  await ctx.db.patch(sourceRow._id, {
    stateJson: JSON.stringify(sourceActor),
    stateChecksum: checksumCanonicalJson(sourceActor)
  })
  if (effects.maintainedState && input.prepared.maintenance && forecast.maintenance) {
    const actors = input.prepared.prepared.actors.map((actor) =>
      actor.id === sourceActor.id ? sourceActor : actor.id === targetActor.id ? targetActor : actor
    )
    const maintained = await finishNativeActionMaintenance(ctx, {
      prepared: input.prepared.prepared,
      maintenance: input.prepared.maintenance,
      createdState: effects.maintainedState,
      createdDependentEffectIds: effects.createdEffects
        .filter((effect) => effect.maintainedEffectStateId === effects.maintainedState!.id)
        .map((effect) => effect.id),
      actors,
      occurredAt: input.occurredAt
    })
    if (
      checksumCanonicalJson(maintained.transition) !==
        checksumCanonicalJson(forecast.maintenance.transition) ||
      maintained.actors.some(
        (actor) =>
          checksumCanonicalJson(actor) !==
          checksumCanonicalJson(forecast.projectedTargets.get(actor.id)?.actor)
      )
    )
      throw new Error('Movement maintenance forecast changed before settlement.')
    for (const snapshot of input.prepared.maintenance.owners) {
      if (snapshot.owner.kind !== 'CHARACTER') continue
      const expected = forecast.maintenance.projection.owners.get(
        checksumCanonicalJson(snapshot.owner)
      )?.character
      if (
        !expected ||
        checksumCanonicalJson(await ctx.db.get(expected._id)) !== checksumCanonicalJson(expected)
      )
        throw new Error('Movement maintenance Character forecast changed before settlement.')
    }
  }
  const actual = movementReactionSettlement(input, settled, effects, forecast.maintenance)
  if (
    checksumCanonicalJson(actual.application) !== checksumCanonicalJson(forecast.application) ||
    checksumCanonicalJson(actual.reactionExecution) !==
      checksumCanonicalJson(forecast.reactionExecution)
  )
    throw new Error('Movement reaction receipt forecast changed before settlement.')
  return {
    application: actual.application,
    reactionExecution: actual.reactionExecution
  }
}
