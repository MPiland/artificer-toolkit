import { makeFunctionReference } from 'convex/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { sceneGeometryBeginResultSchema } from '@artificer-toolkit/schema/api/sceneGeometry'
import type { sceneSpatialPrepareInputSchema } from '@artificer-toolkit/schema/api/sceneMovementPerception'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { createSpatialPreparationFixture } from '../../tests/fixtures/spatialPreparation'
import { seedSpatialEffect } from '../../tests/fixtures/spatialEffect'
import { api, internal } from '../_generated/api'
import { readRunProjection, readRunState } from '../encounters/documents'
import { completeSceneGeometry } from './geometryActions'
import { readGeometrySave } from './geometryDocuments'

beforeEach(() =>
  vi.stubEnv('BETTER_AUTH_SECRET', 'uninterrupted-movement-test-secret-at-least-32-bytes')
)
afterEach(() => vi.unstubAllEnvs())

const prepare = makeFunctionReference<
  'mutation',
  ReturnType<typeof sceneSpatialPrepareInputSchema.parse>,
  SceneSpatialPreparation
>('scenes/spatialPreparation:prepare')

async function setup(
  mode: 'MANUAL' | 'AUTOMATIC' | 'ASSISTED',
  movementKind: 'VOLUNTARY' | 'FORCED' | 'TELEPORT' = 'VOLUNTARY'
) {
  const fixture = await createSpatialPreparationFixture()
  const { base, saveId, tokenId } = fixture
  await base.owner.caller.run(async (ctx) => {
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    const save = await ctx.db
      .query('sceneGeometrySaves')
      .withIndex('by_publicId', (q) => q.eq('id', saveId))
      .unique()
    if (!run || !save) throw new Error('Missing movement fixture.')
    const state = { ...readRunState(run), automationMode: mode }
    await ctx.db.patch(run._id, {
      stateJson: JSON.stringify(state),
      stateChecksum: checksumCanonicalJson(state)
    })
    const input = { ...fixture.input, movementKind }
    await ctx.db.patch(save._id, { input, inputChecksum: checksumCanonicalJson(input) })
    await ctx.db.insert('encounterActorTokenBindings', {
      encounterId: base.run.id,
      actorId: base.run.actors[0]!.id,
      sceneId: base.sceneId,
      tokenId
    })
    for (const [ordinal, token] of base.tokens.entries()) {
      const row = await ctx.db
        .query('sceneDefinitionEntities')
        .withIndex('by_saveId_collection_ordinal', (q) =>
          q.eq('saveId', base.saveId).eq('value.collection', 'tokens').eq('ordinal', ordinal)
        )
        .unique()
      if (!row) throw new Error('Missing movement token.')
      const entity = {
        ...token,
        id: token.id.toLowerCase(),
        controlledByUserIds: [base.owner.userId],
        vision: {
          enabled: true,
          brightRange: 1,
          dimRange: 1,
          angleDegrees: 360,
          directionDegrees: 0
        }
      }
      const value = { collection: 'tokens' as const, entity }
      await ctx.db.patch(row._id, {
        entityId: entity.id,
        value,
        checksum: checksumCanonicalJson(value)
      })
    }
  })
  const request = {
    saveId,
    baseOrdinal: 0,
    tokenOrdinals: base.tokens.map((token, baseOrdinal) => ({
      tokenId: token.id.toLowerCase(),
      baseOrdinal
    }))
  }
  return { ...fixture, request }
}

async function current(value: Awaited<ReturnType<typeof setup>>) {
  return value.base.t.run(async (ctx) => ({
    run: await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', value.base.run.id))
      .unique(),
    actors: await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', value.base.run.id))
      .collect(),
    occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
    receipts: await ctx.db.query('encounterRuleReceipts').collect(),
    effects: await ctx.db.query('encounterSpatialRuleEffects').collect(),
    saves: await ctx.db.query('sceneGeometrySaves').collect(),
    liveStates: await ctx.db.query('sceneLiveStates').collect(),
    liveEntities: await ctx.db.query('sceneLiveEntities').collect(),
    liveCommands: await ctx.db.query('sceneLiveCommands').collect(),
    fogSaves: await ctx.db.query('sceneFogSaves').collect(),
    fogLayers: await ctx.db.query('sceneFogLayers').collect(),
    fogChunks: await ctx.db.query('sceneFogChunks').collect()
  }))
}

it.each(['STAGING', 'PUBLICATION'] as const)(
  'refuses a bound token submitted as standalone movement at %s without publishing state',
  async (stage) => {
    const value = await setup('AUTOMATIC')
    const input = {
      ...value.input,
      commandId: crypto.randomUUID(),
      expectedEncounterVersion: null
    }
    let stagedSaveId: string | undefined
    if (stage === 'PUBLICATION') {
      const binding = await value.base.t.run(async (ctx) => {
        const row = await ctx.db.query('encounterActorTokenBindings').first()
        if (!row) throw new Error('Missing movement binding.')
        const { _id, _creationTime, ...stored } = row
        await ctx.db.delete(_id)
        return stored
      })
      const begin = await value.base.owner.caller.mutation(internal.scenes.geometryStaging.begin, {
        input
      })
      if (begin.kind !== 'READY') throw new Error('Expected staged standalone movement.')
      stagedSaveId = begin.saveId
      await value.base.t.run((ctx) => ctx.db.insert('encounterActorTokenBindings', binding))
    }
    const before = await current(value)
    await expect(
      stagedSaveId
        ? value.base.owner.caller.mutation(internal.scenes.geometryCommands.finish, {
            saveId: stagedSaveId,
            baseOrdinal: 0
          })
        : value.base.owner.caller.action(api.scenes.geometryActions.execute, { input })
    ).rejects.toThrow('Bound Scene token movement requires an Encounter version.')
    expect(await current(value)).toEqual(before)
  },
  30000
)

it('allows standalone movement after the bound Run Session has finished', async () => {
  const value = await setup('AUTOMATIC')
  await value.base.t.run(async (ctx) => {
    const session = await ctx.db.query('campaignSessions').first()
    if (!session) throw new Error('Missing movement Session.')
    await ctx.db.patch(session._id, { status: 'FINISHED', finishedAt: new Date().toISOString() })
  })
  const before = await current(value)
  const result = await value.base.owner.caller.action(api.scenes.geometryActions.execute, {
    input: { ...value.input, commandId: crypto.randomUUID(), expectedEncounterVersion: null }
  })
  expect(result).toMatchObject({ version: 1, occurrence: null, replayed: false })
  expect((await current(value)).run).toEqual(before.run)
}, 30000)

it.each([
  { mode: 'MANUAL', movementKind: 'VOLUNTARY' },
  { mode: 'AUTOMATIC', movementKind: 'VOLUNTARY' },
  { mode: 'AUTOMATIC', movementKind: 'FORCED' },
  { mode: 'ASSISTED', movementKind: 'TELEPORT' }
] as const)(
  'publishes $mode $movementKind movement and fog without a Run occurrence',
  async ({ mode, movementKind }) => {
    const value = await setup(mode, movementKind)
    if (mode === 'AUTOMATIC' && movementKind === 'VOLUNTARY') {
      await value.base.t.run(async (ctx) => {
        const session = await ctx.db.query('campaignSessions').first()
        const run = await ctx.db.query('encounterRuns').first()
        if (!session || !run) throw new Error('Missing movement fixture.')
        const { _id: _sessionId, _creationTime: _sessionCreatedAt, ...storedSession } = session
        const historicalSessionId = crypto.randomUUID()
        await ctx.db.insert('campaignSessions', {
          ...storedSession,
          id: historicalSessionId,
          sessionNumber: session.sessionNumber + 1,
          status: 'FINISHED',
          finishedAt: new Date().toISOString()
        })
        const { _id: _runId, _creationTime: _runCreatedAt, ...storedRun } = run
        const historicalRunId = crypto.randomUUID()
        const state = { ...readRunState(run), id: historicalRunId, sessionId: historicalSessionId }
        const projection = {
          ...readRunProjection(run),
          id: historicalRunId,
          sessionId: historicalSessionId
        }
        await ctx.db.insert('encounterRuns', {
          ...storedRun,
          id: historicalRunId,
          sessionId: historicalSessionId,
          stateJson: JSON.stringify(state),
          stateChecksum: checksumCanonicalJson(state),
          projectionJson: JSON.stringify(projection),
          projectionChecksum: checksumCanonicalJson(projection)
        })
      })
    }
    if (mode === 'MANUAL') await seedSpatialEffect(value.base)
    const before = await current(value)
    const begin = await value.base.owner.caller.run(async (ctx) => {
      const { save, header } = await readGeometrySave(ctx, value.saveId)
      return sceneGeometryBeginResultSchema.parse({
        kind: 'READY',
        saveId: save.id,
        input: save.input,
        header,
        sessionVision: save.sessionVision
      })
    })
    if (begin.kind !== 'READY') throw new Error('Expected ready movement.')
    const result = await value.base.owner.caller.action((ctx) => completeSceneGeometry(ctx, begin))
    expect(result).toMatchObject({
      version: 1,
      occurrence: null,
      replayed: false,
      delta: { kind: 'TOKEN_MOVED', tokenId: value.tokenId, position: value.input.path.at(-1) }
    })
    expect(result.fogPatches.length).toBeGreaterThan(0)
    const after = await current(value)
    expect(after.run).toEqual(before.run)
    expect(after.actors).toEqual(before.actors)
    expect(after.occurrences).toEqual(before.occurrences)
    expect(after.receipts).toEqual(before.receipts)
    expect(after.effects).toEqual(before.effects)
    if (mode === 'AUTOMATIC' && movementKind === 'VOLUNTARY') await seedSpatialEffect(value.base)
    const beforeReplay = await current(value)
    await expect(
      value.base.owner.caller.mutation(internal.scenes.geometryCommands.finish, value.request)
    ).resolves.toEqual({ ...result, replayed: true })
    expect(await current(value)).toEqual(beforeReplay)
  },
  30000
)

it.each(['NEW_EFFECT', 'INCOMPLETE_FOG'] as const)(
  'refuses %s after preparation without publishing any movement',
  async (failure) => {
    const value = await setup('AUTOMATIC')
    await value.base.owner.caller.mutation(internal.scenes.geometryStaging.observe, {
      saveId: value.saveId,
      characterRevisions: []
    })
    const prepared = await value.base.owner.caller.mutation(prepare, value.request)
    expect(prepared.outcome).toEqual({ kind: 'UNINTERRUPTED', reason: 'NO_CANDIDATES' })
    if (failure === 'NEW_EFFECT') await seedSpatialEffect(value.base)
    else {
      await value.base.owner.caller.mutation(internal.scenes.geometryStaging.stageFog, {
        saveId: value.saveId,
        layer: {
          ownerUserId: value.base.owner.userId,
          width: 32,
          height: 32,
          chunks: [
            {
              index: 0,
              x: 0,
              y: 0,
              width: 32,
              height: 32,
              data: Buffer.alloc(128, 255).toString('base64')
            }
          ]
        }
      })
      await value.base.t.run(async (ctx) => {
        const fog = await ctx.db.query('sceneFogSaves').first()
        if (!fog) throw new Error('Missing staged fog.')
        await ctx.db.patch(fog._id, { receivedChunks: 0 })
      })
    }
    const before = await current(value)
    await expect(
      value.base.owner.caller.mutation(internal.scenes.geometryCommands.finish, value.request)
    ).rejects.toThrow(
      failure === 'NEW_EFFECT'
        ? 'Uninterrupted movement evaluation does not match retained preparation.'
        : 'fog save is inconsistent'
    )
    expect(await current(value)).toEqual(before)
  },
  30000
)
