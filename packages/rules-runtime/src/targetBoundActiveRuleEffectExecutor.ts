import {
  serverRuleEvidenceResponseDtoSchema,
  serverUuidIdentityDtoSchema,
  type ServerCompletedRuleExecutionDto,
  type ServerRuleExecutionContinuationDto,
  type ServerRuleExecutionD20EvidenceDto,
  type ServerRuleExecutionD20PolicyDto,
  type ServerRuleExecutionResultDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  activeRuleEffectStateDtoSchema,
  type ActiveRuleEffectDefinitionDto
} from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type { ActiveRuleEffectLifecycleDto } from '@artificer-toolkit/schema/shared/activeRuleEffectLifecycle'
import type { CombatPerceptionRequirementDto } from '@artificer-toolkit/schema/shared/combatPerception'
import {
  checksumRuleDocument,
  type CompiledRuleGraph,
  type RuleValue
} from '@artificer-toolkit/shared/rules'

import type {
  CharacterRuleActionApplication,
  CharacterRuleActionConditionOutcomeRules
} from './characterRuleActionSystemAdapter.js'
import type { CharacterRuleActionSystemAdapterRegistry } from './characterRuleActionSystemAdapterRegistry.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import {
  selectEncounterActionD20Natural,
  type EncounterD20RollMode
} from './encounterEvidenceAnswer.js'

/**
 * Thrown when a sealed target-bound active effect cannot be evaluated against
 * its exact frozen source and current target facts. Re-exported by the
 * turn-bound wrapper for compatibility with existing callers.
 */
class CharacterActiveRuleEffectExecutionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CharacterActiveRuleEffectExecutionError'
  }
}

export type ActiveRuleEffectTargetDefense = {
  kind: 'RESISTANCE' | 'IMMUNITY' | 'VULNERABILITY'
  damageTypeId: string
}

const MAX_TARGET_DEFENSES = 128

export interface TargetBoundActiveRuleEffectExecutionInput {
  activeEffectId: string
  activeEffectVersion: number
  definition: ActiveRuleEffectDefinitionDto
  lifecycle: ActiveRuleEffectLifecycleDto
  lifecycleChecksum: string
  occurrenceId: string
  targetActorId: string
  currentHitPoints: number
  temporaryHitPoints: number
  maximumHitPoints: number
  targetScalarValues: Readonly<Record<string, number>>
  targetConditionIds: readonly string[]
  targetDerivedFacts: Readonly<Record<string, unknown>>
  defenses: readonly ActiveRuleEffectTargetDefense[]
  conditionImmunityIds?: readonly string[]
  /** Outcome rules the target's condition mechanics apply to its saves (D94). */
  conditionOutcomeRules?: CharacterRuleActionConditionOutcomeRules | null
  /**
   * Current application-layer perception result for one System-authored
   * recurring dependency. Scene geometry never enters the shared executor.
   */
  perception?: {
    requirement: CombatPerceptionRequirementDto
    satisfied: boolean
    checksum: string
  } | null
  runtime: RulesRuntimeService
  adapters: CharacterRuleActionSystemAdapterRegistry
}

export interface TargetBoundActiveRuleEffectExecutionResult {
  execution: ServerCompletedRuleExecutionDto
  applications: readonly CharacterRuleActionApplication[]
  terminal: boolean
  d20: ServerRuleExecutionD20EvidenceDto | null
}

/** A sealed kernel pause; aggregate coordinators own persistence and scheduling. */
export interface TargetBoundActiveRuleEffectExecutionPaused {
  continuation: ServerRuleExecutionContinuationDto
  evidencePolicy: ServerRuleExecutionD20PolicyDto | null
}

function canonicalConditionIds(conditionIds: readonly string[]): string[] {
  const normalized = conditionIds.map((conditionId) =>
    serverUuidIdentityDtoSchema.parse(conditionId)
  )
  if (new Set(normalized).size !== normalized.length) {
    throw new CharacterActiveRuleEffectExecutionError(
      'Active-effect target conditions must have unique identities.'
    )
  }
  return normalized.sort()
}

function requirePositiveVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new CharacterActiveRuleEffectExecutionError(
      'Active-effect version must be a positive integer.'
    )
  }
  return value
}

function immutableCopy<T>(value: T): T {
  let copied: T
  try {
    copied = structuredClone(value)
  } catch {
    throw new CharacterActiveRuleEffectExecutionError(
      'Active-effect target facts must be structured-cloneable server data.'
    )
  }
  const freeze = (candidate: unknown): void => {
    if (!candidate || typeof candidate !== 'object' || Object.isFrozen(candidate)) return
    Object.freeze(candidate)
    for (const nested of Object.values(candidate)) freeze(nested)
  }
  freeze(copied)
  return copied
}

function normalizedTargetState(input: {
  currentHitPoints: number
  temporaryHitPoints: number
  maximumHitPoints: number
  targetScalarValues: Readonly<Record<string, number>>
  targetConditionIds: readonly string[]
  targetDerivedFacts: Readonly<Record<string, unknown>>
  defenses: readonly ActiveRuleEffectTargetDefense[]
  conditionImmunityIds?: readonly string[]
}) {
  const { currentHitPoints, temporaryHitPoints, maximumHitPoints } = input
  if (
    !Number.isSafeInteger(currentHitPoints) ||
    !Number.isSafeInteger(temporaryHitPoints) ||
    !Number.isSafeInteger(maximumHitPoints) ||
    currentHitPoints < 0 ||
    temporaryHitPoints < 0 ||
    maximumHitPoints < 1 ||
    currentHitPoints > maximumHitPoints
  ) {
    throw new CharacterActiveRuleEffectExecutionError(
      'Active-effect target hit-point state is invalid.'
    )
  }
  if (input.defenses.length > MAX_TARGET_DEFENSES) {
    throw new CharacterActiveRuleEffectExecutionError(
      `Active-effect target supports at most ${MAX_TARGET_DEFENSES} defenses.`
    )
  }
  const seenDefensePairs = new Set<string>()
  const defenses = input.defenses.map((defense) => {
    if (!['RESISTANCE', 'IMMUNITY', 'VULNERABILITY'].includes(defense.kind)) {
      throw new CharacterActiveRuleEffectExecutionError(
        'Active-effect target defense kind is invalid.'
      )
    }
    const damageTypeId = serverUuidIdentityDtoSchema.parse(defense.damageTypeId)
    if (defense.damageTypeId !== damageTypeId) {
      throw new CharacterActiveRuleEffectExecutionError(
        'Active-effect target defense identity must use canonical UUID spelling.'
      )
    }
    const pairKey = `${defense.kind}:${damageTypeId}`
    if (seenDefensePairs.has(pairKey)) {
      throw new CharacterActiveRuleEffectExecutionError(
        'Active-effect target defenses must not repeat an exact defense disposition.'
      )
    }
    seenDefensePairs.add(pairKey)
    return Object.freeze({ kind: defense.kind, damageTypeId })
  })
  const suppliedConditionImmunityIds = input.conditionImmunityIds ?? []
  const conditionImmunityIds = canonicalConditionIds(suppliedConditionImmunityIds)
  if (conditionImmunityIds.length !== suppliedConditionImmunityIds.length) {
    throw new CharacterActiveRuleEffectExecutionError(
      'Active-effect target condition immunities must not repeat an identity.'
    )
  }
  return Object.freeze({
    currentHitPoints,
    temporaryHitPoints,
    maximumHitPoints,
    targetScalarValues: immutableCopy(input.targetScalarValues),
    targetConditionIds: canonicalConditionIds(input.targetConditionIds),
    targetDerivedFacts: immutableCopy(input.targetDerivedFacts),
    defenses: Object.freeze(defenses),
    conditionImmunityIds: Object.freeze(conditionImmunityIds)
  })
}

function requireBinding(definition: ActiveRuleEffectDefinitionDto): void {
  const bindings = definition.frozenGraph.sourceEntryBindings ?? []
  if (
    bindings.filter(
      (binding) =>
        binding.sourceEntryId === definition.compiledEntryId &&
        binding.nodeId === definition.frozenGraphNodeId
    ).length !== 1
  ) {
    throw new CharacterActiveRuleEffectExecutionError(
      'Active-effect source entry does not bind exactly one frozen graph node.'
    )
  }
}

/**
 * The kernel seals only facts declared by the frozen graph. Adapter metadata
 * may be needed to derive those facts but must never become continuation
 * payload merely because it was present in an active-effect descriptor.
 */
function graphFacts(input: {
  graph: CompiledRuleGraph
  boundFacts: Readonly<Record<string, RuleValue>>
}): Readonly<Record<string, RuleValue>> {
  const facts: Record<string, RuleValue> = {}
  const requiredKeys = new Set<string>()
  for (const binding of [
    ...input.graph.nodes.flatMap((node) => Object.values(node.inputs)),
    ...Object.values(input.graph.outputs)
  ]) {
    if (binding.kind === 'FACT') requiredKeys.add(binding.factKey)
  }
  for (const key of requiredKeys) {
    const value = input.boundFacts[key]
    if (value !== undefined) facts[key] = value
  }
  return Object.freeze(facts)
}

function requireTraceBinding(input: {
  execution: ServerCompletedRuleExecutionDto
  definition: ActiveRuleEffectDefinitionDto
}): void {
  const { execution, definition } = input
  if (
    execution.evidence.source.definitionId !== definition.frozenGraph.source.definitionId ||
    execution.evidence.source.gameSystemId !== definition.frozenGraph.source.gameSystemId ||
    execution.evidence.source.definitionFamilyKey !==
      definition.frozenGraph.source.definitionFamilyKey ||
    execution.evidence.source.checksum !== definition.frozenGraph.source.checksum ||
    execution.evidence.capabilityContractVersion !==
      definition.frozenGraph.capabilityContractVersion ||
    execution.evidence.sourceEntryBindings?.filter(
      (binding) =>
        binding.sourceEntryId === definition.compiledEntryId &&
        binding.nodeId === definition.frozenGraphNodeId
    ).length !== 1 ||
    execution.evidence.trace.filter((entry) => entry.nodeId === definition.frozenGraphNodeId)
      .length !== 1
  ) {
    throw new CharacterActiveRuleEffectExecutionError(
      'Active-effect execution evidence does not prove the exact frozen source entry.'
    )
  }
}

function requireSupportedApplications(input: {
  applications: readonly CharacterRuleActionApplication[]
  execution: Extract<ServerRuleExecutionResultDto, { status: 'COMPLETE' }>
  frozenGraphNodeId: string
  activeEffectId: string
  emptyApplicationAllowed?: boolean
}): void {
  const { applications, execution, frozenGraphNodeId, activeEffectId, emptyApplicationAllowed } =
    input
  const suppressedCondition =
    applications.length === 0 &&
    execution.evidence.trace.filter(
      (entry) =>
        entry.nodeId === frozenGraphNodeId &&
        entry.outputs.applicationCandidate === true &&
        entry.outputs.authorized === false
    ).length === 1
  if (
    (!suppressedCondition && !emptyApplicationAllowed && applications.length === 0) ||
    applications.some(
      (application) =>
        application.sourceNodeId !== frozenGraphNodeId ||
        (application.kind === 'CONDITION_REMOVE' &&
          application.sourceActiveEffectId !== activeEffectId) ||
        !['HEAL', 'TEMPORARY_HIT_POINTS', 'DAMAGE', 'CONDITION_APPLY', 'CONDITION_REMOVE'].includes(
          application.kind
        )
    )
  ) {
    throw new CharacterActiveRuleEffectExecutionError(
      'Active-effect execution produced an unsupported or unbound application.'
    )
  }
}

function prepare(input: TargetBoundActiveRuleEffectExecutionInput) {
  const activeEffectId = serverUuidIdentityDtoSchema.parse(input.activeEffectId)
  const occurrenceId = serverUuidIdentityDtoSchema.parse(input.occurrenceId)
  const targetActorId = serverUuidIdentityDtoSchema.parse(input.targetActorId)
  const version = requirePositiveVersion(input.activeEffectVersion)
  const state = activeRuleEffectStateDtoSchema.parse({
    definition: input.definition,
    lifecycle: input.lifecycle
  })
  const definition = state.definition
  const lifecycle = state.lifecycle
  if (checksumRuleDocument(lifecycle) !== input.lifecycleChecksum) {
    throw new CharacterActiveRuleEffectExecutionError(
      'Active-effect lifecycle checksum does not match its exact current state.'
    )
  }
  requireBinding(definition)
  const adapter = input.adapters.get(definition.frozenGraph.source.gameSystemId)
  const bindActiveEffectFacts = adapter?.bindActiveEffectFacts
  const interpretActiveEffect = adapter?.interpretActiveEffect
  if (!adapter || !bindActiveEffectFacts || !interpretActiveEffect) {
    throw new CharacterActiveRuleEffectExecutionError(
      'The frozen active-effect Game System has no recurring-effect adapter.'
    )
  }
  const target = normalizedTargetState(input)
  adapter.preflightActiveEffectTargetProtection?.({
    definition,
    targetDerivedFacts: target.targetDerivedFacts
  })
  const bound = bindActiveEffectFacts({
    activeEffectId,
    definition,
    lifecycle,
    targetActorId,
    targetDerivedFacts: target.targetDerivedFacts,
    targetConditionIds: target.targetConditionIds,
    currentHitPoints: target.currentHitPoints,
    temporaryHitPoints: target.temporaryHitPoints,
    maximumHitPoints: target.maximumHitPoints,
    targetScalarValues: target.targetScalarValues,
    defenses: target.defenses,
    conditionImmunityIds: target.conditionImmunityIds,
    conditionOutcomeRules: input.conditionOutcomeRules ?? null,
    perception: input.perception ?? null
  })
  return {
    activeEffectId,
    occurrenceId,
    targetActorId,
    version,
    definition,
    lifecycle,
    interpretActiveEffect,
    target,
    facts: graphFacts({ graph: definition.frozenGraph, boundFacts: bound.facts }),
    evidencePolicy: bound.evidencePolicy
  }
}

/** The d20 faces a roller produced and the mode they were rolled with. */
type D20Roll = { rawFaces: readonly number[]; rollMode: EncounterD20RollMode }

/**
 * Whether the pause asks for one die of the frozen graph's own damage: an optional integer range
 * from 1 that the graph enables only for the authored result (a placed zone's failed entry save).
 */
export function isDamageDieRequest(continuation: ServerRuleExecutionContinuationDto): boolean {
  const { request, graph } = continuation
  const node = graph.nodes.find((candidate) => candidate.id === request.nodeId)
  return (
    request.kind === 'INTEGER_RANGE' &&
    request.min === 1 &&
    node?.operation.key === 'evidence.optional-integer-range' &&
    node.inputs.min?.kind === 'LITERAL' &&
    node.inputs.min.value === 1 &&
    node.inputs.max?.kind === 'LITERAL' &&
    node.inputs.max.value === request.max
  )
}

function requirePolicyContinuationMatch(input: {
  policy: ServerRuleExecutionD20PolicyDto | null
  continuation: ServerRuleExecutionContinuationDto
}): void {
  const { policy, continuation } = input
  if (!policy) return
  if (
    !isDamageDieRequest(continuation) &&
    (continuation.request.kind !== 'INTEGER_RANGE' ||
      continuation.request.nodeId !== policy.requestNodeId ||
      continuation.request.min !== 1 ||
      continuation.request.max !== 20)
  ) {
    throw new CharacterActiveRuleEffectExecutionError(
      'The active-effect d20 evidence request does not match its frozen policy.'
    )
  }
  if (checksumRuleDocument(policy.contributors) !== policy.contributorChecksum) {
    throw new CharacterActiveRuleEffectExecutionError(
      'The active-effect d20 contributor evidence does not match its frozen policy.'
    )
  }
}

function d20EvidenceForCompletion(input: {
  policy: ServerRuleExecutionD20PolicyDto | null
  execution: Extract<ServerRuleExecutionResultDto, { status: 'COMPLETE' }>
  occurrenceId: string
  roll?: D20Roll
}): ServerRuleExecutionD20EvidenceDto | null {
  const { policy, execution, occurrenceId, roll } = input
  if (!policy && roll === undefined) return null
  if (!policy || roll === undefined)
    throw new CharacterActiveRuleEffectExecutionError(
      'The active-effect d20 policy and raw evidence must either both be present or both be absent.'
    )
  const trace = execution.evidence.trace.filter(
    (entry) =>
      entry.nodeId === policy.requestNodeId &&
      entry.operation.key === 'evidence.integer-range' &&
      entry.operation.contractVersion === 1
  )
  const entry = trace[0]
  if (
    trace.length !== 1 ||
    entry?.evidence?.kind !== 'INTEGER_RANGE' ||
    entry.evidence.requestId !== `${occurrenceId}:0:${policy.requestNodeId}` ||
    !Number.isSafeInteger(entry.evidence.value) ||
    entry.evidence.value < 1 ||
    entry.evidence.value > 20 ||
    typeof execution.outputs.resultPath !== 'string' ||
    typeof execution.outputs.total !== 'number'
  ) {
    throw new CharacterActiveRuleEffectExecutionError(
      'The active-effect completion does not bind its exact d20 evidence request.'
    )
  }
  const { rawFaces, rollMode } = roll
  if (
    rawFaces.length !== (rollMode === 'NORMAL' ? 1 : 2) ||
    rawFaces.some((face) => !Number.isSafeInteger(face) || face < 1 || face > 20)
  )
    throw new CharacterActiveRuleEffectExecutionError(
      'The active-effect d20 raw faces are invalid.'
    )
  const selectedNatural = selectEncounterActionD20Natural(rollMode, rawFaces)
  if (
    selectedNatural !== entry.evidence.value ||
    execution.outputs.total !== selectedNatural + policy.modifier
  ) {
    throw new CharacterActiveRuleEffectExecutionError(
      'The active-effect d20 evidence does not match the completed rule trace.'
    )
  }
  return {
    requestId: entry.evidence.requestId,
    rollMode,
    derivedRollMode: policy.rollMode,
    rawFaces: [...rawFaces],
    selectedNatural,
    contributors: [...policy.contributors],
    contributorChecksum: policy.contributorChecksum,
    modifier: policy.modifier,
    total: execution.outputs.total,
    defenseOrDc: policy.dc,
    resultPath: execution.outputs.resultPath
  }
}

function complete(input: {
  prepared: ReturnType<typeof prepare>
  execution: Extract<ServerRuleExecutionResultDto, { status: 'COMPLETE' }>
  graph: CompiledRuleGraph
  roll?: D20Roll
}): TargetBoundActiveRuleEffectExecutionResult {
  const { prepared, execution, graph } = input
  requireTraceBinding({ execution, definition: prepared.definition })
  const interpreted = prepared.interpretActiveEffect({
    execution,
    occurrenceId: prepared.occurrenceId,
    activeEffectId: prepared.activeEffectId,
    definition: prepared.definition,
    lifecycle: prepared.lifecycle,
    graph,
    targetActorId: prepared.targetActorId,
    currentHitPoints: prepared.target.currentHitPoints,
    temporaryHitPoints: prepared.target.temporaryHitPoints,
    maximumHitPoints: prepared.target.maximumHitPoints,
    defenses: prepared.target.defenses,
    conditionImmunityIds: prepared.target.conditionImmunityIds
  })
  requireSupportedApplications({
    applications: interpreted.applications,
    execution,
    frozenGraphNodeId: prepared.definition.frozenGraphNodeId,
    activeEffectId: prepared.activeEffectId,
    emptyApplicationAllowed: interpreted.emptyApplicationAllowed
  })
  // A graph that declares the output decides whether the contacted creature's movement stops.
  if (
    graph.outputs.movementInterruption &&
    typeof execution.outputs.movementInterruption !== 'boolean'
  )
    throw new CharacterActiveRuleEffectExecutionError(
      'The active-effect movement interruption output is invalid.'
    )
  return {
    execution: graph.outputs.movementInterruption
      ? {
          ...execution,
          movementInterruption: execution.outputs.movementInterruption ? { kind: 'STOP' } : null
        }
      : execution,
    applications: interpreted.applications,
    terminal: interpreted.terminal,
    d20: d20EvidenceForCompletion({
      policy: prepared.evidencePolicy,
      execution,
      occurrenceId: prepared.occurrenceId,
      ...(input.roll ? { roll: input.roll } : {})
    })
  }
}

function requireFrozenGraphMatch(input: {
  graph: CompiledRuleGraph
  definition: ActiveRuleEffectDefinitionDto
}): void {
  if (checksumRuleDocument(input.graph) !== checksumRuleDocument(input.definition.frozenGraph))
    throw new CharacterActiveRuleEffectExecutionError(
      'The resumed active-effect graph does not match its frozen definition.'
    )
}

function validatePreparedContinuation(input: {
  prepared: ReturnType<typeof prepare>
  continuation: ServerRuleExecutionContinuationDto
  expectedEvidencePolicy?: ServerRuleExecutionD20PolicyDto | null
}): NonNullable<ReturnType<typeof prepare>['evidencePolicy']> {
  if (
    input.continuation.occurrenceId !== input.prepared.occurrenceId ||
    checksumRuleDocument(input.continuation.graph) !==
      checksumRuleDocument(input.prepared.definition.frozenGraph) ||
    checksumRuleDocument(input.continuation.facts) !== checksumRuleDocument(input.prepared.facts)
  )
    throw new CharacterActiveRuleEffectExecutionError(
      'The active-effect continuation does not match the current frozen execution context.'
    )
  if (
    input.expectedEvidencePolicy !== undefined &&
    checksumRuleDocument(input.expectedEvidencePolicy) !==
      checksumRuleDocument(input.prepared.evidencePolicy)
  )
    throw new CharacterActiveRuleEffectExecutionError(
      'The active-effect evidence policy no longer matches the sealed pending context.'
    )
  const policy = input.prepared.evidencePolicy
  if (!policy)
    throw new CharacterActiveRuleEffectExecutionError(
      'The active-effect continuation has no normalized d20 evidence policy.'
    )
  requirePolicyContinuationMatch({ policy, continuation: input.continuation })
  return policy
}

/** Verifies a sealed evidence pause against current bound effect facts without resuming it. */
export function verifyTargetBoundActiveRuleEffectContinuation(
  input: TargetBoundActiveRuleEffectExecutionInput & {
    continuation: ServerRuleExecutionContinuationDto
    expectedEvidencePolicy?: ServerRuleExecutionD20PolicyDto | null
  }
): void {
  validatePreparedContinuation({
    prepared: prepare(input),
    continuation: input.continuation,
    expectedEvidencePolicy: input.expectedEvidencePolicy
  })
}

export function reconstructTargetBoundActiveRuleEffectCompletion(input: {
  executionInput: TargetBoundActiveRuleEffectExecutionInput
  execution: ServerCompletedRuleExecutionDto
  d20Evidence?: ServerRuleExecutionD20EvidenceDto | null
}): TargetBoundActiveRuleEffectExecutionResult {
  const prepared = prepare(input.executionInput)
  return complete({
    prepared,
    execution: input.execution,
    graph: prepared.definition.frozenGraph,
    ...(input.d20Evidence
      ? {
          roll: { rawFaces: input.d20Evidence.rawFaces, rollMode: input.d20Evidence.rollMode }
        }
      : {})
  })
}

export async function executeTargetBoundActiveRuleEffectWithPause(
  input: TargetBoundActiveRuleEffectExecutionInput
): Promise<
  TargetBoundActiveRuleEffectExecutionResult | TargetBoundActiveRuleEffectExecutionPaused
> {
  const prepared = prepare(input)
  const runtimeResult = await input.runtime.executeFrozen({
    graph: prepared.definition.frozenGraph,
    occurrenceId: prepared.occurrenceId,
    facts: prepared.facts
  })
  if (runtimeResult.result.status !== 'COMPLETE') {
    requirePolicyContinuationMatch({
      policy: prepared.evidencePolicy,
      continuation: runtimeResult.result.continuation
    })
    return {
      continuation: runtimeResult.result.continuation,
      evidencePolicy: prepared.evidencePolicy
    }
  }
  requireFrozenGraphMatch({ graph: runtimeResult.graph, definition: prepared.definition })
  return complete({ prepared, execution: runtimeResult.result, graph: runtimeResult.graph })
}

export async function resumeTargetBoundActiveRuleEffectWithPause(
  input: TargetBoundActiveRuleEffectExecutionInput & {
    continuation: ServerRuleExecutionContinuationDto
    /**
     * The d20 faces and the mode the roller rolled them with, or one die of the graph's damage with
     * the d20 roll already resolved (the completed evidence needs it).
     */
    resolution:
      | { requestId: string; rawFaces: readonly number[]; rollMode: EncounterD20RollMode }
      | { requestId: string; value: number; d20: D20Roll }
    expectedEvidencePolicy?: ServerRuleExecutionD20PolicyDto | null
  }
): Promise<
  TargetBoundActiveRuleEffectExecutionResult | TargetBoundActiveRuleEffectExecutionPaused
> {
  const prepared = prepare(input)
  validatePreparedContinuation({
    prepared,
    continuation: input.continuation,
    expectedEvidencePolicy: input.expectedEvidencePolicy
  })
  if (!input.runtime.resumeWithGraph)
    throw new CharacterActiveRuleEffectExecutionError(
      'The Rules runtime cannot resume an active-effect graph with its frozen source.'
    )
  const { resolution } = input
  const die = 'value' in resolution
  if (
    resolution.requestId !== input.continuation.request.requestId ||
    die !== isDamageDieRequest(input.continuation)
  )
    throw new CharacterActiveRuleEffectExecutionError(
      'The active-effect resolution does not answer its pending request.'
    )
  const roll = die
    ? resolution.d20
    : { rawFaces: [...resolution.rawFaces], rollMode: resolution.rollMode }
  if (
    roll.rawFaces.length !== (roll.rollMode === 'NORMAL' ? 1 : 2) ||
    roll.rawFaces.some((face) => !Number.isSafeInteger(face) || face < 1 || face > 20) ||
    (die && !Number.isSafeInteger(resolution.value))
  )
    throw new CharacterActiveRuleEffectExecutionError(
      `The active-effect ${die ? 'die' : 'd20'} resolution is invalid.`
    )
  const resumed = await input.runtime.resumeWithGraph({
    continuation: input.continuation,
    response: serverRuleEvidenceResponseDtoSchema.parse({
      requestId: resolution.requestId,
      value: die ? resolution.value : selectEncounterActionD20Natural(roll.rollMode, roll.rawFaces)
    })
  })
  if (resumed.result.status !== 'COMPLETE') {
    requirePolicyContinuationMatch({
      policy: prepared.evidencePolicy,
      continuation: resumed.result.continuation
    })
    return { continuation: resumed.result.continuation, evidencePolicy: prepared.evidencePolicy }
  }
  requireFrozenGraphMatch({ graph: resumed.graph, definition: prepared.definition })
  return complete({
    prepared,
    execution: resumed.result,
    graph: resumed.graph,
    roll
  })
}
