import { makeFunctionReference } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import type { SceneCommandInputDto } from '@artificer-toolkit/schema/api/vttScenes'
import type {
  SceneGeometryCommandResult,
  SceneGeometryExecuteInput
} from '@artificer-toolkit/schema/api/sceneGeometry'
import type { SceneToken } from '@artificer-toolkit/shared/vtt/scene'
import { createSceneDefinitionFixture } from '../../tests/fixtures/sceneDefinitions'
import { api } from '../_generated/api'
import { SCENE_COMMAND_RETENTION_MS } from './commandRetention'

type Move = Extract<SceneCommandInputDto, { type: 'MOVE_SCENE_TOKEN' }>
const move = makeFunctionReference<'action', SceneGeometryExecuteInput, SceneGeometryCommandResult>(
  'scenes/geometryActions:execute'
)
const purge = makeFunctionReference<'mutation', Record<string, never>, null>(
  'scenes/commandRetention:purge'
)

afterEach(() => vi.useRealTimers())

it('deletes only expired Scene command receipts together with their geometry saves', async () => {
  const base = await createSceneDefinitionFixture()
  const token: SceneToken = {
    id: crypto.randomUUID(),
    assetId: null,
    label: 'Scout',
    width: 1,
    height: 1,
    position: { x: 100, y: 100 },
    rotationDegrees: 0,
    hidden: false,
    locked: false,
    controlledByUserIds: [],
    vision: null
  }
  const saved = await base.owner.caller.mutation(api.scenes.definitions.begin, {
    ...base.input,
    counts: { ...base.input.counts, tokens: 1 }
  })
  await base.owner.caller.mutation(api.scenes.definitions.append, {
    input: { saveId: saved.saveId, collection: 'tokens', offset: 0, entities: [token] }
  })
  await base.owner.caller.mutation(api.scenes.definitions.publish, { saveId: saved.saveId })
  if (!saved.liveSceneId) throw new Error('Missing Scene.')
  const sceneId = saved.liveSceneId
  const movement = (commandId: string, expectedSceneVersion: number, x: number): Move => ({
    sceneId,
    commandId,
    expectedSceneVersion,
    expectedEncounterVersion: null,
    correlationId: null,
    type: 'MOVE_SCENE_TOKEN',
    tokenId: token.id,
    movementKind: 'VOLUNTARY',
    path: [token.position, { x, y: 100 }]
  })
  const receipts = (commandId: string) =>
    base.t.run(async (ctx) => ({
      command: await ctx.db
        .query('sceneLiveCommands')
        .withIndex('by_sceneId_commandId', (q) =>
          q.eq('sceneId', sceneId).eq('commandId', commandId)
        )
        .unique(),
      save: await ctx.db
        .query('sceneGeometrySaves')
        .withIndex('by_sceneId_commandId', (q) =>
          q.eq('sceneId', sceneId).eq('commandId', commandId)
        )
        .unique()
    }))

  vi.useFakeTimers()
  const startedAt = Date.now()
  const expired = crypto.randomUUID()
  const first = await base.owner.caller.action(move, { input: movement(expired, 0, 200) })
  // Fixture identities last one minute, so the receipts are seconds apart and the clock moves later.
  vi.setSystemTime(startedAt + 2_000)
  const retained = crypto.randomUUID()
  await base.owner.caller.action(move, {
    input: {
      ...movement(retained, first.version, 300),
      path: [
        { x: 200, y: 100 },
        { x: 300, y: 100 }
      ]
    }
  })
  expect(await receipts(expired)).toMatchObject({
    command: expect.anything(),
    save: expect.anything()
  })

  vi.setSystemTime(startedAt + SCENE_COMMAND_RETENTION_MS - 1)
  await base.t.mutation(purge, {})
  expect(await receipts(expired)).toMatchObject({
    command: expect.anything(),
    save: expect.anything()
  })

  vi.setSystemTime(startedAt + SCENE_COMMAND_RETENTION_MS + 1_000)
  await base.t.mutation(purge, {})
  expect(await receipts(expired)).toEqual({ command: null, save: null })
  expect(await receipts(retained)).toMatchObject({
    command: expect.anything(),
    save: expect.objectContaining({ status: 'PUBLISHED' })
  })
})
