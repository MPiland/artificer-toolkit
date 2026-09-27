import { afterEach, expect, it, vi } from 'vitest'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { human } from '@artificer-toolkit/source-data/srd/races/human.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { dagger } from '@artificer-toolkit/source-data/srd/equipment/dagger.js'
import { light } from '@artificer-toolkit/source-data/srd/spells/light.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { toCharacterBuilderPayload } from '@artificer-toolkit/rules-runtime/character/characterBuilderView'
import { createCharacterBuilderChangePreview } from '@artificer-toolkit/rules-runtime/character/builderPresentation'
import { api, internal } from '../_generated/api'
import { importedSubject, publicationFixture } from '../../tests/fixtures/publication'
import { readyCharacterFixture, readySheetFixture } from '../../tests/fixtures/readyCharacter'
import * as context from './context'
import { prepareCharacterBuilder } from './builderPreparation'
import { loadCharacterSheet } from './sheetPreparation'

afterEach(() => vi.restoreAllMocks())

it('keeps builder resolution exact while reading fewer structural publications', async () => {
  if (fighter.category !== 'BASE' || fighter.subclassSelectionLevel === undefined)
    throw new Error('Expected the canonical Fighter subclass selection level.')
  const { t, first } = await publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    []
  )
  expect(await t.action(internal.content.seed.seed, {})).toMatchObject({ subjects: 1057 })
  const draft = await first.caller.mutation(api.characters.drafts.create, {
    id: crypto.randomUUID(),
    systemId: fighter.systemId
  })
  const character = characterAuthoredDtoSchema.parse({
    ...draft.payload.character,
    label: 'Catalogue probe',
    intent: {
      ...draft.payload.character.intent,
      race: { raceId: human.id },
      background: { backgroundId: acolyte.id },
      classes: [
        {
          classId: fighter.id,
          classLevel: fighter.subclassSelectionLevel
        },
        { classId: wizard.id, classLevel: 1 }
      ]
    }
  })
  const selectedFighter = characterAuthoredDtoSchema.parse({
    ...character,
    intent: {
      ...character.intent,
      classes: [{ classId: fighter.id, classLevel: 1 }]
    }
  })
  const cases = [
    {
      name: 'empty draft',
      character: characterAuthoredDtoSchema.parse(draft.payload.character),
      current: null,
      mode: 'create' as const
    },
    {
      name: 'selected race/background/Fighter1',
      character: selectedFighter,
      current: null,
      mode: 'create' as const
    },
    {
      name: 'missing race',
      character: characterAuthoredDtoSchema.parse({
        ...selectedFighter,
        intent: { ...selectedFighter.intent, race: { raceId: '' } }
      }),
      current: null,
      mode: 'create' as const
    },
    {
      name: 'missing background',
      character: characterAuthoredDtoSchema.parse({
        ...selectedFighter,
        intent: { ...selectedFighter.intent, background: { backgroundId: '' } }
      }),
      current: null,
      mode: 'create' as const
    },
    {
      name: 'missing classes',
      character: characterAuthoredDtoSchema.parse({
        ...selectedFighter,
        intent: { ...selectedFighter.intent, classes: [] }
      }),
      current: null,
      mode: 'create' as const
    },
    { name: 'subclass selection plus Wizard1', character, current: null, mode: 'create' as const },
    {
      name: 'unavailable selected race UUID',
      character: characterAuthoredDtoSchema.parse({
        ...selectedFighter,
        intent: { ...selectedFighter.intent, race: { raceId: crypto.randomUUID() } }
      }),
      current: null,
      mode: 'create' as const
    },
    {
      name: 'edit to incomplete selection',
      character: characterAuthoredDtoSchema.parse({
        ...selectedFighter,
        intent: { ...selectedFighter.intent, classes: [] }
      }),
      current: selectedFighter,
      mode: 'edit' as const
    }
  ]
  const readPublication = vi.spyOn(context, 'readCharacterPublication')
  const result = await t.run(async (ctx) => {
    const selectors = await prepareCharacterBuilder(ctx, {
      character,
      current: null,
      mode: 'create',
      catalogScope: 'selectors'
    })
    const selectorReads = readPublication.mock.calls.length
    readPublication.mockClear()
    const resolution = await prepareCharacterBuilder(ctx, {
      character,
      current: null,
      mode: 'create',
      catalogScope: 'resolution'
    })
    const { catalog: selectorCatalog, ...selectorResolution } = selectors.resolution
    const { catalog: resolutionCatalog, ...resolutionResolution } = resolution.resolution
    expect(resolutionResolution).toEqual(selectorResolution)
    expect(
      resolutionResolution.outstandingChoices.some(
        (choice) => choice.code === 'SUBCLASS_SELECTION_REQUIRED'
      )
    ).toBe(true)
    const resolutionReads = readPublication.mock.calls.length
    readPublication.mockClear()
    const previews = []
    for (const testCase of cases) {
      const scoped = []
      for (const catalogScope of ['selectors', 'resolution'] as const) {
        const prepared = await prepareCharacterBuilder(ctx, {
          character: testCase.character,
          current: testCase.current,
          mode: testCase.mode,
          catalogScope
        })
        const predictedStatus = prepared.resolution.readiness.ready ? 'ACTIVE' : 'DRAFT'
        scoped.push({
          character: { ...prepared.character, status: predictedStatus },
          resolution: toCharacterBuilderPayload(prepared.character, prepared.resolution).resolution,
          preview: createCharacterBuilderChangePreview({
            previousCharacter: testCase.current ?? prepared.candidate,
            nextCharacter: prepared.character,
            predictedStatus,
            context: prepared.context
          })
        })
      }
      previews.push({ name: testCase.name, selectors: scoped[0], resolution: scoped[1] })
    }
    return {
      selectorCatalog,
      resolutionCatalog,
      selectorCharacter: selectors.character,
      resolutionCharacter: resolution.character,
      selectorReads,
      resolutionReads,
      previews,
      publicPreview: previews.find((preview) => preview.name === 'subclass selection plus Wizard1')
        ?.selectors
    }
  })

  expect(result.resolutionCatalog.equipment).toEqual(result.selectorCatalog.equipment)
  expect(result.resolutionCharacter).toEqual(result.selectorCharacter)
  expect(result.resolutionCatalog.equipment).toHaveLength(
    srdBaselineContent.subjects.equipment.length
  )
  expect(result.resolutionCatalog.feats).toEqual(result.selectorCatalog.feats)
  expect(result.resolutionCatalog.spells).toEqual(result.selectorCatalog.spells)
  expect(result.resolutionReads).toBeLessThan(result.selectorReads)
  for (const preview of result.previews) {
    expect(preview.resolution, preview.name).toEqual(preview.selectors)
  }
  readPublication.mockClear()
  const publicPreview = await first.caller.query(api.characters.builder.preview, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  expect(publicPreview).toEqual(result.publicPreview)
  expect(readPublication.mock.calls.length).toBeLessThan(result.selectorReads)
}, 120000)

it('keeps active Sheet facts exact without loading unrelated Equipment choices', async () => {
  const { t, owner, character } = await readySheetFixture()
  await t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ subjectKind: 'EQUIPMENT', ...dagger, document: dagger })]
  })

  const result = await t.run(async (ctx) => {
    const active = await loadCharacterSheet(
      ctx,
      owner.userId,
      character.id,
      undefined,
      undefined,
      'active'
    )
    const resolution = await loadCharacterSheet(
      ctx,
      owner.userId,
      character.id,
      undefined,
      undefined,
      'resolution'
    )
    if (!active || !resolution) throw new Error('Missing ready Character Sheet fixture.')
    const comparable = (sheet: typeof active.sheet) => ({
      ...sheet,
      reference: { ...sheet.reference, equipmentOptions: [] }
    })
    return {
      active: comparable(active.sheet),
      resolution: comparable(resolution.sheet),
      activeEquipmentIds: active.sheet.reference.equipmentOptions.map((option) => option.id),
      resolutionEquipmentIds: resolution.sheet.reference.equipmentOptions.map((option) => option.id)
    }
  })

  expect(result.active).toEqual(result.resolution)
  expect(result.activeEquipmentIds).toContain(club.id)
  expect(result.activeEquipmentIds).not.toContain(dagger.id)
  expect(result.resolutionEquipmentIds).toContain(dagger.id)
})

it('refreshes the first Spell catalogue introduced by granted starting Equipment', async () => {
  const equipment = {
    ...club,
    features: [
      {
        id: crypto.randomUUID(),
        label: 'Glowing club',
        description: '',
        order: 0,
        grants: {
          spells: [
            {
              id: crypto.randomUUID(),
              grantKind: 'SPELL_GRANT' as const,
              selectionKind: 'GRANTED' as const,
              scalingKind: 'NONE' as const,
              authoringModeKind: 'SELECTED' as const,
              spellIds: [light.id],
              attributes: ['CAST_AT_WILL' as const],
              order: 0
            }
          ]
        }
      }
    ]
  }
  const { t, createCharacter } = await readyCharacterFixture({}, equipment)
  await t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ subjectKind: 'SPELL', ...light, document: light })]
  })
  const { character } = await createCharacter()
  const result = await t.run(async (ctx) => {
    const input = { character, current: null, mode: 'create' as const }
    const before = await prepareCharacterBuilder(ctx, input)
    const after = await prepareCharacterBuilder(ctx, { ...input, finalize: true })
    return {
      before: before.context.catalog.spells,
      after: after.context.catalog.spells.map((spell) => spell.id),
      ready: after.resolution.readiness.ready,
      inventory: after.character.state.equipment.inventory
    }
  })
  expect(result.before).toEqual([])
  expect(result.after).toContain(light.id)
  expect(result.ready).toBe(true)
  expect(result.inventory).toEqual([expect.objectContaining({ equipmentId: club.id, quantity: 2 })])
})

it('reuses the complete Spell catalogue during spell-enabled first activation', async () => {
  const { t, createCharacter } = await readyCharacterFixture({
    spellcasting: {
      ...wizard.spellcasting!,
      spellLimits: [{ classLevel: 1, slots: [], cantripsLimit: 0 }]
    }
  })
  const { character } = await createCharacter()
  await t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ subjectKind: 'SPELL', ...light, document: light })]
  })
  const result = await t.run(async (ctx) => {
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', light.id))
      .unique()
    if (!root) throw new Error('Missing imported Spell root.')
    const readDatabase = vi.spyOn(ctx.db, 'get')
    const prepared = await prepareCharacterBuilder(ctx, {
      character,
      current: null,
      mode: 'create',
      finalize: true
    })
    const spellReads = readDatabase.mock.calls.filter(([id]) => id === root.currentVersionId).length
    readDatabase.mockRestore()
    const uncached = await context.loadCharacterRuleContext(
      ctx,
      prepared.character,
      character.userId
    )
    return {
      spellReads,
      preparedSpellIds: prepared.context.catalog.spells.map((spell) => spell.id),
      resolutionSpells: prepared.resolution.catalog.spells,
      uncachedSpellIds: uncached.catalog.spells.map((spell) => spell.id),
      preparedSpellIdentity: prepared.context.sourceIdentities.get(light.id),
      uncachedSpellIdentity: uncached.sourceIdentities.get(light.id),
      inventory: prepared.character.state.equipment.inventory,
      ready: prepared.resolution.readiness.ready,
      outstandingChoices: prepared.resolution.outstandingChoices.map((choice) => choice.code)
    }
  })

  expect(result.spellReads).toBe(result.preparedSpellIds.length)
  expect(result.preparedSpellIds).toEqual([light.id])
  expect(result.preparedSpellIds).toEqual(result.uncachedSpellIds)
  expect(result.preparedSpellIdentity).toEqual(result.uncachedSpellIdentity)
  expect(result.preparedSpellIdentity?.subjectId).toBe(light.id)
  expect(result.resolutionSpells.map((spell) => spell.id)).toEqual(result.preparedSpellIds)
  expect(result.ready, result.outstandingChoices.join(',')).toBe(true)
  expect(result.inventory).toEqual([expect.objectContaining({ equipmentId: club.id, quantity: 2 })])
})
