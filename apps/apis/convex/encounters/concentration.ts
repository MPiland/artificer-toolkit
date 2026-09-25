import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ServerRuleExecutionContinuationDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { MutationCtx } from '../_generated/server'
import { createRulesRuntime } from '../rules/runtime'
import { nextRollInt } from '../lib/rollRandom'
import {
  createNativeConcentrationContext,
  completeNativeConcentrationResult,
  evaluateNativeConcentrationEvidence,
  type NativeConcentrationContext
} from '@artificer-toolkit/rules-runtime/encounterConcentration'
import type { EncounterEvidenceAnswer } from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import {
  concentrationCommandId,
  concentrationOccurrenceId
} from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import { endNativeConcentration, loadNativeConcentrationState } from './concentrationState'
import {
  persistNativeConcentrationPending,
  persistNativeConcentrationResult
} from './actionChildPersistence'

/** Completes one sealed child. The caller owns publication and any Encounter version advance. */
export async function executeNativeConcentrationCheck(
  ctx: MutationCtx,
  input: {
    state: EncounterRunState
    actors: EncounterRunActorState[]
    current: NonNullable<Awaited<ReturnType<typeof loadNativeConcentrationState>>>
    context: NativeConcentrationContext
    continuation: ServerRuleExecutionContinuationDto
    resolution: Exclude<EncounterEvidenceAnswer, { kind: 'ENTER_INTEGER' }>
    occurrenceVersion: number
    userId: string
    occurredAt: string
  }
) {
  const { context, continuation, resolution } = input
  const { execution, rawFaces, rollMode, selectedNatural, failed } =
    await evaluateNativeConcentrationEvidence({
      context,
      continuation,
      resolution,
      expectedOccurrenceId: concentrationOccurrenceId(
        context.parentOccurrenceId,
        context.application
      ),
      runtime: await createRulesRuntime(ctx, input.userId),
      random: nextRollInt
    })
  const ended = failed
    ? await endNativeConcentration(ctx, {
        state: input.state,
        context,
        actors: input.actors,
        occurredAt: input.occurredAt
      })
    : null
  const rebuilt = createNativeConcentrationContext({ current: input.current, ...context })
  const result = completeNativeConcentrationResult({
    context,
    continuation,
    execution,
    rawFaces,
    rollMode,
    selectedNatural,
    failed,
    cleanup: ended?.cleanup ?? null,
    occurrenceVersion: input.occurrenceVersion,
    initialFactsChecksum: checksumRuleDocument(rebuilt.facts)
  })
  return { result, actors: ended?.actors ?? input.actors, failed, selectedNatural }
}

type BoundConcentrationApplication = NativeConcentrationContext['application'] & {
  maintainedStateId: string
}

/**
 * Settles each remaining check of one damage chain whose roller auto-rolls, stopping at the first
 * that prompts (ADR 0034 decision 3, D23). It writes only concentration cleanup; the caller persists
 * the chain once it knows the transaction's final Encounter state.
 */
export async function planNativeConcentrationChain(
  ctx: MutationCtx,
  input: {
    /** The state the checks read; the stored Run is still at `readVersion`. */
    state: EncounterRunState
    readVersion: number
    actors: EncounterRunActorState[]
    parentOccurrenceId: string
    parentCommandFingerprint: string
    finalizedDamageEnvelopeChecksum: string
    sourceLabels: NativeConcentrationContext['sourceLabels']
    remaining: readonly BoundConcentrationApplication[]
    /** The occurrence the first settled check correlates to. */
    correlationId: string
    /** Reads definitions; Encounter rules read as the Campaign owner. */
    userId: string
    /** Each concentrating actor's roller preference (ADR 0034 decision 3). */
    autoRollByActorId: Readonly<Record<string, boolean>>
    occurredAt: string
  }
) {
  let remaining = [...input.remaining]
  let actors = input.actors
  let correlationId = input.correlationId
  let failed = false
  const completed: Array<{
    result: Awaited<ReturnType<typeof executeNativeConcentrationCheck>>['result']
    commandId: string
    correlationId: string
    fingerprint: string
    definitionId: string
    factsChecksum: string
  }> = []
  if (!remaining.length) return { actors, completed, failed, pending: null }
  const runtime = await createRulesRuntime(ctx, input.userId)
  while (remaining.length) {
    const { maintainedStateId, ...application } = remaining[0]!
    remaining = remaining.slice(1)
    const current = await loadNativeConcentrationState(ctx, {
      state: input.state,
      readVersion: input.readVersion,
      userId: input.userId,
      targetActorId: application.targetActorId
    })
    if (!current || current.maintained.id !== maintainedStateId)
      throw new Error('The concentration state changed before its check.')
    const { context, facts } = createNativeConcentrationContext({
      current,
      parentOccurrenceId: input.parentOccurrenceId,
      parentCommandFingerprint: input.parentCommandFingerprint,
      application,
      finalizedDamageEnvelopeChecksum: input.finalizedDamageEnvelopeChecksum,
      sourceLabels: input.sourceLabels,
      remaining
    })
    const occurrenceId = concentrationOccurrenceId(input.parentOccurrenceId, application)
    const execution = await runtime.executeResolved({
      command: { definitionId: current.published.id, occurrenceId, facts },
      published: current.published
    })
    if (execution.status !== 'PAUSED')
      throw new Error('Concentration did not request bounded d20 evidence.')
    if (!input.autoRollByActorId[application.targetActorId])
      return {
        actors,
        completed,
        failed,
        pending: { context, continuation: execution.continuation }
      }
    const check = await executeNativeConcentrationCheck(ctx, {
      state: input.state,
      actors,
      current,
      context,
      continuation: execution.continuation,
      occurrenceVersion: 1,
      resolution: { kind: 'AUTO_ROLL', requestId: execution.continuation.request.requestId },
      userId: input.userId,
      occurredAt: input.occurredAt
    })
    completed.push({
      result: check.result,
      commandId: concentrationCommandId(occurrenceId),
      correlationId,
      fingerprint: checksumRuleDocument({
        parentOccurrenceId: input.parentOccurrenceId,
        application,
        contextChecksum: context.contextChecksum
      }),
      definitionId: current.published.id,
      factsChecksum: checksumRuleDocument(facts)
    })
    actors = check.actors
    correlationId = occurrenceId
    if (check.failed) {
      failed = true
      remaining = remaining.filter((entry) => entry.maintainedStateId !== maintainedStateId)
    }
  }
  return { actors, completed, failed, pending: null }
}

/** Persists a planned chain's receipts and next decision against the final Encounter state. */
export async function persistNativeConcentrationChain(
  ctx: MutationCtx,
  input: {
    state: EncounterRunState
    chain: Awaited<ReturnType<typeof planNativeConcentrationChain>>
    userId: string
    occurredAt: string
    deferredCleaving?: Parameters<typeof persistNativeConcentrationPending>[1]['deferredCleaving']
  }
) {
  const { state, chain } = input
  for (const { definitionId, factsChecksum, ...check } of chain.completed)
    await persistNativeConcentrationResult(ctx, {
      ...check,
      state,
      userId: input.userId,
      occurredAt: input.occurredAt,
      metadata: {
        schemaVersion: 1,
        transition: 'START',
        definitionId,
        expectedAggregateVersion: state.version,
        factsChecksum,
        optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
      }
    })
  if (chain.pending)
    await persistNativeConcentrationPending(ctx, {
      state,
      context: chain.pending.context,
      continuation: chain.pending.continuation,
      deferredCleaving: input.deferredCleaving,
      occurredAt: input.occurredAt
    })
}

/** Parent damage is finalized before these receipt-only children start. */
export async function startNativeConcentrationChecks(
  ctx: MutationCtx,
  input: {
    /** The parent's final Encounter state; the stored Run is still at `readVersion`. */
    state: EncounterRunState
    readVersion: number
    actors: EncounterRunActorState[]
    parentOccurrenceId: string
    parentCommandFingerprint: string
    applications: readonly NativeConcentrationContext['application'][]
    sourceLabels: NativeConcentrationContext['sourceLabels']
    /** Reads definitions; Encounter rules read as the Campaign owner. */
    userId: string
    /** Each concentrating actor's roller preference (ADR 0034 decision 3). */
    autoRollByActorId: Readonly<Record<string, boolean>>
    occurredAt: string
  }
) {
  const applications = input.applications
  if (!applications.length || input.state.automationMode === 'MANUAL')
    return { actors: input.actors, pending: false }
  const bindings = new Map<string, string>()
  for (const targetActorId of new Set(applications.map((entry) => entry.targetActorId))) {
    const current = await loadNativeConcentrationState(ctx, { ...input, targetActorId })
    if (current) bindings.set(targetActorId, current.maintained.id)
  }
  const chain = await planNativeConcentrationChain(ctx, {
    ...input,
    finalizedDamageEnvelopeChecksum: checksumRuleDocument(applications),
    remaining: applications.flatMap((application) => {
      const maintainedStateId = bindings.get(application.targetActorId)
      return maintainedStateId ? [{ ...application, maintainedStateId }] : []
    }),
    correlationId: input.parentOccurrenceId
  })
  await persistNativeConcentrationChain(ctx, { ...input, chain })
  return { actors: chain.actors, pending: chain.pending !== null }
}
