import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  disarmApplicationOutputs,
  disarmSourceWins,
  planEncounterDisarmSuccess
} from '@artificer-toolkit/rules-runtime/encounterDisarmPreparation'
import { checksumRunActorPlayState } from '@artificer-toolkit/rules-runtime/encounterActorStorage'
import { encounterActorRelationship } from '@artificer-toolkit/rules-runtime/encounterActionTargetPolicy'
import type { EncounterCharacterWriteTransaction } from './ports.js'
import { consumeNativeActionEconomy } from './actionEconomyPersistence.js'
import { replaceRunActor, writeRunActor } from './documents.js'
import { engageIdleTurnActor } from './idleTurnMark.js'

type DisarmSettlementInput = Parameters<typeof disarmApplicationOutputs>[0]

/**
 * Persists a settled Disarm inside the caller's transaction: a won contest moves the held item to
 * carried, and the source spends its ACTION. It re-derives every change from current state.
 */
export async function settleDisarm(
  ctx: EncounterCharacterWriteTransaction,
  input: Omit<DisarmSettlementInput, 'stateTransition'> & {
    state: EncounterRunState
    actor: EncounterRunActorState
    target: EncounterRunActorState
    commandId: string
    sourceCommandId: string
    userId: string
    occurredAt: string
  }
) {
  const { contest, rolls } = input
  let target = input.target
  let stateTransition: DisarmSettlementInput['stateTransition'] = { kind: 'NONE' }
  if (disarmSourceWins(rolls)) {
    const targetRow = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) =>
        q.eq('encounterId', target.encounterId).eq('id', target.id)
      )
      .unique()
    if (!targetRow || targetRow.stateChecksum !== checksumRunActorPlayState(target))
      throw new Error('Disarm target changed before settlement.')
    const active =
      target.kind === 'CHARACTER' ? await ctx.ports.readCharacterRow(target.sourceId) : null
    if (active && active.status !== 'ACTIVE')
      throw new Error('Disarm Character changed before settlement.')
    const planned = planEncounterDisarmSuccess({
      target,
      contest,
      character: active
        ? {
            id: active.id,
            streamVersion: active.play.streamVersion,
            document: ctx.ports.readCharacterRecord(active) as CharacterAuthored
          }
        : null
    })
    stateTransition = planned.stateTransition
    if (planned.kind === 'CHARACTER' && active) {
      await ctx.ports.writeCharacterRecord({
        current: active,
        fields: { streamVersion: active.play.streamVersion + 1, updatedAt: input.occurredAt },
        document: JSON.parse(JSON.stringify(characterAuthoredDtoSchema.parse(planned.character)))
      })
    } else if (planned.kind === 'CREATURE') {
      target = planned.actor
      await writeRunActor(ctx, targetRow._id, target)
    }
  }
  const spent = input.actionEconomy
    ? await consumeNativeActionEconomy(ctx, {
        actor: input.actor,
        consumption: input.actionEconomy,
        overridden: false
      })
    : input.actor
  // The contest is the Disarmer's attack roll against the target: against a hostile creature it
  // engages an actor armed for an idle-bound grant (SRD Rage).
  const engaged =
    encounterActorRelationship(input.actor.disposition, target.disposition) === 'HOSTILE'
      ? engageIdleTurnActor(spent)
      : spent
  if (engaged !== spent) await replaceRunActor(ctx, spent, engaged)
  return {
    actor: engaged,
    target,
    applicationOutputs: disarmApplicationOutputs({ ...input, stateTransition })
  }
}
