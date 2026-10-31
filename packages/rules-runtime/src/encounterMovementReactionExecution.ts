import type { EncounterLegendaryResistanceCandidate } from './encounterLegendaryResistanceDiscovery.js'
import {
  advanceNativeActionGraphs,
  executeNativeActionGraphs,
  prepareNativeActionTest,
  continueNativeActionAfterTest,
  type EncounterActionAutoRoll
} from './encounterActionExecution.js'
import {
  resolveNativeMovementLegendaryResistance,
  replayNativeMovementLegendaryResistance,
  reconstructNativeMovementResistanceTest,
  nativeMovementResistanceResource
} from './encounterMovementLegendaryResistance.js'
import {
  requireEncounterMovementMaintenanceCurrentness,
  bindEncounterMovementMaintenancePending
} from './encounterMovementMaintenance.js'
import type { prepareEncounterMovementReactionAction } from './encounterMovementReactionPreparation.js'
import type { PreparedEncounterMovementReactionAction } from './encounterMovementReactionActionExecution.js'
import { bindMovementInterruption } from './encounterMovementReactionActionExecution.js'
import type { ServerKernelRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { EncounterAutoRollByActorId } from './encounterEvidenceMode.js'

type PreparedMovementReaction = Pick<
  Awaited<ReturnType<typeof prepareEncounterMovementReactionAction>>,
  'option' | 'prepared' | 'executionPlan' | 'action'
> & {
  maintenance: Parameters<typeof bindEncounterMovementMaintenancePending>[1]
}

type CompletedMovementReaction = Awaited<ReturnType<typeof executeNativeActionGraphs>> & {
  kind: 'COMPLETE'
  resistance?: Awaited<ReturnType<typeof resolveNativeMovementLegendaryResistance>> | null
}

type DiscoverResistance = (
  prepared: PreparedMovementReaction
) => Promise<EncounterLegendaryResistanceCandidate | null>

/** STOP authorization belongs to TEST; OUTCOME retains only its own execution evidence. */
export function bindEncounterMovementReactionInterruption(
  execution: CompletedMovementReaction['execution'],
  phaseReceipts: CompletedMovementReaction['phaseReceipts'],
  binding: PreparedEncounterMovementReactionAction['movementInterruption'],
  effectivePath?: string
): CompletedMovementReaction['execution'] {
  const first = phaseReceipts?.[0]
  const authorized = bindMovementInterruption({
    execution: first?.phase === 'TEST' ? first.execution : execution,
    binding
  })
  return {
    ...execution,
    movementInterruption:
      binding && effectivePath !== undefined
        ? effectivePath === binding.whenResultPath
          ? { kind: 'STOP' }
          : null
        : authorized.movementInterruption
  }
}

/** The reactor rolls its attack; the mover rolls its saves (ADR 0034 decision 3). */
function reactionAutoRoll(input: {
  autoRoll: EncounterAutoRollByActorId
  prepared: PreparedMovementReaction
}): EncounterActionAutoRoll {
  return {
    SOURCE: input.autoRoll[input.prepared.option.candidate.reactorActorId] === true,
    TARGET: input.autoRoll[input.prepared.prepared.binding.targetActorId] === true
  }
}

/** Runs or resumes sealed action phases; the enclosing movement owns publication. */
export async function executeEncounterMovementReactionAction(input: {
  runtime: Parameters<typeof executeNativeActionGraphs>[0]['runtime']
  occurrenceId: string
  autoRoll: EncounterAutoRollByActorId
  prepared: PreparedMovementReaction
  discoverResistance: DiscoverResistance
  random: NonNullable<Parameters<typeof executeNativeActionGraphs>[0]['random']>
  resume?: Parameters<typeof prepareNativeActionTest>[0]['resume']
}) {
  const executionInput = {
    runtime: input.runtime,
    adapter: input.prepared.prepared.adapter,
    plan: input.prepared.executionPlan,
    occurrenceId: input.occurrenceId,
    autoRoll: reactionAutoRoll(input),
    ...(input.resume ? { resume: input.resume } : {}),
    binding: input.prepared.prepared.binding,
    afterTest: async () => undefined,
    random: input.random
  }
  const { attackSight } = input.prepared.prepared
  let result
  let resistance: Awaited<ReturnType<typeof resolveNativeMovementLegendaryResistance>> | null = null
  if (
    input.prepared.executionPlan.kind === 'TEST_OUTCOME' &&
    input.resume?.pending.twoPhase?.phase !== 'OUTCOME'
  ) {
    const boundary = await prepareNativeActionTest({ ...executionInput, attackSight })
    if (boundary.kind === 'PENDING') return boundary
    const candidate =
      boundary.execution.outputs.resultPath === 'ON_SAVE_FAIL'
        ? await input.discoverResistance(input.prepared)
        : null
    if (candidate) return { kind: 'LEGENDARY_RESISTANCE' as const, boundary, candidate }
    result = await continueNativeActionAfterTest({
      ...executionInput,
      resume: undefined,
      boundary
    })
  } else {
    const phase = input.resume?.pending.twoPhase
    if (phase?.phase === 'OUTCOME' && phase.legendaryResistance) {
      const candidate = await input.discoverResistance(input.prepared)
      if (!candidate) throw new Error('The retained Legendary Resistance source is unavailable.')
      const boundary = await reconstructNativeMovementResistanceTest({
        ...input,
        execution: phase.testExecution,
        d20: phase.testRollEvidence
      })
      resistance = await replayNativeMovementLegendaryResistance({
        ...input,
        candidate,
        execution: boundary.execution,
        d20: boundary.d20,
        testD20Policy: boundary.d20Policy,
        audit: phase.legendaryResistance,
        currentFeatureResource: nativeMovementResistanceResource(input.prepared, candidate)
      })
      result = await continueNativeActionAfterTest({
        ...executionInput,
        boundary,
        legendaryResistance: resistance.audit,
        effectivePath: resistance.effectivePath
      })
    } else result = await advanceNativeActionGraphs({ ...executionInput, attackSight })
  }
  if (result.kind === 'PENDING') return result
  return {
    ...result,
    execution: bindEncounterMovementReactionInterruption(
      result.execution,
      result.phaseReceipts,
      input.prepared.action.movementInterruption,
      resistance?.effectivePath
    ),
    resistance
  }
}

export async function resumeEncounterMovementLegendaryResistance(input: {
  runtime: Parameters<typeof executeNativeActionGraphs>[0]['runtime']
  occurrenceId: string
  autoRoll: EncounterAutoRollByActorId
  prepared: PreparedMovementReaction
  discoverResistance: DiscoverResistance
  snapshot: ServerKernelRuleExecutionPendingSnapshotDto
  selection: Parameters<typeof resolveNativeMovementLegendaryResistance>[0]['selection']
  retainedExecution?: Awaited<ReturnType<typeof executeEncounterMovementReactionAction>>
  random: NonNullable<Parameters<typeof executeNativeActionGraphs>[0]['random']>
}) {
  requireEncounterMovementMaintenanceCurrentness(input.snapshot, input.prepared.maintenance)
  const context = input.snapshot.applicationContext
  if (
    context.kind !== 'ENCOUNTER_MOVEMENT_REACTION' ||
    context.phase.kind !== 'LEGENDARY_RESISTANCE_CHOICE'
  )
    throw new Error('The issued Legendary Resistance decision is unavailable.')
  const candidate = await input.discoverResistance(input.prepared)
  if (!candidate) throw new Error('The issued Legendary Resistance source is unavailable.')
  const boundary = await reconstructNativeMovementResistanceTest({
    ...input,
    execution: context.phase.originalExecution,
    d20: context.phase.originalD20
  })
  const resistance = await resolveNativeMovementLegendaryResistance({
    ...input,
    candidate,
    testD20Policy: boundary.d20Policy,
    currentFeatureResource: nativeMovementResistanceResource(input.prepared, candidate)
  })
  const retained = input.retainedExecution
  if (retained) {
    const phase =
      retained.kind === 'PENDING' && retained.twoPhase?.phase === 'OUTCOME'
        ? retained.twoPhase
        : null
    const original =
      retained.kind === 'COMPLETE' ? retained.phaseReceipts?.[0]?.execution : phase?.testExecution
    const dice = retained.kind === 'COMPLETE' ? retained.d20 : phase?.testRollEvidence
    const audit =
      retained.kind === 'COMPLETE' ? retained.resistance?.audit : phase?.legendaryResistance
    if (
      retained.kind === 'LEGENDARY_RESISTANCE' ||
      !original ||
      !dice ||
      !audit ||
      checksumRuleDocument(original) !== checksumRuleDocument(boundary.execution) ||
      checksumRuleDocument(audit) !== checksumRuleDocument(resistance.audit) ||
      dice.requestId !== boundary.d20.requestId ||
      dice.rollMode !== boundary.d20.rollMode ||
      dice.keep !== boundary.d20.keep ||
      dice.selectedNatural !== boundary.d20.selectedNatural ||
      checksumRuleDocument(dice.rawFaces) !== checksumRuleDocument(boundary.d20.rawFaces) ||
      (retained.kind === 'COMPLETE' &&
        checksumRuleDocument(retained.resistance) !== checksumRuleDocument(resistance))
    )
      throw new Error(
        'The retained Legendary Resistance outcome does not match the issued response.'
      )
    return retained
  }
  const result = await continueNativeActionAfterTest({
    ...input,
    autoRoll: reactionAutoRoll(input),
    adapter: input.prepared.prepared.adapter,
    binding: input.prepared.prepared.binding,
    plan: input.prepared.executionPlan,
    afterTest: async () => undefined,
    random: input.random,
    boundary,
    legendaryResistance: resistance.audit,
    effectivePath: resistance.effectivePath
  })
  if (result.kind === 'PENDING') return result
  return {
    ...result,
    execution: bindEncounterMovementReactionInterruption(
      result.execution,
      result.phaseReceipts,
      input.prepared.action.movementInterruption,
      resistance.effectivePath
    ),
    resistance
  }
}
