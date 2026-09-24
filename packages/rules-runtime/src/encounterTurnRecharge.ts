import { requireRechargePending } from './encounterTurnPending.js'
import {
  discoverEncounterRechargeCandidates,
  executeEncounterRechargeCandidate,
  type EncounterRechargeCandidate
} from './encounterRechargeLifecycle.js'
import { requireSnapshotIdentity, withFeatureChargeUsed } from './encounterActorState.js'
import { buildEncounterActorRuleFacts } from './encounterActorRuleFacts.js'
import { reconcileEncounterActorRuleOutput } from './encounterActorRuleOutput.js'
import { evaluateInstalledEncounterActors } from './platformRulesRuntime.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import {
  serverKernelRuleExecutionPendingSnapshotDtoSchema,
  type ServerKernelRuleExecutionPendingSnapshotDto,
  type ServerRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import type { CompletedTurnRechargePlanDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnResources'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'

type TurnRechargeExecution = CompletedTurnRechargePlanDto['executions'][number]
type TurnRechargeCandidate = TurnRechargeExecution['candidate']

function same(left: unknown, right: unknown) {
  return checksumCanonicalJson(left) === checksumCanonicalJson(right)
}

function selectionChecksum(candidates: readonly EncounterRechargeCandidate[]) {
  return checksumCanonicalJson({ candidates })
}

function serializeCandidate(
  candidate: EncounterRechargeCandidate,
  ordinal: number
): TurnRechargeCandidate {
  return { ...candidate, ordinal }
}

function completedExecution(input: {
  ordinal: number
  result: Extract<
    Awaited<ReturnType<typeof executeEncounterRechargeCandidate>>,
    { kind: 'COMPLETE' }
  >
}): TurnRechargeExecution {
  if (input.result.rawDie === null)
    throw new Error('Recharge completion lacks its required d6 evidence.')
  return {
    ordinal: input.ordinal,
    candidate: serializeCandidate(input.result.candidate, input.ordinal),
    execution: input.result.execution,
    recharged: input.result.recharged,
    beforeUsed: input.result.candidate.beforeUsed,
    afterUsed: input.result.afterUsed,
    rawDie: input.result.rawDie
  }
}

function kernelContinuation(snapshot: ServerKernelRuleExecutionPendingSnapshotDto) {
  const {
    snapshotKind: _snapshotKind,
    optionalCombatSnapshotChecksum: _optionalCombatSnapshotChecksum,
    applicationContext: _applicationContext,
    phaseReceipts: _phaseReceipts,
    ...continuation
  } = snapshot
  return continuation
}

function requirePendingSelection(input: {
  pending: ServerRuleExecutionPendingSnapshotDto
  occurrenceId: string
  root: TurnCoordinatorRootDto
  candidates: readonly TurnRechargeCandidate[]
  selectionChecksum: string
}) {
  const { snapshot, context } = requireRechargePending(input.pending)
  const completedCount = context.completedExecutions.length
  const current = input.candidates[completedCount]
  if (
    !current ||
    snapshot.occurrenceId !== input.occurrenceId ||
    context.phase !== 'START_OF_TURN' ||
    !same(context.root, input.root) ||
    context.selectionChecksum !== input.selectionChecksum ||
    !same(
      context.completedExecutions.map((execution) => execution.candidate),
      input.candidates.slice(0, completedCount)
    ) ||
    !same(context.currentCandidate, current) ||
    !same(context.remainingCandidates, input.candidates.slice(completedCount + 1))
  ) {
    throw new Error('Recharge evidence is stale.')
  }
  return { snapshot, context }
}

async function replayCompletedRecharge(input: {
  candidate: TurnRechargeCandidate
  retained: TurnRechargeExecution
  occurrenceId: string
  definitions: { requireCurrent(definitionId: string): Promise<ReusableDefinitionCurrentDto> }
  runtime: RulesRuntimeService
}) {
  if (
    input.retained.ordinal !== input.candidate.ordinal ||
    !same(input.retained.candidate, input.candidate) ||
    input.retained.beforeUsed !== input.candidate.beforeUsed
  )
    throw new Error('Retained Recharge execution is stale.')
  const started = await executeEncounterRechargeCandidate({
    candidate: input.candidate,
    occurrenceId: input.occurrenceId,
    definitions: input.definitions,
    runtime: input.runtime,
    mode: 'ASSISTED'
  })
  if (!started || started.kind !== 'PENDING')
    throw new Error('Retained Recharge execution no longer requires d6 evidence.')
  const replayed = await executeEncounterRechargeCandidate({
    candidate: input.candidate,
    occurrenceId: input.occurrenceId,
    definitions: input.definitions,
    runtime: input.runtime,
    mode: 'ASSISTED',
    continuation: started.continuation,
    rawDie: input.retained.rawDie
  })
  if (
    !replayed ||
    replayed.kind !== 'COMPLETE' ||
    !same(replayed.execution, input.retained.execution) ||
    replayed.recharged !== input.retained.recharged ||
    replayed.afterUsed !== input.retained.afterUsed ||
    replayed.rawDie !== input.retained.rawDie
  )
    throw new Error('Retained Recharge execution is stale.')
}

function applyRechargePlan(
  actors: readonly EncounterRunActorState[],
  plan: CompletedTurnRechargePlanDto | null
) {
  if (!plan) return [...actors]
  let nextActors = [...actors]
  for (const execution of plan.executions) {
    const actorIndex = nextActors.findIndex((actor) => actor.id === execution.candidate.actorId)
    const actor = nextActors[actorIndex]
    if (
      actorIndex < 0 ||
      !actor ||
      actor.kind !== 'CREATURE' ||
      execution.beforeUsed !== execution.candidate.beforeUsed
    )
      throw new Error('Recharge actor state is stale.')
    nextActors[actorIndex] = encounterRunActorStateSchema.parse({
      ...actor,
      resources: withFeatureChargeUsed(actor, execution.candidate.featureId, execution.afterUsed)
    })
  }
  return nextActors
}

/** Plans start-of-turn Recharge without mutating the Run or its actors. */
export async function prepareEncounterTurnRecharge(input: {
  state: EncounterRunState
  root: TurnCoordinatorRootDto
  occurrenceId: string
  actors: EncounterRunActorState[]
  pending?: ServerRuleExecutionPendingSnapshotDto
  rawDie?: number
  definitions: { requireCurrent(definitionId: string): Promise<ReusableDefinitionCurrentDto> }
  createRuntime(): Promise<RulesRuntimeService>
  rollD6(): number
}): Promise<
  | { kind: 'PENDING'; snapshot: ServerKernelRuleExecutionPendingSnapshotDto }
  | {
      kind: 'COMPLETE'
      plan: CompletedTurnRechargePlanDto | null
      actors: EncounterRunActorState[]
    }
> {
  const completedPlan = input.root.completedRechargePlan
  if (completedPlan && input.pending)
    throw new Error('Recharge cannot be both complete and pending.')
  if (!input.pending && input.rawDie !== undefined)
    throw new Error('Recharge evidence has no pending request.')

  const actors = input.actors
  actors.forEach(requireSnapshotIdentity)
  const currentActorId = input.root.proposedTerminalTransition.currentActorId
  if (input.pending && input.state.automationMode === 'MANUAL')
    throw new Error('Recharge evidence cannot resume in a Manual Encounter.')
  if (input.state.automationMode === 'MANUAL' || currentActorId === null) {
    if (completedPlan) throw new Error('Retained Recharge plan has no current owner.')
    return { kind: 'COMPLETE', plan: null, actors }
  }

  const facts = buildEncounterActorRuleFacts({ actors })
  const actorRules = reconcileEncounterActorRuleOutput(
    evaluateInstalledEncounterActors({ gameSystemId: input.state.gameSystemId, facts }),
    facts
  )
  const definitions = input.definitions
  const candidates = await discoverEncounterRechargeCandidates({
    actorId: currentActorId,
    encounterActors: actors,
    actorRules,
    definitions
  })
  if (candidates.length === 0) {
    if (input.pending || completedPlan)
      throw new Error('Recharge evidence has no current candidate.')
    return { kind: 'COMPLETE', plan: null, actors }
  }

  const selection = selectionChecksum(candidates)
  const serializedCandidates = candidates.map(serializeCandidate)
  const runtime = await input.createRuntime()
  if (completedPlan) {
    if (
      completedPlan.selectionChecksum !== selection ||
      completedPlan.executions.length !== serializedCandidates.length
    )
      throw new Error('Retained Recharge selection is stale.')
    for (const [ordinal, execution] of completedPlan.executions.entries()) {
      if (execution.ordinal !== ordinal)
        throw new Error('Retained Recharge execution order is stale.')
      await replayCompletedRecharge({
        candidate: serializedCandidates[ordinal]!,
        retained: execution,
        occurrenceId: input.occurrenceId,
        definitions,
        runtime
      })
    }
    return {
      kind: 'COMPLETE',
      plan: completedPlan,
      actors: applyRechargePlan(actors, completedPlan)
    }
  }
  const retained = input.pending
    ? requirePendingSelection({
        pending: input.pending,
        occurrenceId: input.occurrenceId,
        root: input.root,
        candidates: serializedCandidates,
        selectionChecksum: selection
      })
    : null

  if (retained) {
    for (const [ordinal, execution] of retained.context.completedExecutions.entries())
      await replayCompletedRecharge({
        candidate: serializedCandidates[ordinal]!,
        retained: execution,
        occurrenceId: input.occurrenceId,
        definitions,
        runtime
      })
  }

  const executions = retained ? [...retained.context.completedExecutions] : []
  let ordinal = executions.length
  const settle = async (
    candidate: TurnRechargeCandidate,
    continuation?: ReturnType<typeof kernelContinuation>
  ) => {
    const result = await executeEncounterRechargeCandidate({
      candidate,
      occurrenceId: input.occurrenceId,
      definitions,
      runtime,
      mode: input.state.automationMode,
      ...(continuation ? { continuation, rawDie: input.rawDie } : { rollD6: input.rollD6 })
    })
    if (!result) throw new Error('Recharge execution became unavailable.')
    if (result.kind === 'PENDING') {
      const snapshot = serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
        ...result.continuation,
        snapshotKind: 'KERNEL_EVIDENCE',
        applicationContext: {
          kind: 'ENCOUNTER_TURN_RECHARGE',
          schemaVersion: 1,
          phase: 'START_OF_TURN',
          root: input.root,
          selectionChecksum: selection,
          completedExecutions: executions,
          currentCandidate: candidate,
          remainingCandidates: serializedCandidates.slice(ordinal + 1)
        }
      })
      return { kind: 'PENDING' as const, snapshot }
    }
    executions.push(completedExecution({ ordinal, result }))
    ordinal += 1
    return null
  }

  const first = serializedCandidates[ordinal]
  if (!first) throw new Error('Recharge evidence has no current candidate.')
  const initial = await settle(first, retained ? kernelContinuation(retained.snapshot) : undefined)
  if (initial) return initial
  while (ordinal < serializedCandidates.length) {
    const next = await settle(serializedCandidates[ordinal]!)
    if (next) return next
  }

  const plan: CompletedTurnRechargePlanDto = { selectionChecksum: selection, executions }
  return { kind: 'COMPLETE', plan, actors: applyRechargePlan(actors, plan) }
}
