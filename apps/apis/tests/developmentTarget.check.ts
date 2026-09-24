import assert from 'node:assert/strict'
import { developmentTarget } from './developmentTarget'

const local = {
  CONVEX_DEPLOYMENT: 'local:local-example # team: example, project: app',
  CONVEX_URL: 'http://127.0.0.1:3220',
  CONVEX_SITE_URL: 'http://127.0.0.1:3221'
}
const cloud = {
  CONVEX_DEPLOYMENT: 'dev:example-otter-123 # team: example, project: app',
  CONVEX_URL: 'https://example-otter-123.convex.cloud',
  CONVEX_SITE_URL: 'https://example-otter-123.convex.site'
}
assert.equal(developmentTarget(local).mode, 'local')
assert.equal(developmentTarget(cloud).mode, 'cloud-dev')
const rejected = [
  { ...cloud, CONVEX_DEPLOYMENT: undefined },
  { ...cloud, CONVEX_DEPLOYMENT: 'prod:example-otter-123' },
  { ...cloud, CONVEX_DEPLOYMENT: 'preview:example-otter-123' },
  { ...cloud, CONVEX_SITE_URL: 'https://other-otter-123.convex.site' },
  { ...cloud, CONVEX_URL: 'http://example-otter-123.convex.cloud' },
  { ...cloud, CONVEX_URL: 'https://example-otter-123.convex.cloud.evil.invalid' },
  { ...cloud, CONVEX_URL: `${cloud.CONVEX_URL}/path` },
  { ...cloud, CONVEX_URL: `${cloud.CONVEX_URL}?token=not-a-secret` },
  { ...cloud, CONVEX_URL: 'https://user:password@example-otter-123.convex.cloud' },
  { ...cloud, CONVEX_SITE_URL: undefined },
  { ...local, CONVEX_URL: cloud.CONVEX_URL }
]
for (const env of rejected) assert.throws(() => developmentTarget(env))
console.log(JSON.stringify({ acceptedTargets: 2, rejectedTargets: rejected.length }))
