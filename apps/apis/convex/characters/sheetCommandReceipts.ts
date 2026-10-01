import type { CharacterSheetCommandResponseDto } from '@artificer-toolkit/schema/api/characterSheetCommands'
import { characterStoredCommandReceiptSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
import {
  readCharacterCommandReplay as readSharedCharacterCommandReplay,
  writeCharacterCommandReceipt as writeSharedCharacterCommandReceipt,
  type ReceiptScope
} from '@artificer-toolkit/encounter-persistence/characterSheetReceipts'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { readReceiptHeader, writeReceiptRecord } from '../lib/receiptLedgers'

/** The caller checks current authority and command permissions before looking up a replay. */
export async function readCharacterCommandReplay(ctx: QueryCtx, scope: ReceiptScope) {
  return readSharedCharacterCommandReplay(scope, async () => {
    const commandId = scope.command.commandId.toLowerCase()
    const header = await ctx.db
      .query('characterCommandReceipts')
      .withIndex('by_characterId_commandId', (q) =>
        q.eq('characterId', scope.characterId).eq('commandId', commandId)
      )
      .unique()
    if (!header) return null
    if (
      header.characterId !== scope.characterId ||
      header.commandId !== commandId ||
      header.actorId !== scope.userId
    )
      throw new Error('Stored Sheet command receipt identity mismatch.')
    const { _id, _creationTime, ...receipt } = await readReceiptHeader(
      ctx,
      'characterCommandReceipts',
      header
    )
    return characterStoredCommandReceiptSchema.parse(receipt)
  })
}

/** State and this receipt commit together in the caller's mutation. */
export async function writeCharacterCommandReceipt(
  ctx: MutationCtx,
  scope: ReceiptScope & {
    occurredAt: string
    summary: string
    result?: CharacterSheetCommandResponseDto['result']
  }
) {
  return writeSharedCharacterCommandReceipt(scope, async (receipt) => {
    await writeReceiptRecord(ctx, 'characterCommandReceipts', receipt)
  })
}
