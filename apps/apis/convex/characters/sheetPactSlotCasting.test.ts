import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import type {
  CharacterSheetReadInput,
  CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characterSheetData'
import { findResourceByOwner } from '@artificer-toolkit/rules-runtime/character/sheetCommandReducer'
import { warlock } from '@artificer-toolkit/source-data/srd/classes/warlock.js'
import { magicMissile } from '@artificer-toolkit/source-data/srd/spells/magic-missile.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { api } from '../_generated/api'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'

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

/** A Warlock with one level-1 Pact Magic slot and a granted, charged cast of Magic Missile that costs it. */
async function fixture() {
  if (!warlock.spellcasting) throw new Error('Expected canonical Warlock spellcasting.')
  const base = await readyCharacterFixture({
    spellcasting: {
      ...warlock.spellcasting,
      spellLimits: [{ classLevel: 1, slots: [{ spellLevel: 1, slotCount: 1 }], cantripsLimit: 0 }]
    },
    features: [
      {
        id: crypto.randomUUID(),
        label: 'Pact Invocation',
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
              attributes: ['LIMITED_USE'],
              slotCost: { poolCode: 'PACT' },
              charges: {
                id: crypto.randomUUID(),
                resetKind: 'LONG_REST',
                limitKind: 'FIXED_AMOUNT',
                scalingKind: 'NONE',
                amount: 2
              },
              order: 0
            }
          ]
        }
      }
    ]
  })
  await importSeededSubjects(base.t, {
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
  await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  const sheet = (await base.owner.caller.query(getSheet, { id: character.id }))!
  const spell = sheet.spells.spells.find((entry) => entry.id === magicMissile.id)!
  const invocationSource = spell.sources!.find((source) => source.castMode === 'LIMITED_USE')!
  const poolId = findResourceByOwner(sheet.resources.items, invocationSource.resourceOwner!)!.id
  const read = async () => (await base.owner.caller.query(getSheet, { id: character.id }))!
  return { ...base, character, sheet, invocationSource, poolId, read }
}

const pactSlot = (sheet: CharacterSheetResponseDto) =>
  sheet.spells.slots.find((slot) => slot.slotKey === 'PACT')

describe('casting an invocation spell from a Pact Magic slot (SPELLS-31.1)', () => {
  it('spends one pool use and the pact slot together, then refuses once the slot is spent', async () => {
    const { owner, character, sheet, invocationSource, poolId, read } = await fixture()
    expect(pactSlot(sheet)).toMatchObject({ used: 0 })
    const entry = sheet.spells.activeGroups
      .flatMap((group) => group.entries)
      .find((candidate) => candidate.sourceId === invocationSource.id)!
    expect(entry).toMatchObject({ available: true, cast: { slotKey: 'PACT' } })

    const cast = (expectedVersion: number, slotKey: string | undefined) =>
      owner.caller.mutation(execute, {
        id: character.id,
        command: {
          type: 'CAST_SPELL',
          commandId: crypto.randomUUID(),
          expectedVersion,
          spellId: magicMissile.id,
          sourceId: invocationSource.id,
          ...(slotKey ? { slotKey } : {})
        }
      })

    await expect(cast(1, undefined)).rejects.toThrow(/rule-approved cast/i)
    await cast(1, 'PACT')
    const after = await read()
    expect(pactSlot(after)).toMatchObject({ used: 1 })
    expect(after.resources.items.find((resource) => resource.id === poolId)).toMatchObject({
      used: 1,
      remaining: 1
    })

    await expect(cast(2, 'PACT')).rejects.toThrow(/exhausted|rule-approved cast/i)
    const refused = await read()
    expect(pactSlot(refused)).toMatchObject({ used: 1 })
    expect(refused.resources.items.find((resource) => resource.id === poolId)).toMatchObject({
      used: 1,
      remaining: 1
    })
  }, 60_000)
})
