import { afterEach, expect, it, vi } from 'vitest'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { dagger } from '@artificer-toolkit/source-data/srd/equipment/dagger.js'
import { light } from '@artificer-toolkit/source-data/srd/spells/light.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { internal } from '../_generated/api'
import { importedSubject } from '../../tests/fixtures/publication'
import { readyCharacterFixture, readySheetFixture } from '../../tests/fixtures/readyCharacter'
import * as context from './context'
import { prepareCharacterBuilder } from './builderPreparation'
import { loadCharacterSheet } from './sheetPreparation'

afterEach(() => vi.restoreAllMocks())

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
