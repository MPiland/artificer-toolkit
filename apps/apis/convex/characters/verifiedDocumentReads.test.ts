import { describe, expect, it, vi } from 'vitest'
import { backgroundAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/background'
import {
  classAuthoredDtoSchema,
  subclassAuthoredDtoSchema
} from '@artificer-toolkit/schema/subjects/class'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { raceAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/race'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import { systemAuthoredDtoSchema } from '@artificer-toolkit/schema/vocabulary/system'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { corruptPublishedVersionPayload } from '../../tests/fixtures/publication'
import { loadCharacterSheet } from './sheetPreparation'

// RELIABILITY-21.T25: publish and seed validate a document; every later read verifies its checksum.
const parsedSchemas = [
  backgroundAuthoredDtoSchema,
  classAuthoredDtoSchema,
  subclassAuthoredDtoSchema,
  equipmentAuthoredDtoSchema,
  raceAuthoredDtoSchema,
  spellAuthoredDtoSchema,
  systemAuthoredDtoSchema
]

describe('Sheet derivation reads verified documents', () => {
  it('derives the Sheet without parsing a publication or System document again', async () => {
    const sheet = await readySheetFixture()
    const parses = parsedSchemas.map((schema) => vi.spyOn(schema, 'parse'))
    const loaded = await sheet.owner.caller.run(
      async (ctx) =>
        (await loadCharacterSheet(ctx, sheet.owner.userId, sheet.character.id)) !== null
    )
    const calls = parses.map((parse) => parse.mock.calls.length)
    parses.forEach((parse) => parse.mockRestore())
    expect(loaded).toBe(true)
    expect(calls).toEqual(parsedSchemas.map(() => 0))
  }, 120_000)

  it('refuses a publication whose bytes no longer match its checksum', async () => {
    const sheet = await readySheetFixture()
    const classId = sheet.character.intent.classes[0]?.classId
    if (!classId) throw new Error('Expected a Class selection.')
    await sheet.t.run((ctx) => corruptPublishedVersionPayload(ctx, classId))
    await expect(
      sheet.owner.caller.run((ctx) =>
        loadCharacterSheet(ctx, sheet.owner.userId, sheet.character.id)
      )
    ).rejects.toThrow('Stored authored content checksum mismatch.')
  }, 120_000)

  it('refuses a System document whose bytes no longer match its checksum', async () => {
    const sheet = await readySheetFixture()
    await sheet.t.run(async (ctx) => {
      const system = await ctx.db
        .query('systems')
        .withIndex('by_publicId', (q) => q.eq('id', sheet.character.systemId))
        .unique()
      if (!system || typeof system.document !== 'object' || system.document === null)
        throw new Error('Expected the Character System.')
      await ctx.db.patch(system._id, { document: { ...system.document, label: 'Tampered' } })
    })
    await expect(
      sheet.owner.caller.run((ctx) =>
        loadCharacterSheet(ctx, sheet.owner.userId, sheet.character.id)
      )
    ).rejects.toThrow('Stored System checksum mismatch.')
  }, 120_000)
})
