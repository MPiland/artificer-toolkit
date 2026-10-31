import type { CharacterRuleActionSystemAdapter } from './characterRuleActionSystemAdapter.js'
import type { NativeTwoPhase } from './encounterActionRequest.js'
import type { executeNativeActionGraphs } from './encounterActionExecution.js'
import type {
  ruleExecutionPhaseReceiptsDtoSchema,
  ServerCompletedRuleExecutionDto,
  ServerPublishedRuleDefinitionDto,
  ServerRuleExecutionD20EvidenceDto,
  ServerRuleExecutionNestedD20EvidenceDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import type { EncounterForcedMovementOfferDto } from '@artificer-toolkit/schema/shared/ruleExecutionForcedMovementChoice'
import type { z } from 'zod'

export type NativePhaseReceipts = z.infer<typeof ruleExecutionPhaseReceiptsDtoSchema>
type NativeOutcomePhase = Extract<NativeTwoPhase, { phase: 'OUTCOME' }>

export type CompleteNativeActionGraphs = Awaited<ReturnType<typeof executeNativeActionGraphs>> & {
  kind: 'COMPLETE'
}

export function actionComplete(input: {
  adapter: CharacterRuleActionSystemAdapter
  binding: Omit<Parameters<CharacterRuleActionSystemAdapter['bindFacts']>[0], 'published'>
  occurrenceId: string
  execution: ServerCompletedRuleExecutionDto
  published: ServerPublishedRuleDefinitionDto
  initialPublished: ServerPublishedRuleDefinitionDto
  initialFactsChecksum: string
  phaseReceipts: NativePhaseReceipts
  d20: ServerRuleExecutionD20EvidenceDto | null
  nestedD20: ServerRuleExecutionNestedD20EvidenceDto | null
  /** The OUTCOME phase with the decisions it was sealed against, which a later hold retains. */
  outcomePhase?: NativeOutcomePhase | null
}): CompleteNativeActionGraphs {
  return {
    kind: 'COMPLETE',
    execution: input.execution,
    published: input.published,
    initialPublished: input.initialPublished,
    initialFactsChecksum: input.initialFactsChecksum,
    phaseReceipts: input.phaseReceipts.length ? input.phaseReceipts : undefined,
    d20: input.d20,
    nestedD20: input.nestedD20,
    outcomePhase: input.outcomePhase ?? null,
    applications: input.adapter.interpret({
      execution: input.execution,
      occurrenceId: input.occurrenceId,
      published: input.published,
      targetActorId: input.binding.targetActorId,
      currentHitPoints: input.binding.currentHitPoints,
      temporaryHitPoints: input.binding.temporaryHitPoints,
      maximumHitPoints: input.binding.maximumHitPoints,
      defenses: input.binding.defenses,
      conditionImmunityIds: input.binding.conditionImmunityIds,
      incomingHalved: input.binding.incomingHalved
    })
  }
}

/**
 * The settled action a forced-movement destination pick held (D157), restored from its sealed
 * completion without running a graph again; its applications are derived from it as at completion.
 */
export function restoreHeldNativeActionCompletion(input: {
  adapter: CharacterRuleActionSystemAdapter
  binding: Omit<Parameters<CharacterRuleActionSystemAdapter['bindFacts']>[0], 'published'>
  occurrenceId: string
  offer: EncounterForcedMovementOfferDto
  outcomePhase: NativeTwoPhase | null
}): CompleteNativeActionGraphs {
  const { completion } = input.offer
  if (input.outcomePhase?.phase === 'TEST')
    throw new Error('A held action completion follows its OUTCOME.')
  return actionComplete({
    adapter: input.adapter,
    binding: input.binding,
    occurrenceId: input.occurrenceId,
    execution: completion.execution,
    published: completion.published,
    initialPublished: completion.initialPublished,
    initialFactsChecksum: completion.initialFactsChecksum,
    phaseReceipts: completion.phaseReceipts ?? [],
    d20: completion.d20,
    nestedD20: completion.nestedD20,
    outcomePhase: input.outcomePhase
  })
}
