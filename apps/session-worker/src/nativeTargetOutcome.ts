import type {
  ServerRuleExecutionContinuationDto,
  ServerRuleExecutionResultDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { requireActionContinuation } from '@artificer-toolkit/rules-runtime/encounterActionExecution'
import type { prepareEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { resolveEncounterActionPhaseExecution } from '@artificer-toolkit/rules-runtime/encounterActionPhaseExecution'
import type { CharacterRuleActionApplication } from '@artificer-toolkit/rules-runtime/characterRuleActionSystemAdapter'
import { deriveEncounterCharacterMechanicsEventCommandId } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import { resumeEncounterD20 } from '@artificer-toolkit/rules-runtime/encounterD20AddedDice'
import { actionResponse } from '@artificer-toolkit/rules-runtime/encounterD20Settlement'
import type {
  EncounterD20RollMode,
  EncounterEvidenceAnswer
} from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import { planEncounterMechanicsBatch } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import type { PreparedLiveCharacterSheet } from './nativeCharacterRules.js'
import { interpretForcedMovements } from './nativeEncounterActionInputs.js'

/** A won check's prepared action and the occurrence its outcome settles in. */
export type NativeTargetOutcomeSource = {
  prepared: Awaited<ReturnType<typeof prepareEncounterActionMechanics<PreparedLiveCharacterSheet>>>
  occurrenceId: string
  commandId: string
  occurredAt: string
  userId: string
}

/** The one mechanics batch a won check applies to its target (D152). */
export function planNativeTargetMechanics(
  input: NativeTargetOutcomeSource,
  applications: readonly CharacterRuleActionApplication[]
) {
  const { prepared } = input
  const holder = prepared.movementTargets.get(prepared.target.id)
  if (!holder) throw new Error('The action target is unavailable.')
  return planHolderMechanics({ ...input, state: prepared.state, holder }, applications)
}

/** The one mechanics batch a won check applies to its target's prepared holder, with or without a prepared action. */
export function planHolderMechanics(
  input: Omit<NativeTargetOutcomeSource, 'prepared'> & {
    state: { id: string; version: number }
    holder: NonNullable<ReturnType<NativeTargetOutcomeSource['prepared']['movementTargets']['get']>>
  },
  applications: readonly CharacterRuleActionApplication[]
) {
  const { holder, state, occurrenceId, commandId, occurredAt } = input
  return planEncounterMechanicsBatch({
    batch: {
      encounterId: state.id,
      targetActorId: holder.actor.id,
      expectedEncounterVersion: state.version,
      occurrenceId,
      sourceCommandId: commandId,
      commandId: deriveEncounterCharacterMechanicsEventCommandId({
        occurrenceId,
        sourceCommandId: commandId,
        phase: 'DIRECT_ACTION_OUTCOME',
        ordinal: 0,
        targetCharacterId: holder.characterFacts?.active.id ?? holder.actor.id
      }),
      occurredAt,
      applications: [...applications],
      expectedCharacterStreamVersion: holder.characterFacts?.active.play.streamVersion ?? null,
      effectiveMaximumHitPoints: holder.effectiveMaximumHitPoints,
      damageInterceptions: holder.damageInterceptions,
      effectiveScalarValues: holder.effectiveScalarValues,
      forceVersionAdvance: false
    },
    actor: holder.actor,
    userId: input.userId,
    ...(holder.characterFacts ? { characterFacts: holder.characterFacts } : {})
  })
}

/**
 * What a won check's outcome settles on its target, for a contest (Shove, D105) or a fixed-DC check
 * (D173): the sealed ON_CHECK_SUCCESS graph run on the prepared facts, its dice rolled by the roller
 * in the action roll window, every application in one mechanics batch here and in Convex, and its
 * forced movements landed on the Scene in the commit (D157). A roller who rolls their own dice
 * leaves the outcome PENDING on its paused continuation.
 */
export async function planNativeTargetOutcome(
  input: NativeTargetOutcomeSource & {
    /** The completed check TEST. */
    execution: ServerRuleExecutionResultDto
    /** The mode the check's d20 settled in, which an outcome path gate reads. */
    testRollMode: EncounterD20RollMode
    runtime: RulesRuntimeService
    autoRoll: boolean
    /** The roller's answer to the outcome's paused dice request, once given. */
    answered: {
      continuation: ServerRuleExecutionContinuationDto
      answer: EncounterEvidenceAnswer
    } | null
    random(maximum: number): number
  }
) {
  const { prepared, occurrenceId, runtime } = input
  const { adapter, plan, binding } = prepared
  if (plan.kind !== 'TEST_OUTCOME') throw new Error('The won outcome is unavailable.')
  const outcome = resolveEncounterActionPhaseExecution({
    plan,
    phase: 'TEST',
    execution: input.execution,
    adapter,
    facts: adapter.bindFacts({ ...binding, published: plan.test.published }).facts,
    testRollMode: input.testRollMode,
    effectivePath: 'ON_CHECK_SUCCESS'
  })
  if (outcome.kind !== 'OUTCOME') throw new Error('The won outcome is unavailable.')
  const { published } = outcome.outcome
  const { facts } = adapter.bindFacts({ ...binding, published })
  const answer = (
    continuation: ServerRuleExecutionContinuationDto,
    resolution: EncounterEvidenceAnswer
  ) => {
    const response = actionResponse({
      gameSystemId: published.gameSystemId,
      continuation,
      policy: null,
      resolution,
      random: input.random
    })
    return resumeEncounterD20({
      continuation,
      natural: response.value,
      addedDice: response.addedDice,
      resume: (step) => runtime.resume(step)
    })
  }
  if (input.answered)
    requireActionContinuation({
      continuation: input.answered.continuation,
      occurrenceId,
      published,
      facts
    })
  let execution = input.answered
    ? await answer(input.answered.continuation, input.answered.answer)
    : await runtime.executeResolved({
        command: { definitionId: published.id, occurrenceId, facts },
        published
      })
  while (execution.status === 'PAUSED') {
    if (!input.autoRoll) return { kind: 'PENDING' as const, continuation: execution.continuation }
    execution = await answer(execution.continuation, {
      kind: 'AUTO_ROLL',
      requestId: execution.continuation.request.requestId
    })
  }
  if (execution.status !== 'COMPLETE') throw new Error('The won outcome did not settle.')
  const applications = adapter.interpret({
    execution,
    occurrenceId,
    published,
    targetActorId: binding.targetActorId,
    currentHitPoints: binding.currentHitPoints,
    temporaryHitPoints: binding.temporaryHitPoints,
    maximumHitPoints: binding.maximumHitPoints,
    defenses: binding.defenses,
    conditionImmunityIds: binding.conditionImmunityIds,
    incomingHalved: binding.incomingHalved
  })
  const forcedMovements = interpretForcedMovements(prepared, {
    execution,
    occurrenceId,
    published,
    targetActorId: prepared.target.id
  })
  const mechanics = applications.length ? planNativeTargetMechanics(input, applications) : null
  return {
    kind: 'SETTLED' as const,
    actor: mechanics?.updatedActor ?? prepared.target,
    forcedMovements,
    stateTransition: {
      kind: 'TARGET_OUTCOME' as const,
      mechanics: mechanics && {
        targetTransition: mechanics.targetTransition,
        targetCharacterStreamVersion: mechanics.characterStreamVersion,
        applications: mechanics.receiptApplications
      },
      forcedMovements: forcedMovements.map(({ direction, feet, upTo }) => ({
        direction,
        feet,
        upTo
      }))
    }
  }
}
