import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { requireServerKernelRuleExecutionPendingSnapshot } from '@artificer-toolkit/schema/shared/rulesExecution'
import { movementRuleResolutionCommandDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionSpatial'
import type { ServerRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { SceneGrid, SceneToken } from '@artificer-toolkit/shared/vtt/scene'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { withEncounterRuleUsageUsed } from './encounterActorState.js'
import { discoverEncounterEventHooks } from './events/encounterEventHooks.js'
import type { EncounterActionEconomyConsumption } from './encounterActionEconomyConsumption.js'
import {
  evaluateEncounterMovementPassageContest,
  passesThrough
} from './encounterMovementPassageExecution.js'
import { stopSceneMovementResult } from './encounterMovementContinuation.js'
import { preparePassageAppliedEffects } from './encounterPassageAppliedEffects.js'
import { readEncounterMovementPendingContext } from './encounterMovementPendingContext.js'
import type { CharacterMovementFacts, MovementTarget } from './encounterMovementTargets.js'
import type { FrozenMovementReactionRemainder } from './encounterSpatialMovementRuleService.js'
import type { EncounterAutoRollByActorId } from './encounterEvidenceMode.js'
import type { EncounterResponseAnswer } from './encounterEvidenceAnswer.js'

type Outcome = Exclude<SceneSpatialPreparation['outcome'], { kind: 'UNINTERRUPTED' }>
type ResolutionCommand = ReturnType<typeof movementRuleResolutionCommandDtoSchema.parse>
type PassageSettlement = {
  kind: 'PASSAGE'
  plan: {
    actor: EncounterRunActorState
    consumption: EncounterActionEconomyConsumption
    /** The one-check grants (Help) both rollers' contest checks used up. */
    consumedGrants: ActiveRuleEffectRecord[]
    /** What the rule behind a won contest gives the contested creature (the cling a climb leaves). */
    createdEffects: ActiveRuleEffectRecord[]
  }
}

/** Contest evidence is evaluated before the same Scene transaction consumes its allowance. */
export async function evaluateEncounterMovementPassageResponse<
  TCharacterFacts extends CharacterMovementFacts,
  TSettlement
>(
  input: {
    state: EncounterRunState
    snapshot: ServerRuleExecutionPendingSnapshotDto
    resolution: EncounterResponseAnswer
    occurrenceId: string
    occurrenceVersion: number
    userId: string
    /** The roller's auto-roll preference; the responding user rolls in this slice. */
    autoRoll: EncounterAutoRollByActorId
    responseCommand: ResolutionCommand
    occurredAt: string
    retained?: Outcome
    sceneTokens: readonly SceneToken[]
    sceneGrid: SceneGrid
    actorIdByTokenId: ReadonlyMap<string, string>
    actors: readonly EncounterRunActorState[]
  },
  callbacks: {
    loadTargets: (
      actorIds: readonly string[]
    ) => Promise<ReadonlyMap<string, MovementTarget<TCharacterFacts>>>
    evaluateContest: (
      input: Parameters<typeof evaluateEncounterMovementPassageContest<TCharacterFacts>>[0]
    ) => ReturnType<typeof evaluateEncounterMovementPassageContest<TCharacterFacts>>
    continueMovement: (input: {
      state: EncounterRunState
      userId: string
      autoRoll: EncounterAutoRollByActorId
      root: FrozenMovementReactionRemainder['root']
      sceneVersion: number
      sceneTokens: readonly SceneToken[]
      sceneGrid: SceneGrid
      actorIdByTokenId: ReadonlyMap<string, string>
      currentPosition: SceneToken['position']
      occurrenceId: string
      occurrenceVersion: number
      executionCommandId: string
      occurredAt: string
      reactionTimeline: FrozenMovementReactionRemainder['reactionTimeline']
      targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
      remainder: FrozenMovementReactionRemainder
      retained?: Outcome
    }) => Promise<{
      outcome: SceneSpatialPreparation['outcome']
      settlements: readonly TSettlement[]
    }>
  }
) {
  const { state, snapshot, resolution, responseCommand, occurredAt } = input
  const { context } = readEncounterMovementPendingContext(snapshot)
  const movement =
    context.kind === 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE'
      ? context.movement
      : context.kind === 'ENCOUNTER_CONTEST_CHECK'
        ? context.origin.movementContinuation
        : null
  if (
    (context.kind !== 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE' &&
      context.kind !== 'ENCOUNTER_CONTEST_CHECK') ||
    !movement
  )
    throw new Error('Movement passage response is unavailable.')
  const blocker = input.sceneTokens.find((token) => token.id === movement.blockerTokenId)
  if (
    !blocker ||
    input.actorIdByTokenId.get(blocker.id) !== movement.blockerActorId ||
    checksumCanonicalJson({
      actorId: movement.blockerActorId,
      tokenId: blocker.id,
      footprint: blocker
    }) !== movement.blockerCurrentnessChecksum
  )
    throw new Error('Movement passage blocker changed before resolution.')
  const mover = input.sceneTokens.find((token) => token.id === movement.root.tokenId)
  if (!mover) throw new Error('Movement passage mover is unavailable.')
  const characterActors = input.actors.filter((actor) => actor.kind === 'CHARACTER')
  if (new Set(characterActors.map((actor) => actor.sourceId)).size !== characterActors.length)
    throw new Error('Encounter Character target is stale.')
  let targets = await callbacks.loadTargets([context.sourceActorId, movement.blockerActorId])
  const currentTargets = new Map(targets)
  let retained: Parameters<
    typeof evaluateEncounterMovementPassageContest<TCharacterFacts>
  >[0]['retained']
  if (input.retained) {
    if (
      input.retained.kind === 'PENDING' &&
      input.retained.pendingSnapshot.applicationContext.kind === 'ENCOUNTER_CONTEST_CHECK'
    )
      retained = {
        snapshot: requireServerKernelRuleExecutionPendingSnapshot(input.retained.pendingSnapshot)
      }
    else {
      const commands =
        input.retained.kind === 'PENDING'
          ? readEncounterMovementPendingContext(input.retained.pendingSnapshot).root
              .resolutionCommands
          : input.retained.resolutionCommands
      const command = commands?.find((entry) => entry.commandId === responseCommand.commandId)
      if (command && 'passageContest' in command && command.passageContest)
        retained = { receipt: command.passageContest }
      else if (resolution.kind !== 'PASSAGE_DECLINE')
        throw new Error('Retained Scene passage completion is missing its contest evidence.')
    }
  }
  const evaluated = await callbacks.evaluateContest({
    state,
    autoRoll: input.autoRoll,
    snapshot,
    resolution,
    responseCommand,
    targets,
    footprints: {
      mover: { width: mover.width, height: mover.height },
      blocker: { position: blocker.position, width: blocker.width, height: blocker.height }
    },
    ...(retained ? { retained } : {})
  })
  const resolutionCommands = evaluated.movement.root.resolutionCommands
  if (evaluated.kind === 'PENDING')
    return {
      outcome: {
        kind: 'PENDING' as const,
        pendingSnapshot: evaluated.snapshot,
        movementIntent: null
      },
      settlements: [] as (PassageSettlement | TSettlement)[],
      resolutionCommands
    }
  const remainder: FrozenMovementReactionRemainder = {
    root: evaluated.movement.root,
    spatialSelectionChecksum: evaluated.movement.spatialSelectionChecksum,
    spatialCurrentnessChecksum: evaluated.movement.spatialCurrentnessChecksum,
    completedSpatialExecutions: evaluated.movement.completedSpatialExecutions,
    appliedSpatialPrefix: evaluated.movement.appliedSpatialPrefix,
    completedReactionExecutions: evaluated.movement.completedReactionExecutions,
    currentSpatialCandidate: null,
    remainingSpatialCandidates: evaluated.movement.remainingSpatialCandidates,
    reactionTimeline: evaluated.movement.reactionTimeline
  }
  const root = remainder.root
  const settlements: (PassageSettlement | TSettlement)[] = []
  const withTargetActor = (actor: EncounterRunActorState) => {
    const target = targets.get(actor.id)
    if (!target) throw new Error('Movement passage target is unavailable.')
    targets = new Map([
      ...targets,
      [
        actor.id,
        {
          ...target,
          actor,
          ...(target.characterReactionSource
            ? { characterReactionSource: { ...target.characterReactionSource, actor } }
            : {})
        }
      ]
    ])
  }
  // The contest's checks used these grants; the continuation can't reuse them.
  const consumedGrants =
    evaluated.kind === 'COMPLETE'
      ? [evaluated.pending.initiator, evaluated.pending.defender].flatMap(
          ({ actorId }) =>
            discoverEncounterEventHooks({
              effects: targets.get(actorId)?.activeEffects ?? [],
              events: [{ kind: 'TEST', test: 'CHECK', ability: null }]
            }).ended
        )
      : []
  if (evaluated.kind === 'COMPLETE') {
    const source = targets.get(evaluated.pending.sourceActorId)
    const economy = evaluated.pending.actionEconomy
    if (!source || !economy) throw new Error('Movement passage allowance is unavailable.')
    const consumption = { ...economy, afterUsed: economy.beforeUsed + 1 }
    const blockerTarget = targets.get(movement.blockerActorId)
    let createdEffects: ActiveRuleEffectRecord[] = []
    if (evaluated.execution.outcome === 'SUCCESS' && blockerTarget) {
      // Every holder's relationships count against what the mover may hold at once.
      targets = new Map([
        ...(await callbacks.loadTargets(state.actorIds.filter((id) => !targets.has(id)))),
        ...targets
      ])
      createdEffects = preparePassageAppliedEffects({
        state,
        definitionId: evaluated.pending.origin.pin.definitionId,
        occurrenceId: input.occurrenceId,
        commandId: responseCommand.commandId,
        occurredAt,
        source,
        target: blockerTarget,
        activeEffectsByActorId: new Map(
          [...targets].map(([actorId, target]) => [actorId, target.activeEffects])
        )
      })
    }
    settlements.push({
      kind: 'PASSAGE',
      plan: { actor: source.actor, consumption, consumedGrants, createdEffects }
    })
    withTargetActor(
      encounterRunActorStateSchema.parse({
        ...source.actor,
        resources: withEncounterRuleUsageUsed(
          source.actor,
          consumption.definitionId,
          consumption.afterUsed
        )
      })
    )
  }
  if (evaluated.kind === 'DECLINED' || !passesThrough(evaluated.pending, evaluated.execution)) {
    // A won contest that enters the blocker's space ends the move there: one more token write.
    const entered =
      evaluated.kind === 'COMPLETE' ? evaluated.receipt.audit.enteredPosition : undefined
    return {
      outcome: {
        kind: 'TERMINAL' as const,
        result: stopSceneMovementResult({
          occurrenceId: input.occurrenceId,
          occurrenceVersion: input.occurrenceVersion + 1,
          encounterId: state.id,
          encounterVersion: state.version + 1,
          sceneId: root.sceneId,
          sceneVersion: root.currentSceneVersion + (entered ? 1 : 0),
          tokenId: root.tokenId,
          movementKind: root.movementKind,
          reactionExecutions: remainder.completedReactionExecutions,
          terminalPosition: entered ?? root.currentPosition,
          remainder
        }),
        selectionChecksum: remainder.spatialSelectionChecksum,
        currentnessChecksum: remainder.spatialCurrentnessChecksum,
        terminalPathDistance: root.pathStartDistance,
        resolutionCommands
      },
      settlements,
      resolutionCommands
    }
  }
  const remainingActorIds = state.actorIds.filter((id) => !targets.has(id))
  if (remainingActorIds.length > 0) {
    const remainingTargets = await callbacks.loadTargets(remainingActorIds)
    targets = new Map([...targets, ...remainingTargets])
    for (const [id, target] of remainingTargets) currentTargets.set(id, target)
  }
  const continued = await callbacks.continueMovement({
    state,
    userId: input.userId,
    autoRoll: input.autoRoll,
    root,
    sceneVersion: root.currentSceneVersion,
    sceneTokens: input.sceneTokens,
    sceneGrid: input.sceneGrid,
    actorIdByTokenId: input.actorIdByTokenId,
    currentPosition: root.currentPosition,
    occurrenceId: input.occurrenceId,
    occurrenceVersion: input.occurrenceVersion + 1,
    executionCommandId: responseCommand.commandId,
    occurredAt,
    reactionTimeline: remainder.reactionTimeline,
    targets,
    remainder,
    ...(input.retained ? { retained: input.retained } : {})
  })
  if (continued.outcome.kind === 'UNINTERRUPTED')
    throw new Error('Completed passage must retain its movement history.')
  return {
    outcome:
      continued.outcome.kind === 'TERMINAL'
        ? { ...continued.outcome, resolutionCommands }
        : continued.outcome,
    settlements: [...settlements, ...continued.settlements],
    resolutionCommands,
    // Revalidate with this transaction's current facts, before projected allowance or effect changes.
    currentTargets
  }
}
