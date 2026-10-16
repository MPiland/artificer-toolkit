import { describe, expect, it } from 'vitest'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_CONDITION_RULE_STATE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { importedSubject } from '../../tests/fixtures/publication'
import { api, internal } from '../_generated/api'
import { readStoredAuthoredVersionDocument } from './documents'

// PLATFORM-18.1: a corpus change re-imports in place; play data created on corpus N keeps working.
describe('re-importing a changed canonical corpus', () => {
  it('keeps a committed Character working when one subject changes between corpus N and N+1', async () => {
    const { t, owner, character } = await readySheetFixture()
    const sheetOnN = await owner.caller.query(api.characters.sheet.get, {
      id: character.id
    })

    if (!sheetOnN) throw new Error('Missing Sheet on corpus N.')

    // Corpus N+1 differs from N in one subject: the Acolyte Background is renamed.
    const next = await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', acolyte.id))
        .unique()
      const version = root && (await ctx.db.get(root.currentVersionId))
      if (!version) throw new Error('Missing Background on corpus N.')
      return importedSubject({
        subjectKind: 'BACKGROUND',
        id: acolyte.id,
        systemId: acolyte.systemId,
        label: 'Temple Acolyte',
        document: {
          ...(await readStoredAuthoredVersionDocument(ctx, version)),
          label: 'Temple Acolyte'
        }
      })
    })
    const input = { contentSourceId: SRD_CONTENT_SOURCE.id, subjects: [next] }

    expect(await t.mutation(internal.content.import.importSubjects, input)).toEqual({
      inserted: 0,
      reused: 0,
      replaced: 1
    })

    const stored = await t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', acolyte.id))
        .unique()
      const versions = await ctx.db
        .query('authoredVersions')
        .withIndex('by_id_version', (q) => q.eq('id', acolyte.id))
        .collect()
      return { root, versions }
    })
    expect(stored.root?.label).toBe('Temple Acolyte')
    expect(stored.root?.checksum).toBe(next.checksum)
    expect(stored.versions.map((version) => [version.version, version.checksum])).toEqual([
      [2, next.checksum]
    ])

    // The Character built on corpus N keeps working and reads the current Background (ADR 0024).
    expect(await owner.caller.query(api.characters.sheet.get, { id: character.id })).toEqual({
      ...sheetOnN,
      identity: { ...sheetOnN.identity, backgroundLabel: 'Temple Acolyte' }
    })

    // Seeding the same corpus again changes nothing.
    expect(await t.mutation(internal.content.import.importSubjects, input)).toEqual({
      inserted: 0,
      reused: 1,
      replaced: 0
    })
  }, 120_000)

  it('keeps a committed Character working when the System, source, catalogue and a definition change', async () => {
    const { t, owner, character } = await readySheetFixture()
    const sheetOnN = await owner.caller.query(api.characters.sheet.get, {
      id: character.id
    })

    // Corpus N+1 revises the System document, the source and catalogue labels and one definition.
    const system = jsonValueSchema.parse({ ...srdSystemRecord, description: 'Revised SRD' })
    const definition = SRD_CONDITION_RULE_STATE_DEFINITIONS[0]
    expect(
      await t.mutation(internal.content.import.bootstrap, {
        systems: [
          { id: srdSystemRecord.id, document: system, checksum: checksumRuleDocument(system) }
        ],
        contentSource: { ...SRD_CONTENT_SOURCE, label: 'Revised source' },
        catalogue: { ...SRD_RULES_CATALOGUE, description: 'Revised catalogue' }
      })
    ).toEqual({ inserted: 0, reused: 0, replaced: 3 })
    expect(
      await t.mutation(internal.content.import.importDefinitions, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        definitions: [{ ...definition, label: 'Revised condition' }]
      })
    ).toEqual({ inserted: 0, reused: 0, replaced: 1 })

    expect(await owner.caller.query(api.characters.sheet.get, { id: character.id })).toEqual(
      sheetOnN
    )
  }, 120_000)
})
