import assert from 'node:assert/strict'
import { ConvexHttpClient } from 'convex/browser'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api } from '../convex/_generated/api.js'
import { developmentTarget } from './developmentTarget'

// Read-only managed-runtime check. No accounts, invitations, source writes or cleanup.
const { deploymentUrl, selector } = developmentTarget(process.env)
const client = new ConvexHttpClient(deploymentUrl.origin, { logger: false })
for (const subjectKind of ['BACKGROUND', 'EQUIPMENT'] as const) {
  const expected =
    subjectKind === 'BACKGROUND'
      ? srdBaselineContent.subjects.backgrounds
      : srdBaselineContent.subjects.equipment
  const scope = { subjectKind, systemId: srdSystemRecord.id }
  const counts = await client.query(api.content.catalogue.counts, scope)
  assert.deepEqual(counts, {
    activeCount: expected.length,
    masterCount: expected.length,
    ownedCount: 0
  })
  console.log(
    JSON.stringify({
      selector,
      subjectKind,
      counts,
      readonly: true
    })
  )
}
