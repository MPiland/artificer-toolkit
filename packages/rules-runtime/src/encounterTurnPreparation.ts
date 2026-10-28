import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterInitiativeRoundStateDto } from '@artificer-toolkit/schema/shared/initiativeState'
import type { ServerRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  deadCharacterIdsOfTargets,
  skippedEncounterActorIds,
  type DeadCharacterIds
} from './encounterActorDefeat.js'
import { planEncounterInitiativeAdvance } from './encounterInitiativeStateSettlement.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import { rebuildEncounterTurnTarget } from './encounterTurnTarget.js'
import type { prepareEncounterTurnEffects } from './encounterTurnEffects.js'
import type { prepareEncounterTurnZoneEffects } from './encounterTurnZoneEffects.js'
import type { prepareEncounterTurnInitiative } from './encounterTurnInitiative.js'
import {
  delegatedLegendaryOption,
  type prepareTurnLegendaryActions
} from './encounterTurnLegendaryAction.js'
import type { prepareEncounterTurnRecharge } from './encounterTurnRecharge.js'
import type { prepareEncounterTurnDeathSave } from './encounterTurnDeathSave.js'

import type { ProjectableCharacterFacts } from './encounterActionProjection.js'
import type { EncounterResponseAnswer } from './encounterEvidenceAnswer.js'

/**
 * The next turn for the actors as they stand. A turn advance is planned when the turn ends and
 * planned again once its outgoing effects and Legendary Actions settle, so an actor they defeat
 * loses its turn like any defeated actor (D63).
 */
export function planEncounterTurnAdvance(input: {
  state: EncounterRunState
  initiativeRound: EncounterInitiativeRoundStateDto
  actors: readonly EncounterRunActorState[]
  deadCharacterIds: DeadCharacterIds
}): Pick<TurnCoordinatorRootDto, 'initiativeAdvance' | 'proposedTerminalTransition'> {
  if (input.state.currentActorId === null) throw new Error('Outgoing turn is unavailable.')
  const advance = planEncounterInitiativeAdvance({
    state: input.initiativeRound,
    currentActorId: input.state.currentActorId,
    defeatedActorIds: skippedEncounterActorIds(input.actors, input.deadCharacterIds)
  })
  return {
    initiativeAdvance: advance,
    proposedTerminalTransition: {
      status: 'ACTIVE',
      round: advance.kind === 'SAME_ROUND' ? input.state.round : advance.nextRound,
      currentActorId: advance.kind === 'SAME_ROUND' ? advance.nextActorId : advance.firstActorId
    }
  }
}

/** Stages the complete turn in rules order. Every pause leaves aggregate state untouched. */
export async function prepareEncounterTurn<TCharacterFacts extends ProjectableCharacterFacts>(
  input: {
    state: EncounterRunState
    campaign: { id: string; ownerUserId: string }
    /** The GM's auto-roll preference for initiative, which is the GM's turn step. */
    autoRoll: boolean
    /**
     * Each actor's roller preference for its own turn dice (turn-effect saves, Recharge, Legendary
     * Actions), which go to the actor's controllers (ADR 0034 decision 3).
     */
    autoRollByActorId: Readonly<Record<string, boolean>>
    root: TurnCoordinatorRootDto
    occurrenceId: string
    actors: EncounterRunActorState[]
    /** The Characters dead before this turn's effects and Legendary Actions (D96). */
    deadCharacterIds: DeadCharacterIds
    /** The normalized round an `ADVANCE_TURN` advances; null for `START`. */
    initiativeRound: EncounterInitiativeRoundStateDto | null
    pending?: ServerRuleExecutionPendingSnapshotDto
    /** The response, with an app roll's recorded faces. */
    resolution?: EncounterResponseAnswer
    rawDie?: number
    updatedAt: string
  },
  stages: {
    effects: (
      input: Pick<
        Parameters<typeof prepareEncounterTurnEffects<TCharacterFacts>>[0],
        | 'state'
        | 'userId'
        | 'autoRollByActorId'
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
    /** The zones that catch the boundary creature, after its active effects. */
    zones: (
      input: Pick<
        Parameters<typeof prepareEncounterTurnZoneEffects<TCharacterFacts>>[0],
        | 'state'
        | 'userId'
        | 'autoRollByActorId'
        | 'root'
        | 'occurrenceId'
        | 'actors'
        | 'boundary'
        | 'pending'
        | 'resolution'
        | 'retainedPlan'
        | 'movementTargets'
      >
    ) => ReturnType<typeof prepareEncounterTurnZoneEffects<TCharacterFacts>>
    legendary: (
      input: Pick<
        Parameters<typeof prepareTurnLegendaryActions<TCharacterFacts>>[0],
        | 'state'
        | 'userId'
        | 'autoRollByActorId'
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
        'state' | 'autoRoll' | 'root' | 'occurrenceId' | 'actors' | 'deadCharacterIds'
      > & {
        movementTargets?: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
        resume?: Parameters<typeof prepareEncounterTurnInitiative>[0]['resume']
      }
    ) => ReturnType<typeof prepareEncounterTurnInitiative>
    recharge: (
      input: Pick<
        Parameters<typeof prepareEncounterTurnRecharge>[0],
        'state' | 'autoRoll' | 'root' | 'occurrenceId' | 'actors' | 'pending' | 'rawDie'
      >
    ) => ReturnType<typeof prepareEncounterTurnRecharge>
    /** Whether the actor's turn in the round was already begun, and so ran its start-of-turn effects. */
    turnStarted: (input: { round: number; actorId: string }) => Promise<boolean>
    deathSave: (
      input: Pick<
        Parameters<typeof prepareEncounterTurnDeathSave<TCharacterFacts>>[0],
        | 'state'
        | 'userId'
        | 'root'
        | 'occurrenceId'
        | 'actors'
        | 'movementTargets'
        | 'pending'
        | 'resolution'
        | 'autoRoll'
      >
    ) => ReturnType<typeof prepareEncounterTurnDeathSave<TCharacterFacts>>
  }
) {
  const { state, campaign, autoRoll, occurrenceId, pending } = input
  // A missing preference prompts rather than rolling for someone.
  const actorAutoRoll = (actorId: string | null) =>
    actorId !== null && input.autoRollByActorId[actorId] === true
  let root = input.root
  const effectContext =
    pending?.applicationContext.kind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS'
      ? pending.applicationContext
      : null
  const outgoingPending = effectContext?.currentCandidate.stage === 'END_OF_TURN'
  const zoneContext =
    pending?.applicationContext.kind === 'ENCOUNTER_TURN_ZONE_EFFECTS'
      ? pending.applicationContext
      : null
  // Only an advancing turn has an outgoing boundary; a START's zone boundary is the incoming one. A
  // continuation after a delegated Legendary Action already ended the outgoing turn.
  const endsOutgoing =
    root.commandType === 'ADVANCE_TURN' && state.delegatedLegendaryAction === undefined
  const outgoingZonePending = endsOutgoing && zoneContext?.currentCandidate.boundaryOrdinal === 0
  const outgoing = endsOutgoing
    ? await stages.effects({
        state,
        userId: campaign.ownerUserId,
        autoRollByActorId: input.autoRollByActorId,
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
  const outgoingBoundary = {
    ordinal: 0,
    stage: 'END_OF_TURN',
    actorId: state.currentActorId
  } as const
  const outgoingZones = outgoing
    ? await stages.zones({
        state,
        userId: campaign.ownerUserId,
        autoRollByActorId: input.autoRollByActorId,
        root,
        occurrenceId,
        actors: outgoing.actors,
        movementTargets: outgoing.movementTargets,
        boundary: outgoingBoundary,
        ...(root.outgoingZoneTurn ? { retainedPlan: root.outgoingZoneTurn } : {}),
        ...(outgoingZonePending ? { pending, resolution: input.resolution } : {})
      })
    : null
  if (outgoingZones?.kind === 'PENDING') return outgoingZones
  if (outgoingZones?.plan) root = { ...root, outgoingZoneTurn: outgoingZones.plan }
  const outgoingActors = outgoingZones?.actors ?? input.actors
  // Legendary windows first; the entering actor refreshes once the next turn is known.
  let legendary = await stages.legendary({
    state,
    userId: campaign.ownerUserId,
    autoRollByActorId: input.autoRollByActorId,
    root,
    occurrenceId,
    actors: outgoingActors,
    movementTargets: outgoingZones?.movementTargets,
    startOutgoing,
    pending,
    resolution: input.resolution,
    updatedAt: input.updatedAt,
    refreshIncoming: false
  })
  if (legendary.kind === 'PENDING') return legendary
  root = legendary.root
  // A delegated window commits the turn end so far; the next turn starts in the continuation.
  if (delegatedLegendaryOption(root))
    return {
      kind: 'COMPLETE' as const,
      root,
      actors: legendary.actors,
      outgoingActors,
      incomingActors: legendary.actors,
      outgoing,
      incoming: {
        kind: 'COMPLETE' as const,
        actors: legendary.actors,
        movementTargets: legendary.movementTargets,
        plan: null,
        phase: { kind: 'NONE' as const }
      },
      outgoingZones: outgoingZones?.plan ?? null,
      incomingZones: null,
      rechargePlan: null,
      deathSavePlan: null
    }
  // The turn's effects and Legendary Actions may have killed a Character (D96).
  const deadCharacterIds = deadCharacterIdsOfTargets(
    legendary.movementTargets.values(),
    input.deadCharacterIds
  )
  if (root.commandType === 'ADVANCE_TURN') {
    if (!input.initiativeRound) throw new Error('The normalized initiative round is unavailable.')
    const settled = planEncounterTurnAdvance({
      state,
      initiativeRound: input.initiativeRound,
      actors: legendary.actors,
      deadCharacterIds
    })
    // A rolled new round was already planned after this same settlement.
    if (!root.initiative) root = { ...root, ...settled }
    else if (
      checksumCanonicalJson(settled.initiativeAdvance) !==
      checksumCanonicalJson(root.initiativeAdvance)
    )
      throw new Error('Encounter turn advancement is stale.')
  }
  if (
    root.initiativeAdvance?.kind === 'ROUND_WRAP' &&
    root.initiativeAdvance.cadence === 'EACH_ROUND' &&
    root.initiative === null
  ) {
    const initiative = await stages.initiative({
      state,
      autoRoll,
      root,
      occurrenceId,
      actors: legendary.actors,
      deadCharacterIds,
      movementTargets: legendary.movementTargets
    })
    if (initiative.kind === 'PENDING') return initiative
    root = initiative.root
  }
  legendary = await stages.legendary({
    state,
    userId: campaign.ownerUserId,
    autoRollByActorId: input.autoRollByActorId,
    root,
    occurrenceId,
    actors: outgoingActors,
    movementTargets: outgoingZones?.movementTargets,
    updatedAt: input.updatedAt
  })
  if (legendary.kind === 'PENDING') throw new Error('Outgoing Legendary Actions are incomplete.')
  root = legendary.root
  // A turn that was already begun (Previous Turn, then Next) never runs its start-of-turn stages again.
  const actorId = root.proposedTerminalTransition.currentActorId
  const incomingBegun =
    actorId !== null &&
    (await stages.turnStarted({ round: root.proposedTerminalTransition.round, actorId }))
  // Recharge candidates all belong to the entering actor.
  const recharge = incomingBegun
    ? { kind: 'COMPLETE' as const, actors: legendary.actors, plan: null }
    : await stages.recharge({
        state,
        autoRoll: actorAutoRoll(root.proposedTerminalTransition.currentActorId),
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
  // Legendary Actions start from the outgoing turn's facts and add each actor they changed.
  for (const [actorId, target] of legendary.movementTargets) {
    const actor = recharge.actors.find((candidate) => candidate.id === actorId)
    if (!actor) throw new Error('Turn-effect staged actor is unavailable.')
    movementTargets.set(
      actorId,
      rebuildEncounterTurnTarget({
        source: target,
        actor,
        characterFacts: target.characterFacts,
        activeEffects: target.activeEffects,
        state
      })
    )
  }
  // A dying Character's save follows Recharge and precedes its start-of-turn effects, which then
  // see the save's outcome (D96).
  const deathSave = incomingBegun
    ? { kind: 'COMPLETE' as const, plan: null, target: null }
    : await stages.deathSave({
        state,
        userId: campaign.ownerUserId,
        autoRoll: actorAutoRoll(actorId),
        root,
        occurrenceId,
        actors: recharge.actors,
        movementTargets,
        ...(pending?.snapshotKind === 'KERNEL_EVIDENCE' &&
        pending.applicationContext.kind === 'ENCOUNTER_TURN_DEATH_SAVE'
          ? {
              pending: { ...pending, applicationContext: { ...pending.applicationContext, root } },
              ...(input.resolution === undefined ? {} : { resolution: input.resolution })
            }
          : {})
      })
  if (deathSave.kind === 'PENDING') return deathSave
  if (deathSave.plan) root = { ...root, completedDeathSavePlan: deathSave.plan }
  if (deathSave.target && actorId !== null) movementTargets.set(actorId, deathSave.target)
  const incomingBoundary = {
    ordinal: root.commandType === 'START' ? 0 : 1,
    stage: 'START_OF_TURN',
    actorId: root.proposedTerminalTransition.currentActorId
  } as const
  const incoming = incomingBegun
    ? {
        kind: 'COMPLETE' as const,
        actors: recharge.actors,
        movementTargets,
        plan: null,
        phase: { kind: 'NONE' as const }
      }
    : await stages.effects({
        state,
        userId: campaign.ownerUserId,
        autoRollByActorId: input.autoRollByActorId,
        root,
        occurrenceId,
        actors: recharge.actors,
        movementTargets,
        priorPlan: outgoing?.phase,
        boundary: incomingBoundary,
        ...(root.incomingTurn ? { retainedPhase: root.incomingTurn } : {}),
        ...(effectContext && !outgoingPending ? { pending, resolution: input.resolution } : {})
      })
  if (incoming.kind === 'PENDING') return incoming
  const incomingZones = incomingBegun
    ? {
        kind: 'COMPLETE' as const,
        actors: incoming.actors,
        movementTargets: incoming.movementTargets,
        plan: null
      }
    : await stages.zones({
        state,
        userId: campaign.ownerUserId,
        autoRollByActorId: input.autoRollByActorId,
        // A zone pause re-runs the incoming effects from the phase it retains.
        root: { ...root, incomingTurn: incoming.phase },
        occurrenceId,
        actors: incoming.actors,
        movementTargets: incoming.movementTargets,
        boundary: incomingBoundary,
        ...(zoneContext && !outgoingZonePending ? { pending, resolution: input.resolution } : {})
      })
  if (incomingZones.kind === 'PENDING') return incomingZones
  return {
    kind: 'COMPLETE' as const,
    root,
    actors: incomingZones.actors,
    outgoingActors,
    incomingActors: recharge.actors,
    outgoing,
    incoming,
    outgoingZones: outgoingZones?.plan ?? null,
    incomingZones: incomingZones.plan,
    rechargePlan: recharge.plan,
    deathSavePlan: deathSave.plan
  }
}
