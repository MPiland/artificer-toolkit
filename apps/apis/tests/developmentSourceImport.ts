import assert from 'node:assert/strict'
import { ConvexHttpClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'
import { developmentTarget } from './developmentTarget'

const { mode, selector, deploymentUrl } = developmentTarget(process.env)
const client = new ConvexHttpClient(deploymentUrl.origin)
const denied = /Could not find public function/

for (const name of ['bootstrap', 'importSubjects', 'importDefinitions']) {
  await assert.rejects(
    client.mutation(
      makeFunctionReference<'mutation', Record<string, never>, unknown>(`content/import:${name}`),
      {}
    ),
    denied
  )
}
for (const name of ['readBootstrap', 'readSubjects', 'readDefinitions']) {
  await assert.rejects(
    client.query(
      makeFunctionReference<'query', Record<string, never>, unknown>(`content/import:${name}`),
      {}
    ),
    denied
  )
}
for (const name of ['seed', 'audit']) {
  await assert.rejects(
    client.action(
      makeFunctionReference<'action', Record<string, never>, unknown>(`content/seed:${name}`),
      {}
    ),
    denied
  )
}

await assert.rejects(
  client.mutation(
    makeFunctionReference<'mutation', Record<string, never>, unknown>(
      'content/sourceMigrations:backfillAuthoringSources'
    ),
    {}
  ),
  denied
)

console.log(JSON.stringify({ target: { mode, selector }, internalEndpointsDenied: 9 }))
