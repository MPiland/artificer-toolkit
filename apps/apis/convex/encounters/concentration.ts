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

/** Parent damage is finalized before these receipt-only children start. */
export async function startNativeConcentrationChecks(
  ctx: MutationCtx,
  input: {
    state: EncounterRunState
    readVersion: number
    actors: EncounterRunActorState[]
    parentOccurrenceId: string
    parentCommandFingerprint: string
    applications: readonly NativeConcentrationContext['application'][]
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
  let remaining = applications.flatMap((application) => {
    const maintainedStateId = bindings.get(application.targetActorId)
    return maintainedStateId ? [{ ...application, maintainedStateId }] : []
  })
  let actors = input.actors
  if (!remaining.length) return { actors, pending: false }
  let correlationId = input.parentOccurrenceId
  const envelope = checksumRuleDocument(applications)
  const runtime = await createRulesRuntime(ctx, input.userId)
  while (remaining.length) {
    const { maintainedStateId, ...application } = remaining[0]!
    remaining = remaining.slice(1)
    const current = await loadNativeConcentrationState(ctx, {
      ...input,
      targetActorId: application.targetActorId
    })
    if (!current || current.maintained.id !== maintainedStateId)
      throw new Error('The concentration state changed before its check.')
    const { context, facts } = createNativeConcentrationContext({
      current,
      parentOccurrenceId: input.parentOccurrenceId,
      parentCommandFingerprint: input.parentCommandFingerprint,
      application,
      finalizedDamageEnvelopeChecksum: envelope,
      remaining
    })
    const occurrenceId = concentrationOccurrenceId(input.parentOccurrenceId, application)
    const execution = await runtime.executeResolved({
      command: { definitionId: current.published.id, occurrenceId, facts },
      published: current.published
    })
    if (execution.status !== 'PAUSED')
      throw new Error('Concentration did not request bounded d20 evidence.')
    if (!input.autoRollByActorId[application.targetActorId]) {
      await persistNativeConcentrationPending(ctx, {
        state: input.state,
        context,
        continuation: execution.continuation,
        occurredAt: input.occurredAt
      })
      return { actors, pending: true }
    }
    const completed = await executeNativeConcentrationCheck(ctx, {
      ...input,
      actors,
      current,
      context,
      continuation: execution.continuation,
      occurrenceVersion: 1,
      resolution: { kind: 'AUTO_ROLL', requestId: execution.continuation.request.requestId }
    })
    await persistNativeConcentrationResult(ctx, {
      ...input,
      result: completed.result,
      commandId: concentrationCommandId(occurrenceId),
      correlationId,
      fingerprint: checksumRuleDocument({
        parentOccurrenceId: input.parentOccurrenceId,
        application,
        contextChecksum: context.contextChecksum
      }),
      metadata: {
        schemaVersion: 1,
        transition: 'START',
        definitionId: current.published.id,
        expectedAggregateVersion: input.state.version,
        factsChecksum: checksumRuleDocument(facts),
        optionalCombatSnapshotChecksum: input.state.optionalCombatSnapshotChecksum
      }
    })
    actors = completed.actors
    correlationId = occurrenceId
    if (completed.failed)
      remaining = remaining.filter((entry) => entry.maintainedStateId !== maintainedStateId)
  }
  return { actors, pending: false }
}
