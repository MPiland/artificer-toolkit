import { describe, expect, it, vi } from 'vitest'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { api } from '../_generated/api'
import { executeCharacterSheetCommandAcknowledgement } from './sheetCommands'
import * as sheetFacts from './sheetFacts'
import * as receipts from './sheetCommandReceipts'
import { readCharacterRecord } from './stateDocuments'

describe('Character note command access', () => {
  it('commits and replays notes without preparing rules or changing mechanical values', async () => {
    const { owner, character, readState } = await readySheetFixture()
    const before = await readState()
    const totals = createDatabaseIoTotals()
    const evaluate = vi.spyOn(sheetFacts, 'loadCharacterSheetFacts')
    const input = {
      id: character.id,
      command: {
        type: 'CREATE_NOTE' as const,
        commandId: crypto.randomUUID(),
        expectedVersion: before.character!.play.streamVersion,
        title: 'Café encounter',
        body: 'Private note',
        groupId: 'session-notes'
      }
    }
    try {
      const acknowledgement = await owner.caller.run((ctx) =>
        executeCharacterSheetCommandAcknowledgement(
          { ...ctx, db: countDatabaseIo(ctx.db, totals) },
          owner.userId,
          input
        )
      )
      expect(acknowledgement).not.toHaveProperty('sheet')
      expect(acknowledgement).not.toHaveProperty('panels')
      expect(acknowledgement.streamVersion).toBe(input.command.expectedVersion + 1)
      expect(evaluate).not.toHaveBeenCalled()
      expect(totals.reads.byTable.authoredRoots).toBeUndefined()
      expect(totals.reads.byTable.authoredVersions).toBeUndefined()
      expect(totals.reads.byTable.systems).toBeUndefined()
      const after = await readState()
      expect(after.character!.updatedAt).not.toBe(before.character!.updatedAt)
      expect(after.character!.play.maximumHitPoints).toBe(before.character!.play.maximumHitPoints)
      expect(after.character!.play.walkingSpeed).toBe(before.character!.play.walkingSpeed)
      expect(after.character!.play.state).toEqual(before.character!.play.state)
      expect(readCharacterRecord(after.character!).state.notes).toContainEqual(
        expect.objectContaining({ title: 'Café encounter', body: 'Private note' })
      )
      const replay = await owner.caller.run((ctx) =>
        executeCharacterSheetCommandAcknowledgement(ctx, owner.userId, input)
      )
      expect(replay).toEqual(acknowledgement)
      expect(await readState()).toEqual(after)
      expect(evaluate).not.toHaveBeenCalled()
    } finally {
      evaluate.mockRestore()
    }
  })

  it('rolls back a note and both clocks when retaining its receipt fails', async () => {
    const { owner, character, readState } = await readySheetFixture()
    const before = await readState()
    const receipt = vi
      .spyOn(receipts, 'writeCharacterCommandReceipt')
      .mockRejectedValueOnce(new Error('Injected note receipt failure'))
    try {
      await expect(
        owner.caller.mutation(api.characters.sheetCommands.execute, {
          id: character.id,
          command: {
            type: 'CREATE_NOTE',
            commandId: crypto.randomUUID(),
            expectedVersion: before.character!.play.streamVersion,
            title: 'Must roll back',
            groupId: 'session-notes'
          }
        })
      ).rejects.toThrow('Injected note receipt failure')
      expect(receipt).toHaveBeenCalledOnce()
      expect(await readState()).toEqual(before)
    } finally {
      receipt.mockRestore()
    }
  })

  it('fences personal note writes and matching replays during assigned Campaign deletion', async () => {
    const { owner: gm, player, character, campaign, readState } = await setupCharacterRun()
    const input = {
      id: character.id,
      command: {
        type: 'CREATE_NOTE' as const,
        commandId: crypto.randomUUID(),
        expectedVersion: (await readState()).character!.play.streamVersion,
        title: 'Before deletion',
        groupId: 'session-notes'
      }
    }
    const first = await player.caller.mutation(api.characters.sheetCommands.execute, input)
    await gm.caller.mutation(api.campaigns.deletion.remove, {
      campaignId: campaign.id,
      expectedVersion: campaign.version,
      confirmation: 'DELETE'
    })
    const before = await readState()
    await expect(
      player.caller.mutation(api.characters.sheetCommands.execute, input)
    ).rejects.toThrow('Campaign not found.')
    await expect(
      player.caller.mutation(api.characters.sheetCommands.execute, {
        ...input,
        command: {
          ...input.command,
          commandId: crypto.randomUUID(),
          expectedVersion: first.streamVersion
        }
      })
    ).rejects.toThrow('Campaign not found.')
    expect(await readState()).toEqual(before)
  })
})
