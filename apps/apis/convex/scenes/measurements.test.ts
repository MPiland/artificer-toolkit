import { makeFunctionReference } from 'convex/server'
import { expect, it } from 'vitest'
import type {
  GetCampaignLiveSceneInputDto,
  SceneCommandResultDto,
  SceneLiveCommandInputDto,
  SetCampaignLiveScenePresentationInputDto,
  SetCampaignLiveScenePresentationResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import type { CampaignSessionDto } from '@artificer-toolkit/schema/api/campaignSessions'
import type { SceneGeometryExecuteInput } from '@artificer-toolkit/schema/api/sceneGeometry'
import type {
  SceneLiveChangesPageInput,
  SceneLiveEntityChangesPage,
  SceneLiveStateHeader,
  SceneLiveStateEntityPageInput,
  SceneMeasurementsPage,
  SceneMeasurementsPageInput
} from '@artificer-toolkit/schema/api/sceneLiveState'
import type { SceneDefinitionEntityPage } from '@artificer-toolkit/schema/api/sceneDefinitionSave'
import {
  sceneStoredLiveEntitySchema,
  sceneStoredLiveStateSchema
} from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { VTT_SCENE_LIMITS } from '@artificer-toolkit/shared/vtt/scene'
import {
  createSceneDefinitionFixture,
  publishEmptyScene
} from '../../tests/fixtures/sceneDefinitions'

const execute = makeFunctionReference<
  'mutation',
  { input: SceneLiveCommandInputDto; session?: NonNullable<SceneGeometryExecuteInput['session']> },
  SceneCommandResultDto
>('scenes/commands:execute')
const createSession = makeFunctionReference<'mutation', { campaignId: string }, CampaignSessionDto>(
  'campaigns/sessions:create'
)
const setPresentation = makeFunctionReference<
  'mutation',
  SetCampaignLiveScenePresentationInputDto,
  SetCampaignLiveScenePresentationResultDto
>('scenes/presentations:set')
const list = makeFunctionReference<'query', SceneMeasurementsPageInput, SceneMeasurementsPage>(
  'scenes/measurements:list'
)
const header = makeFunctionReference<'query', GetCampaignLiveSceneInputDto, SceneLiveStateHeader>(
  'scenes/liveReads:header'
)
const entities = makeFunctionReference<
  'query',
  SceneLiveStateEntityPageInput,
  SceneDefinitionEntityPage
>('scenes/liveReads:entities')
const changes = makeFunctionReference<
  'query',
  SceneLiveChangesPageInput,
  SceneLiveEntityChangesPage
>('scenes/liveReads:changes')

function measurement(createdByUserId: string, id = crypto.randomUUID(), pointCount = 2) {
  return {
    id,
    createdByUserId,
    label: 'Distance',
    path: Array.from({ length: pointCount }, (_, index) => ({ x: index * 10, y: 0 }))
  }
}

async function command(
  caller: Awaited<ReturnType<typeof createSceneDefinitionFixture>>['owner']['caller'],
  input: SceneLiveCommandInputDto,
  session?: NonNullable<SceneGeometryExecuteInput['session']>
) {
  return caller.mutation(execute, session ? { input, session } : { input })
}

async function presentSession(
  base: Awaited<ReturnType<typeof createSceneDefinitionFixture>>,
  sceneId: string
) {
  const session = await base.owner.caller.mutation(createSession, { campaignId: base.campaign.id })
  const presentation = await base.owner.caller.mutation(setPresentation, {
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: null,
    sceneId,
    sessionId: session.id
  })
  return {
    session,
    context: {
      expectedPresentationVersion: presentation.version,
      expectedSessionVersion: session.version,
      sessionId: session.id
    }
  }
}

async function liveRows(base: Awaited<ReturnType<typeof createSceneDefinitionFixture>>) {
  return base.t.run(async (ctx) => ({
    head: await ctx.db.query('sceneLiveStates').collect(),
    entities: await ctx.db.query('sceneLiveEntities').collect(),
    receipts: await ctx.db.query('sceneLiveCommands').collect()
  }))
}

async function seedMeasurements(
  base: Awaited<ReturnType<typeof createSceneDefinitionFixture>>,
  sceneId: string,
  rows: ReadonlyArray<ReturnType<typeof measurement> | null>
) {
  await base.t.run(async (ctx) => {
    for (const [ordinal, value] of rows.entries()) {
      const change = {
        sceneId,
        collection: 'measurements' as const,
        entityId: value?.id ?? `00000000-0000-4000-8000-${String(ordinal + 1).padStart(12, '0')}`,
        value: value ? { collection: 'measurements' as const, entity: value } : null,
        ordinal: value ? ordinal : null,
        version: 1
      }
      await ctx.db.insert(
        'sceneLiveEntities',
        sceneStoredLiveEntitySchema.parse({ ...change, checksum: checksumCanonicalJson(change) })
      )
    }
    await ctx.db.insert(
      'sceneLiveStates',
      sceneStoredLiveStateSchema.parse({
        sceneId,
        version: 1,
        fogLayerCount: 0,
        nextFogOrdinal: 0,
        settings: {
          ambientIllumination: { value: base.input.settings.ambientIllumination, version: 0 },
          visionRevealMode: { value: base.input.settings.visionRevealMode, version: 0 }
        },
        counts: { ...base.input.counts, measurements: rows.filter(Boolean).length },
        nextOrdinals: { ...base.input.counts, measurements: rows.length }
      })
    )
  })
}

it('keeps reducer order through remove and re-add, preserves paths, and replays removals', async () => {
  const base = await createSceneDefinitionFixture()
  const { sceneId } = await publishEmptyScene(base)
  const first = measurement(base.owner.userId, '00000000-0000-4000-8000-000000000001')
  const second = measurement(base.owner.userId, '00000000-0000-4000-8000-000000000002', 256)
  await command(base.owner.caller, {
    type: 'UPSERT_SCENE_MEASUREMENT',
    sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    measurement: first
  })
  await command(base.owner.caller, {
    type: 'UPSERT_SCENE_MEASUREMENT',
    sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 1,
    measurement: second
  })
  const remove: SceneLiveCommandInputDto = {
    type: 'REMOVE_SCENE_MEASUREMENT',
    sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 2,
    measurementId: first.id
  }
  const removed = await command(base.owner.caller, remove)
  await command(base.owner.caller, {
    type: 'UPSERT_SCENE_MEASUREMENT',
    sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 3,
    measurement: first
  })
  await expect(command(base.owner.caller, remove)).resolves.toEqual({ ...removed, replayed: true })
  const page = await base.owner.caller.query(list, {
    sceneId,
    expectedVersion: 4,
    paginationOpts: { cursor: null, numItems: 8 }
  })
  expect(page).toMatchObject({ version: 4, count: 2 })
  expect(page.page.sort((left, right) => left.ordinal - right.ordinal)).toEqual([
    { ordinal: 1, measurement: second },
    { ordinal: 2, measurement: first }
  ])
})

it('allows players to change only their own measurements and limits replays to the original actor', async () => {
  const base = await createSceneDefinitionFixture()
  const { sceneId } = await publishEmptyScene(base)
  const own = measurement(base.other.userId)
  const ownerMeasurement = measurement(base.owner.userId)
  const playerCommand: SceneLiveCommandInputDto = {
    type: 'UPSERT_SCENE_MEASUREMENT',
    sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    measurement: own
  }
  const playerResult = await command(base.other.caller, playerCommand)
  await expect(
    command(base.other.caller, {
      ...playerCommand,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 1,
      measurement: { ...own, id: crypto.randomUUID(), createdByUserId: base.owner.userId }
    })
  ).rejects.toThrow('own measurements')
  await command(base.owner.caller, {
    type: 'UPSERT_SCENE_MEASUREMENT',
    sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 1,
    measurement: ownerMeasurement
  })
  await expect(
    command(base.other.caller, {
      type: 'UPSERT_SCENE_MEASUREMENT',
      sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 2,
      measurement: { ...ownerMeasurement, createdByUserId: base.other.userId }
    })
  ).rejects.toThrow('own measurements')
  const remove: SceneLiveCommandInputDto = {
    type: 'REMOVE_SCENE_MEASUREMENT',
    sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 2,
    measurementId: own.id
  }
  const removed = await command(base.other.caller, remove)
  await expect(command(base.other.caller, remove)).resolves.toEqual({ ...removed, replayed: true })
  await expect(command(base.owner.caller, playerCommand)).resolves.toEqual({
    ...playerResult,
    replayed: true
  })
  const ownerCommand: SceneLiveCommandInputDto = {
    type: 'UPSERT_SCENE_MEASUREMENT',
    sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 3,
    measurement: measurement(base.other.userId)
  }
  await command(base.owner.caller, ownerCommand)
  await expect(command(base.other.caller, ownerCommand)).rejects.toThrow('own Scene commands')
  await expect(
    command(base.other.caller, {
      type: 'REMOVE_SCENE_MEASUREMENT',
      sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 3,
      measurementId: ownerMeasurement.id
    })
  ).rejects.toThrow('own measurements')
  expect(playerResult.replayed).toBe(false)
  await base.t.run(async (ctx) => {
    const membership = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
      )
      .unique()
    if (!membership) throw new Error('Missing player membership')
    await ctx.db.patch(membership._id, { status: 'LEFT', leftAt: new Date().toISOString() })
  })
  await expect(command(base.other.caller, remove)).rejects.toThrow('Campaign not found')
  await expect(
    base.other.caller.query(list, {
      sceneId,
      expectedVersion: null,
      paginationOpts: { cursor: null, numItems: 8 }
    })
  ).rejects.toThrow('Campaign not found')
})

it('fences inline owner and player commands to the current presented open Session before replay', async () => {
  const base = await createSceneDefinitionFixture()
  const { sceneId } = await publishEmptyScene(base)
  const { session, context } = await presentSession(base, sceneId)
  const ownerInput: SceneLiveCommandInputDto = {
    type: 'UPSERT_SCENE_ANNOTATION',
    sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    annotation: {
      id: crypto.randomUUID(),
      position: { x: 0, y: 0 },
      text: 'Owner note',
      visibility: 'TABLE'
    }
  }
  await command(base.owner.caller, ownerInput, context)
  await command(
    base.other.caller,
    {
      type: 'UPSERT_SCENE_MEASUREMENT',
      sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 1,
      measurement: measurement(base.other.userId)
    },
    context
  )
  const fresh: SceneLiveCommandInputDto = {
    type: 'UPSERT_SCENE_ANNOTATION',
    sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 2,
    annotation: {
      id: crypto.randomUUID(),
      position: { x: 1, y: 1 },
      text: 'Fresh owner note',
      visibility: 'TABLE'
    }
  }
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('campaignSessions')
      .withIndex('by_publicId', (q) => q.eq('id', session.id))
      .unique()
    if (!row) throw new Error('Missing Session.')
    await ctx.db.patch(row._id, { version: row.version + 1 })
  })
  await expect(command(base.owner.caller, ownerInput, context)).resolves.toMatchObject({
    replayed: true
  })
  await expect(command(base.owner.caller, fresh, context)).rejects.toThrow(
    'Session is not current and open'
  )
  const refreshedSessionContext = {
    ...context,
    expectedSessionVersion: context.expectedSessionVersion + 1
  }
  await base.owner.caller.mutation(setPresentation, {
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: context.expectedPresentationVersion,
    sceneId,
    sessionId: session.id
  })
  await expect(command(base.owner.caller, ownerInput, context)).resolves.toMatchObject({
    replayed: true
  })
  await expect(command(base.owner.caller, fresh, refreshedSessionContext)).rejects.toThrow(
    'presentation is stale'
  )
  await base.owner.caller.mutation(setPresentation, {
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: context.expectedPresentationVersion + 1,
    sceneId: null,
    sessionId: session.id
  })
  await expect(command(base.owner.caller, ownerInput, context)).rejects.toThrow(
    'presentation is stale'
  )
  await expect(
    command(base.owner.caller, fresh, {
      ...refreshedSessionContext,
      expectedPresentationVersion: context.expectedPresentationVersion + 2
    })
  ).rejects.toThrow('presentation is stale')
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('campaignSessions')
      .withIndex('by_publicId', (q) => q.eq('id', session.id))
      .unique()
    if (!row) throw new Error('Missing Session.')
    await ctx.db.patch(row._id, { status: 'FINISHED', finishedAt: new Date().toISOString() })
  })
  await expect(command(base.owner.caller, ownerInput, context)).rejects.toThrow(
    'Session is not current and open'
  )
  await expect(
    command(base.owner.caller, fresh, {
      ...refreshedSessionContext,
      expectedPresentationVersion: context.expectedPresentationVersion + 2
    })
  ).rejects.toThrow('Session is not current and open')
})

it('denies player-only owner reads and commands while exposing the bounded measurement page', async () => {
  const base = await createSceneDefinitionFixture()
  const { sceneId, save } = await publishEmptyScene(base)
  await expect(base.other.caller.query(header, { sceneId })).rejects.toThrow('owner')
  await expect(
    base.other.caller.query(entities, {
      sceneId,
      definitionSaveId: save.saveId,
      expectedVersion: 0,
      collection: 'annotations',
      paginationOpts: { cursor: null, numItems: 8 }
    })
  ).rejects.toThrow('owner')
  await expect(
    base.other.caller.query(changes, {
      sceneId,
      definitionSaveId: save.saveId,
      expectedVersion: 0,
      collection: 'measurements',
      paginationOpts: { cursor: null, numItems: 8 }
    })
  ).rejects.toThrow('owner')
  await expect(
    command(base.other.caller, {
      type: 'SET_SCENE_AMBIENT_ILLUMINATION',
      sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 0,
      illumination: 'DIM'
    })
  ).rejects.toThrow('owner')
  expect(
    await base.other.caller.query(list, {
      sceneId,
      expectedVersion: null,
      paginationOpts: { cursor: null, numItems: 8 }
    })
  ).toEqual(expect.objectContaining({ version: 0, count: 0, page: [] }))
  const shared = measurement(base.owner.userId)
  const privateNote = 'Private Scene preparation sentinel'
  await command(base.owner.caller, {
    type: 'UPSERT_SCENE_ANNOTATION',
    sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    annotation: {
      id: crypto.randomUUID(),
      position: { x: 0, y: 0 },
      text: privateNote,
      visibility: 'GM_ONLY'
    }
  })
  await command(base.owner.caller, {
    type: 'UPSERT_SCENE_MEASUREMENT',
    sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 1,
    measurement: shared
  })
  const page = await base.other.caller.query(list, {
    sceneId,
    expectedVersion: null,
    paginationOpts: { cursor: null, numItems: 8 }
  })
  expect(page.page).toEqual([{ ordinal: 0, measurement: shared }])
  expect(JSON.stringify(page)).not.toContain(privateNote)
  for (const privateField of ['map', 'settings', 'annotations', 'receipts', 'definitionSaveId'])
    expect(page).not.toHaveProperty(privateField)
  await expect(
    base.other.caller.query(list, {
      sceneId,
      expectedVersion: null,
      paginationOpts: { cursor: 'not-an-initial-page', numItems: 8 }
    })
  ).rejects.toThrow()
})

it('replays exact stale commands, rejects stale targets and future versions, and rejects command collisions', async () => {
  const base = await createSceneDefinitionFixture()
  const { sceneId } = await publishEmptyScene(base)
  const first = measurement(base.owner.userId)
  const second = measurement(base.owner.userId)
  const firstCommand: SceneLiveCommandInputDto = {
    type: 'UPSERT_SCENE_MEASUREMENT',
    sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    measurement: first
  }
  await command(base.owner.caller, firstCommand)
  await command(base.owner.caller, {
    type: 'UPSERT_SCENE_MEASUREMENT',
    sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    measurement: second
  })
  await expect(command(base.owner.caller, firstCommand)).resolves.toMatchObject({
    replayed: true,
    version: 1
  })
  await expect(
    command(base.owner.caller, {
      ...firstCommand,
      commandId: crypto.randomUUID(),
      measurement: { ...first, label: 'Changed' }
    })
  ).rejects.toThrow('target changed')
  await expect(
    command(base.owner.caller, {
      type: 'REMOVE_SCENE_MEASUREMENT',
      sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 9,
      measurementId: crypto.randomUUID()
    })
  ).rejects.toThrow('ahead')
  await expect(
    command(base.owner.caller, {
      type: 'SET_SCENE_VISION_REVEAL_MODE',
      sceneId,
      commandId: firstCommand.commandId,
      expectedSceneVersion: 2,
      mode: 'ON_DROP'
    })
  ).rejects.toThrow('already used')
  const before = await liveRows(base)
  const trial: SceneLiveCommandInputDto = {
    ...firstCommand,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 2,
    measurement: { ...first, label: 'Rolled back' }
  }
  await expect(
    base.owner.caller.run(async (ctx) => {
      const result = await ctx.runMutation(execute, { input: trial })
      expect(result.version).toBe(3)
      throw new Error('Injected measurement rollback')
    })
  ).rejects.toThrow('Injected measurement rollback')
  expect(await liveRows(base)).toEqual(before)
})

it('pins nine-row pages across edits and skips a tombstone-only page', async () => {
  const base = await createSceneDefinitionFixture()
  const { sceneId } = await publishEmptyScene(base)
  const measurements = Array.from({ length: 9 }, (_, index) =>
    measurement(base.owner.userId, `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`)
  )
  for (const [index, value] of measurements.entries())
    await command(base.owner.caller, {
      type: 'UPSERT_SCENE_MEASUREMENT',
      sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: index,
      measurement: value
    })
  const first = await base.owner.caller.query(list, {
    sceneId,
    expectedVersion: 9,
    paginationOpts: { cursor: null, numItems: 8 }
  })
  expect(first.page).toHaveLength(8)
  await command(base.owner.caller, {
    type: 'UPSERT_SCENE_MEASUREMENT',
    sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 9,
    measurement: measurement(base.owner.userId)
  })
  await expect(
    base.owner.caller.query(list, {
      sceneId,
      expectedVersion: 9,
      paginationOpts: { cursor: first.continueCursor, numItems: 8 }
    })
  ).rejects.toThrow('snapshot changed')
  const tombstoneBase = await createSceneDefinitionFixture()
  const published = await publishEmptyScene(tombstoneBase)
  await seedMeasurements(
    tombstoneBase,
    published.sceneId,
    Array.from({ length: 9 }, (_, index) =>
      index === 8
        ? measurement(tombstoneBase.owner.userId, '00000000-0000-4000-8000-000000000009')
        : null
    )
  )
  const empty = await tombstoneBase.owner.caller.query(list, {
    sceneId: published.sceneId,
    expectedVersion: 1,
    paginationOpts: { cursor: null, numItems: 8 }
  })
  expect(empty).toMatchObject({ count: 1, page: [], isDone: false })
  await expect(
    tombstoneBase.owner.caller.query(list, {
      sceneId: published.sceneId,
      expectedVersion: 1,
      paginationOpts: { cursor: empty.continueCursor, numItems: 8 }
    })
  ).resolves.toMatchObject({ count: 1, page: [{ ordinal: 8 }] })
})

it('holds the 500-measurement boundary and rolls back rejected anonymous, left, and archived writes', async () => {
  const base = await createSceneDefinitionFixture()
  const { sceneId } = await publishEmptyScene(base)
  await seedMeasurements(
    base,
    sceneId,
    Array.from({ length: VTT_SCENE_LIMITS.measurements }, (_, index) =>
      measurement(
        base.owner.userId,
        `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
      )
    )
  )
  const before = await liveRows(base)
  await expect(
    command(base.owner.caller, {
      type: 'UPSERT_SCENE_MEASUREMENT',
      sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 1,
      measurement: measurement(base.owner.userId)
    })
  ).rejects.toThrow()
  expect(await liveRows(base)).toEqual(before)
  const removeId = '00000000-0000-4000-8000-000000000001'
  await command(base.owner.caller, {
    type: 'REMOVE_SCENE_MEASUREMENT',
    sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 1,
    measurementId: removeId
  })
  await command(base.owner.caller, {
    type: 'UPSERT_SCENE_MEASUREMENT',
    sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 2,
    measurement: measurement(base.owner.userId, removeId)
  })
  const after = await liveRows(base)
  expect(after.head[0]?.counts.measurements).toBe(500)
  await expect(
    base.t.mutation(execute, {
      input: {
        type: 'UPSERT_SCENE_MEASUREMENT',
        sceneId,
        commandId: crypto.randomUUID(),
        expectedSceneVersion: 3,
        measurement: measurement(base.owner.userId)
      }
    })
  ).rejects.toThrow('Unauthenticated')
  await base.t.run(async (ctx) => {
    const membership = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
      )
      .unique()
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
      .unique()
    if (!membership || !campaign) throw new Error('Missing Campaign fixture.')
    await ctx.db.patch(membership._id, { status: 'LEFT', leftAt: new Date().toISOString() })
    await ctx.db.patch(campaign._id, { status: 'ARCHIVED' })
  })
  await expect(
    command(base.other.caller, {
      type: 'UPSERT_SCENE_MEASUREMENT',
      sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 3,
      measurement: measurement(base.other.userId)
    })
  ).rejects.toThrow('Campaign not found')
  await expect(
    command(base.owner.caller, {
      type: 'UPSERT_SCENE_MEASUREMENT',
      sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 3,
      measurement: measurement(base.owner.userId)
    })
  ).rejects.toThrow('read-only')
  expect(await liveRows(base)).toEqual(after)
})
