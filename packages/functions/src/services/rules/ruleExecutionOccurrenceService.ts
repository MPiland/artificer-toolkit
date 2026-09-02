import { randomUUID } from 'node:crypto'

import {
  createRuleOccurrenceRepository,
  withTransaction,
  type DBLike,
  type RuleOccurrenceAggregateKind,
  type RuleOccurrenceRecord
} from '@artificer-toolkit/db'
import {
  serverRuleExecutionCorrelationIdDtoSchema,
  requireServerKernelRuleExecutionPendingSnapshot,
  serverRuleExecutionPendingApplicationContextDtoSchema,
  serverRuleExecutionNestedD20EvidenceDtoSchema,
  serverRuleEvidenceResponseDtoSchema,
  serverRuleExecutionReceiptCommandMetadataDtoSchema,
  serverRuleExecutionApplicationOutputsDtoSchema,
  ruleExecutionPhaseReceiptsDtoSchema,
  type RuleGraphSourceIdentityDto,
  resolvedStartIntentRecordDtoSchema,
  serverUuidIdentityDtoSchema,
  serverPublishedRuleDefinitionDtoSchema,
  storedRuleExecutionResultDtoSchema,
  type ServerRuleExecutionReceiptCommandMetadataDto,
  type ServerPublishedRuleDefinitionDto,
  type ServerRuleExecutionApplicationOutputsDto,
  type ServerRuleExecutionNestedD20EvidenceDto,
  type ServerRuleExecutionPendingApplicationContextDto,
  type RuleExecutionPhaseReceiptsDto,
  type ManualRuleExecutionReminderDto,
  type ServerRuleExecutionResultDto,
  type StoredRuleExecutionResultDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { MAX_RULE_EXECUTION_AUTOMATIC_EVIDENCE_REQUESTS } from '@artificer-toolkit/schema/shared/rulesExecution'

import { withLockedCharacterRuleExecutionCommandContext } from '../character/characterRuleExecutionCommandContext.js'
import { lockEncounterRuleExecutionCommandContext } from '../encounter/encounterRuleExecutionCommandContext.js'
import type { LiveSessionCommandAuthority } from '../campaign/liveSessionCommandAuthority.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import { checksumRuleDocument, freezeRuleGraphFacts } from '@artificer-toolkit/shared/rules'
import type { CompiledRuleGraph } from '@artificer-toolkit/shared/rules'

export class RuleExecutionCommandMismatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RuleExecutionCommandMismatchError'
  }
}

export class RuleExecutionAggregateCurrentnessError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RuleExecutionAggregateCurrentnessError'
  }
}

export class RuleExecutionAuthorizationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RuleExecutionAuthorizationError'
  }
}

/** A fresh Encounter command cannot start while that Encounter awaits rule evidence. */
export class RuleExecutionPendingEncounterOccurrenceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RuleExecutionPendingEncounterOccurrenceError'
  }
}

export interface RuleExecutionLockedAggregateContext {
  aggregateKind: RuleOccurrenceAggregateKind
  aggregateId: string
  campaignId?: string
  actorUserId: string
  currentVersion: number
  advanceVersion(db: DBLike, expectedVersion: number): Promise<number>
}

export interface RuleExecutionAggregatePort {
  /**
   * Acquires the aggregate's established root lock and revalidates current
   * controller authority before callback execution. It must not acquire an
   * Encounter after a Character-root command.
   */
  withLockedAuthorized<T>(
    db: DBLike,
    run: (context: RuleExecutionLockedAggregateContext) => Promise<T>
  ): Promise<T>
}

export interface RuleExecutionCompletionApplicator {
  /**
   * Pure terminal mutation intent. This runs after Kernel completion and before
   * the aggregate version CAS; it must not write or acquire additional roots.
   * Existing applicators advance by default when this is omitted.
   */
  requiresAggregateAdvance?(input: {
    aggregate: Readonly<
      Pick<
        RuleExecutionLockedAggregateContext,
        'aggregateKind' | 'aggregateId' | 'campaignId' | 'actorUserId' | 'currentVersion'
      >
    >
    occurrenceId: string
    commandId: string
    correlationId: string | null
    commandFingerprint: string
    pendingApplicationContext: ServerRuleExecutionPendingApplicationContextDto
    execution: Extract<ServerRuleExecutionResultDto, { status: 'COMPLETE' }>
    /** Immutable TEST/OUTCOME evidence, when this is a bounded phased action. */
    phaseReceipts?: RuleExecutionPhaseReceiptsDto
    compiledGraph?: CompiledRuleGraph
  }): boolean
  apply(input: {
    db: DBLike
    aggregate: Readonly<
      Pick<
        RuleExecutionLockedAggregateContext,
        'aggregateKind' | 'aggregateId' | 'campaignId' | 'actorUserId' | 'currentVersion'
      >
    >
    occurrenceId: string
    commandId: string
    correlationId: string | null
    commandFingerprint: string
    pendingApplicationContext: ServerRuleExecutionPendingApplicationContextDto
    execution: Extract<ServerRuleExecutionResultDto, { status: 'COMPLETE' }>
    phaseReceipts?: RuleExecutionPhaseReceiptsDto
    /** Exact graph used by the runtime when available; never persisted in a terminal receipt. */
    compiledGraph?: CompiledRuleGraph
    proposedAggregateVersion: number
  }): Promise<
    | ServerRuleExecutionApplicationOutputsDto
    | {
        applicationOutputs: ServerRuleExecutionApplicationOutputsDto
        /** The aggregate receipt may retain the interrupted original action. */
        terminalExecution?: Extract<ServerRuleExecutionResultDto, { status: 'COMPLETE' }>
        afterResult?: (result: StoredRuleExecutionResult) => Promise<void>
      }
    | void
  >
}

type ResolvedExecutionCommand = CommandBase & {
  intent: ResolvedStartIntent
  resolve(input: {
    db: DBLike
    aggregate: Readonly<RuleExecutionLockedAggregateContext>
    occurrenceId: string
    applicationContext?: ServerRuleExecutionPendingApplicationContextDto
  }): Promise<ResolvedStartSource>
} & (
    | {
        /** A command-local applicator is terminal-only and cannot be resumed. */
        allowPaused: false
        /**
         * Exact bounded initial evidence drain for a terminal command.  The
         * default remains one request; a two-participant contest may opt into
         * its second, already-pinned d20 request.
         */
        maximumAutomaticEvidenceRequests?: 1 | 2
        completionApplicator?: RuleExecutionCompletionApplicator
        /**
         * Server-only automatic evidence for a single terminal command. The
         * resolver is deliberately command-local, side-effect-free evidence
         * derivation only: it must not write or call external systems. It is
         * never persisted and a resumed graph must complete without issuing a
         * second request.
         */
        resolveAutomaticEvidence?: (input: {
          request: Extract<
            ServerRuleExecutionResultDto,
            { status: 'PAUSED' }
          >['continuation']['request']
          occurrenceId: string
        }) => Promise<{ requestId: string; value: number }>
        /** Returns only exact server-derived nested d20 evidence; the coordinator seals it. */
        captureAutomaticEvidence?: (input: {
          request: Extract<
            ServerRuleExecutionResultDto,
            { status: 'PAUSED' }
          >['continuation']['request']
          response: { requestId: string; value: number }
        }) => Promise<ServerRuleExecutionNestedD20EvidenceDto | null>
      }
    | {
        allowPaused?: true
        completionApplicator?: never
        resolveAutomaticEvidence?: never
      }
  )

export function createCharacterRuleExecutionAggregatePort(input: {
  characterId: string
  actorUserId: string
  liveSessionAuthority?: LiveSessionCommandAuthority
}): RuleExecutionAggregatePort {
  const normalizedInput = {
    ...input,
    characterId: serverUuidIdentityDtoSchema.parse(input.characterId),
    actorUserId: serverUuidIdentityDtoSchema.parse(input.actorUserId),
    liveSessionAuthority: input.liveSessionAuthority
      ? {
          ...input.liveSessionAuthority,
          sessionId: serverUuidIdentityDtoSchema.parse(input.liveSessionAuthority.sessionId)
        }
      : undefined
  }
  return {
    async withLockedAuthorized(db, run) {
      return withLockedCharacterRuleExecutionCommandContext(db, normalizedInput, async (context) =>
        run({
          aggregateKind: 'CHARACTER',
          aggregateId: context.characterId,
          actorUserId: context.actorUserId,
          currentVersion: context.currentVersion,
          advanceVersion: (_trx, expectedVersion) => context.advanceVersion(expectedVersion)
        })
      )
    }
  }
}

export function createEncounterRuleExecutionAggregatePort(input: {
  encounterId: string
  actorUserId: string
  authority?: 'ACTIVE_MEMBER' | 'OWNER'
  liveSessionAuthority?: LiveSessionCommandAuthority
}): RuleExecutionAggregatePort {
  const normalizedInput = {
    ...input,
    authority: input.authority ?? 'OWNER',
    encounterId: serverUuidIdentityDtoSchema.parse(input.encounterId),
    actorUserId: serverUuidIdentityDtoSchema.parse(input.actorUserId),
    liveSessionAuthority: input.liveSessionAuthority
      ? {
          ...input.liveSessionAuthority,
          sessionId: serverUuidIdentityDtoSchema.parse(input.liveSessionAuthority.sessionId)
        }
      : undefined
  }
  return {
    async withLockedAuthorized(db, run) {
      const { context } = await lockEncounterRuleExecutionCommandContext(db, normalizedInput)
      return run({
        aggregateKind: 'ENCOUNTER',
        aggregateId: context.encounterId,
        campaignId: context.campaignId,
        actorUserId: context.actorUserId,
        currentVersion: context.currentVersion,
        advanceVersion: (_trx, expectedVersion) => context.advanceVersion(expectedVersion)
      })
    }
  }
}

/**
 * Creates a receipt-only Encounter port for a child occurrence that starts
 * inside the owning Encounter command's existing root transaction. This is
 * intentionally not a general authorization or lock-acquisition bypass.
 */
export type StoredRuleExecutionResult = StoredRuleExecutionResultDto

interface CommandBase {
  commandId: string
  correlationId: string | null
  expectedAggregateVersion: number
}

const RULE_EXECUTION_START = 'RULE_EXECUTION_START'
const RULE_EXECUTION_RESUME = 'RULE_EXECUTION_RESUME'

export function createRuleExecutionCommandFingerprint(
  aggregate: Pick<
    RuleExecutionLockedAggregateContext,
    'aggregateKind' | 'aggregateId' | 'actorUserId'
  >,
  command: CommandBase,
  commandType: typeof RULE_EXECUTION_START | typeof RULE_EXECUTION_RESUME,
  fields: Record<string, unknown>
): string {
  return checksumRuleDocument({
    aggregateKind: aggregate.aggregateKind,
    aggregateId: aggregate.aggregateId,
    actorUserId: aggregate.actorUserId,
    commandType,
    commandId: command.commandId,
    correlationId: command.correlationId,
    expectedAggregateVersion: command.expectedAggregateVersion,
    ...fields
  })
}

function storedResult(
  result: ServerRuleExecutionResultDto,
  occurrence: RuleOccurrenceRecord,
  applicationOutputs: ServerRuleExecutionApplicationOutputsDto = {
    kind: 'NONE'
  },
  pending: PublicPendingResult | null = null,
  phaseReceipts?: RuleExecutionPhaseReceiptsDto
): StoredRuleExecutionResult {
  if (result.status === 'PAUSED') {
    return storedRuleExecutionResultDtoSchema.parse({
      status: 'PAUSED',
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version,
      request: result.continuation.request,
      pending
    })
  }
  return storedRuleExecutionResultDtoSchema.parse({
    status: 'COMPLETE',
    occurrenceId: occurrence.id,
    occurrenceVersion: occurrence.version,
    outputs: result.outputs,
    evidence: result.evidence,
    ...(phaseReceipts ? { phaseReceipts } : {}),
    applicationOutputs: serverRuleExecutionApplicationOutputsDtoSchema.parse(applicationOutputs)
  })
}

interface RuleExecutionPhaseReceiptPlan {
  phase: 'TEST' | 'OUTCOME'
  /** The immutable authored template selected under the aggregate lock. */
  template: RuleGraphSourceIdentityDto
  /** Checksum of the exact graph specialized from that template for this run. */
  specializedChecksum: string
}

function phaseReceipt(
  plan: RuleExecutionPhaseReceiptPlan,
  execution: Extract<ServerRuleExecutionResultDto, { status: 'COMPLETE' }>,
  graph: CompiledRuleGraph | undefined
): RuleExecutionPhaseReceiptsDto[number] {
  if (!graph) {
    throw new RuleExecutionCommandMismatchError(
      'A phased rule execution must retain its compiled graph for receipt sealing.'
    )
  }
  const source = execution.evidence.source
  const boundFactsChecksum = checksumRuleDocument(
    freezeRuleGraphFacts(graph, execution.evidence.facts)
  )
  if (
    source.definitionId !== plan.template.definitionId ||
    source.gameSystemId !== plan.template.gameSystemId ||
    source.definitionFamilyKey !== plan.template.definitionFamilyKey ||
    source.checksum !== plan.specializedChecksum
  ) {
    throw new RuleExecutionCommandMismatchError(
      'Completed phase evidence does not match its sealed template and facts.'
    )
  }
  return {
    phase: plan.phase,
    template: plan.template,
    boundFactsChecksum,
    specializedChecksum: plan.specializedChecksum,
    execution
  }
}

function appendPhaseReceipt(input: {
  existing: RuleExecutionPhaseReceiptsDto | undefined
  plan: RuleExecutionPhaseReceiptPlan
  execution: Extract<ServerRuleExecutionResultDto, { status: 'COMPLETE' }>
  graph: CompiledRuleGraph | undefined
}): RuleExecutionPhaseReceiptsDto {
  const next = [...(input.existing ?? []), phaseReceipt(input.plan, input.execution, input.graph)]
  return ruleExecutionPhaseReceiptsDtoSchema.parse(next)
}

function requireOutcomeTransitionGraph(input: {
  graph: CompiledRuleGraph | undefined
  plan: RuleExecutionPhaseReceiptPlan
  execution?: Extract<ServerRuleExecutionResultDto, { status: 'COMPLETE' }>
}): CompiledRuleGraph {
  const graph = input.graph
  if (
    !graph ||
    graph.source.definitionId !== input.plan.template.definitionId ||
    graph.source.gameSystemId !== input.plan.template.gameSystemId ||
    graph.source.definitionFamilyKey !== input.plan.template.definitionFamilyKey ||
    graph.source.checksum !== input.plan.specializedChecksum
  ) {
    throw new RuleExecutionCommandMismatchError(
      'An OUTCOME transition did not retain its exact specialized graph.'
    )
  }
  if (
    input.execution &&
    (input.execution.evidence.source.definitionId !== graph.source.definitionId ||
      input.execution.evidence.source.gameSystemId !== graph.source.gameSystemId ||
      input.execution.evidence.source.definitionFamilyKey !== graph.source.definitionFamilyKey ||
      input.execution.evidence.source.checksum !== graph.source.checksum)
  ) {
    throw new RuleExecutionCommandMismatchError(
      'OUTCOME execution evidence does not match its specialized graph.'
    )
  }
  return graph
}

function completionResult(
  value:
    | ServerRuleExecutionApplicationOutputsDto
    | {
        applicationOutputs: ServerRuleExecutionApplicationOutputsDto
        terminalExecution?: Extract<ServerRuleExecutionResultDto, { status: 'COMPLETE' }>
        afterResult?: (result: StoredRuleExecutionResult) => Promise<void>
      }
    | void
): {
  applicationOutputs: ServerRuleExecutionApplicationOutputsDto
  terminalExecution?: Extract<ServerRuleExecutionResultDto, { status: 'COMPLETE' }>
  afterResult?: (result: StoredRuleExecutionResult) => Promise<void>
} {
  if (!value) return { applicationOutputs: { kind: 'NONE' } }
  return 'applicationOutputs' in value ? value : { applicationOutputs: value }
}

function requiresAggregateAdvance(
  applicator: RuleExecutionCompletionApplicator | undefined,
  input: Parameters<NonNullable<RuleExecutionCompletionApplicator['requiresAggregateAdvance']>>[0]
): boolean {
  return applicator ? (applicator.requiresAggregateAdvance?.(input) ?? true) : false
}

function replayedResult(value: StoredRuleExecutionResult): StoredRuleExecutionResult {
  try {
    return storedRuleExecutionResultDtoSchema.parse(value)
  } catch {
    throw new RuleExecutionCommandMismatchError(
      'Stored rule-execution receipt has an invalid result shape.'
    )
  }
}

function requireCurrentAggregateVersion(current: number, expected: number): void {
  if (current !== expected) {
    throw new RuleExecutionAggregateCurrentnessError(
      `Rule execution expected aggregate version ${expected}, but found ${current}.`
    )
  }
}

function receiptPayload(result: StoredRuleExecutionResult): StoredRuleExecutionResult {
  return storedRuleExecutionResultDtoSchema.parse(result)
}

/**
 * Capture hooks may seal only the exact nested OUTCOME d20 evidence. The
 * coordinator owns every other pending-context field so a domain cannot
 * replace source, target, graph, or currentness facts while resuming.
 */
function sealNestedOutcomeD20Evidence(input: {
  applicationContext: ServerRuleExecutionPendingApplicationContextDto
  request: Extract<ServerRuleExecutionResultDto, { status: 'PAUSED' }>['continuation']['request']
  response: { requestId: string; value: number }
  evidence: ServerRuleExecutionNestedD20EvidenceDto | null
}): ServerRuleExecutionPendingApplicationContextDto {
  if (input.evidence === null) return input.applicationContext
  const evidence = serverRuleExecutionNestedD20EvidenceDtoSchema.parse(input.evidence)
  if (
    (input.applicationContext.kind !== 'ENCOUNTER_CHARACTER_RULE_ACTION' &&
      input.applicationContext.kind !== 'ENCOUNTER_ACTOR_RULE_ACTION' &&
      input.applicationContext.kind !== 'ENCOUNTER_CREATURE_RULE_ACTION') ||
    input.applicationContext.twoPhase?.phase !== 'OUTCOME' ||
    !input.applicationContext.twoPhase.nestedOutcomeD20
  ) {
    throw new RuleExecutionCommandMismatchError(
      'Nested d20 evidence may be captured only for a sealed direct-action OUTCOME.'
    )
  }
  const policy = input.applicationContext.twoPhase.nestedOutcomeD20
  if (
    input.request.nodeId !== policy.requestNodeId ||
    evidence.requestNodeId !== policy.requestNodeId ||
    input.request.requestId !== evidence.requestId ||
    input.response.requestId !== evidence.requestId ||
    input.response.value !== evidence.selectedNatural ||
    evidence.rollMode !== policy.rollMode ||
    checksumRuleDocument(evidence.contributors) !== policy.contributorChecksum ||
    evidence.contributorChecksum !== policy.contributorChecksum ||
    evidence.modifier !== policy.modifier ||
    evidence.defenseOrDc !== policy.dc
  ) {
    throw new RuleExecutionCommandMismatchError(
      'Nested d20 evidence does not bind its sealed request and policy.'
    )
  }
  return serverRuleExecutionPendingApplicationContextDtoSchema.parse({
    ...input.applicationContext,
    twoPhase: {
      ...input.applicationContext.twoPhase,
      nestedOutcomeD20Evidence: evidence
    }
  })
}

function sealOptionalContestD20Evidence(input: {
  applicationContext: ServerRuleExecutionPendingApplicationContextDto
  request: Extract<ServerRuleExecutionResultDto, { status: 'PAUSED' }>['continuation']['request']
  response: { requestId: string; value: number }
  rawFaces: readonly number[]
}): ServerRuleExecutionPendingApplicationContextDto {
  if (input.applicationContext.kind !== 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST') {
    throw new RuleExecutionCommandMismatchError(
      'Optional-combat contest evidence requires a sealed contest occurrence.'
    )
  }
  if (
    input.request.kind !== 'INTEGER_RANGE' ||
    input.request.min !== 1 ||
    input.request.max !== 20 ||
    input.request.requestId !== input.response.requestId
  ) {
    throw new RuleExecutionCommandMismatchError('Optional-combat contest request is invalid.')
  }
  const participant =
    input.request.nodeId === input.applicationContext.initiator.requestNodeId
      ? 'initiator'
      : input.request.nodeId === input.applicationContext.defender.requestNodeId
        ? 'defender'
        : null
  if (!participant) {
    throw new RuleExecutionCommandMismatchError(
      'Optional-combat contest request is not assigned to a participant.'
    )
  }
  const policy = input.applicationContext[participant]
  const expectedFaces = policy.rollMode === 'NORMAL' ? 1 : 2
  if (
    input.rawFaces.length !== expectedFaces ||
    input.rawFaces.some((face) => !Number.isInteger(face) || face < 1 || face > 20)
  ) {
    throw new RuleExecutionCommandMismatchError('Optional-combat contest raw dice are invalid.')
  }
  const selected =
    policy.rollMode === 'ADVANTAGE'
      ? Math.max(...input.rawFaces)
      : policy.rollMode === 'DISADVANTAGE'
        ? Math.min(...input.rawFaces)
        : input.rawFaces[0]
  if (selected !== input.response.value) {
    throw new RuleExecutionCommandMismatchError(
      'Optional-combat contest raw dice do not match the submitted response.'
    )
  }
  const evidence = { requestId: input.request.requestId, rawFaces: [...input.rawFaces] }
  const prior = input.applicationContext.rollEvidence
  if (prior[participant] !== null || (participant === 'defender' && prior.initiator === null)) {
    throw new RuleExecutionCommandMismatchError('Optional-combat contest evidence is out of order.')
  }
  return serverRuleExecutionPendingApplicationContextDtoSchema.parse({
    ...input.applicationContext,
    rollEvidence: { ...prior, [participant]: evidence }
  })
}

type ResolvedStartIntent = Readonly<Record<string, boolean | number | string>>
type PublicPendingResult =
  | { kind: 'D20_EVIDENCE'; rollMode: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE' }
  | {
      /** Exact sealed OUTCOME requests; no source facts or graph topology are public. */
      kind: 'INTEGER_RANGE_EVIDENCE'
      phase: 'OUTCOME'
      requests: readonly { requestId: string; min: number; max: number }[]
      exactRequestSetChecksum: string
    }
  | { kind: 'LEGENDARY_RESISTANCE_CHOICE'; targetActorId: string; useOptionId: string }

function outcomePendingResult(
  request: Extract<ServerRuleExecutionResultDto, { status: 'PAUSED' }>['continuation']['request'],
  applicationContext: ServerRuleExecutionPendingApplicationContextDto
): PublicPendingResult {
  if (request.kind !== 'INTEGER_RANGE' || request.min >= request.max) {
    throw new RuleExecutionCommandMismatchError(
      'An OUTCOME phase issued an invalid evidence request.'
    )
  }
  const nestedOutcomeD20 =
    (applicationContext.kind === 'ENCOUNTER_CHARACTER_RULE_ACTION' ||
      applicationContext.kind === 'ENCOUNTER_ACTOR_RULE_ACTION' ||
      applicationContext.kind === 'ENCOUNTER_CREATURE_RULE_ACTION') &&
    applicationContext.twoPhase?.phase === 'OUTCOME'
      ? applicationContext.twoPhase.nestedOutcomeD20
      : null
  if (nestedOutcomeD20 && request.nodeId === nestedOutcomeD20.requestNodeId) {
    if (request.min !== 1 || request.max !== 20) {
      throw new RuleExecutionCommandMismatchError(
        'A nested OUTCOME d20 issued an invalid evidence request.'
      )
    }
    return { kind: 'D20_EVIDENCE', rollMode: nestedOutcomeD20.rollMode }
  }
  const requests = [{ requestId: request.requestId, min: request.min, max: request.max }]
  return {
    kind: 'INTEGER_RANGE_EVIDENCE',
    phase: 'OUTCOME',
    requests,
    exactRequestSetChecksum: checksumRuleDocument(requests)
  }
}

type ResolvedStartSource =
  | {
      published: ServerPublishedRuleDefinitionDto
      facts: Readonly<Record<string, boolean | number | string>>
      pendingApplicationContext?: ServerRuleExecutionPendingApplicationContextDto
      /** Closed public pending information; it never contains sealed continuation facts. */
      pendingResult?: PublicPendingResult
      /** Validates a pause before its snapshot is persisted. */
      validatePausedExecution?: (input: {
        continuation: Extract<ServerRuleExecutionResultDto, { status: 'PAUSED' }>['continuation']
        applicationContext: ServerRuleExecutionPendingApplicationContextDto
      }) => void | Promise<void>
      /**
       * A single aggregate-owned interruption discovered after a completed
       * kernel execution but before any completion applicator runs. The hook
       * is side-effect free: it can only replace completion with one sealed
       * kernel-evidence pause.
       */
      postCompletedExecution?: (input: {
        execution: Extract<ServerRuleExecutionResultDto, { status: 'COMPLETE' }>
        occurrenceId: string
        applicationContext: ServerRuleExecutionPendingApplicationContextDto
      }) => Promise<{
        continuation?: Extract<ServerRuleExecutionResultDto, { status: 'PAUSED' }>['continuation']
        execution?: Extract<ServerRuleExecutionResultDto, { status: 'COMPLETE' }>
        applicationContext: ServerRuleExecutionPendingApplicationContextDto
        pendingResult?: PublicPendingResult
        /** The transition validates its own continuation rather than a prior evidence phase. */
        validatePausedExecution?: (input: {
          continuation: Extract<ServerRuleExecutionResultDto, { status: 'PAUSED' }>['continuation']
          applicationContext: ServerRuleExecutionPendingApplicationContextDto
        }) => void | Promise<void>
        /** Server-only evidence drain for the one approved TEST -> OUTCOME transition. */
        resolveAutomaticEvidence?: (input: {
          request: Extract<
            ServerRuleExecutionResultDto,
            { status: 'PAUSED' }
          >['continuation']['request']
          occurrenceId: string
        }) => Promise<{ requestId: string; value: number }>
        /** Returns only exact server-derived nested d20 evidence; the coordinator seals it. */
        captureAutomaticEvidence?: (input: {
          request: Extract<
            ServerRuleExecutionResultDto,
            { status: 'PAUSED' }
          >['continuation']['request']
          response: { requestId: string; value: number }
        }) => Promise<ServerRuleExecutionNestedD20EvidenceDto | null>
        /**
         * Marks the only permitted TEST -> OUTCOME transition. The completed
         * TEST receipt is sealed in the occurrence snapshot until terminal
         * application; arbitrary post-completion pauses remain unphased.
         */
        phase?: 'OUTCOME'
        /** Required whenever this transition is the bounded TEST -> OUTCOME path. */
        phaseReceiptPlan?: RuleExecutionPhaseReceiptPlan
        /** Exact specialized graph for the bounded TEST -> OUTCOME transition. */
        graph?: CompiledRuleGraph
      } | null>
      /** A source-neutral bounded action begins with a TEST receipt. */
      phasePlan?: RuleExecutionPhaseReceiptPlan & { initialPhase: 'TEST' | 'OUTCOME' }
      /** A domain decision made only after the authoritative aggregate context is locked. */
      allowPaused?: boolean
      resolveAutomaticEvidence?: (input: {
        request: Extract<
          ServerRuleExecutionResultDto,
          { status: 'PAUSED' }
        >['continuation']['request']
        occurrenceId: string
      }) => Promise<{ requestId: string; value: number }>
      /** Returns only exact server-derived nested d20 evidence; the coordinator seals it. */
      captureAutomaticEvidence?: (input: {
        request: Extract<
          ServerRuleExecutionResultDto,
          { status: 'PAUSED' }
        >['continuation']['request']
        response: { requestId: string; value: number }
      }) => Promise<ServerRuleExecutionNestedD20EvidenceDto | null>
      manualReceipt?: never
    }
  | {
      published: ServerPublishedRuleDefinitionDto
      facts: Readonly<Record<string, boolean | number | string>>
      /** Recognized domain mechanics retained as a receipt-only Manual occurrence. */
      manualReceipt: { reminder: ManualRuleExecutionReminderDto | null }
      pendingApplicationContext?: never
      pendingResult?: never
      validatePausedExecution?: never
      postCompletedExecution?: never
      allowPaused?: never
      resolveAutomaticEvidence?: never
      captureAutomaticEvidence?: never
    }

/**
 * Coordinates the pure rule kernel with aggregate-owned occurrence storage.
 * Domain services provide the owning aggregate's lock, authorization, and
 * version mutation; this coordinator never discovers user authority itself.
 */
export function createRuleExecutionOccurrenceService(input: {
  db: DBLike
  runtime: RulesRuntimeService
  createOccurrenceId?: () => string
  completionApplicator?: RuleExecutionCompletionApplicator
  /** Domain-owned replay checks that must run before any fresh resolution work. */
  replayValidator?: (input: {
    aggregate: RuleExecutionLockedAggregateContext
    commandId: string
    db: DBLike
    result: StoredRuleExecutionResult
    receipt: { aggregateVersion: number; commandFingerprint: string }
  }) => Promise<void>
}) {
  const createOccurrenceId = input.createOccurrenceId ?? randomUUID
  async function replayOrReject(
    db: DBLike,
    aggregate: RuleExecutionLockedAggregateContext,
    command: CommandBase,
    commandFingerprint: string
  ): Promise<StoredRuleExecutionResult | null> {
    const receipt = await createRuleOccurrenceRepository(db).findReceipt(
      aggregate.aggregateKind,
      aggregate.aggregateId,
      command.commandId
    )
    if (!receipt) return null
    if (receipt.commandFingerprint !== commandFingerprint) {
      throw new RuleExecutionCommandMismatchError(
        'Command identity was reused with a different rule-execution fingerprint.'
      )
    }
    const result = replayedResult(receipt.resultPayload)
    await input.replayValidator?.({
      aggregate,
      commandId: command.commandId,
      db,
      result,
      receipt: {
        aggregateVersion: receipt.aggregateVersion,
        commandFingerprint: receipt.commandFingerprint
      }
    })
    return result
  }

  async function appendReceipt(
    db: DBLike,
    aggregate: RuleExecutionLockedAggregateContext,
    command: CommandBase,
    result: StoredRuleExecutionResult,
    aggregateVersion: number,
    commandMetadata: ServerRuleExecutionReceiptCommandMetadataDto,
    commandType: typeof RULE_EXECUTION_START | typeof RULE_EXECUTION_RESUME,
    commandFingerprint: string
  ): Promise<void> {
    await createRuleOccurrenceRepository(db).appendReceipt({
      aggregateKind: aggregate.aggregateKind,
      aggregateId: aggregate.aggregateId,
      commandId: command.commandId,
      commandType,
      commandFingerprint,
      occurrenceId: result.occurrenceId,
      aggregateVersion,
      resultPayload: receiptPayload(result),
      actorUserId: aggregate.actorUserId,
      correlationId: command.correlationId,
      commandMetadata: serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(commandMetadata)
    })
  }

  async function rejectFreshEncounterStartWhilePending(
    db: DBLike,
    aggregate: RuleExecutionLockedAggregateContext
  ): Promise<void> {
    if (aggregate.aggregateKind !== 'ENCOUNTER') return
    const pending = await createRuleOccurrenceRepository(db).lockPendingEncounter(
      aggregate.aggregateId
    )
    if (pending) {
      throw new RuleExecutionPendingEncounterOccurrenceError(
        'Encounter already has a pending rule occurrence; resume or settle it before starting another command.'
      )
    }
  }

  return {
    async execute(
      aggregatePort: RuleExecutionAggregatePort,
      command: CommandBase & {
        definitionId: string
        facts: Readonly<Record<string, boolean | number | string>>
      }
    ): Promise<StoredRuleExecutionResult> {
      const normalizedCommand = {
        ...command,
        commandId: serverUuidIdentityDtoSchema.parse(command.commandId),
        correlationId: serverRuleExecutionCorrelationIdDtoSchema.parse(command.correlationId),
        definitionId: serverUuidIdentityDtoSchema.parse(command.definitionId)
      }
      return withTransaction(input.db, (db) =>
        aggregatePort.withLockedAuthorized(db, async (aggregate) => {
          const commandFingerprint = createRuleExecutionCommandFingerprint(
            aggregate,
            normalizedCommand,
            RULE_EXECUTION_START,
            {
              definitionId: normalizedCommand.definitionId,
              factsChecksum: checksumRuleDocument(normalizedCommand.facts)
            }
          )
          const replay = await replayOrReject(db, aggregate, normalizedCommand, commandFingerprint)
          if (replay) return replay

          requireCurrentAggregateVersion(
            aggregate.currentVersion,
            normalizedCommand.expectedAggregateVersion
          )
          await rejectFreshEncounterStartWhilePending(db, aggregate)
          const occurrenceId = serverUuidIdentityDtoSchema.parse(createOccurrenceId())
          const execution = await input.runtime.execute({
            definitionId: normalizedCommand.definitionId,
            occurrenceId,
            facts: normalizedCommand.facts
          })
          const completionApplicator =
            execution.status === 'COMPLETE' ? input.completionApplicator : undefined
          const completionIntent =
            execution.status === 'COMPLETE' && completionApplicator
              ? {
                  aggregate: {
                    aggregateKind: aggregate.aggregateKind,
                    aggregateId: aggregate.aggregateId,
                    ...(aggregate.campaignId ? { campaignId: aggregate.campaignId } : {}),
                    actorUserId: aggregate.actorUserId,
                    currentVersion: aggregate.currentVersion
                  },
                  occurrenceId,
                  commandId: normalizedCommand.commandId,
                  correlationId: normalizedCommand.correlationId,
                  commandFingerprint,
                  pendingApplicationContext: { kind: 'NONE' } as const,
                  execution
                }
              : undefined
          const nextAggregateVersion = requiresAggregateAdvance(
            completionApplicator,
            completionIntent!
          )
            ? await aggregate.advanceVersion(db, normalizedCommand.expectedAggregateVersion)
            : aggregate.currentVersion
          const occurrences = createRuleOccurrenceRepository(db)
          const occurrence =
            execution.status === 'PAUSED'
              ? await occurrences.createPending({
                  aggregateKind: aggregate.aggregateKind,
                  occurrenceId,
                  aggregateId: aggregate.aggregateId,
                  campaignId: aggregate.campaignId,
                  rootCommandId: normalizedCommand.commandId,
                  expectedAggregateVersion: nextAggregateVersion,
                  pendingSnapshot: {
                    snapshotKind: 'KERNEL_EVIDENCE',
                    ...execution.continuation,
                    applicationContext: { kind: 'NONE' }
                  }
                })
              : await occurrences.createCompleted({
                  aggregateKind: aggregate.aggregateKind,
                  occurrenceId,
                  aggregateId: aggregate.aggregateId,
                  campaignId: aggregate.campaignId,
                  rootCommandId: normalizedCommand.commandId,
                  aggregateVersion: nextAggregateVersion
                })
          const application =
            execution.status === 'COMPLETE'
              ? await completionApplicator?.apply({
                  db,
                  ...completionIntent!,
                  proposedAggregateVersion: nextAggregateVersion
                })
              : undefined
          const completion = completionResult(application)
          const result = storedResult(execution, occurrence, completion.applicationOutputs)
          await completion.afterResult?.(result)
          await appendReceipt(
            db,
            aggregate,
            normalizedCommand,
            result,
            nextAggregateVersion,
            {
              schemaVersion: 1,
              transition: 'START',
              definitionId: normalizedCommand.definitionId,
              expectedAggregateVersion: normalizedCommand.expectedAggregateVersion,
              factsChecksum: checksumRuleDocument(normalizedCommand.facts)
            },
            RULE_EXECUTION_START,
            commandFingerprint
          )
          return result
        })
      )
    },

    /**
     * Starts from an exact source already resolved by the owning aggregate service.
     * Replay and aggregate currentness are checked before that resolver runs.
     */
    async executeResolved(
      aggregatePort: RuleExecutionAggregatePort,
      command: ResolvedExecutionCommand
    ): Promise<StoredRuleExecutionResult> {
      const normalizedCommand = {
        ...command,
        commandId: serverUuidIdentityDtoSchema.parse(command.commandId),
        correlationId: serverRuleExecutionCorrelationIdDtoSchema.parse(command.correlationId),
        intent: resolvedStartIntentRecordDtoSchema.parse(command.intent)
      }
      if (command.completionApplicator && command.allowPaused !== false) {
        throw new RuleExecutionCommandMismatchError(
          'A command-local completion applicator requires allowPaused: false.'
        )
      }
      if (command.resolveAutomaticEvidence && command.allowPaused !== false) {
        throw new RuleExecutionCommandMismatchError(
          'Command-local automatic evidence requires allowPaused: false.'
        )
      }
      return withTransaction(input.db, (db) =>
        aggregatePort.withLockedAuthorized(db, async (aggregate) => {
          const commandFingerprint = createRuleExecutionCommandFingerprint(
            aggregate,
            normalizedCommand,
            RULE_EXECUTION_START,
            { intentChecksum: checksumRuleDocument(normalizedCommand.intent) }
          )
          const replay = await replayOrReject(db, aggregate, normalizedCommand, commandFingerprint)
          if (replay) return replay

          requireCurrentAggregateVersion(
            aggregate.currentVersion,
            normalizedCommand.expectedAggregateVersion
          )
          await rejectFreshEncounterStartWhilePending(db, aggregate)
          const occurrenceId = serverUuidIdentityDtoSchema.parse(createOccurrenceId())
          const resolved = await normalizedCommand.resolve({
            db,
            aggregate,
            occurrenceId
          })
          const published = serverPublishedRuleDefinitionDtoSchema.parse(resolved.published)
          const facts = resolved.facts
          if (resolved.manualReceipt) {
            const occurrence = await createRuleOccurrenceRepository(db).createCompleted({
              aggregateKind: aggregate.aggregateKind,
              occurrenceId,
              aggregateId: aggregate.aggregateId,
              campaignId: aggregate.campaignId,
              rootCommandId: normalizedCommand.commandId,
              aggregateVersion: aggregate.currentVersion
            })
            const result = storedRuleExecutionResultDtoSchema.parse({
              status: 'MANUAL',
              occurrenceId: occurrence.id,
              occurrenceVersion: occurrence.version,
              reminder: resolved.manualReceipt.reminder
            })
            await appendReceipt(
              db,
              aggregate,
              normalizedCommand,
              result,
              aggregate.currentVersion,
              {
                schemaVersion: 1,
                transition: 'START',
                definitionId: published.id,
                expectedAggregateVersion: normalizedCommand.expectedAggregateVersion,
                factsChecksum: checksumRuleDocument(facts)
              },
              RULE_EXECUTION_START,
              commandFingerprint
            )
            return result
          }
          const started = input.runtime.executeResolvedWithGraph
            ? await input.runtime.executeResolvedWithGraph({
                command: { definitionId: published.id, occurrenceId, facts },
                published
              })
            : {
                result: await input.runtime.executeResolved({
                  command: { definitionId: published.id, occurrenceId, facts },
                  published
                }),
                graph: undefined
              }
          let execution = started.result
          let compiledGraph = started.graph
          let phaseReceipts: RuleExecutionPhaseReceiptsDto | undefined
          let pendingApplicationContext =
            serverRuleExecutionPendingApplicationContextDtoSchema.parse(
              resolved.pendingApplicationContext ?? { kind: 'NONE' }
            )
          let pendingResult = resolved.pendingResult ?? null
          let pausedValidator = resolved.validatePausedExecution
          const allowPaused = resolved.allowPaused ?? normalizedCommand.allowPaused
          const maximumAutomaticEvidenceRequests =
            ('maximumAutomaticEvidenceRequests' in normalizedCommand
              ? normalizedCommand.maximumAutomaticEvidenceRequests
              : undefined) ?? 1
          if (allowPaused && command.completionApplicator) {
            throw new RuleExecutionCommandMismatchError(
              'A pauseable resolved command cannot carry a command-local completion applicator.'
            )
          }
          let resolveAutomaticEvidence = allowPaused
            ? resolved.resolveAutomaticEvidence
            : (resolved.resolveAutomaticEvidence ?? normalizedCommand.resolveAutomaticEvidence)
          let captureAutomaticEvidence = resolved.captureAutomaticEvidence
          let automaticEvidenceCount = 0
          const drainAutomaticEvidence = async (allowOutcomeDrain: boolean) => {
            while (execution.status === 'PAUSED' && resolveAutomaticEvidence) {
              if (
                !allowOutcomeDrain &&
                automaticEvidenceCount >= maximumAutomaticEvidenceRequests
              ) {
                throw new RuleExecutionCommandMismatchError(
                  'Automatic rule evidence may satisfy only one evidence stage.'
                )
              }
              if (automaticEvidenceCount >= MAX_RULE_EXECUTION_AUTOMATIC_EVIDENCE_REQUESTS) {
                throw new RuleExecutionCommandMismatchError(
                  'Automatic rule evidence exceeded the bounded TEST/OUTCOME request limit.'
                )
              }
              const request = execution.continuation.request
              const response = await resolveAutomaticEvidence({
                request,
                occurrenceId
              })
              if (captureAutomaticEvidence)
                pendingApplicationContext = sealNestedOutcomeD20Evidence({
                  applicationContext: pendingApplicationContext,
                  request,
                  response,
                  evidence: await captureAutomaticEvidence({ request, response })
                })
              const resumed = input.runtime.resumeWithGraph
                ? await input.runtime.resumeWithGraph({
                    continuation: execution.continuation,
                    response
                  })
                : {
                    result: await input.runtime.resume({
                      continuation: execution.continuation,
                      response
                    }),
                    graph: undefined
                  }
              automaticEvidenceCount += 1
              execution = resumed.result
              compiledGraph = resumed.graph
            }
          }
          await drainAutomaticEvidence(false)
          if (execution.status === 'COMPLETE' && resolved.phasePlan?.initialPhase === 'TEST') {
            phaseReceipts = appendPhaseReceipt({
              existing: undefined,
              plan: resolved.phasePlan,
              execution,
              graph: compiledGraph
            })
          }
          if (execution.status === 'COMPLETE' && resolved.postCompletedExecution) {
            const transition = await resolved.postCompletedExecution({
              execution,
              occurrenceId,
              applicationContext: pendingApplicationContext
            })
            if (transition) {
              pendingApplicationContext =
                serverRuleExecutionPendingApplicationContextDtoSchema.parse(
                  transition.applicationContext
                )
              if (transition.phase === 'OUTCOME' && !phaseReceipts) {
                throw new RuleExecutionCommandMismatchError(
                  'An OUTCOME transition requires one completed TEST phase receipt.'
                )
              }
              if (transition.phase === 'OUTCOME' && !transition.phaseReceiptPlan) {
                throw new RuleExecutionCommandMismatchError(
                  'An OUTCOME transition requires its sealed receipt plan.'
                )
              }
              if (transition.phase === 'OUTCOME') {
                compiledGraph = requireOutcomeTransitionGraph({
                  graph: transition.graph,
                  plan: transition.phaseReceiptPlan!,
                  ...(transition.execution ? { execution: transition.execution } : {})
                })
              }
              if (transition.execution) {
                execution = transition.execution
              } else if (transition.continuation) {
                pendingResult = transition.pendingResult ?? null
                execution = { status: 'PAUSED', continuation: transition.continuation }
                pausedValidator = transition.validatePausedExecution
                resolveAutomaticEvidence = transition.resolveAutomaticEvidence
                captureAutomaticEvidence = transition.captureAutomaticEvidence
                await drainAutomaticEvidence(true)
              } else {
                throw new RuleExecutionCommandMismatchError(
                  'A completed-execution transition must provide completion or one continuation.'
                )
              }
              const outcomeExecution = execution as ServerRuleExecutionResultDto
              if (transition.phase === 'OUTCOME' && outcomeExecution.status === 'COMPLETE') {
                phaseReceipts = appendPhaseReceipt({
                  existing: phaseReceipts,
                  plan: transition.phaseReceiptPlan!,
                  execution: outcomeExecution,
                  graph: compiledGraph
                })
              }
            }
          }
          if (execution.status === 'PAUSED' && allowPaused === false) {
            throw new RuleExecutionCommandMismatchError(
              'The resolved source unexpectedly requested a paused rule execution.'
            )
          }
          if (execution.status === 'PAUSED') {
            await pausedValidator?.({
              continuation: execution.continuation,
              applicationContext: pendingApplicationContext
            })
            if (
              (pendingApplicationContext.kind === 'ENCOUNTER_CHARACTER_RULE_ACTION' ||
                pendingApplicationContext.kind === 'ENCOUNTER_ACTOR_RULE_ACTION' ||
                pendingApplicationContext.kind === 'ENCOUNTER_CREATURE_RULE_ACTION') &&
              pendingApplicationContext.twoPhase?.phase === 'OUTCOME' &&
              pendingResult === null
            ) {
              pendingResult = outcomePendingResult(
                execution.continuation.request,
                pendingApplicationContext
              )
            }
          }
          const completionApplicator =
            execution.status === 'COMPLETE'
              ? (command.completionApplicator ?? input.completionApplicator)
              : undefined
          const completionIntent =
            execution.status === 'COMPLETE' && completionApplicator
              ? {
                  aggregate: {
                    aggregateKind: aggregate.aggregateKind,
                    aggregateId: aggregate.aggregateId,
                    ...(aggregate.campaignId ? { campaignId: aggregate.campaignId } : {}),
                    actorUserId: aggregate.actorUserId,
                    currentVersion: aggregate.currentVersion
                  },
                  occurrenceId,
                  commandId: normalizedCommand.commandId,
                  correlationId: normalizedCommand.correlationId,
                  commandFingerprint,
                  pendingApplicationContext,
                  execution,
                  ...(phaseReceipts ? { phaseReceipts } : {}),
                  ...(compiledGraph ? { compiledGraph } : {})
                }
              : undefined
          const nextAggregateVersion = requiresAggregateAdvance(
            completionApplicator,
            completionIntent!
          )
            ? await aggregate.advanceVersion(db, normalizedCommand.expectedAggregateVersion)
            : aggregate.currentVersion
          const occurrences = createRuleOccurrenceRepository(db)
          const occurrence =
            execution.status === 'PAUSED'
              ? await occurrences.createPending({
                  aggregateKind: aggregate.aggregateKind,
                  occurrenceId,
                  aggregateId: aggregate.aggregateId,
                  campaignId: aggregate.campaignId,
                  rootCommandId: normalizedCommand.commandId,
                  expectedAggregateVersion: nextAggregateVersion,
                  pendingSnapshot: {
                    snapshotKind: 'KERNEL_EVIDENCE',
                    ...execution.continuation,
                    applicationContext: pendingApplicationContext,
                    ...(phaseReceipts ? { phaseReceipts } : {})
                  }
                })
              : await occurrences.createCompleted({
                  aggregateKind: aggregate.aggregateKind,
                  occurrenceId,
                  aggregateId: aggregate.aggregateId,
                  campaignId: aggregate.campaignId,
                  rootCommandId: normalizedCommand.commandId,
                  aggregateVersion: nextAggregateVersion
                })
          const application =
            execution.status === 'COMPLETE'
              ? await completionApplicator?.apply({
                  db,
                  ...completionIntent!,
                  proposedAggregateVersion: nextAggregateVersion
                })
              : undefined
          const completion = completionResult(application)
          const result = storedResult(
            completion.terminalExecution ?? execution,
            occurrence,
            completion.applicationOutputs,
            execution.status === 'PAUSED' ? pendingResult : null,
            phaseReceipts
          )
          await completion.afterResult?.(result)
          await appendReceipt(
            db,
            aggregate,
            normalizedCommand,
            result,
            nextAggregateVersion,
            {
              schemaVersion: 1,
              transition: 'START',
              definitionId: published.id,
              expectedAggregateVersion: normalizedCommand.expectedAggregateVersion,
              factsChecksum: checksumRuleDocument(facts)
            },
            RULE_EXECUTION_START,
            commandFingerprint
          )
          return result
        })
      )
    },

    async resume(
      aggregatePort: RuleExecutionAggregatePort,
      command: CommandBase & {
        occurrenceId: string
        expectedOccurrenceVersion: number
        /**
         * Server-only occurrence already locked by an authorized aggregate
         * dispatcher in this transaction. It is never part of replay identity.
         */
        lockedOccurrence?: RuleOccurrenceRecord
        response?: unknown
        /** A closed domain intent whose checksum participates in replay identity. */
        resolutionIntent?: unknown
        /** Derives the single kernel response only after replay/currentness checks. */
        deriveResponse?: (input: {
          applicationContext: ServerRuleExecutionPendingApplicationContextDto
          resolutionIntent: unknown
          request: Extract<
            ServerRuleExecutionResultDto,
            { status: 'PAUSED' }
          >['continuation']['request']
        }) => Promise<unknown>
        /** Returns only trusted nested d20 evidence; the coordinator seals it. */
        captureDerivedResponseEvidence?: (input: {
          resolutionIntent: unknown
          request: Extract<
            ServerRuleExecutionResultDto,
            { status: 'PAUSED' }
          >['continuation']['request']
          response: { requestId: string; value: number }
        }) => Promise<ServerRuleExecutionNestedD20EvidenceDto | null>
        /**
         * The single approved bounded multi-die resume path. The domain must
         * validate the complete sealed request set before this is invoked.
         */
        deriveResponses?: (input: {
          applicationContext: ServerRuleExecutionPendingApplicationContextDto
          resolutionIntent: unknown
          request: Extract<
            ServerRuleExecutionResultDto,
            { status: 'PAUSED' }
          >['continuation']['request']
        }) => Promise<readonly { requestId: string; value: number }[]>
        /**
         * The only resume path that may seal raw d20 faces for the two-person
         * optional-combat contest. It cannot replace application context.
         */
        deriveOptionalContestD20Response?: (input: {
          applicationContext: ServerRuleExecutionPendingApplicationContextDto
          resolutionIntent: unknown
          request: Extract<
            ServerRuleExecutionResultDto,
            { status: 'PAUSED' }
          >['continuation']['request']
        }) => Promise<{
          response: { requestId: string; value: number }
          rawFaces: readonly number[]
        }>
        /** Re-resolves the domain source under fresh locks before kernel resume. */
        resolve?: (input: {
          db: DBLike
          aggregate: Readonly<RuleExecutionLockedAggregateContext>
          occurrenceId: string
          applicationContext: ServerRuleExecutionPendingApplicationContextDto
        }) => Promise<ResolvedStartSource>
        completionApplicator?: RuleExecutionCompletionApplicator
        /** Domain-owned revalidation of the sealed pending application context. */
        resumePreflight?: (input: {
          db: DBLike
          aggregate: Readonly<RuleExecutionLockedAggregateContext>
          occurrence: RuleOccurrenceRecord
          applicationContext: ServerRuleExecutionPendingApplicationContextDto
          response: { requestId: string; value: number }
        }) => Promise<void>
      }
    ): Promise<StoredRuleExecutionResult> {
      const { lockedOccurrence, ...resumeCommand } = command
      const normalizedCommand = {
        ...resumeCommand,
        commandId: serverUuidIdentityDtoSchema.parse(command.commandId),
        correlationId: serverRuleExecutionCorrelationIdDtoSchema.parse(command.correlationId),
        occurrenceId: serverUuidIdentityDtoSchema.parse(command.occurrenceId)
      }
      return withTransaction(input.db, (db) =>
        aggregatePort.withLockedAuthorized(db, async (aggregate) => {
          const derivedResponseCount = [
            normalizedCommand.deriveResponse,
            normalizedCommand.deriveResponses,
            normalizedCommand.deriveOptionalContestD20Response
          ].filter(Boolean).length
          if (
            derivedResponseCount > 1 ||
            (derivedResponseCount > 0 && normalizedCommand.response !== undefined)
          ) {
            throw new RuleExecutionCommandMismatchError(
              'A domain-derived resume response cannot also supply a direct response.'
            )
          }
          if (
            normalizedCommand.captureDerivedResponseEvidence &&
            (!normalizedCommand.deriveResponse || normalizedCommand.deriveResponses)
          ) {
            throw new RuleExecutionCommandMismatchError(
              'Derived response evidence capture requires one domain-derived response.'
            )
          }
          if (derivedResponseCount === 0 && normalizedCommand.response === undefined) {
            throw new RuleExecutionCommandMismatchError('A resume command requires a response.')
          }
          const directResponse =
            derivedResponseCount > 0
              ? null
              : serverRuleEvidenceResponseDtoSchema.parse(normalizedCommand.response)
          const commandFingerprint = createRuleExecutionCommandFingerprint(
            aggregate,
            normalizedCommand,
            RULE_EXECUTION_RESUME,
            {
              occurrenceId: normalizedCommand.occurrenceId,
              expectedOccurrenceVersion: normalizedCommand.expectedOccurrenceVersion,
              ...(directResponse
                ? { response: directResponse }
                : {
                    resolutionIntentChecksum: checksumRuleDocument(
                      normalizedCommand.resolutionIntent
                    )
                  })
            }
          )
          const replay = await replayOrReject(db, aggregate, normalizedCommand, commandFingerprint)
          if (replay) return replay

          requireCurrentAggregateVersion(
            aggregate.currentVersion,
            normalizedCommand.expectedAggregateVersion
          )
          const occurrences = createRuleOccurrenceRepository(db)
          const occurrence =
            lockedOccurrence ??
            (await occurrences.lockOccurrence(
              aggregate.aggregateKind,
              aggregate.aggregateId,
              normalizedCommand.occurrenceId
            ))
          if (
            !occurrence ||
            occurrence.aggregateKind !== aggregate.aggregateKind ||
            occurrence.aggregateId !== aggregate.aggregateId ||
            occurrence.id !== normalizedCommand.occurrenceId ||
            occurrence.state !== 'PENDING' ||
            occurrence.version !== normalizedCommand.expectedOccurrenceVersion ||
            occurrence.expectedAggregateVersion !== normalizedCommand.expectedAggregateVersion ||
            !occurrence.pendingSnapshot
          ) {
            throw new RuleExecutionAggregateCurrentnessError(
              'Rule occurrence is not current and pending for this resume command.'
            )
          }

          const pendingSnapshot = requireServerKernelRuleExecutionPendingSnapshot(
            occurrence.pendingSnapshot
          )
          const {
            applicationContext,
            snapshotKind: _snapshotKind,
            phaseReceipts: _phaseReceipts,
            optionalCombatSnapshotChecksum: _optionalCombatSnapshotChecksum,
            ...continuation
          } = pendingSnapshot
          let phaseReceipts: RuleExecutionPhaseReceiptsDto | undefined =
            'phaseReceipts' in pendingSnapshot && pendingSnapshot.phaseReceipts
              ? ruleExecutionPhaseReceiptsDtoSchema.parse(pendingSnapshot.phaseReceipts)
              : undefined
          let pausedValidator: ResolvedStartSource['validatePausedExecution']
          let postCompletedExecution: ResolvedStartSource['postCompletedExecution']
          let phasePlan:
            | (RuleExecutionPhaseReceiptPlan & { initialPhase: 'TEST' | 'OUTCOME' })
            | undefined
          if (normalizedCommand.resolve) {
            const resolved = await normalizedCommand.resolve({
              db,
              aggregate,
              occurrenceId: occurrence.id,
              applicationContext
            })
            const revalidatedContext = serverRuleExecutionPendingApplicationContextDtoSchema.parse(
              resolved.pendingApplicationContext ?? { kind: 'NONE' }
            )
            if (
              checksumRuleDocument(revalidatedContext) !== checksumRuleDocument(applicationContext)
            ) {
              throw new RuleExecutionAggregateCurrentnessError(
                'Rule occurrence application context changed before resume.'
              )
            }
            pausedValidator = resolved.validatePausedExecution
            postCompletedExecution = resolved.postCompletedExecution
            phasePlan = 'phasePlan' in resolved ? resolved.phasePlan : undefined
          }
          let activePhase: 'TEST' | 'OUTCOME' | null =
            phasePlan?.initialPhase ?? (phaseReceipts?.length === 1 ? 'OUTCOME' : null)
          const optionalContestResponse = normalizedCommand.deriveOptionalContestD20Response
            ? await normalizedCommand.deriveOptionalContestD20Response({
                applicationContext,
                resolutionIntent: normalizedCommand.resolutionIntent,
                request: continuation.request
              })
            : null
          const rawResponses = normalizedCommand.deriveResponses
            ? await normalizedCommand.deriveResponses({
                applicationContext,
                resolutionIntent: normalizedCommand.resolutionIntent,
                request: continuation.request
              })
            : [
                optionalContestResponse
                  ? optionalContestResponse.response
                  : normalizedCommand.deriveResponse
                    ? await normalizedCommand.deriveResponse({
                        applicationContext,
                        resolutionIntent: normalizedCommand.resolutionIntent,
                        request: continuation.request
                      })
                    : directResponse
              ]
          if (rawResponses.length < 1 || rawResponses.length > 31) {
            throw new RuleExecutionCommandMismatchError(
              'A bounded outcome resume requires one to thirty-one exact evidence responses.'
            )
          }
          const responses = rawResponses.map((response) =>
            serverRuleEvidenceResponseDtoSchema.parse(response)
          )
          const response = responses[0]!
          await normalizedCommand.resumePreflight?.({
            db,
            aggregate,
            occurrence,
            applicationContext,
            response
          })
          const capturedApplicationContext = normalizedCommand.deriveOptionalContestD20Response
            ? sealOptionalContestD20Evidence({
                applicationContext,
                request: continuation.request,
                response,
                rawFaces: optionalContestResponse!.rawFaces
              })
            : normalizedCommand.captureDerivedResponseEvidence
              ? sealNestedOutcomeD20Evidence({
                  applicationContext,
                  request: continuation.request,
                  response,
                  evidence: await normalizedCommand.captureDerivedResponseEvidence({
                    resolutionIntent: normalizedCommand.resolutionIntent,
                    request: continuation.request,
                    response
                  })
                })
              : applicationContext

          let currentContinuation = continuation
          let compiledGraph: import('@artificer-toolkit/shared/rules').CompiledRuleGraph | undefined
          let execution: ServerRuleExecutionResultDto | null = null
          for (const [index, nextResponse] of responses.entries()) {
            const resumed = input.runtime.resumeWithGraph
              ? await input.runtime.resumeWithGraph({
                  continuation: currentContinuation,
                  response: nextResponse
                })
              : {
                  result: await input.runtime.resume({
                    continuation: currentContinuation,
                    response: nextResponse
                  }),
                  graph: undefined
                }
            execution = resumed.result
            compiledGraph = resumed.graph
            if (index < responses.length - 1) {
              if (execution.status !== 'PAUSED') {
                throw new RuleExecutionCommandMismatchError(
                  'Outcome evidence completed before its sealed request set was consumed.'
                )
              }
              currentContinuation = execution.continuation
            }
          }
          if (!execution)
            throw new RuleExecutionCommandMismatchError('Outcome evidence is unavailable.')
          if (normalizedCommand.deriveResponses && execution.status === 'PAUSED') {
            throw new RuleExecutionCommandMismatchError(
              'Outcome evidence did not consume its sealed request set.'
            )
          }
          if (
            execution.status === 'COMPLETE' &&
            !phaseReceipts &&
            phasePlan?.initialPhase === 'TEST'
          ) {
            phaseReceipts = appendPhaseReceipt({
              existing: undefined,
              plan: phasePlan,
              execution,
              graph: compiledGraph
            })
            activePhase = 'TEST'
          }
          let nextApplicationContext = capturedApplicationContext
          let pendingResult: PublicPendingResult | null = null
          if (execution.status === 'COMPLETE' && postCompletedExecution) {
            const transition = await postCompletedExecution({
              execution,
              occurrenceId: occurrence.id,
              applicationContext: nextApplicationContext
            })
            if (transition) {
              nextApplicationContext = serverRuleExecutionPendingApplicationContextDtoSchema.parse(
                transition.applicationContext
              )
              if (transition.phase === 'OUTCOME' && !phaseReceipts) {
                throw new RuleExecutionCommandMismatchError(
                  'An OUTCOME transition requires one completed TEST phase receipt.'
                )
              }
              if (transition.phase === 'OUTCOME' && !transition.phaseReceiptPlan) {
                throw new RuleExecutionCommandMismatchError(
                  'An OUTCOME transition requires its sealed receipt plan.'
                )
              }
              if (transition.phase === 'OUTCOME') {
                compiledGraph = requireOutcomeTransitionGraph({
                  graph: transition.graph,
                  plan: transition.phaseReceiptPlan!,
                  ...(transition.execution ? { execution: transition.execution } : {})
                })
              }
              if (transition.execution) {
                execution = transition.execution
                if (transition.phase === 'OUTCOME') {
                  phaseReceipts = appendPhaseReceipt({
                    existing: phaseReceipts,
                    plan: transition.phaseReceiptPlan!,
                    execution,
                    graph: compiledGraph
                  })
                  activePhase = 'OUTCOME'
                }
              } else if (transition.continuation) {
                pendingResult = transition.pendingResult ?? null
                execution = { status: 'PAUSED', continuation: transition.continuation }
                pausedValidator = transition.validatePausedExecution
                if (transition.phase === 'OUTCOME') activePhase = 'OUTCOME'
              } else {
                throw new RuleExecutionCommandMismatchError(
                  'A completed-execution transition must provide completion or one continuation.'
                )
              }
            }
          }
          if (
            execution.status === 'COMPLETE' &&
            activePhase === 'OUTCOME' &&
            phaseReceipts?.length === 1 &&
            phasePlan?.initialPhase === 'OUTCOME'
          ) {
            phaseReceipts = appendPhaseReceipt({
              existing: phaseReceipts,
              plan: phasePlan,
              execution,
              graph: compiledGraph
            })
          }
          if (execution.status === 'PAUSED') {
            await pausedValidator?.({
              continuation: execution.continuation,
              applicationContext: nextApplicationContext
            })
            if (activePhase === 'OUTCOME' && pendingResult === null) {
              pendingResult = outcomePendingResult(
                execution.continuation.request,
                nextApplicationContext
              )
            }
          }
          const completionApplicator =
            execution.status === 'COMPLETE'
              ? (normalizedCommand.completionApplicator ?? input.completionApplicator)
              : undefined
          const completionIntent =
            execution.status === 'COMPLETE' && completionApplicator
              ? {
                  aggregate: {
                    aggregateKind: aggregate.aggregateKind,
                    aggregateId: aggregate.aggregateId,
                    ...(aggregate.campaignId ? { campaignId: aggregate.campaignId } : {}),
                    actorUserId: aggregate.actorUserId,
                    currentVersion: aggregate.currentVersion
                  },
                  occurrenceId: occurrence.id,
                  commandId: normalizedCommand.commandId,
                  correlationId: normalizedCommand.correlationId,
                  commandFingerprint,
                  pendingApplicationContext: nextApplicationContext,
                  execution,
                  ...(phaseReceipts ? { phaseReceipts } : {}),
                  ...(compiledGraph ? { compiledGraph } : {})
                }
              : undefined
          const nextAggregateVersion = requiresAggregateAdvance(
            completionApplicator,
            completionIntent!
          )
            ? await aggregate.advanceVersion(db, normalizedCommand.expectedAggregateVersion)
            : aggregate.currentVersion
          const nextOccurrence =
            execution.status === 'PAUSED'
              ? await occurrences.advancePending({
                  aggregateKind: aggregate.aggregateKind,
                  aggregateId: aggregate.aggregateId,
                  occurrenceId: occurrence.id,
                  expectedOccurrenceVersion: occurrence.version,
                  expectedAggregateVersion: occurrence.expectedAggregateVersion,
                  nextAggregateVersion,
                  pendingSnapshot: {
                    snapshotKind: 'KERNEL_EVIDENCE',
                    ...execution.continuation,
                    applicationContext: nextApplicationContext,
                    ...(phaseReceipts ? { phaseReceipts } : {})
                  }
                })
              : await occurrences.complete({
                  aggregateKind: aggregate.aggregateKind,
                  aggregateId: aggregate.aggregateId,
                  occurrenceId: occurrence.id,
                  expectedOccurrenceVersion: occurrence.version,
                  expectedAggregateVersion: occurrence.expectedAggregateVersion,
                  nextAggregateVersion
                })
          const application =
            execution.status === 'COMPLETE'
              ? await completionApplicator?.apply({
                  db,
                  ...completionIntent!,
                  proposedAggregateVersion: nextAggregateVersion
                })
              : undefined
          const completion = completionResult(application)
          const result = storedResult(
            completion.terminalExecution ?? execution,
            nextOccurrence,
            completion.applicationOutputs,
            execution.status === 'PAUSED' ? (pendingResult ?? null) : null,
            phaseReceipts
          )
          await completion.afterResult?.(result)
          await appendReceipt(
            db,
            aggregate,
            normalizedCommand,
            result,
            nextAggregateVersion,
            {
              schemaVersion: 1,
              transition: 'RESUME',
              expectedAggregateVersion: normalizedCommand.expectedAggregateVersion,
              expectedOccurrenceVersion: normalizedCommand.expectedOccurrenceVersion,
              response
            },
            RULE_EXECUTION_RESUME,
            commandFingerprint
          )
          return result
        })
      )
    }
  }
}
