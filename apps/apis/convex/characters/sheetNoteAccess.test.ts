import { describe, expect, it, vi } from 'vitest'
import { characterCollectionSchemas } from '@artificer-toolkit/schema/projections/characterOperationalRecords'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { api } from '../_generated/api'
import { executeCharacterSheetCommandAcknowledgement } from './sheetCommands'
import * as sheetFacts from './sheetFacts'
import * as receipts from './sheetCommandReceipts'
import { readCharacterRecord } from './stateDocuments'

const UNRELATED_COLLECTIONS = Object.keys(characterCollectionSchemas).filter(
  (table) => table !== 'characterNotes' && table !== 'characterNoteGroups'
)

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
      expect(after.character!.play.speeds).toEqual(before.character!.play.speeds)
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

  it('reads and writes only notes and groups, collection counts, clocks and receipt', async () => {
    const { owner, character, readState } = await readySheetFixture()
    const before = await readState()
    const stored = readCharacterRecord(before.character!)
    expect(stored.state.equipment.inventory.length).toBeGreaterThan(0)
    const totals = createDatabaseIoTotals()
    await owner.caller.run((ctx) =>
      executeCharacterSheetCommandAcknowledgement(
        { ...ctx, db: countDatabaseIo(ctx.db, totals) },
        owner.userId,
        {
          id: character.id,
          command: {
            type: 'CREATE_NOTE',
            commandId: crypto.randomUUID(),
            expectedVersion: before.character!.play.streamVersion,
            title: 'Metered note',
            groupId: 'session-notes'
          }
        }
      )
    )
    for (const table of UNRELATED_COLLECTIONS) {
      expect(totals.reads.byTable[table], table).toBeUndefined()
      expect(totals.writes.byTable[table], table).toBeUndefined()
    }
    expect(totals.reads.byTable.characterBuildStates?.distinct).toBe(1)
    expect(totals.reads.byTable.characterPlayStates?.distinct).toBe(1)
    expect(totals.reads.byTable.characters?.distinct).toBe(1)
    // One new note row and the default group, then the build counts with its structure clock and
    // the play clock, and the Character's one queued Sheet derivation (ADR 0041); the head and
    // everything else stay unwritten.
    expect(totals.writes.byTable.characterNotes?.documents).toBe(1)
    expect(totals.writes.byTable.characterNoteGroups?.documents).toBe(1)
    expect(totals.writes.byTable.replace?.documents).toBe(2)
    expect(totals.writes.byTable.characterSheetPendingStores?.documents).toBe(1)
    expect(totals.writes.byTable.patch).toBeUndefined()
    expect(totals.writes.byTable.delete).toBeUndefined()
    const after = await readState()
    const written = readCharacterRecord(after.character!)
    // The built-in Session Notes group is materialized as the one written group row.
    const [group] = written.state.noteGroups ?? []
    expect(written.state.noteGroups).toEqual([
      expect.objectContaining({ kind: 'SESSION', label: 'Session Notes' })
    ])
    expect(written.state.notes).toEqual([
      expect.objectContaining({ title: 'Metered note', groupId: group!.id })
    ])
    expect({
      ...written,
      state: { ...written.state, notes: undefined, noteGroups: undefined }
    }).toEqual({ ...stored, state: { ...stored.state, notes: undefined, noteGroups: undefined } })
    expect(after.character!.play.state).toEqual(before.character!.play.state)
    expect(after.character!.play.streamVersion).toBe(before.character!.play.streamVersion + 1)
    expect(after.character!.updatedAt).toBe(after.character!.play.updatedAt)
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
