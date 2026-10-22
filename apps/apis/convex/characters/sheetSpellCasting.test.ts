import { readReceiptHeaders } from '../lib/receiptLedgers'
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
import { findResourceByOwner } from '@artificer-toolkit/rules-runtime/character/sheetCommandReducer'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { magicMissile } from '@artificer-toolkit/source-data/srd/spells/magic-missile.js'
import { fireBolt } from '@artificer-toolkit/source-data/srd/spells/fire-bolt.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { api } from '../_generated/api'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { readCharacterRow } from './stateDocuments'

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

const CAST_MODE = {
  LIMITED_USE: 'LIMITED_USE',
  CAST_AT_LEVEL: 'FIXED_LEVEL',
  RITUAL: 'RITUAL'
} as const

async function fixture(attribute: keyof typeof CAST_MODE = 'LIMITED_USE') {
  if (!wizard.spellcasting) throw new Error('Expected canonical Wizard spellcasting.')
  const base = await readyCharacterFixture({
    spellcasting: {
      ...wizard.spellcasting,
      spellLimits: [{ classLevel: 1, slots: [{ spellLevel: 1, slotCount: 2 }], cantripsLimit: 0 }]
    },
    features: [
      {
        id: crypto.randomUUID(),
        label: 'Granted Magic',
        description: '',
        availableAtLevel: 1,
        order: 0,
        grants: {
          spells: [
            {
              id: crypto.randomUUID(),
              grantKind: 'SPELL_GRANT',
              selectionKind: 'GRANTED',
              scalingKind: 'NONE',
              authoringModeKind: 'SELECTED',
              spellIds: [magicMissile.id],
              attributes: [attribute],
              ...(attribute === 'CAST_AT_LEVEL' ? { castAtLevel: 2 } : {}),
              ...(attribute === 'RITUAL'
                ? {}
                : {
                    charges: {
                      id: crypto.randomUUID(),
                      resetKind: 'LONG_REST' as const,
                      limitKind: 'FIXED_AMOUNT' as const,
                      scalingKind: 'NONE' as const,
                      amount: 2
                    }
                  }),
              order: 0
            },
            {
              id: crypto.randomUUID(),
              grantKind: 'SPELL_GRANT',
              selectionKind: 'GRANTED',
              scalingKind: 'NONE',
              authoringModeKind: 'SELECTED',
              spellIds: [fireBolt.id],
              attributes: ['CAST_AT_WILL'],
              order: 1
            }
          ]
        }
      }
    ]
  })
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [magicMissile, fireBolt].map((spell) =>
      importedSubject({
        subjectKind: 'SPELL',
        ...spell,
        document: { ...spell, classIds: [base.baseClass.id] }
      })
    )
  })
  const { draft, character } = await base.createCharacter()
  await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  for (const [type, expectedVersion] of [
    ['SET_KNOWN_SPELLS', 1],
    ['SET_PREPARED_SPELLS', 2]
  ] as const) {
    await base.owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type,
        commandId: crypto.randomUUID(),
        expectedVersion,
        classId: base.baseClass.id,
        spellIds: [magicMissile.id]
      }
    })
  }
  const readState = () =>
    base.t.run(async (ctx) => ({
      character: await readCharacterRow(ctx, character.id),
      receipts: await readReceiptHeaders(
        ctx,
        'characterCommandReceipts',
        await ctx.db
          .query('characterCommandReceipts')
          .withIndex('by_characterId_commandId', (q) => q.eq('characterId', character.id))
          .collect()
      )
    }))
  const sheet = (await base.owner.caller.query(getSheet, { id: character.id }))!
  const spell = sheet.spells.spells.find((entry) => entry.id === magicMissile.id)!
  const classSource = spell.sources!.find((source) => source.source.sourceKind === 'CLASS')!
  const chargedSource = spell.sources!.find((source) => source.castMode === CAST_MODE[attribute])!
  // Only a ritual is paid from no pool.
  if (attribute !== 'RITUAL') expect(chargedSource.resourceOwner).toBeDefined()
  const chargedResourceId = chargedSource.resourceOwner
    ? findResourceByOwner(sheet.resources.items, chargedSource.resourceOwner)!.id
    : undefined
  return { ...base, character, sheet, classSource, chargedSource, chargedResourceId, readState }
}

afterEach(() => vi.restoreAllMocks())

describe('native Character Sheet casting', () => {
  it('requires an unambiguous approved cast, consumes ordinary slots, and leaves cantrips free', async () => {
    const { owner, character, classSource, sheet, readState } = await fixture()
    const before = await readState()
    for (const details of [
      {},
      { sourceId: 'missing-source', slotKey: 'STANDARD:1' },
      { sourceId: classSource.id, slotKey: 'STANDARD:9' },
      { sourceId: classSource.id }
    ]) {
      await expect(
        owner.caller.mutation(execute, {
          id: character.id,
          command: {
            type: 'CAST_SPELL',
            commandId: crypto.randomUUID(),
            expectedVersion: 3,
            spellId: magicMissile.id,
            ...details
          }
        })
      ).rejects.toThrow(/source|approved cast/)
      expect(await readState()).toEqual(before)
    }
    const request: CharacterSheetExecuteInput = {
      id: character.id,
      command: {
        type: 'CAST_SPELL',
        commandId: crypto.randomUUID(),
        expectedVersion: 3,
        spellId: magicMissile.id,
        sourceId: classSource.id,
        slotKey: 'STANDARD:1'
      }
    }
    const first = await owner.caller.mutation(execute, request)
    expect(first).not.toHaveProperty('sheet')
    const firstSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: first.characterId
    }))!
    expect(firstSheet.spells.slots[0]).toMatchObject({ used: 1, remaining: 1 })
    const second = await owner.caller.mutation(execute, {
      ...request,
      command: { ...request.command, commandId: crypto.randomUUID(), expectedVersion: 4 }
    })
    expect(second).not.toHaveProperty('sheet')
    const secondSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: second.characterId
    }))!
    expect(secondSheet.spells.slots[0]).toMatchObject({ used: 2, remaining: 0 })
    const after = await readState()
    await expect(
      owner.caller.mutation(execute, {
        ...request,
        command: { ...request.command, commandId: crypto.randomUUID(), expectedVersion: 5 }
      })
    ).rejects.toThrow(/slot|remaining/)
    expect(await readState()).toEqual(after)
    const cantrip = sheet.spells.spells.find((entry) => entry.id === fireBolt.id)!
    const free = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'CAST_SPELL',
        commandId: crypto.randomUUID(),
        expectedVersion: 5,
        spellId: fireBolt.id,
        sourceId: cantrip.sources!.find((source) => source.source.sourceKind === 'FEATURE')!.id
      }
    })
    expect(free).not.toHaveProperty('sheet')
    const freeSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: free.characterId
    }))!
    expect(freeSheet.spells.slots).toEqual(secondSheet.spells.slots)
    expect(freeSheet.resources).toEqual(secondSheet.resources)
    const beforeReplay = await readState()
    const replay = await owner.caller.mutation(execute, request)
    expect(replay).not.toHaveProperty('sheet')
    const replaySheet = (await owner.caller.query(api.characters.sheet.get, {
      id: replay.characterId
    }))!
    expect(replay.historyEntry).toEqual(first.historyEntry)
    expect(replay.streamVersion).toBe(6)
    expect(replaySheet).toEqual(freeSheet)
    expect(await readState()).toEqual(beforeReplay)
    expect(JSON.parse(beforeReplay.character!.documentJson).intent).toEqual(
      JSON.parse(before.character!.documentJson).intent
    )
  }, 15_000)

  it.each(['LIMITED_USE', 'CAST_AT_LEVEL'] as const)(
    'charges %s casts to their spell-source pool instead of slots',
    async (attribute) => {
      const { owner, character, chargedSource, chargedResourceId, sheet, readState } =
        await fixture(attribute)
      const request: CharacterSheetExecuteInput = {
        id: character.id,
        command: {
          type: 'CAST_SPELL',
          commandId: crypto.randomUUID(),
          expectedVersion: 3,
          spellId: magicMissile.id,
          sourceId: chargedSource.id
        }
      }
      const first = await owner.caller.mutation(execute, request)
      expect(first).not.toHaveProperty('sheet')
      const firstSheet = (await owner.caller.query(api.characters.sheet.get, {
        id: first.characterId
      }))!
      expect(firstSheet.spells.slots).toEqual(sheet.spells.slots)
      expect(
        firstSheet.resources.items.find((resource) => resource.id === chargedResourceId)
      ).toMatchObject({ used: 1, remaining: 1 })
      const second = await owner.caller.mutation(execute, {
        ...request,
        command: { ...request.command, commandId: crypto.randomUUID(), expectedVersion: 4 }
      })
      expect(second).not.toHaveProperty('sheet')
      const secondSheet = (await owner.caller.query(api.characters.sheet.get, {
        id: second.characterId
      }))!
      expect(
        secondSheet.resources.items.find((resource) => resource.id === chargedResourceId)
      ).toMatchObject({ used: 2, remaining: 0 })
      expect(secondSheet.spells.slots).toEqual(sheet.spells.slots)
      const after = await readState()
      await expect(
        owner.caller.mutation(execute, {
          ...request,
          command: { ...request.command, commandId: crypto.randomUUID(), expectedVersion: 5 }
        })
      ).rejects.toThrow(/resource|remaining/i)
      expect(await readState()).toEqual(after)
      const replay = await owner.caller.mutation(execute, request)
      expect(replay).not.toHaveProperty('sheet')
      const replaySheet = (await owner.caller.query(api.characters.sheet.get, {
        id: replay.characterId
      }))!
      expect(replay.historyEntry).toEqual(first.historyEntry)
      expect(replaySheet).toEqual(secondSheet)
      expect(await readState()).toEqual(after)
    }
  )

  it('casts a granted ritual from the Sheet without spending a slot or a use', async () => {
    const { owner, character, chargedSource, sheet } = await fixture('RITUAL')
    expect(chargedSource.resourceOwner).toBeUndefined()
    const cast = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'CAST_SPELL',
        commandId: crypto.randomUUID(),
        expectedVersion: 3,
        spellId: magicMissile.id,
        sourceId: chargedSource.id
      }
    })
    const after = (await owner.caller.query(api.characters.sheet.get, { id: cast.characterId }))!
    expect(after.spells.slots).toEqual(sheet.spells.slots)
    expect(after.resources).toEqual(sheet.resources)
  }, 15_000)

  it('rolls back charged usage and receipt on post-write failure and allows retry', async () => {
    const { owner, character, chargedSource, chargedResourceId, readState } = await fixture()
    const before = await readState()
    const original = projection.projectCharacterSheetBundle
    vi.spyOn(projection, 'projectCharacterSheetBundle')
      .mockImplementationOnce(original)
      .mockImplementationOnce(() => {
        throw new Error('Injected charged cast failure')
      })
    const request: CharacterSheetExecuteInput = {
      id: character.id,
      command: {
        type: 'CAST_SPELL',
        commandId: crypto.randomUUID(),
        expectedVersion: 3,
        spellId: magicMissile.id,
        sourceId: chargedSource.id
      }
    }
    await expect(owner.caller.mutation(execute, request)).rejects.toThrow(
      'Injected charged cast failure'
    )
    expect(await readState()).toEqual(before)
    vi.restoreAllMocks()
    const result = await owner.caller.mutation(execute, request)
    expect(result).not.toHaveProperty('sheet')
    const resultSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: result.characterId
    }))!
    expect(
      resultSheet.resources.items.find((resource) => resource.id === chargedResourceId)
    ).toMatchObject({ used: 1, remaining: 1 })
    expect((await readState()).receipts).toHaveLength(before.receipts.length + 1)
  })
})
