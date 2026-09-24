import assert from 'node:assert/strict'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { developmentTarget } from './developmentTarget'

const { mode, selector, deploymentUrl } = developmentTarget(process.env)
const client = new ConvexHttpClient(deploymentUrl.origin)
const page = await client.query(api.content.systems.list, { cursor: null, limit: 10 })
const summary = page.page.find((item) => item.id === srdSystemRecord.id)
assert.ok(summary, 'Seed the canonical System before this development check.')
assert.equal(summary.label, srdSystemRecord.label)
assert.deepEqual(summary.rulesCatalogues, [
  {
    id: SRD_RULES_CATALOGUE.id,
    label: SRD_RULES_CATALOGUE.label,
    description: SRD_RULES_CATALOGUE.description
  }
])
assert.ok(!('_id' in summary) && !('_creationTime' in summary))
assert.deepEqual(
  await client.query(api.content.systems.summary, { id: srdSystemRecord.id.toUpperCase() }),
  summary
)
const expected = jsonValueSchema.parse(JSON.parse(JSON.stringify(srdSystemRecord)))
const detail = await client.query(api.content.systems.get, {
  id: srdSystemRecord.id.toUpperCase()
})
assert.deepEqual(detail, expected)
assert.equal(checksumRuleDocument(jsonValueSchema.parse(detail)), checksumRuleDocument(expected))
assert.equal(
  await client.query(api.content.systems.get, { id: 'a0000000-0000-4000-8000-000000000001' }),
  null
)
assert.equal(
  await client.query(api.content.systems.summary, { id: 'a0000000-0000-4000-8000-000000000001' }),
  null
)
console.log(
  JSON.stringify({
    target: { mode, selector },
    canonicalSystem: 'PASS',
    catalogueSummary: 'PASS',
    publicUuidAndChecksum: 'PASS',
    missingSystem: 'PASS'
  })
)
