import type {
  ConcealmentCheckSettlement,
  StabilizeCheckSettlement
} from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ServerRuleExecutionApplicationOutputsDto } from '@artificer-toolkit/schema/shared/ruleExecutionApplicationOutputs'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { concealmentLifecycleFor } from '@artificer-toolkit/rules-runtime/encounterConcealment'
import {
  decideEncounterConcealmentCheck,
  heldConcealments
} from '@artificer-toolkit/rules-runtime/encounterConcealmentCheck'
import { settledCheckD20MatchesFrozen } from '@artificer-toolkit/rules-runtime/encounterBasicActionCheck'
import { basicActionCheckRollRecord } from '@artificer-toolkit/rules-runtime/encounterRuleCheckRolls'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { createActiveRuleEffectStore } from './effectStore.js'
import { asHiddenRoller, recordRuleRollCard } from './ruleRollCards.js'
import type { EncounterWriteTransaction } from './ports.js'
import type { EncounterDocument } from './store.js'

type ConcealmentCheckOutput = Extract<
  ServerRuleExecutionApplicationOutputsDto,
  { kind: 'CONCEALMENT_CHECK' }
>

/** Whether a settled basic action check is a concealment check (Hide, Search) and not a stabilizing one. */
export const isConcealmentCheckSettlement = (
  settlement: StabilizeCheckSettlement | ConcealmentCheckSettlement
): settlement is ConcealmentCheckSettlement =>
  settlement.context.kind === 'ENCOUNTER_CONCEALMENT_CHECK'

/**
 * Settles a concealment check (Hide, Search). The room planned the result from the roller's total;
 * this re-derives it from the frozen check and the concealments held now, refuses any difference,
 * then stores a Hide's concealment on its roller, replacing the one it held, or narrows the
 * concealments a Search found. A concealment left with no observers ends. The records it ended come
 * back so the action's undo can restore them. It posts the roller's roll card unless the app
 * already carded that die.
 */
export async function settleEncounterConcealmentCheck(
  ctx: EncounterWriteTransaction,
  input: {
    campaign: EncounterDocument<'campaigns'>
    state: { id: string; gameSystemId: string }
    actors: readonly EncounterRunActorState[]
    settlement: ConcealmentCheckSettlement
    rootCommandId: string
    initiatorUserId: string
    occurredAt: string
    occurrenceVersion: number
  }
): Promise<{
  actors: EncounterRunActorState[]
  output: ConcealmentCheckOutput
  endedEffects: ActiveRuleEffectRecord[]
}> {
  const { state, actors, settlement } = input
  const { context, execution } = settlement
  const output =
    execution.status === 'COMPLETE' && execution.applicationOutputs.kind === 'CONCEALMENT_CHECK'
      ? execution.applicationOutputs
      : null
  const roller = actors.find((actor) => actor.id === context.actorId)
  if (
    !output ||
    execution.status !== 'COMPLETE' ||
    !roller ||
    roller.kind === 'CUSTOM' ||
    execution.occurrenceVersion !== input.occurrenceVersion ||
    output.occurrenceId !== execution.occurrenceId ||
    output.commandId !== context.commandId ||
    context.commandId !== input.rootCommandId ||
    output.actorId !== context.actorId ||
    checksumCanonicalJson(output.definition) !== checksumCanonicalJson(context.definition) ||
    output.check.checkDefinitionId !== context.check.checkDefinitionId ||
    !settledCheckD20MatchesFrozen(output.d20, context.d20)
  )
    throw new Error('Live Session concealment check scope mismatch.')
  const store = createActiveRuleEffectStore(ctx)
  const effectsByActorId = new Map(
    await Promise.all(
      actors.map(
        async (actor) => [actor.id, await store.list(turnEffectOwner(actor, state.id))] as const
      )
    )
  )
  const held = heldConcealments(effectsByActorId)
  const endedEffects: ActiveRuleEffectRecord[] = []
  const decision = decideEncounterConcealmentCheck({
    context,
    total: output.d20.total,
    held
  })
  const { resolution } = output
  if (
    resolution.kind !== decision.kind ||
    (settlement.createdEffect !== null && decision.kind !== 'CONCEAL')
  )
    throw new Error('Live Session concealment check differs from its plan.')
  if (resolution.kind === 'CONCEAL' && decision.kind === 'CONCEAL') {
    if (
      checksumCanonicalJson(resolution.hiddenFromActorIds) !==
        checksumCanonicalJson(decision.hiddenFromActorIds) ||
      (settlement.createdEffect === null) !== (decision.hiddenFromActorIds.length === 0)
    )
      throw new Error('Live Session concealment check differs from its plan.')
    const planned = settlement.createdEffect
    if (planned) {
      const created = await store.create({
        id: planned.id,
        owner: turnEffectOwner(roller, state.id),
        definition: planned.definition,
        lifecycle: planned.lifecycle,
        occurredAt: input.occurredAt
      })
      const receipt = resolution.createdEffect
      const concealment = created.definition.stateContributions.find(
        ({ kind }) => kind === 'LOCATION_CONCEALMENT'
      )
      if (
        !receipt ||
        concealment?.kind !== 'LOCATION_CONCEALMENT' ||
        concealment.concealmentTotal !== output.d20.total ||
        checksumCanonicalJson(created.lifecycle.concealedFromActorIds) !==
          checksumCanonicalJson(decision.hiddenFromActorIds) ||
        receipt.activeEffectId !== created.id ||
        receipt.targetActorId !== roller.id ||
        receipt.createdOrdinal !== created.createdOrdinal ||
        receipt.afterVersion !== created.version ||
        receipt.definitionChecksum !== created.definitionChecksum ||
        receipt.lifecycleChecksum !== created.lifecycleChecksum
      )
        throw new Error('Live Session concealment differs from its plan.')
      // An actor holds at most one concealment: the Hide that hides it anew replaces the old one.
      const replaced = held.find(({ holderActorId }) => holderActorId === roller.id)?.effect
      if (replaced) {
        await store.deleteCas({
          id: replaced.id,
          owner: replaced.owner,
          expectedVersion: replaced.version,
          removal: 'ENDED'
        })
        endedEffects.push(replaced)
      }
    }
  } else if (resolution.kind === 'DETECT' && decision.kind === 'DETECT') {
    if (
      settlement.createdEffect !== null ||
      checksumCanonicalJson(resolution.found) !==
        checksumCanonicalJson(
          decision.found.map(({ effect, ...found }) => ({
            activeEffectId: effect.id,
            ...found,
            afterVersion: effect.version + 1
          }))
        )
    )
      throw new Error('Live Session concealment check differs from its plan.')
    for (const { effect, holderActorId, afterObserverActorIds } of decision.found) {
      const holder = actors.find((actor) => actor.id === holderActorId)
      if (!holder) throw new Error('Live Session concealment holder is unavailable.')
      const owner = turnEffectOwner(holder, state.id)
      if (afterObserverActorIds.length) {
        await store.updateLifecycleCas({
          id: effect.id,
          owner,
          expectedVersion: effect.version,
          lifecycle: concealmentLifecycleFor(effect, afterObserverActorIds)
        })
      } else {
        // A concealment that hides its holder from no one is over.
        await store.deleteCas({
          id: effect.id,
          owner,
          expectedVersion: effect.version,
          removal: 'ENDED'
        })
        endedEffects.push(effect)
      }
    }
  }
  // The app already carded the die an app roll settled with; any other die gets the roller's card.
  if (settlement.appRollId === null) {
    const system = await ctx.ports.requireSystem(state.gameSystemId)
    const roll = basicActionCheckRollRecord({
      occurrenceId: execution.occurrenceId,
      d20: output.d20,
      actionLabel: context.actionLabel,
      checkLabel: context.check.label,
      rollerLabel: roller.label,
      ruleset: { systemId: system.id, code: system.rulesetCode, version: system.rulesetVersion },
      createdAt: input.occurredAt
    })
    // A concealment total is secret: no table learns it, whoever rolls (D100).
    await recordRuleRollCard(ctx, {
      campaign: input.campaign,
      encounterId: state.id,
      roller: asHiddenRoller(roller),
      initiatorUserId: input.initiatorUserId,
      visibility: undefined,
      clientNonce: roll.id,
      roll
    })
  }
  return { actors: [...actors], output, endedEffects }
}
