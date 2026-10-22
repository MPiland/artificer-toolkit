import { type ServerPublishedRuleDefinitionDto } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import { resolveDispositionDamage } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import {
  compareThresholdRuleOperation,
  type CompiledRuleGraph,
  type RuleValue
} from '@artificer-toolkit/shared/rules'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type {
  CharacterRuleActionApplication,
  CharacterRuleActionSystemAdapter,
  CharacterRuleActionSpatialDirective
} from '../../characterRuleActionSystemAdapter.js'
import { isCharacterRuleActionForcedMovementDirection } from '../../characterRuleActionSystemAdapter.js'
import { requireDnd5eAddedDiceTotal } from './d20AddedDiceGraph.js'
import {
  DND5E_ATTACK_TEST_OPERATION_KEY,
  DND5E_SAVE_TEST_OPERATION_KEY
} from './dnd5eTestOperationKeys.js'
import {
  DND5E_HEAL_PROPOSAL_OPERATION_KEY,
  DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY,
  DND5E_STABILIZE_PROPOSAL_OPERATION_KEY,
  DND5E_KILL_PROPOSAL_OPERATION_KEY,
  DND5E_REVIVE_PROPOSAL_OPERATION_KEY,
  DND5E_DEPART_PROPOSAL_OPERATION_KEY,
  DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
  DND5E_HIT_POINT_MAXIMUM_REDUCTION_PROPOSAL_OPERATION_KEY,
  DND5E_SCALAR_REDUCTION_PROPOSAL_OPERATION_KEY,
  DND5E_FORCED_MOVEMENT_PROPOSAL_OPERATION_KEY,
  DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY,
  DND5E_MOVEMENT_INTERRUPTION_AUTHORIZATION_OPERATION_KEY,
  DND5E_ACTOR_RELATIONSHIP_STATE_OPERATION_KEY,
  DND5E_TARGET_ACTOR_FACT_KEY,
  DND5E_ATTACK_MODIFIER_FACT_KEY,
  DND5E_TARGET_DEFENSE_FACT_KEY,
  DND5E_SAVE_MODIFIER_FACT_KEY,
  DND5E_SAVE_DC_FACT_KEY,
  DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY,
  DND5E_TEST_OUTCOME_RULE_FACT_KEY,
  DND5E_ATTACK_CRITICAL_THRESHOLD_FACT_KEY,
  DND5E_TARGET_STATE_CHECKSUM_FACT_KEY,
  DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY,
  isPathConditionImmuneFactKey,
  DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY,
  UUID,
  Dnd5eEffectActionCompilerError,
  ENTRY_DAMAGE_NODE_PREFIX,
  CONDITION_PROPOSAL_SUFFIX,
  entryDamagePrefix,
  isSpecializedPath,
  uuid,
  decodeForcedMovementCollision,
  NESTED_SAVE_MARGIN_NODE_ID,
  DND5E_NESTED_SAVE_GATE_OPERATION_KEY,
  proposalNodePathCode,
  positive
} from './effectActionContracts.js'
import {
  hitPointStateIsValid,
  type DirectInterpretationInput,
  conditionImmunityFacts
} from './effectActionEvidenceChecks.js'
import { gateEvidenceIsValid, reducedToZeroGateHolds } from './effectActionGates.js'
import {
  parseRecoveryTags,
  isDnd5eTestOutcomeRule,
  dnd5eTestResultPath,
  dnd5eSaveTestOperation,
  dnd5eMovementInterruptionAuthorizationOperation,
  dnd5eNestedSaveGateOperation,
  dnd5ePathGatedProposalOperations,
  dnd5eTestMarginConditionProposalOperation,
  dnd5eResultPathSatisfies
} from './effectActionOperationRegistry.js'
import {
  DND5E_DIRECT_OPERATION_BY_PATH_GATED_OPERATION,
  DND5E_DIRECT_OUTCOME_OPERATION_KEYS,
  DND5E_STATELESS_OUTCOME_OPERATION_KEYS
} from './effectActionOutcomes.js'

/**
 * The dice a zone's entry graph rolls for its damage: the enabling node follows the test result, and
 * each die either carries the one answered request (the path was authored) or settles at its minimum.
 */
export function requireEntryDamageTraces(input: {
  traces: Parameters<
    CharacterRuleActionSystemAdapter['interpret']
  >[0]['execution']['evidence']['trace']
  published: ServerPublishedRuleDefinitionDto
  occurrenceId: string
  resultPath: string
}): void {
  const { traces, published, occurrenceId, resultPath } = input
  if (traces.length === 0) return
  const invalid = () =>
    new Dnd5eEffectActionCompilerError('The committed D&D zone damage dice topology is invalid.')
  const nodeIds = published.definition.nodes.map((node) => node.id)
  // Each save result that rolls dice has a gate of its own; the dice read the gate they are bound to.
  const gateNodes = published.definition.nodes.filter(
    (node) =>
      node.id.startsWith(ENTRY_DAMAGE_NODE_PREFIX) &&
      node.operation.key === DND5E_MOVEMENT_INTERRUPTION_AUTHORIZATION_OPERATION_KEY
  )
  if (gateNodes.length === 0) throw invalid()
  const gateAuthorized = new Map<string, unknown>()
  for (const enabledNode of gateNodes) {
    const enabledTrace = traces.find((trace) => trace.nodeId === enabledNode.id)
    const authoredPath = enabledNode.inputs.authoredPath
    if (
      !enabledTrace ||
      enabledTrace.operation.key !== enabledNode.operation.key ||
      authoredPath?.kind !== 'LITERAL' ||
      typeof authoredPath.value !== 'string' ||
      !isSpecializedPath(authoredPath.value) ||
      enabledNode.id !== `${entryDamagePrefix(authoredPath.value)}enabled` ||
      !isSpecializedPath(resultPath) ||
      enabledTrace.inputs.resultPath !== resultPath ||
      enabledTrace.inputs.authoredPath !== authoredPath.value ||
      enabledTrace.outputs.authorized !==
        dnd5eMovementInterruptionAuthorizationOperation.execute({
          resultPath,
          authoredPath: authoredPath.value
        }).authorized
    )
      throw invalid()
    gateAuthorized.set(enabledNode.id, enabledTrace.outputs.authorized)
  }
  for (const trace of traces) {
    if (trace.operation.key !== 'evidence.optional-integer-range') continue
    const { min, max, enabled } = trace.inputs
    const value = trace.outputs.value
    const answered = trace.evidence
    const gate = published.definition.nodes.find((node) => node.id === trace.nodeId)?.inputs.enabled
    if (
      gate?.kind !== 'NODE_OUTPUT' ||
      enabled !== gateAuthorized.get(gate.nodeId) ||
      typeof min !== 'number' ||
      typeof max !== 'number' ||
      typeof value !== 'number' ||
      (enabled === true
        ? answered?.kind !== 'INTEGER_RANGE' ||
          answered.value !== value ||
          answered.requestId !==
            `${occurrenceId}:${nodeIds.indexOf(trace.nodeId)}:${trace.nodeId}` ||
          value < min ||
          value > max
        : answered !== undefined || value !== min)
    )
      throw invalid()
  }
}
export function testApplications(
  input: Parameters<CharacterRuleActionSystemAdapter['interpret']>[0],
  replacementPath?: 'ON_SAVE_SUCCESS'
): readonly CharacterRuleActionApplication[] | null {
  const { execution, published } = input
  const [d20Trace, addedDiceTrace, testTrace, ...remainingTraces] = execution.evidence.trace
  const containsRootTestTrace = input.execution.evidence.trace.some(
    (trace) => trace.nodeId === 'd20' || trace.nodeId === 'test'
  )
  if (
    d20Trace?.nodeId !== 'd20' ||
    d20Trace?.operation.key !== 'evidence.integer-range' ||
    d20Trace.operation.contractVersion !== 1 ||
    d20Trace.inputs.min !== 1 ||
    d20Trace.inputs.max !== 20 ||
    d20Trace.evidence?.kind !== 'INTEGER_RANGE' ||
    d20Trace.evidence.requestId !== `${input.occurrenceId}:0:d20` ||
    testTrace?.nodeId !== 'test' ||
    (testTrace.operation.key !== DND5E_ATTACK_TEST_OPERATION_KEY &&
      testTrace.operation.key !== DND5E_SAVE_TEST_OPERATION_KEY)
  ) {
    if (containsRootTestTrace)
      throw new Dnd5eEffectActionCompilerError('The committed D&D test graph topology is invalid.')
    return null
  }
  const source = execution.evidence.source
  if (
    source.definitionId !== published.id ||
    source.gameSystemId !== published.gameSystemId ||
    source.definitionFamilyKey !== published.definitionFamilyKey ||
    source.checksum !== published.checksum
  )
    throw new Dnd5eEffectActionCompilerError('The committed D&D test source identity is invalid.')
  const expectedNodes = new Map(
    published.definition.nodes.map((node) => [
      node.id,
      `${node.operation.key}:${node.operation.contractVersion}`
    ])
  )
  const seenNodes = new Set<string>()
  if (
    execution.evidence.trace.length !== expectedNodes.size ||
    execution.evidence.trace.some((trace) => {
      if (seenNodes.has(trace.nodeId)) return true
      seenNodes.add(trace.nodeId)
      return (
        expectedNodes.get(trace.nodeId) !==
        `${trace.operation.key}:${trace.operation.contractVersion}`
      )
    })
  )
    throw new Dnd5eEffectActionCompilerError('The committed D&D test graph topology is invalid.')
  const movementInterruptionTraces = remainingTraces.filter(
    (trace) => trace.nodeId === 'movement-interruption'
  )
  if (movementInterruptionTraces.length > 1)
    throw new Dnd5eEffectActionCompilerError(
      'The committed D&D test movement interruption topology is invalid.'
    )
  const movementInterruptionTrace = movementInterruptionTraces[0]
  if (movementInterruptionTrace) {
    const movementInterruptionNode = published.definition.nodes.find(
      (node) => node.id === 'movement-interruption'
    )
    const resultPathBinding = movementInterruptionNode?.inputs.resultPath
    const authoredPathBinding = movementInterruptionNode?.inputs.authoredPath
    const movementInterruptionOutput = published.definition.outputs.movementInterruption
    const resultPath = testTrace.outputs.resultPath
    const authoredPath = movementInterruptionTrace.inputs.authoredPath
    if (
      typeof resultPath !== 'string' ||
      typeof authoredPath !== 'string' ||
      !isSpecializedPath(resultPath) ||
      !isSpecializedPath(authoredPath)
    )
      throw new Dnd5eEffectActionCompilerError(
        'The committed D&D test movement interruption topology is invalid.'
      )
    const expected = dnd5eMovementInterruptionAuthorizationOperation.execute({
      resultPath,
      authoredPath
    }).authorized
    if (
      movementInterruptionTrace.operation.key !==
        DND5E_MOVEMENT_INTERRUPTION_AUTHORIZATION_OPERATION_KEY ||
      movementInterruptionTrace.operation.contractVersion !== 1 ||
      movementInterruptionNode?.operation.key !==
        DND5E_MOVEMENT_INTERRUPTION_AUTHORIZATION_OPERATION_KEY ||
      movementInterruptionNode?.operation.contractVersion !== 1 ||
      resultPathBinding?.kind !== 'NODE_OUTPUT' ||
      resultPathBinding.nodeId !== 'test' ||
      resultPathBinding.port !== 'resultPath' ||
      authoredPathBinding?.kind !== 'LITERAL' ||
      movementInterruptionTrace.inputs.resultPath !== resultPath ||
      authoredPath !== authoredPathBinding.value ||
      typeof movementInterruptionTrace.outputs.authorized !== 'boolean' ||
      movementInterruptionTrace.outputs.authorized !== expected ||
      movementInterruptionOutput?.kind !== 'NODE_OUTPUT' ||
      movementInterruptionOutput.nodeId !== 'movement-interruption' ||
      movementInterruptionOutput.port !== 'authorized' ||
      execution.outputs.movementInterruption !== movementInterruptionTrace.outputs.authorized
    )
      throw new Dnd5eEffectActionCompilerError(
        'The committed D&D test movement interruption topology is invalid.'
      )
  }
  const entryDamageTraces = remainingTraces.filter((trace) =>
    trace.nodeId.startsWith(ENTRY_DAMAGE_NODE_PREFIX)
  )
  const proposalTraces = remainingTraces.filter(
    (trace) => trace.nodeId !== 'movement-interruption' && !entryDamageTraces.includes(trace)
  )
  const naturalD20 = testTrace.outputs.naturalD20
  const modifier = testTrace.inputs.modifier
  const threshold = testTrace.inputs.threshold
  const targetActorId = testTrace.outputs.targetActorId
  const resultPath = testTrace.outputs.resultPath
  const addedTotal = requireDnd5eAddedDiceTotal({
    trace: addedDiceTrace,
    facts: execution.evidence.facts,
    d20NodeId: 'd20',
    nodeIndex: 1,
    occurrenceId: input.occurrenceId,
    invalid: () =>
      new Dnd5eEffectActionCompilerError('The committed D&D test result trace is invalid.')
  })
  if (
    testTrace.inputs.addedTotal !== addedTotal ||
    targetActorId !== input.targetActorId ||
    testTrace.inputs.targetActorId !== input.targetActorId ||
    naturalD20 !== d20Trace.evidence.value ||
    typeof naturalD20 !== 'number' ||
    typeof naturalD20 !== 'number' ||
    !Number.isSafeInteger(naturalD20) ||
    naturalD20 < 1 ||
    naturalD20 > 20 ||
    typeof modifier !== 'number' ||
    !Number.isSafeInteger(modifier) ||
    typeof threshold !== 'number' ||
    !Number.isSafeInteger(threshold) ||
    testTrace.outputs.total !== naturalD20 + modifier + addedTotal ||
    typeof resultPath !== 'string'
  )
    throw new Dnd5eEffectActionCompilerError('The committed D&D test result trace is invalid.')
  const attack = testTrace.operation.key === DND5E_ATTACK_TEST_OPERATION_KEY
  const modifierFactKey = attack ? DND5E_ATTACK_MODIFIER_FACT_KEY : DND5E_SAVE_MODIFIER_FACT_KEY
  const thresholdFactKey = attack ? DND5E_TARGET_DEFENSE_FACT_KEY : DND5E_SAVE_DC_FACT_KEY
  const expectedModifier = execution.evidence.facts[modifierFactKey]
  const expectedThreshold = execution.evidence.facts[thresholdFactKey]
  const expectedContributorChecksum =
    execution.evidence.facts[DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]
  const outcomeRule = execution.evidence.facts[DND5E_TEST_OUTCOME_RULE_FACT_KEY]
  if (!isDnd5eTestOutcomeRule(outcomeRule) || testTrace.inputs.outcomeRule !== outcomeRule)
    throw new Dnd5eEffectActionCompilerError(
      'The committed D&D test outcome rule does not match D&D policy.'
    )
  const criticalThreshold = execution.evidence.facts[DND5E_ATTACK_CRITICAL_THRESHOLD_FACT_KEY]
  if (
    attack &&
    (typeof criticalThreshold !== 'number' ||
      testTrace.inputs.criticalThreshold !== criticalThreshold)
  )
    throw new Dnd5eEffectActionCompilerError(
      'The committed D&D attack critical threshold does not match D&D policy.'
    )
  const resultInput = {
    naturalD20,
    total: naturalD20 + modifier + addedTotal,
    threshold,
    outcomeRule
  }
  const expectedPath = dnd5eTestResultPath(
    attack
      ? { kind: 'ATTACK', ...resultInput, criticalThreshold: criticalThreshold as number }
      : { kind: 'SAVE', ...resultInput }
  )
  if (
    modifier !== expectedModifier ||
    threshold !== expectedThreshold ||
    testTrace.inputs.contributorChecksum !== expectedContributorChecksum ||
    testTrace.outputs.contributorChecksum !== expectedContributorChecksum ||
    naturalD20 !== d20Trace.outputs.value ||
    naturalD20 !== d20Trace.evidence.value ||
    resultPath !== expectedPath ||
    input.execution.outputs.resultPath !== resultPath
  )
    throw new Dnd5eEffectActionCompilerError(
      'The committed D&D test result does not match D&D policy.'
    )
  if (
    replacementPath !== undefined &&
    (attack || resultPath !== 'ON_SAVE_FAIL' || replacementPath !== 'ON_SAVE_SUCCESS')
  ) {
    throw new Dnd5eEffectActionCompilerError(
      'A D&D save-success replacement requires one completed failed saving throw.'
    )
  }
  const authorizedPaths =
    replacementPath !== undefined
      ? [replacementPath]
      : attack && resultPath === 'ON_CRIT'
        ? ['ON_HIT', 'ON_CRIT']
        : [resultPath]
  requireEntryDamageTraces({
    traces: entryDamageTraces,
    published,
    occurrenceId: input.occurrenceId,
    resultPath
  })
  for (const proposal of proposalTraces) {
    const authoredPath = proposal.inputs.authoredPath
    const publishedNode = published.definition.nodes.find((node) => node.id === proposal.nodeId)
    const expectedTarget = publishedNode?.inputs.targetActorId
    const expectedResolvedPath = publishedNode?.inputs.resolvedPath
    const expectedAuthoredPath = publishedNode?.inputs.authoredPath
    const expectedImmunity = publishedNode?.inputs.conditionImmune
    if (
      !DND5E_DIRECT_OPERATION_BY_PATH_GATED_OPERATION.has(proposal.operation.key) ||
      !publishedNode ||
      publishedNode.operation.key !== proposal.operation.key ||
      publishedNode.operation.contractVersion !== proposal.operation.contractVersion ||
      typeof authoredPath !== 'string' ||
      (proposal.nodeId !== `proposal-${authoredPath.toLowerCase()}` &&
        (proposal.operation.key !== DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY ||
          proposal.nodeId !==
            `proposal-${authoredPath.toLowerCase()}${CONDITION_PROPOSAL_SUFFIX}`)) ||
      expectedTarget?.kind !== 'FACT' ||
      expectedTarget.factKey !== DND5E_TARGET_ACTOR_FACT_KEY ||
      proposal.inputs.targetActorId !== input.targetActorId ||
      proposal.outputs.targetActorId !== input.targetActorId ||
      expectedResolvedPath?.kind !== 'NODE_OUTPUT' ||
      expectedResolvedPath.nodeId !== 'test' ||
      expectedResolvedPath.port !== 'resultPath' ||
      proposal.inputs.resolvedPath !== resultPath ||
      proposal.outputs.resolvedPath !== resultPath ||
      expectedAuthoredPath?.kind !== 'LITERAL' ||
      expectedAuthoredPath.value !== authoredPath ||
      proposal.outputs.authoredPath !== authoredPath ||
      proposal.outputs.applicationCandidate !== true ||
      proposal.outputs.authorized !==
        (dnd5eResultPathSatisfies(resultPath, authoredPath) &&
          proposal.inputs.conditionImmune !== true) ||
      (expectedImmunity?.kind === 'FACT' &&
        proposal.inputs.conditionImmune !== execution.evidence.facts[expectedImmunity.factKey])
    )
      throw new Dnd5eEffectActionCompilerError(
        'The committed D&D test proposal topology is invalid.'
      )
    // Every authored literal of the payload is read and echoed exactly as published.
    for (const [port, binding] of Object.entries(publishedNode.inputs)) {
      if (
        binding.kind === 'LITERAL' &&
        (proposal.inputs[port] !== binding.value || proposal.outputs[port] !== binding.value)
      )
        throw new Dnd5eEffectActionCompilerError(
          'The committed D&D test proposal payload is invalid.'
        )
    }
    // An amount rolled by the graph's own dice is the traced output it is bound to.
    const amountBinding = publishedNode.inputs.amount
    if (amountBinding?.kind === 'NODE_OUTPUT') {
      const source = entryDamageTraces.find((trace) => trace.nodeId === amountBinding.nodeId)
      if (
        !source ||
        proposal.inputs.amount !== source.outputs[amountBinding.port] ||
        proposal.outputs.amount !== proposal.inputs.amount
      )
        throw new Dnd5eEffectActionCompilerError(
          'The committed D&D test proposal payload is invalid.'
        )
    }
  }
  const applications: CharacterRuleActionApplication[] = []
  // Each path applies its proposal, then the condition proposed beside it; trace node ids are unique.
  const authorizedNodeIds = authorizedPaths.flatMap((path) => [
    `proposal-${path.toLowerCase()}`,
    `proposal-${path.toLowerCase()}${CONDITION_PROPOSAL_SUFFIX}`
  ])
  for (const nodeId of authorizedNodeIds) {
    const proposal = proposalTraces.find((trace) => trace.nodeId === nodeId)
    if (!proposal) continue
    // A creature immune to the condition takes only the rest of its path.
    if (
      proposal.operation.key === DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY &&
      proposal.inputs.conditionImmune === true
    )
      continue
    if (
      proposal.outputs.applicationCandidate !== true ||
      (replacementPath === undefined && proposal.outputs.authorized !== true)
    )
      throw new Dnd5eEffectActionCompilerError('The committed D&D test proposal is unauthorized.')
    if (proposal.outputs.targetActorId !== input.targetActorId)
      throw new Dnd5eEffectActionCompilerError('The committed D&D test proposal target is invalid.')
    const directOperation = DND5E_DIRECT_OPERATION_BY_PATH_GATED_OPERATION.get(
      proposal.operation.key
    )
    if (!directOperation)
      throw new Dnd5eEffectActionCompilerError('The committed D&D test proposal is invalid.')
    const replacementProposal =
      replacementPath === undefined
        ? proposal
        : {
            ...proposal,
            inputs: { ...proposal.inputs, resolvedPath: replacementPath },
            outputs: {
              ...proposal.outputs,
              resolvedPath: replacementPath,
              authorized: true
            }
          }
    const {
      resolvedPath: _resolvedPath,
      authoredPath: _authoredPath,
      ...outputs
    } = replacementProposal.outputs
    const direct = interpretDirect(
      {
        ...input,
        execution: {
          ...input.execution,
          outputs,
          evidence: {
            ...input.execution.evidence,
            trace: [
              {
                ...replacementProposal,
                operation: { key: directOperation, contractVersion: 1 },
                outputs
              }
            ]
          }
        }
      },
      {
        nodes: published.definition.nodes,
        source: {
          definitionId: published.id,
          gameSystemId: published.gameSystemId,
          definitionFamilyKey: published.definitionFamilyKey,
          checksum: published.checksum
        }
      }
    )
    const traced = direct.map((application) => ({
      ...application,
      // An attack that hit as a critical hit makes its damage critical (D96).
      ...(application.kind === 'DAMAGE' ? { critical: attack && resultPath === 'ON_CRIT' } : {}),
      sourceNodeId: replacementProposal.nodeId,
      sourceOperationKey: replacementProposal.operation.key,
      authoredPath: replacementProposal.outputs.authoredPath as string,
      resolvedPath: replacementProposal.outputs.resolvedPath as string
    }))
    applications.push(...traced)
    for (const application of traced) {
      if (
        application.kind === 'CONDITION_APPLY' ||
        application.kind === 'CONDITION_REMOVE' ||
        application.kind === 'TEMPORARY_HIT_POINTS_RELEASE' ||
        application.kind === 'HIT_POINT_MAXIMUM_REDUCTION' ||
        application.kind === 'SCALAR_REDUCTION' ||
        application.kind === 'STABILIZE' ||
        application.kind === 'REVIVE' ||
        application.kind === 'KILL_NEGATED' ||
        application.kind === 'DEPART'
      )
        continue
      input =
        application.kind === 'KILL'
          ? { ...input, currentHitPoints: 0, temporaryHitPoints: 0 }
          : {
              ...input,
              currentHitPoints: application.afterCurrentHitPoints,
              temporaryHitPoints: application.afterTemporaryHitPoints
            }
    }
  }
  return applications
}
export function interpretDirectProposal(
  input: DirectInterpretationInput,
  graph: Pick<CompiledRuleGraph, 'nodes' | 'source'>
): readonly CharacterRuleActionApplication[] {
  const { outputs, evidence } = input.execution
  const trace = evidence.trace[0]
  if (outputs.targetActorId !== input.targetActorId || !trace || evidence.trace.length !== 1)
    throw new Dnd5eEffectActionCompilerError(
      'The committed D&D rule action did not produce one exact hit-point proposal.'
    )
  const publishedNode = graph.nodes.find((node) => node.id === trace.nodeId)
  const expectedOperation =
    publishedNode &&
    (DND5E_DIRECT_OPERATION_BY_PATH_GATED_OPERATION.get(publishedNode.operation.key) ??
      publishedNode.operation.key)
  if (
    !publishedNode ||
    trace.nodeId !== publishedNode.id ||
    trace.operation.key !== expectedOperation ||
    trace.operation.contractVersion !== publishedNode.operation.contractVersion ||
    evidence.source.definitionId !== graph.source.definitionId ||
    evidence.source.gameSystemId !== graph.source.gameSystemId ||
    evidence.source.definitionFamilyKey !== graph.source.definitionFamilyKey ||
    evidence.source.checksum !== graph.source.checksum
  )
    throw new Dnd5eEffectActionCompilerError('The committed D&D rule action source is invalid.')
  if (
    trace.outputs.applicationCandidate !== true ||
    trace.outputs.targetStateChecksum !==
      input.execution.evidence.facts[DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]
  )
    throw new Dnd5eEffectActionCompilerError('The committed D&D rule action proposal is invalid.')
  // A grant changes no stored target state; its active effect owns the modifiers.
  if (
    DND5E_STATELESS_OUTCOME_OPERATION_KEYS.has(trace.operation.key) ||
    // A push changes no stored target state; the room settles it on the Scene (interpretSpatial).
    trace.operation.key === DND5E_FORCED_MOVEMENT_PROPOSAL_OPERATION_KEY
  )
    return []
  if (trace.operation.key === DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY) {
    const conditionIdBinding = publishedNode.inputs.conditionId
    const authoredPathBinding = publishedNode.inputs.authoredPath
    const graphConditionNodes = graph.nodes.filter(
      (node) =>
        node.operation.key === DND5E_CONDITION_APPLY_PROPOSAL_OPERATION_KEY ||
        node.operation.key === DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY
    )
    const legacySingleCondition =
      graphConditionNodes.length === 1 &&
      authoredPathBinding === undefined &&
      publishedNode.inputs.conditionImmune?.kind === 'FACT' &&
      publishedNode.inputs.conditionImmune.factKey === DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY
    const authoredPath =
      authoredPathBinding?.kind === 'LITERAL' && typeof authoredPathBinding.value === 'string'
        ? authoredPathBinding.value
        : proposalNodePathCode(publishedNode.id)
    const conditionBinding = publishedNode.inputs.conditionImmune
    const conditionFactKey = legacySingleCondition
      ? DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY
      : authoredPath &&
          conditionBinding?.kind === 'FACT' &&
          isPathConditionImmuneFactKey(conditionBinding.factKey, authoredPath)
        ? conditionBinding.factKey
        : undefined
    const conditionFacts = conditionImmunityFacts(graph, input.conditionImmunityIds)
    if (
      typeof outputs.conditionId !== 'string' ||
      !UUID.test(outputs.conditionId) ||
      trace.outputs.targetActorId !== input.targetActorId ||
      trace.outputs.conditionId !== outputs.conditionId ||
      conditionIdBinding?.kind !== 'LITERAL' ||
      conditionIdBinding.value !== outputs.conditionId ||
      !conditionFactKey ||
      typeof conditionFacts[conditionFactKey] !== 'boolean'
    )
      throw new Dnd5eEffectActionCompilerError(
        'The committed D&D condition proposal trace is invalid.'
      )
    if (
      trace.operation.contractVersion === 1
        ? trace.outputs.authorized !== !conditionFacts[conditionFactKey]
        : !gateEvidenceIsValid(input, publishedNode, trace, !conditionFacts[conditionFactKey])
    ) {
      throw new Dnd5eEffectActionCompilerError(
        'The committed D&D condition proposal protection evidence is invalid.'
      )
    }
    if (trace.outputs.authorized === false) return []
    return [
      {
        kind: 'CONDITION_APPLY',
        conditionId: outputs.conditionId,
        targetActorId: input.targetActorId,
        sourceNodeId: trace.nodeId,
        sourceOperationKey: trace.operation.key,
        authoredPath: null,
        resolvedPath: null
      }
    ]
  }
  if (trace.operation.key === DND5E_KILL_PROPOSAL_OPERATION_KEY) {
    if (trace.outputs.targetActorId !== input.targetActorId)
      throw new Dnd5eEffectActionCompilerError('The committed D&D kill proposal trace is invalid.')
    if (!gateEvidenceIsValid(input, publishedNode, trace))
      throw new Dnd5eEffectActionCompilerError(
        'The committed D&D kill proposal hit-point gate evidence is invalid.'
      )
    // A target above the gate's ceiling is left as it was.
    if (trace.outputs.authorized === false) return []
    return [
      {
        kind: 'KILL',
        targetActorId: input.targetActorId,
        sourceNodeId: trace.nodeId,
        sourceOperationKey: trace.operation.key,
        authoredPath: null,
        resolvedPath: null
      }
    ]
  }
  const gatedHeal =
    trace.operation.key === DND5E_HEAL_PROPOSAL_OPERATION_KEY &&
    trace.operation.contractVersion === 2
  if (gatedHeal) {
    if (!gateEvidenceIsValid(input, publishedNode, trace))
      throw new Dnd5eEffectActionCompilerError(
        'The committed D&D heal proposal hit-point gate evidence is invalid.'
      )
    // A target outside the gate's band is left as it was.
    if (trace.outputs.authorized === false) return []
  }
  if (trace.outputs.authorized !== true)
    throw new Dnd5eEffectActionCompilerError('The committed D&D rule action proposal is invalid.')
  if (trace.operation.key === DND5E_REVIVE_PROPOSAL_OPERATION_KEY) {
    if (
      trace.outputs.targetActorId !== input.targetActorId ||
      (outputs.hitPoints !== 'ONE' && outputs.hitPoints !== 'MAXIMUM') ||
      trace.outputs.hitPoints !== outputs.hitPoints ||
      publishedNode.inputs.hitPoints?.kind !== 'LITERAL' ||
      publishedNode.inputs.hitPoints.value !== outputs.hitPoints
    )
      throw new Dnd5eEffectActionCompilerError(
        'The committed D&D revive proposal trace is invalid.'
      )
    return [
      {
        kind: 'REVIVE',
        hitPoints: outputs.hitPoints,
        targetActorId: input.targetActorId,
        sourceNodeId: trace.nodeId,
        sourceOperationKey: trace.operation.key,
        authoredPath: null,
        resolvedPath: null
      }
    ]
  }
  const storedKind =
    trace.operation.key === DND5E_STABILIZE_PROPOSAL_OPERATION_KEY
      ? 'STABILIZE'
      : trace.operation.key === DND5E_DEPART_PROPOSAL_OPERATION_KEY
        ? 'DEPART'
        : null
  if (storedKind) {
    if (trace.outputs.targetActorId !== input.targetActorId)
      throw new Dnd5eEffectActionCompilerError(
        `The committed D&D ${storedKind.toLowerCase()} proposal trace is invalid.`
      )
    return [
      {
        kind: storedKind,
        targetActorId: input.targetActorId,
        sourceNodeId: trace.nodeId,
        sourceOperationKey: trace.operation.key,
        authoredPath: null,
        resolvedPath: null
      }
    ]
  }
  // Damage the floor took to nothing (a subtracted die, a negative modifier) deals none.
  if (
    trace.operation.key === DND5E_DAMAGE_PROPOSAL_OPERATION_KEY &&
    outputs.amount === 0 &&
    trace.outputs.amount === 0 &&
    trace.outputs.targetActorId === input.targetActorId
  )
    return []
  if (!positive(outputs.amount) || !hitPointStateIsValid(input))
    throw new Dnd5eEffectActionCompilerError(
      'The committed D&D rule action did not produce one exact hit-point proposal.'
    )
  if (
    trace.outputs.targetActorId !== input.targetActorId ||
    trace.outputs.amount !== outputs.amount ||
    trace.operation.contractVersion !== (gatedHeal ? 2 : 1)
  )
    throw new Dnd5eEffectActionCompilerError(
      'The committed D&D rule action proposal trace is invalid.'
    )
  const requestedAmount = outputs.amount
  if (trace.operation.key === DND5E_SCALAR_REDUCTION_PROPOSAL_OPERATION_KEY) {
    const valueDefinitionId = outputs.valueDefinitionId
    const recoveryTriggers = outputs.recoveryTriggers
    const terminalConsequence = outputs.terminalConsequence
    if (
      typeof valueDefinitionId !== 'string' ||
      !UUID.test(valueDefinitionId) ||
      typeof recoveryTriggers !== 'string' ||
      typeof terminalConsequence !== 'string' ||
      terminalConsequence !== 'TARGET_DIED'
    )
      throw new Dnd5eEffectActionCompilerError(
        'The committed D&D scalar reduction proposal is invalid.'
      )
    let parsedTriggers: unknown
    try {
      parsedTriggers = JSON.parse(recoveryTriggers)
    } catch {
      throw new Dnd5eEffectActionCompilerError(
        'The committed D&D scalar reduction recovery is invalid.'
      )
    }
    if (
      !Array.isArray(parsedTriggers) ||
      parsedTriggers.length < 1 ||
      parsedTriggers.length > 2 ||
      new Set(parsedTriggers).size !== parsedTriggers.length ||
      parsedTriggers.some((trigger) => trigger !== 'SHORT_REST' && trigger !== 'LONG_REST')
    )
      throw new Dnd5eEffectActionCompilerError(
        'The committed D&D scalar reduction recovery is invalid.'
      )
    return [
      {
        kind: 'SCALAR_REDUCTION',
        targetActorId: input.targetActorId,
        sourceNodeId: trace.nodeId,
        sourceOperationKey: trace.operation.key,
        authoredPath: null,
        resolvedPath: null,
        valueDefinitionId,
        reductionAmount: requestedAmount,
        stacking: 'ADDITIVE',
        floor: 0,
        recoveryTriggers: parsedTriggers,
        terminalConsequence: 'TARGET_DIED',
        sourceOutcomeId: input.execution.evidence.source.definitionId
      }
    ]
  }
  if (trace.operation.key === DND5E_HEAL_PROPOSAL_OPERATION_KEY) {
    const appliedAmount = Math.min(requestedAmount, input.maximumHitPoints - input.currentHitPoints)
    const afterCurrentHitPoints = input.currentHitPoints + appliedAmount
    return [
      {
        kind: 'HEAL',
        requestedAmount,
        resolvedAmount: requestedAmount,
        appliedAmount,
        beforeCurrentHitPoints: input.currentHitPoints,
        afterCurrentHitPoints,
        beforeTemporaryHitPoints: input.temporaryHitPoints,
        afterTemporaryHitPoints: input.temporaryHitPoints,
        maximumHitPoints: input.maximumHitPoints,
        targetActorId: input.targetActorId,
        sourceNodeId: trace.nodeId,
        sourceOperationKey: trace.operation.key,
        authoredPath: null,
        resolvedPath: null
      }
    ]
  }
  if (trace.operation.key === DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY) {
    const afterTemporaryHitPoints = Math.max(input.temporaryHitPoints, requestedAmount)
    return [
      {
        kind: 'TEMPORARY_HIT_POINTS',
        requestedAmount,
        resolvedAmount: requestedAmount,
        appliedAmount: afterTemporaryHitPoints - input.temporaryHitPoints,
        beforeCurrentHitPoints: input.currentHitPoints,
        afterCurrentHitPoints: input.currentHitPoints,
        beforeTemporaryHitPoints: input.temporaryHitPoints,
        afterTemporaryHitPoints,
        maximumHitPoints: input.maximumHitPoints,
        targetActorId: input.targetActorId,
        sourceNodeId: trace.nodeId,
        sourceOperationKey: trace.operation.key,
        authoredPath: null,
        resolvedPath: null
      }
    ]
  }
  if (
    trace.operation.key !== DND5E_DAMAGE_PROPOSAL_OPERATION_KEY ||
    typeof outputs.damageTypeId !== 'string' ||
    outputs.damageTypeId !== trace.outputs.damageTypeId
  )
    throw new Dnd5eEffectActionCompilerError('The committed D&D damage proposal trace is invalid.')
  uuid(outputs.damageTypeId, 'D&D damage type identity')
  const d = input.defenses.filter((x) => x.damageTypeId === outputs.damageTypeId)
  const immune = d.some((x) => x.kind === 'IMMUNITY')
  const resistant = d.some((x) => x.kind === 'RESISTANCE')
  const vulnerable = d.some((x) => x.kind === 'VULNERABILITY')
  const damageDisposition = immune
    ? 'IMMUNE'
    : resistant && vulnerable
      ? 'RESISTANT_AND_VULNERABLE'
      : resistant
        ? 'RESISTANT'
        : vulnerable
          ? 'VULNERABLE'
          : 'NORMAL'
  const resolvedAmount = resolveDispositionDamage(damageDisposition, requestedAmount)
  if (!Number.isSafeInteger(resolvedAmount))
    throw new Dnd5eEffectActionCompilerError(
      'D&D vulnerable damage exceeds the supported safe integer range.'
    )
  const temporaryLost = Math.min(input.temporaryHitPoints, resolvedAmount)
  const currentLost = Math.min(input.currentHitPoints, resolvedAmount - temporaryLost)
  return [
    {
      kind: 'DAMAGE',
      requestedAmount,
      resolvedAmount,
      appliedAmount: temporaryLost + currentLost,
      beforeCurrentHitPoints: input.currentHitPoints,
      afterCurrentHitPoints: input.currentHitPoints - currentLost,
      beforeTemporaryHitPoints: input.temporaryHitPoints,
      afterTemporaryHitPoints: input.temporaryHitPoints - temporaryLost,
      maximumHitPoints: input.maximumHitPoints,
      targetActorId: input.targetActorId,
      damageTypeId: outputs.damageTypeId,
      damageDisposition,
      critical: false,
      sourceNodeId: trace.nodeId,
      sourceOperationKey: trace.operation.key,
      authoredPath: null,
      resolvedPath: null
    }
  ]
}

export function interpretDirect(
  input: DirectInterpretationInput,
  graph: Pick<CompiledRuleGraph, 'nodes' | 'source'>,
  options: { fullTrace?: boolean } = {}
): readonly CharacterRuleActionApplication[] {
  if (!options.fullTrace) return interpretDirectProposal(input, graph)
  // A nested save's bands propose their outcomes in their path-gated form.
  const proposalKeys = new Set([
    ...DND5E_DIRECT_OUTCOME_OPERATION_KEYS,
    DND5E_FORCED_MOVEMENT_PROPOSAL_OPERATION_KEY,
    ...DND5E_DIRECT_OPERATION_BY_PATH_GATED_OPERATION.keys()
  ])
  if (input.execution.evidence.trace.length !== graph.nodes.length)
    throw new Dnd5eEffectActionCompilerError(
      'The committed D&D rule action graph trace is incomplete.'
    )
  for (const [index, entry] of input.execution.evidence.trace.entries()) {
    const expected = graph.nodes[index]
    if (
      !expected ||
      entry.nodeId !== expected.id ||
      entry.operation.key !== expected.operation.key ||
      entry.operation.contractVersion !== expected.operation.contractVersion
    )
      throw new Dnd5eEffectActionCompilerError(
        'The committed D&D rule action graph topology is invalid.'
      )
  }
  const proposals = input.execution.evidence.trace.filter((entry) =>
    proposalKeys.has(entry.operation.key)
  )
  // A direct relationship applies nothing here; its active effect plan owns the held state.
  if (
    proposals.length === 0 &&
    input.execution.evidence.trace.some(
      (entry) => entry.operation.key === DND5E_ACTOR_RELATIONSHIP_STATE_OPERATION_KEY
    )
  )
    return []
  if (proposals.length === 0)
    throw new Dnd5eEffectActionCompilerError(
      'The committed D&D rule action must contain an application proposal.'
    )
  const applications: CharacterRuleActionApplication[] = []
  for (const originalProposal of proposals) {
    let proposal = originalProposal
    let nestedPaths: { authoredPath: string; resolvedPath: string } | null = null
    const proposalNode = graph.nodes.find((node) => node.id === proposal.nodeId)
    // A gated nested save band reads the save's path through its gate node.
    const gatedPath = proposalNode?.inputs.resolvedPath
    const gateNode =
      gatedPath?.kind === 'NODE_OUTPUT'
        ? graph.nodes.find(
            (node) =>
              node.id === gatedPath.nodeId &&
              node.operation.key === DND5E_NESTED_SAVE_GATE_OPERATION_KEY
          )
        : undefined
    const directOperation = DND5E_DIRECT_OPERATION_BY_PATH_GATED_OPERATION.get(
      proposal.operation.key
    )
    const nestedCondition = proposal.operation.key === DND5E_TEST_CONDITION_PROPOSAL_OPERATION_KEY
    // A failure-margin rider's condition, gated by the margin its save total is compared against.
    const riderCondition =
      nestedCondition &&
      proposal.operation.contractVersion ===
        dnd5eTestMarginConditionProposalOperation.contractVersion
    if (directOperation) {
      const operation = dnd5ePathGatedProposalOperations.find(
        ({ key, contractVersion }) =>
          key === proposal.operation.key && contractVersion === proposal.operation.contractVersion
      )
      const saveNode = graph.nodes.find((node) => node.id === 'nested-save-test')
      const save = input.execution.evidence.trace.find((entry) => entry.nodeId === saveNode?.id)
      const die = input.execution.evidence.trace.find((entry) => entry.nodeId === 'nested-save-d20')
      const path = proposalNode?.inputs.resolvedPath
      const gateTrace = input.execution.evidence.trace.find(
        (entry) => entry.nodeId === gateNode?.id
      )
      const gateSource = gateNode?.inputs.resultPath
      const protection = proposalNode?.inputs.conditionImmune
      const conditionFacts = conditionImmunityFacts(graph, input.conditionImmunityIds)
      const marginNode = riderCondition
        ? graph.nodes.find((node) => node.id === NESTED_SAVE_MARGIN_NODE_ID)
        : undefined
      const margin = input.execution.evidence.trace.find((entry) => entry.nodeId === marginNode?.id)
      const marginCleared = proposalNode?.inputs.marginCleared
      const marginTotal = marginNode?.inputs.value
      if (
        !proposalNode ||
        !operation ||
        (riderCondition &&
          (marginNode?.operation.key !== compareThresholdRuleOperation.key ||
            marginNode.operation.contractVersion !==
              compareThresholdRuleOperation.contractVersion ||
            !margin ||
            marginTotal?.kind !== 'NODE_OUTPUT' ||
            marginTotal.nodeId !== 'nested-save-test' ||
            marginTotal.port !== 'total' ||
            marginNode.inputs.threshold?.kind !== 'LITERAL' ||
            marginCleared?.kind !== 'NODE_OUTPUT' ||
            marginCleared.nodeId !== marginNode.id ||
            marginCleared.port !== 'passed')) ||
        !saveNode ||
        saveNode.operation.key !== DND5E_SAVE_TEST_OPERATION_KEY ||
        !save ||
        die?.operation.key !== 'evidence.integer-range' ||
        die.evidence?.kind !== 'INTEGER_RANGE' ||
        die.inputs.min !== 1 ||
        die.inputs.max !== 20 ||
        die.outputs.value !== die.evidence.value ||
        path?.kind !== 'NODE_OUTPUT' ||
        path.port !== 'resultPath' ||
        (gateNode
          ? gateNode.operation.contractVersion !== dnd5eNestedSaveGateOperation.contractVersion ||
            !gateTrace ||
            gateSource?.kind !== 'NODE_OUTPUT' ||
            gateSource.nodeId !== saveNode.id ||
            gateSource.port !== 'resultPath' ||
            !gateEvidenceIsValid(input, gateNode, gateTrace)
          : path.nodeId !== saveNode.id) ||
        (nestedCondition &&
          (protection?.kind !== 'FACT' ||
            input.execution.evidence.facts[protection.factKey] !==
              conditionFacts[protection.factKey])) ||
        input.execution.evidence.source.definitionId !== graph.source.definitionId ||
        input.execution.evidence.source.gameSystemId !== graph.source.gameSystemId ||
        input.execution.evidence.source.definitionFamilyKey !== graph.source.definitionFamilyKey ||
        input.execution.evidence.source.checksum !== graph.source.checksum
      )
        throw new Dnd5eEffectActionCompilerError(
          'The committed D&D nested condition binding is invalid.'
        )
      const addedDiceNodeId = 'nested-save-d20-added-dice'
      requireDnd5eAddedDiceTotal({
        trace: input.execution.evidence.trace.find((entry) => entry.nodeId === addedDiceNodeId),
        facts: input.execution.evidence.facts,
        d20NodeId: 'nested-save-d20',
        nodeIndex: graph.nodes.findIndex((node) => node.id === addedDiceNodeId),
        occurrenceId: input.occurrenceId,
        invalid: () =>
          new Dnd5eEffectActionCompilerError(
            'The committed D&D nested condition evidence is invalid.'
          )
      })
      const verified: readonly (readonly [
        typeof saveNode,
        typeof save,
        { execute: (inputs: Readonly<Record<string, RuleValue>>) => Record<string, RuleValue> }
      ])[] = [
        [saveNode, save, dnd5eSaveTestOperation],
        ...(gateNode && gateTrace
          ? [[gateNode, gateTrace, dnd5eNestedSaveGateOperation] as const]
          : []),
        ...(marginNode && margin
          ? [[marginNode, margin, compareThresholdRuleOperation] as const]
          : []),
        [proposalNode, proposal, operation]
      ]
      for (const [node, trace, operation] of verified) {
        const expectedInputs: Record<string, RuleValue> = {}
        for (const [port, binding] of Object.entries(node.inputs)) {
          const value =
            binding.kind === 'LITERAL'
              ? binding.value
              : binding.kind === 'FACT'
                ? input.execution.evidence.facts[binding.factKey]
                : input.execution.evidence.trace.find((entry) => entry.nodeId === binding.nodeId)
                    ?.outputs[binding.port]
          if (value === undefined)
            throw new Dnd5eEffectActionCompilerError(
              'The committed D&D nested condition input is unavailable.'
            )
          expectedInputs[port] = value
        }
        if (
          checksumRuleDocument(trace.inputs) !== checksumRuleDocument(expectedInputs) ||
          checksumRuleDocument(trace.outputs) !==
            checksumRuleDocument(operation.execute(expectedInputs))
        )
          throw new Dnd5eEffectActionCompilerError(
            'The committed D&D nested condition evidence is invalid.'
          )
      }
      if (
        proposal.outputs.targetActorId !== input.targetActorId ||
        proposal.outputs.targetStateChecksum !==
          input.execution.evidence.facts[DND5E_TARGET_STATE_CHECKSUM_FACT_KEY] ||
        typeof proposal.outputs.authoredPath !== 'string' ||
        typeof proposal.outputs.resolvedPath !== 'string'
      )
        throw new Dnd5eEffectActionCompilerError(
          'The committed D&D nested condition target is invalid.'
        )
      if (!proposal.outputs.authorized) continue
      if (nestedCondition) {
        // A condition gated on damage that reduced the target to 0 is left unapplied when it did not.
        if (!reducedToZeroGateHolds(gateNode?.inputs ?? proposalNode.inputs, applications)) continue
        if (typeof proposal.outputs.conditionId !== 'string')
          throw new Dnd5eEffectActionCompilerError(
            'The committed D&D nested condition identity is invalid.'
          )
        applications.push({
          kind: 'CONDITION_APPLY',
          conditionId: proposal.outputs.conditionId,
          targetActorId: input.targetActorId,
          sourceNodeId: proposal.nodeId,
          sourceOperationKey: proposal.operation.key,
          authoredPath: proposal.outputs.authoredPath,
          resolvedPath: proposal.outputs.resolvedPath
        })
        continue
      }
      nestedPaths = {
        authoredPath: proposal.outputs.authoredPath,
        resolvedPath: proposal.outputs.resolvedPath
      }
      const {
        resolvedPath: _resolvedPath,
        authoredPath: _authoredPath,
        ...outputs
      } = proposal.outputs
      proposal = { ...proposal, operation: { key: directOperation, contractVersion: 1 }, outputs }
    }
    const amountBinding = proposalNode?.inputs.amount
    const resolvedAmount =
      amountBinding?.kind === 'NODE_OUTPUT'
        ? input.execution.evidence.trace.find((entry) => entry.nodeId === amountBinding.nodeId)
            ?.outputs[amountBinding.port]
        : undefined
    const interpreted = interpretDirectProposal(
      {
        ...input,
        execution: {
          ...input.execution,
          outputs: {
            ...proposal.outputs,
            ...(resolvedAmount !== undefined ? { amount: resolvedAmount } : {})
          },
          evidence: {
            ...input.execution.evidence,
            trace: [
              resolvedAmount === undefined
                ? proposal
                : {
                    ...proposal,
                    outputs: { ...proposal.outputs, amount: resolvedAmount }
                  }
            ]
          }
        }
      },
      graph
    )
    // A proposal gated on damage that reduced the target to 0 is left unapplied when it did not.
    const direct =
      proposalNode && !reducedToZeroGateHolds(gateNode?.inputs ?? proposalNode.inputs, applications)
        ? []
        : interpreted
    applications.push(
      ...direct.map((application) =>
        nestedPaths
          ? { ...application, ...nestedPaths, sourceOperationKey: originalProposal.operation.key }
          : application
      )
    )
    for (const application of direct) {
      if (
        application.kind === 'CONDITION_APPLY' ||
        application.kind === 'CONDITION_REMOVE' ||
        application.kind === 'TEMPORARY_HIT_POINTS_RELEASE' ||
        application.kind === 'HIT_POINT_MAXIMUM_REDUCTION' ||
        application.kind === 'SCALAR_REDUCTION' ||
        application.kind === 'STABILIZE' ||
        application.kind === 'REVIVE' ||
        application.kind === 'KILL_NEGATED' ||
        application.kind === 'DEPART'
      )
        continue
      const startingHitPoints = input.startingHitPoints ?? input.currentHitPoints
      input =
        application.kind === 'KILL'
          ? { ...input, startingHitPoints, currentHitPoints: 0, temporaryHitPoints: 0 }
          : {
              ...input,
              startingHitPoints,
              currentHitPoints: application.afterCurrentHitPoints,
              temporaryHitPoints: application.afterTemporaryHitPoints
            }
    }
  }
  const reductions = input.execution.evidence.trace.filter(
    (entry) => entry.operation.key === DND5E_HIT_POINT_MAXIMUM_REDUCTION_PROPOSAL_OPERATION_KEY
  )
  if (reductions.length > 1)
    throw new Dnd5eEffectActionCompilerError(
      'The committed D&D rule action has duplicate hit point maximum reductions.'
    )
  const reduction = reductions[0]
  if (reduction) {
    const publishedNode = graph.nodes.find((node) => node.id === reduction.nodeId)
    const sourceDamageNodeId = reduction.outputs.sourceDamageNodeId
    const sourceDamageOperationKey = reduction.outputs.sourceDamageOperationKey
    const sourceDamageOutcomeId = reduction.outputs.sourceDamageOutcomeId
    const recoveryTags = reduction.outputs.recoveryTags
    const parsedRecoveryTags = parseRecoveryTags(recoveryTags)
    const resultPath = reduction.outputs.resultPath
    // A nested save reads its own result path; a direct OUTCOME is published for its selected one.
    const publishedResultPath = publishedNode?.inputs.resultPath
    const publishedAuthorizedPath = publishedNode?.inputs.authorizedPath
    if (
      !publishedNode ||
      publishedNode.operation.key !== DND5E_HIT_POINT_MAXIMUM_REDUCTION_PROPOSAL_OPERATION_KEY ||
      publishedNode.operation.contractVersion !== 1 ||
      reduction.operation.contractVersion !== 1 ||
      reduction.outputs.applicationCandidate !== true ||
      reduction.outputs.targetActorId !== input.targetActorId ||
      reduction.inputs.targetActorId !== input.targetActorId ||
      reduction.outputs.targetStateChecksum !==
        input.execution.evidence.facts[DND5E_TARGET_STATE_CHECKSUM_FACT_KEY] ||
      reduction.inputs.targetStateChecksum !== reduction.outputs.targetStateChecksum ||
      typeof sourceDamageNodeId !== 'string' ||
      typeof sourceDamageOperationKey !== 'string' ||
      typeof sourceDamageOutcomeId !== 'string' ||
      !UUID.test(sourceDamageOutcomeId) ||
      !parsedRecoveryTags ||
      typeof resultPath !== 'string' ||
      reduction.inputs.resultPath !== resultPath ||
      reduction.inputs.sourceDamageNodeId !== sourceDamageNodeId ||
      reduction.inputs.sourceDamageOperationKey !== sourceDamageOperationKey ||
      reduction.inputs.sourceDamageOutcomeId !== sourceDamageOutcomeId ||
      reduction.inputs.recoveryTags !== recoveryTags ||
      publishedNode.inputs.sourceDamageNodeId?.kind !== 'LITERAL' ||
      publishedNode.inputs.sourceDamageNodeId.value !== sourceDamageNodeId ||
      publishedNode.inputs.sourceDamageOperationKey?.kind !== 'LITERAL' ||
      publishedNode.inputs.sourceDamageOperationKey.value !== sourceDamageOperationKey ||
      publishedNode.inputs.sourceDamageOutcomeId?.kind !== 'LITERAL' ||
      publishedNode.inputs.sourceDamageOutcomeId.value !== sourceDamageOutcomeId ||
      publishedNode.inputs.recoveryTags?.kind !== 'LITERAL' ||
      publishedNode.inputs.recoveryTags.value !== recoveryTags ||
      !(publishedResultPath?.kind === 'NODE_OUTPUT'
        ? publishedResultPath.nodeId === 'nested-save-test' &&
          publishedResultPath.port === 'resultPath'
        : publishedResultPath?.kind === 'LITERAL' && publishedResultPath.value === resultPath) ||
      publishedAuthorizedPath?.kind !== 'LITERAL' ||
      reduction.inputs.authorizedPath !== publishedAuthorizedPath.value ||
      reduction.outputs.authorized !== (resultPath === publishedAuthorizedPath.value)
    ) {
      throw new Dnd5eEffectActionCompilerError(
        'The committed D&D hit point maximum reduction trace is invalid.'
      )
    }
    if (reduction.outputs.authorized === true) {
      const sourceDamage = applications.filter(
        (application): application is Extract<CharacterRuleActionApplication, { kind: 'DAMAGE' }> =>
          application.kind === 'DAMAGE' &&
          application.sourceNodeId === sourceDamageNodeId &&
          application.sourceOperationKey === sourceDamageOperationKey
      )
      if (sourceDamage.length !== 1)
        throw new Dnd5eEffectActionCompilerError(
          'The committed D&D hit point maximum reduction source damage is invalid.'
        )
      const damage = sourceDamage[0]!
      if (damage.resolvedAmount > 0) {
        applications.push({
          kind: 'HIT_POINT_MAXIMUM_REDUCTION',
          targetActorId: input.targetActorId,
          sourceNodeId: reduction.nodeId,
          sourceOperationKey: reduction.operation.key,
          authoredPath: damage.authoredPath,
          resolvedPath: resultPath,
          sourceDamageNodeId,
          sourceDamageOperationKey,
          sourceDamageOutcomeId,
          reductionAmount: damage.resolvedAmount,
          recoveryTags: parsedRecoveryTags
        })
      }
    }
  }
  return applications
}

export function interpret(
  input: Parameters<CharacterRuleActionSystemAdapter['interpret']>[0]
): readonly CharacterRuleActionApplication[] {
  const resolvedTest = testApplications(input)
  if (resolvedTest) return resolvedTest
  const result = interpretDirect(
    input,
    {
      nodes: input.published.definition.nodes,
      source: {
        definitionId: input.published.id,
        gameSystemId: input.published.gameSystemId,
        definitionFamilyKey: input.published.definitionFamilyKey,
        checksum: input.published.checksum
      }
    },
    { fullTrace: true }
  )
  return result
}

export function interpretSpatial(
  input: Parameters<NonNullable<CharacterRuleActionSystemAdapter['interpretSpatial']>>[0]
): readonly CharacterRuleActionSpatialDirective[] {
  const traces = input.execution.evidence.trace.filter(
    (entry) => entry.operation.key === DND5E_FORCED_MOVEMENT_PROPOSAL_OPERATION_KEY
  )
  if (traces.length > 1)
    throw new Dnd5eEffectActionCompilerError(
      'The committed D&D rule action has duplicate movement proposals.'
    )
  const trace = traces[0]
  if (!trace) return []
  const node = input.published.definition.nodes.find((candidate) => candidate.id === trace.nodeId)
  const value = (key: string) => trace.outputs[key]
  const sourceEntryId = value('sourceEntryId')
  const direction = value('direction')
  const feet = value('feet')
  const upTo = value('upTo')
  const collision = decodeForcedMovementCollision(value('collision'))
  const bindings = input.published.definition.sourceEntryBindings?.filter(
    (binding) => binding.nodeId === trace.nodeId
  )
  // The trace must echo the published node's literals: the evidence moves only what was authored.
  const literalsEchoed =
    node !== undefined &&
    (['sourceEntryId', 'authoredPath', 'direction', 'feet', 'upTo', 'collision'] as const).every(
      (port) => {
        const binding = node.inputs[port]
        return (
          binding?.kind === 'LITERAL' &&
          binding.value === trace.inputs[port] &&
          trace.inputs[port] === value(port)
        )
      }
    )
  if (
    !node ||
    !literalsEchoed ||
    node.operation.key !== DND5E_FORCED_MOVEMENT_PROPOSAL_OPERATION_KEY ||
    node.operation.contractVersion !== 1 ||
    trace.operation.contractVersion !== 1 ||
    value('targetActorId') !== input.targetActorId ||
    trace.inputs.targetActorId !== input.targetActorId ||
    typeof sourceEntryId !== 'string' ||
    !UUID.test(sourceEntryId) ||
    bindings?.length !== 1 ||
    bindings[0]?.sourceEntryId !== sourceEntryId ||
    !isCharacterRuleActionForcedMovementDirection(direction) ||
    typeof feet !== 'number' ||
    !Number.isSafeInteger(feet) ||
    feet <= 0 ||
    typeof upTo !== 'boolean' ||
    trace.inputs.resultPath !== value('resultPath') ||
    value('targetStateChecksum') !==
      input.execution.evidence.facts[DND5E_TARGET_STATE_CHECKSUM_FACT_KEY] ||
    trace.inputs.targetStateChecksum !== value('targetStateChecksum') ||
    value('authorized') !== (value('resultPath') === value('authoredPath'))
  ) {
    throw new Dnd5eEffectActionCompilerError(
      'The committed D&D forced movement proposal is invalid.'
    )
  }
  if (value('authorized') !== true) return []
  return [
    {
      kind: 'FORCED_MOVEMENT',
      targetActorId: input.targetActorId,
      sourceNodeId: trace.nodeId,
      sourceOperationKey: trace.operation.key,
      direction,
      feet,
      upTo,
      collision,
      targetStateChecksum: String(value('targetStateChecksum'))
    }
  ]
}
