import type {
  CharacterRuleActionApplication,
  CharacterRuleActionExecutionPlan,
  CharacterRuleActionSystemAdapter
} from './characterRuleActionSystemAdapter.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import {
  actionD20Policy,
  actionRequestRoller,
  asksForOptionalDie,
  requireActionContinuation,
  type EncounterActionAutoRoll,
  type EncounterActionRoller,
  type NativeTwoPhase
} from './encounterActionRequest.js'
import {
  nativeTestIdentity,
  requireNativeTestBoundary,
  type NativeActionBaseInput,
  type NativeActionTestBoundary
} from './encounterActionTestBoundary.js'
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
  type EncounterEvidenceAnswer,
  testDieAnswer
} from './encounterEvidenceAnswer.js'
import { resumeEncounterD20 } from './encounterD20AddedDice.js'
import { windowSpentReactions } from './encounterD20Window.js'
import {
  heldWindowedSave,
  nextActionWindowDice,
  openActionSaveWindow,
  windowedSaveResponse,
  type EncounterActionSaveWindow,
  type EncounterActionWindowAnswer
} from './encounterActionSaveWindow.js'
import type { RollModeKeep } from '@artificer-toolkit/schema/shared/systemCoreCode'
import {
  actionResponse,
  settleEncounterD20Answer,
  type SettledActionResponse
} from './encounterD20Settlement.js'
import type { D20RolledAddedDieDto } from '@artificer-toolkit/schema/shared/d20AddedDice'
import type { D20WindowPausePayloadDto } from '@artificer-toolkit/schema/shared/ruleExecutionD20WindowOffer'
import {
  isDamageRollWindow,
  type DamageRerollCostDto
} from '@artificer-toolkit/schema/shared/ruleExecutionDamageRollWindow'
import {
  holdEncounterDamageRoll,
  replayEncounterDamageRollWindow,
  type EncounterDamageRerollAnswer
} from './encounterDamageRollWindow.js'
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
import type { EncounterActionHeldD20Dto } from '@artificer-toolkit/schema/shared/encounterActionPending'
import type { EncounterActionPauseDto } from '@artificer-toolkit/schema/shared/encounterPause'
import type { NativeActionOnHitAudit } from './encounterActionOnHitBinding.js'
import { onHitOutcomeBinding, outcomeSelectionFacts } from './encounterActionOnHitBinding.js'
import {
  actionComplete,
  type CompleteNativeActionGraphs,
  type NativeOutcomePhase,
  type NativePhaseReceipts
} from './encounterActionCompletion.js'
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
        (phase === 'TEST' && !asksForOptionalDie(continuation)) ||
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

/** A paused request resumed by its answer; whose roll it was no longer matters. */
export type ResumedNativeActionGraphs = Omit<PendingNativeActionGraphs, 'roller'>

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
   * Set while the action waits on a choice: a rolled save's d20 window, a failed save's Legendary
   * Resistance, a hit's reaction or on-hit rider, or a settled action's forced-movement destination.
   * `continuation` is that choice.
   */
  pause?: Extract<
    EncounterActionPauseDto,
    { kind: 'ROLL_WINDOW' | 'LEGENDARY_RESISTANCE' | 'REACTION' | 'ON_HIT' | 'FORCED_MOVEMENT' }
  >
}

/** Seals only the TEST phase so a server-owned interstitial can choose its legal OUTCOME. */
export async function prepareNativeActionTest(
  input: NativeActionBaseInput & {
    resume?: {
      pending: ResumedNativeActionGraphs
      resolution: EncounterEvidenceAnswer | EncounterActionWindowAnswer
    }
    /** The true and believed sight of the attack roll, as in `advanceNativeActionGraphs`. */
    attackSight?: EncounterPreparedAttackSight | null
    /** The dice the TEST save's target holds for after its d20 (D168), as in `advanceNativeActionGraphs`. */
    saveWindow?: EncounterActionSaveWindow
    /** The dice a d20 window spent on the recorded roll, replayed when a retained TEST is rebuilt. */
    windowDice?: readonly D20RolledAddedDieDto[]
    /**
     * The dice this TEST rolled after its d20 when it was first answered, replayed by request when a
     * kept answer rebuilds it; a die it did not roll then is refused, never rolled.
     */
    testDice?: readonly { requestId: string; value: number }[]
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
  let mayAddDice = false
  let result: Awaited<ReturnType<RulesRuntimeService['executeResolved']>>
  const testPhase = {
    phase: 'TEST' as const,
    compilerSourceChecksum: current.plan.compilerSource.compilerSourceChecksum,
    testTemplateChecksum: current.plan.test.template.checksum,
    boundFactsChecksum: current.factsChecksum
  }

  /**
   * A rolled TEST d20 that a die could still change is shown to its next decider before it resolves:
   * as rolled, or as the window just answered settled it, for the next reactor (D207).
   */
  async function windowRolledSave(
    rolledContinuation: ServerRuleExecutionContinuationDto,
    rolledPolicy: ServerRuleExecutionD20PolicyDto,
    rolled:
      | { response: SettledActionResponse; appRollId: string | null }
      | { previous: D20WindowPausePayloadDto; d20: EncounterActionWindowAnswer['d20'] }
  ) {
    const next = await nextActionWindowDice({
      saveWindow: input.saveWindow,
      policy: rolledPolicy,
      previous: 'previous' in rolled ? rolled.previous : null
    })
    if (next.dice.length > 0) mayAddDice = true
    const window =
      next.dice.length > 0 && !attackSight
        ? await openActionSaveWindow({
            runtime: input.runtime,
            occurrenceId: input.occurrenceId,
            gameSystemId: current.published.gameSystemId,
            dice: next.dice,
            answeredReactorActorIds: next.answeredReactorActorIds,
            ...('previous' in rolled
              ? rolled
              : { continuation: rolledContinuation, policy: rolledPolicy, ...rolled })
          })
        : null
    return window
      ? {
          kind: 'PENDING' as const,
          ...window,
          d20Policy: null,
          twoPhase: testPhase,
          roller: actionRequestRoller({
            continuation: rolledContinuation,
            policy: rolledPolicy,
            bound: current.bound,
            twoPhase: null
          })
        }
      : null
  }

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
    // A window holds its save as it paused before the roll; the window's answer resumes that request.
    const windowed = heldWindowedSave(pending.pause, input.resume.resolution)
    const heldContinuation = windowed ? windowed.continuation : pending.continuation
    requireActionContinuation({
      continuation: heldContinuation,
      occurrenceId: input.occurrenceId,
      published: current.published,
      facts: current.bound.facts
    })
    policy = actionD20Policy({
      phase: 'TEST',
      continuation: heldContinuation,
      bound: current.bound,
      twoPhase: pending.twoPhase
    })
    if (
      !policy ||
      (!windowed && checksumRuleDocument(policy) !== checksumRuleDocument(pending.d20Policy))
    )
      throw new Error('The native action TEST policy is stale.')
    const { resolution } = input.resume
    const sight =
      resolution.kind === 'ROLL_WINDOW'
        ? null
        : sightGovernedStageD20({
            attackSight,
            policy,
            stored: { d20Belief: pending.d20Belief ?? null, heldD20: pending.heldD20 ?? null }
          })
    const response =
      resolution.kind === 'ROLL_WINDOW'
        ? windowedSaveResponse({ continuation: heldContinuation, policy, d20: resolution.d20 })
        : actionResponse({
            gameSystemId: current.published.gameSystemId,
            continuation: pending.continuation,
            policy,
            resolution,
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
    if (resolution.kind !== 'ROLL_WINDOW') {
      const window = await windowRolledSave(pending.continuation, policy, {
        response,
        appRollId: resolution.kind === 'SYSTEM_ROLL' ? resolution.rollId : null
      })
      if (window) return window
    } else {
      mayAddDice = true
      if (pending.pause?.kind !== 'ROLL_WINDOW' || isDamageRollWindow(pending.pause.payload))
        throw new Error('The native action TEST evidence is stale.')
      // The next reactor, if any, is asked about the roll as the window just answered settled it.
      const window = await windowRolledSave(heldContinuation, policy, {
        previous: pending.pause.payload,
        d20: resolution.d20
      })
      if (window) return window
    }
    const windowDice = input.windowDice ?? []
    if (windowDice.length > 0) mayAddDice = true
    continuation = heldContinuation
    faces = response.faces
    rollMode = response.rollMode
    keep = response.keep
    modeAdjustment = response.modeAdjustment
    addedDice = [...response.addedDice, ...windowDice]
    result = await resumeEncounterD20({
      continuation,
      natural: response.value,
      addedDice,
      mayAddDice,
      resume: (step) => input.runtime.resume(step)
    })
  }

  // Only a TEST whose d20 is still unsealed pauses for it here; an answered save's later dice are the System's.
  if (result.status === 'PAUSED' && !policy) {
    const pendingPolicy = actionD20Policy({
      phase: 'TEST',
      continuation: result.continuation,
      bound: current.bound,
      twoPhase: testPhase
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
        twoPhase: testPhase,
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
    const window = await windowRolledSave(result.continuation, pendingPolicy, {
      response: automatic,
      appRollId: null
    })
    if (window) return window
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
      mayAddDice,
      resume: (step) => input.runtime.resume(step)
    })
  }
  // The dice a TEST rolls once its d20 has chosen the path are the System's, as an OUTCOME's are.
  while (
    result.status === 'PAUSED' &&
    !actionD20Policy({
      phase: 'TEST',
      continuation: result.continuation,
      bound: current.bound,
      twoPhase: testPhase
    })
  ) {
    const die = actionResponse({
      gameSystemId: current.published.gameSystemId,
      continuation: result.continuation,
      policy: null,
      resolution: testDieAnswer(result.continuation.request.requestId, input.testDice),
      random
    })
    result = await resumeEncounterD20({
      continuation: result.continuation,
      natural: die.value,
      addedDice: [],
      mayAddDice,
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

type NativeActionLegendaryResistanceAudit = NonNullable<
  Extract<NativeTwoPhase, { phase: 'OUTCOME' }>['legendaryResistance']
>

type NativeActionReactionAudit = NonNullable<
  Extract<NativeTwoPhase, { phase: 'OUTCOME' }>['reaction']
>

const isHitPath = (resultPath: string | null | undefined) =>
  resultPath === 'ON_HIT' || resultPath === 'ON_CRIT'

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
    /** The costs the caster could pay to reroll the OUTCOME's damage dice (D208). */
    damageRerolls?: readonly DamageRerollCostDto[]
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
  const heldDamage = nestedD20
    ? null
    : await holdEncounterDamageRoll({
        runtime: input.runtime,
        adapter: input.adapter,
        occurrenceId: input.occurrenceId,
        costs: input.damageRerolls,
        published,
        execution: result,
        twoPhase,
        phaseReceipts: input.boundary.phaseReceipts
      })
  if (heldDamage) return heldDamage
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
  /**
   * The dice the TEST save's target holds for after its d20 (D168). A target that holds one sees its
   * rolled d20 in a window before the save resolves; the window's answer resumes the save with the
   * roll and the die it spent.
   */
  saveWindow?: EncounterActionSaveWindow
  /**
   * The costs the caster could pay now to reroll the action's damage dice (D208). With any, a phase
   * that rolled damage and no d20 is held in a window before it settles; the window's answer replays
   * the phase with the chosen dice rolled again.
   */
  damageRerolls?: readonly DamageRerollCostDto[]
  resume?: {
    pending: ResumedNativeActionGraphs
    resolution: EncounterEvidenceAnswer | EncounterActionWindowAnswer | EncounterDamageRerollAnswer
  }
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
  /** Set once a damage window's answer replayed the phase; that phase is never held again. */
  let damageRerolled = false

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
    resolution: EncounterEvidenceAnswer | EncounterActionWindowAnswer,
    stored: {
      d20Belief: EncounterAttackD20Belief | null
      heldD20: EncounterActionHeldD20Dto | null
    },
    /** The window a `ROLL_WINDOW` answer settled; the next reactor, if any, is asked after it. */
    previousWindow: D20WindowPausePayloadDto | null = null
  ) {
    const sight =
      policy !== null && isStageD20(policy) && resolution.kind !== 'ROLL_WINDOW'
        ? sightGovernedStageD20({ attackSight, policy, stored })
        : null
    const response =
      resolution.kind === 'ROLL_WINDOW'
        ? windowedSaveResponse({ continuation, policy, d20: resolution.d20 })
        : actionResponse({
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
    if (resolution.kind === 'ROLL_WINDOW' && !previousWindow)
      throw new Error('The action TEST evidence is stale.')
    const next =
      policy && phase !== 'SINGLE'
        ? await nextActionWindowDice({
            saveWindow: input.saveWindow,
            policy,
            previous: resolution.kind === 'ROLL_WINDOW' ? previousWindow : null
          })
        : null
    // A d20 that a die could still change is shown to its next decider before the save resolves:
    // the roller on its held dice, then each reactor in turn (D207).
    const opening = next && next.dice.length > 0 && !sight && policy ? { ...next, policy } : null
    const window = !opening
      ? null
      : await openActionSaveWindow({
          runtime: input.runtime,
          occurrenceId: input.occurrenceId,
          gameSystemId: published.gameSystemId,
          dice: opening.dice,
          answeredReactorActorIds: opening.answeredReactorActorIds,
          ...(resolution.kind === 'ROLL_WINDOW' && previousWindow
            ? { previous: previousWindow, d20: resolution.d20 }
            : {
                continuation,
                policy: opening.policy,
                response,
                appRollId: resolution.kind === 'SYSTEM_ROLL' ? resolution.rollId : null
              })
        })
    if (window)
      return {
        kind: 'PENDING' as const,
        ...window,
        d20Policy: null,
        twoPhase,
        roller: actionRequestRoller({ continuation, policy, bound, twoPhase }),
        ...(phaseReceipts.length ? { phaseReceipts } : {})
      }
    const resumed = await resumeEncounterD20({
      continuation,
      natural: response.value,
      addedDice: response.addedDice,
      mayAddDice: resolution.kind === 'ROLL_WINDOW' || (next?.dice.length ?? 0) > 0,
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
    // A window holds its save as it paused before the roll; the window's answer resumes that request.
    const { resolution } = input.resume
    const windowed = heldWindowedSave(pending.pause, resolution)
    const window = pending.pause?.kind === 'ROLL_WINDOW' ? pending.pause.payload : null
    if (resolution.kind === 'DAMAGE_REROLL') {
      if (!window || !isDamageRollWindow(window))
        throw new Error('The damage roll window evidence is stale.')
      result = await replayEncounterDamageRollWindow({
        runtime: input.runtime,
        occurrenceId: input.occurrenceId,
        published,
        facts: bound.facts,
        window,
        rerolled: resolution.rerolled
      })
      damageRerolled = true
    } else {
      const continuation = windowed ? windowed.continuation : pending.continuation
      requireActionContinuation({
        continuation,
        occurrenceId: input.occurrenceId,
        published,
        facts: bound.facts
      })
      const policy = actionD20Policy({ phase, continuation, bound, twoPhase })
      if (!windowed && checksumRuleDocument(policy) !== checksumRuleDocument(pending.d20Policy))
        throw new Error('The action evidence policy is stale.')
      const answered = await answer(
        continuation,
        policy,
        resolution,
        { d20Belief: pending.d20Belief ?? null, heldD20: pending.heldD20 ?? null },
        window && !isDamageRollWindow(window) ? window : null
      )
      if ('kind' in answered) return answered
      result = answered
    }
  }

  const prompt = await rollUntilPrompt()
  if (prompt) return prompt
  if (result.status !== 'COMPLETE') throw new Error('The action did not settle.')

  const damageHold = {
    runtime: input.runtime,
    adapter: input.adapter,
    occurrenceId: input.occurrenceId,
    costs: damageRerolled ? undefined : input.damageRerolls
  }
  if (phase === 'SINGLE') {
    const heldDamage = stage.d20
      ? null
      : await holdEncounterDamageRoll({
          ...damageHold,
          published,
          execution: result,
          twoPhase,
          phaseReceipts
        })
    if (heldDamage) return heldDamage
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
  }

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
    // A creature that spent its reaction in the roll's window has none left for the hit.
    const windowReactors = windowSpentReactions({ d20: testD20, nestedD20: null }).map(
      ({ reactorActorId }) => reactorActorId
    )
    const reactionCandidates =
      reaction &&
      !input.binding.absorbedByDecoy &&
      (testD20.resultPath === 'ON_HIT' || testD20.resultPath === 'ON_CRIT')
        ? (await reaction.discover(testD20.resultPath === 'ON_CRIT')).filter(
            ({ reactorActorId }) => !windowReactors.includes(reactorActorId)
          )
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
  const heldDamage = nestedD20
    ? null
    : await holdEncounterDamageRoll({
        ...damageHold,
        published,
        execution: result,
        twoPhase,
        phaseReceipts
      })
  if (heldDamage) return heldDamage
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
