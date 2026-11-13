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
  encounterAttackD20Belief,
  isEncounterSightGovernedD20,
  type EncounterAttackD20Belief,
  type EncounterPreparedAttackSight
} from './encounterAttackBelief.js'
import { heldStageD20, sightGovernedStageD20 } from './encounterSightGovernedD20.js'
import {
  type EncounterD20RollMode,
  type EncounterEvidenceAnswer,
  testDieAnswer
} from './encounterEvidenceAnswer.js'
import {
  heldWindowedSave,
  nextActionWindowDice,
  openActionSaveWindow,
  rolledActionTest,
  windowedSaveResponse,
  type EncounterActionSaveWindow,
  type EncounterActionWindowAnswer
} from './encounterActionSaveWindow.js'
import {
  holdForRollReaction,
  type EncounterActionRollReaction,
  type EncounterRolledReactionOffer
} from './encounterActionRollReaction.js'
import type { RollModeKeep } from '@artificer-toolkit/schema/shared/systemCoreCode'
import {
  actionResponse,
  buildEncounterActionD20Evidence,
  buildEncounterSaveD20Evidence,
  deriveEncounterActionD20Policy,
  nestedOutcomeD20Policy,
  requireEncounterSaveD20EvidenceTrace,
  settleEncounterD20Answer,
  settleEncounterD20Test,
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
        result = await settleEncounterD20Test({
          continuation,
          roll: { natural, addedDice },
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
   * `continuation` is that choice. A hit's reactions that run as their holder's own actions (D219)
   * are offered by `CAST_REACTION`; `REACTION` is the inline offer QUALITY-8.T1d3 deletes.
   */
  pause?: Extract<
    EncounterActionPauseDto,
    {
      kind: 'ROLL_WINDOW' | 'LEGENDARY_RESISTANCE' | 'CAST_REACTION' | 'ON_HIT' | 'FORCED_MOVEMENT'
    }
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
    /** The creatures that may react to the rolled attack d20 (D219), as in `advanceNativeActionGraphs`. */
    rollReaction?: EncounterActionRollReaction
    /**
     * The dice added to the recorded roll after it was rolled, replayed when a retained TEST is rebuilt:
     * those a d20 window spent and those a reaction's own action rolled. Its windows settled, so a held
     * die nobody spent adds 0 to the roll.
     */
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
   * as rolled, or as the window just answered settled it, for the next reactor (D207). A d20 that
   * sight governs settles its true mode first, as in `advanceNativeActionGraphs`, so it opens none.
   */
  async function windowRolledSave(
    rolledContinuation: ServerRuleExecutionContinuationDto,
    rolledPolicy: ServerRuleExecutionD20PolicyDto,
    sightGoverned: boolean,
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
      next.dice.length > 0 && !sightGoverned
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

  /**
   * A rolled attack d20 no window holds any more is shown to the next creature that may react to it
   * (D219). A d20 that sight governs is offered to nobody, as it opens no window.
   */
  async function holdRolledAttack(
    rolledPolicy: ServerRuleExecutionD20PolicyDto,
    sightGoverned: boolean,
    rolled: () => EncounterRolledReactionOffer['rolled'] | null
  ) {
    if (!input.rollReaction || sightGoverned || rolledPolicy.savingThrowAbilityDefinitionId)
      return null
    const kept = rolled()
    return kept
      ? holdForRollReaction({
          runtime: input.runtime,
          occurrenceId: input.occurrenceId,
          twoPhase: testPhase,
          rollReaction: input.rollReaction,
          rolled: kept,
          heardReactorActorIds: []
        })
      : null
  }
  /** The TEST as it froze with a d20 just rolled, for the offer made after it. */
  const rolledNow =
    (
      rolledContinuation: ServerRuleExecutionContinuationDto,
      rolledPolicy: ServerRuleExecutionD20PolicyDto,
      response: SettledActionResponse,
      appRollId: string | null
    ) =>
    () => {
      const test = rolledActionTest({
        continuation: rolledContinuation,
        policy: rolledPolicy,
        response
      })
      return test && { test, appRollId }
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
      const appRollId = resolution.kind === 'SYSTEM_ROLL' ? resolution.rollId : null
      const held =
        (await windowRolledSave(pending.continuation, policy, sight !== null, {
          response,
          appRollId
        })) ??
        (await holdRolledAttack(
          policy,
          sight !== null,
          rolledNow(pending.continuation, policy, response, appRollId)
        ))
      if (held) return held
    } else {
      mayAddDice = true
      if (
        !windowed ||
        pending.pause?.kind !== 'ROLL_WINDOW' ||
        isDamageRollWindow(pending.pause.payload)
      )
        throw new Error('The native action TEST evidence is stale.')
      const previous = pending.pause.payload
      // The next reactor, if any, is asked about the roll as the window just answered settled it.
      const held =
        (await windowRolledSave(heldContinuation, policy, false, {
          previous,
          d20: resolution.d20
        })) ??
        (await holdRolledAttack(policy, false, () => ({
          test: { ...windowed, d20: resolution.d20 },
          appRollId: previous.appRollId
        })))
      if (held) return held
    }
    if (input.windowDice) mayAddDice = true
    continuation = heldContinuation
    faces = response.faces
    rollMode = response.rollMode
    keep = response.keep
    modeAdjustment = response.modeAdjustment
    addedDice = [...response.addedDice, ...(input.windowDice ?? [])]
    result = await settleEncounterD20Test({
      continuation,
      roll: { natural: response.value, addedDice },
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
        ? encounterAttackD20Belief({ policy: pendingPolicy, ...attackSight })
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
    const sightGoverned = isEncounterSightGovernedD20({ policy: pendingPolicy, belief: null })
    const held =
      (await windowRolledSave(result.continuation, pendingPolicy, sightGoverned, {
        response: automatic,
        appRollId: null
      })) ??
      (await holdRolledAttack(
        pendingPolicy,
        sightGoverned,
        rolledNow(result.continuation, pendingPolicy, automatic, null)
      ))
    if (held) return held
    continuation = result.continuation
    faces = automatic.faces
    rollMode = automatic.rollMode
    keep = automatic.keep
    addedDice = automatic.addedDice
    policy = pendingPolicy
    result = await settleEncounterD20Test({
      continuation: result.continuation,
      roll: { natural: automatic.value, addedDice },
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
    result = await settleEncounterD20Test({
      continuation: result.continuation,
      roll: { natural: die.value, addedDice: [] },
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

export const isHitPath = (resultPath: string | null | undefined) =>
  resultPath === 'ON_HIT' || resultPath === 'ON_CRIT'

/** Executes the selected OUTCOME after a sealed TEST boundary, without replaying TEST randomness. */
export async function continueNativeActionAfterTest(
  input: NativeActionBaseInput & {
    boundary: NativeActionTestBoundary
    effectivePath?: string
    legendaryResistance?: NativeActionLegendaryResistanceAudit | null
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
    /**
     * The dice the nested save's target holds for after its d20 (D168). A nested save whose target
     * holds one is shown in a window before it resolves; the window's answer resumes it here.
     */
    saveWindow?: EncounterActionSaveWindow
    /** The answer to the OUTCOME's pending request, save window or damage window. */
    resume?: {
      pending: ResumedNativeActionGraphs
      resolution:
        | EncounterEvidenceAnswer
        | EncounterActionWindowAnswer
        | EncounterDamageRerollAnswer
    }
  }
): Promise<PendingNativeActionGraphs | CompleteNativeActionGraphs> {
  const current = await requireNativeTestBoundary({
    source: { ...input, binding: input.testBinding ?? input.binding },
    boundary: input.boundary
  })
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
  if (outcome.kind === 'TEST_ONLY') {
    if (input.resume) throw new Error('The native action OUTCOME evidence is stale.')
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
  }
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
      gameSystemId: current.published.gameSystemId
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
  /** Set once a damage window's answer replayed the OUTCOME; that roll is never held again. */
  let damageRerolled = false

  /**
   * Answers one OUTCOME request and records a nested save's d20. A save d20 that a held die could
   * still change is shown to its holder before the save resolves (D168): the request then stays
   * paused in the returned window, which a `ROLL_WINDOW` answer resumes.
   */
  async function answer(
    continuation: ServerRuleExecutionContinuationDto,
    policy: ServerRuleExecutionD20PolicyDto | null,
    resolution: EncounterEvidenceAnswer | EncounterActionWindowAnswer,
    /** The window a `ROLL_WINDOW` answer settled. */
    previous: D20WindowPausePayloadDto | null
  ) {
    const response =
      resolution.kind === 'ROLL_WINDOW'
        ? windowedSaveResponse({ continuation, policy, d20: resolution.d20 })
        : actionResponse({
            gameSystemId: published.gameSystemId,
            continuation,
            policy,
            resolution,
            random
          })
    const next = policy
      ? await nextActionWindowDice({ saveWindow: input.saveWindow, policy, previous })
      : null
    const window =
      policy && next && next.dice.length > 0
        ? await openActionSaveWindow({
            runtime: input.runtime,
            occurrenceId: input.occurrenceId,
            gameSystemId: published.gameSystemId,
            dice: next.dice,
            answeredReactorActorIds: next.answeredReactorActorIds,
            ...(resolution.kind === 'ROLL_WINDOW' && previous
              ? { previous, d20: resolution.d20 }
              : {
                  continuation,
                  policy,
                  response,
                  appRollId: resolution.kind === 'SYSTEM_ROLL' ? resolution.rollId : null
                })
          })
        : null
    if (window)
      return {
        kind: 'PENDING' as const,
        ...window,
        d20Policy: null,
        twoPhase,
        roller: actionRequestRoller({ continuation, policy, bound, twoPhase }),
        phaseReceipts: input.boundary.phaseReceipts
      }
    const resumed = await settleEncounterD20Test({
      continuation,
      roll: { natural: response.value, addedDice: response.addedDice },
      mayAddDice: resolution.kind === 'ROLL_WINDOW' || (next?.dice.length ?? 0) > 0,
      resume: (step) => input.runtime.resume(step)
    })
    if (policy && response.faces && response.rollMode && response.keep) {
      if (nestedD20)
        throw new Error('The native action OUTCOME requested more than one nested save.')
      nestedD20 = buildEncounterSaveD20Evidence({
        policy,
        requestId: continuation.request.requestId,
        faces: response.faces,
        rollMode: response.rollMode,
        keep: response.keep,
        addedDice: response.addedDice
      })
      twoPhase = { ...twoPhase, nestedOutcomeD20Evidence: nestedD20 }
    }
    return resumed
  }

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
      checksumRuleDocument(pending.twoPhase.onHit) !== checksumRuleDocument(twoPhase.onHit) ||
      checksumRuleDocument(pending.twoPhase.nestedOutcomeD20) !== checksumRuleDocument(nestedPolicy)
    )
      throw new Error('The native action OUTCOME evidence is stale.')
    twoPhase = pending.twoPhase
    nestedD20 = pending.twoPhase.nestedOutcomeD20Evidence
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
      const policy = actionD20Policy({ phase: 'OUTCOME', continuation, bound, twoPhase })
      if (!windowed && checksumRuleDocument(policy) !== checksumRuleDocument(pending.d20Policy))
        throw new Error('The native action OUTCOME policy is stale.')
      const answered = await answer(
        continuation,
        policy,
        resolution,
        window && !isDamageRollWindow(window) ? window : null
      )
      if ('kind' in answered) return answered
      result = answered
    }
  }

  while (result.status === 'PAUSED') {
    const { continuation } = result
    const policy = actionD20Policy({ phase: 'OUTCOME', continuation, bound, twoPhase })
    const roller = actionRequestRoller({ continuation, policy, bound, twoPhase })
    if (!input.autoRoll[roller])
      return {
        kind: 'PENDING',
        continuation,
        d20Policy: policy,
        roller,
        twoPhase,
        phaseReceipts: input.boundary.phaseReceipts
      }
    const answered = await answer(
      continuation,
      policy,
      { kind: 'AUTO_ROLL', requestId: continuation.request.requestId },
      null
    )
    if ('kind' in answered) return answered
    result = answered
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
        costs: damageRerolled ? undefined : input.damageRerolls,
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
