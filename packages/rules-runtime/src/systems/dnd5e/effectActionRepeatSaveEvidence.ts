import {
  DND5E_REPEAT_SAVE_ATTEMPT_ALLOWED_FACT_KEY,
  DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY,
  DND5E_SAVE_MODIFIER_FACT_KEY,
  DND5E_SAVE_TEST_OPERATION_KEY,
  DND5E_TEST_OUTCOME_RULE_FACT_KEY
} from '@artificer-toolkit/schema/systems/dnd5e/schemaExtension'
import type {
  ActiveEffectSaveTally,
  ActiveEffectSaveThresholds,
  ActiveRuleEffectLifecycleDto
} from '@artificer-toolkit/schema/shared/activeRuleEffectLifecycle'
import type { ServerRuleExecutionResultDto } from '@artificer-toolkit/schema/shared/ruleExecutionProtocol'
import { type CompiledRuleGraph } from '@artificer-toolkit/shared/rules'
import type { CharacterRuleActionSystemAdapter } from '../../characterRuleActionSystemAdapter.js'
import { requireDnd5eAddedDiceTotal } from './d20AddedDiceGraph.js'
import {
  DND5E_SAVE_DC_FACT_KEY,
  DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY,
  DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ATTEMPT_GATE_FACT_KEY,
  DND5E_ACTIVE_EFFECT_REPEAT_SAVE_TRIGGERS_ONLY_FACT_KEY,
  DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ESCALATION_CONDITION_FACT_KEY,
  DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ESCALATION_HELD_FACT_KEY,
  DND5E_ACTIVE_EFFECT_DURATION_COMPLETE_CONDITION_FACT_KEY,
  ENTRY_DAMAGE_NODE_PREFIX,
  UUID,
  Dnd5eEffectActionCompilerError
} from './effectActionContracts.js'
import { dnd5eOutcomeDefinition } from './effectActionOutcomes.js'
import { repeatSaveConditionIds } from './effectActionEvidenceChecks.js'
import { testApplications } from './effectActionInterpretation.js'
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

/**
 * Whether a repeat save may be attempted now: not once a thresholds tally has resolved (its duration
 * still runs out), only when its perception gate is met, and for a triggers-only save only when a
 * damage trigger runs it, never on the turn tick.
 */
export function repeatSaveAttemptAllowed(input: {
  adapterFacts: Readonly<Record<string, unknown>>
  thresholds: ActiveEffectSaveThresholds | undefined
  lifecycle: ActiveRuleEffectLifecycleDto
  gateMet: boolean
  onTrigger: boolean | undefined
}) {
  const { thresholds } = input
  const resolved =
    thresholds !== undefined &&
    (input.lifecycle.saveTally?.failures ?? 0) >= thresholds.failuresToResolve
  return (
    !resolved &&
    input.gateMet &&
    (input.onTrigger === true ||
      !(DND5E_ACTIVE_EFFECT_REPEAT_SAVE_TRIGGERS_ONLY_FACT_KEY in input.adapterFacts))
  )
}

/** Whether a repeat-save graph node rolls or proposes the damage its failed save deals. */
function isRepeatSaveFailureDamageNode(nodeId: string) {
  return nodeId.startsWith(ENTRY_DAMAGE_NODE_PREFIX) || nodeId === 'proposal-on_save_fail'
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
  // A source-turn follow-up save may add GM rulings, each gated on its failure, and a failure that
  // goes on may roll damage (its dice and proposal are checked with the save's applications);
  // nothing else may follow.
  const failureNodes = input.graph.nodes.slice(3)
  const rulingOperationKey = dnd5eOutcomeDefinition('MANUAL_ADJUDICATION').pathGatedOperationKey
  const failureNodeIds = new Set(failureNodes.map(({ id }) => id))
  if (
    input.graph.nodes.length < 3 ||
    !failureNodes.every((node) =>
      isRepeatSaveFailureDamageNode(node.id)
        ? !gated
        : /^manual_adjudication-\d+$/.test(node.id) &&
          node.operation.key === rulingOperationKey &&
          node.inputs.authoredPath?.kind === 'LITERAL' &&
          node.inputs.authoredPath.value === 'ON_SAVE_FAIL'
    ) ||
    input.execution.evidence.trace.length < 3 ||
    !input.execution.evidence.trace.slice(3).every(({ nodeId }) => failureNodeIds.has(nodeId)) ||
    input.graph.nodes[0]?.id !== d20NodeId ||
    input.graph.nodes[0]?.operation.key !== d20OperationKey ||
    input.graph.nodes[2]?.id !== input.definition.frozenGraphNodeId ||
    input.graph.nodes[2]?.operation.key !== DND5E_SAVE_TEST_OPERATION_KEY ||
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

export function isTallyCount(count: number) {
  return Number.isSafeInteger(count) && count >= 1 && count <= 255
}

type InterpretActiveEffect = NonNullable<CharacterRuleActionSystemAdapter['interpretActiveEffect']>

/**
 * What a turn's repeated save settles on its holder: the damage a failure that goes on rolled, then,
 * when the effect ends, the conditions it held and any escalated condition a failure leaves.
 */
export function settleRepeatedSave({
  execution,
  activeEffectId,
  definition,
  lifecycle,
  graph,
  path: repeatedSavePath,
  published,
  ...target
}: Parameters<InterpretActiveEffect>[0] & {
  path: 'ON_SAVE_FAIL' | 'ON_SAVE_SUCCESS' | 'ATTEMPT_REFUSED'
  published: Parameters<CharacterRuleActionSystemAdapter['interpret']>[0]['published']
}): ReturnType<InterpretActiveEffect> {
  // The gate's d20 only decides whether its child is made; the effect lasts out its duration.
  if (definition.recurrence.turnEndGate)
    return {
      applications: [],
      terminal: lifecycle.remainingTicks === 1,
      emptyApplicationAllowed: true
    }
  const conditionIds = repeatSaveConditionIds(definition.adapterFacts)
  const thresholds = definition.recurrence.saveThresholds
  const escalationConditionId =
    definition.adapterFacts[DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ESCALATION_CONDITION_FACT_KEY]
  const escalationHeld =
    definition.adapterFacts[DND5E_ACTIVE_EFFECT_REPEAT_SAVE_ESCALATION_HELD_FACT_KEY] === true
  const durationCompleteConditionId =
    definition.adapterFacts[DND5E_ACTIVE_EFFECT_DURATION_COMPLETE_CONDITION_FACT_KEY]
  const saveTally =
    thresholds && repeatedSavePath !== 'ATTEMPT_REFUSED'
      ? countRepeatSave(thresholds, lifecycle.saveTally, repeatedSavePath)
      : undefined
  // A failed or refused attempt on the last counted turn ends the effect with its duration. A
  // thresholds effect ends on its last success instead, and on its last failure when that
  // escalation ends it; one whose escalation it holds, or that does not escalate, settles there.
  const endedBySave = thresholds
    ? tallyEnds(thresholds, saveTally, escalationConditionId !== undefined && !escalationHeld)
    : repeatedSavePath === 'ON_SAVE_SUCCESS'
  const terminal = endedBySave || lifecycle.remainingTicks === 1
  // A failure that goes on deals the damage its graph rolled, before anything the save ends.
  const failureDamage = graph.nodes.some(({ id }) => isRepeatSaveFailureDamageNode(id))
    ? testApplications({ execution, published, ...target }, undefined, {
        d20: 'repeat-save-d20',
        test: definition.frozenGraphNodeId
      })
    : []
  if (failureDamage === null)
    throw new Dnd5eEffectActionCompilerError('The committed D&D repeat-save graph is invalid.')
  // Grants held by the effect leave with it; only held conditions need removing.
  if (conditionIds === null)
    return {
      applications: failureDamage,
      terminal,
      emptyApplicationAllowed: true,
      ...(saveTally ? { saveTally } : {})
    }
  for (const conditionId of [escalationConditionId, durationCompleteConditionId])
    if (conditionId !== undefined && (typeof conditionId !== 'string' || !UUID.test(conditionId)))
      throw new Dnd5eEffectActionCompilerError(
        'D&D repeat-save escalation condition identity is invalid.'
      )
  const escalation = typeof escalationConditionId === 'string' ? escalationConditionId : undefined
  const failuresSettled =
    thresholds !== undefined &&
    ((saveTally ?? lifecycle.saveTally)?.failures ?? 0) >= thresholds.failuresToResolve
  // A held escalation is added by the failure that settles the tally; one that ends the effect is
  // left by the failure that ends it.
  const escalates =
    escalation !== undefined &&
    repeatedSavePath === 'ON_SAVE_FAIL' &&
    (escalationHeld ? saveTally?.failures === thresholds?.failuresToResolve : terminal)
  const left = [
    ...(escalates ? [escalation] : []),
    // An effect that runs its full duration leaves its duration-complete condition.
    ...(terminal && !endedBySave && typeof durationCompleteConditionId === 'string'
      ? [durationCompleteConditionId]
      : [])
  ].filter(
    (conditionId, index, all) =>
      all.indexOf(conditionId) === index &&
      // A target that cannot hold a condition is not left with it.
      !(target.conditionImmunityIds ?? []).includes(conditionId)
  )
  // The effect releases what it held, and a held escalation once the tally added it, unless the
  // effect leaves it in place.
  const released = terminal
    ? [...conditionIds, ...(escalationHeld && failuresSettled && escalation ? [escalation] : [])]
    : []
  const path = repeatedSavePath === 'ATTEMPT_REFUSED' ? null : repeatedSavePath
  const application = {
    targetActorId: target.targetActorId,
    sourceNodeId: definition.frozenGraphNodeId,
    sourceOperationKey: DND5E_SAVE_TEST_OPERATION_KEY,
    authoredPath: path,
    resolvedPath: path
  }
  const applications = [
    ...failureDamage,
    ...released
      .filter((conditionId) => !left.includes(conditionId))
      .map((conditionId) => ({
        ...application,
        sourceActiveEffectId: activeEffectId,
        kind: 'CONDITION_REMOVE' as const,
        conditionId
      })),
    ...left.map((conditionId) => ({
      ...application,
      kind: 'CONDITION_APPLY' as const,
      conditionId
    }))
  ]
  return terminal
    ? { applications, terminal: true }
    : {
        applications,
        terminal: false,
        emptyApplicationAllowed: true,
        ...(saveTally ? { saveTally } : {})
      }
}

/** The tally once a made or failed save is counted; a consecutive tally zeroes the other count. */
function countRepeatSave(
  thresholds: ActiveEffectSaveThresholds,
  before: ActiveEffectSaveTally | undefined,
  path: 'ON_SAVE_FAIL' | 'ON_SAVE_SUCCESS'
): ActiveEffectSaveTally {
  const { successes, failures } = before ?? { successes: 0, failures: 0 }
  return path === 'ON_SAVE_SUCCESS'
    ? { successes: successes + 1, failures: thresholds.consecutive ? 0 : failures }
    : { successes: thresholds.consecutive ? 0 : successes, failures: failures + 1 }
}

/** Whether the tally has reached the successes that end the effect, or the failures that escalate it. */
function tallyEnds(
  thresholds: ActiveEffectSaveThresholds,
  tally: ActiveEffectSaveTally | undefined,
  escalates: boolean
) {
  return (
    tally !== undefined &&
    (tally.successes >= thresholds.successesToEnd ||
      (escalates && tally.failures >= thresholds.failuresToResolve))
  )
}
