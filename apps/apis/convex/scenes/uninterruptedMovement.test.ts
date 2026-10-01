import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  createSpatialPreparationFixture,
  grantFixtureActorControl
} from '../../tests/fixtures/spatialPreparation'
import { seedSpatialEffect } from '../../tests/fixtures/spatialEffect'
import { api, internal } from '../_generated/api'
import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import {
  planMovementInRoom,
  planStagedMovementInRoom
} from '../../tests/fixtures/liveSessionWorker'

beforeEach(() =>
  vi.stubEnv('BETTER_AUTH_SECRET', 'uninterrupted-movement-test-secret-at-least-32-bytes')
)
afterEach(() => vi.unstubAllEnvs())

async function setup(
  mode: 'MANUAL' | 'ASSISTED',
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
    // The moving player controls the bound actor; its Scene token control no longer applies.
    await grantFixtureActorControl(ctx, {
      encounterId: base.run.id,
      actorId: base.run.actors[0]!.id,
      controllerUserIds: [base.owner.userId]
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
  return fixture
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
    receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
    receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
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
    const value = await setup('ASSISTED')
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

it('keeps Encounter-bound movement fenced after a Campaign Session has finished', async () => {
  const value = await setup('ASSISTED')
  const session = await value.base.other.caller.mutation(api.campaigns.sessions.create, {
    campaignId: value.base.campaign.id
  })
  await value.base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('campaignSessions')
      .withIndex('by_publicId', (q) => q.eq('id', session.id))
      .unique()
    if (!row) throw new Error('Missing movement Session.')
    await ctx.db.patch(row._id, { status: 'FINISHED', finishedAt: new Date().toISOString() })
  })
  const before = await current(value)
  await expect(
    value.base.owner.caller.action(api.scenes.geometryActions.execute, {
      input: { ...value.input, commandId: crypto.randomUUID(), expectedEncounterVersion: null }
    })
  ).rejects.toThrow('Bound Scene token movement requires an Encounter version.')
  expect(await current(value)).toEqual(before)
}, 30000)

it.each([
  { mode: 'MANUAL', movementKind: 'VOLUNTARY' },
  { mode: 'ASSISTED', movementKind: 'VOLUNTARY' },
  { mode: 'ASSISTED', movementKind: 'FORCED' },
  { mode: 'ASSISTED', movementKind: 'TELEPORT' }
] as const)(
  'publishes $mode $movementKind movement and fog without a Run occurrence',
  async ({ mode, movementKind }) => {
    const value = await setup(mode, movementKind)
    if (mode === 'MANUAL') await seedSpatialEffect(value.base)
    const before = await current(value)
    const move = await planMovementInRoom(value.base.owner.caller, {
      ...value.input,
      movementKind,
      commandId: crypto.randomUUID()
    })
    expect(move.outcome).toEqual({
      kind: 'UNINTERRUPTED',
      reason: mode === 'MANUAL' ? 'MANUAL' : 'NO_CANDIDATES'
    })
    const result = await move.publish()
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
    if (mode === 'ASSISTED' && movementKind === 'VOLUNTARY') await seedSpatialEffect(value.base)
    const beforeReplay = await current(value)
    await expect(move.publish()).resolves.toEqual({ ...result, replayed: true })
    expect(await current(value)).toEqual(beforeReplay)
  },
  30000
)

it('refuses incomplete staged fog after planning without publishing any movement', async () => {
  const value = await setup('ASSISTED')
  await value.base.owner.caller.mutation(internal.scenes.geometryStaging.observe, {
    saveId: value.saveId,
    characterRevisions: []
  })
  const prepared = await planStagedMovementInRoom(value.base.owner.caller, value.saveId)
  expect(prepared.outcome).toEqual({ kind: 'UNINTERRUPTED', reason: 'NO_CANDIDATES' })
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
  const before = await current(value)
  await expect(prepared.publish()).rejects.toThrow('fog save is inconsistent')
  expect(await current(value)).toEqual(before)
}, 30000)
