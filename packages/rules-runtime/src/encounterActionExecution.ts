import type {
  CharacterRuleActionApplication,
  CharacterRuleActionExecutionPlan,
  CharacterRuleActionSystemAdapter
} from './characterRuleActionSystemAdapter.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import {
  requireTestRollMode,
  resolveEncounterActionPhaseExecution
} from './encounterActionPhaseExecution.js'
import {
  buildEncounterActionD20Evidence,
  buildEncounterSaveD20Evidence,
  deriveEncounterActionD20Policy,
  nestedOutcomeD20Policy,
  policyAuditDice,
  requireEncounterSaveD20EvidenceTrace
} from './encounterMovementReactionActionExecution.js'
import {
  encounterAttackD20Belief,
  type EncounterAttackD20Belief,
  type EncounterPreparedAttackSight
} from './encounterAttackBelief.js'
import { heldStageD20, sightGovernedStageD20 } from './encounterSightGovernedD20.js'
import {
  type EncounterD20RollMode,
  type EncounterEvidenceAnswer
} from './encounterEvidenceAnswer.js'
import { resumeEncounterD20 } from './encounterD20AddedDice.js'
import type { RollModeKeep } from '@artificer-toolkit/schema/shared/systemCoreCode'
import { actionResponse, settleEncounterD20Answer } from './encounterD20Settlement.js'
import type { D20RolledAddedDieDto } from '@artificer-toolkit/schema/shared/d20AddedDice'
import {
  ruleExecutionPhaseReceiptsDtoSchema,
  type ServerCompletedRuleExecutionDto,
  type ServerPublishedRuleDefinitionDto,
  type ServerRuleExecutionContinuationDto,
  type ServerRuleExecutionD20EvidenceDto,
  type ServerRuleExecutionD20PolicyDto,
  type ServerRuleExecutionNestedD20EvidenceDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  checksumRuleDocument,
  RULE_GRAPH_LIMITS,
  type RuleValue
} from '@artificer-toolkit/shared/rules'
import { directActionTwoPhaseDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionDirectActionPendingContexts'
import type { EncounterActionHeldD20Dto } from '@artificer-toolkit/schema/shared/encounterActionPending'
import type { EncounterActionPauseDto } from '@artificer-toolkit/schema/shared/encounterPause'
import type { EncounterForcedMovementOfferDto } from '@artificer-toolkit/schema/shared/ruleExecutionForcedMovementChoice'
import type { z } from 'zod'
import { holdForOnHitChoice, type EncounterOnHitCandidate } from './encounterOnHitChoice.js'
import {
  encounterReactionPin,
  openEncounterReactionChoice,
  type EncounterAttackReactionCandidate
} from './encounterReactionChoice.js'
import {
  encounterLegendaryResistancePin,
  openEncounterLegendaryResistanceChoice
} from './encounterLegendaryResistanceChoice.js'
import type { EncounterLegendaryResistanceCandidate } from './encounterLegendaryResistanceDiscovery.js'
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
  /** The OUTCOME phase with the decisions it was sealed against, which a later hold retains. */
  outcomePhase: NativeOutcomePhase | null
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
            bound
          })
        : null
    let testEvidence: {
      policy: ReturnType<typeof deriveEncounterActionD20Policy>
      requestId: string
      faces: number[]
      rollMode: EncounterD20RollMode
      keep: RollModeKeep
      addedDice: D20RolledAddedDieDto[]
    } | null = null
    const requests = new Set<string>()
    while (result.status === 'PAUSED') {
      const { continuation } = result
      const request = continuation.request
      if (requests.has(request.requestId) || requests.size >= RULE_GRAPH_LIMITS.NODES)
        throw new Error('The action evidence sequence is invalid.')
      requests.add(request.requestId)
      const isNestedSave = nestedPolicy?.requestNodeId === request.nodeId
      if (
        phase === 'TEST' ||
        isNestedSave ||
        (phase === 'SINGLE' && bound.d20Audit && request.min === 1 && request.max === 20)
      ) {
        const policy = !isNestedSave
          ? deriveEncounterActionD20Policy({ continuation, bound })
          : nestedPolicy!
        const answer = { kind: 'AUTO_ROLL' as const, requestId: request.requestId }
        const {
          rawFaces: faces,
          rollMode,
          keep,
          natural,
          addedDice
        } = settleEncounterD20Answer({
          gameSystemId: published.gameSystemId,
          d20: policy,
          answer,
          rollD20: () => random(20) + 1,
          random
        })
        if (!isNestedSave) {
          if (testEvidence) throw new Error('The action TEST requested more than one d20 stage.')
          testEvidence = { policy, requestId: request.requestId, faces, rollMode, keep, addedDice }
        } else {
          if (nestedD20) throw new Error('The action OUTCOME requested more than one nested save.')
          nestedD20 = buildEncounterSaveD20Evidence({
            policy,
            requestId: request.requestId,
            faces,
            rollMode,
            keep,
            addedDice
          })
        }
        result = await resumeEncounterD20({
          continuation,
          natural,
          addedDice,
          resume: (step) => input.runtime.resume(step)
        })
      } else {
        const width = request.max - request.min + 1
        if (
          request.kind !== 'INTEGER_RANGE' ||
          request.min >= request.max ||
          !Number.isSafeInteger(width) ||
          width > 2 ** 32
        )
          throw new Error('The action outcome requested unsupported integer evidence.')
        const value = request.min + random(width)
        if (!Number.isSafeInteger(value) || value < request.min || value > request.max)
          throw new Error('The action outcome roll is invalid.')
        result = await input.runtime.resume({
          continuation,
          response: { requestId: request.requestId, value }
        })
      }
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
      facts: first.bound.facts,
      testRollMode: requireTestRollMode(d20),
      absorbedByDecoy: input.binding.absorbedByDecoy
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
  // A graph run from its start holds no OUTCOME phase a later choice retains, so it names none.
  const { kind: _complete, ...complete } = actionComplete({
    adapter: input.adapter,
    binding: input.binding,
    occurrenceId: input.occurrenceId,
    execution: terminal.execution,
    published: terminal.published,
    initialPublished: initial,
    initialFactsChecksum: checksumRuleDocument(first.bound.facts),
    phaseReceipts,
    d20,
    nestedD20
  })
  return complete
}

type NativePhaseReceipts = z.infer<typeof ruleExecutionPhaseReceiptsDtoSchema>
type NativeTwoPhase = z.infer<typeof directActionTwoPhaseDtoSchema>
type NativeOutcomePhase = Extract<NativeTwoPhase, { phase: 'OUTCOME' }>

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
  /** The mode the roller's own facts imply for the d20 prompt, when it differs from the true one. */
  d20Belief?: EncounterAttackD20Belief
  /** The d20 already entered while one more is needed to settle the true mode. */
  heldD20?: EncounterActionHeldD20Dto
  /**
   * Set while the action waits on a choice: a failed save's Legendary Resistance, a hit's reaction or
   * on-hit rider, or a settled action's forced-movement destination. `continuation` is that choice.
   */
  pause?: Extract<
    EncounterActionPauseDto,
    { kind: 'LEGENDARY_RESISTANCE' | 'REACTION' | 'ON_HIT' | 'FORCED_MOVEMENT' }
  >
}

type NativeActionTestBoundary = {
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
    rollMode: boundary.d20.rollMode,
    keep: boundary.d20.keep,
    modeAdjustment: boundary.d20.modeAdjustment,
    addedDice: boundary.d20.addedDice ?? []
  })
  if (checksumRuleDocument(evidence) !== checksumRuleDocument(boundary.d20))
    throw new Error('The native action TEST evidence is stale.')
  const replayed = await resumeEncounterD20({
    continuation: boundary.continuation,
    natural: boundary.d20.selectedNatural,
    addedDice: boundary.d20.addedDice ?? [],
    resume: (step) => input.source.runtime.resume(step)
  })
  if (checksumRuleDocument(replayed) !== checksumRuleDocument(boundary.execution))
    throw new Error('The native action TEST execution is stale.')
  return current
}

/** Seals only the TEST phase so a server-owned interstitial can choose its legal OUTCOME. */
export async function prepareNativeActionTest(
  input: NativeActionBaseInput & {
    resume?: { pending: ResumedNativeActionGraphs; resolution: EncounterEvidenceAnswer }
    /** The true and believed sight of the attack roll, as in `advanceNativeActionGraphs`. */
    attackSight?: EncounterPreparedAttackSight | null
  }
): Promise<PendingNativeActionGraphs | NativeActionTestBoundary> {
  const current = nativeTestIdentity(input)
  const random = input.random ?? nextRollInt
  const attackSight = input.attackSight ?? null
  let continuation: ServerRuleExecutionContinuationDto | null = null
  let faces: number[] | null = null
  let rollMode: EncounterD20RollMode | null = null
  let keep: RollModeKeep | null = null
  let modeAdjustment: ServerRuleExecutionD20EvidenceDto['modeAdjustment']
  let addedDice: D20RolledAddedDieDto[] = []
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
    const sight = sightGovernedStageD20({
      attackSight,
      policy,
      stored: { d20Belief: pending.d20Belief ?? null, heldD20: pending.heldD20 ?? null }
    })
    const response = actionResponse({
      gameSystemId: current.published.gameSystemId,
      continuation: pending.continuation,
      policy,
      resolution: input.resume.resolution,
      random,
      sightGoverned: sight
    })
    if (response.kind === 'NEEDS_EXTRA_D20')
      return {
        kind: 'PENDING',
        continuation: pending.continuation,
        d20Policy: policy,
        twoPhase: pending.twoPhase,
        roller: actionRequestRoller({
          continuation: pending.continuation,
          policy,
          bound: current.bound,
          twoPhase: null
        }),
        ...(pending.d20Belief ? { d20Belief: pending.d20Belief } : {}),
        heldD20: heldStageD20(response.heldFace, sight)
      }
    continuation = pending.continuation
    faces = response.faces
    rollMode = response.rollMode
    keep = response.keep
    modeAdjustment = response.modeAdjustment
    addedDice = response.addedDice
    result = await resumeEncounterD20({
      continuation: pending.continuation,
      natural: response.value,
      addedDice,
      resume: (step) => input.runtime.resume(step)
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
    if (!input.autoRoll[roller]) {
      const d20Belief = attackSight
        ? encounterAttackD20Belief({
            policy: pendingPolicy,
            ...attackSight
          })
        : null
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
        },
        ...(d20Belief ? { d20Belief } : {})
      }
    }
    const automatic = actionResponse({
      gameSystemId: current.published.gameSystemId,
      continuation: result.continuation,
      policy: pendingPolicy,
      resolution: { kind: 'AUTO_ROLL', requestId: result.continuation.request.requestId },
      random
    })
    continuation = result.continuation
    faces = automatic.faces
    rollMode = automatic.rollMode
    keep = automatic.keep
    addedDice = automatic.addedDice
    policy = pendingPolicy
    result = await resumeEncounterD20({
      continuation: result.continuation,
      natural: automatic.value,
      addedDice,
      resume: (step) => input.runtime.resume(step)
    })
  }
  if (result.status !== 'COMPLETE' || !continuation || !faces || !rollMode || !keep || !policy)
    throw new Error('The native action TEST requires exactly one sealed d20 response.')
  const d20 = buildEncounterActionD20Evidence({
    execution: result,
    policy,
    requestId: continuation.request.requestId,
    faces,
    rollMode,
    keep,
    modeAdjustment,
    addedDice
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

/**
 * Rebuilds a sealed TEST boundary from current facts and the recorded faces, without rolling again.
 * Omitting `execution` re-evaluates the recorded dice against the given binding (a sealed reaction
 * adjustment); every other caller proves the rebuilt execution equals the retained one.
 */
export async function reconstructNativeActionTest(
  input: Pick<
    NativeActionBaseInput,
    'runtime' | 'adapter' | 'plan' | 'occurrenceId' | 'binding'
  > & {
    execution?: ServerCompletedRuleExecutionDto
    d20: Pick<
      ServerRuleExecutionD20EvidenceDto,
      'requestId' | 'rawFaces' | 'rollMode' | 'keep' | 'selectedNatural' | 'modeAdjustment'
    >
  }
) {
  const source: NativeActionBaseInput = {
    runtime: input.runtime,
    adapter: input.adapter,
    plan: input.plan,
    occurrenceId: input.occurrenceId,
    binding: input.binding,
    autoRoll: { SOURCE: false, TARGET: false },
    afterTest: async () => undefined,
    random: () => {
      throw new Error('Retained TEST evidence must not roll again.')
    }
  }
  const pending = await prepareNativeActionTest(source)
  if (pending.kind !== 'PENDING' || pending.continuation.request.requestId !== input.d20.requestId)
    throw new Error('The retained TEST request is stale.')
  const boundary = await prepareNativeActionTest({
    ...source,
    resume: {
      pending,
      resolution: {
        kind: 'ENTER_DICE',
        requestId: input.d20.requestId,
        rawFaces: input.d20.rawFaces,
        rollMode: input.d20.rollMode
      }
    }
  })
  if (
    boundary.kind !== 'TEST_BOUNDARY' ||
    boundary.d20.rollMode !== input.d20.rollMode ||
    boundary.d20.keep !== input.d20.keep ||
    boundary.d20.selectedNatural !== input.d20.selectedNatural ||
    (input.execution !== undefined &&
      checksumRuleDocument(boundary.execution) !== checksumRuleDocument(input.execution))
  )
    throw new Error('The retained TEST execution is stale.')
  // The recorded faces are already settled, so replaying them cannot rediscover a sight adjustment.
  return input.d20.modeAdjustment
    ? { ...boundary, d20: { ...boundary.d20, modeAdjustment: input.d20.modeAdjustment } }
    : boundary
}

type NativeActionLegendaryResistanceAudit = NonNullable<
  Extract<NativeTwoPhase, { phase: 'OUTCOME' }>['legendaryResistance']
>

type NativeActionReactionAudit = NonNullable<
  Extract<NativeTwoPhase, { phase: 'OUTCOME' }>['reaction']
>

type NativeActionOnHitAudit = NonNullable<Extract<NativeTwoPhase, { phase: 'OUTCOME' }>['onHit']>

const isHitPath = (resultPath: string | null | undefined) =>
  resultPath === 'ON_HIT' || resultPath === 'ON_CRIT'

/**
 * The attack's binding as its OUTCOME sees it: a used optional on-hit rider is selected, at the slot
 * level paid when a slot pays it. The TEST stays bound to the unchosen binding it was sealed against.
 */
export function onHitOutcomeBinding(
  binding: NativeActionBaseInput['binding'],
  onHit: NativeActionOnHitAudit | null
): NativeActionBaseInput['binding'] {
  return onHit?.option
    ? {
        ...binding,
        actionMechanic: {
          ...binding.actionMechanic,
          ...(onHit.option.kind === 'SPELL_SLOT' && { spellCastLevel: onHit.option.slotLevel }),
          selectedOptionalRiderIds: [onHit.option.riderId]
        }
      }
    : binding
}

/**
 * The facts that select and specialize the OUTCOME graph. A rider chosen at the held hit changes which
 * optional entries the OUTCOME contains, so they are bound to the choice, not to the unchosen TEST.
 */
function outcomeSelectionFacts(input: {
  adapter: NativeActionBaseInput['adapter']
  binding: NativeActionBaseInput['binding']
  published: ServerPublishedRuleDefinitionDto
  testFacts: Readonly<Record<string, RuleValue>>
  onHit: NativeActionOnHitAudit | null
}) {
  return input.onHit?.option
    ? input.adapter.bindFacts({
        ...onHitOutcomeBinding(input.binding, input.onHit),
        published: input.published
      }).facts
    : input.testFacts
}

/** Executes the selected OUTCOME after a sealed TEST boundary, without replaying TEST randomness. */
export async function continueNativeActionAfterTest(
  input: NativeActionBaseInput & {
    boundary: NativeActionTestBoundary
    effectivePath?: string
    legendaryResistance?: NativeActionLegendaryResistanceAudit | null
    reaction?: NativeActionReactionAudit | null
    /** The ways the attacker could pay for an optional on-hit rider; any found holds a hit for the attacker's choice. */
    onHitCandidates?: readonly EncounterOnHitCandidate[]
    /** The attacker's decision about those riders, once made. */
    onHit?: NativeActionOnHitAudit | null
    /**
     * The binding the TEST was sealed against, when the OUTCOME runs on a later one: a second ray at
     * a creature lands on the hit points the first left it, but its roll was sealed before that.
     */
    testBinding?: NativeActionBaseInput['binding']
    resume?: { pending: ResumedNativeActionGraphs; resolution: EncounterEvidenceAnswer }
  }
): Promise<PendingNativeActionGraphs | CompleteNativeActionGraphs> {
  const current = await requireNativeTestBoundary({
    source: { ...input, binding: input.testBinding ?? input.binding },
    boundary: input.boundary
  })
  const audit = input.legendaryResistance ?? null
  const reaction = input.reaction ?? null
  if (
    audit &&
    (audit.originalExecutionChecksum !== checksumRuleDocument(input.boundary.execution) ||
      checksumRuleDocument(audit.d20) !== checksumRuleDocument(input.boundary.d20Policy))
  )
    throw new Error('The Legendary Resistance outcome audit is stale.')
  if (reaction && (audit || input.effectivePath !== undefined))
    throw new Error('A reaction decision cannot share an attack TEST with a save-failure decision.')
  if (reaction) {
    const { adjustment } = reaction
    const policy = input.boundary.d20Policy
    const stale = adjustment
      ? reaction.selection !== 'USE' ||
        adjustment.adjustedBoundFactsChecksum !== current.factsChecksum ||
        adjustment.defenseBefore !== reaction.d20.dc ||
        adjustment.defenseAfter !== policy.dc ||
        checksumRuleDocument({ ...reaction.d20, dc: adjustment.defenseAfter }) !==
          checksumRuleDocument(policy)
      : reaction.selection !== 'DECLINE' ||
        reaction.originalExecutionChecksum !== checksumRuleDocument(input.boundary.execution) ||
        checksumRuleDocument(reaction.d20) !== checksumRuleDocument(policy)
    if (stale) throw new Error('The reaction outcome audit is stale.')
  }
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
    facts: outcomeSelectionFacts({
      adapter: input.adapter,
      binding: input.binding,
      published: current.published,
      testFacts: current.bound.facts,
      onHit: input.onHit ?? null
    }),
    testRollMode: input.boundary.d20.rollMode,
    absorbedByDecoy: input.binding.absorbedByDecoy,
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
  const onHit = input.onHit ?? null
  if (onHit && onHit.testExecutionChecksum !== checksumRuleDocument(input.boundary.execution))
    throw new Error('The on-hit outcome audit is stale.')
  if (!onHit && input.onHitCandidates?.length && isHitPath(input.boundary.d20.resultPath))
    return holdForOnHitChoice({
      runtime: input.runtime,
      occurrenceId: input.occurrenceId,
      candidates: input.onHitCandidates,
      twoPhase: input.boundary.twoPhase,
      execution: input.boundary.execution,
      testD20: input.boundary.d20,
      d20: input.boundary.d20Policy,
      gameSystemId: current.published.gameSystemId,
      reaction
    })

  const published = outcome.outcome.published
  const bound = input.adapter.bindFacts({
    ...onHitOutcomeBinding(input.binding, onHit),
    published
  })
  const nestedPolicy = nestedOutcomeD20Policy({
    published,
    bound
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
    reaction,
    onHit,
    testRollEvidence: {
      requestId: input.boundary.d20.requestId,
      rollMode: input.boundary.d20.rollMode,
      keep: input.boundary.d20.keep,
      derivedRollMode: input.boundary.d20.derivedRollMode,
      rawFaces: input.boundary.d20.rawFaces,
      selectedNatural: input.boundary.d20.selectedNatural,
      ...(input.boundary.d20.modeAdjustment
        ? { modeAdjustment: input.boundary.d20.modeAdjustment }
        : {}),
      ...(input.boundary.d20.addedDice ? { addedDice: input.boundary.d20.addedDice } : {})
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
      checksumRuleDocument(pending.twoPhase.reaction) !== checksumRuleDocument(twoPhase.reaction) ||
      checksumRuleDocument(pending.twoPhase.onHit) !== checksumRuleDocument(twoPhase.onHit) ||
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
      gameSystemId: current.published.gameSystemId,
      continuation: pending.continuation,
      policy,
      resolution: input.resume.resolution,
      random
    })
    result = await resumeEncounterD20({
      continuation: pending.continuation,
      natural: response.value,
      addedDice: response.addedDice,
      resume: (step) => input.runtime.resume(step)
    })
    if (policy && response.faces && response.rollMode && response.keep) {
      if (nestedD20)
        throw new Error('The native action OUTCOME requested more than one nested save.')
      nestedD20 = buildEncounterSaveD20Evidence({
        policy,
        requestId: pending.continuation.request.requestId,
        faces: response.faces,
        rollMode: response.rollMode,
        keep: response.keep,
        addedDice: response.addedDice
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
      gameSystemId: current.published.gameSystemId,
      continuation: result.continuation,
      policy,
      resolution: { kind: 'AUTO_ROLL', requestId: result.continuation.request.requestId },
      random
    })
    if (policy && response.faces && response.rollMode && response.keep) {
      if (nestedD20)
        throw new Error('The native action OUTCOME requested more than one nested save.')
      nestedD20 = buildEncounterSaveD20Evidence({
        policy,
        requestId: result.continuation.request.requestId,
        faces: response.faces,
        rollMode: response.rollMode,
        keep: response.keep,
        addedDice: response.addedDice
      })
      twoPhase = { ...twoPhase, nestedOutcomeD20Evidence: nestedD20 }
    }
    result = await resumeEncounterD20({
      continuation: result.continuation,
      natural: response.value,
      addedDice: response.addedDice,
      resume: (step) => input.runtime.resume(step)
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
    nestedD20,
    outcomePhase: twoPhase
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
  /**
   * The Legendary Resistance the resisting target may use against a failed TEST save. A found
   * candidate holds the action before its OUTCOME for the target's choice.
   */
  legendaryResistance?: {
    discover(): Promise<EncounterLegendaryResistanceCandidate | null>
    targetStateChecksum: string
  }
  /**
   * The reactions the attacked target may use against a TEST that hit (`critical` when it hit
   * critically). Any found candidate holds the action before its OUTCOME for the target's choice.
   */
  reaction?: {
    discover(critical: boolean): Promise<readonly EncounterAttackReactionCandidate[]>
    targetStateChecksum: string
  }
  /**
   * The ways the attacker could pay for an optional on-hit rider. Any found holds a hit, once no
   * reaction is offered, for the attacker's choice before its OUTCOME.
   */
  onHitCandidates?: readonly EncounterOnHitCandidate[]
  resume?: { pending: ResumedNativeActionGraphs; resolution: EncounterEvidenceAnswer }
  /**
   * The true and believed sight of an attack roll. Only the room's RESOLVE_ACTION passes it: the
   * attack d20 is then prompted in the believed mode and settled in the true one (ATTACK-10.1).
   */
  attackSight?: EncounterPreparedAttackSight | null
  random?: (maximum: number) => number
}): Promise<PendingNativeActionGraphs | CompleteNativeActionGraphs> {
  const random = input.random ?? nextRollInt
  const attackSight = input.attackSight ?? null
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
      keep: RollModeKeep
      modeAdjustment: ServerRuleExecutionD20EvidenceDto['modeAdjustment']
      addedDice: D20RolledAddedDieDto[]
    } | null
  } = { d20: null }
  let result: Awaited<ReturnType<RulesRuntimeService['executeResolved']>>

  /** Whether this paused request is the TEST or single-stage d20 rather than the OUTCOME save. */
  const isStageD20 = (policy: ServerRuleExecutionD20PolicyDto | null) =>
    policy !== null && phase !== 'OUTCOME'

  /**
   * Resumes one request and records its d20 as the stage roll or the OUTCOME nested save. A
   * sight-governed d20 the roller entered with too few dice returns the same request, pending with
   * the held die, instead of resuming it.
   */
  async function answer(
    continuation: ServerRuleExecutionContinuationDto,
    policy: ServerRuleExecutionD20PolicyDto | null,
    resolution: EncounterEvidenceAnswer,
    stored: {
      d20Belief: EncounterAttackD20Belief | null
      heldD20: EncounterActionHeldD20Dto | null
    }
  ) {
    const sight =
      policy !== null && isStageD20(policy)
        ? sightGovernedStageD20({ attackSight, policy, stored })
        : null
    const response = actionResponse({
      gameSystemId: published.gameSystemId,
      continuation,
      policy,
      resolution,
      random,
      sightGoverned: sight
    })
    if (response.kind === 'NEEDS_EXTRA_D20') {
      const roller = actionRequestRoller({ continuation, policy, bound, twoPhase })
      return {
        kind: 'PENDING' as const,
        continuation,
        d20Policy: policy,
        twoPhase,
        roller,
        ...(stored.d20Belief ? { d20Belief: stored.d20Belief } : {}),
        heldD20: heldStageD20(response.heldFace, sight)
      }
    }
    const resumed = await resumeEncounterD20({
      continuation,
      natural: response.value,
      addedDice: response.addedDice,
      resume: (step) => input.runtime.resume(step)
    })
    if (policy && response.faces && response.rollMode && response.keep) {
      if (phase === 'OUTCOME' && twoPhase?.phase === 'OUTCOME') {
        if (nestedD20) throw new Error('The action OUTCOME requested more than one nested save.')
        nestedD20 = buildEncounterSaveD20Evidence({
          policy,
          requestId: continuation.request.requestId,
          faces: response.faces,
          rollMode: response.rollMode,
          keep: response.keep,
          addedDice: response.addedDice
        })
        twoPhase = { ...twoPhase, nestedOutcomeD20Evidence: nestedD20 }
      } else {
        if (stage.d20) throw new Error('The action requested more than one d20 stage.')
        stage.d20 = {
          continuation,
          policy,
          faces: response.faces,
          rollMode: response.rollMode,
          keep: response.keep,
          modeAdjustment: response.modeAdjustment,
          addedDice: response.addedDice
        }
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
      if (!input.autoRoll[roller]) {
        const d20Belief =
          policy && isStageD20(policy) && attackSight
            ? encounterAttackD20Belief({
                policy,
                ...attackSight
              })
            : null
        return {
          kind: 'PENDING',
          continuation,
          d20Policy: policy,
          twoPhase,
          roller,
          ...(phaseReceipts.length ? { phaseReceipts } : {}),
          ...(d20Belief ? { d20Belief } : {})
        }
      }
      const next = await answer(
        continuation,
        policy,
        { kind: 'AUTO_ROLL', requestId: continuation.request.requestId },
        { d20Belief: null, heldD20: null }
      )
      // An auto-roller's dice are rolled in the true mode, so no die is ever held for it.
      if ('kind' in next) return next
      result = next
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
        facts: outcomeSelectionFacts({
          adapter: input.adapter,
          binding: input.binding,
          published: initialPublished,
          testFacts: initialBound.facts,
          onHit: pending.twoPhase.onHit
        }),
        testRollMode: pending.twoPhase.testRollEvidence.rollMode,
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
      bound = input.adapter.bindFacts({
        ...onHitOutcomeBinding(input.binding, pending.twoPhase.onHit),
        published
      })
      phaseReceipts = [receipt]
      twoPhase = pending.twoPhase
      const audit = initialBound.d20Audit
      const roll = twoPhase.testRollEvidence
      if (!audit || !initialBound.d20Keep || initialBound.d20RollMode !== roll.derivedRollMode)
        throw new Error('The action TEST roll policy is stale.')
      testD20 = buildEncounterActionD20Evidence({
        execution: twoPhase.testExecution,
        policy: {
          requestNodeId: roll.requestId,
          rollMode: roll.derivedRollMode,
          keep: initialBound.d20Keep,
          contributors: [...audit.contributors],
          contributorChecksum: audit.contributorChecksum,
          modifier: audit.modifier,
          dc: audit.defenseOrDc,
          ...policyAuditDice(audit)
        },
        requestId: roll.requestId,
        faces: roll.rawFaces,
        rollMode: roll.rollMode,
        keep: roll.keep,
        modeAdjustment: roll.modeAdjustment,
        addedDice: roll.addedDice ?? []
      })
      const nestedPolicy = nestedOutcomeD20Policy({
        published,
        bound
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
    const answered = await answer(pending.continuation, policy, input.resume.resolution, {
      d20Belief: pending.d20Belief ?? null,
      heldD20: pending.heldD20 ?? null
    })
    if ('kind' in answered) return answered
    result = answered
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
            rollMode: stage.d20.rollMode,
            keep: stage.d20.keep,
            modeAdjustment: stage.d20.modeAdjustment,
            addedDice: stage.d20.addedDice
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
      rollMode: stage.d20.rollMode,
      keep: stage.d20.keep,
      modeAdjustment: stage.d20.modeAdjustment,
      addedDice: stage.d20.addedDice
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
    const resistance = input.legendaryResistance
    const candidate =
      resistance && testD20.resultPath === 'ON_SAVE_FAIL' ? await resistance.discover() : null
    if (resistance && candidate && twoPhase?.phase === 'TEST') {
      const choice = await openEncounterLegendaryResistanceChoice({
        runtime: input.runtime,
        occurrenceId: input.occurrenceId,
        candidate
      })
      return {
        kind: 'PENDING',
        continuation: choice.continuation,
        d20Policy: null,
        twoPhase,
        roller: 'TARGET',
        pause: {
          kind: 'LEGENDARY_RESISTANCE',
          payload: {
            originalExecution: result,
            originalD20: testD20,
            d20: stage.d20.policy,
            originalExecutionChecksum: checksumRuleDocument(result),
            targetStateChecksum: resistance.targetStateChecksum,
            resistance: encounterLegendaryResistancePin(candidate)
          }
        }
      }
    }
    const reaction = input.reaction
    const reactionCandidates =
      reaction &&
      !input.binding.absorbedByDecoy &&
      (testD20.resultPath === 'ON_HIT' || testD20.resultPath === 'ON_CRIT')
        ? await reaction.discover(testD20.resultPath === 'ON_CRIT')
        : []
    const [firstReaction] = reactionCandidates
    if (reaction && firstReaction && twoPhase?.phase === 'TEST') {
      return {
        kind: 'PENDING',
        continuation: await openEncounterReactionChoice({
          runtime: input.runtime,
          occurrenceId: input.occurrenceId,
          candidate: firstReaction
        }),
        d20Policy: null,
        twoPhase,
        roller: 'TARGET',
        pause: {
          kind: 'REACTION',
          payload: {
            originalExecution: result,
            originalD20: testD20,
            d20: stage.d20.policy,
            originalExecutionChecksum: checksumRuleDocument(result),
            targetStateChecksum: reaction.targetStateChecksum,
            reactions: reactionCandidates.map(encounterReactionPin)
          }
        }
      }
    }
    if (
      input.onHitCandidates?.length &&
      !input.binding.absorbedByDecoy &&
      isHitPath(testD20.resultPath) &&
      twoPhase?.phase === 'TEST'
    )
      return holdForOnHitChoice({
        runtime: input.runtime,
        occurrenceId: input.occurrenceId,
        candidates: input.onHitCandidates,
        twoPhase,
        execution: result,
        testD20,
        d20: stage.d20.policy,
        gameSystemId: initialPublished.gameSystemId,
        reaction: null
      })
    const outcome = resolveEncounterActionPhaseExecution({
      plan: input.plan,
      phase: 'TEST',
      execution: result,
      adapter: input.adapter,
      facts: initialBound.facts,
      testRollMode: requireTestRollMode(testD20),
      absorbedByDecoy: input.binding.absorbedByDecoy
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
      bound
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
      reaction: null,
      onHit: null,
      testRollEvidence: {
        requestId: testD20.requestId,
        rollMode: testD20.rollMode,
        keep: testD20.keep,
        derivedRollMode: testD20.derivedRollMode,
        rawFaces: testD20.rawFaces,
        selectedNatural: testD20.selectedNatural,
        ...(testD20.modeAdjustment ? { modeAdjustment: testD20.modeAdjustment } : {}),
        ...(testD20.addedDice ? { addedDice: testD20.addedDice } : {})
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
    nestedD20,
    outcomePhase: twoPhase?.phase === 'OUTCOME' ? twoPhase : null
  })
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
