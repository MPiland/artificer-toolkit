import { makeFunctionReference } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import type {
  CharacterSheetReadInput,
  CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characterSheetData'
import * as projection from '@artificer-toolkit/rules-runtime/character/sheetProjection'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { api } from '../_generated/api'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { readCharacterRecord, readCharacterRow } from './stateDocuments'

const execute = makeFunctionReference<
  'mutation',
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
>('characters/sheetCommands:execute')
const getSheet = makeFunctionReference<
  'query',
  CharacterSheetReadInput,
  CharacterSheetResponseDto | null
>('characters/sheet:get')

async function fixture() {
  if (!wizard.spellcasting) throw new Error('Expected canonical Wizard spellcasting.')
  const base = await readyCharacterFixture({
    spellcasting: {
      ...wizard.spellcasting,
      spellLimits: [{ classLevel: 1, slots: [{ spellLevel: 1, slotCount: 2 }], cantripsLimit: 0 }]
    }
  })
  const { draft, character } = await base.createCharacter()
  await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  const readState = () =>
    base.t.run(async (ctx) => ({
      character: await readCharacterRow(ctx, character.id),
      receipts: await ctx.db
        .query('characterCommandReceipts')
        .withIndex('by_characterId_commandId', (q) => q.eq('characterId', character.id))
        .collect()
    }))
  const sheet = await base.owner.caller.query(getSheet, { id: character.id })
  expect(sheet!.spells.slots).toContainEqual(
    expect.objectContaining({
      slotKey: 'STANDARD:1',
      max: 2,
      used: 0,
      remaining: 2
    })
  )
  return { ...base, character, readState }
}

afterEach(() => vi.restoreAllMocks())

describe('native Character Sheet spell slots', () => {
  it('consumes and restores current slots, rejects unavailable slots, and replays without consuming twice', async () => {
    const { owner, character, readState } = await fixture()
    const before = await readState()
    const request: CharacterSheetExecuteInput = {
      id: character.id,
      command: {
        type: 'USE_SPELL_SLOT',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        slotKey: 'STANDARD:1'
      }
    }
    const first = await owner.caller.mutation(execute, request)
    expect(first.sheet.spells.slots[0]).toMatchObject({ used: 1, remaining: 1 })
    const second = await owner.caller.mutation(execute, {
      ...request,
      command: { ...request.command, commandId: crypto.randomUUID(), expectedVersion: 2 }
    })
    expect(second.sheet.spells.slots[0]).toMatchObject({ used: 2, remaining: 0 })
    const after = await readState()
    expect(readCharacterRecord(after.character!).intent).toEqual(
      readCharacterRecord(before.character!).intent
    )
    expect(readCharacterRecord(after.character!).state.spellSlots).toEqual([
      { slotKey: 'STANDARD:1', used: 2 }
    ])
    for (const command of [
      { type: 'USE_SPELL_SLOT', slotKey: 'STANDARD:1' },
      { type: 'USE_SPELL_SLOT', slotKey: 'STANDARD:9' },
      { type: 'RESTORE_SPELL_SLOT', slotKey: 'STANDARD:9' }
    ] as const) {
      await expect(
        owner.caller.mutation(execute, {
          id: character.id,
          command: {
            ...command,
            commandId: crypto.randomUUID(),
            expectedVersion: 3
          }
        })
      ).rejects.toThrow(/remaining|available/)
      expect(await readState()).toEqual(after)
    }
    const replay = await owner.caller.mutation(execute, request)
    expect(replay.historyEntry).toEqual(first.historyEntry)
    expect(replay.streamVersion).toBe(3)
    expect(replay.sheet.spells.slots[0]).toMatchObject({ used: 2, remaining: 0 })
    expect(await readState()).toEqual(after)
    for (const [expectedVersion, all, remaining] of [
      [3, false, 1],
      [4, true, 2],
      [5, false, 2]
    ] as const) {
      const restored = await owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'RESTORE_SPELL_SLOT',
          commandId: crypto.randomUUID(),
          expectedVersion,
          slotKey: 'STANDARD:1',
          all
        }
      })
      expect(restored.sheet.spells.slots[0]).toMatchObject({ used: 2 - remaining, remaining })
    }
    expect(readCharacterRecord((await readState()).character!).state.spellSlots).toBeUndefined()
  })

  it('rolls back slot usage, version, and receipt when the post-write projection fails', async () => {
    const { owner, character, readState } = await fixture()
    const before = await readState()
    const original = projection.projectCharacterSheetBundle
    vi.spyOn(projection, 'projectCharacterSheetBundle')
      .mockImplementationOnce(original)
      .mockImplementationOnce(() => {
        throw new Error('Injected slot projection failure')
      })
    const request: CharacterSheetExecuteInput = {
      id: character.id,
      command: {
        type: 'USE_SPELL_SLOT',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        slotKey: 'STANDARD:1'
      }
    }
    await expect(owner.caller.mutation(execute, request)).rejects.toThrow(
      'Injected slot projection failure'
    )
    expect(await readState()).toEqual(before)
    vi.restoreAllMocks()
    const result = await owner.caller.mutation(execute, request)
    expect(result.sheet.spells.slots[0]).toMatchObject({ used: 1, remaining: 1 })
    expect((await readState()).receipts).toHaveLength(1)
  })
})
