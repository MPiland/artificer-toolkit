import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CharacterHistoryInput,
  CharacterHistoryPage
} from '@artificer-toolkit/schema/api/characterHistory'
import type {
  CharacterSheetCommandResponseDto,
  CharacterSheetExecuteInput,
  CharacterRestPreviewInput,
  CharacterRestPreviewResponseDto
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import type {
  CharacterSheetReadInput,
  CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characterSheetData'
import { encodeCharacterRecord } from '@artificer-toolkit/schema/projections/characterStoredState'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { readCharacterRecord, readCharacterRow } from './stateDocuments'

const list = makeFunctionReference<'query', CharacterHistoryInput, CharacterHistoryPage>(
  'characters/history:list'
)
const execute = makeFunctionReference<
  'mutation',
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
>('characters/sheetCommands:execute')
const preview = makeFunctionReference<
  'query',
  CharacterRestPreviewInput,
  CharacterRestPreviewResponseDto
>('characters/rest:preview')
const getSheet = makeFunctionReference<
  'query',
  CharacterSheetReadInput,
  CharacterSheetResponseDto | null
>('characters/sheet:get')

describe('native personal Character history', () => {
  it('pages exact chronological receipts without writes and denies foreign or anonymous readers', async () => {
    const { t, owner, other, character, committed, readState } = await readySheetFixture()
    const input: CharacterHistoryInput = {
      id: committed.publicId,
      paginationOpts: { cursor: null, numItems: 2 }
    }
    expect(await owner.caller.query(list, input)).toMatchObject({
      characterId: character.id,
      page: [],
      isDone: true
    })
    const entries = []
    for (const expectedVersion of [1, 2, 3]) {
      const response = await owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'SET_INSPIRATION',
          inspired: expectedVersion % 2 === 1,
          expectedVersion,
          commandId: crypto.randomUUID()
        }
      })
      entries.push(response.historyEntry!)
    }
    const before = await readState()
    const first = await owner.caller.query(list, input)
    expect(first.page).toEqual(entries.slice(0, 2))
    expect(first.isDone).toBe(false)
    const second = await owner.caller.query(list, {
      ...input,
      paginationOpts: { ...input.paginationOpts, cursor: first.continueCursor }
    })
    expect(second.page).toEqual(entries.slice(2))
    expect(second.isDone).toBe(true)
    expect(await owner.caller.query(list, { ...input, id: character.id })).toEqual(first)
    await expect(other.caller.query(list, input)).rejects.toThrow('unavailable')
    await expect(t.query(list, input)).rejects.toThrow()
    await expect(owner.caller.query(list, { ...input, id: crypto.randomUUID() })).rejects.toThrow(
      'unavailable'
    )
    for (const numItems of [0, 49])
      await expect(
        owner.caller.query(list, { ...input, paginationOpts: { cursor: null, numItems } })
      ).rejects.toThrow()
    expect(await readState()).toEqual(before)
  })

  it('returns original completed-rest results even when current sources cannot render a Sheet', async () => {
    const { t, owner, character, readState } = await readySheetFixture()
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'ADJUST_HIT_POINTS',
        mode: 'DAMAGE',
        amount: 1,
        expectedVersion: 1,
        commandId: crypto.randomUUID()
      }
    })
    const rest: CharacterRestPreviewInput = {
      id: character.id,
      input: {
        restKind: 'LONG',
        expectedVersion: 2,
        selectedHitDice: [],
        resetMaximumHitPointModifier: false,
        healingMode: 'AUTOMATIC',
        manualHealingAccepted: false,
        selectedCompanionInstanceIds: [],
        requestRoll: false
      }
    }
    const projected = await owner.caller.query(preview, rest)
    const completed = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'COMPLETE_REST',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        restKind: 'LONG',
        previewFingerprint: projected.previewFingerprint,
        selectedHitDice: [],
        resetMaximumHitPointModifier: false,
        healingMode: 'AUTOMATIC',
        manualHealingAccepted: false,
        selectedCompanionInstanceIds: []
      }
    })
    await t.run(async (ctx) => {
      const stored = await readCharacterRow(ctx, character.id)
      if (!stored) throw new Error('Missing Character.')
      const changed = readCharacterRecord(stored)
      changed.state.equipment.inventory[0]!.equipmentId = crypto.randomUUID()
      const encoded = encodeCharacterRecord(stored, {
        document: changed,
        streamVersion: stored.play.streamVersion,
        updatedAt: stored.updatedAt
      })
      await ctx.db.patch(stored._id, {
        documentJson: encoded.documentJson,
        checksum: encoded.checksum
      })
    })
    await expect(owner.caller.query(getSheet, { id: character.id })).rejects.toThrow()
    const before = await readState()
    const history = await owner.caller.query(list, {
      id: character.id,
      paginationOpts: { cursor: null, numItems: 48 }
    })
    expect(history.page).toHaveLength(2)
    expect(history.page[1]).toEqual(completed.historyEntry)
    expect(history.page[1]!.result).toEqual(completed.result)
    expect(await readState()).toEqual(before)
  })

  it('fails closed on receipt checksum/binding corruption and invalid stored Character identity', async () => {
    const { t, owner, character, readState } = await readySheetFixture()
    const response = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'SET_INSPIRATION',
        inspired: true,
        expectedVersion: 1,
        commandId: crypto.randomUUID()
      }
    })
    const original = (await readState()).receipts[0]!
    const input: CharacterHistoryInput = {
      id: character.id,
      paginationOpts: { cursor: null, numItems: 48 }
    }
    for (const changed of [
      { ...response.historyEntry!, eventId: crypto.randomUUID() },
      { ...response.historyEntry!, actorId: 'other-actor' },
      { ...response.historyEntry!, occurredAt: '2020-01-01T00:00:00.000Z' }
    ]) {
      await t.run((ctx) =>
        ctx.db.patch(original._id, {
          historyJson: canonicalizeRuleDocument(changed),
          historyChecksum: checksumRuleDocument(changed)
        })
      )
      const before = await readState()
      await expect(owner.caller.query(list, input)).rejects.toThrow('history identity mismatch')
      expect(await readState()).toEqual(before)
    }
    await t.run((ctx) =>
      ctx.db.patch(original._id, { historyJson: original.historyJson, historyChecksum: 'corrupt' })
    )
    await expect(owner.caller.query(list, input)).rejects.toThrow('history checksum mismatch')
    await t.run(async (ctx) => {
      await ctx.db.patch(original._id, { historyChecksum: original.historyChecksum })
      const stored = await readCharacterRow(ctx, character.id)
      if (!stored) throw new Error('Missing Character.')
      const encoded = encodeCharacterRecord(stored, {
        document: { ...readCharacterRecord(stored), userId: 'other-owner' },
        streamVersion: stored.play.streamVersion,
        updatedAt: stored.updatedAt
      })
      await ctx.db.patch(stored._id, {
        documentJson: encoded.documentJson,
        checksum: encoded.checksum
      })
    })
    await expect(owner.caller.query(list, input)).rejects.toThrow('Character identity mismatch')
  })
})
