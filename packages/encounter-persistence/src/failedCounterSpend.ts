import type {
  LiveSessionFailedCounter,
  LiveSessionWindowReaction
} from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { deriveEncounterCharacterMechanicsEventCommandId } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { settleActionSourceSpend, sourceSpendMutation } from './actionSourceSpend.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import type { EncounterWriteContext } from './store.js'

/**
 * Checks each reaction another creature spends with the action: a counter that failed against a cast,
 * or a reaction rolled against the attack roll (D207). Its reactor is a Character of the run, named
 * once, and the slot or charge it spends is the one its receipt recorded. The cast's own source may
 * counter a counter cast against it, never its own cast, and never reacts to its own attack roll.
 * Returns what each reactor's mechanics apply.
 */
export function failedCounterSpends(input: {
  failedCounters?: readonly LiveSessionFailedCounter[]
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
      throw new Error('Live Session failed counter scope mismatch.')
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
    ...(input.failedCounters ?? []).map((failed) => {
      const { reaction } = failed.receipt
      const reactor = reactorOf(
        reaction,
        reaction.reactorActorId === input.source.id &&
          failed.receipt.againstActorId === input.source.id
      )
      return {
        failed,
        reactor,
        check: failed.receipt.check,
        ...spend(reactor, {
          resource: null,
          spell: failed.spellConsumption,
          receipts: {
            resourceConsumption: null,
            sourceItemConsumption: null,
            spellCastConsumption: failed.receipt.spellCastConsumption
          }
        })
      }
    }),
    ...(input.windowReactions ?? []).map((failed) => {
      const { reaction } = failed.receipt
      const reactor = reactorOf(reaction, reaction.reactorActorId === input.source.id)
      return {
        failed,
        reactor,
        check: null,
        ...spend(reactor, {
          resource: failed.resourceConsumption,
          spell: null,
          receipts: {
            resourceConsumption: failed.receipt.resourceConsumption,
            sourceItemConsumption: null,
            spellCastConsumption: null
          }
        })
      }
    })
  ]
}

export type FailedCounterSpend = ReturnType<typeof failedCounterSpends>[number]

/**
 * Throws unless a reactor's Character version after its mechanics is the one its receipt recorded:
 * none when its reaction spends no slot or charge, since nothing was planned against its Character.
 */
export function requireFailedCounterReceipt(
  reaction: { spends: boolean; failed: { receipt: { characterStreamVersion: number | null } } },
  mechanics: { characterStreamVersion: number | null } | null
) {
  const expected = reaction.spends ? (mechanics?.characterStreamVersion ?? null) : null
  if (reaction.failed.receipt.characterStreamVersion !== expected)
    throw new Error('Live Session failed counter Character receipt mismatch.')
}

/**
 * Spends each failed reactor's slot and reaction with the cast's terminal commit (D127) and returns the
 * reactors as settled. The reactors named by `exceptActorIds` are the cast's source and target: their
 * spend rides in their own mechanics beside the cast's, and the caller settles them there.
 */
export async function applyFailedCounterSpends(
  ctx: EncounterWriteContext,
  input: {
    state: EncounterRunState
    occurrenceId: string
    sourceCommandId: string
    occurredAt: string
    spends: readonly FailedCounterSpend[]
    exceptActorIds: readonly string[]
    applyMechanics(
      batch: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
    ): Promise<EncounterMechanicsBatchResult>
    currentCharacterMaximumHitPoints(state: EncounterRunState, characterId: string): Promise<number>
  }
) {
  const settled = new Map<string, EncounterRunActorState>()
  for (const reaction of input.spends) {
    const { failed, reactor, spends, mutation } = reaction
    if (input.exceptActorIds.includes(reactor.id)) continue
    const mechanics = spends
      ? await input.applyMechanics({
          encounterId: input.state.id,
          expectedEncounterVersion: input.state.version,
          occurrenceId: input.occurrenceId,
          sourceCommandId: input.sourceCommandId,
          occurredAt: input.occurredAt,
          targetActorId: reactor.id,
          commandId: deriveEncounterCharacterMechanicsEventCommandId({
            occurrenceId: input.occurrenceId,
            sourceCommandId: input.sourceCommandId,
            phase: 'DIRECT_ACTION_RESOURCE',
            ordinal: 0,
            targetCharacterId: reactor.sourceId
          }),
          applications: [],
          effectiveMaximumHitPoints: await input.currentCharacterMaximumHitPoints(
            input.state,
            reactor.sourceId
          ),
          forceVersionAdvance: false,
          ...mutation
        })
      : null
    requireFailedCounterReceipt(reaction, mechanics)
    settled.set(
      reactor.id,
      await settleActionSourceSpend(ctx, {
        encounterId: input.state.id,
        source: mechanics?.updatedActor ?? reactor,
        spend: {
          featureResourceConsumption: null,
          actionEconomyTransition: failed.receipt.actionEconomyTransition,
          attackActionTransition: undefined
        },
        economyOverridden: false
      })
    )
  }
  return settled
}
