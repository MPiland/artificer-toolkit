import { convexTest } from '../../tests/convexTest'
import { describe, expect, it, vi } from 'vitest'
import { brotliCompressSync } from 'node:zlib'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { sourceImportDefinitionDtoSchema } from '@artificer-toolkit/schema/api/sourceImport'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_SENSE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/senses.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { internal } from '../_generated/api'
import schema from '../schema'
import { importedSubject } from '../../tests/fixtures/publication'

const embedded = vi.hoisted(() => ({ encoded: '' }))
vi.mock('./srdManifest.generated', () => ({
  get srdManifestBrotliBase64() {
    return embedded.encoded
  }
}))

const systemDocument = jsonValueSchema.parse(JSON.parse(JSON.stringify(srdSystemRecord)))
const system = {
  id: srdSystemRecord.id,
  checksum: checksumRuleDocument(systemDocument),
  document: systemDocument
}
const otherBackgroundId = '11111111-1111-4111-8111-111111111111'

function background(id: string, label: string) {
  return importedSubject({
    subjectKind: 'BACKGROUND',
    id,
    systemId: acolyte.systemId,
    label,
    document: { ...acolyte, id, label }
  })
}

const sense = sourceImportDefinitionDtoSchema.parse({
  ...SRD_SENSE_DEFINITIONS[0],
  definitionFamilyKey: 'sense'
})

// Embeds a corpus the way the generated manifest does: compressed, with its own checksum.
function embedCorpus(
  subjects: ReturnType<typeof background>[],
  parts: Partial<{
    systems: (typeof system)[]
    definitions: (typeof sense)[]
    contentSource: Omit<typeof SRD_CONTENT_SOURCE, 'label'> & { label: string }
    catalogue: Omit<typeof SRD_RULES_CATALOGUE, 'description'> & { description: string }
  }> = {}
) {
  const corpus = {
    systems: [system],
    subjects,
    definitions: [],
    catalogue: SRD_RULES_CATALOGUE,
    contentSource: SRD_CONTENT_SOURCE,
    ...parts
  }
  const manifestChecksum = checksumRuleDocument(jsonValueSchema.parse(corpus))
  embedded.encoded = brotliCompressSync(
    Buffer.from(JSON.stringify({ ...corpus, manifestChecksum }))
  ).toString('base64')
  return manifestChecksum
}

describe('seeding a changed corpus', () => {
  it('replaces changed subjects in place, replays cleanly and refuses removed subjects', async () => {
    const t = convexTest(schema, import.meta.glob('/apps/apis/convex/**/*.*s'))

    const checksumN = embedCorpus([background(acolyte.id, 'Acolyte')])
    expect(await t.action(internal.content.seed.seed, {})).toEqual({
      systems: 1,
      subjects: 1,
      definitions: 0,
      manifestChecksum: checksumN,
      inserted: 4,
      reused: 0,
      replaced: 0
    })

    // Corpus N+1 renames the Background; the seed applies it without a backend reset.
    const checksumNext = embedCorpus([background(acolyte.id, 'Temple Acolyte')])
    expect(await t.action(internal.content.seed.seed, {})).toEqual({
      systems: 1,
      subjects: 1,
      definitions: 0,
      manifestChecksum: checksumNext,
      inserted: 0,
      reused: 3,
      replaced: 1
    })
    expect(await t.action(internal.content.seed.audit, {})).toMatchObject({
      manifestChecksum: checksumNext
    })

    // Seeding corpus N after N+1 is just another replace.
    embedCorpus([background(acolyte.id, 'Acolyte')])
    expect(await t.action(internal.content.seed.seed, {})).toMatchObject({
      reused: 3,
      replaced: 1
    })

    // A removed subject fails loudly and names its id; nothing else is applied.
    embedCorpus([background(otherBackgroundId, 'Other Acolyte')])
    await expect(t.action(internal.content.seed.seed, {})).rejects.toThrow(
      `Canonical subjects were removed from the corpus, which the seed cannot apply: ${acolyte.id}.`
    )
  }, 120_000)

  it('replaces a changed System, source, catalogue and definition, and refuses a removed definition', async () => {
    const t = convexTest(schema, import.meta.glob('/apps/apis/convex/**/*.*s'))
    const subjects = [background(acolyte.id, 'Acolyte')]

    embedCorpus(subjects, { definitions: [sense] })
    expect(await t.action(internal.content.seed.seed, {})).toMatchObject({
      definitions: 1,
      inserted: 5,
      reused: 0,
      replaced: 0
    })

    // Corpus N+1 revises all four kinds; the seed applies them without a backend reset.
    const revisedSystem = jsonValueSchema.parse(
      JSON.parse(JSON.stringify({ ...srdSystemRecord, description: 'Revised SRD' }))
    )
    const revisedSense = sourceImportDefinitionDtoSchema.parse({ ...sense, label: 'Revised sense' })
    const checksumNext = embedCorpus(subjects, {
      systems: [
        {
          id: srdSystemRecord.id,
          checksum: checksumRuleDocument(revisedSystem),
          document: revisedSystem
        }
      ],
      contentSource: { ...SRD_CONTENT_SOURCE, label: 'Revised source' },
      catalogue: { ...SRD_RULES_CATALOGUE, description: 'Revised catalogue' },
      definitions: [revisedSense]
    })
    expect(await t.action(internal.content.seed.seed, {})).toEqual({
      systems: 1,
      subjects: 1,
      definitions: 1,
      manifestChecksum: checksumNext,
      inserted: 0,
      reused: 1,
      replaced: 4
    })
    expect(await t.action(internal.content.seed.audit, {})).toMatchObject({
      manifestChecksum: checksumNext
    })

    // A removed definition fails loudly and names its id.
    embedCorpus(subjects)
    await expect(t.action(internal.content.seed.seed, {})).rejects.toThrow(
      `Canonical definitions were removed from the corpus, which the seed cannot apply: ${sense.id}.`
    )
  }, 120_000)
})
