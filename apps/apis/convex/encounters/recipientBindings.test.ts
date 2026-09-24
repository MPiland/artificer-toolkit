import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { SceneGeometryCommandResult } from '@artificer-toolkit/schema/api/sceneGeometry'
import type {
  SceneEncounterBinding,
  SceneEncounterBindingInput,
  SceneRecipientEncounterBindingsInput,
  SceneRecipientEncounterBindingsPage,
  SceneRecipientHeader
} from '@artificer-toolkit/schema/api/sceneRecipient'
import type {
  BindEncounterToPresentedSceneInputDto,
  BindEncounterToPresentedSceneResultDto,
  SceneGeometryCommandInputDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { encounterActorTokenBindingSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { sceneStoredDefinitionSaveSchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { createEncounterSceneFixture as setup } from '../../tests/fixtures/encounterScene'

const bindScene = makeFunctionReference<
  'mutation',
  BindEncounterToPresentedSceneInputDto,
  BindEncounterToPresentedSceneResultDto
>('encounters/sceneBindings:bind')
const getBinding = makeFunctionReference<
  'query',
  SceneEncounterBindingInput,
  SceneEncounterBinding | null
>('encounters/sceneBindings:get')
const encounterBindings = makeFunctionReference<
  'action',
  SceneRecipientEncounterBindingsInput,
  SceneRecipientEncounterBindingsPage
>('scenes/recipientActions:encounterBindings')
const recipientHeader = makeFunctionReference<'query', { sceneId: string }, SceneRecipientHeader>(
  'scenes/recipientReads:header'
)
const executeGeometry = makeFunctionReference<
  'action',
  { input: SceneGeometryCommandInputDto },
  SceneGeometryCommandResult
>('scenes/geometryActions:execute')

async function publishFixtureSceneSource(base: Awaited<ReturnType<typeof setup>>) {
  await base.t.run(async (ctx) => {
    const scene = await ctx.db
      .query('campaignScenes')
      .withIndex('by_publicId', (q) => q.eq('id', base.sceneId))
      .unique()
    if (!scene) throw new Error('Missing fixture Scene.')
    const counts = {
      annotations: 0,
      barriers: 0,
      darknessZones: 0,
      lights: 0,
      tokens: base.tokens.length
    }
    await ctx.db.insert(
      'sceneDefinitionSaves',
      sceneStoredDefinitionSaveSchema.parse({
        id: base.saveId,
        commandId: scene.materializationCommandId,
        commandFingerprint: '0'.repeat(64),
        ownerUserId: base.other.userId,
        definitionId: scene.definitionId,
        expectedVersion: null,
        settings: {
          campaignId: scene.campaignId,
          name: scene.name,
          ambientIllumination: scene.ambientIllumination,
          fogMode: scene.fogMode,
          visionRevealMode: scene.visionRevealMode,
          grid: scene.grid,
          map: scene.map
        },
        counts,
        received: counts,
        status: 'PUBLISHED',
        liveSceneId: scene.id,
        entitiesRemoved: false,
        createdAt: scene.createdAt,
        expiresAt: Date.now() + 60_000
      })
    )
  })
}

async function setTokens(base: Awaited<ReturnType<typeof setup>>, hiddenTokenIndex: number | null) {
  const tokenIds = base.tokens.map((token) => token.id.toLowerCase())
  await base.t.run(async (ctx) => {
    for (const [index, token] of base.tokens.entries()) {
      const row = await ctx.db
        .query('sceneDefinitionEntities')
        .withIndex('by_saveId_collection_entityId', (q) =>
          q.eq('saveId', base.saveId).eq('value.collection', 'tokens').eq('entityId', token.id)
        )
        .unique()
      if (!row || row.value.collection !== 'tokens') throw new Error('Missing fixture token.')
      const value = {
        collection: 'tokens' as const,
        entity: {
          ...row.value.entity,
          id: tokenIds[index]!,
          hidden: hiddenTokenIndex === index,
          controlledByUserIds: [base.owner.userId]
        }
      }
      await ctx.db.patch(row._id, {
        entityId: value.entity.id,
        value,
        checksum: checksumCanonicalJson(value)
      })
    }
  })
  return tokenIds
}

async function prepare(hiddenTokenIndex: number | null = null) {
  const base = await setup()
  await publishFixtureSceneSource(base)
  const tokenIds = await setTokens(base, hiddenTokenIndex)
  await base.other.caller.mutation(bindScene, {
    type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
    commandId: crypto.randomUUID(),
    encounterId: base.run.id
  })
  return { ...base, tokenIds }
}

async function bindActorToken(
  base: Awaited<ReturnType<typeof prepare>>,
  actorIndex: number,
  tokenIndex: number
) {
  const actorId = base.run.actors[actorIndex]?.id
  const tokenId = base.tokenIds[tokenIndex]
  if (!actorId || !tokenId) throw new Error('Missing fixture binding target.')
  await base.t.run((ctx) =>
    ctx.db.insert(
      'encounterActorTokenBindings',
      encounterActorTokenBindingSchema.parse({
        actorId,
        encounterId: base.run.id,
        sceneId: base.sceneId,
        tokenId
      })
    )
  )
  return { actorId, tokenId }
}

async function bindingInput(
  base: Awaited<ReturnType<typeof prepare>>,
  caller: typeof base.other.caller,
  overrides: Partial<SceneRecipientEncounterBindingsInput> = {}
) {
  const header = await caller.query(recipientHeader, { sceneId: base.sceneId })
  return {
    encounterId: base.run.id,
    expectedEncounterVersion: base.run.version,
    sceneId: base.sceneId,
    expectedVersion: header.version,
    expectedRecipientRevision: header.recipientRevision,
    afterEntityId: null,
    numItems: 8,
    ...overrides
  }
}

describe('native Encounter recipient bindings', () => {
  it('returns the current presented binding and only exposes token bindings visible to each recipient', async () => {
    const base = await prepare(1)
    const visible = await bindActorToken(base, 0, 0)
    const hidden = await bindActorToken(base, 1, 1)

    await expect(
      base.owner.caller.query(getBinding, { encounterId: base.run.id, sceneId: base.sceneId })
    ).resolves.toEqual({
      encounterId: base.run.id,
      encounterVersion: base.run.version,
      sceneId: base.sceneId
    })

    const gm = await base.other.caller.action(
      encounterBindings,
      await bindingInput(base, base.other.caller)
    )
    expect(gm.page).toEqual([
      { ...visible, encounterId: base.run.id, sceneId: base.sceneId },
      { ...hidden, encounterId: base.run.id, sceneId: base.sceneId }
    ])

    const player = await base.owner.caller.action(
      encounterBindings,
      await bindingInput(base, base.owner.caller)
    )
    expect(player.page).toEqual([{ ...visible, encounterId: base.run.id, sceneId: base.sceneId }])
  }, 60000)

  it('keeps a visible-token continuation when its first page has no binding and suppresses removed tokens', async () => {
    const base = await prepare()
    const bound = await bindActorToken(base, 1, 1)
    const first = await base.owner.caller.action(
      encounterBindings,
      await bindingInput(base, base.owner.caller, { numItems: 1 })
    )
    expect(first).toMatchObject({ page: [], next: base.tokenIds[0] })

    const second = await base.owner.caller.action(
      encounterBindings,
      await bindingInput(base, base.owner.caller, {
        afterEntityId: first.next,
        numItems: 1
      })
    )
    expect(second).toMatchObject({
      page: [{ ...bound, encounterId: base.run.id, sceneId: base.sceneId }],
      next: null
    })

    await base.other.caller.action(executeGeometry, {
      input: {
        type: 'REMOVE_SCENE_TOKEN',
        commandId: crypto.randomUUID(),
        sceneId: base.sceneId,
        expectedSceneVersion: 0,
        tokenId: bound.tokenId
      }
    })
    await expect(
      base.owner.caller.action(encounterBindings, await bindingInput(base, base.owner.caller))
    ).resolves.toMatchObject({ page: [] })
  }, 60000)

  it('returns null without a binding and rejects foreign access or a no-longer-presented open Session', async () => {
    const unbound = await prepare()
    await unbound.t.run(async (ctx) => {
      const binding = await ctx.db
        .query('encounterSceneBindings')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', unbound.run.id))
        .unique()
      if (!binding) throw new Error('Missing Encounter Scene binding.')
      await ctx.db.delete(binding._id)
    })
    await expect(
      unbound.owner.caller.query(getBinding, {
        encounterId: unbound.run.id,
        sceneId: unbound.sceneId
      })
    ).resolves.toBeNull()

    const base = await prepare()
    await base.t.run(async (ctx) => {
      const binding = await ctx.db
        .query('encounterSceneBindings')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', base.run.id))
        .unique()
      if (!binding) throw new Error('Missing Encounter Scene binding.')
      await ctx.db.patch(binding._id, { sceneId: crypto.randomUUID() })
    })
    await expect(
      base.owner.caller.query(getBinding, { encounterId: base.run.id, sceneId: base.sceneId })
    ).resolves.toBeNull()
    await expect(
      base.t
        .withIdentity({ subject: crypto.randomUUID() })
        .query(getBinding, { encounterId: base.run.id, sceneId: base.sceneId })
    ).rejects.toThrow()
    await expect(
      base.t
        .withIdentity({ subject: crypto.randomUUID() })
        .action(encounterBindings, await bindingInput(base, base.owner.caller))
    ).rejects.toThrow()

    await base.t.run(async (ctx) => {
      const presentation = await ctx.db
        .query('campaignScenePresentations')
        .withIndex('by_campaignId_sessionId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('sessionId', base.session.id)
        )
        .unique()
      if (!presentation) throw new Error('Missing presentation.')
      await ctx.db.patch(presentation._id, { sceneId: crypto.randomUUID() })
    })
    await expect(
      base.owner.caller.query(getBinding, { encounterId: base.run.id, sceneId: base.sceneId })
    ).rejects.toThrow('presentation is stale')
    await expect(
      base.owner.caller.action(encounterBindings, await bindingInput(base, base.owner.caller))
    ).rejects.toThrow()

    await base.t.run(async (ctx) => {
      const presentation = await ctx.db
        .query('campaignScenePresentations')
        .withIndex('by_campaignId_sessionId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('sessionId', base.session.id)
        )
        .unique()
      if (!presentation) throw new Error('Missing presentation.')
      await ctx.db.patch(presentation._id, { sceneId: null })
    })
    await expect(
      base.owner.caller.query(getBinding, { encounterId: base.run.id, sceneId: base.sceneId })
    ).rejects.toThrow('presentation is stale')
  }, 60000)

  it('rejects closed Sessions and stale Encounter, Scene, or recipient revisions', async () => {
    const base = await prepare()
    const input = await bindingInput(base, base.owner.caller)
    await expect(
      base.owner.caller.action(encounterBindings, {
        ...input,
        expectedEncounterVersion: input.expectedEncounterVersion + 1
      })
    ).rejects.toThrow()
    await expect(
      base.owner.caller.action(encounterBindings, {
        ...input,
        expectedVersion: input.expectedVersion + 1
      })
    ).rejects.toThrow()
    await expect(
      base.owner.caller.action(encounterBindings, {
        ...input,
        expectedRecipientRevision: '0'.repeat(64)
      })
    ).rejects.toThrow()

    await base.t.run(async (ctx) => {
      const session = await ctx.db
        .query('campaignSessions')
        .withIndex('by_campaignId_id', (q) =>
          q.eq('campaignId', base.campaign.id).eq('id', base.session.id)
        )
        .unique()
      if (!session) throw new Error('Missing Session.')
      await ctx.db.patch(session._id, { status: 'FINISHED' })
    })
    await expect(
      base.owner.caller.query(getBinding, { encounterId: base.run.id, sceneId: base.sceneId })
    ).rejects.toThrow('not current and open')
    await expect(base.owner.caller.action(encounterBindings, input)).rejects.toThrow()
  }, 60000)
})
