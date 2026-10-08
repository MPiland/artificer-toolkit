import { convexTest } from '../../tests/convexTest'
import { expect, it } from 'vitest'
import { prepareSrdImport } from '@artificer-toolkit/source-data/srd/import.js'
import { internal } from '../_generated/api'
import schema from '../schema'

it('fails the audit explicitly for a stored corpus that is stale or partial', async () => {
  const t = convexTest(schema, import.meta.glob('/apps/apis/convex/**/*.*s'))
  await t.action(internal.content.seed.seed, {})
  const [definition] = prepareSrdImport().definitions
  if (!definition) throw new Error('Expected a canonical definition.')
  const row = await t.run(async (ctx) =>
    ctx.db
      .query('reusableDefinitions')
      .withIndex('by_publicId', (q) => q.eq('id', definition.id))
      .unique()
  )
  if (!row) throw new Error('Expected the seeded definition.')
  // Seeded from an older manifest: one stored record no longer matches the canonical source.
  await t.run(async (ctx) => ctx.db.patch(row._id, { label: `${row.label} (old)` }))
  await expect(t.action(internal.content.seed.audit, {})).rejects.toThrow(
    'Stored SRD differs from canonical source.'
  )
  // Partially imported: one canonical record is missing.
  await t.run(async (ctx) => ctx.db.delete(row._id))
  await expect(t.action(internal.content.seed.audit, {})).rejects.toThrow(
    'Canonical SRD import is incomplete.'
  )
}, 240_000)
