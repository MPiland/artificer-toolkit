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
import { characterSheetStateSchema } from '@artificer-toolkit/schema/projections/characterSheetState'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import * as projection from '@artificer-toolkit/rules-runtime/character/sheetProjection'
import { fireBolt } from '@artificer-toolkit/source-data/srd/spells/fire-bolt.js'
import { acidSplash } from '@artificer-toolkit/source-data/srd/spells/acid-splash.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { api, internal } from '../_generated/api'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { importedSubject } from '../../tests/fixtures/publication'

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
  const base = await readyCharacterFixture({
    features: [
      {
        id: crypto.randomUUID(),
        label: 'Granted Cantrips',
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
              spellIds: [fireBolt.id, acidSplash.id],
              attributes: ['CAST_AT_WILL'],
              castingAbility: 'INTELLIGENCE',
              order: 0
            }
          ]
        }
      }
    ]
  })
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [fireBolt, acidSplash].map((spell) =>
      importedSubject({ subjectKind: 'SPELL', ...spell, document: spell })
    )
  })
  const { draft, character } = await base.createCharacter()
  await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  const sheet = (await base.owner.caller.query(getSheet, { id: character.id }))!
  const spell = sheet.spells.spells.find((entry) => entry.id === fireBolt.id)!
  const source = spell.sources!.find((entry) => entry.source.sourceKind === 'FEATURE')!
  const readState = () =>
    base.t.run(async (ctx) => ({
      character: await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', character.id))
        .unique(),
      receipts: await ctx.db
        .query('characterCommandReceipts')
        .withIndex('by_characterId_commandId', (q) => q.eq('characterId', character.id))
        .collect()
    }))
  const readSheetState = async () =>
    characterSheetStateSchema.parse(
      JSON.parse((await readState()).character!.sheetState!.documentJson)
    )
  return { ...base, character, sheet, source, readState, readSheetState }
}

afterEach(() => vi.restoreAllMocks())

describe('native Character Sheet spell customization', () => {
  it('merges display fields, preserves row identity, replays current presentation, and removes empty customization', async () => {
    const { owner, character, source, readState, readSheetState } = await fixture()
    const before = await readState()
    const request: CharacterSheetExecuteInput = {
      id: character.id,
      command: {
        type: 'UPDATE_SPELL_SOURCE_CUSTOMIZATION',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        source: source.source,
        customName: 'Ember',
        notes: 'First note',
        displayAsAttack: true
      }
    }
    const first = await owner.caller.mutation(execute, request)
    expect(
      first.sheet.spells.spells.find((spell) => spell.id === fireBolt.id)!.sources
    ).toContainEqual(
      expect.objectContaining({
        customName: 'Ember',
        notes: 'First note',
        displayAsAttack: true
      })
    )
    const firstRow = (await readSheetState()).spellCustomizations[0]!
    const updated = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'UPDATE_SPELL_SOURCE_CUSTOMIZATION',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        source: source.source,
        notes: 'Updated note'
      }
    })
    expect((await readSheetState()).spellCustomizations[0]).toMatchObject({
      id: firstRow.id,
      createdAt: firstRow.createdAt,
      createdBy: owner.userId,
      updatedAt: updated.historyEntry!.occurredAt,
      customName: 'Ember',
      notes: 'Updated note',
      displayAsAttack: true
    })
    const beforeReplay = await readState()
    const replay = await owner.caller.mutation(execute, request)
    expect(replay.historyEntry).toEqual(first.historyEntry)
    expect(replay.sheet).toEqual(updated.sheet)
    expect(await readState()).toEqual(beforeReplay)
    const cleared = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'UPDATE_SPELL_SOURCE_CUSTOMIZATION',
        commandId: crypto.randomUUID(),
        expectedVersion: 3,
        source: source.source,
        customName: null,
        notes: null,
        displayAsAttack: false
      }
    })
    expect((await readSheetState()).spellCustomizations).toEqual([])
    const clearedSource = cleared.sheet.spells.spells.find((spell) => spell.id === fireBolt.id)!
      .sources![0]!
    expect(clearedSource.customName).toBeUndefined()
    expect(clearedSource.notes).toBeUndefined()
    expect(clearedSource.displayAsAttack).toBeUndefined()
    expect((await readState()).character!.documentJson).toBe(before.character!.documentJson)
  })

  it('replaces mechanic categories, removes them, and rejects unavailable sources or categories', async () => {
    const { owner, character, source, sheet, readState, readSheetState } = await fixture()
    const initialAttack = sheet.spells.activeGroups
      .flatMap((group) => group.entries)
      .find((entry) => entry.sourceId === source.id)!.mechanics![0]!.attackBonus!
    expect(typeof initialAttack).toBe('number')
    const bonus = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'SET_SPELL_MECHANIC_CUSTOMIZATION',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        source: source.source,
        category: 'TO_HIT',
        mode: 'BONUS',
        value: 2
      }
    })
    expect(
      bonus.sheet.spells.activeGroups
        .flatMap((group) => group.entries)
        .find((entry) => entry.sourceId === source.id)!.mechanics![0]!.attackBonus
    ).toBe(initialAttack + 2)
    const overridden = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'SET_SPELL_MECHANIC_CUSTOMIZATION',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        source: source.source,
        category: 'TO_HIT',
        mode: 'OVERRIDE',
        value: 18
      }
    })
    expect(
      overridden.sheet.spells.activeGroups
        .flatMap((group) => group.entries)
        .find((entry) => entry.sourceId === source.id)!.mechanics![0]!.attackBonus
    ).toBe(18)
    expect((await readSheetState()).adjustments).toEqual([
      expect.objectContaining({ family: 'SPELL', field: 'ATTACK_OVERRIDE', value: 18 })
    ])
    const beforeInvalid = await readState()
    for (const command of [
      {
        type: 'UPDATE_SPELL_SOURCE_CUSTOMIZATION',
        source: { ...source.source, sourceInstanceId: 'missing-source' },
        customName: 'Invalid'
      },
      {
        type: 'SET_SPELL_MECHANIC_CUSTOMIZATION',
        source: source.source,
        category: 'SAVE_DC',
        mode: 'BONUS',
        value: 1
      },
      {
        type: 'SET_SPELL_MECHANIC_CUSTOMIZATION',
        source: source.source,
        category: 'DAMAGE',
        mode: 'OVERRIDE',
        value: 1
      }
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
      ).rejects.toThrow()
      expect(await readState()).toEqual(beforeInvalid)
    }
    const removed = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'REMOVE_SPELL_MECHANIC_CUSTOMIZATION',
        commandId: crypto.randomUUID(),
        expectedVersion: 3,
        source: source.source,
        category: 'TO_HIT'
      }
    })
    expect(
      removed.sheet.spells.activeGroups
        .flatMap((group) => group.entries)
        .find((entry) => entry.sourceId === source.id)!.mechanics![0]!.attackBonus
    ).toBe(initialAttack)
    expect((await readSheetState()).adjustments).toEqual([])
    const saveSource = sheet.spells.spells.find((spell) => spell.id === acidSplash.id)!.sources![0]!
    const initialSave = sheet.spells.activeGroups
      .flatMap((group) => group.entries)
      .find((entry) => entry.sourceId === saveSource.id)!.mechanics![0]!.save!.dc!
    const saveBonus = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'SET_SPELL_MECHANIC_CUSTOMIZATION',
        commandId: crypto.randomUUID(),
        expectedVersion: 4,
        source: saveSource.source,
        category: 'SAVE_DC',
        mode: 'BONUS',
        value: 2
      }
    })
    expect(
      saveBonus.sheet.spells.activeGroups
        .flatMap((group) => group.entries)
        .find((entry) => entry.sourceId === saveSource.id)!.mechanics![0]!.save!.dc
    ).toBe(initialSave + 2)
    const beforeInvalidAttack = await readState()
    await expect(
      owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'SET_SPELL_MECHANIC_CUSTOMIZATION',
          commandId: crypto.randomUUID(),
          expectedVersion: 5,
          source: saveSource.source,
          category: 'TO_HIT',
          mode: 'BONUS',
          value: 1
        }
      })
    ).rejects.toThrow(/not available/)
    expect(await readState()).toEqual(beforeInvalidAttack)
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'SET_SPELL_MECHANIC_CUSTOMIZATION',
        commandId: crypto.randomUUID(),
        expectedVersion: 5,
        source: source.source,
        category: 'DAMAGE',
        mode: 'BONUS',
        value: 3
      }
    })
    expect((await readSheetState()).adjustments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ family: 'SPELL', field: 'DAMAGE_BONUS', value: 3 }),
        expect.objectContaining({ family: 'SPELL', field: 'DC_BONUS', value: 2 })
      ])
    )
  })

  it('rolls back customization and receipt after projection failure and rejects corrupt source identities', async () => {
    const { t, owner, character, source, readState, readSheetState } = await fixture()
    const before = await readState()
    const original = projection.projectCharacterSheetBundle
    vi.spyOn(projection, 'projectCharacterSheetBundle')
      .mockImplementationOnce(original)
      .mockImplementationOnce(() => {
        throw new Error('Injected customization failure')
      })
    const request: CharacterSheetExecuteInput = {
      id: character.id,
      command: {
        type: 'UPDATE_SPELL_SOURCE_CUSTOMIZATION',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        source: source.source,
        customName: 'Ember'
      }
    }
    await expect(owner.caller.mutation(execute, request)).rejects.toThrow(
      'Injected customization failure'
    )
    expect(await readState()).toEqual(before)
    vi.restoreAllMocks()
    await owner.caller.mutation(execute, request)
    const state = await readSheetState()
    const stored = (await readState()).character!
    const row = state.spellCustomizations[0]!
    for (const spellCustomizations of [
      [{ ...row, characterId: crypto.randomUUID() }],
      [row, { ...row, id: crypto.randomUUID() }]
    ]) {
      const invalid = { ...state, spellCustomizations }
      await t.run((ctx) =>
        ctx.db.patch(stored._id, {
          sheetState: {
            documentJson: canonicalizeRuleDocument(invalid),
            checksum: checksumRuleDocument(invalid)
          }
        })
      )
      const beforeInvalid = await readState()
      await expect(owner.caller.query(getSheet, { id: character.id })).rejects.toThrow(
        /ownership|unique/
      )
      await expect(owner.caller.mutation(execute, request)).rejects.toThrow(/ownership|unique/)
      expect(await readState()).toEqual(beforeInvalid)
    }
  })
})
