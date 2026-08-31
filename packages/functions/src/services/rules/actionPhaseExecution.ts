import type {
  RuleGraphSourceIdentityDto,
  ServerRuleExecutionResultDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import type { RuleValue } from '@artificer-toolkit/shared/rules'

import {
  type CharacterRuleActionExecutionPlan,
  type CharacterRuleActionOutcomeTemplate,
  type CharacterRuleActionSystemAdapter
} from './characterRuleActionSystemAdapter.js'

export type ActionPhaseResolution =
  | { kind: 'SINGLE_GRAPH' }
  | { kind: 'PAUSED'; phase: 'TEST' | 'OUTCOME' }
  | { kind: 'TEST_ONLY'; selectedPath: string }
  | {
      kind: 'OUTCOME'
      selectedPath: string
      outcome: CharacterRuleActionOutcomeTemplate
      template: RuleGraphSourceIdentityDto
    }

/**
 * Selects the sole optional OUTCOME after a completed TEST. Aggregate callers
 * own locking, currentness, evidence collection, execution, and application.
 */
export function resolveActionPhaseExecution(input: {
  plan: CharacterRuleActionExecutionPlan
  phase: 'TEST' | 'OUTCOME'
  execution: ServerRuleExecutionResultDto
  adapter: Pick<CharacterRuleActionSystemAdapter, 'specializeOutcomeTemplate'>
  facts: Readonly<Record<string, RuleValue>>
  /** A server-owned interstitial policy may select a legal replacement path without rewriting TEST evidence. */
  effectivePath?: string
}): ActionPhaseResolution {
  if (input.plan.kind === 'SINGLE_GRAPH') return { kind: 'SINGLE_GRAPH' }
  if (input.execution.status === 'PAUSED') return { kind: 'PAUSED', phase: input.phase }
  if (input.phase !== 'TEST')
    throw new Error('A TEST_OUTCOME action cannot enter a third execution phase.')
  const selectedPath = input.effectivePath ?? input.execution.outputs.resultPath
  if (typeof selectedPath !== 'string')
    throw new Error('A completed TEST must select exactly one outcome path.')
  if (!input.adapter.specializeOutcomeTemplate)
    throw new Error('The System cannot specialize the selected outcome path.')

  const expectedTemplate = input.plan.outcomes.find(
    (candidate) => candidate.pathCode === selectedPath
  )
  const outcome = input.adapter.specializeOutcomeTemplate({
    compilerSource: input.plan.compilerSource,
    testTemplate: input.plan.test,
    selectedPath,
    facts: input.facts
  })
  if (!expectedTemplate) {
    if (outcome) throw new Error('An omitted TEST outcome path cannot produce an OUTCOME graph.')
    return { kind: 'TEST_ONLY', selectedPath }
  }
  if (!outcome) throw new Error('A selected outcome path requires its sealed OUTCOME graph.')
  if (
    outcome.templateChecksum !== expectedTemplate.template.checksum ||
    outcome.published.id !== expectedTemplate.template.definitionId ||
    outcome.published.gameSystemId !== expectedTemplate.template.gameSystemId ||
    outcome.published.definitionFamilyKey !== expectedTemplate.template.definitionFamilyKey
  )
    throw new Error('The specialized OUTCOME graph does not match its sealed template.')
  return { kind: 'OUTCOME', selectedPath, outcome, template: expectedTemplate.template }
}
