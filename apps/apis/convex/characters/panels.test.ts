import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CharacterSheetPanelDto,
  CharacterSheetPanelInput,
  CharacterSheetPanelTargetDto
} from '@artificer-toolkit/schema/api/characterSheetPanel'
import type {
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import type {
  CharacterSheetReadInput,
  CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characterSheetData'
import { cat } from '@artificer-toolkit/source-data/srd/creatures/cat.js'
import { rowboat } from '@artificer-toolkit/source-data/srd/vehicles/rowboat.js'
import { fireBolt } from '@artificer-toolkit/source-data/srd/spells/fire-bolt.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { readyCharacterFixture, readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { importedSubject } from '../../tests/fixtures/publication'
import { api, internal } from '../_generated/api'

const panel = makeFunctionReference<'query', CharacterSheetPanelInput, CharacterSheetPanelDto>(
  'characters/panels:get'
)
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

describe('native personal Sheet inspector panels', () => {
  it('reads current owner panels and calculation updates without changing Character state', async () => {
    const { t, owner, other, character, committed, readState } = await readySheetFixture()
    const sheet = (await owner.caller.query(getSheet, { id: character.id }))!
    const targets: CharacterSheetPanelTargetDto[] = [
      { kind: 'ABILITY', ability: 'STRENGTH' },
      { kind: 'SAVING_THROW', ability: 'DEXTERITY' },
      { kind: 'SKILL', skillId: sheet.overview.skills[0]!.skillId },
      { kind: 'SKILLS' },
      { kind: 'SENSES' },
      { kind: 'MOVEMENT' },
      { kind: 'DEFENSES' },
      { kind: 'PROFICIENCIES' },
      { kind: 'SPELLS' },
      { kind: 'EXTRAS' },
      { kind: 'ITEM', itemInstanceId: sheet.inventory.items[0]!.id }
    ]
    const before = await readState()
    for (const target of targets) {
      const result = await owner.caller.query(panel, { id: committed.publicId, target })
      expect(result).toMatchObject({
        kind: target.kind,
        target,
        characterId: character.id,
        editable: target.kind !== 'SKILLS'
      })
      expect(result.title.length).toBeGreaterThan(0)
      if (result.kind === 'ABILITY')
        expect(result.scoreCalculation.effective).toBe(
          sheet.overview.abilities.find((ability) => ability.ability === result.ability)!.score
        )
      if (result.kind === 'SAVING_THROW')
        expect(result.calculation.effective).toBe(
          sheet.overview.savingThrows.find((save) => save.ability === result.ability)!.total
        )
      if (result.kind === 'SKILL')
        expect(result.calculation.effective).toBe(sheet.overview.skills[0]!.total)
    }
    await expect(
      other.caller.query(panel, { id: character.id, target: targets[0]! })
    ).rejects.toThrow('unavailable')
    await expect(t.query(panel, { id: character.id, target: targets[0]! })).rejects.toThrow()
    for (const target of [
      { kind: 'ITEM', itemInstanceId: crypto.randomUUID() },
      { kind: 'SKILL', skillId: crypto.randomUUID() },
      { kind: 'COMPANION', companionInstanceId: crypto.randomUUID() },
      { kind: 'VEHICLE', vehicleInstanceId: crypto.randomUUID() },
      { kind: 'HIT_POINTS' },
      { kind: 'BACKGROUND' }
    ] satisfies CharacterSheetPanelTargetDto[])
      await expect(owner.caller.query(panel, { id: character.id, target })).rejects.toThrow()
    expect(await readState()).toEqual(before)
    const updated = await owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'UPSERT_SHEET_ADJUSTMENT',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        adjustment: { family: 'ABILITY', ability: 'STRENGTH', field: 'SCORE_OVERRIDE', value: 18 }
      }
    })
    const afterCommand = await readState()
    expect(
      await owner.caller.query(panel, { id: character.id, target: targets[0]! })
    ).toMatchObject({
      kind: 'ABILITY',
      state: 'OVERRIDDEN',
      score: 18,
      scoreCalculation: { effective: 18 },
      editors: expect.arrayContaining([
        expect.objectContaining({ field: 'SCORE_OVERRIDE', value: 18 })
      ])
    })
    expect(
      updated.sheet.overview.abilities.find((ability) => ability.ability === 'STRENGTH')!.score
    ).toBe(18)
    expect(await readState()).toEqual(afterCommand)
  })

  it('resolves exact current spell, resource, companion and vehicle owners', async () => {
    const base = await readyCharacterFixture({
      resources: {
        id: crypto.randomUUID(),
        label: 'Panel Resource',
        order: 0,
        availableAtLevel: 1,
        charges: {
          id: crypto.randomUUID(),
          resetKind: 'SHORT_REST',
          limitKind: 'FIXED_AMOUNT',
          scalingKind: 'NONE',
          amount: 2
        }
      },
      features: [
        {
          id: crypto.randomUUID(),
          label: 'Panel Magic',
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
                spellIds: [fireBolt.id],
                attributes: ['CAST_AT_WILL'],
                order: 0
              }
            ]
          }
        }
      ]
    })
    await base.t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [
        importedSubject({ subjectKind: 'CREATURE', ...cat, document: cat }),
        importedSubject({ subjectKind: 'VEHICLE', ...rowboat, document: rowboat }),
        importedSubject({
          subjectKind: 'SPELL',
          ...fireBolt,
          document: { ...fireBolt, classIds: [base.baseClass.id] }
        })
      ]
    })
    const { draft, character } = await base.createCharacter()
    await base.owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: draft.id,
      mode: 'create',
      character
    })
    await base.owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'ADD_SHEET_EXTRA',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        extra: { kind: 'COMPANION', creatureId: cat.id, originKind: 'WORLD' }
      }
    })
    const current = await base.owner.caller.mutation(execute, {
      id: character.id,
      command: {
        type: 'ADD_SHEET_EXTRA',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        extra: { kind: 'VEHICLE', vehicleId: rowboat.id }
      }
    })
    const spell = current.sheet.spells.spells.find((entry) => entry.id === fireBolt.id)!
    const spellSource = spell.sources![0]!.source
    const resource = current.sheet.resources.items.find(
      (entry) => entry.label === 'Panel Resource'
    )!
    const companion = current.sheet.extras.items.find((entry) => entry.kind !== 'VEHICLE')!
    const vehicle = current.sheet.extras.items.find((entry) => entry.kind === 'VEHICLE')!
    const targets: CharacterSheetPanelTargetDto[] = [
      { kind: 'SPELL', source: spellSource },
      { kind: 'RESOURCE', owner: resource.owner },
      { kind: 'COMPANION', companionInstanceId: companion.id },
      { kind: 'VEHICLE', vehicleInstanceId: vehicle.id }
    ]
    for (const target of targets) {
      const result = await base.owner.caller.query(panel, { id: character.id, target })
      expect(result).toMatchObject({
        kind: target.kind,
        target,
        characterId: character.id,
        editable: true
      })
      if (result.kind === 'SPELL')
        expect(result).toMatchObject({ spellId: fireBolt.id, authoredName: fireBolt.label })
      if (result.kind === 'RESOURCE')
        expect(result).toMatchObject({
          maximum: resource.max,
          used: resource.used,
          remaining: resource.remaining
        })
      if (result.kind === 'COMPANION')
        expect(result).toMatchObject({ creatureId: cat.id, hitPoints: companion.hitPoints })
      if (result.kind === 'VEHICLE')
        expect(result).toMatchObject({ vehicleId: rowboat.id, displayName: vehicle.displayName })
    }
    await expect(
      base.owner.caller.query(panel, {
        id: character.id,
        target: { kind: 'SPELL', source: { ...spellSource, sourceInstanceId: 'foreign-source' } }
      })
    ).rejects.toThrow()
    await expect(
      base.other.caller.query(panel, { id: character.id, target: targets[0]! })
    ).rejects.toThrow('unavailable')
    expect(await base.owner.caller.query(getSheet, { id: character.id })).toEqual(current.sheet)
  })
})
