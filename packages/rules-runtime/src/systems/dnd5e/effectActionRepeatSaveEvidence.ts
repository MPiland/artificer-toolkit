import type { ServerRuleExecutionResultDto } from '@artificer-toolkit/schema/shared/ruleExecutionProtocol'
import { type CompiledRuleGraph } from '@artificer-toolkit/shared/rules'
import type { CharacterRuleActionSystemAdapter } from '../../characterRuleActionSystemAdapter.js'
import { requireDnd5eAddedDiceTotal } from './d20AddedDiceGraph.js'
import { DND5E_SAVE_TEST_OPERATION_KEY } from './dnd5eTestOperationKeys.js'
import {
  DND5E_SAVE_MODIFIER_FACT_KEY,
  DND5E_SAVE_DC_FACT_KEY,
  DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY,
  DND5E_TEST_OUTCOME_RULE_FACT_KEY,
  DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY,
  DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ATTEMPT_GATE_FACT_KEY,
  DND5E_ACTIVE_EFFECT_REPEAT_SAVE_TRIGGERS_ONLY_FACT_KEY,
  DND5E_REPEAT_SAVE_ATTEMPT_ALLOWED_FACT_KEY,
  Dnd5eEffectActionCompilerError
} from './effectActionContracts.js'
import { repeatSaveConditionIds } from './effectActionEvidenceChecks.js'
import { isDnd5eTestOutcomeRule, dnd5eTestResultPath } from './effectActionOperationRegistry.js'

/** Whether a repeat save's d20 can be settled without a request: a gated, thresholds or triggers-only save. */
export function repeatSaveGated(
  adapterFacts: Readonly<Record<string, unknown>>,
  saveThresholds: unknown
): boolean {
  return (
    DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ATTEMPT_GATE_FACT_KEY in adapterFacts ||
    DND5E_ACTIVE_EFFECT_REPEAT_SAVE_TRIGGERS_ONLY_FACT_KEY in adapterFacts ||
    saveThresholds !== undefined
  )
}

export function repeatedFollowUpSaveResultPath(input: {
  execution: Extract<ServerRuleExecutionResultDto, { status: 'COMPLETE' }>
  occurrenceId: string
  definition: Parameters<
    NonNullable<CharacterRuleActionSystemAdapter['interpretActiveEffect']>
  >[0]['definition']
  graph: CompiledRuleGraph
  targetActorId: string
}): 'ON_SAVE_FAIL' | 'ON_SAVE_SUCCESS' | 'ATTEMPT_REFUSED' | null {
  const d20NodeId = input.definition.adapterFacts[DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY]
  if (d20NodeId !== 'repeat-save-d20') return null
  // A repeat save that holds conditions names them; one that holds modifier grants names none.
  repeatSaveConditionIds(input.definition.adapterFacts)
  const [d20Trace, addedDiceTrace, saveTrace] = input.execution.evidence.trace
  const gated = repeatSaveGated(
    input.definition.adapterFacts,
    input.definition.recurrence.saveThresholds
  )
  const d20OperationKey = gated ? 'evidence.optional-integer-range' : 'evidence.integer-range'
  const attemptAllowed = gated
    ? input.execution.evidence.facts[DND5E_REPEAT_SAVE_ATTEMPT_ALLOWED_FACT_KEY]
    : true
  if (
    input.graph.nodes.length !== 3 ||
    input.graph.nodes[0]?.id !== d20NodeId ||
    input.graph.nodes[0]?.operation.key !== d20OperationKey ||
    input.graph.nodes[2]?.id !== input.definition.frozenGraphNodeId ||
    input.graph.nodes[2]?.operation.key !== DND5E_SAVE_TEST_OPERATION_KEY ||
    input.execution.evidence.trace.length !== 3 ||
    d20Trace?.nodeId !== d20NodeId ||
    d20Trace.operation.key !== d20OperationKey ||
    d20Trace.inputs.min !== 1 ||
    d20Trace.inputs.max !== 20 ||
    typeof attemptAllowed !== 'boolean' ||
    (gated && d20Trace.inputs.enabled !== attemptAllowed)
  ) {
    throw new Dnd5eEffectActionCompilerError('The committed D&D repeat-save graph is invalid.')
  }
  const addedTotal = requireDnd5eAddedDiceTotal({
    trace: addedDiceTrace,
    facts: input.execution.evidence.facts,
    d20NodeId,
    nodeIndex: 1,
    occurrenceId: input.occurrenceId,
    invalid: () =>
      new Dnd5eEffectActionCompilerError('The committed D&D repeat-save graph is invalid.')
  })
  // The gate refused this turn's attempt: its d20 settled without a request, so no save was made.
  if (!attemptAllowed) {
    if (d20Trace.evidence !== undefined)
      throw new Dnd5eEffectActionCompilerError('A refused D&D repeat save carries d20 evidence.')
    return 'ATTEMPT_REFUSED'
  }
  const naturalD20 = d20Trace.evidence?.kind === 'INTEGER_RANGE' ? d20Trace.evidence.value : null
  const modifier = saveTrace?.inputs.modifier
  const threshold = saveTrace?.inputs.threshold
  if (
    d20Trace.evidence?.kind !== 'INTEGER_RANGE' ||
    d20Trace.evidence.requestId !== `${input.occurrenceId}:0:${d20NodeId}` ||
    saveTrace?.nodeId !== input.definition.frozenGraphNodeId ||
    saveTrace.operation.key !== DND5E_SAVE_TEST_OPERATION_KEY ||
    saveTrace.inputs.targetActorId !== input.targetActorId ||
    saveTrace.outputs.targetActorId !== input.targetActorId ||
    !Number.isSafeInteger(naturalD20) ||
    saveTrace.inputs.naturalD20 !== naturalD20 ||
    saveTrace.outputs.naturalD20 !== naturalD20 ||
    typeof modifier !== 'number' ||
    !Number.isSafeInteger(modifier) ||
    typeof threshold !== 'number' ||
    !Number.isSafeInteger(threshold) ||
    modifier !== input.execution.evidence.facts[DND5E_SAVE_MODIFIER_FACT_KEY] ||
    threshold !== input.definition.adapterFacts[DND5E_SAVE_DC_FACT_KEY] ||
    saveTrace.inputs.contributorChecksum !==
      input.execution.evidence.facts[DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY] ||
    saveTrace.outputs.contributorChecksum !== saveTrace.inputs.contributorChecksum ||
    saveTrace.inputs.addedTotal !== addedTotal ||
    saveTrace.outputs.total !== naturalD20 + modifier + addedTotal ||
    (saveTrace.outputs.resultPath !== 'ON_SAVE_FAIL' &&
      saveTrace.outputs.resultPath !== 'ON_SAVE_SUCCESS') ||
    input.execution.outputs.resultPath !== saveTrace.outputs.resultPath ||
    input.execution.outputs.total !== saveTrace.outputs.total
  ) {
    throw new Dnd5eEffectActionCompilerError('The committed D&D repeat-save graph is invalid.')
  }
  const outcomeRule = input.execution.evidence.facts[DND5E_TEST_OUTCOME_RULE_FACT_KEY]
  if (!isDnd5eTestOutcomeRule(outcomeRule) || saveTrace.inputs.outcomeRule !== outcomeRule) {
    throw new Dnd5eEffectActionCompilerError(
      'The committed D&D repeat-save outcome rule is invalid.'
    )
  }
  const expected = dnd5eTestResultPath({
    kind: 'SAVE',
    naturalD20,
    total: naturalD20 + modifier + addedTotal,
    threshold,
    outcomeRule
  })
  if (saveTrace.outputs.resultPath !== expected) {
    throw new Dnd5eEffectActionCompilerError('The committed D&D repeat-save result is invalid.')
  }
  return expected
}
