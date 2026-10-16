import type { LiveSessionFailedCounter } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
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
 * Checks each counter that failed against a cast: its reactor is another Character of the run, named once,
 * and the slot it spends is the one its receipt recorded. Returns what each reactor's mechanics apply.
 */
export function failedCounterSpends(input: {
  failedCounters: readonly LiveSessionFailedCounter[]
  actors: readonly EncounterRunActorState[]
  source: EncounterRunActorState
}) {
  const seen = new Set<string>()
  return input.failedCounters.map((failed) => {
    const { reaction } = failed.receipt
    const reactor = input.actors.find((actor) => actor.id === reaction.reactorActorId)
    if (
      reactor?.kind !== 'CHARACTER' ||
      reactor.id === input.source.id ||
      reactor.sourceId !== reaction.characterId ||
      seen.has(reactor.id)
    )
      throw new Error('Live Session failed counter scope mismatch.')
    seen.add(reactor.id)
    return {
      failed,
      reactor,
      ...sourceSpendMutation({
        source: reactor,
        command: { acceptedWieldConflict: null },
        resource: null,
        item: null,
        spell: failed.spellConsumption,
        receipts: {
          resourceConsumption: null,
          sourceItemConsumption: null,
          spellCastConsumption: failed.receipt.spellCastConsumption
        }
      })
    }
  })
}

export type FailedCounterSpend = ReturnType<typeof failedCounterSpends>[number]

/**
 * Spends each failed reactor's slot and reaction with the cast's terminal commit (D125) and returns the
 * reactors as settled. The reactor named by `exceptActorId` is the cast's target: its spend rides in the
 * target's own mechanics, and the caller settles it there.
 */
export async function applyFailedCounterSpends(
  ctx: EncounterWriteContext,
  input: {
    state: EncounterRunState
    occurrenceId: string
    sourceCommandId: string
    occurredAt: string
    spends: readonly FailedCounterSpend[]
    exceptActorId: string | null
    applyMechanics(
      batch: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
    ): Promise<EncounterMechanicsBatchResult>
    currentCharacterMaximumHitPoints(state: EncounterRunState, characterId: string): Promise<number>
  }
) {
  const settled = new Map<string, EncounterRunActorState>()
  for (const { failed, reactor, spends, mutation } of input.spends) {
    if (reactor.id === input.exceptActorId) continue
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
    if ((mechanics?.characterStreamVersion ?? null) !== failed.receipt.characterStreamVersion)
      throw new Error('Live Session failed counter Character receipt mismatch.')
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
