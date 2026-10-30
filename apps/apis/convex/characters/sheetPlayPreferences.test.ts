import { describe, expect, it, vi } from 'vitest'
import type { CharacterSheetExecuteInput } from '@artificer-toolkit/schema/api/characterSheetCommandInputs'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import { api } from '../_generated/api'
import { executeCharacterSheetCommandAcknowledgement } from './sheetCommands'
import * as sheetFacts from './sheetFacts'
import * as receipts from './sheetCommandReceipts'

describe('Character play preference acknowledgements', () => {
  it.each(['SET_INSPIRATION', 'SET_PARTY_VISIBILITY'] as const)(
    'commits and replays %s through head/play reads without mechanical preparation',
    async (type) => {
      const { t, owner, character, readState } = await readySheetFixture()
      const before = await readState()
      const route = await t.run((ctx) =>
        ctx.db
          .query('authoredRouteIds')
          .withIndex('by_subjectId', (q) => q.eq('subjectId', character.id))
          .unique()
      )
      const common = {
        commandId: crypto.randomUUID(),
        expectedVersion: before.character!.play.streamVersion
      }
      const input: CharacterSheetExecuteInput = {
        id: route!.publicId,
        command:
          type === 'SET_INSPIRATION'
            ? { ...common, type, inspired: true }
            : { ...common, type, visibility: { sheet: true, health: 'BAR' } }
      }
      const totals = createDatabaseIoTotals()
      const evaluate = vi.spyOn(sheetFacts, 'loadCharacterSheetFacts')
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
        expect(acknowledgement.streamVersion).toBe(common.expectedVersion + 1)
        expect(evaluate).not.toHaveBeenCalled()
        // The pending store is the Character's one queued Sheet derivation (ADR 0041).
        expect(Object.keys(totals.reads.byTable).sort()).toEqual([
          'authoredRouteIds',
          'characterPlayStates',
          'characterSheetPendingStores',
          'characters'
        ])
        const after = await readState()
        expect({ ...after.character!, play: before.character!.play }).toEqual(before.character)
        const expectedState =
          type === 'SET_INSPIRATION'
            ? { ...before.character!.play.state, inspiration: true }
            : { ...before.character!.play.state, partyVisibility: { sheet: true, health: 'BAR' } }
        expect(readCharacterPlay(after.character!.play)).toEqual(expectedState)
        expect(after.character!.play.maximumHitPoints).toBe(before.character!.play.maximumHitPoints)
        expect(after.character!.play.speeds).toEqual(before.character!.play.speeds)
        expect(Date.parse(after.character!.play.updatedAt)).toBeGreaterThan(
          Date.parse(before.character!.play.updatedAt)
        )
        expect(after.receipts).toHaveLength(before.receipts.length + 1)
        const replay = await owner.caller.run((ctx) =>
          executeCharacterSheetCommandAcknowledgement(ctx, owner.userId, input)
        )
        expect(replay).toEqual(acknowledgement)
        expect(await readState()).toEqual(after)
        expect(evaluate).not.toHaveBeenCalled()
      } finally {
        evaluate.mockRestore()
      }
    }
  )

  it('clears optional inspiration, refuses stale writes and mismatched or unauthorized replay', async () => {
    const { owner, other, character, readState } = await readySheetFixture()
    const input = {
      id: character.id,
      command: {
        type: 'SET_INSPIRATION' as const,
        commandId: crypto.randomUUID(),
        expectedVersion: (await readState()).character!.play.streamVersion,
        inspired: true
      }
    }
    const first = await owner.caller.mutation(api.characters.sheetCommands.execute, input)
    const before = await readState()
    await expect(
      owner.caller.mutation(api.characters.sheetCommands.execute, {
        ...input,
        command: { ...input.command, inspired: false }
      })
    ).rejects.toThrow('Command ID was already used with different input.')
    await expect(
      owner.caller.mutation(api.characters.sheetCommands.execute, {
        ...input,
        command: { ...input.command, commandId: crypto.randomUUID() }
      })
    ).rejects.toThrow('Character Sheet changed; refresh before applying this command.')
    await expect(
      other.caller.mutation(api.characters.sheetCommands.execute, input)
    ).rejects.toThrow('Character Sheet is unavailable for the current user.')
    expect(await readState()).toEqual(before)
    await owner.caller.mutation(api.characters.sheetCommands.execute, {
      ...input,
      command: {
        ...input.command,
        commandId: crypto.randomUUID(),
        expectedVersion: first.streamVersion,
        inspired: false
      }
    })
    expect((await readState()).character!.play.state).not.toHaveProperty('inspiration')
    const afterClear = await readState()
    const replay = await owner.caller.mutation(api.characters.sheetCommands.execute, input)
    expect(replay).toEqual({ ...first, streamVersion: first.streamVersion + 1 })
    expect(await readState()).toEqual(afterClear)
  })

  it.each(['SET_INSPIRATION', 'SET_PARTY_VISIBILITY'] as const)(
    'rolls back %s and its play clock when receipt persistence fails',
    async (type) => {
      const { owner, character, readReceiptStorage } = await readySheetFixture()
      const before = await readReceiptStorage()
      const common = {
        commandId: crypto.randomUUID(),
        expectedVersion: before.character!.play.streamVersion
      }
      const command: CharacterSheetExecuteInput['command'] =
        type === 'SET_INSPIRATION'
          ? { ...common, type, inspired: true }
          : { ...common, type, visibility: { sheet: true, health: 'EXACT' } }
      const receipt = vi
        .spyOn(receipts, 'writeCharacterCommandReceipt')
        .mockRejectedValueOnce(new Error('Injected preference receipt failure'))
      try {
        await expect(
          owner.caller.mutation(api.characters.sheetCommands.execute, { id: character.id, command })
        ).rejects.toThrow('Injected preference receipt failure')
        expect(receipt).toHaveBeenCalledOnce()
        expect(await readReceiptStorage()).toEqual(before)
      } finally {
        receipt.mockRestore()
      }
    }
  )

  it('allows exact assigned GM inspiration but refuses personal access, privacy changes and foreign Campaigns', async () => {
    const { owner: gm, player, character, campaign, readState } = await setupCharacterRun()
    const command = {
      type: 'SET_INSPIRATION' as const,
      commandId: crypto.randomUUID(),
      expectedVersion: (await readState()).character!.play.streamVersion,
      inspired: true
    }
    await expect(
      gm.caller.mutation(api.characters.sheetCommands.execute, { id: character.id, command })
    ).rejects.toThrow('Character Sheet is unavailable for the current user.')
    await expect(
      gm.caller.mutation(api.campaigns.characterSheet.execute, {
        campaignId: crypto.randomUUID(),
        characterId: character.id,
        command
      })
    ).rejects.toThrow()
    const first = await gm.caller.mutation(api.campaigns.characterSheet.execute, {
      campaignId: campaign.id,
      characterId: character.id,
      command
    })
    const before = await readState()
    await expect(
      player.caller.mutation(api.campaigns.characterSheet.execute, {
        campaignId: campaign.id,
        characterId: character.id,
        command
      })
    ).rejects.toThrow('Stored Sheet command receipt identity mismatch.')
    await expect(
      gm.caller.mutation(api.campaigns.characterSheet.execute, {
        campaignId: campaign.id,
        characterId: character.id,
        command: {
          type: 'SET_PARTY_VISIBILITY',
          commandId: crypto.randomUUID(),
          expectedVersion: first.streamVersion,
          visibility: { sheet: true, health: 'EXACT' }
        }
      })
    ).rejects.toThrow()
    expect(await readState()).toEqual(before)
    await gm.caller.mutation(api.campaigns.archive.archive, {
      campaignId: campaign.id,
      expectedVersion: campaign.version
    })
    await expect(
      gm.caller.mutation(api.campaigns.characterSheet.execute, {
        campaignId: campaign.id,
        characterId: character.id,
        command
      })
    ).rejects.toThrow('Archived Campaigns are read-only.')
    expect(await readState()).toEqual(before)
  })

  it('checks implicit Campaign deletion authority before new preference writes and matching replays', async () => {
    const { owner: gm, player, character, campaign, readState } = await setupCharacterRun()
    const input = {
      id: character.id,
      command: {
        type: 'SET_PARTY_VISIBILITY' as const,
        commandId: crypto.randomUUID(),
        expectedVersion: (await readState()).character!.play.streamVersion,
        visibility: { sheet: true, health: 'BAR' as const }
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
