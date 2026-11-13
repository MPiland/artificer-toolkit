import { advanceNativeActionGraphs } from '@artificer-toolkit/rules-runtime/encounterActionAdvance'
import { replayNativeActionLegendaryResistance } from '@artificer-toolkit/rules-runtime/encounterActionLegendaryResistance'
import { findEncounterFeatureResource } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import {
  chosenEncounterReaction,
  settleEncounterCastReactionUse
} from '@artificer-toolkit/rules-runtime/encounterReactionChoice'
import { attackHitDamageTypeIds } from '@artificer-toolkit/rules-runtime/encounterReactors'
import type { EncounterCastReactionOfferDto } from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'

import { discoverNativeLegendaryResistance } from './nativeAreaRevalidation.js'
import { discoverNativeAttackReaction } from './nativeEncounterAttackReaction.js'
import { readNativeLiveSpellPins } from './nativeEncounterTargets.js'
import { settleNativePauseAnswer } from './nativePauseHandlers.js'
import type { NativePauseAnswer, NativePauseSettleContext } from './nativePauseTypes.js'

type GraphsInput = Parameters<typeof advanceNativeActionGraphs>[0]
type DiscoverReactionInput = Parameters<typeof discoverNativeAttackReaction>[0]

/**
 * Advances an action against one target through what happens between its TEST and its OUTCOME: the
 * target's Legendary Resistance against a failed save, its reaction to a hit (chosen from the held
 * offer and run as its own child action, D219), and the attacker's on-hit rider. A response that
 * answers one of those is settled against the target as it stands now; a decision an earlier answer kept is replayed and proved against it. Nothing is spent here: the
 * returned records carry each cost for the action's commit.
 */
export async function advanceNativeActionTarget(input: {
  state: EncounterRunState
  system: SystemAuthoredDto
  capture: DiscoverReactionInput['capture']
  /** The action as it was prepared against this target. */
  attack: DiscoverReactionInput['attack'] & Parameters<typeof discoverNativeLegendaryResistance>[1]
  /** The prepared action's graphs, bound to the target. */
  actionSource: NativePauseSettleContext['actionSource'] &
    Omit<
      GraphsInput,
      'attackSight' | 'onHitCandidates' | 'resume' | 'legendaryResistance' | 'reaction' | 'heldRoll'
    >
  targetStateChecksum: string
  /** Prepares a reaction the target holds, as the target's own action. */
  prepareReaction: DiscoverReactionInput['prepareReaction']
  /** Prepares the action again against the target's facts once a reaction has changed them. */
  onHitNow: NativePauseSettleContext['onHitNow']
  pauseAnswer: NativePauseAnswer | null
  /** The answered offer the action resumes past, its reactor's child action committed (D219). */
  resumedOffer: EncounterCastReactionOfferDto | null
  /** The dice the reactions used on the rolled attack d20 rolled against it, as their actions committed. */
  rolledChildDice: NonNullable<GraphsInput['heldRoll']>['childDice']
  resume: GraphsInput['resume'] | null
}) {
  const { state, capture, attack, actionSource, targetStateChecksum, onHitNow, resume } = input
  const discoverResistance = discoverNativeLegendaryResistance({ state, capture }, attack)
  /** The creature's Legendary Resistance and pool as they are now; a decision or its record needs both. */
  const currentResistance = async () => {
    const candidate = await discoverResistance()
    const currentFeatureResource =
      candidate &&
      findEncounterFeatureResource(
        attack.actorRules,
        candidate.targetActorId,
        candidate.ownerFeatureId
      )
    if (!candidate || !currentFeatureResource)
      throw new Error('Legendary Resistance evidence is stale.')
    return { candidate, currentFeatureResource, targetStateChecksum }
  }
  const discoverReaction = discoverNativeAttackReaction({
    state,
    system: input.system,
    spells: await readNativeLiveSpellPins(capture),
    attack,
    prepareReaction: input.prepareReaction,
    capture
  })
  const settled = await settleNativePauseAnswer(input.pauseAnswer, {
    actionSource,
    currentResistance,
    onHitNow
  })
  const retained =
    resume?.pending.twoPhase ??
    (input.pauseAnswer?.kind === 'FORCED_MOVEMENT'
      ? input.pauseAnswer.answer.outcomePhase
      : undefined)
  const castAnswer = input.pauseAnswer?.kind === 'CAST_REACTION' ? input.pauseAnswer.answer : null
  const hitOffer = castAnswer?.offer ?? input.resumedOffer
  /**
   * The held hit offer this call answers or resumes past (D219). A chosen reaction is found again as
   * it stands now and its sealed choice settled; it then runs as its holder's own child action.
   */
  const heldHit = async (
    offer: NonNullable<GraphsInput['heldHit']>['offer']
  ): Promise<{
    answer: NonNullable<GraphsInput['heldHit']>['answer']
    child: { holderActorId: string; actionId: string } | null
  }> => {
    if (!castAnswer) return { answer: { kind: 'RESUMED' }, child: null }
    if (offer.hit.targetStateChecksum !== targetStateChecksum)
      throw new Error('Reaction evidence is stale.')
    const chosen = chosenEncounterReaction(offer, castAnswer.selection)
    if (castAnswer.selection.kind !== 'OPTION') return { answer: { kind: 'DECLINE' }, child: null }
    const [found] = await discoverReaction({
      answering: chosen.actionId,
      critical: offer.hit.originalD20.resultPath === 'ON_CRIT'
    })
    if (!found) throw new Error('Reaction evidence is stale.')
    await settleEncounterCastReactionUse({
      runtime: actionSource.runtime,
      occurrenceId: actionSource.occurrenceId,
      offer,
      candidate: found.candidate,
      optionId: castAnswer.selection.optionId
    })
    return {
      answer: { kind: 'USE', candidate: found.candidate },
      child: { holderActorId: chosen.reactorActorId, actionId: chosen.actionId }
    }
  }
  /**
   * The held offer of the rolled attack d20 this call answers or resumes past (D219). A chosen
   * reaction is found again as it stands now and its sealed choice settled; it then runs as its
   * holder's own child action against the attacker.
   */
  const heldRoll = async (
    offer: NonNullable<GraphsInput['heldRoll']>['offer']
  ): Promise<{
    answer: NonNullable<GraphsInput['heldRoll']>['answer']
    child: { holderActorId: string; actionId: string; targetActorId: string } | null
  }> => {
    if (!castAnswer) return { answer: { kind: 'RESUMED' }, child: null }
    const chosen = chosenEncounterReaction(offer, castAnswer.selection)
    if (castAnswer.selection.kind !== 'OPTION') return { answer: { kind: 'DECLINE' }, child: null }
    const candidate = (
      await actionSource.rollReaction?.discover(offer.declinedReactorActorIds)
    )?.find(
      ({ reactorActorId, actionId }) =>
        reactorActorId === chosen.reactorActorId && actionId === chosen.actionId
    )
    if (!candidate) throw new Error('Reaction evidence is stale.')
    await settleEncounterCastReactionUse({
      runtime: actionSource.runtime,
      occurrenceId: actionSource.occurrenceId,
      offer,
      candidate,
      optionId: castAnswer.selection.optionId
    })
    return {
      answer: { kind: 'USE', candidate },
      child: {
        holderActorId: chosen.reactorActorId,
        actionId: chosen.actionId,
        targetActorId: attack.actor.id
      }
    }
  }
  const heldOffer = hitOffer?.hit ? { ...hitOffer, hit: hitOffer.hit } : null
  const answeredHit = heldOffer ? { offer: heldOffer, ...(await heldHit(heldOffer)) } : null
  const rolledOffer = hitOffer?.rolled ? { ...hitOffer, rolled: hitOffer.rolled } : null
  const answeredRoll = rolledOffer ? { offer: rolledOffer, ...(await heldRoll(rolledOffer)) } : null
  const attackFacts =
    attack.source.kind === 'CHARACTER_ACTION'
      ? attack.source.candidate.mechanicFacts
      : attack.source.capability.mechanicFacts
  const execution =
    settled?.execution ??
    (await advanceNativeActionGraphs({
      ...actionSource,
      attackSight: attack.attackSight,
      onHitCandidates: onHitNow,
      ...(resume ? { resume } : {}),
      ...(answeredHit ? { heldHit: { offer: answeredHit.offer, answer: answeredHit.answer } } : {}),
      ...(answeredRoll
        ? {
            heldRoll: {
              offer: answeredRoll.offer,
              answer: answeredRoll.answer,
              childDice: input.rolledChildDice
            }
          }
        : {}),
      legendaryResistance: { discover: discoverResistance, targetStateChecksum },
      reaction: {
        discover: async (critical) => {
          const found = await discoverReaction({ critical })
          return {
            candidates: found.map(({ candidate }) => candidate),
            // Every reaction to a hit runs as its holder's child action (D219), which reads the
            // damage it answers from the held offer.
            childHitDamageTypeIds: [...attackHitDamageTypeIds(attackFacts, critical)]
          }
        },
        targetStateChecksum
      }
    }))
  const resistance =
    settled?.resistance ??
    (execution.kind !== 'PENDING' && retained?.phase === 'OUTCOME' && retained.legendaryResistance
      ? await replayNativeActionLegendaryResistance({
          ...actionSource,
          outcome: retained,
          ...(await currentResistance())
        })
      : null)
  return {
    execution,
    resistance,
    /**
     * The reaction chosen from the held offer, which runs as its holder's own action (D219): one to
     * the rolled d20 at the attacker, one to the hit at its holder, the attack's target.
     */
    reactionChild:
      answeredRoll?.child ??
      (answeredHit?.child
        ? { ...answeredHit.child, targetActorId: answeredHit.child.holderActorId }
        : null),
    /** The on-hit rider the attacker chose, by this answer or one the OUTCOME kept. */
    chosenOnHit:
      settled?.onHit?.audit.option ??
      (retained?.phase === 'OUTCOME' ? (retained.onHit?.option ?? null) : null)
  }
}
