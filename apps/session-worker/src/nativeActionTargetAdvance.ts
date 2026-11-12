import { advanceNativeActionGraphs } from '@artificer-toolkit/rules-runtime/encounterActionAdvance'
import { replayNativeActionLegendaryResistance } from '@artificer-toolkit/rules-runtime/encounterActionLegendaryResistance'
import { replayNativeActionReaction } from '@artificer-toolkit/rules-runtime/encounterActionReaction'
import { findEncounterFeatureResource } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'

import { discoverNativeLegendaryResistance } from './nativeAreaRevalidation.js'
import {
  discoverNativeAttackReaction,
  type applyNativeReactionEffect
} from './nativeEncounterAttackReaction.js'
import { readNativeLiveSpellPins } from './nativeEncounterTargets.js'
import { settleNativePauseAnswer } from './nativePauseHandlers.js'
import { createNativeCurrentReaction } from './nativePauseReaction.js'
import type { NativePauseAnswer, NativePauseSettleContext } from './nativePauseTypes.js'

type GraphsInput = Parameters<typeof advanceNativeActionGraphs>[0]
type DiscoverReactionInput = Parameters<typeof discoverNativeAttackReaction>[0]
type ApplyReactionInput = Parameters<typeof applyNativeReactionEffect>[0]

/**
 * Advances an action against one target through what happens between its TEST and its OUTCOME: the
 * target's Legendary Resistance against a failed save, its reaction to a hit, and the attacker's
 * on-hit rider. A response that answers one of those is settled against the target as it stands now;
 * a decision an earlier answer kept is replayed and proved against it. Nothing is spent here: the
 * returned records carry each cost for the action's commit.
 */
export async function advanceNativeActionTarget(input: {
  state: EncounterRunState
  system: SystemAuthoredDto
  capture: DiscoverReactionInput['capture']
  /** The action as it was prepared against this target. */
  attack: DiscoverReactionInput['attack'] & Parameters<typeof discoverNativeLegendaryResistance>[1]
  /** The prepared action's graphs, bound to the target as any reaction before its d20 left it. */
  actionSource: NativePauseSettleContext['actionSource'] &
    Omit<
      GraphsInput,
      'attackSight' | 'onHitCandidates' | 'resume' | 'legendaryResistance' | 'reaction'
    >
  targetStateChecksum: string
  /** Prepares a reaction the target holds, as the target's own action. */
  prepareReaction: DiscoverReactionInput['prepareReaction']
  reactionSpentActorIds: DiscoverReactionInput['reactionSpentActorIds']
  /** Prepares the action again against the target's facts once a reaction has changed them. */
  prepareReactedAttack: ApplyReactionInput['prepareAttack']
  loadTarget: ApplyReactionInput['loadTarget']
  activeEffectsByActorId: ApplyReactionInput['activeEffectsByActorId']
  commandId: string
  occurredAt: string
  onHitNow: NativePauseSettleContext['onHitNow']
  pauseAnswer: NativePauseAnswer | null
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
    reactionSpentActorIds: input.reactionSpentActorIds,
    prepareReaction: input.prepareReaction,
    capture
  })
  const currentReaction = createNativeCurrentReaction({
    discoverReaction,
    runtime: actionSource.runtime,
    occurrenceId: actionSource.occurrenceId,
    commandId: input.commandId,
    occurredAt: input.occurredAt,
    activeEffectsByActorId: input.activeEffectsByActorId,
    prepareAttack: input.prepareReactedAttack,
    loadTarget: input.loadTarget,
    targetStateChecksum,
    binding: actionSource.binding
  })
  const settled = await settleNativePauseAnswer(input.pauseAnswer, {
    actionSource,
    currentResistance,
    currentReaction,
    onHitNow
  })
  const retained =
    resume?.pending.twoPhase ??
    (input.pauseAnswer?.kind === 'FORCED_MOVEMENT'
      ? input.pauseAnswer.answer.outcomePhase
      : undefined)
  const heldReaction = settled?.heldReaction ?? null
  const retainedReaction = settled?.reaction
    ? null
    : (heldReaction ?? (retained?.phase === 'OUTCOME' && retained.reaction ? retained : null))
  const replayedReaction =
    settled?.heldReactionNow ??
    (retainedReaction
      ? await currentReaction(
          retainedReaction.reaction!.selection === 'USE',
          retainedReaction.reaction!.reaction.actionId,
          retainedReaction.testExecution.outputs.resultPath === 'ON_CRIT'
        )
      : null)
  const execution =
    settled?.execution ??
    (await advanceNativeActionGraphs({
      ...actionSource,
      // A paused OUTCOME resumes against the hit as the reaction it kept left it.
      ...(replayedReaction ? { binding: replayedReaction.adjustedBinding } : {}),
      attackSight: attack.attackSight,
      onHitCandidates: onHitNow,
      ...(resume ? { resume } : {}),
      legendaryResistance: { discover: discoverResistance, targetStateChecksum },
      reaction: {
        discover: async (critical) =>
          (await discoverReaction({ critical })).map(({ candidate }) => candidate),
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
  const reaction =
    execution.kind === 'PENDING'
      ? null
      : (settled?.reaction ??
        (retainedReaction && replayedReaction
          ? {
              ...replayedReaction,
              audit: await replayNativeActionReaction({
                ...actionSource,
                outcome: retainedReaction,
                ...replayedReaction
              })
            }
          : null))
  return {
    execution,
    resistance,
    reaction,
    /** What the reaction the target used does and costs; null when it used none. */
    reactionUse:
      reaction?.audit.selection === 'USE' && reaction.applied
        ? {
            applied: reaction.applied,
            prepared: reaction.found.prepared,
            economy: reaction.found.economy.consumption
          }
        : null,
    /** The on-hit rider the attacker chose, by this answer or one the OUTCOME kept. */
    chosenOnHit:
      settled?.onHit?.audit.option ??
      (retained?.phase === 'OUTCOME' ? (retained.onHit?.option ?? null) : null)
  }
}
