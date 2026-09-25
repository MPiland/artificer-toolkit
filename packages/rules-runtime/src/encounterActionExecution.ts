import type {
  CharacterRuleActionApplication,
  CharacterRuleActionExecutionPlan,
  CharacterRuleActionSystemAdapter
} from './characterRuleActionSystemAdapter.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import { resolveEncounterActionPhaseExecution } from './encounterActionPhaseExecution.js'
import {
  buildEncounterActionD20Evidence,
  buildEncounterSaveD20Evidence,
  deriveEncounterActionD20Policy,
  nestedOutcomeD20Policy,
  requireEncounterSaveD20EvidenceTrace
} from './encounterMovementReactionActionExecution.js'
import {
  resolveEncounterD20Answer,
  resolveEncounterIntegerAnswer,
  type EncounterD20RollMode,
  type EncounterEvidenceAnswer
} from './encounterEvidenceAnswer.js'
import {
  ruleExecutionPhaseReceiptsDtoSchema,
  type ServerCompletedRuleExecutionDto,
  type ServerPublishedRuleDefinitionDto,
  type ServerRuleExecutionContinuationDto,
  type ServerRuleExecutionD20EvidenceDto,
  type ServerRuleExecutionD20PolicyDto,
  type ServerRuleExecutionNestedD20EvidenceDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument, RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules'
import { directActionTwoPhaseDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionDirectActionPendingContexts'
import type { z } from 'zod'
import { nextRollInt } from './random.js'

/** Runs the sealed TEST and selected OUTCOME before the owning mutation settles mechanics. */
export async function executeNativeActionGraphs(input: {
  runtime: RulesRuntimeService
  adapter: CharacterRuleActionSystemAdapter
  plan: CharacterRuleActionExecutionPlan
  occurrenceId: string
  binding: Omit<Parameters<CharacterRuleActionSystemAdapter['bindFacts']>[0], 'published'>
  afterTest(execution: ServerCompletedRuleExecutionDto): Promise<void>
  random?: (maxExclusive: number) => number
}): Promise<{
  execution: ServerCompletedRuleExecutionDto
  published: ServerPublishedRuleDefinitionDto
  initialPublished: ServerPublishedRuleDefinitionDto
  initialFactsChecksum: string
  phaseReceipts: z.infer<typeof ruleExecutionPhaseReceiptsDtoSchema> | undefined
  d20: ServerRuleExecutionD20EvidenceDto | null
  nestedD20: ServerRuleExecutionNestedD20EvidenceDto | null
  applications: readonly CharacterRuleActionApplication[]
}> {
  const random = input.random ?? nextRollInt
  const phaseReceipts: z.infer<typeof ruleExecutionPhaseReceiptsDtoSchema> = []
  let d20: ServerRuleExecutionD20EvidenceDto | null = null
  let nestedD20: ServerRuleExecutionNestedD20EvidenceDto | null = null

  async function executePhase(
    published: ServerPublishedRuleDefinitionDto,
    phase: 'SINGLE' | 'TEST' | 'OUTCOME'
  ) {
    const bound = input.adapter.bindFacts({ ...input.binding, published })
    let result = await input.runtime.executeResolved({
      command: { definitionId: published.id, occurrenceId: input.occurrenceId, facts: bound.facts },
      published
    })
    const nestedPolicy =
      phase !== 'TEST'
        ? nestedOutcomeD20Policy({
            published,
            d20:
              bound.d20RollMode && bound.d20Audit
                ? {
                    rollMode: bound.d20RollMode,
                    ...bound.d20Audit
                  }
                : null
          })
        : null
    let testEvidence: {
      policy: ReturnType<typeof deriveEncounterActionD20Policy>
      requestId: string
      faces: number[]
      rollMode: EncounterD20RollMode
    } | null = null
    const requests = new Set<string>()
    while (result.status === 'PAUSED') {
      const { continuation } = result
      const request = continuation.request
      if (requests.has(request.requestId) || requests.size >= RULE_GRAPH_LIMITS.NODES)
        throw new Error('The action evidence sequence is invalid.')
      requests.add(request.requestId)
      let value: number
      const isNestedSave = nestedPolicy?.requestNodeId === request.nodeId
      if (
        phase === 'TEST' ||
        isNestedSave ||
        (phase === 'SINGLE' && bound.d20Audit && request.min === 1 && request.max === 20)
      ) {
        const policy = !isNestedSave
          ? deriveEncounterActionD20Policy({ continuation, bound })
          : nestedPolicy!
        const { faces, rollMode, natural } = resolveEncounterD20Answer({
          derivedRollMode: policy.rollMode,
          answer: { kind: 'AUTO_ROLL', requestId: request.requestId },
          rollD20: () => random(20) + 1
        })
        value = natural
        if (!isNestedSave) {
          if (testEvidence) throw new Error('The action TEST requested more than one d20 stage.')
          testEvidence = { policy, requestId: request.requestId, faces, rollMode }
        } else {
          if (nestedD20) throw new Error('The action OUTCOME requested more than one nested save.')
          nestedD20 = buildEncounterSaveD20Evidence({
            policy,
            requestId: request.requestId,
            faces,
            rollMode
          })
        }
      } else {
        const width = request.max - request.min + 1
        if (
          request.kind !== 'INTEGER_RANGE' ||
          request.min >= request.max ||
          !Number.isSafeInteger(width) ||
          width > 2 ** 32
        )
          throw new Error('The action outcome requested unsupported integer evidence.')
        value = request.min + random(width)
        if (!Number.isSafeInteger(value) || value < request.min || value > request.max)
          throw new Error('The action outcome roll is invalid.')
      }
      result = await input.runtime.resume({
        continuation,
        response: { requestId: request.requestId, value }
      })
    }
    if (testEvidence) d20 = buildEncounterActionD20Evidence({ execution: result, ...testEvidence })
    if (nestedPolicy && nestedD20)
      requireEncounterSaveD20EvidenceTrace({
        execution: result,
        policy: nestedPolicy,
        evidence: nestedD20
      })
    return { execution: result, published, bound }
  }

  const initial =
    input.plan.kind === 'SINGLE_GRAPH' ? input.plan.published : input.plan.test.published
  const first = await executePhase(initial, input.plan.kind === 'SINGLE_GRAPH' ? 'SINGLE' : 'TEST')
  let terminal = first
  if (input.plan.kind === 'TEST_OUTCOME') {
    phaseReceipts.push({
      phase: 'TEST',
      template: input.plan.test.template,
      boundFactsChecksum: checksumRuleDocument(first.bound.facts),
      specializedChecksum: initial.checksum,
      execution: first.execution
    })
    await input.afterTest(first.execution)
    const resolution = resolveEncounterActionPhaseExecution({
      plan: input.plan,
      phase: 'TEST',
      execution: first.execution,
      adapter: input.adapter,
      facts: first.bound.facts
    })
    if (resolution.kind === 'OUTCOME') {
      terminal = await executePhase(resolution.outcome.published, 'OUTCOME')
      phaseReceipts.push({
        phase: 'OUTCOME',
        template: resolution.template,
        boundFactsChecksum: checksumRuleDocument(terminal.bound.facts),
        specializedChecksum: terminal.published.checksum,
        execution: terminal.execution
      })
    } else if (resolution.kind !== 'TEST_ONLY') {
      throw new Error('The action TEST did not select one terminal outcome.')
    }
    ruleExecutionPhaseReceiptsDtoSchema.parse(phaseReceipts)
  }
  return {
    execution: terminal.execution,
    published: terminal.published,
    initialPublished: initial,
    initialFactsChecksum: checksumRuleDocument(first.bound.facts),
    phaseReceipts: phaseReceipts.length ? phaseReceipts : undefined,
    d20,
    nestedD20,
    applications: input.adapter.interpret({
      execution: terminal.execution,
      occurrenceId: input.occurrenceId,
      published: terminal.published,
      targetActorId: input.binding.targetActorId,
      currentHitPoints: input.binding.currentHitPoints,
      temporaryHitPoints: input.binding.temporaryHitPoints,
      maximumHitPoints: input.binding.maximumHitPoints,
      defenses: input.binding.defenses,
      conditionImmunityIds: input.binding.conditionImmunityIds
    })
  }
}

type NativePhaseReceipts = z.infer<typeof ruleExecutionPhaseReceiptsDtoSchema>
type NativeTwoPhase = z.infer<typeof directActionTwoPhaseDtoSchema>

/** A paused request resumed by its answer; whose roll it was no longer matters. */
export type ResumedNativeActionGraphs = Omit<PendingNativeActionGraphs, 'roller'>

/** Whose roll a paused action request is: the acting source's or its target's (a save). */
export type EncounterActionRoller = 'SOURCE' | 'TARGET'

/** Each roller's "Auto-roll my dice" preference; a roller who auto-rolls is never prompted. */
export type EncounterActionAutoRoll = Readonly<Record<EncounterActionRoller, boolean>>

export type PendingNativeActionGraphs = {
  kind: 'PENDING'
  continuation: ServerRuleExecutionContinuationDto
  d20Policy: ServerRuleExecutionD20PolicyDto | null
  twoPhase: NativeTwoPhase | null
  /** The actor whose controllers answer this request (ADR 0034 decision 3). */
  roller: EncounterActionRoller
  phaseReceipts?: NativePhaseReceipts
}

export type NativeActionTestBoundary = {
  kind: 'TEST_BOUNDARY'
  /** Original sealed TEST request, retained for the server-owned interstitial context. */
  continuation: ServerRuleExecutionContinuationDto
  execution: ServerCompletedRuleExecutionDto
  published: ServerPublishedRuleDefinitionDto
  initialPublished: ServerPublishedRuleDefinitionDto
  initialFactsChecksum: string
  phaseReceipts: NativePhaseReceipts
  d20: ServerRuleExecutionD20EvidenceDto
  d20Policy: ServerRuleExecutionD20PolicyDto
  twoPhase: Extract<NativeTwoPhase, { phase: 'TEST' }>
}

type CompleteNativeActionGraphs = Awaited<ReturnType<typeof executeNativeActionGraphs>> & {
  kind: 'COMPLETE'
}

function actionComplete(input: {
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
    applications: input.adapter.interpret({
      execution: input.execution,
      occurrenceId: input.occurrenceId,
      published: input.published,
      targetActorId: input.binding.targetActorId,
      currentHitPoints: input.binding.currentHitPoints,
      temporaryHitPoints: input.binding.temporaryHitPoints,
      maximumHitPoints: input.binding.maximumHitPoints,
      defenses: input.binding.defenses,
      conditionImmunityIds: input.binding.conditionImmunityIds
    })
  }
}

function requireActionContinuation(input: {
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

function actionD20Policy(input: {
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

function actionRequestRoller(input: {
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

function actionResponse(input: {
  continuation: ServerRuleExecutionContinuationDto
  policy: ServerRuleExecutionD20PolicyDto | null
  resolution: EncounterEvidenceAnswer
  random: (maximum: number) => number
}) {
  if (input.resolution.requestId !== input.continuation.request.requestId)
    throw new Error('The action evidence request is stale.')
  if (input.policy !== null) {
    const d20 = resolveEncounterD20Answer({
      derivedRollMode: input.policy.rollMode,
      answer: input.resolution,
      rollD20: () => input.random(20) + 1
    })
    return { value: d20.natural, faces: d20.faces, rollMode: d20.rollMode }
  }
  const { request } = input.continuation
  return {
    value: resolveEncounterIntegerAnswer({
      min: request.min,
      max: request.max,
      answer: input.resolution,
      random: input.random
    }),
    faces: null,
    rollMode: null
  }
}

type NativeActionBaseInput = {
  runtime: RulesRuntimeService
  adapter: CharacterRuleActionSystemAdapter
  plan: CharacterRuleActionExecutionPlan
  occurrenceId: string
  autoRoll: EncounterActionAutoRoll
  binding: Omit<Parameters<CharacterRuleActionSystemAdapter['bindFacts']>[0], 'published'>
  afterTest(
    execution: ServerCompletedRuleExecutionDto,
    d20: ServerRuleExecutionD20EvidenceDto
  ): Promise<void>
  random?: (maximum: number) => number
}

function requireTestPlan(input: NativeActionBaseInput) {
  if (input.plan.kind !== 'TEST_OUTCOME')
    throw new Error('Native action TEST boundaries require a TEST_OUTCOME plan.')
  return input.plan
}

function nativeTestIdentity(input: NativeActionBaseInput) {
  const plan = requireTestPlan(input)
  const published = plan.test.published
  const bound = input.adapter.bindFacts({ ...input.binding, published })
  return {
    plan,
    published,
    bound,
    factsChecksum: checksumRuleDocument(bound.facts)
  }
}

async function requireNativeTestBoundary(input: {
  source: NativeActionBaseInput
  boundary: NativeActionTestBoundary
}) {
  const current = nativeTestIdentity(input.source)
  const { boundary } = input
  const receipt = boundary.phaseReceipts[0]
  if (
    boundary.phaseReceipts.length !== 1 ||
    !receipt ||
    receipt.phase !== 'TEST' ||
    boundary.published.id !== current.published.id ||
    boundary.published.checksum !== current.published.checksum ||
    boundary.initialPublished.id !== current.published.id ||
    boundary.initialPublished.checksum !== current.published.checksum ||
    boundary.initialFactsChecksum !== current.factsChecksum ||
    boundary.twoPhase.compilerSourceChecksum !==
      current.plan.compilerSource.compilerSourceChecksum ||
    boundary.twoPhase.testTemplateChecksum !== current.plan.test.template.checksum ||
    boundary.twoPhase.boundFactsChecksum !== current.factsChecksum ||
    checksumRuleDocument(receipt.template) !== checksumRuleDocument(current.plan.test.template) ||
    receipt.specializedChecksum !== current.published.checksum ||
    receipt.boundFactsChecksum !== current.factsChecksum ||
    checksumRuleDocument(receipt.execution) !== checksumRuleDocument(boundary.execution) ||
    boundary.execution.status !== 'COMPLETE'
  )
    throw new Error('The native action TEST boundary is stale.')
  requireActionContinuation({
    continuation: boundary.continuation,
    occurrenceId: input.source.occurrenceId,
    published: current.published,
    facts: current.bound.facts
  })
  const policy = deriveEncounterActionD20Policy({
    continuation: boundary.continuation,
    bound: current.bound
  })
  if (checksumRuleDocument(policy) !== checksumRuleDocument(boundary.d20Policy))
    throw new Error('The native action TEST policy is stale.')
  const evidence = buildEncounterActionD20Evidence({
    execution: boundary.execution,
    policy: boundary.d20Policy,
    requestId: boundary.d20.requestId,
    faces: boundary.d20.rawFaces,
    rollMode: boundary.d20.rollMode
  })
  if (checksumRuleDocument(evidence) !== checksumRuleDocument(boundary.d20))
    throw new Error('The native action TEST evidence is stale.')
  const replayed = await input.source.runtime.resume({
    continuation: boundary.continuation,
    response: {
      requestId: boundary.continuation.request.requestId,
      value: boundary.d20.selectedNatural
    }
  })
  if (checksumRuleDocument(replayed) !== checksumRuleDocument(boundary.execution))
    throw new Error('The native action TEST execution is stale.')
  return current
}

/** Seals only the TEST phase so a server-owned interstitial can choose its legal OUTCOME. */
export async function prepareNativeActionTest(
  input: NativeActionBaseInput & {
    resume?: { pending: ResumedNativeActionGraphs; resolution: EncounterEvidenceAnswer }
  }
): Promise<PendingNativeActionGraphs | NativeActionTestBoundary> {
  const current = nativeTestIdentity(input)
  const random = input.random ?? nextRollInt
  let continuation: ServerRuleExecutionContinuationDto | null = null
  let faces: number[] | null = null
  let rollMode: EncounterD20RollMode | null = null
  let policy: ServerRuleExecutionD20PolicyDto | null = null
  let result: Awaited<ReturnType<RulesRuntimeService['executeResolved']>>

  if (!input.resume) {
    result = await input.runtime.executeResolved({
      command: {
        definitionId: current.published.id,
        occurrenceId: input.occurrenceId,
        facts: current.bound.facts
      },
      published: current.published
    })
  } else {
    const pending = input.resume.pending
    if (
      pending.twoPhase?.phase !== 'TEST' ||
      pending.phaseReceipts !== undefined ||
      pending.twoPhase.compilerSourceChecksum !==
        current.plan.compilerSource.compilerSourceChecksum ||
      pending.twoPhase.testTemplateChecksum !== current.plan.test.template.checksum ||
      pending.twoPhase.boundFactsChecksum !== current.factsChecksum
    )
      throw new Error('The native action TEST evidence is stale.')
    requireActionContinuation({
      continuation: pending.continuation,
      occurrenceId: input.occurrenceId,
      published: current.published,
      facts: current.bound.facts
    })
    policy = actionD20Policy({
      phase: 'TEST',
      continuation: pending.continuation,
      bound: current.bound,
      twoPhase: pending.twoPhase
    })
    if (!policy || checksumRuleDocument(policy) !== checksumRuleDocument(pending.d20Policy))
      throw new Error('The native action TEST policy is stale.')
    const response = actionResponse({
      continuation: pending.continuation,
      policy,
      resolution: input.resume.resolution,
      random
    })
    continuation = pending.continuation
    faces = response.faces
    rollMode = response.rollMode
    result = await input.runtime.resume({
      continuation: pending.continuation,
      response: { requestId: pending.continuation.request.requestId, value: response.value }
    })
  }

  if (result.status === 'PAUSED') {
    const pendingPolicy = actionD20Policy({
      phase: 'TEST',
      continuation: result.continuation,
      bound: current.bound,
      twoPhase: {
        phase: 'TEST',
        compilerSourceChecksum: current.plan.compilerSource.compilerSourceChecksum,
        testTemplateChecksum: current.plan.test.template.checksum,
        boundFactsChecksum: current.factsChecksum
      }
    })
    if (!pendingPolicy) throw new Error('The native action TEST requested unsupported evidence.')
    const roller = actionRequestRoller({
      continuation: result.continuation,
      policy: pendingPolicy,
      bound: current.bound,
      twoPhase: null
    })
    if (!input.autoRoll[roller])
      return {
        kind: 'PENDING',
        continuation: result.continuation,
        d20Policy: pendingPolicy,
        roller,
        twoPhase: {
          phase: 'TEST',
          compilerSourceChecksum: current.plan.compilerSource.compilerSourceChecksum,
          testTemplateChecksum: current.plan.test.template.checksum,
          boundFactsChecksum: current.factsChecksum
        }
      }
    const automatic = actionResponse({
      continuation: result.continuation,
      policy: pendingPolicy,
      resolution: { kind: 'AUTO_ROLL', requestId: result.continuation.request.requestId },
      random
    })
    continuation = result.continuation
    faces = automatic.faces
    rollMode = automatic.rollMode
    policy = pendingPolicy
    result = await input.runtime.resume({
      continuation: result.continuation,
      response: { requestId: result.continuation.request.requestId, value: automatic.value }
    })
  }
  if (result.status !== 'COMPLETE' || !continuation || !faces || !rollMode || !policy)
    throw new Error('The native action TEST requires exactly one sealed d20 response.')
  const d20 = buildEncounterActionD20Evidence({
    execution: result,
    policy,
    requestId: continuation.request.requestId,
    faces,
    rollMode
  })
  const boundary: NativeActionTestBoundary = {
    kind: 'TEST_BOUNDARY',
    continuation,
    execution: result,
    published: current.published,
    initialPublished: current.published,
    initialFactsChecksum: current.factsChecksum,
    phaseReceipts: [
      {
        phase: 'TEST',
        template: current.plan.test.template,
        boundFactsChecksum: current.factsChecksum,
        specializedChecksum: current.published.checksum,
        execution: result
      }
    ],
    d20,
    d20Policy: policy,
    twoPhase: {
      phase: 'TEST',
      compilerSourceChecksum: current.plan.compilerSource.compilerSourceChecksum,
      testTemplateChecksum: current.plan.test.template.checksum,
      boundFactsChecksum: current.factsChecksum
    }
  }
  await input.afterTest(result, d20)
  return boundary
}

type NativeActionLegendaryResistanceAudit = NonNullable<
  Extract<NativeTwoPhase, { phase: 'OUTCOME' }>['legendaryResistance']
>

/** Executes the selected OUTCOME after a sealed TEST boundary, without replaying TEST randomness. */
export async function continueNativeActionAfterTest(
  input: NativeActionBaseInput & {
    boundary: NativeActionTestBoundary
    effectivePath?: string
    legendaryResistance?: NativeActionLegendaryResistanceAudit | null
    resume?: { pending: ResumedNativeActionGraphs; resolution: EncounterEvidenceAnswer }
  }
): Promise<PendingNativeActionGraphs | CompleteNativeActionGraphs> {
  const current = await requireNativeTestBoundary({ source: input, boundary: input.boundary })
  const audit = input.legendaryResistance ?? null
  if (
    audit &&
    (audit.originalExecutionChecksum !== checksumRuleDocument(input.boundary.execution) ||
      checksumRuleDocument(audit.d20) !== checksumRuleDocument(input.boundary.d20Policy))
  )
    throw new Error('The Legendary Resistance outcome audit is stale.')
  if (input.effectivePath !== undefined && !audit)
    throw new Error('A native action effective path requires its sealed interstitial audit.')
  const effectivePath = audit
    ? audit.selection === 'USE'
      ? 'ON_SAVE_SUCCESS'
      : 'ON_SAVE_FAIL'
    : undefined
  if (input.effectivePath !== undefined && input.effectivePath !== effectivePath)
    throw new Error(
      'The native action effective path does not match its Legendary Resistance decision.'
    )
  const outcome = resolveEncounterActionPhaseExecution({
    plan: current.plan,
    phase: 'TEST',
    execution: input.boundary.execution,
    adapter: input.adapter,
    facts: current.bound.facts,
    ...(effectivePath === undefined ? {} : { effectivePath })
  })
  if (outcome.kind === 'TEST_ONLY')
    return actionComplete({
      adapter: input.adapter,
      binding: input.binding,
      occurrenceId: input.occurrenceId,
      execution: input.boundary.execution,
      published: current.published,
      initialPublished: current.published,
      initialFactsChecksum: current.factsChecksum,
      phaseReceipts: input.boundary.phaseReceipts,
      d20: input.boundary.d20,
      nestedD20: null
    })
  if (outcome.kind !== 'OUTCOME')
    throw new Error('The native action TEST did not select one terminal outcome.')

  const published = outcome.outcome.published
  const bound = input.adapter.bindFacts({ ...input.binding, published })
  const nestedPolicy = nestedOutcomeD20Policy({
    published,
    d20:
      bound.d20RollMode && bound.d20Audit
        ? { rollMode: bound.d20RollMode, ...bound.d20Audit }
        : null
  })
  let twoPhase: Extract<NativeTwoPhase, { phase: 'OUTCOME' }> = {
    phase: 'OUTCOME',
    compilerSourceChecksum: current.plan.compilerSource.compilerSourceChecksum,
    testTemplateChecksum: current.plan.test.template.checksum,
    outcomeTemplateChecksum: outcome.template.checksum,
    boundFactsChecksum: current.factsChecksum,
    testExecution: input.boundary.execution,
    testExecutionChecksum: checksumRuleDocument(input.boundary.execution),
    nestedOutcomeD20: nestedPolicy,
    nestedOutcomeD20Evidence: null,
    legendaryResistance: audit,
    testRollEvidence: {
      requestId: input.boundary.d20.requestId,
      rollMode: input.boundary.d20.rollMode,
      derivedRollMode: input.boundary.d20.derivedRollMode,
      rawFaces: input.boundary.d20.rawFaces,
      selectedNatural: input.boundary.d20.selectedNatural
    }
  }
  let nestedD20: ServerRuleExecutionNestedD20EvidenceDto | null = null
  const random = input.random ?? nextRollInt
  let result: Awaited<ReturnType<RulesRuntimeService['executeResolved']>>
  if (!input.resume) {
    result = await input.runtime.executeResolved({
      command: { definitionId: published.id, occurrenceId: input.occurrenceId, facts: bound.facts },
      published
    })
  } else {
    const pending = input.resume.pending
    if (
      pending.twoPhase?.phase !== 'OUTCOME' ||
      pending.phaseReceipts?.length !== 1 ||
      checksumRuleDocument(pending.phaseReceipts[0]) !==
        checksumRuleDocument(input.boundary.phaseReceipts[0]) ||
      pending.twoPhase.compilerSourceChecksum !== twoPhase.compilerSourceChecksum ||
      pending.twoPhase.testTemplateChecksum !== twoPhase.testTemplateChecksum ||
      pending.twoPhase.outcomeTemplateChecksum !== twoPhase.outcomeTemplateChecksum ||
      pending.twoPhase.boundFactsChecksum !== twoPhase.boundFactsChecksum ||
      pending.twoPhase.testExecutionChecksum !== twoPhase.testExecutionChecksum ||
      checksumRuleDocument(pending.twoPhase.legendaryResistance) !==
        checksumRuleDocument(twoPhase.legendaryResistance) ||
      checksumRuleDocument(pending.twoPhase.nestedOutcomeD20) !== checksumRuleDocument(nestedPolicy)
    )
      throw new Error('The native action OUTCOME evidence is stale.')
    twoPhase = pending.twoPhase
    nestedD20 = pending.twoPhase.nestedOutcomeD20Evidence
    requireActionContinuation({
      continuation: pending.continuation,
      occurrenceId: input.occurrenceId,
      published,
      facts: bound.facts
    })
    const policy = actionD20Policy({
      phase: 'OUTCOME',
      continuation: pending.continuation,
      bound,
      twoPhase
    })
    if (checksumRuleDocument(policy) !== checksumRuleDocument(pending.d20Policy))
      throw new Error('The native action OUTCOME policy is stale.')
    const response = actionResponse({
      continuation: pending.continuation,
      policy,
      resolution: input.resume.resolution,
      random
    })
    result = await input.runtime.resume({
      continuation: pending.continuation,
      response: { requestId: pending.continuation.request.requestId, value: response.value }
    })
    if (policy && response.faces && response.rollMode) {
      if (nestedD20)
        throw new Error('The native action OUTCOME requested more than one nested save.')
      nestedD20 = buildEncounterSaveD20Evidence({
        policy,
        requestId: pending.continuation.request.requestId,
        faces: response.faces,
        rollMode: response.rollMode
      })
      twoPhase = { ...twoPhase, nestedOutcomeD20Evidence: nestedD20 }
    }
  }

  while (result.status === 'PAUSED') {
    const policy = actionD20Policy({
      phase: 'OUTCOME',
      continuation: result.continuation,
      bound,
      twoPhase
    })
    const roller = actionRequestRoller({
      continuation: result.continuation,
      policy,
      bound,
      twoPhase
    })
    if (!input.autoRoll[roller])
      return {
        kind: 'PENDING',
        continuation: result.continuation,
        d20Policy: policy,
        roller,
        twoPhase,
        phaseReceipts: input.boundary.phaseReceipts
      }
    const response = actionResponse({
      continuation: result.continuation,
      policy,
      resolution: { kind: 'AUTO_ROLL', requestId: result.continuation.request.requestId },
      random
    })
    if (policy && response.faces && response.rollMode) {
      if (nestedD20)
        throw new Error('The native action OUTCOME requested more than one nested save.')
      nestedD20 = buildEncounterSaveD20Evidence({
        policy,
        requestId: result.continuation.request.requestId,
        faces: response.faces,
        rollMode: response.rollMode
      })
      twoPhase = { ...twoPhase, nestedOutcomeD20Evidence: nestedD20 }
    }
    result = await input.runtime.resume({
      continuation: result.continuation,
      response: { requestId: result.continuation.request.requestId, value: response.value }
    })
  }
  if (result.status !== 'COMPLETE') throw new Error('The native action OUTCOME did not settle.')
  if (nestedD20 && twoPhase.nestedOutcomeD20)
    requireEncounterSaveD20EvidenceTrace({
      execution: result,
      policy: twoPhase.nestedOutcomeD20,
      evidence: nestedD20
    })
  const phaseReceipts: NativePhaseReceipts = [
    ...input.boundary.phaseReceipts,
    {
      phase: 'OUTCOME',
      template: outcome.template,
      boundFactsChecksum: checksumRuleDocument(bound.facts),
      specializedChecksum: published.checksum,
      execution: result
    }
  ]
  ruleExecutionPhaseReceiptsDtoSchema.parse(phaseReceipts)
  return actionComplete({
    adapter: input.adapter,
    binding: input.binding,
    occurrenceId: input.occurrenceId,
    execution: result,
    published,
    initialPublished: current.published,
    initialFactsChecksum: current.factsChecksum,
    phaseReceipts,
    d20: input.boundary.d20,
    nestedD20
  })
}

/**
 * Advances an Assisted action, optionally from one sealed evidence response. Each further request
 * rolls immediately when its roller auto-rolls and otherwise pauses for that roller.
 */
export async function advanceNativeActionGraphs(input: {
  runtime: RulesRuntimeService
  adapter: CharacterRuleActionSystemAdapter
  plan: CharacterRuleActionExecutionPlan
  occurrenceId: string
  autoRoll: EncounterActionAutoRoll
  binding: Omit<Parameters<CharacterRuleActionSystemAdapter['bindFacts']>[0], 'published'>
  afterTest(execution: ServerCompletedRuleExecutionDto): Promise<void>
  resume?: { pending: ResumedNativeActionGraphs; resolution: EncounterEvidenceAnswer }
  random?: (maximum: number) => number
}): Promise<PendingNativeActionGraphs | CompleteNativeActionGraphs> {
  const random = input.random ?? nextRollInt
  const initialPublished =
    input.plan.kind === 'SINGLE_GRAPH' ? input.plan.published : input.plan.test.published
  const initialBound = input.adapter.bindFacts({ ...input.binding, published: initialPublished })
  const initialFactsChecksum = checksumRuleDocument(initialBound.facts)
  let phase: 'SINGLE' | 'TEST' | 'OUTCOME' = input.plan.kind === 'SINGLE_GRAPH' ? 'SINGLE' : 'TEST'
  let published = initialPublished
  let bound = initialBound
  let phaseReceipts: NativePhaseReceipts = []
  let outcomeTemplate: NativePhaseReceipts[number]['template'] | null = null
  let twoPhase: NativeTwoPhase | null =
    input.plan.kind === 'TEST_OUTCOME'
      ? {
          phase: 'TEST',
          compilerSourceChecksum: input.plan.compilerSource.compilerSourceChecksum,
          testTemplateChecksum: input.plan.test.template.checksum,
          boundFactsChecksum: initialFactsChecksum
        }
      : null
  let testD20: ServerRuleExecutionD20EvidenceDto | null = null
  let nestedD20: ServerRuleExecutionNestedD20EvidenceDto | null = null
  /** The TEST or single-stage d20 answered during this call; set by `answer`. */
  const stage: {
    d20: {
      continuation: ServerRuleExecutionContinuationDto
      policy: ServerRuleExecutionD20PolicyDto
      faces: number[]
      rollMode: EncounterD20RollMode
    } | null
  } = { d20: null }
  let result: Awaited<ReturnType<RulesRuntimeService['executeResolved']>>

  /** Resumes one request and records its d20 as the stage roll or the OUTCOME nested save. */
  async function answer(
    continuation: ServerRuleExecutionContinuationDto,
    policy: ServerRuleExecutionD20PolicyDto | null,
    resolution: EncounterEvidenceAnswer
  ) {
    const response = actionResponse({ continuation, policy, resolution, random })
    const resumed = await input.runtime.resume({
      continuation,
      response: { requestId: continuation.request.requestId, value: response.value }
    })
    if (policy && response.faces && response.rollMode) {
      if (phase === 'OUTCOME' && twoPhase?.phase === 'OUTCOME') {
        if (nestedD20) throw new Error('The action OUTCOME requested more than one nested save.')
        nestedD20 = buildEncounterSaveD20Evidence({
          policy,
          requestId: continuation.request.requestId,
          faces: response.faces,
          rollMode: response.rollMode
        })
        twoPhase = { ...twoPhase, nestedOutcomeD20Evidence: nestedD20 }
      } else {
        if (stage.d20) throw new Error('The action requested more than one d20 stage.')
        stage.d20 = { continuation, policy, faces: response.faces, rollMode: response.rollMode }
      }
    }
    return resumed
  }

  /** Rolls each request whose roller auto-rolls and returns the first one to prompt for. */
  async function rollUntilPrompt(): Promise<PendingNativeActionGraphs | null> {
    while (result.status === 'PAUSED') {
      const { continuation } = result
      const policy = actionD20Policy({ phase, continuation, bound, twoPhase })
      const roller = actionRequestRoller({ continuation, policy, bound, twoPhase })
      if (!input.autoRoll[roller])
        return {
          kind: 'PENDING',
          continuation,
          d20Policy: policy,
          twoPhase,
          roller,
          ...(phaseReceipts.length ? { phaseReceipts } : {})
        }
      result = await answer(continuation, policy, {
        kind: 'AUTO_ROLL',
        requestId: continuation.request.requestId
      })
    }
    return null
  }

  if (!input.resume) {
    result = await input.runtime.executeResolved({
      command: { definitionId: published.id, occurrenceId: input.occurrenceId, facts: bound.facts },
      published
    })
  } else {
    const pending = input.resume.pending
    phase = pending.twoPhase?.phase ?? 'SINGLE'
    if (phase === 'SINGLE' && input.plan.kind !== 'SINGLE_GRAPH')
      throw new Error('The action phase identity is stale.')
    if (phase === 'TEST') {
      if (
        input.plan.kind !== 'TEST_OUTCOME' ||
        pending.twoPhase?.compilerSourceChecksum !==
          input.plan.compilerSource.compilerSourceChecksum ||
        pending.twoPhase.testTemplateChecksum !== input.plan.test.template.checksum ||
        pending.twoPhase.boundFactsChecksum !== initialFactsChecksum ||
        pending.phaseReceipts !== undefined
      )
        throw new Error('The action TEST evidence is stale.')
    } else if (phase === 'OUTCOME') {
      if (input.plan.kind !== 'TEST_OUTCOME' || pending.twoPhase?.phase !== 'OUTCOME')
        throw new Error('The action OUTCOME evidence is stale.')
      const receipt = pending.phaseReceipts?.[0]
      if (
        pending.phaseReceipts?.length !== 1 ||
        !receipt ||
        receipt.phase !== 'TEST' ||
        checksumRuleDocument(receipt.template) !== checksumRuleDocument(input.plan.test.template) ||
        receipt.specializedChecksum !== initialPublished.checksum ||
        receipt.boundFactsChecksum !== initialFactsChecksum ||
        checksumRuleDocument(receipt.execution) !== pending.twoPhase.testExecutionChecksum ||
        checksumRuleDocument(pending.twoPhase.testExecution) !==
          pending.twoPhase.testExecutionChecksum ||
        pending.twoPhase.compilerSourceChecksum !==
          input.plan.compilerSource.compilerSourceChecksum ||
        pending.twoPhase.testTemplateChecksum !== input.plan.test.template.checksum ||
        pending.twoPhase.boundFactsChecksum !== initialFactsChecksum
      )
        throw new Error('The action OUTCOME evidence is stale.')
      const outcome = resolveEncounterActionPhaseExecution({
        plan: input.plan,
        phase: 'TEST',
        execution: pending.twoPhase.testExecution,
        adapter: input.adapter,
        facts: initialBound.facts,
        ...(pending.twoPhase.legendaryResistance === null
          ? {}
          : {
              effectivePath:
                pending.twoPhase.legendaryResistance.selection === 'USE'
                  ? 'ON_SAVE_SUCCESS'
                  : 'ON_SAVE_FAIL'
            })
      })
      if (
        outcome.kind !== 'OUTCOME' ||
        outcome.template.checksum !== pending.twoPhase.outcomeTemplateChecksum
      )
        throw new Error('The action OUTCOME evidence is stale.')
      published = outcome.outcome.published
      outcomeTemplate = outcome.template
      bound = input.adapter.bindFacts({ ...input.binding, published })
      phaseReceipts = [receipt]
      twoPhase = pending.twoPhase
      const audit = initialBound.d20Audit
      const roll = twoPhase.testRollEvidence
      if (!audit || initialBound.d20RollMode !== roll.derivedRollMode)
        throw new Error('The action TEST roll policy is stale.')
      testD20 = buildEncounterActionD20Evidence({
        execution: twoPhase.testExecution,
        policy: {
          requestNodeId: roll.requestId,
          rollMode: roll.derivedRollMode,
          contributors: [...audit.contributors],
          contributorChecksum: audit.contributorChecksum,
          modifier: audit.modifier,
          dc: audit.defenseOrDc
        },
        requestId: roll.requestId,
        faces: roll.rawFaces,
        rollMode: roll.rollMode
      })
      const nestedPolicy = nestedOutcomeD20Policy({
        published,
        d20:
          bound.d20RollMode && bound.d20Audit
            ? { rollMode: bound.d20RollMode, ...bound.d20Audit }
            : null
      })
      if (checksumRuleDocument(nestedPolicy) !== checksumRuleDocument(twoPhase.nestedOutcomeD20))
        throw new Error('The action OUTCOME roll policy is stale.')
      nestedD20 = twoPhase.nestedOutcomeD20Evidence
    }
    requireActionContinuation({
      continuation: pending.continuation,
      occurrenceId: input.occurrenceId,
      published,
      facts: bound.facts
    })
    const policy = actionD20Policy({ phase, continuation: pending.continuation, bound, twoPhase })
    if (checksumRuleDocument(policy) !== checksumRuleDocument(pending.d20Policy))
      throw new Error('The action evidence policy is stale.')
    result = await answer(pending.continuation, policy, input.resume.resolution)
  }

  const prompt = await rollUntilPrompt()
  if (prompt) return prompt
  if (result.status !== 'COMPLETE') throw new Error('The action did not settle.')

  if (phase === 'SINGLE')
    return actionComplete({
      adapter: input.adapter,
      binding: input.binding,
      occurrenceId: input.occurrenceId,
      execution: result,
      published,
      initialPublished,
      initialFactsChecksum,
      phaseReceipts,
      d20: stage.d20
        ? buildEncounterActionD20Evidence({
            execution: result,
            policy: stage.d20.policy,
            requestId: stage.d20.continuation.request.requestId,
            faces: stage.d20.faces,
            rollMode: stage.d20.rollMode
          })
        : null,
      nestedD20: null
    })

  if (phase === 'TEST') {
    if (!stage.d20 || input.plan.kind !== 'TEST_OUTCOME')
      throw new Error('The action TEST requires exactly one sealed d20 response.')
    testD20 = buildEncounterActionD20Evidence({
      execution: result,
      policy: deriveEncounterActionD20Policy({
        continuation: stage.d20.continuation,
        bound: initialBound
      }),
      requestId: stage.d20.continuation.request.requestId,
      faces: stage.d20.faces,
      rollMode: stage.d20.rollMode
    })
    phaseReceipts = [
      {
        phase: 'TEST',
        template: input.plan.test.template,
        boundFactsChecksum: initialFactsChecksum,
        specializedChecksum: initialPublished.checksum,
        execution: result
      }
    ]
    await input.afterTest(result)
    const outcome = resolveEncounterActionPhaseExecution({
      plan: input.plan,
      phase: 'TEST',
      execution: result,
      adapter: input.adapter,
      facts: initialBound.facts
    })
    if (outcome.kind === 'TEST_ONLY')
      return actionComplete({
        adapter: input.adapter,
        binding: input.binding,
        occurrenceId: input.occurrenceId,
        execution: result,
        published,
        initialPublished,
        initialFactsChecksum,
        phaseReceipts,
        d20: testD20,
        nestedD20: null
      })
    if (outcome.kind !== 'OUTCOME')
      throw new Error('The action TEST did not select one terminal outcome.')
    phase = 'OUTCOME'
    published = outcome.outcome.published
    outcomeTemplate = outcome.template
    bound = input.adapter.bindFacts({ ...input.binding, published })
    const nestedPolicy = nestedOutcomeD20Policy({
      published,
      d20:
        bound.d20RollMode && bound.d20Audit
          ? { rollMode: bound.d20RollMode, ...bound.d20Audit }
          : null
    })
    twoPhase = {
      phase: 'OUTCOME',
      compilerSourceChecksum: input.plan.compilerSource.compilerSourceChecksum,
      testTemplateChecksum: input.plan.test.template.checksum,
      outcomeTemplateChecksum: outcome.template.checksum,
      boundFactsChecksum: initialFactsChecksum,
      testExecution: result,
      testExecutionChecksum: checksumRuleDocument(result),
      nestedOutcomeD20: nestedPolicy,
      nestedOutcomeD20Evidence: null,
      legendaryResistance: null,
      testRollEvidence: {
        requestId: testD20.requestId,
        rollMode: testD20.rollMode,
        derivedRollMode: testD20.derivedRollMode,
        rawFaces: testD20.rawFaces,
        selectedNatural: testD20.selectedNatural
      }
    }
    result = await input.runtime.executeResolved({
      command: { definitionId: published.id, occurrenceId: input.occurrenceId, facts: bound.facts },
      published
    })
    const outcomePrompt = await rollUntilPrompt()
    if (outcomePrompt) return outcomePrompt
  }

  if (result.status !== 'COMPLETE') throw new Error('The action outcome did not settle.')
  if (nestedD20 && twoPhase?.phase === 'OUTCOME' && twoPhase.nestedOutcomeD20)
    requireEncounterSaveD20EvidenceTrace({
      execution: result,
      policy: twoPhase.nestedOutcomeD20,
      evidence: nestedD20
    })
  if (!outcomeTemplate) throw new Error('The action OUTCOME template is unavailable.')
  phaseReceipts.push({
    phase: 'OUTCOME',
    template: outcomeTemplate,
    boundFactsChecksum: checksumRuleDocument(bound.facts),
    specializedChecksum: published.checksum,
    execution: result
  })
  ruleExecutionPhaseReceiptsDtoSchema.parse(phaseReceipts)
  return actionComplete({
    adapter: input.adapter,
    binding: input.binding,
    occurrenceId: input.occurrenceId,
    execution: result,
    published,
    initialPublished,
    initialFactsChecksum,
    phaseReceipts,
    d20: testD20,
    nestedD20
  })
}
