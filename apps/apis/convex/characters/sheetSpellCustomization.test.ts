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
import type {
  CharacterSheetPanelDto,
  CharacterSheetPanelInput
} from '@artificer-toolkit/schema/api/characterSheetPanel'
import { readCharacterSheetState } from '@artificer-toolkit/schema/projections/characterStoredState'
import * as projection from '@artificer-toolkit/rules-runtime/character/sheetProjection'
import { fireBolt } from '@artificer-toolkit/source-data/srd/spells/fire-bolt.js'
import { acidSplash } from '@artificer-toolkit/source-data/srd/spells/acid-splash.js'
import { magicMissile } from '@artificer-toolkit/source-data/srd/spells/magic-missile.js'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { api, internal } from '../_generated/api'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { importedSubject } from '../../tests/fixtures/publication'
import { writeCharacterRecord } from '../../tests/fixtures/characterRecords'
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
const getPanel = makeFunctionReference<'query', CharacterSheetPanelInput, CharacterSheetPanelDto>(
  'characters/panels:get'
)

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
  const readSheetState = async () => readCharacterSheetState((await readState()).character!)
  return { ...base, character, sheet, source, readState, readSheetState }
}

afterEach(() => vi.restoreAllMocks())

describe('native Character Sheet spell customization', () => {
  it('customizes and restores an unlearned, unprepared full-list Spell through its inspector', async () => {
    if (!wizard.spellcasting) throw new Error('Expected canonical Wizard spellcasting.')
    const base = await readyCharacterFixture({
      spellcasting: {
        ...wizard.spellcasting,
        attributes: ['PREPARES_SPELLS'],
        spellLimits: [{ classLevel: 1, slots: [{ spellLevel: 1, slotCount: 2 }], cantripsLimit: 0 }]
      }
    })
    await base.t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [
        importedSubject({
          subjectKind: 'SPELL',
          ...magicMissile,
          document: { ...magicMissile, classIds: [base.baseClass.id] }
        })
      ]
    })
    const { draft, character } = await base.createCharacter()
    const committed = await base.owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: draft.id,
      mode: 'create',
      character
    })
    const spells = await base.owner.caller.query(getPanel, {
      id: committed.publicId,
      target: { kind: 'SPELLS' }
    })
    if (spells.kind !== 'SPELLS') throw new Error('Expected spells panel.')
    const source = spells.groups
      .flatMap((group) => group.sources)
      .find((candidate) => candidate.spellId === magicMissile.id)
    if (!source) throw new Error('Expected unprepared full-list Spell source.')
    expect(source).toMatchObject({ known: false, prepared: false, canManageKnown: false })
    const readPanel = async () => {
      const panel = await base.owner.caller.query(getPanel, {
        id: committed.publicId,
        target: { kind: 'SPELL', source: source.source }
      })
      if (panel.kind !== 'SPELL') throw new Error('Expected spell inspector.')
      return panel
    }
    const initial = await readPanel()
    expect(initial.allowedCommands).toEqual(
      expect.arrayContaining([
        'SET_SPELL_MECHANIC_CUSTOMIZATION',
        'REMOVE_SPELL_MECHANIC_CUSTOMIZATION'
      ])
    )
    expect(initial.customizationOptions).toEqual([
      { category: 'DAMAGE', label: 'Damage', supportedModes: ['BONUS'] }
    ])
    expect(initial.effects).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: 'Damage' })])
    )
    expect(initial.calculations.damageBonus).toBeUndefined()
    const before = await base.t.run((ctx) => readCharacterRow(ctx, character.id))
    const customized = await base.owner.caller.mutation(execute, {
      id: committed.publicId,
      command: {
        type: 'SET_SPELL_MECHANIC_CUSTOMIZATION',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        source: source.source,
        category: 'DAMAGE',
        mode: 'BONUS',
        value: 3
      }
    })
    expect(customized).toMatchObject({ characterId: character.id, streamVersion: 2 })
    expect(customized).not.toHaveProperty('sheet')
    const changed = await readPanel()
    expect(changed).toMatchObject({ known: false, prepared: false })
    expect(changed.calculations.damageBonus!.effective).toBe(3)
    expect(changed.effects).not.toEqual(initial.effects)
    expect(changed.customizationOptions[0]!.configured).toMatchObject({ mode: 'BONUS', value: 3 })
    const removed = await base.owner.caller.mutation(execute, {
      id: committed.publicId,
      command: {
        type: 'REMOVE_SPELL_MECHANIC_CUSTOMIZATION',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        source: source.source,
        category: 'DAMAGE'
      }
    })
    expect(removed).toMatchObject({ characterId: character.id, streamVersion: 3 })
    expect(removed).not.toHaveProperty('sheet')
    const restored = await readPanel()
    expect(restored).toMatchObject({ known: false, prepared: false })
    expect(restored.calculations.damageBonus).toBeUndefined()
    expect(restored.effects).toEqual(initial.effects)
    expect(restored.customizationOptions).toEqual(initial.customizationOptions)
    const after = await base.t.run((ctx) => readCharacterRow(ctx, character.id))
    const beforeCharacter = readCharacterRecord(before!)
    const afterCharacter = readCharacterRecord(after!)
    expect(afterCharacter.intent).toEqual(beforeCharacter.intent)
    expect(afterCharacter.state).toEqual(beforeCharacter.state)
    expect(afterCharacter.intent.spellSelections ?? []).toEqual([])
    expect(
      afterCharacter.state.classes?.flatMap((classState) => classState.spells?.prepared ?? []) ?? []
    ).toEqual([])
    expect(readCharacterSheetState(after!).adjustments).toEqual([])
  })

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
    expect(first).not.toHaveProperty('sheet')
    const firstSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: first.characterId
    }))!
    expect(
      firstSheet.spells.spells.find((spell) => spell.id === fireBolt.id)!.sources
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
    expect(updated).not.toHaveProperty('sheet')
    const updatedSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: updated.characterId
    }))!
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
    expect(replay).not.toHaveProperty('sheet')
    const replaySheet = (await owner.caller.query(api.characters.sheet.get, {
      id: replay.characterId
    }))!
    expect(replay.historyEntry).toEqual(first.historyEntry)
    expect(replaySheet).toEqual(updatedSheet)
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
    expect(cleared).not.toHaveProperty('sheet')
    const clearedSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: cleared.characterId
    }))!
    expect((await readSheetState()).spellCustomizations).toEqual([])
    const clearedSource = clearedSheet.spells.spells.find((spell) => spell.id === fireBolt.id)!
      .sources![0]!
    expect(clearedSource.customName).toBeUndefined()
    expect(clearedSource.notes).toBeUndefined()
    expect(clearedSource.displayAsAttack).toBeUndefined()
    const beforeCharacter = readCharacterRecord(before.character!)
    const afterCharacter = readCharacterRecord((await readState()).character!)
    expect(afterCharacter.intent).toEqual(beforeCharacter.intent)
    expect(afterCharacter.state).toEqual(beforeCharacter.state)
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
    expect(bonus).not.toHaveProperty('sheet')
    const bonusSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: bonus.characterId
    }))!
    expect(
      bonusSheet.spells.activeGroups
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
    expect(overridden).not.toHaveProperty('sheet')
    const overriddenSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: overridden.characterId
    }))!
    expect(
      overriddenSheet.spells.activeGroups
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
    expect(removed).not.toHaveProperty('sheet')
    const removedSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: removed.characterId
    }))!
    expect(
      removedSheet.spells.activeGroups
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
    expect(saveBonus).not.toHaveProperty('sheet')
    const saveBonusSheet = (await owner.caller.query(api.characters.sheet.get, {
      id: saveBonus.characterId
    }))!
    expect(
      saveBonusSheet.spells.activeGroups
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
    const row = state.spellCustomizations[0]!
    for (const spellCustomizations of [
      [{ ...row, characterId: crypto.randomUUID() }],
      [row, { ...row, id: crypto.randomUUID() }]
    ]) {
      const invalid = { ...state, spellCustomizations }
      await t.run(async (ctx) => {
        const stored = await readCharacterRow(ctx, character.id)
        if (!stored) throw new Error('Missing Character customization fixture.')
        await writeCharacterRecord(ctx, stored, {
          document: readCharacterRecord(stored),
          sheetState: invalid
        })
      })
      const beforeInvalid = await readState()
      await expect(owner.caller.query(getSheet, { id: character.id })).rejects.toThrow(
        /ownership|unique/
      )
      await expect(owner.caller.mutation(execute, request)).rejects.toThrow(/ownership|unique/)
      expect(await readState()).toEqual(beforeInvalid)
    }
  })
})
