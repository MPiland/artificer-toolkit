import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { CharacterSheetReadInput } from '@artificer-toolkit/schema/api/characterSheetData'
import type { CharacterPreparationOptionsResponseDto } from '@artificer-toolkit/schema/api/characterPreparationOptions'
import type {
  CharacterSheetPanelDto,
  CharacterSheetPanelInput
} from '@artificer-toolkit/schema/api/characterSheetPanel'
import type {
  CharacterSheetCommandResponseDto,
  CharacterSheetExecuteInput
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import { magicMissile } from '@artificer-toolkit/source-data/srd/spells/magic-missile.js'
import { shield } from '@artificer-toolkit/source-data/srd/spells/shield.js'
import { detectMagic } from '@artificer-toolkit/source-data/srd/spells/detect-magic.js'
import { shieldOfFaith } from '@artificer-toolkit/source-data/srd/spells/shield-of-faith.js'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { api, internal } from '../_generated/api'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { importedSubject } from '../../tests/fixtures/publication'

const getOptions = makeFunctionReference<
  'query',
  CharacterSheetReadInput,
  CharacterPreparationOptionsResponseDto | null
>('characters/preparationOptions:get')
const execute = makeFunctionReference<
  'mutation',
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
>('characters/sheetCommands:execute')
const getPanel = makeFunctionReference<'query', CharacterSheetPanelInput, CharacterSheetPanelDto>(
  'characters/panels:get'
)

async function spellSourcePanel(
  caller: Awaited<ReturnType<typeof fixture>>['owner']['caller'],
  characterId: string
) {
  const spells = await caller.query(getPanel, { id: characterId, target: { kind: 'SPELLS' } })
  if (spells.kind !== 'SPELLS') throw new Error('Expected spells panel.')
  const source = spells.groups
    .flatMap((group) => group.sources)
    .find((candidate) => candidate.spellId === magicMissile.id)
  if (!source) throw new Error('Expected Wizard spell source.')
  const spell = await caller.query(getPanel, {
    id: characterId,
    target: { kind: 'SPELL', source: source.source }
  })
  if (spell.kind !== 'SPELL') throw new Error('Expected spell panel.')
  return { spells, source, spell }
}

async function fixture(usesSpellbook = true) {
  if (!wizard.spellcasting) throw new Error('Expected canonical Wizard spellcasting.')
  const base = await readyCharacterFixture({
    spellcasting: {
      ...wizard.spellcasting,
      attributes: usesSpellbook ? ['PREPARES_SPELLS', 'USES_SPELLBOOK'] : ['PREPARES_SPELLS'],
      spellLimits: [{ classLevel: 1, slots: [{ spellLevel: 1, slotCount: 2 }], cantripsLimit: 0 }]
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
      importedSubject({ subjectKind: 'SPELL', ...shieldOfFaith, document: shieldOfFaith })
    ]
  })
  const { draft, character } = await base.createCharacter()
  const committed = await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  return { ...base, character, committed }
}

function command(
  id: string,
  expectedVersion: number,
  classId: string,
  type: 'SET_KNOWN_SPELLS' | 'SET_PREPARED_SPELLS',
  spellIds: string[]
): CharacterSheetExecuteInput {
  return {
    id,
    command: {
      type,
      commandId: crypto.randomUUID(),
      expectedVersion,
      classId,
      spellIds
    }
  }
}

describe('native personal Character Sheet preparation options', () => {
  it('keeps Wizard Learn and Forget state separate from preparation in both panels', async () => {
    const { owner, character, baseClass } = await fixture(true)
    const initial = await spellSourcePanel(owner.caller, character.id)
    expect(initial.source).toMatchObject({ known: false, canManageKnown: true })
    expect(initial.spell).toMatchObject({ known: false, canManageKnown: true })

    await owner.caller.mutation(
      execute,
      command(character.id, 1, baseClass.id, 'SET_KNOWN_SPELLS', [magicMissile.id])
    )
    const learned = await spellSourcePanel(owner.caller, character.id)
    expect(learned.source).toMatchObject({ known: true, canManageKnown: true })
    expect(learned.spell).toMatchObject({ known: true, canManageKnown: true })

    await owner.caller.mutation(
      execute,
      command(character.id, 2, baseClass.id, 'SET_PREPARED_SPELLS', [magicMissile.id])
    )
    const prepared = await spellSourcePanel(owner.caller, character.id)
    expect(prepared.source).toMatchObject({ known: true, prepared: true, canManageKnown: true })
    expect(prepared.spell).toMatchObject({ known: true, prepared: true, canManageKnown: true })

    const fullList = await fixture(false)
    const fullListPanel = await spellSourcePanel(fullList.owner.caller, fullList.character.id)
    expect(fullListPanel.source.canManageKnown).toBe(false)
    expect(fullListPanel.spell.canManageKnown).toBe(false)
  })

  it('returns only learned spellbook options, with prepared and committed state after commands', async () => {
    const { owner, character, committed, baseClass } = await fixture()
    expect(await owner.caller.query(getOptions, { id: character.id })).toMatchObject({
      characterId: character.id,
      streamVersion: 1,
      classes: [{ classId: baseClass.id, options: [] }]
    })

    const known = await owner.caller.mutation(
      execute,
      command(character.id, 1, baseClass.id, 'SET_KNOWN_SPELLS', [
        magicMissile.id,
        shield.id,
        detectMagic.id
      ])
    )
    expect(known.streamVersion).toBe(2)
    const learned = await owner.caller.query(getOptions, { id: committed.publicId })
    expect(learned).toMatchObject({ characterId: character.id, streamVersion: 2 })
    expect(learned!.classes).toHaveLength(1)
    expect(learned!.classes[0]).toMatchObject({
      classId: baseClass.id,
      label: baseClass.label,
      preparedSpellLimit: 2
    })
    expect(learned!.classes[0]!.options.map(({ spellId }) => spellId)).toEqual(
      [detectMagic, magicMissile, shield]
        .sort((left, right) => left.level - right.level || left.label.localeCompare(right.label))
        .map(({ id }) => id)
    )
    expect(learned!.classes[0]!.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ spellId: magicMissile.id, prepared: false, committed: true }),
        expect.objectContaining({ spellId: shield.id, prepared: false, committed: true }),
        expect.objectContaining({ spellId: detectMagic.id, prepared: false, committed: true })
      ])
    )

    const prepared = await owner.caller.mutation(
      execute,
      command(character.id, 2, baseClass.id, 'SET_PREPARED_SPELLS', [magicMissile.id])
    )
    expect(prepared.streamVersion).toBe(3)
    const selected = await owner.caller.query(getOptions, { id: character.id })
    expect(selected).toMatchObject({ characterId: character.id, streamVersion: 3 })
    expect(selected!.classes[0]!.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ spellId: magicMissile.id, prepared: true, committed: true }),
        expect.objectContaining({ spellId: shield.id, prepared: false, committed: true }),
        expect.objectContaining({ spellId: detectMagic.id, prepared: false, committed: true })
      ])
    )
  })

  it('returns every eligible current spell for full-list preparers and excludes wrong-class spells', async () => {
    const { owner, character, baseClass } = await fixture(false)
    const initial = await owner.caller.query(getOptions, { id: character.id })
    expect(initial!.classes[0]!.options.map(({ spellId }) => spellId).sort()).toEqual(
      [detectMagic.id, magicMissile.id, shield.id].sort()
    )
    expect(initial!.classes[0]!.options.map(({ spellId }) => spellId)).not.toContain(
      shieldOfFaith.id
    )
    expect(
      initial!.classes[0]!.options.every(({ prepared, committed }) => !prepared && committed)
    ).toBe(true)

    const prepared = await owner.caller.mutation(
      execute,
      command(character.id, 1, baseClass.id, 'SET_PREPARED_SPELLS', [magicMissile.id])
    )
    expect(prepared.streamVersion).toBe(2)
    const selected = await owner.caller.query(getOptions, { id: character.id })
    expect(selected!.classes[0]!.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ spellId: magicMissile.id, prepared: true, committed: true }),
        expect.objectContaining({ spellId: shield.id, prepared: false, committed: true }),
        expect.objectContaining({ spellId: detectMagic.id, prepared: false, committed: true })
      ])
    )
  })

  it('returns no options for a noncaster and null for missing or foreign characters without writes', async () => {
    const base = await readyCharacterFixture()
    const { draft, character } = await base.createCharacter()
    const committed = await base.owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: draft.id,
      mode: 'create',
      character
    })
    const before = await base.t.run((ctx) =>
      ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', character.id))
        .unique()
    )
    expect(
      (await base.owner.caller.query(getOptions, { id: committed.publicId }))!.classes
    ).toEqual([])
    expect(await base.other.caller.query(getOptions, { id: committed.publicId })).toBeNull()
    expect(await base.owner.caller.query(getOptions, { id: crypto.randomUUID() })).toBeNull()
    await expect(base.t.query(getOptions, { id: character.id })).rejects.toThrow()
    const after = await base.t.run((ctx) =>
      ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', character.id))
        .unique()
    )
    expect(after).toEqual(before)
  })
})
