import type { directActionTwoPhaseDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionDirectActionPendingContexts'
import type {
  ServerRuleExecutionContinuationDto,
  ServerRuleExecutionD20PolicyDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import type { ServerPublishedRuleDefinitionDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { z } from 'zod'

import type { CharacterRuleActionSystemAdapter } from './characterRuleActionSystemAdapter.js'
import { deriveEncounterActionD20Policy } from './encounterMovementReactionActionExecution.js'

export type NativeTwoPhase = z.infer<typeof directActionTwoPhaseDtoSchema>

/** Whose roll a paused action request is: the acting source's or its target's (a save). */
export type EncounterActionRoller = 'SOURCE' | 'TARGET'

/** Refuses a stored continuation that no longer matches its occurrence, graph or bound facts. */
export function requireActionContinuation(input: {
  continuation: ServerRuleExecutionContinuationDto
  occurrenceId: string
  published: ServerPublishedRuleDefinitionDto
  facts: Readonly<Record<string, unknown>>
}) {
  if (
    input.continuation.occurrenceId !== input.occurrenceId ||
    input.continuation.graph.source.definitionId !== input.published.id ||
    input.continuation.graph.source.checksum !== input.published.checksum ||
    Object.entries(input.continuation.facts).some(
      ([key, value]) => checksumRuleDocument(value) !== checksumRuleDocument(input.facts[key])
    )
  )
    throw new Error('The action evidence continuation is stale.')
}

export function actionD20Policy(input: {
  phase: 'SINGLE' | 'TEST' | 'OUTCOME'
  continuation: ServerRuleExecutionContinuationDto
  bound: ReturnType<CharacterRuleActionSystemAdapter['bindFacts']>
  twoPhase: NativeTwoPhase | null
}): ServerRuleExecutionD20PolicyDto | null {
  const nested = input.twoPhase?.phase === 'OUTCOME' ? input.twoPhase.nestedOutcomeD20 : null
  if (input.phase === 'TEST' || nested?.requestNodeId === input.continuation.request.nodeId)
    return (
      nested ??
      deriveEncounterActionD20Policy({ continuation: input.continuation, bound: input.bound })
    )
  if (
    input.phase === 'SINGLE' &&
    input.bound.d20Audit &&
    input.continuation.request.min === 1 &&
    input.continuation.request.max === 20
  )
    return deriveEncounterActionD20Policy({ continuation: input.continuation, bound: input.bound })
  if (
    input.continuation.request.kind !== 'INTEGER_RANGE' ||
    input.continuation.request.min >= input.continuation.request.max
  )
    throw new Error('The action requested unsupported evidence.')
  return null
}

export function actionRequestRoller(input: {
  continuation: ServerRuleExecutionContinuationDto
  policy: ServerRuleExecutionD20PolicyDto | null
  bound: ReturnType<CharacterRuleActionSystemAdapter['bindFacts']>
  twoPhase: NativeTwoPhase | null
}): EncounterActionRoller {
  if (input.policy === null) return 'SOURCE'
  const nested = input.twoPhase?.phase === 'OUTCOME' ? input.twoPhase.nestedOutcomeD20 : null
  if (nested?.requestNodeId === input.continuation.request.nodeId) return 'TARGET'
  if (!input.bound.d20Roller) throw new Error('The action d20 roller is unavailable.')
  return input.bound.d20Roller
}
