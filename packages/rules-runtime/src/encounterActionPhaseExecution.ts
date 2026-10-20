import type {
  RuleGraphSourceIdentityDto,
  ServerRuleExecutionD20EvidenceDto,
  ServerRuleExecutionResultDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import type { RuleValue } from '@artificer-toolkit/shared/rules'

import type { EncounterD20RollMode } from './encounterEvidenceAnswer.js'
import type {
  CharacterRuleActionExecutionPlan,
  CharacterRuleActionOutcomeTemplate,
  CharacterRuleActionSystemAdapter
} from './characterRuleActionSystemAdapter.js'

type EncounterActionPhaseResolution =
  | { kind: 'SINGLE_GRAPH' }
  | { kind: 'PAUSED'; phase: 'TEST' | 'OUTCOME' }
  | { kind: 'TEST_ONLY'; selectedPath: string }
  | {
      kind: 'OUTCOME'
      selectedPath: string
      outcome: CharacterRuleActionOutcomeTemplate
      template: RuleGraphSourceIdentityDto
    }

/** The mode a completed TEST's d20 was settled in; a TEST_OUTCOME action always settles one. */
export function requireTestRollMode(d20: ServerRuleExecutionD20EvidenceDto | null) {
  if (!d20) throw new Error('The action TEST holds no settled d20.')
  return d20.rollMode
}

/**
 * Selects the sole optional OUTCOME after a completed TEST. Aggregate callers
 * own locking, currentness, evidence collection, execution, and application.
 */
export function resolveEncounterActionPhaseExecution(input: {
  plan: CharacterRuleActionExecutionPlan
  phase: 'TEST' | 'OUTCOME'
  execution: ServerRuleExecutionResultDto
  adapter: Pick<CharacterRuleActionSystemAdapter, 'specializeOutcomeTemplate'>
  facts: Readonly<Record<string, RuleValue>>
  /** The mode the TEST d20 was settled in (its evidence `rollMode`), which a path gate reads. */
  testRollMode: EncounterD20RollMode
  /** A server-owned interstitial policy may select a legal replacement path without rewriting TEST evidence. */
  effectivePath?: string
  /** The attack struck a decoy of its target: no OUTCOME runs, whatever path the TEST selected. */
  absorbedByDecoy?: boolean
}): EncounterActionPhaseResolution {
  if (input.plan.kind === 'SINGLE_GRAPH') return { kind: 'SINGLE_GRAPH' }
  if (input.execution.status === 'PAUSED') return { kind: 'PAUSED', phase: input.phase }
  if (input.phase !== 'TEST')
    throw new Error('A TEST_OUTCOME action cannot enter a third execution phase.')
  const selectedPath = input.effectivePath ?? input.execution.outputs.resultPath
  if (typeof selectedPath !== 'string')
    throw new Error('A completed TEST must select exactly one outcome path.')
  if (input.absorbedByDecoy) return { kind: 'TEST_ONLY', selectedPath }
  if (!input.adapter.specializeOutcomeTemplate)
    throw new Error('The System cannot specialize the selected outcome path.')

  const expectedTemplate = input.plan.outcomes.find(
    (candidate) => candidate.pathCode === selectedPath
  )
  const outcome = input.adapter.specializeOutcomeTemplate({
    compilerSource: input.plan.compilerSource,
    testTemplate: input.plan.test,
    selectedPath,
    facts: input.facts,
    testOutputs: input.execution.outputs,
    testRollMode: input.testRollMode
  })
  if (!expectedTemplate) {
    if (outcome) throw new Error('An omitted TEST outcome path cannot produce an OUTCOME graph.')
    return { kind: 'TEST_ONLY', selectedPath }
  }
  // A path owes nothing to this target when no authored result holds for it (a hit-point tier
  // that no band of the target's reaches), so the TEST alone settles it.
  if (!outcome) return { kind: 'TEST_ONLY', selectedPath }
  if (
    outcome.templateChecksum !== expectedTemplate.template.checksum ||
    outcome.published.id !== expectedTemplate.template.definitionId ||
    outcome.published.gameSystemId !== expectedTemplate.template.gameSystemId ||
    outcome.published.definitionFamilyKey !== expectedTemplate.template.definitionFamilyKey
  )
    throw new Error('The specialized OUTCOME graph does not match its sealed template.')
  return { kind: 'OUTCOME', selectedPath, outcome, template: expectedTemplate.template }
}
