import { createFunctionHandle } from 'convex/server'
import type { TestConvex } from 'convex-test'
import { convexTest } from '../../tests/convexTest'
import { describe, expect, it } from 'vitest'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { DND5E_INITIATIVE_FACT_KEYS } from '@artificer-toolkit/rules-runtime/systems/dnd5e/initiativeFactAdapter'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  add,
  fourFateDice,
  nodeOutput,
  tracerGraph
} from '../../../../packages/rules-runtime/src/__tests__/tracer/graph'
import {
  TRACER_SYSTEM_ID,
  tracerSystem
} from '../../../../packages/rules-runtime/src/__tests__/tracer/system'
import { api, components, internal } from '../_generated/api'
import authSchema from '../betterAuth/schema'
import schema from '../schema'

process.env.SITE_URL = 'http://localhost:3000'
process.env.BETTER_AUTH_SECRET = 'test-secret-that-is-long-enough'

const TRACER_CATALOGUE = {
  id: '00000000-0000-4000-8000-0000000f0f01',
  gameSystemId: TRACER_SYSTEM_ID,
  code: 'tracer-core',
  label: 'Tracer core',
  description: 'The tracer System catalogue.'
}

const TRACER_CONTENT_SOURCE = {
  id: '00000000-0000-4000-8000-0000000f0f02',
  gameSystemId: TRACER_SYSTEM_ID,
  kind: 'PLATFORM',
  ownerUserId: null,
  code: 'tracer-core',
  label: 'Tracer core',
  description: 'The tracer System platform source.'
} as const

async function bootstrap(
  t: TestConvex<typeof schema>,
  system: { id: string },
  contentSource: typeof SRD_CONTENT_SOURCE | typeof TRACER_CONTENT_SOURCE,
  catalogue: typeof SRD_RULES_CATALOGUE | typeof TRACER_CATALOGUE
) {
  await t.mutation(internal.content.import.bootstrap, {
    systems: [
      {
        id: system.id,
        document: jsonValueSchema.parse(JSON.parse(JSON.stringify(system))),
        checksum: checksumRuleDocument(system)
      }
    ],
    contentSource,
    catalogue
  })
}

/** Both Systems installed and imported, read by one signed-in author. */
async function fixture() {
  const t = convexTest(schema, import.meta.glob('/apps/apis/convex/**/*.*s'))
  t.registerComponent('betterAuth', authSchema, import.meta.glob('../betterAuth/**/*.*s'))
  await bootstrap(t, srdSystemRecord, SRD_CONTENT_SOURCE, SRD_RULES_CATALOGUE)
  await bootstrap(t, tracerSystem, TRACER_CONTENT_SOURCE, TRACER_CATALOGUE)
  const user = await t.run(async (ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name: 'Tracer author',
          email: 'tracer-author@example.invalid',
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      },
      onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
    })
  )
  const session = await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'session',
        data: {
          userId: user._id,
          token: 'tracer-author-session',
          expiresAt: Date.now() + 60_000,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
  )
  return t.withIdentity({ subject: user._id, sessionId: session._id })
}

type Author = Awaited<ReturnType<typeof fixture>>

async function createGraph(author: Author, definitionFamilyKey = 'rules-runtime-graph') {
  return author.mutation(api.content.definitions.create, {
    gameSystemId: TRACER_SYSTEM_ID,
    definitionFamilyKey,
    label: 'Overcome',
    description: 'Four Fate dice.'
  })
}

const saveFirstDraft = (author: Author, graph: ReturnType<typeof tracerGraph>) =>
  author.mutation(api.content.definitions.saveDraft, {
    definitionId: graph.id,
    expectedDefinitionVersion: 0,
    expectedDraftVersion: null,
    document: jsonValueSchema.parse(JSON.parse(JSON.stringify(graph)))
  })

const publishFirstDraft = (author: Author, definitionId: string) =>
  author.mutation(api.content.definitions.publish, {
    definitionId,
    expectedDefinitionVersion: 0,
    expectedDraftVersion: 0
  })

describe('a second System through the real Convex reads and publication (AUTHORING-1.T2)', () => {
  it('lists, summarizes and reads the tracer with its own catalogue beside the SRD', async () => {
    const author = await fixture()
    const listed = await author.query(api.content.systems.list, { cursor: null, limit: 10 })
    expect(listed.page.map(({ id }) => id).toSorted()).toEqual(
      [srdSystemRecord.id, TRACER_SYSTEM_ID].toSorted()
    )
    expect(await author.query(api.content.systems.summary, { id: TRACER_SYSTEM_ID })).toEqual({
      id: TRACER_SYSTEM_ID,
      label: 'Tracer',
      description: null,
      rulesetCode: 'TRACER',
      rulesetVersion: '1',
      userId: tracerSystem.userId,
      rulesCatalogues: [
        {
          id: TRACER_CATALOGUE.id,
          label: TRACER_CATALOGUE.label,
          description: TRACER_CATALOGUE.description
        }
      ]
    })
    const document = await author.query(api.content.systems.get, { id: TRACER_SYSTEM_ID })
    expect(document?.abilities.map(({ code }) => code)).toEqual(
      tracerSystem.abilities.map(({ code }) => code)
    )
    expect(document?.damageTypes).toEqual([])
  })

  it('offers the shell the tracer capability: no content kinds, only its own families', async () => {
    const author = await fixture()
    const capability = await author.query(api.content.systems.capability, { id: TRACER_SYSTEM_ID })
    expect(capability?.gameSystemId).toBe(TRACER_SYSTEM_ID)
    expect(capability?.contentKinds).toEqual([])
    expect(capability?.authoredRootKinds).toEqual([])
    expect(capability?.definitionFamilyKeys.toSorted()).toEqual(
      ['initiative-policy', 'rules-runtime-graph'].toSorted()
    )
  })

  it('reads empty catalogues for the tracer, whatever the SRD holds', async () => {
    const author = await fixture()
    expect(
      await author.query(api.content.catalogue.counts, {
        subjectKind: 'CREATURE',
        systemId: TRACER_SYSTEM_ID
      })
    ).toEqual({ activeCount: 0, masterCount: 0, ownedCount: 0 })
  })

  it('publishes a tracer graph into an owned tracer source and reads it back', async () => {
    const author = await fixture()
    const created = await createGraph(author)
    const graph = tracerGraph(created.id, fourFateDice, { total: nodeOutput('dice') })
    await saveFirstDraft(author, graph)
    const published = await publishFirstDraft(author, created.id)
    expect(published.current?.document).toEqual(graph)
    expect(published.gameSystemId).toBe(TRACER_SYSTEM_ID)
    expect(await author.query(api.content.definitions.get, { definitionId: created.id })).toEqual(
      published
    )
    const listed = await author.query(api.content.definitions.list, {
      gameSystemId: TRACER_SYSTEM_ID,
      cursor: null,
      limit: 10
    })
    expect(listed.page.map(({ id }) => id)).toEqual([created.id])
    const srd = await author.query(api.content.definitions.list, {
      gameSystemId: srdSystemRecord.id,
      cursor: null,
      limit: 10
    })
    expect(srd.page.map(({ id }) => id)).not.toContain(created.id)
  })

  it('refuses a D&D fact in a tracer graph, against the tracer contract', async () => {
    const author = await fixture()
    const created = await createGraph(author)
    const dndFact = { kind: 'FACT', factKey: DND5E_INITIATIVE_FACT_KEYS.modifier }
    await expect(
      saveFirstDraft(
        author,
        tracerGraph(created.id, [...fourFateDice, add('score', nodeOutput('dice'), dndFact)], {
          score: nodeOutput('score')
        })
      )
    ).rejects.toThrow('RULE_UNKNOWN_FACT: Unknown System fact "initiative.modifier".')
    const unchanged = await author.query(api.content.definitions.get, { definitionId: created.id })
    expect(unchanged.draft).toBeNull()
    expect(unchanged.current).toBeNull()
  })

  it('refuses a definition family the tracer does not install', async () => {
    const author = await fixture()
    await expect(createGraph(author, 'sense')).rejects.toThrow(
      'Reusable definition family is unavailable.'
    )
    await expect(createGraph(author, 'basic-action')).rejects.toThrow(
      'Reusable definition family is unavailable.'
    )
  })
})
