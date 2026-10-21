import { chosenEncounterReaction } from '@artificer-toolkit/rules-runtime/encounterReactionChoice'
import { resolveNativeActionOnHit } from '@artificer-toolkit/rules-runtime/encounterActionOnHit'
import { resolveNativeActionReaction } from '@artificer-toolkit/rules-runtime/encounterActionReaction'
import type { NativePauseHandler, NativeHeldReaction } from './nativePauseTypes.js'
import {
  applyNativeReactionEffect,
  type discoverNativeAttackReaction
} from './nativeEncounterAttackReaction.js'

type ApplyReactionInput = Parameters<typeof applyNativeReactionEffect>[0]

/**
 * The target's reaction as it is now. A used reaction also carries what it does to the attack it
 * answered: its effect plan and the attack's binding once that effect holds.
 */
export function createNativeCurrentReaction(input: {
  discoverReaction: ReturnType<typeof discoverNativeAttackReaction>
  runtime: ApplyReactionInput['runtime']
  occurrenceId: string
  commandId: string
  occurredAt: string
  activeEffectsByActorId: ApplyReactionInput['activeEffectsByActorId']
  prepareAttack: ApplyReactionInput['prepareAttack']
  loadTarget: ApplyReactionInput['loadTarget']
  targetStateChecksum: string
  /** The attack's binding before any reaction changes it. */
  binding: Parameters<typeof resolveNativeActionReaction>[0]['binding']
}) {
  return async (used: boolean, answering: string, critical: boolean) => {
    const [found] = await input.discoverReaction({ answering, critical })
    if (!found) throw new Error('Reaction evidence is stale.')
    const applied = used
      ? await applyNativeReactionEffect({
          reaction: found,
          runtime: input.runtime,
          occurrenceId: input.occurrenceId,
          commandId: input.commandId,
          occurredAt: input.occurredAt,
          activeEffectsByActorId: input.activeEffectsByActorId,
          prepareAttack: input.prepareAttack,
          loadTarget: input.loadTarget
        })
      : null
    return {
      found,
      applied,
      candidate: found.candidate,
      targetStateChecksum: input.targetStateChecksum,
      adjustedBinding: applied?.adjustedBinding ?? input.binding
    }
  }
}

export type NativeCurrentReaction = Awaited<
  ReturnType<ReturnType<typeof createNativeCurrentReaction>>
>

export const reactionPause: NativePauseHandler<'REACTION'> = {
  read: ({ pause, decision }) => {
    if (!decision) throw new Error('The action requires a reaction decision.')
    return { kind: 'REACTION', answer: { offer: pause.payload, selection: decision } }
  },
  settle: async ({ offer, selection }, { actionSource, currentReaction, onHitNow }) => {
    const current = await currentReaction(
      selection.kind === 'OPTION',
      chosenEncounterReaction(offer, selection).actionId,
      offer.originalD20.resultPath === 'ON_CRIT'
    )
    const resolved = await resolveNativeActionReaction({
      ...actionSource,
      offer,
      selection,
      ...current,
      onHitCandidates: onHitNow
    })
    return { execution: resolved.execution, reaction: { ...current, ...resolved } }
  }
}

export const onHitPause: NativePauseHandler<'ON_HIT'> = {
  read: ({ pause, decision }) => {
    if (!decision) throw new Error('The action requires an on-hit decision.')
    return { kind: 'ON_HIT', answer: { offer: pause.payload, selection: decision } }
  },
  settle: async ({ offer, selection }, { actionSource, currentReaction, onHitNow }) => {
    // A held on-hit offer that follows a used reaction answers the hit as that reaction left it.
    const heldReaction: NativeHeldReaction | null = offer.reaction
      ? {
          reaction: offer.reaction,
          testExecution: offer.testExecution,
          testRollEvidence: offer.testD20
        }
      : null
    const heldReactionNow = heldReaction
      ? await currentReaction(
          heldReaction.reaction.selection === 'USE',
          heldReaction.reaction.reaction.actionId,
          heldReaction.testExecution.outputs.resultPath === 'ON_CRIT'
        )
      : null
    const resolved = await resolveNativeActionOnHit({
      ...actionSource,
      offer,
      selection,
      candidates: onHitNow,
      adjustedBinding: heldReactionNow?.adjustedBinding ?? null
    })
    return { execution: resolved.execution, onHit: resolved, heldReaction, heldReactionNow }
  }
}
