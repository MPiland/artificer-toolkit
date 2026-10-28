import type { ServerAggregateChoicePendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { EncounterEvidenceAnswer } from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import { type EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterActionCurrentnessChecksum } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { encounterAreaLegendaryResistanceAudits } from '@artificer-toolkit/rules-runtime/encounterAreaLegendaryResistance'
import { discoverEncounterLegendaryResistanceCandidate } from '@artificer-toolkit/rules-runtime/encounterLegendaryResistanceDiscovery'
import { answerEncounterAreaTest } from '@artificer-toolkit/rules-runtime/encounterAreaActionExecution'
import { collisionStruckCapability } from '@artificer-toolkit/rules-runtime/encounterForcedMovementCollision'
import { evaluateNativeLiveActionEconomy } from './nativeEncounterActionEconomy.js'
import { refuseActionOutsideItsWindow } from './nativeEncounterActionInputs.js'
import { prepareNativeLiveActionMaintenance } from './nativeEncounterMaintenance.js'
import {
  type AreaPlanInput,
  type AreaPrepared,
  type AreaReach,
  type ReachPlanInput,
  prepareAreaTarget,
  prepareCasterActionOnTarget,
  prepareReach
} from './nativeAreaPreparation.js'
import { restoreEncounterActionPending } from '@artificer-toolkit/rules-runtime/encounterActionPendingSnapshot'

export type AreaContext = Extract<
  ServerAggregateChoicePendingSnapshotDto['applicationContext'],
  { kind: 'ENCOUNTER_AREA_ACTION' }
>
export type AreaTargetRecord = AreaContext['targets'][number]

/** The creature's Legendary Resistance on its current pool, looked up only once its save has failed. */
export function discoverNativeLegendaryResistance(
  input: Pick<AreaPlanInput, 'state' | 'capture'>,
  prepared: Pick<Awaited<ReturnType<typeof prepareAreaTarget>>['prepared'], 'target' | 'actorRules'>
) {
  return async () =>
    prepared.target.kind === 'CREATURE'
      ? discoverEncounterLegendaryResistanceCandidate({
          encounter: input.state,
          targetActor: prepared.target,
          actorRules: prepared.actorRules,
          definitions: {
            requireCurrent: async (definitionId) => {
              const response = await input.capture({
                kind: 'DEFINITION',
                definitionId
              })
              if (response.kind !== 'DEFINITION' || !response.definition)
                throw new Error('Legendary Resistance definition is unavailable.')
              return response.definition
            }
          }
        })
      : null
}

/**
 * Prepares a sealed creature again against the Scene and its facts as they are now, and refuses it if
 * the area, the creature's source or target, or the action's economy changed since the area opened.
 */
export async function revalidateAreaTarget(
  input: ReachPlanInput,
  context: AreaContext,
  sealed: AreaTargetRecord,
  reach?: AreaReach
) {
  const { command, state, actors, capture } = input
  const base = reach ?? (await prepareReach(input))
  requireAreaUnchanged(base, context)
  const actor = actors.find((candidate) => candidate.id === sealed.actorId)
  const token = base.scene?.tokens.find((candidate) => candidate.actorId === sealed.actorId) ?? null
  if (!actor || sealed.snapshot.applicationContext.kind !== 'ENCOUNTER_ACTION')
    throw new Error('Encounter rules input binding mismatch.')
  // A creature that had a token on the Scene must still have one (and one that had none, none).
  if ((token === null) !== (sealed.token === null)) throw new Error('The pending area changed.')
  if (!base.movementTargets.has(actor.id))
    base.movementTargets.set(actor.id, await input.loadTarget(actor))
  const target = await prepareAreaTarget({
    ...input,
    base,
    actor,
    token
  })
  refuseActionOutsideItsWindow(target.prepared, command)
  const evaluation = await evaluateNativeLiveActionEconomy({
    prepared: target.prepared,
    state,
    actionId: command.actionId,
    sourceTarget: base.casterFacts,
    // The creatures the area first caught, as its sealed saves were prepared with.
    targetIds: [
      ...context.targets.flatMap(({ actorId, collision }) => (collision ? [] : [actorId])),
      ...context.removedActorIds
    ],
    capture
  })
  const { economy, attackAction } = evaluation
  const maintenance = await prepareNativeLiveActionMaintenance({
    prepared: target.prepared,
    activeEffectsByActorId: input.activeEffectsByActorId,
    capture,
    loadCarriedHolder: async (carrier) =>
      base.movementTargets.get(carrier.id) ?? input.loadTarget(carrier)
  })
  if (
    sealed.snapshot.applicationContext.currentnessChecksum !==
    encounterActionCurrentnessChecksum({
      prepared: target.prepared,
      actionEconomy: economy?.consumption ?? null,
      attackAction,
      maintenance,
      sceneContext: target.sceneContext
    })
  )
    throw new Error('The pending action source or target changed.')
  return { actor, target, evaluation }
}

function requireAreaUnchanged(base: AreaReach, context: AreaContext) {
  if (
    base.scene?.sceneVersion !== context.scene?.sceneVersion ||
    checksumCanonicalJson(base.area?.shape ?? null) !==
      checksumCanonicalJson(context.area?.shape ?? null)
  )
    throw new Error('The pending area changed.')
}

/**
 * The action a creature a mover struck runs (D159): the authored save, and on a failure the mover's
 * collision damage and condition, as the pusher's own action against the creature on the Scene as it
 * is now.
 */
export async function prepareStruckTarget(
  input: ReachPlanInput,
  base: AreaReach,
  struck: {
    actor: EncounterRunActorState
    occurrenceId: string
    collision: NonNullable<AreaTargetRecord['collision']>
  }
) {
  if (!base.movementTargets.has(struck.actor.id))
    base.movementTargets.set(struck.actor.id, await input.loadTarget(struck.actor))
  const prepared = await prepareCasterActionOnTarget(input, {
    caster: base.caster,
    target: struck.actor,
    movementTargets: base.movementTargets,
    sceneContext: null,
    capability: collisionStruckCapability({
      actorId: base.caster.id,
      gameSystemId: input.state.gameSystemId,
      sourceId: struck.occurrenceId,
      struck: struck.collision
    })
  })
  return {
    prepared,
    currentnessChecksum: encounterActionCurrentnessChecksum({
      prepared,
      actionEconomy: null,
      attackAction: null,
      maintenance: null,
      sceneContext: null
    })
  }
}

/**
 * Prepares a sealed struck creature's save again against the Scene and its facts as they are now, and
 * refuses it if the area, the creature or the collision it was sealed against changed.
 */
export async function revalidateStruckTarget(
  input: ReachPlanInput,
  context: AreaContext,
  sealed: AreaTargetRecord,
  collision: NonNullable<AreaTargetRecord['collision']>,
  reach?: AreaReach
) {
  const base = reach ?? (await prepareReach(input))
  requireAreaUnchanged(base, context)
  const actor = input.actors.find((candidate) => candidate.id === sealed.actorId)
  if (!actor || sealed.snapshot.applicationContext.kind !== 'ENCOUNTER_ACTION')
    throw new Error('Encounter rules input binding mismatch.')
  const { prepared, currentnessChecksum } = await prepareStruckTarget(input, base, {
    actor,
    occurrenceId: sealed.snapshot.occurrenceId,
    collision
  })
  if (sealed.snapshot.applicationContext.currentnessChecksum !== currentnessChecksum)
    throw new Error('The pending action source or target changed.')
  return { actor, target: { prepared } }
}

/** Runs one entry's sealed roll with its answer: a creature's own save, or the caster's roll for a ray. */
export async function replayAreaTargetSave(
  input: ReachPlanInput,
  { actor, target }: { actor: EncounterRunActorState; target: { prepared: AreaPrepared } },
  sealed: AreaTargetRecord,
  areaOccurrenceId: string,
  resolution: EncounterEvidenceAnswer
) {
  const [tested] = await answerEncounterAreaTest({
    runtime: input.runtime,
    random: input.random,
    adapter: target.prepared.adapter,
    plan: target.prepared.plan,
    occurrenceId: areaOccurrenceId,
    target: {
      actorId: actor.id,
      occurrenceId: sealed.snapshot.occurrenceId,
      binding: target.prepared.binding,
      attackSight: target.prepared.attackSight,
      autoRoll: { SOURCE: false, TARGET: false },
      discoverLegendaryResistance: discoverNativeLegendaryResistance(input, target.prepared)
    },
    tests: [
      {
        actorId: actor.id,
        occurrenceId: sealed.snapshot.occurrenceId,
        kind: 'PENDING',
        pending: {
          ...restoreEncounterActionPending(sealed.snapshot),
          roller: 'TARGET'
        }
      }
    ],
    resolution
  })
  if (tested?.kind !== 'TESTED') throw new Error('An area save must settle with its answer.')
  return tested
}

/** The creatures a push's movers struck (D159): their sealed saves, replayed, and their Legendary Resistance audits. */
export type StruckSaves = {
  entries: readonly {
    sealed: AreaTargetRecord
    actor: EncounterRunActorState
    target: { prepared: AreaPrepared }
  }[]
  tests: readonly Awaited<ReturnType<typeof replayAreaTargetSave>>[]
  audits: ReturnType<typeof encounterAreaLegendaryResistanceAudits>
}
