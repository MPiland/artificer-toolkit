import { convexTest } from 'convex-test'
import { expect, it } from 'vitest'
import { brotliDecompressSync } from 'node:zlib'
import { prepareSrdImport } from '@artificer-toolkit/source-data/srd/import.js'
import { internal } from '../_generated/api'
import schema from '../schema'
import { srdManifestBrotliBase64 } from './srdManifest.generated'

it('embeds the current canonical SRD manifest', () => {
  const manifest = JSON.parse(
    brotliDecompressSync(Buffer.from(srdManifestBrotliBase64, 'base64')).toString('utf8')
  ) as { manifestChecksum: string }
  expect(manifest.manifestChecksum).toBe(prepareSrdImport().manifestChecksum)
})

it('seeds the complete canonical corpus and replays without changing any logical record', async () => {
  const manifest = prepareSrdImport()
  const inserted =
    manifest.systems.length + manifest.subjects.length + manifest.definitions.length + 2
  const t = convexTest(schema, import.meta.glob('/apps/apis/convex/**/*.*s'))
  const first = await t.action(internal.content.seed.seed, {})
  expect(first).toEqual({
    systems: manifest.systems.length,
    subjects: manifest.subjects.length,
    definitions: manifest.definitions.length,
    manifestChecksum: manifest.manifestChecksum,
    inserted,
    reused: 0
  })
  expect(await t.action(internal.content.seed.seed, {})).toEqual({
    ...first,
    inserted: 0,
    reused: inserted
  })
}, 240_000)
