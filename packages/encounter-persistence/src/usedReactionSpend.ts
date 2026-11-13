import type {
  LiveSessionUsedReaction,
  LiveSessionWindowReaction
} from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import {
  applyActionSpendMechanics,
  settleActionSourceSpend,
  sourceSpendMutation
} from './actionSourceSpend.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import type { EncounterWriteContext } from './store.js'

/**
 * Checks each reaction another creature spends with the action: one used at its own offer before the
 * action executed (a reaction to being named a target), or a reaction rolled against the attack roll
 * (D207). Its reactor is a Character of the run, named once, and the slot or charge it spends is the
 * one its receipt recorded. The action's own source never reacts to its own action or attack roll.
 * Returns what each reactor's mechanics apply.
 */
export function usedReactionSpends(input: {
  usedReactions?: readonly LiveSessionUsedReaction[]
  windowReactions?: readonly LiveSessionWindowReaction[]
  actors: readonly EncounterRunActorState[]
  source: EncounterRunActorState
}) {
  const seen = new Set<string>()
  const reactorOf = (
    reaction: { reactorActorId: string; characterId: string | null },
    ownAction: boolean
  ) => {
    const reactor = input.actors.find((actor) => actor.id === reaction.reactorActorId)
    if (
      reactor?.kind !== 'CHARACTER' ||
      ownAction ||
      reactor.sourceId !== reaction.characterId ||
      seen.has(reactor.id)
    )
      throw new Error('Live Session used reaction scope mismatch.')
    seen.add(reactor.id)
    return reactor
  }
  const spend = (
    reactor: EncounterRunActorState,
    request: Pick<Parameters<typeof sourceSpendMutation>[0], 'resource' | 'spell' | 'receipts'>
  ) =>
    sourceSpendMutation({
      source: reactor,
      command: { acceptedWieldConflict: null },
      item: null,
      ...request
    })
  return [
    ...(input.usedReactions ?? []).map((used) => {
      const { reaction } = used.receipt
      const reactor = reactorOf(
        reaction,
        reaction.reactorActorId === input.source.id &&
          used.receipt.againstActorId === input.source.id
      )
      return {
        used,
        reactor,
        ...spend(reactor, {
          resource: null,
          spell: used.spellConsumption,
          receipts: {
            resourceConsumption: null,
            sourceItemConsumption: null,
            spellCastConsumption: used.receipt.spellCastConsumption
          }
        })
      }
    }),
    ...(input.windowReactions ?? []).map((used) => {
      const { reaction } = used.receipt
      const reactor = reactorOf(reaction, reaction.reactorActorId === input.source.id)
      return {
        used,
        reactor,
        ...spend(reactor, {
          resource: used.resourceConsumption,
          spell: null,
          receipts: {
            resourceConsumption: used.receipt.resourceConsumption,
            sourceItemConsumption: null,
            spellCastConsumption: null
          }
        })
      }
    })
  ]
}

export type UsedReactionSpend = ReturnType<typeof usedReactionSpends>[number]

/**
 * Throws unless a reactor's Character version after its mechanics is the one its receipt recorded:
 * none when its reaction spends no slot or charge, since nothing was planned against its Character.
 */
export function requireUsedReactionReceipt(
  reaction: { spends: boolean; used: { receipt: { characterStreamVersion: number | null } } },
  mechanics: { characterStreamVersion: number | null } | null
) {
  const expected = reaction.spends ? (mechanics?.characterStreamVersion ?? null) : null
  if (reaction.used.receipt.characterStreamVersion !== expected)
    throw new Error('Live Session used reaction Character receipt mismatch.')
}

/**
 * Spends each reactor's slot and reaction with the action's terminal commit (D127) and returns the
 * reactors as settled. The reactors named by `exceptActorIds` are the action's source and target: their
 * spend rides in their own mechanics beside the action's, and the caller settles them there.
 */
export async function applyUsedReactionSpends(
  ctx: EncounterWriteContext,
  input: {
    state: EncounterRunState
    occurrenceId: string
    sourceCommandId: string
    occurredAt: string
    spends: readonly UsedReactionSpend[]
    exceptActorIds: readonly string[]
    applyMechanics(
      batch: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
    ): Promise<EncounterMechanicsBatchResult>
    currentCharacterMaximumHitPoints(state: EncounterRunState, characterId: string): Promise<number>
  }
) {
  const settled = new Map<string, EncounterRunActorState>()
  for (const reaction of input.spends) {
    const { used, reactor, spends, mutation } = reaction
    if (input.exceptActorIds.includes(reactor.id)) continue
    const mechanics = spends
      ? await applyActionSpendMechanics(ctx, {
          ...input,
          actor: reactor,
          applications: [],
          mutation
        })
      : null
    requireUsedReactionReceipt(reaction, mechanics)
    settled.set(
      reactor.id,
      await settleActionSourceSpend(ctx, {
        encounterId: input.state.id,
        source: mechanics?.updatedActor ?? reactor,
        spend: {
          featureResourceConsumption: null,
          actionEconomyTransition: used.receipt.actionEconomyTransition,
          attackActionTransition: undefined
        },
        economyOverridden: false
      })
    )
  }
  return settled
}
