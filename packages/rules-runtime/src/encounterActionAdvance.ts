import type { D20RolledAddedDieDto } from '@artificer-toolkit/schema/shared/d20AddedDice'
import type { EncounterActionHeldD20Dto } from '@artificer-toolkit/schema/shared/encounterActionPending'
import {
  isDamageRollWindow,
  type DamageRerollCostDto
} from '@artificer-toolkit/schema/shared/ruleExecutionDamageRollWindow'
import type {
  EncounterOnHitAuditDto,
  EncounterOnHitOfferDto
} from '@artificer-toolkit/schema/shared/ruleExecutionOnHitChoice'
import type {
  EncounterCastReactionOfferDto,
  EncounterSettledHitDto
} from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import type {
  ServerCompletedRuleExecutionDto,
  ServerRuleExecutionContinuationDto,
  ServerRuleExecutionD20EvidenceDto,
  ServerRuleExecutionD20PolicyDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import type { RollModeKeep } from '@artificer-toolkit/schema/shared/systemCoreCode'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import type {
  CharacterRuleActionExecutionPlan,
  CharacterRuleActionSystemAdapter
} from './characterRuleActionSystemAdapter.js'
import { actionComplete, type CompleteNativeActionGraphs } from './encounterActionCompletion.js'
import {
  continueNativeActionAfterTest,
  isHitPath,
  prepareNativeActionTest,
  type PendingNativeActionGraphs,
  type ResumedNativeActionGraphs
} from './encounterActionExecution.js'
import {
  actionD20Policy,
  actionRequestRoller,
  requireActionContinuation,
  type EncounterActionAutoRoll
} from './encounterActionRequest.js'
import {
  heldOnRollReaction,
  holdForRollReaction,
  type EncounterActionRollReaction,
  type EncounterRolledReactionOffer
} from './encounterActionRollReaction.js'
import { nativeTestIdentity } from './encounterActionTestBoundary.js'
import {
  heldWindowedSave,
  type EncounterActionSaveWindow,
  type EncounterActionWindowAnswer
} from './encounterActionSaveWindow.js'
import { reconstructNativeActionTest } from './encounterActionTestReconstruction.js'
import {
  encounterAttackD20Belief,
  type EncounterAttackD20Belief,
  type EncounterPreparedAttackSight
} from './encounterAttackBelief.js'
import {
  actionResponse,
  buildEncounterActionD20Evidence,
  settleEncounterD20Test
} from './encounterD20Settlement.js'
import { windowSpentReactions } from './encounterD20Window.js'
import {
  holdEncounterDamageRoll,
  replayEncounterDamageRollWindow,
  type EncounterDamageRerollAnswer
} from './encounterDamageRollWindow.js'
import type { EncounterD20RollMode, EncounterEvidenceAnswer } from './encounterEvidenceAnswer.js'
import {
  encounterLegendaryResistancePin,
  openEncounterLegendaryResistanceChoice
} from './encounterLegendaryResistanceChoice.js'
import type { EncounterLegendaryResistanceCandidate } from './encounterLegendaryResistanceDiscovery.js'
import { holdForOnHitChoice, type EncounterOnHitCandidate } from './encounterOnHitChoice.js'
import {
  encounterReactionPin,
  openEncounterReactionChoice,
  type EncounterReactionCandidate
} from './encounterReactionChoice.js'
import { heldStageD20, sightGovernedStageD20 } from './encounterSightGovernedD20.js'
import { nextRollInt } from './random.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'

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
  /**
   * The binding a two-phase action's TEST was sealed against, when its OUTCOME runs on a later one
   * (`continueNativeActionAfterTest`): a further ray at a creature the earlier rays hurt.
   */
  testBinding?: Omit<Parameters<CharacterRuleActionSystemAdapter['bindFacts']>[0], 'published'>
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
    discover(critical: boolean): Promise<{
      candidates: readonly EncounterReactionCandidate[]
      /** The damage types the hit deals, which the reactions found run as their holder's own actions against (D219). */
      childHitDamageTypeIds: readonly string[]
    }>
    targetStateChecksum: string
  }
  /**
   * The held `HIT_BY_ATTACK` offer once it is answered (D219). Its TEST is rebuilt from the kept faces,
   * never rolled again, and no reaction is offered for that hit again. `USE` keeps the action held
   * on the answered offer until the chosen reaction's own action commits. `DECLINE` continues from the
   * kept TEST. `RESUMED` follows that commit: the same faces are tested against the binding as the
   * reaction's action left the target, and the action continues from that TEST.
   */
  heldHit?: {
    offer: EncounterCastReactionOfferDto & { hit: EncounterSettledHitDto }
    answer:
      | { kind: 'USE'; candidate: EncounterReactionCandidate }
      | { kind: 'DECLINE' }
      | { kind: 'RESUMED' }
  }
  /**
   * The held on-hit offer with the decision its attacker made at it, kept with a ray's answer. The TEST
   * is rebuilt from the faces the offer kept, never rolled again, and its OUTCOME runs sealed against
   * the decision.
   */
  heldOnHit?: { offer: EncounterOnHitOfferDto; audit: EncounterOnHitAuditDto }
  /**
   * The creatures that may react to the action's rolled attack d20 (D219). Once the roller's own window
   * has settled, the roll is held for each in turn before it resolves; a reaction one of them uses runs
   * as its holder's own action.
   */
  rollReaction?: EncounterActionRollReaction
  /**
   * The held offer of the rolled attack d20 once it is answered (D219). The d20 is never rolled again.
   * `USE` keeps the action held on the answered offer until the chosen reaction's own action commits.
   * `DECLINE` and `RESUMED` (which follows that commit) hold the same roll for the next creature; when
   * nobody is left, the kept faces are tested against the binding as it stands now, with `childDice`,
   * the dice the reactions' actions rolled against the roll, and the action continues from that TEST.
   */
  heldRoll?: {
    offer: EncounterRolledReactionOffer
    answer:
      | { kind: 'USE'; candidate: EncounterReactionCandidate }
      | { kind: 'DECLINE' }
      | { kind: 'RESUMED' }
    childDice: readonly D20RolledAddedDieDto[]
  }
  /**
   * The ways the attacker could pay for an optional on-hit rider. Any found holds a hit, once no
   * reaction is offered, for the attacker's choice before its OUTCOME.
   */
  onHitCandidates?: readonly EncounterOnHitCandidate[]
  /**
   * The dice a save's target holds for after its d20 (D168). A target that holds one sees its rolled
   * d20 in a window before the save resolves; the window's answer resumes the save with the roll and
   * the die it spent.
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
  if (input.plan.kind === 'TEST_OUTCOME') {
    const {
      legendaryResistance,
      reaction,
      heldHit,
      heldOnHit,
      rollReaction,
      heldRoll,
      onHitCandidates,
      saveWindow,
      damageRerolls,
      resume,
      attackSight: testSight,
      testBinding,
      ...action
    } = input
    const sealedAgainst = { ...action, binding: testBinding ?? action.binding }
    // An answer to the OUTCOME: its TEST is rebuilt from what the OUTCOME retained of it, never rolled
    // again, and the decisions the OUTCOME was sealed against are proved against that TEST.
    if (resume?.pending.twoPhase?.phase === 'OUTCOME') {
      const outcome = resume.pending.twoPhase
      return continueNativeActionAfterTest({
        ...action,
        testBinding,
        boundary: await reconstructNativeActionTest({
          ...sealedAgainst,
          execution: outcome.testExecution,
          d20: outcome.testRollEvidence
        }),
        legendaryResistance: outcome.legendaryResistance,
        onHit: outcome.onHit,
        saveWindow,
        damageRerolls,
        resume
      })
    }
    // Not yet in its OUTCOME: the TEST seals, the target and the attacker are offered what the sealed
    // roll allows, and the OUTCOME starts.
    const resolution = resume?.resolution
    if (resolution?.kind === 'DAMAGE_REROLL')
      throw new Error('The damage roll window evidence is stale.')
    if ((heldHit || heldRoll) && resume) throw new Error('Reaction evidence is stale.')
    if (heldHit && heldRoll) throw new Error('Reaction evidence is stale.')
    if (heldOnHit) {
      if (heldHit || heldRoll || resume) throw new Error('On-hit evidence is stale.')
      return continueNativeActionAfterTest({
        ...action,
        testBinding,
        boundary: await reconstructNativeActionTest({
          ...sealedAgainst,
          execution: heldOnHit.offer.testExecution,
          d20: heldOnHit.offer.testD20
        }),
        onHit: heldOnHit.audit,
        saveWindow,
        damageRerolls
      })
    }
    if (heldRoll) {
      const { offer, answer } = heldRoll
      const [offered] = offer.reactions
      const identity = nativeTestIdentity(sealedAgainst)
      const held = {
        runtime: input.runtime,
        occurrenceId: input.occurrenceId,
        twoPhase: {
          phase: 'TEST' as const,
          compilerSourceChecksum: identity.plan.compilerSource.compilerSourceChecksum,
          testTemplateChecksum: identity.plan.test.template.checksum,
          boundFactsChecksum: identity.factsChecksum
        }
      }
      if (answer.kind === 'USE')
        return heldOnRollReaction({ ...held, offer, candidate: answer.candidate })
      if (!rollReaction || !offered) throw new Error('Reaction evidence is stale.')
      // The creature that answered has been heard; the same roll is held for the next one.
      const next = await holdForRollReaction({
        ...held,
        rollReaction,
        rolled: offer.rolled,
        heardReactorActorIds: [...offer.declinedReactorActorIds, offered.reactorActorId]
      })
      if (next) return next
    }
    const test = heldHit
      ? await reconstructNativeActionTest({
          ...sealedAgainst,
          ...(heldHit.answer.kind === 'RESUMED'
            ? {}
            : { execution: heldHit.offer.hit.originalExecution }),
          d20: heldHit.offer.hit.originalD20
        })
      : heldRoll
        ? // Everyone was heard: the kept d20 resolves with the dice the reactions' actions rolled.
          await reconstructNativeActionTest({
            ...sealedAgainst,
            d20: {
              ...heldRoll.offer.rolled.test.d20,
              addedDice: [
                ...(heldRoll.offer.rolled.test.d20.addedDice ?? []),
                ...heldRoll.childDice
              ]
            }
          })
        : await prepareNativeActionTest({
            ...sealedAgainst,
            attackSight: testSight,
            saveWindow,
            rollReaction,
            ...(resume && resolution ? { resume: { pending: resume.pending, resolution } } : {})
          })
    if (test.kind === 'PENDING') return test
    if (heldHit?.answer.kind === 'USE')
      return {
        kind: 'PENDING',
        continuation: await openEncounterReactionChoice({
          runtime: input.runtime,
          occurrenceId: input.occurrenceId,
          candidate: heldHit.answer.candidate
        }),
        d20Policy: null,
        twoPhase: test.twoPhase,
        roller: 'TARGET',
        pause: { kind: 'CAST_REACTION', payload: heldHit.offer }
      }
    /** What a choice about the sealed roll pins of it. */
    const sealedRoll = () => ({
      originalExecution: test.execution,
      originalD20: test.d20,
      d20: test.d20Policy,
      originalExecutionChecksum: checksumRuleDocument(test.execution)
    })
    const candidate =
      legendaryResistance && test.d20.resultPath === 'ON_SAVE_FAIL'
        ? await legendaryResistance.discover()
        : null
    if (legendaryResistance && candidate) {
      const choice = await openEncounterLegendaryResistanceChoice({
        runtime: input.runtime,
        occurrenceId: input.occurrenceId,
        candidate
      })
      return {
        kind: 'PENDING',
        continuation: choice.continuation,
        d20Policy: null,
        twoPhase: test.twoPhase,
        roller: 'TARGET',
        pause: {
          kind: 'LEGENDARY_RESISTANCE',
          payload: {
            ...sealedRoll(),
            targetStateChecksum: legendaryResistance.targetStateChecksum,
            resistance: encounterLegendaryResistancePin(candidate)
          }
        }
      }
    }
    // An attack a decoy absorbed reaches nobody: its target is offered no reaction and its attacker no rider.
    const struck = !input.binding.absorbedByDecoy && isHitPath(test.d20.resultPath)
    // A creature that spent its reaction in the roll's window has none left for the hit.
    const windowReactors = windowSpentReactions({ d20: test.d20, nestedD20: null }).map(
      ({ reactorActorId }) => reactorActorId
    )
    // A held hit already made its offer, so it is offered no reaction again.
    const found =
      reaction && struck && !heldHit
        ? await reaction.discover(test.d20.resultPath === 'ON_CRIT')
        : null
    const reactionCandidates = (found?.candidates ?? []).filter(
      ({ reactorActorId }) => !windowReactors.includes(reactorActorId)
    )
    const [firstReaction] = reactionCandidates
    if (reaction && found && firstReaction) {
      const hit = { ...sealedRoll(), targetStateChecksum: reaction.targetStateChecksum }
      const reactions = reactionCandidates.map(encounterReactionPin)
      return {
        kind: 'PENDING',
        continuation: await openEncounterReactionChoice({
          runtime: input.runtime,
          occurrenceId: input.occurrenceId,
          candidate: firstReaction
        }),
        d20Policy: null,
        twoPhase: test.twoPhase,
        roller: 'TARGET',
        pause: {
          kind: 'CAST_REACTION',
          payload: {
            kind: 'HIT_BY_ATTACK',
            reactions,
            declinedReactorActorIds: [],
            hit: { ...hit, damageTypeIds: [...found.childHitDamageTypeIds] }
          }
        }
      }
    }
    // The rider is offered before the OUTCOME is selected, since the choice can change which one runs.
    if (onHitCandidates?.length && struck)
      return holdForOnHitChoice({
        runtime: input.runtime,
        occurrenceId: input.occurrenceId,
        candidates: onHitCandidates,
        twoPhase: test.twoPhase,
        execution: test.execution,
        testD20: test.d20,
        d20: test.d20Policy,
        gameSystemId: test.published.gameSystemId
      })
    return continueNativeActionAfterTest({
      ...action,
      testBinding,
      boundary: test,
      saveWindow,
      damageRerolls
    })
  }

  // A single graph: at most one d20 stage, which sight may govern, and a damage roll its caster may reroll.
  const random = input.random ?? nextRollInt
  const attackSight = input.attackSight ?? null
  const { published } = input.plan
  const bound = input.adapter.bindFacts({ ...input.binding, published })
  /** The d20 stage answered during this call; set by `answer`. */
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
  /** Set once a damage window's answer replayed the graph; that roll is never held again. */
  let damageRerolled = false

  /**
   * Resumes one request and records its d20 as the stage roll. A sight-governed d20 the roller
   * entered with too few dice returns the same request, pending with the held die, instead of
   * resuming it.
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
    const sight = policy ? sightGovernedStageD20({ attackSight, policy, stored }) : null
    const response = actionResponse({
      gameSystemId: published.gameSystemId,
      continuation,
      policy,
      resolution,
      random,
      sightGoverned: sight
    })
    if (response.kind === 'NEEDS_EXTRA_D20')
      return {
        kind: 'PENDING' as const,
        continuation,
        d20Policy: policy,
        twoPhase: null,
        roller: actionRequestRoller({ continuation, policy, bound, twoPhase: null }),
        ...(stored.d20Belief ? { d20Belief: stored.d20Belief } : {}),
        heldD20: heldStageD20(response.heldFace, sight)
      }
    const resumed = await settleEncounterD20Test({
      continuation,
      roll: { natural: response.value, addedDice: response.addedDice },
      resume: (step) => input.runtime.resume(step)
    })
    if (policy && response.faces && response.rollMode && response.keep) {
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
    return resumed
  }

  if (!input.resume) {
    result = await input.runtime.executeResolved({
      command: { definitionId: published.id, occurrenceId: input.occurrenceId, facts: bound.facts },
      published
    })
  } else {
    const { pending, resolution } = input.resume
    if (pending.twoPhase) throw new Error('The action phase identity is stale.')
    // A single graph opens no save window, so the only window it holds is its damage roll's.
    heldWindowedSave(pending.pause, resolution)
    if (resolution.kind === 'ROLL_WINDOW') throw new Error('The action TEST evidence is stale.')
    if (resolution.kind === 'DAMAGE_REROLL') {
      const window = pending.pause?.kind === 'ROLL_WINDOW' ? pending.pause.payload : null
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
      const { continuation } = pending
      requireActionContinuation({
        continuation,
        occurrenceId: input.occurrenceId,
        published,
        facts: bound.facts
      })
      const policy = actionD20Policy({ phase: 'SINGLE', continuation, bound, twoPhase: null })
      if (checksumRuleDocument(policy) !== checksumRuleDocument(pending.d20Policy))
        throw new Error('The action evidence policy is stale.')
      const answered = await answer(continuation, policy, resolution, {
        d20Belief: pending.d20Belief ?? null,
        heldD20: pending.heldD20 ?? null
      })
      if ('kind' in answered) return answered
      result = answered
    }
  }

  // Each request whose roller auto-rolls is rolled now; the first other one is prompted for.
  while (result.status === 'PAUSED') {
    const { continuation } = result
    const policy = actionD20Policy({ phase: 'SINGLE', continuation, bound, twoPhase: null })
    const roller = actionRequestRoller({ continuation, policy, bound, twoPhase: null })
    if (!input.autoRoll[roller]) {
      const d20Belief =
        policy && attackSight ? encounterAttackD20Belief({ policy, ...attackSight }) : null
      return {
        kind: 'PENDING',
        continuation,
        d20Policy: policy,
        twoPhase: null,
        roller,
        ...(d20Belief ? { d20Belief } : {})
      }
    }
    // An auto-roller's dice are rolled in the true mode, so no die is ever held for it.
    const answered = await answer(
      continuation,
      policy,
      { kind: 'AUTO_ROLL', requestId: continuation.request.requestId },
      { d20Belief: null, heldD20: null }
    )
    if ('kind' in answered) return answered
    result = answered
  }
  if (result.status !== 'COMPLETE') throw new Error('The action did not settle.')

  const heldDamage = stage.d20
    ? null
    : await holdEncounterDamageRoll({
        runtime: input.runtime,
        adapter: input.adapter,
        occurrenceId: input.occurrenceId,
        costs: damageRerolled ? undefined : input.damageRerolls,
        published,
        execution: result,
        twoPhase: null,
        phaseReceipts: []
      })
  if (heldDamage) return heldDamage
  return actionComplete({
    adapter: input.adapter,
    binding: input.binding,
    occurrenceId: input.occurrenceId,
    execution: result,
    published,
    initialPublished: published,
    initialFactsChecksum: checksumRuleDocument(bound.facts),
    phaseReceipts: [],
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
