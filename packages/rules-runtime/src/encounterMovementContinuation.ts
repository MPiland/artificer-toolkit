import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import type {
  ServerRuleExecutionPendingSnapshotDto,
  StoredRuleExecutionResultDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'
import type {
  FrozenMovementReactionRemainder,
  SpatialMovementRuleRoot,
  SpatialMovementRuleEvaluation
} from './encounterSpatialMovementRuleService.js'
import type {
  PreparedSpatialMovementPlan,
  SpatialMovementPreparationInput
} from './encounterSpatialMovementPreparation.js'
import type { ProjectableCharacterFacts } from './encounterActionProjection.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import { startEncounterMovementReactionAtBoundary } from './encounterMovementReactionContinuation.js'
import { createReactionChoiceDefinition } from './reactionChoiceDefinition.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { SceneToken } from '@artificer-toolkit/shared/vtt/scene'
import { retainedMovementSpatialExecutions } from './encounterSpatialMovementResult.js'
import type { EncounterAutoRollByActorId } from './encounterEvidenceMode.js'
export {
  retainedMovementSpatialExecutions,
  retainedMovementReactionExecutions
} from './encounterSpatialMovementResult.js'

type Outcome = Exclude<SceneSpatialPreparation['outcome'], { kind: 'UNINTERRUPTED' }>
type Boundary = Extract<SpatialMovementRuleEvaluation, { kind: 'REACTION_BOUNDARY' }>
type PassageContact = NonNullable<SpatialMovementRuleRoot['terminalPassageStop']>
type Passage = {
  contact: PassageContact
  nextPassageStop: PassageContact | null
  sourceActorId: string
}
type SpatialEvaluation<TPlan> =
  | Exclude<SpatialMovementRuleEvaluation, { kind: 'REACTION_BOUNDARY' }>
  | Boundary
  | (Boundary & { preparedBoundary: Boundary; prefixSettlementPlan: TPlan })

export type MovementContinuationInput<
  TCharacterFacts extends ProjectableCharacterFacts,
  TProjection
> = {
  state: EncounterRunState
  userId: string
  autoRoll: EncounterAutoRollByActorId
  root: SpatialMovementRuleRoot
  sceneVersion: number
  sceneTokens: readonly SceneToken[]
  actorIdByTokenId: ReadonlyMap<string, string>
  currentPosition: SceneToken['position']
  occurrenceId: string
  occurrenceVersion: number
  executionCommandId: string
  occurredAt: string
  reactionTimeline: FrozenMovementReactionRemainder['reactionTimeline']
  targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
  maintenanceProjection?: TProjection
  remainder?: FrozenMovementReactionRemainder
  evidence?: Pick<
    SpatialMovementPreparationInput,
    'pendingSnapshot' | 'resolution' | 'resolutionCommand'
  >
  retained?: Outcome
}

type SpatialStepInput<TProjection> = SpatialMovementPreparationInput & {
  encounterId: string
  expectedEncounterVersion: number
  interruptForConcentration: true
  maintenanceProjection?: TProjection
}

export function stopSceneMovementResult(
  input: Omit<
    Extract<StoredRuleExecutionResultDto, { status: 'MOVEMENT_COMPLETE' }>,
    'status' | 'schemaVersion'
  > & { remainder: FrozenMovementReactionRemainder }
) {
  const { remainder, ...terminal } = input
  const prefix = remainder.appliedSpatialPrefix
  if (prefix?.status === 'BATCH_COMPLETE' && prefix.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT') {
    if (
      checksumCanonicalJson(prefix.executions) !==
      checksumCanonicalJson(remainder.completedSpatialExecutions)
    )
      throw new Error('Stopped Scene movement spatial history is inconsistent.')
    const { consumedSpatialEffects: _consumed, ...completedPrefix } = prefix
    const result = storedRuleExecutionResultDtoSchema.parse({
      ...completedPrefix,
      ...terminal
    })
    if (result.status !== 'BATCH_COMPLETE' || result.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT')
      throw new Error('Stopped Scene movement spatial result is invalid.')
    return result
  }
  if (remainder.completedSpatialExecutions.length > 0)
    throw new Error('Stopped Scene movement cannot discard spatial execution history.')
  const result = storedRuleExecutionResultDtoSchema.parse({
    status: 'MOVEMENT_COMPLETE',
    schemaVersion: 1,
    ...terminal
  })
  if (result.status !== 'MOVEMENT_COMPLETE')
    throw new Error('Stopped Scene movement result is invalid.')
  return result
}

function movementRemainderAtBoundary(input: {
  root: SpatialMovementRuleRoot
  sceneVersion: number
  boundary: Boundary
  timeline: FrozenMovementReactionRemainder['reactionTimeline']
}): FrozenMovementReactionRemainder {
  return {
    root: {
      ...input.root,
      originalPath: [...input.root.originalPath],
      currentSceneVersion: input.sceneVersion,
      pathChecksum: checksumRuleDocument(input.root.originalPath),
      pathStartDistance: input.boundary.boundaryDistance,
      currentPosition: input.boundary.boundaryPosition,
      resolutionCommands: [...input.boundary.resolutionCommands]
    },
    spatialSelectionChecksum: input.boundary.selectionChecksum,
    spatialCurrentnessChecksum: input.boundary.currentnessChecksum,
    completedSpatialExecutions: [...input.boundary.completedExecutions],
    appliedSpatialPrefix: input.boundary.appliedPrefix,
    completedReactionExecutions: [...input.boundary.completedReactionExecutions],
    currentSpatialCandidate: null,
    remainingSpatialCandidates: [...input.boundary.remainingCandidates],
    reactionTimeline: [...input.timeline]
  }
}

/** One ordered suffix coordinator serves initial movement, reaction replies and passage contests. */
export async function prepareEncounterMovementContinuation<
  TCharacterFacts extends ProjectableCharacterFacts,
  TProjection,
  TSpatialPlan extends PreparedSpatialMovementPlan<TCharacterFacts>,
  TSettlement
>(
  input: MovementContinuationInput<TCharacterFacts, TProjection>,
  callbacks: {
    discoverPassage(): Promise<Passage | null>
    evaluateSpatial(
      step: SpatialStepInput<TProjection>,
      targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>,
      stageTerminalSettlement: (plan: TSpatialPlan) => void
    ): Promise<SpatialEvaluation<TSpatialPlan>>
    prepareConcentration(args: {
      autoRoll: EncounterAutoRollByActorId
      remainder: FrozenMovementReactionRemainder
      targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
      projection?: TProjection
      executionOrdinal: number
      retainedChecks?: FrozenMovementReactionRemainder['completedSpatialExecutions'][number]['concentrationChecks']
    }): Promise<{
      remainder: FrozenMovementReactionRemainder
      targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
      projection?: TProjection
      settlements: readonly TSettlement[]
      pendingSnapshot: ServerRuleExecutionPendingSnapshotDto | null
    }>
    preparePassage(args: {
      root: SpatialMovementRuleRoot
      boundary: Boundary
      passage: Passage
      reactionTimeline: FrozenMovementReactionRemainder['reactionTimeline']
      targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
    }): Promise<Outcome>
    /** The group's options against current facts: itself when current, else its rediscovery (null when none remain). */
    currentReactionGroup(args: {
      next: FrozenMovementReactionRemainder['reactionTimeline'][number]
      root: SpatialMovementRuleRoot
      position: SceneToken['position']
      targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
    }): Promise<FrozenMovementReactionRemainder['reactionTimeline'][number] | null>
    runtime(): Promise<RulesRuntimeService>
    spatialSettlement(plan: TSpatialPlan): TSettlement
  }
) {
  const settlements: TSettlement[] = []
  let targets = input.targets
  let maintenanceProjection = input.maintenanceProjection
  let remainder = input.remainder
  let position = input.currentPosition
  let evidence = input.evidence
  const completedPassage = input.remainder?.root.resolutionCommands.some(
    (entry) => 'passageContest' in entry && entry.passageContest?.outcome === 'SUCCESS'
  )
  let passage =
    input.root.terminalPassageStop || completedPassage ? null : await callbacks.discoverPassage()
  if (
    passage &&
    remainder &&
    passage.contact.pathDistance < remainder.root.pathStartDistance - 1e-8
  )
    passage = null
  const terminalStop = input.root.terminalPassageStop
  if (terminalStop) {
    const blocker = input.sceneTokens.find((token) => token.id === terminalStop.blockerTokenId)
    if (
      !blocker ||
      input.actorIdByTokenId.get(blocker.id) !== terminalStop.blockerActorId ||
      checksumRuleDocument({
        actorId: terminalStop.blockerActorId,
        tokenId: blocker.id,
        footprint: blocker
      }) !== terminalStop.blockerCurrentnessChecksum
    )
      throw new Error('Retained hostile passage stop is stale.')
  }
  const outcomePending = (
    snapshot: ServerRuleExecutionPendingSnapshotDto,
    at: SceneToken['position']
  ): Outcome => ({
    kind: 'PENDING',
    pendingSnapshot: {
      ...snapshot,
      optionalCombatSnapshotChecksum: input.state.optionalCombatSnapshotChecksum
    },
    movementIntent:
      checksumRuleDocument(input.currentPosition) === checksumRuleDocument(at)
        ? null
        : { tokenId: input.root.tokenId, position: at }
  })
  for (;;) {
    const timeline = remainder?.reactionTimeline ?? input.reactionTimeline
    const next = timeline[0]
    const reactionDistance = next?.group.pathDistance
    const distances = [
      reactionDistance,
      passage?.contact.pathDistance,
      terminalStop?.pathDistance
    ].filter((value): value is number => value !== undefined)
    const distance = distances.length ? Math.min(...distances) : undefined
    const root = remainder?.root ?? input.root
    const evaluated = await callbacks.evaluateSpatial(
      {
        encounterId: input.state.id,
        expectedEncounterVersion: input.state.version,
        sceneId: root.sceneId,
        sceneVersion: input.sceneVersion,
        sceneTokens: input.sceneTokens.map((token) =>
          token.id === root.tokenId ? { ...token, position } : token
        ),
        actorIdByTokenId: input.actorIdByTokenId,
        currentPosition: position,
        occurrenceId: input.occurrenceId,
        occurrenceVersion: input.occurrenceVersion,
        executionCommandId: input.executionCommandId,
        occurredAt: input.occurredAt,
        autoRoll: input.autoRoll,
        interruptForConcentration: true,
        maintenanceProjection,
        root,
        ...(evidence ??
          (remainder
            ? { frozenReactionRemainder: remainder }
            : { initialReactionTimeline: timeline })),
        ...(distance === undefined ? {} : { interruptAfterPathDistance: distance }),
        ...(input.retained
          ? {
              retainedExecutions: retainedMovementSpatialExecutions(input.retained)
            }
          : {})
      },
      targets,
      (plan) => settlements.push(callbacks.spatialSettlement(plan))
    )
    evidence = undefined
    if (evaluated.kind === 'PENDING') {
      const context = evaluated.pendingSnapshot.applicationContext
      if (
        context.kind !== 'ENCOUNTER_SPATIAL_MOVEMENT' &&
        context.kind !== 'ENCOUNTER_MOVEMENT_REACTION'
      )
        throw new Error('Scene movement spatial continuation is unavailable.')
      return {
        outcome: outcomePending(evaluated.pendingSnapshot, context.root.currentPosition),
        settlements
      }
    }
    if (evaluated.kind === 'TERMINAL')
      return {
        outcome: {
          kind: 'TERMINAL' as const,
          result: {
            ...evaluated.result,
            sceneVersion:
              input.sceneVersion +
              (checksumRuleDocument(input.currentPosition) ===
              checksumRuleDocument(evaluated.result.terminalPosition)
                ? 0
                : 1)
          },
          selectionChecksum: evaluated.selectionChecksum,
          currentnessChecksum: evaluated.currentnessChecksum,
          ...(evaluated.areaDepartures.length
            ? { areaDepartures: [...evaluated.areaDepartures] }
            : {})
        },
        settlements
      }
    if (evaluated.kind === 'MANUAL' || evaluated.kind === 'NO_CANDIDATES')
      return {
        outcome: { kind: 'UNINTERRUPTED' as const, reason: evaluated.kind },
        settlements
      }
    const boundary =
      'preparedBoundary' in evaluated && evaluated.preparedBoundary
        ? evaluated.preparedBoundary
        : evaluated
    if ('prefixSettlementPlan' in evaluated) {
      targets = new Map([
        ...targets,
        ...evaluated.prefixSettlementPlan.mechanicsPlan.projectedTargets
      ])
      settlements.push(callbacks.spatialSettlement(evaluated.prefixSettlementPlan))
    }
    position = boundary.boundaryPosition
    remainder = movementRemainderAtBoundary({
      root,
      sceneVersion: input.sceneVersion,
      boundary,
      timeline
    })
    if (boundary.concentrationExecutionOrdinal !== undefined) {
      const concentration = await callbacks.prepareConcentration({
        autoRoll: input.autoRoll,
        remainder,
        targets,
        projection: maintenanceProjection,
        executionOrdinal: boundary.concentrationExecutionOrdinal,
        ...(input.retained
          ? {
              retainedChecks:
                retainedMovementSpatialExecutions(input.retained).find(
                  (entry) => entry.ordinal === boundary.concentrationExecutionOrdinal
                )?.concentrationChecks ?? []
            }
          : {})
      })
      remainder = concentration.remainder
      targets = concentration.targets
      maintenanceProjection = concentration.projection
      settlements.push(...concentration.settlements)
      if (concentration.pendingSnapshot)
        return { outcome: outcomePending(concentration.pendingSnapshot, position), settlements }
      continue
    }
    if (terminalStop && Math.abs(boundary.boundaryDistance - terminalStop.pathDistance) <= 1e-8) {
      return {
        outcome: {
          kind: 'TERMINAL' as const,
          result: stopSceneMovementResult({
            occurrenceId: input.occurrenceId,
            occurrenceVersion: input.occurrenceVersion,
            encounterId: input.state.id,
            encounterVersion: input.state.version + 1,
            sceneId: root.sceneId,
            sceneVersion:
              input.sceneVersion +
              (checksumRuleDocument(input.currentPosition) === checksumRuleDocument(position)
                ? 0
                : 1),
            tokenId: root.tokenId,
            movementKind: root.movementKind,
            reactionExecutions: remainder.completedReactionExecutions,
            terminalPosition: position,
            remainder
          }),
          selectionChecksum: boundary.selectionChecksum,
          currentnessChecksum: boundary.currentnessChecksum,
          terminalPathDistance: terminalStop.pathDistance
        },
        settlements
      }
    }
    if (passage && Math.abs(boundary.boundaryDistance - passage.contact.pathDistance) <= 1e-8) {
      const pending = await callbacks.preparePassage({
        root,
        boundary,
        passage,
        reactionTimeline: timeline,
        targets
      })
      return { outcome: pending, settlements }
    }
    if (
      !next ||
      reactionDistance === undefined ||
      Math.abs(boundary.boundaryDistance - reactionDistance) > 1e-8
    )
      continue
    const current = await callbacks.currentReactionGroup({ next, root, position, targets })
    if (!current) {
      // Every retained option is gone, so the group resolves as no reaction and the walk goes on.
      remainder = { ...remainder, reactionTimeline: timeline.slice(1) }
      continue
    }
    const reactionTimeline = current === next ? timeline : [current, ...timeline.slice(1)]
    const definitionId = current.group.options[0]?.policy.choiceDefinitionId
    if (!definitionId) throw new Error('The next reaction choice definition is unavailable.')
    const snapshot = await startEncounterMovementReactionAtBoundary({
      runtime: await callbacks.runtime(),
      occurrenceId: input.occurrenceId,
      gameSystemId: input.state.gameSystemId,
      publishedChoice: createReactionChoiceDefinition({
        definitionId,
        gameSystemId: input.state.gameSystemId
      }),
      root: remainder.root,
      currentSceneVersion:
        input.sceneVersion +
        (checksumRuleDocument(input.currentPosition) === checksumRuleDocument(position) ? 0 : 1),
      boundary,
      reactionTimeline
    })
    return { outcome: outcomePending(snapshot, position), settlements }
  }
}
