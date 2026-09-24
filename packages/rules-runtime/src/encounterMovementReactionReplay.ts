import {
  advanceNativeActionGraphs,
  continueNativeActionAfterTest,
  type NativeActionEvidenceResolution,
  type PendingNativeActionGraphs
} from './encounterActionExecution.js'
import {
  bindEncounterMovementReactionInterruption,
  type executeEncounterMovementReactionAction
} from './encounterMovementReactionExecution.js'
import {
  reconstructNativeMovementResistanceTest,
  nativeMovementResistanceResource,
  replayNativeMovementLegendaryResistance,
  retainNativeMovementLegendaryResistance
} from './encounterMovementLegendaryResistance.js'
import type { EncounterLegendaryResistanceCandidate } from './encounterLegendaryResistanceDiscovery.js'
import type { prepareEncounterMovementReactionAction } from './encounterMovementReactionPreparation.js'
import { createEncounterLegendaryResistancePhase } from './encounterMovementReactionContinuation.js'
import { selectEncounterActionD20Natural } from './encounterMovementReactionActionExecution.js'
import {
  requireEncounterMovementMaintenanceCurrentness,
  bindEncounterMovementMaintenancePending
} from './encounterMovementMaintenance.js'
import {
  type ServerKernelRuleExecutionPendingSnapshotDto,
  type ServerRuleExecutionD20EvidenceDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { movementReactionActionExecutionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionMovementReactionReceipts'
import { checksumRuleDocument, RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules'
import type { z } from 'zod'

type PreparedMovementReaction = Pick<
  Awaited<ReturnType<typeof prepareEncounterMovementReactionAction>>,
  'option' | 'prepared' | 'executionPlan' | 'action'
> & {
  maintenance: Parameters<typeof bindEncounterMovementMaintenancePending>[1]
}

type MovementReactionActionExecutionDto = z.infer<typeof movementReactionActionExecutionDtoSchema>
type ReplayResult = Awaited<ReturnType<typeof advanceNativeActionGraphs>>
type RetainedD20Evidence = Pick<
  ServerRuleExecutionD20EvidenceDto,
  'requestId' | 'rollMode' | 'rawFaces' | 'selectedNatural'
>

function same(left: unknown, right: unknown) {
  return checksumRuleDocument(left) === checksumRuleDocument(right)
}

function requireActionEvidenceSnapshot(input: {
  occurrenceId: string
  prepared: PreparedMovementReaction
  snapshot: ServerKernelRuleExecutionPendingSnapshotDto
}) {
  const context = input.snapshot.applicationContext
  if (
    input.snapshot.occurrenceId !== input.occurrenceId ||
    context.kind !== 'ENCOUNTER_MOVEMENT_REACTION' ||
    context.phase.kind !== 'ACTION_EVIDENCE' ||
    context.phase.selectedOptionId !== input.prepared.option.optionId
  )
    throw new Error('The retained movement reaction action evidence is stale.')
  return context.phase
}

function retainedIntegerEvidence(input: {
  snapshot?: ServerKernelRuleExecutionPendingSnapshotDto
  receipt?: MovementReactionActionExecutionDto
}) {
  const traces = [
    ...(input.snapshot?.phaseReceipts?.map((receipt) => receipt.execution.evidence.trace) ?? []),
    ...(input.snapshot ? [input.snapshot.trace] : []),
    ...(input.receipt?.phaseReceipts?.map((receipt) => receipt.execution.evidence.trace) ?? []),
    ...(input.receipt ? [input.receipt.execution.evidence.trace] : [])
  ]
  const values = new Map<string, number>()
  for (const trace of traces.flat()) {
    const evidence = trace.evidence
    if (!evidence || !Number.isSafeInteger(evidence.value)) continue
    const prior = values.get(evidence.requestId)
    if (prior !== undefined && prior !== evidence.value)
      throw new Error('The retained movement reaction evidence is inconsistent.')
    values.set(evidence.requestId, evidence.value)
  }
  return values
}

function retainedD20Evidence(input: {
  snapshot?: ServerKernelRuleExecutionPendingSnapshotDto
  receipt?: MovementReactionActionExecutionDto
}) {
  const context = input.snapshot?.applicationContext
  const pending =
    context?.kind === 'ENCOUNTER_MOVEMENT_REACTION' && context.phase.kind === 'ACTION_EVIDENCE'
      ? context.phase.twoPhase
      : undefined
  const retained = retainedReceiptD20(input.receipt)
  const evidence = [
    ...(pending?.phase === 'OUTCOME'
      ? [
          {
            requestId: pending.testRollEvidence.requestId,
            rawFaces: pending.testRollEvidence.rawFaces,
            rollMode: pending.testRollEvidence.rollMode,
            selectedNatural: pending.testRollEvidence.selectedNatural
          }
        ]
      : []),
    ...(pending?.phase === 'OUTCOME' && pending.nestedOutcomeD20Evidence
      ? [pending.nestedOutcomeD20Evidence]
      : []),
    ...(retained.d20 ? [retained.d20] : []),
    ...(retained.nestedD20 ? [retained.nestedD20] : [])
  ]
  const values = new Map<string, RetainedD20Evidence>()
  for (const entry of evidence) {
    const prior = values.get(entry.requestId)
    if (prior && !same(prior, entry))
      throw new Error('The retained movement reaction d20 evidence is inconsistent.')
    values.set(entry.requestId, entry)
  }
  return values
}

function retainedReceiptD20(receipt: MovementReactionActionExecutionDto | undefined) {
  const application = receipt?.application
  if (
    !application ||
    (application.kind !== 'CHARACTER_MECHANICS_BATCH' &&
      application.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH')
  )
    return { d20: null, nestedD20: null }
  return { d20: application.d20, nestedD20: application.nestedD20 }
}

function resolutionForRetainedEvidence(input: {
  pending: PendingNativeActionGraphs
  integers: ReadonlyMap<string, number>
  d20: ReadonlyMap<string, RetainedD20Evidence>
  used: Set<string>
}): NativeActionEvidenceResolution {
  const { request } = input.pending.continuation
  if (request.kind !== 'INTEGER_RANGE')
    throw new Error('The action requested unsupported evidence.')
  if (input.pending.d20Policy) {
    const evidence = input.d20.get(request.requestId)
    if (
      !evidence ||
      evidence.rollMode !== input.pending.d20Policy.rollMode ||
      selectEncounterActionD20Natural(evidence.rollMode, evidence.rawFaces) !==
        evidence.selectedNatural
    )
      throw new Error('The retained movement reaction d20 evidence is stale.')
    input.used.add(request.requestId)
    return {
      kind: 'ENTER_DICE',
      requestId: request.requestId,
      rawFaces: evidence.rawFaces
    }
  }
  const value = input.integers.get(request.requestId)
  if (value === undefined || value < request.min || value > request.max)
    throw new Error('The retained movement reaction integer evidence is stale.')
  input.used.add(request.requestId)
  return { kind: 'ENTER_INTEGER', requestId: request.requestId, value }
}

function sameContinuation(
  actual: PendingNativeActionGraphs['continuation'],
  snapshot: ServerKernelRuleExecutionPendingSnapshotDto
) {
  const {
    snapshotKind: _snapshotKind,
    optionalCombatSnapshotChecksum: _optionalCombatSnapshotChecksum,
    applicationContext: _applicationContext,
    phaseReceipts: _phaseReceipts,
    ...continuation
  } = snapshot
  return same(actual, continuation)
}

function requirePendingMatch(input: {
  actual: Extract<ReplayResult, { kind: 'PENDING' }>
  snapshot: ServerKernelRuleExecutionPendingSnapshotDto
  phase: ReturnType<typeof requireActionEvidenceSnapshot>
}) {
  if (
    !sameContinuation(input.actual.continuation, input.snapshot) ||
    !same(input.actual.d20Policy, input.phase.d20Policy) ||
    !same(input.actual.twoPhase, input.phase.twoPhase ?? null) ||
    !same(input.actual.phaseReceipts ?? null, input.snapshot.phaseReceipts ?? null)
  )
    throw new Error('The retained movement reaction pending evidence is stale.')
}

function requireCompleteMatch(input: {
  actual: Extract<ReplayResult, { kind: 'COMPLETE' }>
  receipt: MovementReactionActionExecutionDto
}) {
  const retained = retainedReceiptD20(input.receipt)
  if (
    input.actual.initialFactsChecksum !== input.receipt.initialFactsChecksum ||
    !same(input.actual.execution, input.receipt.execution) ||
    !same(input.actual.phaseReceipts ?? null, input.receipt.phaseReceipts ?? null) ||
    !same(input.actual.d20, retained.d20) ||
    !same(input.actual.nestedD20, retained.nestedD20)
  )
    throw new Error('The retained movement reaction completion evidence is stale.')
}

/** Replays retained movement action evidence against current prepared facts without persistence or rolls. */
export async function replayEncounterMovementReactionAction(input: {
  discoverResistance?: (
    prepared: PreparedMovementReaction
  ) => Promise<EncounterLegendaryResistanceCandidate | null>
  runtime: Parameters<typeof advanceNativeActionGraphs>[0]['runtime']
  occurrenceId: string
  prepared: PreparedMovementReaction
  issuedSnapshot?: ServerKernelRuleExecutionPendingSnapshotDto
  retained:
    | { kind: 'PENDING'; snapshot: ServerKernelRuleExecutionPendingSnapshotDto }
    | { kind: 'COMPLETE'; receipt: MovementReactionActionExecutionDto }
}): Promise<Awaited<ReturnType<typeof executeEncounterMovementReactionAction>>> {
  const snapshot = input.retained.kind === 'PENDING' ? input.retained.snapshot : undefined
  if (snapshot) requireEncounterMovementMaintenanceCurrentness(snapshot, input.prepared.maintenance)
  const receipt = input.retained.kind === 'COMPLETE' ? input.retained.receipt : undefined
  const context = snapshot?.applicationContext
  if (
    receipt?.legendaryResistance ||
    (context?.kind === 'ENCOUNTER_MOVEMENT_REACTION' &&
      (context.phase.kind === 'LEGENDARY_RESISTANCE_CHOICE' ||
        (context.phase.kind === 'ACTION_EVIDENCE' &&
          context.phase.twoPhase?.phase === 'OUTCOME' &&
          context.phase.twoPhase.legendaryResistance)))
  ) {
    if (input.issuedSnapshot) {
      const issued = await replayEncounterMovementReactionAction({
        ...input,
        issuedSnapshot: undefined,
        retained: { kind: 'PENDING', snapshot: input.issuedSnapshot }
      })
      if (issued.kind !== 'PENDING') throw new Error('The issued action is already complete.')
    }
    return replayResistanceAction(input)
  }
  const issuedPhase = input.issuedSnapshot
    ? requireActionEvidenceSnapshot({ ...input, snapshot: input.issuedSnapshot })
    : undefined
  if (input.issuedSnapshot)
    requireEncounterMovementMaintenanceCurrentness(input.issuedSnapshot, input.prepared.maintenance)
  let issuedChecked = input.issuedSnapshot === undefined
  const phase = snapshot
    ? requireActionEvidenceSnapshot({
        occurrenceId: input.occurrenceId,
        prepared: input.prepared,
        snapshot
      })
    : undefined
  if (receipt && !same(receipt.option, input.prepared.option))
    throw new Error('The retained movement reaction option is stale.')
  const integers = retainedIntegerEvidence({ snapshot, receipt })
  const d20 = retainedD20Evidence({ snapshot, receipt })
  const used = new Set<string>()
  let result = await advanceNativeActionGraphs({
    runtime: input.runtime,
    adapter: input.prepared.prepared.adapter,
    plan: input.prepared.executionPlan,
    occurrenceId: input.occurrenceId,
    automationMode: 'ASSISTED',
    binding: input.prepared.prepared.binding,
    afterTest: async () => undefined
  })
  for (let count = 0; result.kind === 'PENDING'; count++) {
    if (count >= RULE_GRAPH_LIMITS.NODES)
      throw new Error('The retained movement reaction evidence is invalid.')
    if (
      !issuedChecked &&
      input.issuedSnapshot &&
      result.continuation.request.requestId === input.issuedSnapshot.request.requestId
    ) {
      requirePendingMatch({ actual: result, snapshot: input.issuedSnapshot, phase: issuedPhase! })
      const issuedEvidence = { snapshot: input.issuedSnapshot }
      if (
        [
          ...retainedIntegerEvidence(issuedEvidence).keys(),
          ...retainedD20Evidence(issuedEvidence).keys()
        ].some((requestId) => !used.has(requestId))
      )
        throw new Error('The retained movement reaction evidence has unused requests.')
      issuedChecked = true
    }
    if (snapshot && result.continuation.request.requestId === snapshot.request.requestId) break
    const resolution = resolutionForRetainedEvidence({
      pending: result,
      integers,
      d20,
      used
    })
    result = await advanceNativeActionGraphs({
      runtime: input.runtime,
      adapter: input.prepared.prepared.adapter,
      plan: input.prepared.executionPlan,
      occurrenceId: input.occurrenceId,
      automationMode: 'ASSISTED',
      binding: input.prepared.prepared.binding,
      afterTest: async () => undefined,
      resume: { pending: result, resolution }
    })
  }
  if (!issuedChecked) throw new Error('The retained movement reaction pending evidence is stale.')
  if (snapshot) {
    if (result.kind !== 'PENDING')
      throw new Error('The retained movement reaction pending evidence is stale.')
    requirePendingMatch({ actual: result, snapshot, phase: phase! })
    if ([...integers.keys(), ...d20.keys()].some((requestId) => !used.has(requestId)))
      throw new Error('The retained movement reaction evidence has unused requests.')
    return result
  }
  if (result.kind !== 'COMPLETE' || !receipt)
    throw new Error('The retained movement reaction completion evidence is stale.')
  const bound = bindEncounterMovementReactionInterruption(
    result.execution,
    result.phaseReceipts,
    input.prepared.action.movementInterruption
  )
  const replayed = { ...result, execution: bound, resistance: null }
  requireCompleteMatch({ actual: replayed, receipt })
  if ([...integers.keys(), ...d20.keys()].some((requestId) => !used.has(requestId)))
    throw new Error('The retained movement reaction evidence has unused requests.')
  return replayed
}

async function replayResistanceAction(
  input: Parameters<typeof replayEncounterMovementReactionAction>[0]
): Promise<Awaited<ReturnType<typeof executeEncounterMovementReactionAction>>> {
  if (!input.discoverResistance)
    throw new Error('Legendary Resistance replay requires current native authority.')
  const candidate = await input.discoverResistance(input.prepared)
  if (!candidate) throw new Error('The retained Legendary Resistance source is unavailable.')
  const snapshot = input.retained.kind === 'PENDING' ? input.retained.snapshot : undefined
  const receipt = input.retained.kind === 'COMPLETE' ? input.retained.receipt : undefined
  if (receipt && !same(receipt.option, input.prepared.option))
    throw new Error('The retained movement reaction option is stale.')
  const context = snapshot?.applicationContext
  const phase = context?.kind === 'ENCOUNTER_MOVEMENT_REACTION' ? context.phase : undefined
  const outcome =
    phase?.kind === 'ACTION_EVIDENCE' && phase.twoPhase?.phase === 'OUTCOME'
      ? phase.twoPhase
      : undefined
  const application = receipt?.application
  const completed =
    application?.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
      ? application.legendaryResistance
      : undefined
  const original =
    phase?.kind === 'LEGENDARY_RESISTANCE_CHOICE'
      ? { execution: phase.originalExecution, d20: phase.originalD20 }
      : outcome
        ? { execution: outcome.testExecution, d20: outcome.testRollEvidence }
        : completed
          ? {
              execution: completed.originalExecution,
              d20: completed.originalD20
            }
          : null
  if (!original) throw new Error('The retained Legendary Resistance TEST is unavailable.')
  const boundary = await reconstructNativeMovementResistanceTest({
    ...input,
    ...original
  })
  if (
    snapshot &&
    context?.kind === 'ENCOUNTER_MOVEMENT_REACTION' &&
    phase?.kind === 'LEGENDARY_RESISTANCE_CHOICE'
  ) {
    const expected = await retainNativeMovementLegendaryResistance({
      ...input,
      candidate,
      execution: boundary.execution,
      d20: boundary.d20,
      context: {
        ...context,
        phase: {
          kind: 'ACTION_EVIDENCE',
          selectedOptionId: input.prepared.option.optionId,
          d20Policy: boundary.d20Policy,
          twoPhase: boundary.twoPhase
        }
      }
    })
    if (
      !same(snapshot, {
        ...expected,
        ...(snapshot.optionalCombatSnapshotChecksum === undefined
          ? {}
          : {
              optionalCombatSnapshotChecksum: snapshot.optionalCombatSnapshotChecksum
            })
      })
    )
      throw new Error('The retained Legendary Resistance choice is stale.')
    return { kind: 'LEGENDARY_RESISTANCE', boundary, candidate }
  }
  const canonicalPhase = createEncounterLegendaryResistancePhase({
    selectedOptionId: input.prepared.option.optionId,
    candidate,
    execution: boundary.execution,
    d20: boundary.d20,
    targetStateChecksum: checksumRuleDocument(input.prepared.action.target)
  })
  const audit =
    outcome?.legendaryResistance ??
    (completed
      ? {
          choiceExecution: completed.execution,
          selection: completed.use ? ('USE' as const) : ('DECLINE' as const),
          originalExecutionChecksum: canonicalPhase.originalExecutionChecksum,
          targetStateChecksum: canonicalPhase.targetStateChecksum,
          resistance: canonicalPhase.resistance,
          d20: boundary.d20Policy
        }
      : null)
  if (!audit) throw new Error('The retained Legendary Resistance choice audit is unavailable.')
  const resistance = await replayNativeMovementLegendaryResistance({
    ...input,
    candidate,
    execution: boundary.execution,
    d20: boundary.d20,
    testD20Policy: boundary.d20Policy,
    audit,
    currentFeatureResource: nativeMovementResistanceResource(input.prepared, candidate)
  })
  if (receipt && !same(receipt.legendaryResistance, resistance.legendaryResistance))
    throw new Error('The retained Legendary Resistance receipt is stale.')
  const source = {
    runtime: input.runtime,
    adapter: input.prepared.prepared.adapter,
    plan: input.prepared.executionPlan,
    occurrenceId: input.occurrenceId,
    automationMode: 'ASSISTED' as const,
    binding: input.prepared.prepared.binding,
    afterTest: async () => undefined,
    boundary,
    legendaryResistance: resistance.audit,
    effectivePath: resistance.effectivePath,
    random: () => {
      throw new Error('Retained OUTCOME evidence must not roll again.')
    }
  }
  const integers = retainedIntegerEvidence({ snapshot, receipt })
  const d20 = retainedD20Evidence({ snapshot, receipt })
  const used = new Set([boundary.d20.requestId])
  let result = await continueNativeActionAfterTest(source)
  for (let count = 0; result.kind === 'PENDING'; count++) {
    if (count >= RULE_GRAPH_LIMITS.NODES)
      throw new Error('The retained action evidence is invalid.')
    if (snapshot && result.continuation.request.requestId === snapshot.request.requestId) break
    const resolution = resolutionForRetainedEvidence({
      pending: result,
      integers,
      d20,
      used
    })
    result = await continueNativeActionAfterTest({
      ...source,
      resume: { pending: result, resolution }
    })
  }
  if ([...integers.keys(), ...d20.keys()].some((requestId) => !used.has(requestId)))
    throw new Error('The retained movement reaction evidence has unused requests.')
  if (snapshot) {
    if (result.kind !== 'PENDING') throw new Error('The retained action evidence is stale.')
    requirePendingMatch({
      actual: result,
      snapshot,
      phase: requireActionEvidenceSnapshot({ ...input, snapshot })
    })
    return result
  }
  if (result.kind !== 'COMPLETE' || !receipt)
    throw new Error('The retained action completion is stale.')
  const replayed = {
    ...result,
    execution: bindEncounterMovementReactionInterruption(
      result.execution,
      result.phaseReceipts,
      input.prepared.action.movementInterruption,
      resistance.effectivePath
    ),
    resistance
  }
  requireCompleteMatch({ actual: replayed, receipt })
  return replayed
}
