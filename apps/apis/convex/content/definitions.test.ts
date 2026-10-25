import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import type { TestConvex } from 'convex-test'
import { convexTest } from '../../tests/convexTest'
import { describe, expect, it } from 'vitest'
import {
  type CreateReusableDefinitionInputDto,
  type ListReusableDefinitionsPageInputDto,
  type PublishReusableDefinitionDraftInputDto,
  type ReusableDefinitionListPageDto,
  type ReusableDefinitionWorkspaceDto,
  type SaveReusableDefinitionDraftInputDto
} from '@artificer-toolkit/schema/api/reusableDefinitions'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_SENSE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/senses.js'
import { SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/encounterLifecycle.js'
import { SRD_OPTIONAL_COMBAT_DEFINITIONS } from '@artificer-toolkit/source-data/srd/optionalCombat.js'
import { SRD_CONCENTRATION_DEFINITIONS } from '@artificer-toolkit/source-data/srd/concentration.js'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import {
  SRD_RULE_CAPABILITY_DEFINITIONS,
  SRD_CONDITION_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { DND5E_INITIATIVE_FACT_KEYS } from '@artificer-toolkit/rules-runtime/systems/dnd5e/initiativeFactAdapter'
import {
  SRD_DND5E_SPEED_FACTOR_DECLARATION_MODIFIERS,
  SRD_DND5E_SPEED_FACTOR_INITIATIVE_GRAPH
} from '@artificer-toolkit/source-data/srd/initiativePolicies.js'
import { ruleGraphDefinitionDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import { dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/encounterLifecycle'
import { initiativePolicyReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/initiativePolicy'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { sourceImportDefinitionDtoSchema } from '@artificer-toolkit/schema/api/sourceImport'
import { reusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { createSystemSourceReader } from '../authoring/systemSources'
import { components, internal } from '../_generated/api'
import authSchema from '../betterAuth/schema'
import schema from '../schema'
import { encodeDefinitionDocument } from './definitionDocumentJson'

process.env.SITE_URL = 'http://localhost:3000'
process.env.BETTER_AUTH_SECRET = 'test-secret-that-is-long-enough'

const get = makeFunctionReference<
  'query',
  { definitionId: string },
  ReusableDefinitionWorkspaceDto
>('content/definitions:get')
const list = makeFunctionReference<
  'query',
  ListReusableDefinitionsPageInputDto,
  ReusableDefinitionListPageDto
>('content/definitions:list')
const create = makeFunctionReference<
  'mutation',
  CreateReusableDefinitionInputDto,
  ReusableDefinitionWorkspaceDto
>('content/definitions:create')
const saveDraft = makeFunctionReference<
  'mutation',
  SaveReusableDefinitionDraftInputDto,
  ReusableDefinitionWorkspaceDto
>('content/definitions:saveDraft')
const publish = makeFunctionReference<
  'mutation',
  PublishReusableDefinitionDraftInputDto,
  ReusableDefinitionWorkspaceDto
>('content/definitions:publish')

async function caller(t: TestConvex<typeof schema>, name: string) {
  const user = await t.run(async (ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name,
          email: `${crypto.randomUUID()}@example.invalid`,
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
          token: crypto.randomUUID(),
          expiresAt: Date.now() + 60_000,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
  )
  const profile = await t.run((ctx) =>
    ctx.db
      .query('userProfiles')
      .withIndex('by_authUserId', (q) => q.eq('authUserId', user._id))
      .unique()
  )
  if (!profile) throw new Error('Missing Better Auth profile')
  return {
    caller: t.withIdentity({ subject: user._id, sessionId: session._id }),
    userId: profile.userId
  }
}

async function fixture() {
  const t = convexTest(schema, import.meta.glob('/apps/apis/convex/**/*.*s'))
  t.registerComponent('betterAuth', authSchema, import.meta.glob('../betterAuth/**/*.*s'))
  await t.mutation(internal.content.import.bootstrap, {
    systems: [
      {
        id: srdSystemRecord.id,
        document: jsonValueSchema.parse(JSON.parse(JSON.stringify(srdSystemRecord))),
        checksum: checksumRuleDocument(srdSystemRecord)
      }
    ],
    contentSource: SRD_CONTENT_SOURCE,
    catalogue: SRD_RULES_CATALOGUE
  })
  const first = await caller(t, 'Definition A')
  const second = await caller(t, 'Definition B')
  return { t, a: first.caller, aUserId: first.userId, b: second.caller, bUserId: second.userId }
}

function sense(id: string) {
  return { ...SRD_SENSE_DEFINITIONS[0].document, id }
}

async function publishDocument(
  a: Awaited<ReturnType<typeof fixture>>['a'],
  family: string,
  candidate: unknown
) {
  const created = await a.mutation(create, {
    gameSystemId: srdSystemRecord.id,
    definitionFamilyKey: family,
    label: family,
    description: null
  })
  const document = { ...reusableDefinitionDocumentDtoSchema.parse(candidate), id: created.id }
  const saved = await a.mutation(saveDraft, {
    definitionId: created.id,
    expectedDefinitionVersion: 0,
    expectedDraftVersion: null,
    document
  })
  expect(saved.draft).toMatchObject({
    document,
    checksum: checksumRuleDocument(document),
    version: 0
  })
  const published = await a.mutation(publish, {
    definitionId: created.id,
    expectedDefinitionVersion: 0,
    expectedDraftVersion: 0
  })
  expect(published).toMatchObject({
    version: 1,
    draft: null,
    draftVersion: null,
    current: { document, checksum: checksumRuleDocument(document) }
  })
  expect(await a.query(get, { definitionId: created.id })).toEqual(published)
  return published
}

async function definitionRows(t: TestConvex<typeof schema>, definitionId: string) {
  return t.run(async (ctx) => ({
    root: await ctx.db
      .query('reusableDefinitions')
      .withIndex('by_publicId', (q) => q.eq('id', definitionId))
      .unique(),
    draft: await ctx.db
      .query('reusableDefinitionDrafts')
      .withIndex('by_definitionId', (q) => q.eq('definitionId', definitionId))
      .unique()
  }))
}

function legendaryLifecycle(id: string, graph: ReusableDefinitionWorkspaceDto) {
  const canonical = dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema.parse(
    SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS[1].document
  )
  if (canonical.kind !== 'LEGENDARY_ACTION' || !graph.current)
    throw new Error('Missing canonical legendary action fixture')
  return {
    ...canonical,
    id,
    eligibilityGraph: {
      ...canonical.eligibilityGraph,
      definitionId: graph.id,
      definitionVersion: graph.current.version,
      definitionChecksum: graph.current.checksum
    }
  }
}

describe('native reusable definitions', () => {
  it('requires an actual Better Auth session for all public operations', async () => {
    const t = convexTest(schema, import.meta.glob('/apps/apis/convex/**/*.*s'))
    t.registerComponent('betterAuth', authSchema, import.meta.glob('../betterAuth/**/*.*s'))
    const id = crypto.randomUUID()
    await expect(t.query(get, { definitionId: id })).rejects.toThrow('Unauthenticated')
    await expect(
      t.query(list, { gameSystemId: srdSystemRecord.id, cursor: null, limit: 1 })
    ).rejects.toThrow('Unauthenticated')
    await expect(
      t.mutation(create, {
        gameSystemId: srdSystemRecord.id,
        definitionFamilyKey: 'sense',
        label: 'Night sight',
        description: null
      })
    ).rejects.toThrow('Unauthenticated')
    await expect(
      t.mutation(saveDraft, {
        definitionId: id,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: null,
        document: sense(id)
      })
    ).rejects.toThrow('Unauthenticated')
    await expect(
      t.mutation(publish, {
        definitionId: id,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: 0
      })
    ).rejects.toThrow('Unauthenticated')
  })

  it('keeps USER roots private and enforces draft/current version pins', async () => {
    const { a, b } = await fixture()
    const created = await a.mutation(create, {
      gameSystemId: srdSystemRecord.id,
      definitionFamilyKey: 'sense',
      label: 'Night sight',
      description: null
    })
    expect(created).toMatchObject({
      version: 0,
      draftVersion: null,
      current: null,
      draft: null,
      editable: true
    })
    await expect(b.query(get, { definitionId: created.id })).rejects.toThrow('unavailable')
    const first = await a.mutation(saveDraft, {
      definitionId: created.id,
      expectedDefinitionVersion: 0,
      expectedDraftVersion: null,
      document: sense(created.id)
    })
    expect(first.draft).toMatchObject({ version: 0, baseDefinitionVersion: 0 })
    const saves = await Promise.allSettled([
      a.mutation(saveDraft, {
        definitionId: created.id,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: 0,
        document: sense(created.id)
      }),
      a.mutation(saveDraft, {
        definitionId: created.id,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: 0,
        document: sense(created.id)
      })
    ])
    expect(saves.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    await expect(
      b.mutation(publish, {
        definitionId: created.id,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: 0
      })
    ).rejects.toThrow()
    const draftVersion = (
      saves.find(
        (result) => result.status === 'fulfilled'
      ) as PromiseFulfilledResult<ReusableDefinitionWorkspaceDto>
    ).value.draft?.version
    if (draftVersion === undefined) throw new Error('Missing saved draft version')
    const publishes = await Promise.allSettled([
      a.mutation(publish, {
        definitionId: created.id,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: draftVersion
      }),
      a.mutation(publish, {
        definitionId: created.id,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: draftVersion
      })
    ])
    expect(publishes.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    const published = (
      publishes.find(
        (result) => result.status === 'fulfilled'
      ) as PromiseFulfilledResult<ReusableDefinitionWorkspaceDto>
    ).value
    expect(published).toMatchObject({
      version: 1,
      draftVersion: null,
      currentVersion: 1,
      draft: null
    })
    await expect(
      a.mutation(publish, {
        definitionId: created.id,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: draftVersion
      })
    ).rejects.toThrow('stale')
  }, 30000)

  it('paginates only indexed platform and caller-owned rows', async () => {
    const { a, b } = await fixture()
    const ids: string[] = []
    for (const label of ['Alpha', 'Bravo', 'Charlie'])
      ids.push(
        (
          await a.mutation(create, {
            gameSystemId: srdSystemRecord.id,
            definitionFamilyKey: 'sense',
            label,
            description: null
          })
        ).id
      )
    const privateId = (
      await b.mutation(create, {
        gameSystemId: srdSystemRecord.id,
        definitionFamilyKey: 'sense',
        label: 'Private',
        description: null
      })
    ).id
    const first = await a.query(list, { gameSystemId: srdSystemRecord.id, cursor: null, limit: 2 })
    const second = await a.query(list, {
      gameSystemId: srdSystemRecord.id,
      cursor: first.continueCursor,
      limit: 2
    })
    expect([...first.page, ...second.page].map((entry) => entry.id).sort()).toEqual(ids.sort())
    expect(first.continueCursor).not.toContain(privateId)
    expect(JSON.stringify([first, second])).not.toContain('Private')
  }, 30000)

  it('rechecks actual source ownership before publishing a saved draft', async () => {
    const { t, a, bUserId } = await fixture()
    const created = await a.mutation(create, {
      gameSystemId: srdSystemRecord.id,
      definitionFamilyKey: 'sense',
      label: 'Ownership check',
      description: null
    })
    await a.mutation(saveDraft, {
      definitionId: created.id,
      expectedDefinitionVersion: 0,
      expectedDraftVersion: null,
      document: sense(created.id)
    })
    const source = await t.run((ctx) =>
      ctx.db
        .query('contentSources')
        .withIndex('by_publicId', (q) => q.eq('id', created.contentSourceId))
        .unique()
    )
    if (!source) throw new Error('Missing native source')
    await t.run((ctx) => ctx.db.patch(source._id, { ownerUserId: bUserId }))
    await expect(
      a.mutation(publish, {
        definitionId: created.id,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: 0
      })
    ).rejects.toThrow()
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('reusableDefinitionDrafts')
          .withIndex('by_definitionId', (q) => q.eq('definitionId', created.id))
          .unique()
      )
    ).toMatchObject({ version: 0 })
  })

  it('decodes immutable canonical PLATFORM rows with their original publication metadata', async () => {
    const { t, a } = await fixture()
    const definition = sourceImportDefinitionDtoSchema.parse({
      ...SRD_SENSE_DEFINITIONS[0],
      definitionFamilyKey: 'sense'
    })
    await t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: [definition]
    })
    const before = await t.run((ctx) =>
      ctx.db
        .query('reusableDefinitions')
        .withIndex('by_publicId', (q) => q.eq('id', definition.id))
        .unique()
    )
    const workspace = await a.query(get, { definitionId: definition.id })
    expect(workspace).toMatchObject({
      sourceKind: 'PLATFORM',
      editable: false,
      version: 1,
      currentVersion: 1
    })
    expect(workspace.current).toMatchObject({
      contractVersion: 1,
      checksum: definition.checksum,
      publishedBy: srdSystemRecord.userId
    })
    await expect(
      a.mutation(saveDraft, {
        definitionId: definition.id,
        expectedDefinitionVersion: 1,
        expectedDraftVersion: null,
        document: reusableDefinitionDocumentDtoSchema.parse(definition.document)
      })
    ).rejects.toThrow()
    expect(
      await t.mutation(internal.content.import.importDefinitions, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        definitions: [definition]
      })
    ).toEqual({ inserted: 0, reused: 1, replaced: 0 })
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('reusableDefinitions')
          .withIndex('by_publicId', (q) => q.eq('id', definition.id))
          .unique()
      )
    ).toEqual(before)
  })

  it('does not create compiler-generated effect actions as standalone roots', async () => {
    const { a } = await fixture()
    await expect(
      a.mutation(create, {
        gameSystemId: srdSystemRecord.id,
        definitionFamilyKey: 'effect-action',
        label: 'Generated action',
        description: null
      })
    ).rejects.toThrow('unavailable')
  })

  it('excludes unpublished native roots from authoring options and rejects tampered evidence without mutation', async () => {
    const { t, a, aUserId } = await fixture()
    const created = await a.mutation(create, {
      gameSystemId: srdSystemRecord.id,
      definitionFamilyKey: 'sense',
      label: 'Draft only',
      description: null
    })
    const before = await t.run((ctx) =>
      createSystemSourceReader(ctx, srdSystemRecord.id, aUserId).then((reader) =>
        reader('reusable_definitions', ['id', 'label'], undefined, srdSystemRecord.id)
      )
    )
    expect(before).not.toContainEqual({ id: created.id, label: 'Draft only' })
    await a.mutation(saveDraft, {
      definitionId: created.id,
      expectedDefinitionVersion: 0,
      expectedDraftVersion: null,
      document: sense(created.id)
    })
    await a.mutation(publish, {
      definitionId: created.id,
      expectedDefinitionVersion: 0,
      expectedDraftVersion: 0
    })
    const root = await t.run((ctx) =>
      ctx.db
        .query('reusableDefinitions')
        .withIndex('by_publicId', (q) => q.eq('id', created.id))
        .unique()
    )
    if (!root) throw new Error('Missing native root')
    await t.run((ctx) =>
      ctx.db.patch(root._id, { documentJson: encodeDefinitionDocument(sense(crypto.randomUUID())) })
    )
    await expect(a.query(get, { definitionId: created.id })).rejects.toThrow()
  })

  it.each([
    SRD_RULE_CAPABILITY_DEFINITIONS[0],
    SRD_CONDITION_RULE_STATE_DEFINITIONS[0],
    SRD_OPTIONAL_COMBAT_DEFINITIONS.find((definition) => definition.label === 'Disarm')!,
    SRD_CONCENTRATION_DEFINITIONS.find(
      (definition) => definition.definitionFamilyKey === 'rule-maintenance'
    )!
  ])(
    'saves and publishes canonical $definitionFamilyKey documents through the native publisher',
    async (definition) => {
      const { a } = await fixture()
      await publishDocument(a, definition.definitionFamilyKey, definition.document)
    }
  )

  it('authors and publishes a basic-action catalogue entry through the ordinary flow (Q11)', async () => {
    const { a } = await fixture()
    const firstAid = SRD_BASIC_ACTION_DEFINITIONS.find(
      ({ id }) => id === SRD_BASIC_ACTION_IDS.FIRST_AID
    )!
    const published = await publishDocument(a, 'basic-action', {
      ...firstAid.document,
      rulesText: 'Patch up an ally as a bonus action.',
      actionCost: 'BONUS_ACTION'
    })
    expect(published.current?.document).toMatchObject({
      kind: 'BASIC_ACTION',
      actionCost: 'BONUS_ACTION',
      effects: [{ invocation: { triggerCode: 'CHECK' } }]
    })
    const created = await a.mutation(create, {
      gameSystemId: srdSystemRecord.id,
      definitionFamilyKey: 'basic-action',
      label: 'Wrong family',
      description: null
    })
    await expect(
      a.mutation(saveDraft, {
        definitionId: created.id,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: null,
        document: sense(created.id)
      })
    ).rejects.toThrow()
  })

  it('saves and publishes an initiative policy with installed D&D graphs and exact current pins', async () => {
    const { a } = await fixture()
    const score = await publishDocument(
      a,
      'rules-runtime-graph',
      SRD_DND5E_SPEED_FACTOR_INITIATIVE_GRAPH
    )
    // The bounded System-fact graph matches the existing neutral publisher initiative fixture.
    const choice = await publishDocument(
      a,
      'rules-runtime-graph',
      ruleGraphDefinitionDtoSchema.parse({
        schemaVersion: 1,
        id: crypto.randomUUID(),
        gameSystemId: srdSystemRecord.id,
        definitionFamilyKey: 'rules-runtime-graph',
        nodes: [
          {
            id: 'selected-index',
            operation: { key: 'number.add', contractVersion: 1 },
            inputs: {
              left: { kind: 'FACT', factKey: DND5E_INITIATIVE_FACT_KEYS.orderChoiceMinimumIndex },
              right: { kind: 'FACT', factKey: DND5E_INITIATIVE_FACT_KEYS.orderChoiceMaximumIndex }
            }
          }
        ],
        outputs: { selectedIndex: { kind: 'NODE_OUTPUT', nodeId: 'selected-index', port: 'value' } }
      })
    )
    if (!score.current || !choice.current) throw new Error('Missing published initiative graph')
    const scorePin = {
      definitionId: score.id,
      definitionVersion: score.current.version,
      definitionChecksum: score.current.checksum,
      scoreOutput: 'score',
      sortDirection: 'DESCENDING',
      automaticOutput: 'automatic'
    }
    await publishDocument(
      a,
      'initiative-policy',
      initiativePolicyReusableDefinitionDocumentDtoSchema.parse({
        schemaVersion: 1,
        kind: 'INITIATIVE_POLICY',
        id: crypto.randomUUID(),
        gameSystemId: srdSystemRecord.id,
        procedure: 'DECLARED_ACTION_ROLL',
        cadence: 'EACH_ROUND',
        evaluationGraph: scorePin,
        orderChoiceGraph: {
          definitionId: choice.id,
          definitionVersion: choice.current.version,
          definitionChecksum: choice.current.checksum,
          selectionOutput: 'selectedIndex',
          minimumIndexFact: DND5E_INITIATIVE_FACT_KEYS.orderChoiceMinimumIndex,
          maximumIndexFact: DND5E_INITIATIVE_FACT_KEYS.orderChoiceMaximumIndex
        },
        tieResolvers: [{ ...scorePin, repeatOnTie: true, maximumAttempts: 20 }],
        defaultTieResolverDefinitionId: score.id,
        declarationModifiers: SRD_DND5E_SPEED_FACTOR_DECLARATION_MODIFIERS
      })
    )
  })

  it('rejects another user’s private graph on save and rechecks dependency privacy on publish', async () => {
    const { t, a, b, bUserId } = await fixture()
    const privateGraph = await publishDocument(
      b,
      'rules-runtime-graph',
      SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS[0].document
    )
    const created = await a.mutation(create, {
      gameSystemId: srdSystemRecord.id,
      definitionFamilyKey: 'dnd5e-encounter-lifecycle',
      label: 'Private dependency',
      description: null
    })
    const initial = JSON.stringify(await definitionRows(t, created.id))
    await expect(
      a.mutation(saveDraft, {
        definitionId: created.id,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: null,
        document: legendaryLifecycle(created.id, privateGraph)
      })
    ).rejects.toThrow('unavailable')
    expect(JSON.stringify(await definitionRows(t, created.id))).toBe(initial)

    const ownGraph = await publishDocument(
      a,
      'rules-runtime-graph',
      SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS[0].document
    )
    await a.mutation(saveDraft, {
      definitionId: created.id,
      expectedDefinitionVersion: 0,
      expectedDraftVersion: null,
      document: legendaryLifecycle(created.id, ownGraph)
    })
    const saved = JSON.stringify(await definitionRows(t, created.id))
    // Move only the dependency into the other user's valid private source; the lifecycle remains owned by A.
    const dependency = (await definitionRows(t, ownGraph.id)).root
    if (!dependency) throw new Error('Missing dependency root')
    await t.run((ctx) =>
      ctx.db.patch(dependency._id, {
        contentSourceId: privateGraph.contentSourceId,
        ownerUserId: bUserId
      })
    )
    await expect(
      a.mutation(publish, {
        definitionId: created.id,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: 0
      })
    ).rejects.toThrow('unavailable')
    expect(JSON.stringify(await definitionRows(t, created.id))).toBe(saved)
  })

  it('publishes a lifecycle backed by the same user’s published graph', async () => {
    const { a } = await fixture()
    const graph = await publishDocument(
      a,
      'rules-runtime-graph',
      SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS[0].document
    )
    await publishDocument(
      a,
      'dnd5e-encounter-lifecycle',
      legendaryLifecycle(crypto.randomUUID(), graph)
    )
  })

  it.each(['version', 'checksum'] as const)(
    'rejects a changed dependency %s at publish without changing root or draft bytes',
    async (changed) => {
      const { t, a } = await fixture()
      const graph = await publishDocument(
        a,
        'rules-runtime-graph',
        SRD_ENCOUNTER_LIFECYCLE_DEFINITIONS[0].document
      )
      const created = await a.mutation(create, {
        gameSystemId: srdSystemRecord.id,
        definitionFamilyKey: 'dnd5e-encounter-lifecycle',
        label: 'Pinned lifecycle',
        description: null
      })
      await a.mutation(saveDraft, {
        definitionId: created.id,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: null,
        document: legendaryLifecycle(created.id, graph)
      })
      const before = JSON.stringify(await definitionRows(t, created.id))
      if (!graph.current) throw new Error('Missing published graph')
      if (changed === 'version') {
        await a.mutation(saveDraft, {
          definitionId: graph.id,
          expectedDefinitionVersion: 1,
          expectedDraftVersion: null,
          document: graph.current.document
        })
        await a.mutation(publish, {
          definitionId: graph.id,
          expectedDefinitionVersion: 1,
          expectedDraftVersion: 0
        })
      } else {
        const root = (await definitionRows(t, graph.id)).root
        if (!root) throw new Error('Missing graph root')
        const document = ruleGraphDefinitionDtoSchema.parse(graph.current.document)
        document.outputs.revision = { kind: 'LITERAL', value: 2 }
        await t.run((ctx) =>
          ctx.db.patch(root._id, {
            documentJson: encodeDefinitionDocument(document),
            checksum: checksumRuleDocument(document)
          })
        )
      }
      await expect(
        a.mutation(publish, {
          definitionId: created.id,
          expectedDefinitionVersion: 0,
          expectedDraftVersion: 0
        })
      ).rejects.toThrow('exact current')
      expect(JSON.stringify(await definitionRows(t, created.id))).toBe(before)
    }
  )

  it.each(['checksum', 'author'] as const)(
    'rejects a corrupted draft %s on get/save/publish without changing rows',
    async (corruption) => {
      const { t, a, bUserId } = await fixture()
      const created = await a.mutation(create, {
        gameSystemId: srdSystemRecord.id,
        definitionFamilyKey: 'sense',
        label: 'Corrupted draft',
        description: null
      })
      await a.mutation(saveDraft, {
        definitionId: created.id,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: null,
        document: sense(created.id)
      })
      const { draft } = await definitionRows(t, created.id)
      if (!draft) throw new Error('Missing saved draft')
      await t.run((ctx) =>
        ctx.db.patch(
          draft._id,
          corruption === 'checksum' ? { checksum: '0'.repeat(64) } : { authorUserId: bUserId }
        )
      )
      const before = JSON.stringify(await definitionRows(t, created.id))
      await expect(a.query(get, { definitionId: created.id })).rejects.toThrow('integrity')
      expect(JSON.stringify(await definitionRows(t, created.id))).toBe(before)
      await expect(
        a.mutation(saveDraft, {
          definitionId: created.id,
          expectedDefinitionVersion: 0,
          expectedDraftVersion: 0,
          document: sense(created.id)
        })
      ).rejects.toThrow('integrity')
      expect(JSON.stringify(await definitionRows(t, created.id))).toBe(before)
      await expect(
        a.mutation(publish, {
          definitionId: created.id,
          expectedDefinitionVersion: 0,
          expectedDraftVersion: 0
        })
      ).rejects.toThrow('integrity')
      expect(JSON.stringify(await definitionRows(t, created.id))).toBe(before)
    }
  )

  it('rejects a stale-base draft on get/save/publish without mutating rows', async () => {
    const { t, a } = await fixture()
    const created = await a.mutation(create, {
      gameSystemId: srdSystemRecord.id,
      definitionFamilyKey: 'sense',
      label: 'Stale draft base',
      description: null
    })
    const initialDraft = await a.mutation(saveDraft, {
      definitionId: created.id,
      expectedDefinitionVersion: 0,
      expectedDraftVersion: null,
      document: sense(created.id)
    })
    await a.mutation(publish, {
      definitionId: created.id,
      expectedDefinitionVersion: 0,
      expectedDraftVersion: initialDraft.draft?.version ?? 0
    })
    await a.mutation(saveDraft, {
      definitionId: created.id,
      expectedDefinitionVersion: 1,
      expectedDraftVersion: null,
      document: sense(created.id)
    })
    const stored = await definitionRows(t, created.id)
    if (!stored.draft) throw new Error('Missing second draft row')
    await t.run((ctx) =>
      ctx.db.patch(stored.draft!._id, {
        baseDefinitionVersion: 0
      })
    )
    const before = JSON.stringify(await definitionRows(t, created.id))
    await expect(a.query(get, { definitionId: created.id })).rejects.toThrow(/integrity|stale/)
    expect(JSON.stringify(await definitionRows(t, created.id))).toBe(before)
    await expect(
      a.mutation(saveDraft, {
        definitionId: created.id,
        expectedDefinitionVersion: 1,
        expectedDraftVersion: 0,
        document: sense(created.id)
      })
    ).rejects.toThrow(/integrity|stale/)
    expect(JSON.stringify(await definitionRows(t, created.id))).toBe(before)
    await expect(
      a.mutation(publish, {
        definitionId: created.id,
        expectedDefinitionVersion: 1,
        expectedDraftVersion: 0
      })
    ).rejects.toThrow(/integrity|stale/)
    expect(JSON.stringify(await definitionRows(t, created.id))).toBe(before)
  })

  it('does not count more than 500 unpublished roots against the published source-option limit', async () => {
    const { t, a, aUserId } = await fixture()
    const published = await publishDocument(a, 'sense', sense(crypto.randomUUID()))
    await t.run(async (ctx) => {
      for (let index = 0; index < 501; index++) {
        await ctx.db.insert('reusableDefinitions', {
          id: crypto.randomUUID(),
          gameSystemId: srdSystemRecord.id,
          contentSourceId: published.contentSourceId,
          ownerUserId: aUserId,
          definitionFamilyKey: 'sense',
          label: `Unpublished ${index}`,
          description: null,
          version: 0
        })
      }
    })
    const options = await t.run(async (ctx) =>
      (await createSystemSourceReader(ctx, srdSystemRecord.id, aUserId))(
        'reusable_definitions',
        ['id', 'label'],
        undefined,
        srdSystemRecord.id
      )
    )
    expect(options).toEqual([{ id: published.id, label: published.label }])
  })

  it('rejects unpublished roots with stray current publication data without changing rows', async () => {
    const { t, a } = await fixture()
    const created = await a.mutation(create, {
      gameSystemId: srdSystemRecord.id,
      definitionFamilyKey: 'sense',
      label: 'Invalid unpublished root',
      description: null
    })
    const { root } = await definitionRows(t, created.id)
    if (!root) throw new Error('Missing unpublished root')
    const document = sense(created.id)
    await t.run((ctx) =>
      ctx.db.patch(root._id, {
        documentJson: encodeDefinitionDocument(document),
        checksum: checksumRuleDocument(document)
      })
    )
    const before = JSON.stringify(await definitionRows(t, created.id))
    await expect(a.query(get, { definitionId: created.id })).rejects.toThrow('integrity')
    await expect(
      a.mutation(saveDraft, {
        definitionId: created.id,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: null,
        document
      })
    ).rejects.toThrow('integrity')
    await expect(
      a.mutation(publish, {
        definitionId: created.id,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: 0
      })
    ).rejects.toThrow('integrity')
    expect(JSON.stringify(await definitionRows(t, created.id))).toBe(before)
  })
})
