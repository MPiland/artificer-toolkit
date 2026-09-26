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
import { concentrationOccurrenceId } from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import { endNativeConcentration, loadNativeConcentrationState } from './concentrationState'

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
