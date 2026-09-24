import { settleNativeEncounterActionMechanics } from './actionMechanics'
import type { MovementTarget } from './movementTargets'
import {
  prepareNativeActionMaintenance,
  replaceNativeActionMaintenance,
  finishNativeActionMaintenance,
  type NativeMaintenanceProjection
} from './actionMaintenance'
import { persistNativeMovementReactionEffects } from './movementReactionEffects'
import {
  requireCompletedMovementReaction,
  reactionMechanicsInput,
  movementReactionActors,
  movementReactionSettlement,
  planEncounterMovementReactionAction
} from '@artificer-toolkit/rules-runtime/encounterMovementReactionPlan'
import {
  executeEncounterMovementReactionAction,
  resumeEncounterMovementLegendaryResistance
} from '@artificer-toolkit/rules-runtime/encounterMovementReactionExecution'
import type { ServerKernelRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { discoverEncounterLegendaryResistanceCandidate } from '@artificer-toolkit/rules-runtime/encounterLegendaryResistanceDiscovery'
import { readCharacterRecord } from '../characters/documents'
import { readDefinitionRoot } from '../content/definitionStore'
import {
  loadNativeMovementReactionFacts,
  type revalidateNativeMovementReaction
} from './movementReactionDiscovery'
import { prepareEncounterMovementReactionAction } from '@artificer-toolkit/rules-runtime/encounterMovementReactionPreparation'
import { requireIdentity } from '../lib/identity'
import { nextRollInt } from '../lib/rollRandom'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { MutationCtx } from '../_generated/server'
import { prepareNativeEncounterActionMechanics } from './actionMechanicsPreparation'
import { planEncounterMovementReactionEffects } from '@artificer-toolkit/rules-runtime/encounterMovementReactionEffects'
import {
  advanceNativeActionGraphs,
  executeNativeActionGraphs
} from '@artificer-toolkit/rules-runtime/encounterActionExecution'
import type { resolveNativeMovementLegendaryResistance } from '@artificer-toolkit/rules-runtime/encounterMovementLegendaryResistance'

type CompletedNativeReaction = Awaited<ReturnType<typeof executeNativeActionGraphs>> & {
  kind: 'COMPLETE'
  resistance?: Awaited<ReturnType<typeof resolveNativeMovementLegendaryResistance>> | null
}

/** Revalidates one issued movement reaction and binds it to current native mechanics facts. */
export async function prepareNativeMovementReactionAction(
  ctx: MutationCtx,
  input: Parameters<typeof revalidateNativeMovementReaction>[1],
  movementTargets?: ReadonlyMap<string, MovementTarget>,
  maintenanceProjection?: NativeMaintenanceProjection
) {
  const facts = await loadNativeMovementReactionFacts(ctx, input, movementTargets)
  return prepareEncounterMovementReactionAction({
    facts,
    revalidate: input,
    maintenanceProjection,
    prepareMechanics: (mechanicsInput) =>
      prepareNativeEncounterActionMechanics(ctx, mechanicsInput),
    prepareMaintenance: (prepared, userId, projection) =>
      prepareNativeActionMaintenance(ctx, prepared, userId, projection)
  })
}

/** Runs or resumes sealed action phases; the enclosing movement owns publication. */
export async function executeNativeMovementReactionAction(
  ctx: MutationCtx,
  input: {
    runtime: Parameters<typeof executeNativeActionGraphs>[0]['runtime']
    occurrenceId: string
    automationMode: 'AUTOMATIC' | 'ASSISTED'
    prepared: Awaited<ReturnType<typeof prepareNativeMovementReactionAction>>
    random?: Parameters<typeof executeNativeActionGraphs>[0]['random']
    resume?: Parameters<typeof advanceNativeActionGraphs>[0]['resume']
  }
) {
  return executeEncounterMovementReactionAction({
    ...input,
    random: input.random ?? nextRollInt,
    discoverResistance: () => discoverNativeMovementResistance(ctx, input.prepared)
  })
}

export async function resumeNativeMovementLegendaryResistance(
  ctx: MutationCtx,
  input: {
    runtime: Parameters<typeof executeNativeActionGraphs>[0]['runtime']
    occurrenceId: string
    automationMode: 'AUTOMATIC' | 'ASSISTED'
    prepared: Awaited<ReturnType<typeof prepareNativeMovementReactionAction>>
    snapshot: ServerKernelRuleExecutionPendingSnapshotDto
    selection: Parameters<typeof resolveNativeMovementLegendaryResistance>[0]['selection']
    retainedExecution?: Awaited<ReturnType<typeof executeNativeMovementReactionAction>>
  }
) {
  return resumeEncounterMovementLegendaryResistance({
    ...input,
    random: nextRollInt,
    discoverResistance: () => discoverNativeMovementResistance(ctx, input.prepared)
  })
}

export async function discoverNativeMovementResistance(
  ctx: MutationCtx,
  prepared: Awaited<ReturnType<typeof prepareNativeMovementReactionAction>>
) {
  if (prepared.prepared.target.kind !== 'CREATURE') return null
  const { userId } = await requireIdentity(ctx)
  return discoverEncounterLegendaryResistanceCandidate({
    encounter: prepared.prepared.state,
    targetActor: prepared.prepared.target,
    actorRules: prepared.prepared.actorRules,
    definitions: {
      requireCurrent: async (definitionId) => {
        const root = await readDefinitionRoot(ctx, definitionId, userId)
        if (!root?.current) throw new Error('Legendary Resistance definition is unavailable.')
        return root.current
      }
    }
  })
}

export type NativeMovementReactionSettlementInput = {
  prepared: Awaited<ReturnType<typeof prepareNativeMovementReactionAction>>
  occurrenceId: string
  commandId: string
  ordinal: number
  occurredAt: string
  execution:
    | CompletedNativeReaction
    | Extract<Awaited<ReturnType<typeof advanceNativeActionGraphs>>, { kind: 'PENDING' }>
}

/** Predicts one completed reaction using the same resource, allowance and receipt calculation. */
export function planNativeMovementReactionAction(
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
