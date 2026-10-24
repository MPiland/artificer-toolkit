import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterInitiativeRoundStateDto } from '@artificer-toolkit/schema/shared/initiativeState'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'

import { deadCharacterIdsOfTargets, type DeadCharacterIds } from './encounterActorDefeat.js'
import type { ProjectableCharacterFacts } from './encounterActionProjection.js'
import { validateInitiativeCursor } from './encounterInitiativeCursor.js'
import type { EncounterInitiativeOccurrenceRoot } from './encounterInitiativeOccurrence.js'
import type { prepareEncounterTurnEffects } from './encounterTurnEffects.js'
import type { prepareTurnLegendaryActions } from './encounterTurnLegendaryAction.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import { planEncounterTurnAdvance } from './encounterTurnPreparation.js'

/** Replays issued outgoing turn decisions before initiative consumes staged Creature facts. */
export async function restoreEncounterInitiativeTurnActors<
  TCharacterFacts extends ProjectableCharacterFacts
>(input: {
  state: EncounterRunState
  campaign: { id: string; ownerUserId: string }
  root: EncounterInitiativeOccurrenceRoot
  occurrenceId: string
  updatedAt: string
  readActors(): Promise<EncounterRunActorState[]>
  /** The Characters dead before the outgoing turn's effects (D96). */
  deadCharacterIds: DeadCharacterIds
  readInitiativeRound(): Promise<EncounterInitiativeRoundStateDto | null>
  prepareEffects: (
    input: Pick<
      Parameters<typeof prepareEncounterTurnEffects<TCharacterFacts>>[0],
      | 'state'
      | 'userId'
      | 'autoRoll'
      | 'root'
      | 'occurrenceId'
      | 'actors'
      | 'boundary'
      | 'retainedPhase'
    >
  ) => ReturnType<typeof prepareEncounterTurnEffects<TCharacterFacts>>
  prepareLegendary: (
    input: Pick<
      Parameters<typeof prepareTurnLegendaryActions<TCharacterFacts>>[0],
      | 'state'
      | 'userId'
      | 'autoRollByActorId'
      | 'occurrenceId'
      | 'updatedAt'
      | 'actors'
      | 'movementTargets'
      | 'refreshIncoming'
      | 'root'
    >
  ) => ReturnType<typeof prepareTurnLegendaryActions<TCharacterFacts>>
}) {
  const { root, state } = input
  if (!root.outgoingTurn) {
    if (root.initiativeAdvance || root.completedLegendaryActions)
      throw new Error('Initiative outgoing turn is unavailable.')
    return {
      actors: await input.readActors(),
      movementTargets: new Map<string, MovementTarget<TCharacterFacts>>()
    }
  }
  const advance = root.initiativeAdvance
  if (
    root.commandType !== 'ADVANCE_TURN' ||
    !advance ||
    advance.kind !== 'ROUND_WRAP' ||
    advance.cadence !== 'EACH_ROUND' ||
    root.legendaryActionQueue ||
    root.stagedLegendaryActionRefreshes ||
    root.stagedActionEconomyRefreshes ||
    root.completedRechargePlan !== undefined ||
    root.completedDeathSavePlan !== undefined
  )
    throw new Error('Initiative outgoing turn is stale.')
  const command = {
    type: 'ADVANCE_TURN' as const,
    encounterId: state.id,
    commandId: root.rootCommandId,
    expectedVersion: root.expectedEncounterVersion
  }
  if (
    root.initiatorUserId !== input.campaign.ownerUserId ||
    root.expectedEncounterVersion !== state.version ||
    root.commandFingerprint !== checksumCanonicalJson(command) ||
    root.round !== advance.nextRound
  )
    throw new Error('Initiative outgoing command is stale.')
  const normalized = await input.readInitiativeRound()
  if (!normalized || !state.currentActorId)
    throw new Error('The normalized initiative round is unavailable.')
  const actors = await input.readActors()
  validateInitiativeCursor({
    state: normalized,
    currentActorId: state.currentActorId,
    actors,
    allowedSideIds: state.sides.map((side) => side.id)
  })
  const turnRoot: TurnCoordinatorRootDto = {
    rootCommandId: root.rootCommandId,
    commandFingerprint: root.commandFingerprint,
    commandType: root.commandType,
    initiatorUserId: root.initiatorUserId,
    requestedByUserId: root.requestedByUserId,
    correlationId: root.correlationId,
    expectedEncounterVersion: root.expectedEncounterVersion,
    startSystemId: root.startSystemId,
    frozenActorRuleRevisionId: null,
    frozenActorRuleRevisionChecksum: null,
    frozenActorRuleSnapshotChecksum: null,
    initiative: null,
    initiativeAdvance: advance,
    outgoingTurn: root.outgoingTurn,
    ...(root.completedLegendaryActions
      ? { completedLegendaryActions: root.completedLegendaryActions }
      : {}),
    proposedTerminalTransition: {
      status: 'ACTIVE',
      round: advance.nextRound,
      currentActorId: advance.firstActorId
    },
    resolutionCommands: root.resolutionCommands
  }
  // Reconstruction replays retained evidence and never rolls.
  const outgoing = await input.prepareEffects({
    state,
    userId: input.campaign.ownerUserId,
    autoRoll: false,
    root: turnRoot,
    occurrenceId: input.occurrenceId,
    actors,
    boundary: { ordinal: 0, stage: 'END_OF_TURN', actorId: state.currentActorId },
    retainedPhase: root.outgoingTurn
  })
  if (outgoing.kind !== 'COMPLETE') throw new Error('Outgoing turn effects are incomplete.')
  const prepared = await input.prepareLegendary({
    state,
    userId: input.campaign.ownerUserId,
    autoRollByActorId: {},
    occurrenceId: input.occurrenceId,
    updatedAt: input.updatedAt,
    actors: outgoing.actors,
    movementTargets: outgoing.movementTargets,
    refreshIncoming: false,
    root: turnRoot
  })
  if (prepared.kind !== 'COMPLETE') throw new Error('Outgoing Legendary Actions are incomplete.')
  // The advance was planned after the outgoing turn settled (D63).
  if (
    checksumCanonicalJson(
      planEncounterTurnAdvance({
        state,
        initiativeRound: normalized,
        actors: prepared.actors,
        deadCharacterIds: deadCharacterIdsOfTargets(
          prepared.movementTargets.values(),
          input.deadCharacterIds
        )
      }).initiativeAdvance
    ) !== checksumCanonicalJson(advance)
  )
    throw new Error('Initiative outgoing advancement is stale.')
  return { actors: prepared.actors, movementTargets: prepared.movementTargets }
}
