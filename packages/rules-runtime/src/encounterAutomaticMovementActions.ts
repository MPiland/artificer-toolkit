import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ServerKernelRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { requireServerKernelRuleExecutionPendingSnapshot } from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  isServerAggregateChoicePendingSnapshot,
  isServerKernelRuleExecutionPendingSnapshot,
  type ServerRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { SceneToken } from '@artificer-toolkit/shared/vtt/scene'
import type { ProjectableCharacterFacts } from './encounterActionProjection.js'
import type {
  PendingNativeActionGraphs,
  NativeActionTestBoundary
} from './encounterActionExecution.js'
import { projectSpatialMovementCandidates } from './encounterSpatialMovementCurrentness.js'
import { planNativeSpatialMovementPrefix } from './encounterSpatialMovementPlan.js'
import type { PreparedSpatialMovementPlan } from './encounterSpatialMovementPreparation.js'
import {
  movementRemainderAtBoundary,
  retainedMovementReactionExecutions,
  stopSceneMovementResult
} from './encounterMovementContinuation.js'
import { movementDamageEnvelope } from './encounterMovementConcentration.js'
import { bindEncounterMovementMaintenancePending } from './encounterMovementMaintenance.js'
import type { executeEncounterMovementReactionAction } from './encounterMovementReactionExecution.js'
import { startEncounterAutomaticMovementReactionEvidenceAtBoundary } from './encounterMovementReactionContinuation.js'
import type { buildEncounterMovementReactionFacts } from './encounterMovementReactionFacts.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import type { discoverEncounterMovementPassage } from './encounterMovementPassageBoundary.js'
import {
  checksumSpatialCurrentness,
  type FrozenMovementReactionRemainder,
  type SpatialMovementRuleEvaluation,
  type SpatialMovementRuleRoot
} from './encounterSpatialMovementRuleService.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import type { EncounterMovementReactionContact } from './encounterMovementReactionContacts.js'
import type { EncounterMovementReactionSource } from './encounterMovementReactionSources.js'

type Outcome = Exclude<SceneSpatialPreparation['outcome'], { kind: 'UNINTERRUPTED' }>
type Boundary = Extract<SpatialMovementRuleEvaluation, { kind: 'REACTION_BOUNDARY' }>
type InitialBoundary<TSpatialPlan> =
  | Boundary
  | (Boundary & { preparedBoundary: Boundary; prefixSettlementPlan: TSpatialPlan })
type PreparedReaction = {
  maintenance: Parameters<typeof bindEncounterMovementMaintenancePending>[1]
}
type CompleteReaction = Extract<
  Awaited<ReturnType<typeof executeEncounterMovementReactionAction>>,
  { kind: 'COMPLETE' }
>
type ReactionSettlement<TPrepared> = {
  prepared: TPrepared
  occurrenceId: string
  commandId: string
  ordinal: number
  occurredAt: string
  execution: CompleteReaction
}
type AutomaticSettlement<TSpatialPlan, TPrepared, TConcentrationPlan> =
  | { kind: 'SPATIAL'; plan: TSpatialPlan }
  | { kind: 'REACTION'; plan: ReactionSettlement<TPrepared> }
  | { kind: 'CONCENTRATION'; plan: TConcentrationPlan }

function samePoint(left: { x: number; y: number }, right: { x: number; y: number }) {
  return Math.abs(left.x - right.x) <= 1e-8 && Math.abs(left.y - right.y) <= 1e-8
}

function virtualTokens(
  tokens: readonly SceneToken[],
  tokenId: string,
  position: { x: number; y: number }
) {
  return tokens.map((token) => (token.id === tokenId ? { ...token, position } : token))
}

function outerPendingMovementIntent(
  snapshot: Extract<Outcome, { kind: 'PENDING' }>['pendingSnapshot'],
  origin: SceneToken,
  tokenId: string
) {
  const context = snapshot.applicationContext
  const root =
    isServerKernelRuleExecutionPendingSnapshot(snapshot) &&
    (context.kind === 'ENCOUNTER_SPATIAL_MOVEMENT' ||
      context.kind === 'ENCOUNTER_MOVEMENT_REACTION')
      ? context.root
      : isServerAggregateChoicePendingSnapshot(snapshot) &&
          context.kind === 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE'
        ? context.movement.root
        : isServerKernelRuleExecutionPendingSnapshot(snapshot) &&
            context.kind === 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST' &&
            context.movementContinuation
          ? context.movementContinuation.root
          : null
  if (!root) throw new Error('Movement response has a different pending context.')
  return samePoint(origin.position, root.currentPosition)
    ? null
    : { tokenId, position: root.currentPosition }
}

/** Stages ordered automatic reactions from already-authorized movement facts. */
export async function evaluateEncounterAutomaticMovementActions<
  TCharacterFacts extends ProjectableCharacterFacts,
  TProjection,
  TPrepared extends PreparedReaction,
  TLegendCandidate,
  TSpatialPlan extends PreparedSpatialMovementPlan<TCharacterFacts>,
  TPlan extends {
    reactionExecution: FrozenMovementReactionRemainder['completedReactionExecutions'][number]
    projectedTargets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
    maintenanceProjection?: TProjection
  },
  TConcentrationPlan,
  TContinuationSettlement
>(
  input: {
    state: EncounterRunState
    userId: string
    /** The roller's auto-roll preference; the moving initiator rolls in this slice. */
    autoRoll: boolean
    runtime: RulesRuntimeService
    facts: ReturnType<typeof buildEncounterMovementReactionFacts<TCharacterFacts>> & {
      runtime: RulesRuntimeService
    }
    resolvePerception: (
      contact: EncounterMovementReactionContact<EncounterMovementReactionSource>
    ) => Promise<boolean>
    root: SpatialMovementRuleRoot
    boundary: InitialBoundary<TSpatialPlan>
    reactionTimeline: FrozenMovementReactionRemainder['reactionTimeline']
    occurrenceId: string
    occurrenceVersion: number
    executionCommandId: string
    occurredAt: string
    encounterId: string
    expectedEncounterVersion: number
    sceneId: string
    sceneVersion: number
    sceneTokens: readonly SceneToken[]
    actorIdByTokenId: ReadonlyMap<string, string>
    passage: ReturnType<typeof discoverEncounterMovementPassage>
    projectedTargets?: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
    maintenanceProjection?: TProjection
    retained?: Outcome
  },
  callbacks: {
    prepareReaction(input: {
      encounterId: string
      expectedEncounterVersion: number
      movementKind: SpatialMovementRuleRoot['movementKind']
      occurrenceId: string
      option: Extract<
        FrozenMovementReactionRemainder['reactionTimeline'][number],
        { kind: 'AUTOMATIC_ACTION' }
      >['option']
      actorIdByTokenId: ReadonlyMap<string, string>
      tokens: readonly SceneToken[]
      resolvePerception: (
        contact: EncounterMovementReactionContact<EncounterMovementReactionSource>
      ) => Promise<boolean>
      targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
      maintenanceProjection?: TProjection
    }): Promise<TPrepared>
    executeReaction(input: {
      runtime: RulesRuntimeService
      occurrenceId: string
      autoRoll: boolean
      prepared: TPrepared
    }): Promise<
      | PendingNativeActionGraphs
      | CompleteReaction
      | {
          kind: 'LEGENDARY_RESISTANCE'
          boundary: NativeActionTestBoundary
          candidate: TLegendCandidate
        }
    >
    replayReaction(input: {
      runtime: RulesRuntimeService
      occurrenceId: string
      prepared: TPrepared
      retained:
        | {
            kind: 'COMPLETE'
            receipt: FrozenMovementReactionRemainder['completedReactionExecutions'][number]
          }
        | { kind: 'PENDING'; snapshot: ServerKernelRuleExecutionPendingSnapshotDto }
    }): Promise<
      | PendingNativeActionGraphs
      | CompleteReaction
      | {
          kind: 'LEGENDARY_RESISTANCE'
          boundary: NativeActionTestBoundary
          candidate: TLegendCandidate
        }
    >
    planReaction(input: ReactionSettlement<TPrepared>, userId: string): TPlan
    retainLegendary(input: {
      runtime: RulesRuntimeService
      occurrenceId: string
      prepared: TPrepared
      context: Extract<
        ServerKernelRuleExecutionPendingSnapshotDto['applicationContext'],
        { kind: 'ENCOUNTER_MOVEMENT_REACTION' }
      >
      execution: NativeActionTestBoundary['execution']
      d20: NativeActionTestBoundary['d20']
      candidate: TLegendCandidate
    }): Promise<ServerKernelRuleExecutionPendingSnapshotDto>
    prepareConcentration(input: {
      state: EncounterRunState
      occurrenceId: string
      sourceCommandId: string
      userId: string
      occurredAt: string
      remainder: FrozenMovementReactionRemainder
      targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
      projection?: TProjection
      source: { kind: 'REACTION'; executionOrdinal: number }
      retainedChecks?: FrozenMovementReactionRemainder['completedReactionExecutions'][number]['concentrationChecks']
    }): Promise<{
      remainder: FrozenMovementReactionRemainder
      targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
      projection?: TProjection
      settlements: readonly TConcentrationPlan[]
      pendingSnapshot: ServerRuleExecutionPendingSnapshotDto | null
    }>
    continueMovement(input: {
      state: EncounterRunState
      userId: string
      autoRoll: boolean
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
      remainder: FrozenMovementReactionRemainder
      retained?: Outcome
    }): Promise<{
      outcome: SceneSpatialPreparation['outcome']
      settlements: readonly TContinuationSettlement[]
    }>
  }
): Promise<{
  outcome: Outcome
  settlements: Array<
    AutomaticSettlement<TSpatialPlan, TPrepared, TConcentrationPlan> | TContinuationSettlement
  >
} | null> {
  const first = input.reactionTimeline[0]
  if (!first || first.kind !== 'AUTOMATIC_ACTION') return null
  if (input.state.automationMode === 'MANUAL')
    throw new Error('Automatic movement reactions cannot run in a Manual Encounter.')
  const initialTargets = input.projectedTargets ?? input.facts.targets
  let maintenanceProjection = input.maintenanceProjection
  const initialBoundary =
    'preparedBoundary' in input.boundary && input.boundary.preparedBoundary
      ? {
          ...input.boundary.preparedBoundary,
          ...('prefixSettlementPlan' in input.boundary
            ? { prefixSettlementPlan: input.boundary.prefixSettlementPlan }
            : {})
        }
      : input.boundary
  let remainder = movementRemainderAtBoundary({
    root: input.root,
    sceneVersion: input.sceneVersion,
    boundary: initialBoundary,
    timeline: input.reactionTimeline
  })
  const passage = input.root.terminalPassageStop ? null : input.passage
  const passageDistance =
    input.root.terminalPassageStop?.pathDistance ?? passage?.contact.pathDistance
  const appliedCount =
    remainder.appliedSpatialPrefix?.status === 'BATCH_COMPLETE' &&
    remainder.appliedSpatialPrefix.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT'
      ? remainder.appliedSpatialPrefix.executions.length
      : 0
  const pendingPrefix = remainder.completedSpatialExecutions.slice(appliedCount)
  let targets = !pendingPrefix.length
    ? initialTargets
    : planNativeSpatialMovementPrefix({
        targets: initialTargets,
        executions: pendingPrefix,
        encounterId: input.encounterId,
        expectedEncounterVersion: input.expectedEncounterVersion,
        campaignId: input.state.campaignId,
        gameSystemId: input.state.gameSystemId,
        occurrenceId: input.occurrenceId,
        sourceCommandId: input.root.commandId,
        occurredAt: input.occurredAt,
        userId: input.userId
      }).projectedTargets
  if ('prefixSettlementPlan' in initialBoundary)
    targets = new Map([
      ...initialTargets,
      ...initialBoundary.prefixSettlementPlan.mechanicsPlan.projectedTargets
    ])
  const origin = input.sceneTokens.find((token) => token.id === input.root.tokenId)
  if (!origin) throw new Error('Automatic movement token is unavailable.')
  const boundary = initialBoundary
  const position = boundary.boundaryPosition
  const settlements: AutomaticSettlement<TSpatialPlan, TPrepared, TConcentrationPlan>[] = []
  if ('prefixSettlementPlan' in initialBoundary)
    settlements.push({
      kind: 'SPATIAL',
      plan: initialBoundary.prefixSettlementPlan
    })
  for (;;) {
    const next = remainder.reactionTimeline[0]
    if (!next) break
    const distance =
      next.kind === 'AUTOMATIC_ACTION'
        ? next.option.candidate.pathDistance
        : next.group.pathDistance
    if (
      passageDistance !== undefined &&
      passageDistance > boundary.boundaryDistance + 1e-8 &&
      passageDistance <= distance + 1e-8
    )
      break
    if (distance > boundary.boundaryDistance + 1e-8) break
    if (next.kind === 'CONTROLLER_CHOICE') break
    const retainedExecutions = input.retained
      ? retainedMovementReactionExecutions(input.retained)
      : []
    const retainedReceipt = retainedExecutions.find(
      (entry) =>
        entry.sourceCommandId === input.executionCommandId &&
        entry.ordinal === remainder.completedReactionExecutions.length &&
        entry.option.optionId === next.option.optionId
    )
    const retainedPending =
      input.retained?.kind === 'PENDING' &&
      input.retained.pendingSnapshot.applicationContext.kind === 'ENCOUNTER_MOVEMENT_REACTION' &&
      (input.retained.pendingSnapshot.applicationContext.phase.kind === 'ACTION_EVIDENCE' ||
        input.retained.pendingSnapshot.applicationContext.phase.kind ===
          'LEGENDARY_RESISTANCE_CHOICE') &&
      input.retained.pendingSnapshot.applicationContext.phase.selectedOptionId ===
        next.option.optionId
        ? requireServerKernelRuleExecutionPendingSnapshot(input.retained.pendingSnapshot)
        : null
    if (input.retained && !retainedReceipt && !retainedPending)
      throw new Error('Initial automatic movement evidence is unavailable.')
    const prepared = await callbacks.prepareReaction({
      encounterId: input.encounterId,
      expectedEncounterVersion: input.expectedEncounterVersion,
      movementKind: input.root.movementKind,
      occurrenceId: input.occurrenceId,
      option: next.option,
      actorIdByTokenId: input.actorIdByTokenId,
      tokens: virtualTokens(input.sceneTokens, input.root.tokenId, position),
      resolvePerception: input.resolvePerception,
      targets,
      maintenanceProjection
    })
    const execution = retainedReceipt
      ? await callbacks.replayReaction({
          runtime: input.runtime,
          occurrenceId: input.occurrenceId,
          prepared,
          retained: { kind: 'COMPLETE', receipt: retainedReceipt }
        })
      : retainedPending
        ? await callbacks.replayReaction({
            runtime: input.runtime,
            occurrenceId: input.occurrenceId,
            prepared,
            retained: { kind: 'PENDING', snapshot: retainedPending }
          })
        : await callbacks.executeReaction({
            runtime: input.runtime,
            occurrenceId: input.occurrenceId,
            autoRoll: input.autoRoll,
            prepared
          })
    if (execution.kind === 'LEGENDARY_RESISTANCE') {
      const actionSnapshot = startEncounterAutomaticMovementReactionEvidenceAtBoundary({
        continuation: execution.boundary.continuation,
        root: remainder.root,
        currentSceneVersion: input.sceneVersion + (samePoint(origin.position, position) ? 0 : 1),
        boundary: pendingBoundary(boundary, remainder, input),
        reactionTimeline: remainder.reactionTimeline,
        selectedOptionId: next.option.optionId,
        d20Policy: execution.boundary.d20Policy,
        twoPhase: execution.boundary.twoPhase,
        phaseReceipts: execution.boundary.phaseReceipts
      })
      const actionContext = actionSnapshot.applicationContext
      if (actionContext.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
        throw new Error('Automatic movement action context is unavailable.')
      const pendingSnapshot = await callbacks.retainLegendary({
        runtime: input.runtime,
        occurrenceId: input.occurrenceId,
        prepared,
        context: actionContext,
        execution: execution.boundary.execution,
        d20: execution.boundary.d20,
        candidate: execution.candidate
      })
      return {
        outcome: {
          kind: 'PENDING',
          pendingSnapshot: {
            ...pendingSnapshot,
            optionalCombatSnapshotChecksum: input.state.optionalCombatSnapshotChecksum
          },
          movementIntent: samePoint(origin.position, position)
            ? null
            : { tokenId: input.root.tokenId, position }
        },
        settlements
      }
    }
    if (execution.kind === 'PENDING') {
      const pendingSnapshot = bindEncounterMovementMaintenancePending(
        startEncounterAutomaticMovementReactionEvidenceAtBoundary({
          continuation: execution.continuation,
          root: remainder.root,
          currentSceneVersion: input.sceneVersion + (samePoint(origin.position, position) ? 0 : 1),
          boundary: pendingBoundary(boundary, remainder, input),
          reactionTimeline: remainder.reactionTimeline,
          selectedOptionId: next.option.optionId,
          d20Policy: execution.d20Policy,
          ...(execution.twoPhase ? { twoPhase: execution.twoPhase } : {}),
          ...(execution.phaseReceipts ? { phaseReceipts: execution.phaseReceipts } : {})
        }),
        prepared.maintenance
      )
      return {
        outcome: {
          kind: 'PENDING',
          pendingSnapshot: {
            ...pendingSnapshot,
            optionalCombatSnapshotChecksum: input.state.optionalCombatSnapshotChecksum
          },
          movementIntent: samePoint(origin.position, position)
            ? null
            : { tokenId: input.root.tokenId, position }
        },
        settlements
      }
    }
    const settlement: ReactionSettlement<TPrepared> = {
      prepared,
      occurrenceId: input.occurrenceId,
      commandId: input.executionCommandId,
      ordinal: remainder.completedReactionExecutions.length,
      occurredAt: input.occurredAt,
      execution
    }
    const plan = callbacks.planReaction(settlement, input.userId)
    if (
      retainedReceipt &&
      checksumRuleDocument(plan.reactionExecution) !==
        checksumRuleDocument(movementDamageEnvelope(retainedReceipt))
    )
      throw new Error('Automatic movement receipt does not match current mechanics.')
    const remainingSpatialCandidates = projectSpatialMovementCandidates({
      candidates: remainder.remainingSpatialCandidates,
      beforeTargets: targets,
      afterTargets: plan.projectedTargets
    })
    targets = plan.projectedTargets
    maintenanceProjection = plan.maintenanceProjection
    settlements.push({ kind: 'REACTION', plan: settlement })
    remainder = {
      ...remainder,
      completedReactionExecutions: [
        ...remainder.completedReactionExecutions,
        plan.reactionExecution
      ],
      remainingSpatialCandidates,
      spatialCurrentnessChecksum: checksumSpatialCurrentness({
        encounter: {
          id: input.encounterId,
          version: input.expectedEncounterVersion
        },
        candidates: remainingSpatialCandidates
      }),
      reactionTimeline: remainder.reactionTimeline.slice(1)
    }
    const concentration = await callbacks.prepareConcentration({
      state: input.state,
      occurrenceId: input.occurrenceId,
      sourceCommandId: input.executionCommandId,
      userId: input.userId,
      occurredAt: input.occurredAt,
      remainder,
      targets,
      projection: maintenanceProjection,
      source: { kind: 'REACTION', executionOrdinal: plan.reactionExecution.ordinal },
      ...(input.retained ? { retainedChecks: retainedReceipt?.concentrationChecks ?? [] } : {})
    })
    remainder = concentration.remainder
    targets = concentration.targets
    maintenanceProjection = concentration.projection
    settlements.push(
      ...concentration.settlements.map((plan) => ({ kind: 'CONCENTRATION' as const, plan }))
    )
    if (concentration.pendingSnapshot)
      throw new Error('Automatic Concentration unexpectedly requested player evidence.')
    if (execution.execution.movementInterruption?.kind === 'STOP') {
      const result = stopSceneMovementResult({
        occurrenceId: input.occurrenceId,
        occurrenceVersion: input.occurrenceVersion,
        encounterId: input.encounterId,
        encounterVersion: input.expectedEncounterVersion + 1,
        sceneId: input.sceneId,
        sceneVersion: input.sceneVersion + (samePoint(origin.position, position) ? 0 : 1),
        tokenId: input.root.tokenId,
        movementKind: input.root.movementKind,
        reactionExecutions: remainder.completedReactionExecutions,
        terminalPosition: position,
        remainder
      })
      return {
        outcome: {
          kind: 'TERMINAL',
          result,
          selectionChecksum: boundary.selectionChecksum,
          currentnessChecksum: boundary.currentnessChecksum
        },
        settlements
      }
    }
  }
  const continued = await callbacks.continueMovement({
    state: input.state,
    userId: input.userId,
    autoRoll: input.autoRoll,
    root: remainder.root,
    sceneVersion: input.sceneVersion,
    sceneTokens: virtualTokens(input.sceneTokens, input.root.tokenId, position),
    actorIdByTokenId: input.actorIdByTokenId,
    currentPosition: position,
    occurrenceId: input.occurrenceId,
    occurrenceVersion: input.occurrenceVersion,
    executionCommandId: input.executionCommandId,
    occurredAt: input.occurredAt,
    reactionTimeline: remainder.reactionTimeline,
    targets,
    maintenanceProjection,
    remainder,
    ...(input.retained ? { retained: input.retained } : {})
  })
  if (continued.outcome.kind === 'UNINTERRUPTED')
    throw new Error('Automatic movement lost its completed history.')
  const outcome = continued.outcome
  return {
    outcome:
      outcome.kind === 'PENDING'
        ? {
            ...outcome,
            movementIntent: outerPendingMovementIntent(
              outcome.pendingSnapshot,
              origin,
              input.root.tokenId
            )
          }
        : {
            ...outcome,
            result: {
              ...outcome.result,
              sceneVersion:
                input.sceneVersion +
                (samePoint(origin.position, outcome.result.terminalPosition) ? 0 : 1)
            }
          },
    settlements: [...settlements, ...continued.settlements]
  }
}

function pendingBoundary(
  boundary: Boundary,
  remainder: FrozenMovementReactionRemainder,
  input: {
    encounterId: string
    expectedEncounterVersion: number
    executionCommandId: string
  }
): Boundary {
  const changed = remainder.completedReactionExecutions.some(
    (entry) => entry.sourceCommandId === input.executionCommandId
  )
  return {
    ...boundary,
    completedReactionExecutions: remainder.completedReactionExecutions,
    resolutionCommands: remainder.root.resolutionCommands,
    currentnessChecksum: checksumSpatialCurrentness({
      encounter: {
        id: input.encounterId,
        version: input.expectedEncounterVersion + (changed ? 1 : 0)
      },
      candidates: []
    })
  }
}
