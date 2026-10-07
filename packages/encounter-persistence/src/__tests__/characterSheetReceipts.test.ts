import { expect, it } from 'vitest'
import {
  characterHistoryEntryDtoSchema,
  characterSheetCommandInputDtoSchema
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import { characterStoredCommandReceiptSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  readCharacterCommandReplay,
  writeCharacterCommandReceipt,
  type ReceiptScope
} from '../characterSheetReceipts.js'

it('replays original checksummed history under current maturity and play version, refusing corrupted or changed commands', async () => {
  const scope: ReceiptScope = {
    characterId: '00000000-0000-4000-8000-000000000001',
    userId: '00000000-0000-4000-8000-000000000002',
    command: characterSheetCommandInputDtoSchema.parse({
      type: 'SET_INSPIRATION',
      commandId: '00000000-0000-4000-8000-000000000003',
      expectedVersion: 3,
      inspired: true
    }),
    streamVersion: 4,
    contentMaturity: 'STANDARD',
    viewer: 'CHARACTER_OWNER'
  }
  let captured: unknown
  const acknowledgement = await writeCharacterCommandReceipt(
    { ...scope, occurredAt: '2026-09-30T00:00:00.000Z', summary: 'shit happens' },
    async (receipt) => {
      captured = structuredClone(receipt)
    }
  )
  const original = characterStoredCommandReceiptSchema.parse(captured)
  const history = characterHistoryEntryDtoSchema.parse(JSON.parse(original.historyJson))
  expect(original.historyChecksum).toBe(checksumRuleDocument(history))
  expect(history.summary).toBe('shit happens')
  expect(acknowledgement.historyEntry?.summary).toBe('**** happens')

  const readReceipt = async () => characterStoredCommandReceiptSchema.parse(captured)
  const standard = await readCharacterCommandReplay({ ...scope, streamVersion: 9 }, readReceipt)
  expect(standard).toEqual({
    characterId: scope.characterId,
    streamVersion: 9,
    historyEntry: { ...history, summary: '**** happens' }
  })
  const mature = await readCharacterCommandReplay(
    { ...scope, contentMaturity: 'MATURE', streamVersion: 10 },
    readReceipt
  )
  expect(mature).toEqual({
    characterId: scope.characterId,
    streamVersion: 10,
    historyEntry: history
  })
  expect(characterStoredCommandReceiptSchema.parse(captured)).toEqual(original)

  await expect(
    readCharacterCommandReplay(scope, async () =>
      characterStoredCommandReceiptSchema.parse({ ...original, historyChecksum: '0'.repeat(64) })
    )
  ).rejects.toThrow('Stored Sheet command receipt history checksum mismatch.')
  await expect(
    readCharacterCommandReplay(
      {
        ...scope,
        command: characterSheetCommandInputDtoSchema.parse({ ...scope.command, inspired: false })
      },
      readReceipt
    )
  ).rejects.toThrow('Command ID was already used with different input.')
})
