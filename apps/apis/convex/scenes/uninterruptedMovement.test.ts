import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  createSpatialPreparationFixture,
  grantFixtureActorControl
} from '../../tests/fixtures/spatialPreparation'
import { seedSpatialEffect } from '../../tests/fixtures/spatialEffect'
import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { planMovementInRoom } from '../../tests/fixtures/liveSessionWorker'

beforeEach(() =>
  vi.stubEnv('BETTER_AUTH_SECRET', 'uninterrupted-movement-test-secret-at-least-32-bytes')
)
afterEach(() => vi.unstubAllEnvs())

async function setup(mode: 'MANUAL' | 'ASSISTED') {
  const fixture = await createSpatialPreparationFixture()
  const { base, tokenId } = fixture
  await base.owner.caller.run(async (ctx) => {
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!run) throw new Error('Missing movement fixture.')
    const state = { ...readRunState(run), automationMode: mode }
    await ctx.db.patch(run._id, {
      stateJson: JSON.stringify(state),
      stateChecksum: checksumCanonicalJson(state)
    })
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
    liveStates: await ctx.db.query('sceneLiveStates').collect(),
    liveEntities: await ctx.db.query('sceneLiveEntities').collect(),
    fogSaves: await ctx.db.query('sceneFogSaves').collect(),
    fogLayers: await ctx.db.query('sceneFogLayers').collect(),
    fogChunks: await ctx.db.query('sceneFogChunks').collect()
  }))
}

it.each([
  { mode: 'MANUAL', movementKind: 'VOLUNTARY' },
  { mode: 'ASSISTED', movementKind: 'VOLUNTARY' },
  { mode: 'ASSISTED', movementKind: 'FORCED' },
  { mode: 'ASSISTED', movementKind: 'TELEPORT' }
] as const)(
  'publishes $mode $movementKind movement and fog without a Run occurrence',
  async ({ mode, movementKind }) => {
    const value = await setup(mode)
    if (mode === 'MANUAL') await seedSpatialEffect(value.base)
    const before = await current(value)
    const command = {
      ...value.input,
      movementKind,
      commandId: crypto.randomUUID()
    }
    const move = await planMovementInRoom(value.base.owner.caller, command)
    expect(move.outcome).toEqual({
      kind: 'UNINTERRUPTED',
      reason: mode === 'MANUAL' ? 'MANUAL' : 'NO_CANDIDATES'
    })
    const result = await move.publish()
    expect(result).toMatchObject({
      version: 1,
      occurrence: null,
      replayed: false,
      delta: {
        kind: 'TOKEN_MOVED',
        tokenId: value.tokenId,
        position: value.input.path.at(-1)
      }
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
    const replay = await planMovementInRoom(value.base.owner.caller, command)
    expect(replay.saveId).toBe(move.saveId)
    await expect(replay.publish()).resolves.toEqual({
      ...result,
      replayed: true
    })
    expect(await current(value)).toEqual(beforeReplay)
  },
  30000
)
