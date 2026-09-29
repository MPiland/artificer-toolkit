import { makeFunctionReference } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import * as projection from '@artificer-toolkit/rules-runtime/character/sheetProjection'
import { encodeCharacterRecord } from '@artificer-toolkit/schema/projections/characterStoredState'
import { api } from '../_generated/api'
import { readySheetFixture as fixture } from '../../tests/fixtures/readyCharacter'
import { input } from '../../tests/fixtures/characters'
import { readCharacterRecord } from './stateDocuments'

const execute = makeFunctionReference<
  'mutation',
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
>('characters/sheetCommands:execute')

afterEach(() => vi.restoreAllMocks())

describe('native personal Sheet command transactions', () => {
  it('does not persist read-time Builder reconciliation through an unrelated Sheet command', async () => {
    const { t, owner, character, readState } = await fixture()
    const stored = await readState()
    const before = readCharacterRecord(stored.character!)
    // A previously selected ancestry no longer exists on the current published Human.
    before.intent.ancestrySelections = [
      {
        id: crypto.randomUUID(),
        ancestryId: crypto.randomUUID(),
        optionId: crypto.randomUUID(),
        source: { kind: 'RACE', raceId: before.intent.race.raceId },
        timing: { kind: 'IMMEDIATE' }
      }
    ]
    const encoded = encodeCharacterRecord(stored.character!, {
      document: before,
      streamVersion: stored.character!.play.streamVersion,
      updatedAt: stored.character!.updatedAt
    })
    await t.run((ctx) =>
      ctx.db.patch(stored.character!._id, {
        documentJson: encoded.documentJson,
        checksum: encoded.checksum
      })
    )
    const spy = vi.spyOn(projection, 'projectCharacterSheetBundle')
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'SET_INSPIRATION',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        inspired: true
      }
    })
    expect(spy.mock.calls[0]?.[0].character.intent.ancestrySelections).toBeUndefined()
    const after = await readState()
    const persisted = readCharacterRecord(after.character!)
    expect(persisted.intent).toEqual(before.intent)
    expect(persisted.profile).toEqual(before.profile)
    expect(persisted.state.inspiration).toBe(true)
    expect(after.character?.play.streamVersion).toBe(2)
    expect(after.receipts).toHaveLength(1)
  })

  it('stores notes once, preserves original history on replay, and returns current state', async () => {
    const { owner, character, committed, readState } = await fixture()
    const command = {
      type: 'CREATE_NOTE' as const,
      commandId: crypto.randomUUID(),
      expectedVersion: 1,
      title: 'Private plan',
      body: 'Meet at dawn',
      groupId: 'session-notes'
    }
    const first = await owner.caller.mutation(execute, { id: committed.publicId, command })
    expect(first).toMatchObject({
      characterId: character.id,
      streamVersion: 2,
      historyEntry: {
        actorId: owner.userId,
        eventType: 'CREATE_NOTE',
        summary: 'Note "Private plan" created'
      }
    })
    let stored = await readState()
    expect(stored.receipts).toHaveLength(1)
    const authored = readCharacterRecord(stored.character!)
    expect(authored.state.notes).toHaveLength(1)
    expect(authored.state.notes?.[0]).toMatchObject({ title: 'Private plan', body: 'Meet at dawn' })
    expect(authored.state.noteGroups).toHaveLength(1)
    const next = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'SET_INSPIRATION',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        inspired: true
      }
    })
    expect(next.sheet.overview.inspiration).toBe(true)
    stored = await readState()
    const replay = await owner.caller.mutation(execute, { id: character.id.toUpperCase(), command })
    expect(replay.streamVersion).toBe(3)
    expect(replay.sheet).toEqual(next.sheet)
    expect(replay.historyEntry).toEqual(first.historyEntry)
    expect(await readState()).toEqual(stored)
    for (const changed of [
      { ...command, body: 'Changed private plan' },
      { ...command, expectedVersion: 3 },
      {
        type: 'SET_INSPIRATION' as const,
        commandId: command.commandId,
        expectedVersion: 1,
        inspired: false
      }
    ]) {
      await expect(
        owner.caller.mutation(execute, { id: character.id, command: changed })
      ).rejects.toThrow()
    }
    expect(await readState()).toEqual(stored)
  })

  it('rejects anonymous, foreign, stale, unavailable, and unported commands without writes', async () => {
    const { t, owner, other, character, readState } = await fixture()
    const request = {
      id: character.id,
      command: {
        type: 'SET_INSPIRATION' as const,
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        inspired: true
      }
    }
    const before = await readState()
    await expect(t.mutation(execute, request)).rejects.toThrow()
    await expect(other.caller.mutation(execute, request)).rejects.toThrow()
    await expect(
      owner.caller.mutation(execute, { ...request, id: crypto.randomUUID() })
    ).rejects.toThrow()
    await expect(
      owner.caller.mutation(execute, {
        ...request,
        command: { ...request.command, expectedVersion: 0 }
      })
    ).rejects.toThrow()
    await expect(
      owner.caller.mutation(execute, {
        ...request,
        command: {
          type: 'USE_SPELL_SLOT',
          commandId: request.command.commandId,
          expectedVersion: 1,
          slotKey: 'unported-slot'
        }
      })
    ).rejects.toThrow()
    expect(await readState()).toEqual(before)
    await owner.caller.mutation(execute, request)
    const after = await readState()
    await expect(other.caller.mutation(execute, request)).rejects.toThrow()
    await expect(
      owner.caller.mutation(execute, {
        ...request,
        command: { ...request.command, commandId: crypto.randomUUID() }
      })
    ).rejects.toThrow()
    expect(await readState()).toEqual(after)
  })

  it('serializes competing commands and deduplicates concurrent matching replays', async () => {
    const { owner, character, readState } = await fixture()
    const first = {
      id: character.id,
      command: {
        type: 'CREATE_NOTE' as const,
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        title: 'Once',
        groupId: 'session-notes'
      }
    }
    const duplicate = await Promise.all([
      owner.caller.mutation(execute, first),
      owner.caller.mutation(execute, first)
    ])
    expect(duplicate[0]).toEqual(duplicate[1])
    expect((await readState()).receipts).toHaveLength(1)
    const results = await Promise.allSettled(
      [true, false].map((inspired) =>
        owner.caller.mutation(execute, {
          id: character.id,
          command: {
            type: 'SET_INSPIRATION',
            commandId: crypto.randomUUID(),
            expectedVersion: 2,
            inspired
          }
        })
      )
    )
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    const after = await readState()
    expect(after.character?.play.streamVersion).toBe(3)
    expect(after.receipts).toHaveLength(2)
    expect(readCharacterRecord(after.character!).state.notes).toHaveLength(1)
  })

  it('rolls back state and receipt when projection fails after the state write', async () => {
    const { owner, character, readState } = await fixture()
    const before = await readState()
    const original = projection.projectCharacterSheetBundle
    const spy = vi
      .spyOn(projection, 'projectCharacterSheetBundle')
      .mockImplementationOnce(original)
      .mockImplementationOnce(() => {
        throw new Error('Injected post-write projection failure')
      })
    await expect(
      owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'CREATE_NOTE',
          commandId: crypto.randomUUID(),
          expectedVersion: 1,
          title: 'Must roll back',
          groupId: 'session-notes'
        }
      })
    ).rejects.toThrow('Injected post-write projection failure')
    expect(spy).toHaveBeenCalledTimes(2)
    expect(await readState()).toEqual(before)
  })

  it('preserves working drafts but makes their pre-command commit baseline stale after a structural command', async () => {
    const { owner, character, readState } = await fixture()
    const draft = await owner.caller.mutation(api.characters.drafts.create, {
      ...input(),
      id: character.id
    })
    const result = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'CREATE_NOTE_GROUP',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        label: 'Plans'
      }
    })
    expect(result.sheet.meta.hasBuilderDraft).toBe(true)
    expect(await owner.caller.query(api.characters.drafts.get, { id: character.id })).toEqual(draft)
    const after = await readState()
    await expect(
      owner.caller.mutation(api.characters.commit.commit, {
        expectedDraftId: draft.id,
        mode: 'edit',
        character: draft.payload.character
      })
    ).rejects.toThrow('changed')
    expect(await readState()).toEqual(after)
  })

  it('executes note and group edits with group integrity preserved', async () => {
    const { owner, character, readState } = await fixture()
    const groupResult = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'CREATE_NOTE_GROUP',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        label: 'Plans'
      }
    })
    const groupId = groupResult.sheet.notes.groups?.find((group) => group.kind === 'CUSTOM')?.id
    if (!groupId) throw new Error('Missing created custom group')
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'CREATE_NOTE',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        title: 'First',
        groupId
      }
    })
    let stored = await readState()
    const noteId = readCharacterRecord(stored.character!).state.notes?.[0]?.id
    if (!noteId) throw new Error('Missing created note')
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'UPDATE_NOTE_GROUP',
        commandId: crypto.randomUUID(),
        expectedVersion: 3,
        groupId,
        label: 'Next',
        sortOrder: 0
      }
    })
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'UPDATE_NOTE',
        commandId: crypto.randomUUID(),
        expectedVersion: 4,
        noteId,
        title: 'Revised',
        body: 'Private',
        pinned: true
      }
    })
    stored = await readState()
    expect(readCharacterRecord(stored.character!).state.notes?.[0]).toMatchObject({
      id: noteId,
      title: 'Revised',
      body: 'Private',
      pinned: true,
      groupId
    })
    await expect(
      owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'DELETE_NOTE_GROUP',
          commandId: crypto.randomUUID(),
          expectedVersion: 5,
          groupId
        }
      })
    ).rejects.toThrow('Move or delete')
    expect(await readState()).toEqual(stored)
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'DELETE_NOTE',
        commandId: crypto.randomUUID(),
        expectedVersion: 5,
        noteId
      }
    })
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'DELETE_NOTE_GROUP',
        commandId: crypto.randomUUID(),
        expectedVersion: 6,
        groupId
      }
    })
    stored = await readState()
    const final = readCharacterRecord(stored.character!)
    expect(final.state.notes ?? []).toEqual([])
    expect(final.state.noteGroups ?? []).toEqual([])
    expect(stored.receipts).toHaveLength(6)
    expect(stored.character?.play.streamVersion).toBe(7)
  })

  it('rejects corrupted replay history without mutating the aggregate', async () => {
    const { t, owner, character, readState } = await fixture()
    const request = {
      id: character.id,
      command: {
        type: 'SET_INSPIRATION' as const,
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        inspired: true
      }
    }
    await owner.caller.mutation(execute, request)
    const stored = await readState()
    await t.run((ctx) => ctx.db.patch(stored.receipts[0]!._id, { historyJson: '{}' }))
    const corrupted = await readState()
    await expect(owner.caller.mutation(execute, request)).rejects.toThrow()
    expect(await readState()).toEqual(corrupted)
  })
})
