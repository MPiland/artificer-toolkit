import { convexTest } from '../../tests/convexTest'
import { describe, expect, it, vi } from 'vitest'
import { brotliCompressSync } from 'node:zlib'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
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

// Embeds a corpus the way the generated manifest does: compressed, with its own checksum.
function embedCorpus(subjects: ReturnType<typeof background>[]) {
  const corpus = {
    systems: [system],
    subjects,
    definitions: [],
    catalogue: SRD_RULES_CATALOGUE,
    contentSource: SRD_CONTENT_SOURCE
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
})
