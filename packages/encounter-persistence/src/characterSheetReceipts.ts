import {
  characterHistoryEntryDtoSchema,
  characterSheetCommandResponseDtoSchema,
  type CharacterSheetCommandInputDto,
  type CharacterSheetCommandResponseDto
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import { characterStoredCommandReceiptSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { presentCampaignCharacterHistory } from '@artificer-toolkit/rules-runtime/character/campaignCharacterPresentation'
import { readCharacterReceiptHistory } from './characterReceiptHistory.js'

export type ReceiptScope = {
  characterId: string
  userId: string
  command: CharacterSheetCommandInputDto
  streamVersion: number
  contentMaturity: Parameters<typeof presentCampaignCharacterHistory>[1]
  viewer: Parameters<typeof presentCampaignCharacterHistory>[2]
}

const fingerprint = (command: CharacterSheetCommandInputDto) =>
  checksumRuleDocument(JSON.parse(JSON.stringify(command)))

/** The caller checks current authority and command permissions before looking up a replay. */
export async function readCharacterCommandReplay(
  scope: ReceiptScope,
  readReceipt: () => Promise<ReturnType<typeof characterStoredCommandReceiptSchema.parse> | null>
) {
  const commandId = scope.command.commandId.toLowerCase()
  const receipt = await readReceipt()
  if (!receipt) return null
  if (
    receipt.characterId !== scope.characterId ||
    receipt.commandId !== commandId ||
    receipt.actorId !== scope.userId
  )
    throw new Error('Stored Sheet command receipt identity mismatch.')
  const historyEntry = readCharacterReceiptHistory(receipt)
  if (receipt.commandFingerprint !== fingerprint(scope.command))
    throw new Error('Sheet command replay does not match the original command.')
  return characterSheetCommandResponseDtoSchema.parse({
    characterId: scope.characterId,
    streamVersion: scope.streamVersion,
    historyEntry: presentCampaignCharacterHistory(
      { characterId: scope.characterId, entries: [historyEntry] },
      scope.contentMaturity,
      scope.viewer
    ).entries[0],
    ...(historyEntry.result ? { result: historyEntry.result } : {})
  })
}

/** State and this receipt commit together in the caller's transaction. */
export async function writeCharacterCommandReceipt(
  scope: ReceiptScope & {
    occurredAt: string
    summary: string
    result?: CharacterSheetCommandResponseDto['result']
  },
  writeReceipt: (
    receipt: ReturnType<typeof characterStoredCommandReceiptSchema.parse>
  ) => Promise<void>
) {
  const historyEntry = characterHistoryEntryDtoSchema.parse({
    eventId: crypto.randomUUID(),
    occurredAt: scope.occurredAt,
    actorId: scope.userId,
    eventType: scope.command.type,
    summary: scope.summary,
    ...(scope.result ? { result: scope.result } : {})
  })
  await writeReceipt(
    characterStoredCommandReceiptSchema.parse({
      id: historyEntry.eventId,
      characterId: scope.characterId,
      commandId: scope.command.commandId.toLowerCase(),
      actorId: scope.userId,
      commandFingerprint: fingerprint(scope.command),
      occurredAt: scope.occurredAt,
      historyJson: canonicalizeRuleDocument(historyEntry),
      historyChecksum: checksumRuleDocument(historyEntry)
    })
  )
  return characterSheetCommandResponseDtoSchema.parse({
    characterId: scope.characterId,
    streamVersion: scope.streamVersion,
    historyEntry: presentCampaignCharacterHistory(
      { characterId: scope.characterId, entries: [historyEntry] },
      scope.contentMaturity,
      scope.viewer
    ).entries[0],
    ...(scope.result ? { result: scope.result } : {})
  })
}
