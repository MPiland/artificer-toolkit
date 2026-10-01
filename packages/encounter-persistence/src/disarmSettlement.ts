import { characterHistoryEntryDtoSchema } from '@artificer-toolkit/schema/api/characterHistory'
import { characterStoredCommandReceiptSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
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
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { EncounterCharacterWriteTransaction } from './ports.js'
import { consumeNativeActionEconomy } from './actionEconomyPersistence.js'
import { writeRunActor } from './documents.js'

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
    if (!targetRow || targetRow.stateChecksum !== checksumCanonicalJson(target))
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
      const priorReceipt = await ctx.db
        .query('characterCommandReceipts')
        .withIndex('by_characterId_commandId', (q) =>
          q.eq('characterId', active.id).eq('commandId', input.commandId.toLowerCase())
        )
        .unique()
      if (priorReceipt) throw new Error('Disarm Character command already exists.')
      await ctx.ports.writeCharacterRecord({
        current: active,
        fields: { streamVersion: active.play.streamVersion + 1, updatedAt: input.occurredAt },
        document: JSON.parse(JSON.stringify(characterAuthoredDtoSchema.parse(planned.character)))
      })
      const receiptId = crypto.randomUUID()
      const history = characterHistoryEntryDtoSchema.parse({
        eventId: receiptId,
        occurredAt: input.occurredAt,
        actorId: input.userId,
        eventType: 'CHARACTER_RULE_EQUIPMENT_STATE_APPLIED',
        summary: 'Rule equipment state applied'
      })
      await ctx.db.insert(
        'characterCommandReceipts',
        characterStoredCommandReceiptSchema.parse({
          id: receiptId,
          characterId: active.id,
          commandId: input.commandId,
          actorId: input.userId,
          commandFingerprint: checksumRuleDocument({
            encounterId: input.state.id,
            occurrenceId: input.occurrenceId,
            sourceCommandId: input.sourceCommandId,
            targetActorId: target.id,
            stateTransition
          }),
          occurredAt: input.occurredAt,
          historyJson: canonicalizeRuleDocument(history),
          historyChecksum: checksumRuleDocument(history)
        })
      )
    } else if (planned.kind === 'CREATURE') {
      target = planned.actor
      await writeRunActor(ctx, targetRow._id, target)
    }
  }
  const actor = input.actionEconomy
    ? await consumeNativeActionEconomy(ctx, {
        actor: input.actor,
        consumption: input.actionEconomy,
        overridden: false
      })
    : input.actor
  return {
    actor,
    target,
    applicationOutputs: disarmApplicationOutputs({ ...input, stateTransition })
  }
}
