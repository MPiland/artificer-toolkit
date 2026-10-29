// Scratch profiling for RELIABILITY-21.T24. Not committed.
import { createFunctionHandle } from 'convex/server'
import { it } from 'vitest'
import { compactNodeRuntimeResponse } from '@artificer-toolkit/schema/api/nodeRuntimeTransport'
import { nodeRuntimeResolveRequestDtoSchema } from '@artificer-toolkit/schema/api/nodeRuntime'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { resolveNodeRuntime } from '@artificer-toolkit/authoring/nodeRuntime'
import { convexTest } from '../../tests/convexTest'
import { importSeededSubjects } from '../../tests/fixtures/publication'
import { components, internal } from '../_generated/api'
import schema from '../schema'
import authSchema from '../betterAuth/schema'
import { createSystemSourceReader } from './systemSources'

process.env.SITE_URL = 'http://localhost:3000'
process.env.BETTER_AUTH_SECRET = 'test-secret-that-is-long-enough'
const modules = import.meta.glob('/apps/apis/convex/**/*.*s')

it('profiles resolve phases', { timeout: 600_000 }, async () => {
  const t = convexTest(schema, modules)
  t.registerComponent('betterAuth', authSchema, import.meta.glob('../betterAuth/**/*.*s'))
  const system = jsonValueSchema.parse(JSON.parse(JSON.stringify(srdSystemRecord)))
  await t.mutation(internal.content.import.bootstrap, {
    systems: [{ id: srdSystemRecord.id, document: system, checksum: checksumRuleDocument(system) }],
    contentSource: SRD_CONTENT_SOURCE,
    catalogue: SRD_RULES_CATALOGUE
  })
  const user = await t.run(async (ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name: 'A',
          email: 'a@example.invalid',
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      },
      onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
    })
  )
  const profile = await t.run((ctx) =>
    ctx.db
      .query('userProfiles')
      .withIndex('by_authUserId', (q) => q.eq('authUserId', user._id))
      .unique()
  )
  const sub = (s: { id: string; label: string; systemId: string }, kind: string) => {
    const document = jsonValueSchema.parse(JSON.parse(JSON.stringify(s)))
    return {
      subjectKind: kind as 'EQUIPMENT',
      id: s.id,
      systemId: s.systemId,
      label: s.label,
      checksum: checksumRuleDocument(document),
      document
    }
  }
  const c = srdBaselineContent.subjects
  console.log(
    'subject counts',
    Object.fromEntries(Object.entries(c).map(([k, v]) => [k, (v as unknown[]).length]))
  )
  const subjects = [
    ...c.equipment.map((s) => sub(s, 'EQUIPMENT')),
    ...c.classes.map((s) => sub(s, 'CLASS'))
  ]
  for (let i = 0; i < subjects.length; i += 10)
    await importSeededSubjects(t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: subjects.slice(i, i + 10)
    })
  const fighter = c.classes.find((s) => s.label === 'Fighter')!
  const request = {
    mapId: 'class',
    systemId: srdSystemRecord.id,
    values: JSON.parse(JSON.stringify(fighter))
  }
  console.log('request bytes', JSON.stringify(request).length)

  for (let round = 0; round < 3; round += 1) {
    await t.run(async (ctx) => {
      const timings: Record<string, number> = {}
      let at = performance.now()
      const lap = (name: string) => {
        const now = performance.now()
        timings[name] = Math.round(now - at)
        at = now
      }
      const input = nodeRuntimeResolveRequestDtoSchema.parse(request)
      lap('parseArgs')
      const reader = await createSystemSourceReader(ctx, input.systemId, profile!.userId)
      lap('reader')
      let readTime = 0
      const tables = new Map<string, number>()
      const timed: typeof reader = async (...q) => {
        const s = performance.now()
        const r = await reader(...q)
        readTime += performance.now() - s
        const key = JSON.stringify(q[0]).slice(0, 60)
        tables.set(key, (tables.get(key) ?? 0) + 1)
        return r
      }
      const full = await resolveNodeRuntime(timed, input)
      lap('resolve(incl reads)')
      timings.readsInsideResolve = Math.round(readTime)
      const compact = compactNodeRuntimeResponse(full)
      lap('compact')
      const text = JSON.stringify(compact)
      lap('stringify')
      console.log(
        `round ${round}`,
        timings,
        'bytes',
        text.length,
        'nodes',
        compact.nodes.length,
        'models',
        compact.models.length,
        'scopes',
        compact.scopes.length,
        'parts',
        {
          nodes: JSON.stringify(compact.nodes).length,
          models: JSON.stringify(compact.models).length,
          scopes: JSON.stringify(compact.scopes).length,
          steps: JSON.stringify(compact.steps).length
        }
      )
      if (round === 0) console.log('reader queries', [...tables])
    })
  }
})
