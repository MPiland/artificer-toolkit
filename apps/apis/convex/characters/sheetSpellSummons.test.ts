import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CharacterSheetPanelDto,
  CharacterSheetPanelInput
} from '@artificer-toolkit/schema/api/characterSheetPanel'
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
import { CREATURE_IDS } from '@artificer-toolkit/source-data/srd/ids.js'
import { findFamiliar } from '@artificer-toolkit/source-data/srd/spells/find-familiar.js'
import { creatureTypeId } from '@artificer-toolkit/source-data/srd/spells/shared.js'
import { arcaneHand } from '@artificer-toolkit/source-data/srd/spells/arcane-hand.js'
import { spiritualWeapon } from '@artificer-toolkit/source-data/srd/spells/spiritual-weapon.js'
import type { CreatureAuthored, SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { api } from '../_generated/api'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import {
  importSeededSrdCreatureSenses,
  seededSrdCreature,
  srdPrintedArmorClass
} from '../../tests/fixtures/srdCreatures'

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

/** A Wizard with `spell` prepared and five 5th-level slots, cast outside any Encounter. */
async function fixture(spell: SpellAuthored = arcaneHand, creatures: CreatureAuthored[] = []) {
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
        ...spell,
        document: { ...spell, classIds: [base.baseClass.id] }
      }),
      ...creatures.map((creature) =>
        importedSubject({ ...creature, subjectKind: 'CREATURE', document: creature })
      )
    ]
  })
  for (const creature of creatures) await importSeededSrdCreatureSenses(base.t, creature)
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
    await run({ type, classId: base.baseClass.id, spellIds: [spell.id] })
  const sheet = (await base.owner.caller.query(getSheet, { id: character.id }))!
  const source = sheet.spells.spells
    .find((entry) => entry.id === spell.id)!
    .sources!.find((entry) => entry.source.sourceKind === 'CLASS')!
  const cast = (picks: { formId?: string; creatureTypeId?: string } = {}) =>
    run({
      type: 'CAST_SPELL',
      spellId: spell.id,
      sourceId: source.id,
      slotKey: 'STANDARD:5',
      ...picks
    })
  const panel = () =>
    base.owner.caller.query(getPanel, {
      id: character.id,
      target: { kind: 'SPELL', source: source.source }
    })
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
  return { run, cast, rest, sheet, panel }
}

const getPanel = makeFunctionReference<'query', CharacterSheetPanelInput, CharacterSheetPanelDto>(
  'characters/panels:get'
)

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
      size: 'LARGE',
      armorClass: 20,
      abilityScores: { STRENGTH: 26 },
      hitPoints: { current: maximum, maximum, temp: 0 },
      // The Clenched Fist the spell lets its caster strike with (SPELLS-34.1).
      actions: [
        {
          id: arcaneHand.effects?.[1]?.id,
          label: 'Melee Spell Attack',
          description: 'Bonus Action'
        }
      ]
    })
    expect(hand?.speedLabel).toMatch(/60/)
    expect(cast1.overview.concentration).toMatchObject({ label: 'Arcane Hand' })
    expect(cast1.spells.slots[0]).toMatchObject({ used: 1 })

    const damaged = await run({
      type: 'UPDATE_SHEET_EXTRA',
      extra: { kind: 'SPELL_SUMMON', extraId: hand!.id, currentHitPoints: 3 }
    })
    expect(summonsOf(damaged)[0]?.hitPoints?.current).toBe(3)

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

  it('conjures the form and Creature Type picked on the Sheet, kept through a long rest (SPELLS-34.2)', async () => {
    const cat = seededSrdCreature('Cat')
    const { cast, rest, panel } = await fixture(findFamiliar, [cat])
    const outcome = findFamiliar.effects
      ?.flatMap((effect) => effect.paths)
      .flatMap((path) => (path.selectionKind === 'FIXED' ? path.resultBlock.outcomes : []))
      .find((candidate) => candidate.effectKind === 'MANIFEST')
    const catForm =
      outcome?.effectKind === 'MANIFEST'
        ? outcome.forms?.find((form) => form.creatureId === CREATURE_IDS.CAT)
        : undefined
    if (!catForm) throw new Error('Find Familiar must offer the Cat form.')
    const FEY = creatureTypeId('FEY')

    const spellPanel = await panel()
    if (spellPanel?.kind !== 'SPELL') throw new Error('Expected the Spell panel.')
    const mode = spellPanel.legalCastModes.find((entry) => entry.slotKey === 'STANDARD:5')
    expect(mode?.summonForms).toContainEqual({ id: catForm.id, label: 'Cat' })
    expect(mode?.summonForms).toHaveLength(15)
    expect(mode?.creatureTypes?.map((type) => type.id)).toEqual([
      creatureTypeId('CELESTIAL'),
      FEY,
      creatureTypeId('FIEND')
    ])

    await expect(cast()).rejects.toThrow('needs one of its creature forms')
    await expect(cast({ formId: catForm.id })).rejects.toThrow('Pick one of the creature types')
    await expect(
      cast({ formId: catForm.id, creatureTypeId: creatureTypeId('BEAST') })
    ).rejects.toThrow('Pick one of the creature types')

    const casted = await cast({ formId: catForm.id, creatureTypeId: FEY })
    expect(casted.spells.slots[0]).toMatchObject({ used: 1 })
    const [familiar] = summonsOf(casted)
    expect(familiar).toMatchObject({
      kind: 'SPELL_SUMMON',
      spellId: findFamiliar.id,
      originKind: 'SUMMONED',
      displayName: 'Cat',
      concentration: false,
      armorClass: srdPrintedArmorClass(cat),
      hitPoints: { current: 2, maximum: 2, temp: 0 }
    })

    expect(summonsOf(await rest('LONG')).map((summon) => summon.id)).toEqual([familiar!.id])
  })

  it('refuses a form pick on a summon with no creature forms (SPELLS-34.2)', async () => {
    const { cast } = await fixture()

    await expect(cast({ formId: CREATURE_IDS.CAT })).rejects.toThrow(
      'This action takes no creature form.'
    )
  })

  it('tracks a summon whose stat block has no hit points, with no hit point pool, until it is dismissed (SPELLS-4.T2v2b)', async () => {
    const { run, cast } = await fixture(spiritualWeapon)

    const [weapon] = summonsOf(await cast())
    expect(weapon).toMatchObject({
      kind: 'SPELL_SUMMON',
      spellId: spiritualWeapon.id,
      displayName: 'Spiritual Weapon',
      actions: [
        {
          id: spiritualWeapon.effects?.[1]?.id,
          label: 'Melee Spell Attack',
          description: 'Bonus Action'
        }
      ]
    })
    expect(weapon).not.toHaveProperty('hitPoints')

    const renamed = await run({
      type: 'UPDATE_SHEET_EXTRA',
      extra: { kind: 'SPELL_SUMMON', extraId: weapon!.id, customName: 'Hammer' }
    })
    expect(summonsOf(renamed)[0]).toMatchObject({ displayName: 'Hammer' })

    const dismissed = await run({
      type: 'REMOVE_SHEET_EXTRA',
      extra: { kind: 'SPELL_SUMMON', extraId: weapon!.id }
    })
    expect(summonsOf(dismissed)).toEqual([])
  })
})
