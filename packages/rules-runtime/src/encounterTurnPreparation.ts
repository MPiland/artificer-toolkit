import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ServerRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import { buildMovementTarget, type MovementTarget } from './encounterMovementTargets.js'
import type { prepareEncounterTurnEffects } from './encounterTurnEffects.js'
import type { prepareEncounterTurnInitiative } from './encounterTurnInitiative.js'
import type { prepareTurnLegendaryActions } from './encounterTurnLegendaryAction.js'
import type { prepareEncounterTurnRecharge } from './encounterTurnRecharge.js'

import type { ProjectableCharacterFacts } from './encounterActionProjection.js'

/** Stages the complete turn in rules order. Every pause leaves aggregate state untouched. */
export async function prepareEncounterTurn<TCharacterFacts extends ProjectableCharacterFacts>(
  input: {
    state: EncounterRunState
    campaign: { id: string; ownerUserId: string }
    root: TurnCoordinatorRootDto
    occurrenceId: string
    actors: EncounterRunActorState[]
    pending?: ServerRuleExecutionPendingSnapshotDto
    resolution?: ResolveRuleOccurrenceInputDto['resolution']
    rawDie?: number
    updatedAt: string
  },
  stages: {
    effects: (
      input: Pick<
        Parameters<typeof prepareEncounterTurnEffects<TCharacterFacts>>[0],
        | 'state'
        | 'userId'
        | 'root'
        | 'occurrenceId'
        | 'actors'
        | 'boundary'
        | 'pending'
        | 'resolution'
        | 'retainedPhase'
        | 'priorPlan'
        | 'movementTargets'
      >
    ) => ReturnType<typeof prepareEncounterTurnEffects<TCharacterFacts>>
    legendary: (
      input: Pick<
        Parameters<typeof prepareTurnLegendaryActions<TCharacterFacts>>[0],
        | 'state'
        | 'userId'
        | 'root'
        | 'occurrenceId'
        | 'actors'
        | 'movementTargets'
        | 'startOutgoing'
        | 'pending'
        | 'resolution'
        | 'updatedAt'
        | 'refreshIncoming'
      >
    ) => ReturnType<typeof prepareTurnLegendaryActions<TCharacterFacts>>
    initiative: (
      input: Pick<
        Parameters<typeof prepareEncounterTurnInitiative>[0],
        'state' | 'root' | 'occurrenceId' | 'actors'
      > & {
        movementTargets?: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
        resume?: Parameters<typeof prepareEncounterTurnInitiative>[0]['resume']
      }
    ) => ReturnType<typeof prepareEncounterTurnInitiative>
    recharge: (
      input: Pick<
        Parameters<typeof prepareEncounterTurnRecharge>[0],
        'state' | 'root' | 'occurrenceId' | 'actors' | 'pending' | 'rawDie'
      >
    ) => ReturnType<typeof prepareEncounterTurnRecharge>
  }
) {
  const { state, campaign, occurrenceId, pending } = input
  let root = input.root
  const effectContext =
    pending?.applicationContext.kind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS'
      ? pending.applicationContext
      : null
  const outgoingPending = effectContext?.currentCandidate.stage === 'END_OF_TURN'
  const outgoing =
    root.commandType === 'ADVANCE_TURN'
      ? await stages.effects({
          state,
          userId: campaign.ownerUserId,
          root,
          occurrenceId,
          actors: input.actors,
          boundary: { ordinal: 0, stage: 'END_OF_TURN', actorId: state.currentActorId },
          ...(root.outgoingTurn ? { retainedPhase: root.outgoingTurn } : {}),
          ...(outgoingPending ? { pending, resolution: input.resolution } : {})
        })
      : null
  if (outgoing?.kind === 'PENDING') return outgoing
  const startOutgoing = root.commandType === 'ADVANCE_TURN' && !root.outgoingTurn
  if (outgoing) root = { ...root, outgoingTurn: outgoing.phase }
  const outgoingActors = outgoing?.actors ?? input.actors
  const needsInitiative =
    root.initiativeAdvance?.kind === 'ROUND_WRAP' &&
    root.initiativeAdvance.cadence === 'EACH_ROUND' &&
    root.initiative === null
  let legendary = await stages.legendary({
    state,
    userId: campaign.ownerUserId,
    root,
    occurrenceId,
    actors: outgoingActors,
    movementTargets: outgoing?.movementTargets,
    startOutgoing,
    pending,
    resolution: input.resolution,
    updatedAt: input.updatedAt,
    refreshIncoming: !needsInitiative
  })
  if (legendary.kind === 'PENDING') return legendary
  root = legendary.root
  if (needsInitiative) {
    const initiative = await stages.initiative({
      state,
      root,
      occurrenceId,
      actors: legendary.actors,
      movementTargets: outgoing?.movementTargets
    })
    if (initiative.kind === 'PENDING') return initiative
    root = initiative.root
    legendary = await stages.legendary({
      state,
      userId: campaign.ownerUserId,
      root,
      occurrenceId,
      actors: outgoingActors,
      movementTargets: outgoing?.movementTargets,
      updatedAt: input.updatedAt
    })
    if (legendary.kind === 'PENDING') throw new Error('Outgoing Legendary Actions are incomplete.')
    root = legendary.root
  }
  const recharge = await stages.recharge({
    state,
    root,
    occurrenceId,
    actors: legendary.actors,
    ...(pending?.snapshotKind === 'KERNEL_EVIDENCE' &&
    pending.applicationContext.kind === 'ENCOUNTER_TURN_RECHARGE'
      ? {
          pending: { ...pending, applicationContext: { ...pending.applicationContext, root } },
          ...(input.rawDie === undefined ? {} : { rawDie: input.rawDie })
        }
      : {})
  })
  if (recharge.kind === 'PENDING') return recharge
  if (recharge.plan) root = { ...root, completedRechargePlan: recharge.plan }
  const movementTargets = new Map<string, MovementTarget<TCharacterFacts>>()
  for (const [actorId, target] of outgoing?.movementTargets ?? []) {
    const actor = recharge.actors.find((candidate) => candidate.id === actorId)
    if (!actor) throw new Error('Turn-effect staged actor is unavailable.')
    movementTargets.set(
      actorId,
      buildMovementTarget({
        actor,
        activeEffects: target.activeEffects,
        gameSystemId: state.gameSystemId,
        campaignId: state.campaignId,
        characterFacts: target.characterFacts,
        includeReactionSources: target.characterReactionSource !== undefined
      })
    )
  }
  const incoming = await stages.effects({
    state,
    userId: campaign.ownerUserId,
    root,
    occurrenceId,
    actors: recharge.actors,
    movementTargets,
    priorPlan: outgoing?.phase,
    boundary: {
      ordinal: root.commandType === 'START' ? 0 : 1,
      stage: 'START_OF_TURN',
      actorId: root.proposedTerminalTransition.currentActorId
    },
    ...(effectContext && !outgoingPending ? { pending, resolution: input.resolution } : {})
  })
  if (incoming.kind === 'PENDING') return incoming
  return {
    kind: 'COMPLETE' as const,
    root,
    actors: incoming.actors,
    outgoingActors,
    incomingActors: recharge.actors,
    outgoing,
    incoming,
    rechargePlan: recharge.plan
  }
}
