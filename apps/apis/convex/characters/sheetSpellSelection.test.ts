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
import { magicMissile } from '@artificer-toolkit/source-data/srd/spells/magic-missile.js'
import { shield } from '@artificer-toolkit/source-data/srd/spells/shield.js'
import { detectMagic } from '@artificer-toolkit/source-data/srd/spells/detect-magic.js'
import { shieldOfFaith } from '@artificer-toolkit/source-data/srd/spells/shield-of-faith.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { api, internal } from '../_generated/api'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { importedSubject } from '../../tests/fixtures/publication'
import * as builderContext from './builderContext'

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

async function fixture(usesSpellbook = true) {
  if (!wizard.spellcasting) throw new Error('Expected canonical Wizard spellcasting.')
  const base = await readyCharacterFixture({
    spellcasting: {
      ...wizard.spellcasting,
      attributes: usesSpellbook ? ['PREPARES_SPELLS', 'USES_SPELLBOOK'] : ['PREPARES_SPELLS'],
      spellLimits: [
        {
          classLevel: 1,
          slots: [{ spellLevel: 1, slotCount: 2 }],
          cantripsLimit: 0
        }
      ]
    }
  })
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      ...[magicMissile, shield, detectMagic].map((spell) =>
        importedSubject({
          subjectKind: 'SPELL',
          ...spell,
          document: { ...spell, classIds: [base.baseClass.id] }
        })
      ),
      importedSubject({
        subjectKind: 'SPELL',
        ...shieldOfFaith,
        document: shieldOfFaith
      })
    ]
  })
  const { draft, character } = await base.createCharacter()
  await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
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
  return { ...base, character, readState }
}

afterEach(() => vi.restoreAllMocks())

describe('native Character Sheet spell selection', () => {
  it('uses current known/prepared eligibility, preserves Builder intent, and replays the original receipt with current state', async () => {
    const { owner, baseClass, character, readState } = await fixture()
    const before = await readState()
    const initial = await owner.caller.query(getSheet, { id: character.id })
    expect(initial!.spells.spells.map((spell) => spell.id)).toContain(magicMissile.id)
    expect(initial!.spells.spells.find((spell) => spell.id === magicMissile.id)!.mechanics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outcomes: expect.arrayContaining([expect.objectContaining({ kind: 'DAMAGE' })])
        })
      ])
    )
    const prepare: CharacterSheetExecuteInput = {
      id: character.id,
      command: {
        type: 'SET_PREPARED_SPELLS',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        classId: baseClass.id,
        spellIds: [magicMissile.id]
      }
    }
    await expect(owner.caller.mutation(execute, prepare)).rejects.toThrow(/not available/)
    expect(await readState()).toEqual(before)
    const known: CharacterSheetExecuteInput = {
      id: character.id,
      command: {
        type: 'SET_KNOWN_SPELLS',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        classId: baseClass.id,
        spellIds: [magicMissile.id, shield.id, detectMagic.id, magicMissile.id]
      }
    }
    const sourceLoads = vi.spyOn(builderContext, 'loadCharacterBuilderContext')
    const learned = await owner.caller.mutation(execute, known)
    expect(sourceLoads).toHaveBeenCalledTimes(1)
    expect(learned.streamVersion).toBe(2)
    expect(learned.sheet).toEqual(await owner.caller.query(getSheet, { id: character.id }))
    const afterKnown = await readState()
    for (const command of [
      {
        type: 'SET_KNOWN_SPELLS',
        classId: baseClass.id,
        spellIds: [shieldOfFaith.id]
      },
      {
        type: 'SET_PREPARED_SPELLS',
        classId: baseClass.id,
        spellIds: [magicMissile.id, shield.id, detectMagic.id]
      },
      {
        type: 'SET_PREPARED_SPELLS',
        classId: baseClass.id,
        spellIds: [shieldOfFaith.id]
      },
      { type: 'SET_KNOWN_SPELLS', classId: crypto.randomUUID(), spellIds: [] },
      {
        type: 'SET_PREPARED_SPELLS',
        classId: crypto.randomUUID(),
        spellIds: []
      }
    ] as const) {
      await expect(
        owner.caller.mutation(execute, {
          id: character.id,
          command: {
            ...command,
            spellIds: [...command.spellIds],
            commandId: crypto.randomUUID(),
            expectedVersion: 2
          }
        })
      ).rejects.toThrow(/not available|prepare up to|not on/)
      expect(await readState()).toEqual(afterKnown)
    }
    sourceLoads.mockClear()
    const prepared = await owner.caller.mutation(execute, {
      ...prepare,
      command: {
        ...prepare.command,
        type: 'SET_PREPARED_SPELLS',
        classId: baseClass.id,
        expectedVersion: 2,
        spellIds: [magicMissile.id, magicMissile.id]
      }
    })
    expect(sourceLoads).toHaveBeenCalledTimes(1)
    expect(prepared.sheet.spells.preparationSources).toContainEqual(
      expect.objectContaining({
        classId: baseClass.id,
        preparedSpellLimit: 2,
        preparedSpellIds: [magicMissile.id]
      })
    )
    expect(prepared.sheet).toEqual(await owner.caller.query(getSheet, { id: character.id }))
    const after = await readState()
    const stored = JSON.parse(after.character!.documentJson)
    expect(stored.intent).toEqual(JSON.parse(before.character!.documentJson).intent)
    expect(stored.state.classes).toEqual([
      {
        classId: baseClass.id,
        spells: {
          learned: [magicMissile.id, shield.id, detectMagic.id],
          prepared: [magicMissile.id]
        }
      }
    ])
    const replay = await owner.caller.mutation(execute, known)
    expect(replay.historyEntry).toEqual(learned.historyEntry)
    expect(replay.streamVersion).toBe(3)
    expect(replay.sheet).toEqual(prepared.sheet)
    expect(await readState()).toEqual(after)
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'SET_PREPARED_SPELLS',
        commandId: crypto.randomUUID(),
        expectedVersion: 3,
        classId: baseClass.id,
        spellIds: []
      }
    })
    expect(JSON.parse((await readState()).character!.documentJson).state.classes[0].spells).toEqual(
      {
        learned: [magicMissile.id, shield.id, detectMagic.id]
      }
    )
    await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'SET_KNOWN_SPELLS',
        commandId: crypto.randomUUID(),
        expectedVersion: 4,
        classId: baseClass.id,
        spellIds: []
      }
    })
    expect(JSON.parse((await readState()).character!.documentJson).state.classes[0].spells).toEqual(
      { learned: [] }
    )
  })

  it('does not confuse a full-list preparation source with a known-spell source', async () => {
    const { owner, baseClass, character, readState } = await fixture(false)
    const before = await readState()
    await expect(
      owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'SET_KNOWN_SPELLS',
          commandId: crypto.randomUUID(),
          expectedVersion: 1,
          classId: baseClass.id,
          spellIds: [magicMissile.id]
        }
      })
    ).rejects.toThrow(/not available/)
    expect(await readState()).toEqual(before)
    const prepared = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'SET_PREPARED_SPELLS',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        classId: baseClass.id,
        spellIds: [magicMissile.id]
      }
    })
    expect(prepared.sheet.spells.preparationSources).toContainEqual(
      expect.objectContaining({
        classId: baseClass.id,
        preparedSpellIds: [magicMissile.id]
      })
    )
  })

  it('rolls back learned state and receipts if projecting newly selected spells fails', async () => {
    const { owner, baseClass, character, readState } = await fixture()
    const before = await readState()
    const original = projection.projectCharacterSheetBundle
    vi.spyOn(projection, 'projectCharacterSheetBundle')
      .mockImplementationOnce(original)
      .mockImplementationOnce(() => {
        throw new Error('Injected spell selection failure')
      })
    const request: CharacterSheetExecuteInput = {
      id: character.id,
      command: {
        type: 'SET_KNOWN_SPELLS',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        classId: baseClass.id,
        spellIds: [magicMissile.id]
      }
    }
    await expect(owner.caller.mutation(execute, request)).rejects.toThrow(
      'Injected spell selection failure'
    )
    expect(await readState()).toEqual(before)
    vi.restoreAllMocks()
    const result = await owner.caller.mutation(execute, request)
    expect(result.streamVersion).toBe(2)
    expect((await readState()).receipts).toHaveLength(1)
  })
})
