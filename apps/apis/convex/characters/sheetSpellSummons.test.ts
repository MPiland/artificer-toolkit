import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import { characterSheetCommandInputDtoSchema } from '@artificer-toolkit/schema/api/characterSheetCommandInputs'
import type {
  CharacterSheetReadInput,
  CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characterSheetData'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { arcaneHand } from '@artificer-toolkit/source-data/srd/spells/arcane-hand.js'
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

/** A Wizard with Arcane Hand prepared and five 5th-level slots, cast outside any Encounter. */
async function fixture() {
  if (!wizard.spellcasting) throw new Error('Expected canonical Wizard spellcasting.')
  const base = await readyCharacterFixture({
    spellcasting: {
      ...wizard.spellcasting,
      spellLimits: [{ classLevel: 1, slots: [{ spellLevel: 5, slotCount: 5 }], cantripsLimit: 0 }]
    }
  })
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({
        subjectKind: 'SPELL',
        ...arcaneHand,
        document: { ...arcaneHand, classIds: [base.baseClass.id] }
      })
    ]
  })
  const { draft, character } = await base.createCharacter()
  await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  let version = 1
  const run = async (command: Record<string, unknown>) => {
    const result = await base.owner.caller.mutation(execute, {
      id: character.id,
      command: characterSheetCommandInputDtoSchema.parse({
        ...command,
        commandId: crypto.randomUUID(),
        expectedVersion: version
      })
    })
    version = result.streamVersion
    return (await base.owner.caller.query(getSheet, { id: character.id }))!
  }
  for (const type of ['SET_KNOWN_SPELLS', 'SET_PREPARED_SPELLS'])
    await run({ type, classId: base.baseClass.id, spellIds: [arcaneHand.id] })
  const sheet = (await base.owner.caller.query(getSheet, { id: character.id }))!
  const source = sheet.spells.spells
    .find((entry) => entry.id === arcaneHand.id)!
    .sources!.find((entry) => entry.source.sourceKind === 'CLASS')!
  const cast = () =>
    run({ type: 'CAST_SPELL', spellId: arcaneHand.id, sourceId: source.id, slotKey: 'STANDARD:5' })
  const rest = async (restKind: 'SHORT' | 'LONG') => {
    const input = {
      restKind,
      expectedVersion: version,
      selectedHitDice: [],
      resetMaximumHitPointModifier: false,
      healingMode: 'AUTOMATIC' as const,
      manualHealingAccepted: false,
      selectedCompanionInstanceIds: [],
      requestRoll: false as const
    }
    const preview = await base.owner.caller.query(api.characters.rest.preview, {
      id: character.id,
      input
    })
    return run({ ...input, type: 'COMPLETE_REST', previewFingerprint: preview.previewFingerprint })
  }
  return { run, cast, rest, sheet }
}

const summonsOf = (sheet: CharacterSheetResponseDto) =>
  sheet.extras.items.filter((item) => item.kind === 'SPELL_SUMMON')

describe('a summon cast from the Sheet outside an Encounter (D190, SPELLS-34)', () => {
  it('adds the conjured creature to Extras from the compiled plan, tracks its hit points and ends it', async () => {
    const { run, cast, rest, sheet } = await fixture()
    const maximum = sheet.overview.maxHitPoints

    const cast1 = await cast()
    const [hand] = summonsOf(cast1)
    expect(hand).toMatchObject({
      kind: 'SPELL_SUMMON',
      spellId: arcaneHand.id,
      originKind: 'SUMMONED',
      displayName: 'Arcane Hand',
      concentration: true,
      armorClass: 20,
      hitPoints: { current: maximum, maximum, temp: 0 }
    })
    expect(hand?.speedLabel).toMatch(/60/)
    expect(cast1.overview.concentration).toMatchObject({ label: 'Arcane Hand' })
    expect(cast1.spells.slots[0]).toMatchObject({ used: 1 })

    const damaged = await run({
      type: 'UPDATE_SHEET_EXTRA',
      extra: { kind: 'SPELL_SUMMON', extraId: hand!.id, currentHitPoints: 3 }
    })
    expect(summonsOf(damaged)[0]?.hitPoints.current).toBe(3)

    // A new Concentration cast replaces the summon that held it.
    const recast = await cast()
    expect(summonsOf(recast)).toHaveLength(1)
    expect(summonsOf(recast)[0]?.id).not.toBe(hand!.id)

    const ended = await run({ type: 'END_CONCENTRATION' })
    expect(summonsOf(ended)).toEqual([])
    expect(ended.overview.concentration).toBeNull()

    const dismissed = await cast()
    const removed = await run({
      type: 'REMOVE_SHEET_EXTRA',
      extra: { kind: 'SPELL_SUMMON', extraId: summonsOf(dismissed)[0]!.id }
    })
    expect(summonsOf(removed)).toEqual([])

    const destroyed = await cast()
    const atZero = await run({
      type: 'UPDATE_SHEET_EXTRA',
      extra: { kind: 'SPELL_SUMMON', extraId: summonsOf(destroyed)[0]!.id, currentHitPoints: 0 }
    })
    expect(summonsOf(atZero)).toEqual([])

    await cast()
    expect(summonsOf(await rest('LONG'))).toEqual([])
  })
})
