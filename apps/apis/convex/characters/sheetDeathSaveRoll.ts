import { recordRuleRollCard } from '@artificer-toolkit/encounter-persistence/ruleRollCards'
import { deathSaveRollRecord } from '@artificer-toolkit/rules-runtime/encounterRuleCheckRolls'
import type { MutationCtx } from '../_generated/server'
import { encounterWriteTransaction } from '../encounters/encounterPorts'
import { retainUserRoll } from '../rollDocuments'

/**
 * Cards a Sheet death save (D96) in the command's own transaction. A Character in a Campaign posts
 * to the Table, or to the GM's private history when the GM rolled with Private visibility, so the
 * GM always sees it; a Character outside a Campaign keeps it in the roller's own history.
 */
export async function recordSheetDeathSaveRoll(
  ctx: MutationCtx,
  input: {
    userId: string
    campaignId: string | null
    character: { id: string; label: string; systemId: string }
    commandId: string
    rawDie: number
    createdAt: string
  }
) {
  const transaction = encounterWriteTransaction(ctx)
  const system = await transaction.ports.requireSystem(input.character.systemId)
  const roll = deathSaveRollRecord({
    occurrenceId: input.commandId,
    rawDie: input.rawDie,
    characterId: input.character.id,
    rollerLabel: input.character.label,
    ruleset: { systemId: system.id, code: system.rulesetCode, version: system.rulesetVersion },
    createdAt: input.createdAt
  })
  if (!input.campaignId) {
    await retainUserRoll(ctx, input.userId, roll, null)
    return
  }
  const { campaign } = await transaction.ports.requireCampaignAuthority(
    input.campaignId,
    input.userId
  )
  await recordRuleRollCard(transaction, {
    campaign,
    encounterId: null,
    roller: null,
    initiatorUserId: input.userId,
    visibility: undefined,
    clientNonce: roll.id,
    roll
  })
}
