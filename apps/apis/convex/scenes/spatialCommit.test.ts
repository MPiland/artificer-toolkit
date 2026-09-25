import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { makeFunctionReference } from 'convex/server'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  encounterCommandResultDtoSchema,
  type EncounterTimelineDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  sceneGeometryCommandResultSchema,
  sceneGeometryFinishInputSchema
} from '@artificer-toolkit/schema/api/sceneGeometry'
import { sceneTokenMovementCommandInputDtoSchema } from '@artificer-toolkit/schema/api/vttScenes'
import { sceneStoredDefinitionEntitySchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { createSpatialPreparationFixture } from '../../tests/fixtures/spatialPreparation'
import { seedSpatialEffect } from '../../tests/fixtures/spatialEffect'
import { internal } from '../_generated/api'
import { readRunActor, readRunProjection, readRunState } from '../encounters/documents'
import {
  evaluateNativeSpatialMovement,
  type NativeSpatialMovementInput
} from '../encounters/spatialMovement'
import { createSpatialRuleEffectStore } from '../rules/spatialEffectStore'
import { readGeometrySave } from './geometryDocuments'
import { commitPreparedSpatialTerminal } from './spatialCommit.helper'
import { publishPreparedSpatialTerminal } from './spatialPublication.helper'
import { persistSpatialPreparation } from './spatialPreparationPersistence'

const timeline = makeFunctionReference<
  'query',
  { encounterId: string; limit: number },
  EncounterTimelineDto
>('encounters/timelineReads:timeline')

beforeEach(() => vi.stubEnv('BETTER_AUTH_SECRET', 'spatial-commit-test-secret-at-least-32-bytes'))
afterEach(() => vi.unstubAllEnvs())

async function setup(
  path?: ReturnType<typeof sceneTokenMovementCommandInputDtoSchema.parse>['path']
) {
  const fixture = await createSpatialPreparationFixture()
  const { base, tokenId } = fixture
  const input = path ? { ...fixture.input, path } : fixture.input
  const sceneTokens = base.tokens.map((token) => ({
    ...token,
    id: token.id.toLowerCase(),
    controlledByUserIds: [base.owner.userId]
  }))
  await base.owner.caller.run(async (ctx) => {
    if (path) {
      const save = await ctx.db
        .query('sceneGeometrySaves')
        .withIndex('by_publicId', (q) => q.eq('id', fixture.saveId))
        .unique()
      if (!save) throw new Error('Fixture geometry save missing')
      await ctx.db.patch(save._id, {
        input,
        inputChecksum: checksumCanonicalJson(input)
      })
    }
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!run) throw new Error('Fixture Run missing')
    const state = { ...readRunState(run), automationMode: 'AUTOMATIC' as const }
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
    for (const token of sceneTokens) {
      const row = await ctx.db
        .query('sceneDefinitionEntities')
        .withIndex('by_saveId_collection_ordinal', (q) =>
          q
            .eq('saveId', base.saveId)
            .eq('value.collection', 'tokens')
            .eq('ordinal', sceneTokens.indexOf(token))
        )
        .unique()
      if (!row) throw new Error('Fixture token missing')
      const { _id, _creationTime, ...stored } = row
      const value = { collection: 'tokens' as const, entity: token }
      await ctx.db.replace(
        _id,
        sceneStoredDefinitionEntitySchema.parse({
          ...stored,
          entityId: token.id,
          value,
          checksum: checksumCanonicalJson(value)
        })
      )
    }
  })
  const effect = await seedSpatialEffect(base)
  const geometry = { sceneTokens, actorIdByTokenId: new Map([[tokenId, base.run.actors[0]!.id]]) }
  const movement: NativeSpatialMovementInput = {
    ...geometry,
    encounterId: base.run.id,
    expectedEncounterVersion: input.expectedEncounterVersion,
    sceneId: base.sceneId,
    sceneVersion: 0,
    currentPosition: sceneTokens[0]!.position,
    occurrenceId: crypto.randomUUID(),
    executionCommandId: input.commandId,
    occurredAt: new Date().toISOString(),
    root: {
      commandId: input.commandId,
      commandFingerprint: checksumCanonicalJson(input),
      initiatorUserId: base.owner.userId,
      correlationId: null,
      encounterId: base.run.id,
      sceneId: base.sceneId,
      tokenId,
      expectedEncounterVersion: input.expectedEncounterVersion,
      expectedSceneVersion: 0,
      movementKind: input.movementKind,
      originalPath: input.path
    }
  }
  const preview = await base.owner.caller.run((ctx) =>
    evaluateNativeSpatialMovement(ctx, movement, 'PREVIEW')
  )
  if (preview.kind !== 'TERMINAL') throw new Error('Expected terminal spatial preview')
  const preparation: SceneSpatialPreparation = {
    encounterId: base.run.id,
    expectedEncounterVersion: input.expectedEncounterVersion,
    occurrenceId: movement.occurrenceId,
    occurredAt: movement.occurredAt,
    outcome: {
      kind: 'TERMINAL',
      result: preview.result,
      selectionChecksum: preview.selectionChecksum,
      currentnessChecksum: preview.currentnessChecksum
    }
  }
  await base.owner.caller.run((ctx) => persistSpatialPreparation(ctx, fixture.saveId, preparation))
  await base.owner.caller.mutation(internal.scenes.geometryStaging.observe, {
    saveId: fixture.saveId,
    characterRevisions: []
  })
  return { ...fixture, input, geometry, preparation, effect }
}

function finishWithHints(
  value: Awaited<ReturnType<typeof setup>>,
  tokenOrdinals?: ReturnType<typeof sceneGeometryFinishInputSchema.parse>['tokenOrdinals']
) {
  const input: ReturnType<typeof sceneGeometryFinishInputSchema.parse> = {
    saveId: value.saveId,
    baseOrdinal: 0,
    ...(tokenOrdinals === undefined ? {} : { tokenOrdinals })
  }
  return value.base.owner.caller.mutation(internal.scenes.geometryCommands.finish, input)
}

function finish(value: Awaited<ReturnType<typeof setup>>) {
  return finishWithHints(
    value,
    value.geometry.sceneTokens.map((token, baseOrdinal) => ({
      tokenId: token.id,
      baseOrdinal
    }))
  )
}

function stageFog(value: Awaited<ReturnType<typeof setup>>) {
  return value.base.owner.caller.mutation(internal.scenes.geometryStaging.stageFog, {
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
}

async function current(value: Awaited<ReturnType<typeof setup>>) {
  return value.base.owner.caller.run(async (ctx) => {
    const { save } = await readGeometrySave(ctx, value.saveId)
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', value.base.run.id))
      .unique()
    if (!row) throw new Error('Fixture Run missing')
    const state = readRunState(row)
    const projection = readRunProjection(row)
    const scope = await createSpatialRuleEffectStore(ctx).scope({
      encounterId: state.id,
      sceneId: value.base.sceneId
    })
    const actor = await readRunActor(ctx, state, value.base.run.actors[0]!.id)
    if (actor.kind === 'CHARACTER') throw new Error('Expected a custom spatial actor.')
    return {
      save,
      actor,
      effects: await scope!.list(),
      runVersion: state.version,
      projection,
      occurrences: await ctx.db
        .query('encounterRuleOccurrences')
        .withIndex('by_encounterId_state', (q) => q.eq('encounterId', state.id))
        .collect(),
      receipts: await ctx.db.query('encounterRuleReceipts').collect(),
      commands: await ctx.db
        .query('encounterRunCommands')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', state.id))
        .collect(),
      liveStates: await ctx.db.query('sceneLiveStates').collect(),
      liveEntities: await ctx.db.query('sceneLiveEntities').collect(),
      liveCommands: await ctx.db.query('sceneLiveCommands').collect(),
      fogSaves: await ctx.db.query('sceneFogSaves').collect(),
      fogChunks: await ctx.db.query('sceneFogChunks').collect(),
      fogLayers: await ctx.db.query('sceneFogLayers').collect()
    }
  })
}

it('reconstructs retained terminal evidence and rolls back all mechanics with the parent transaction', async () => {
  const value = await setup()
  const before = await current(value)
  await expect(
    value.base.owner.caller.run(async (ctx) => {
      await commitPreparedSpatialTerminal(ctx, value.saveId, value.geometry)
      throw new Error('parent publication failed')
    })
  ).rejects.toThrow('parent publication failed')
  expect(await current(value)).toEqual(before)
  const committed = await value.base.owner.caller.run((ctx) =>
    commitPreparedSpatialTerminal(ctx, value.saveId, value.geometry)
  )
  expect(committed.kind).toBe('TERMINAL')
  if (committed.kind !== 'TERMINAL' || value.preparation.outcome.kind !== 'TERMINAL')
    throw new Error('Expected terminal result')
  expect(committed.result).toEqual(value.preparation.outcome.result)
  const after = await current(value)
  expect(after.actor.currentHitPoints).toBe(before.actor.currentHitPoints - 1)
  expect(after.effects).toEqual([])
  expect(after.runVersion).toBe(before.runVersion)
  expect(after.save).toEqual(before.save)
})

it('publishes a terminal movement once with its Run receipt and timeline entry', async () => {
  const value = await setup()
  const before = await current(value)
  const first = await value.base.owner.caller.run((ctx) =>
    publishPreparedSpatialTerminal(ctx, value.saveId, value.geometry)
  )
  const after = await current(value)

  expect(first.projection.version).toBe(before.runVersion + 1)
  expect(after.runVersion).toBe(before.runVersion + 1)
  expect(after.projection.version).toBe(before.projection.version + 1)
  expect(after.actor.currentHitPoints).toBe(before.actor.currentHitPoints - 1)
  expect(after.effects).toEqual([])
  const occurrences = after.occurrences.filter(
    (occurrence) => occurrence.id === value.preparation.occurrenceId
  )
  expect(occurrences).toMatchObject([
    { state: 'COMPLETED', version: 0, rootCommandId: value.input.commandId }
  ])
  expect(occurrences).toHaveLength(1)
  const receipts = after.receipts.filter((receipt) => receipt.commandId === value.input.commandId)
  expect(receipts).toMatchObject([
    {
      occurrenceId: value.preparation.occurrenceId,
      commandType: 'MOVE_SCENE_TOKEN',
      encounterVersion: after.runVersion
    }
  ])
  expect(receipts).toHaveLength(1)
  expect(
    after.commands.filter((command) => command.commandType === 'MOVE_SCENE_TOKEN')
  ).toHaveLength(1)
  const history = await value.base.other.caller.query(timeline, {
    encounterId: value.base.run.id,
    limit: 20
  })
  expect(history.entries.filter((entry) => entry.commandType === 'MOVE_SCENE_TOKEN')).toHaveLength(
    1
  )

  const playerHistory = await value.base.owner.caller.query(timeline, {
    encounterId: value.base.run.id,
    limit: 20
  })
  expect(playerHistory.entries.filter((entry) => entry.commandType === 'MOVE_SCENE_TOKEN')).toEqual(
    []
  )
  expect(
    after.projection.actors.find((actor) => actor.id === after.actor.id)?.currentHitPoints
  ).toBe(after.actor.currentHitPoints)
  const replay = await value.base.owner.caller.run((ctx) =>
    publishPreparedSpatialTerminal(ctx, value.saveId, value.geometry)
  )
  expect(replay).toEqual(first)
  expect(await current(value)).toEqual(after)
})

it('finishes prepared terminal movement through the native Scene transaction', async () => {
  const value = await setup()
  if (value.preparation.outcome.kind !== 'TERMINAL') throw new Error('Expected terminal fixture')
  const terminal = value.preparation.outcome.result
  await stageFog(value)
  const before = await current(value)
  const result = await finish(value)
  const after = await current(value)

  expect(result).toMatchObject({
    replayed: false,
    delta: {
      kind: 'TOKEN_MOVED',
      tokenId: value.tokenId,
      position: terminal.terminalPosition
    },
    occurrence: {
      occurrenceId: value.preparation.occurrenceId,
      occurrenceVersion: 0,
      status: 'COMPLETE'
    }
  })
  expect(after.runVersion).toBe(before.runVersion + 1)
  expect(after.actor.currentHitPoints).toBe(before.actor.currentHitPoints - 1)
  expect(after.effects).toEqual([])
  expect(after.liveEntities).toMatchObject([
    {
      collection: 'tokens',
      entityId: value.tokenId,
      value: {
        entity: {
          position: terminal.terminalPosition
        }
      }
    }
  ])
  expect(after.liveCommands).toHaveLength(1)
  expect(after.fogSaves).toMatchObject([{ status: 'PUBLISHED' }])
  expect(after.fogLayers).toHaveLength(1)
  expect(after.occurrences).toHaveLength(before.occurrences.length + 1)
  expect(after.receipts).toHaveLength(before.receipts.length + 1)
  expect(
    after.commands.filter((command) => command.commandType === 'MOVE_SCENE_TOKEN')
  ).toHaveLength(1)

  const replay = await finish(value)
  expect(replay).toEqual({ ...result, replayed: true })
  expect(await current(value)).toEqual(after)
})

it('rolls back native terminal publication when a later staged fog save is malformed', async () => {
  const value = await setup()
  await stageFog(value)
  await value.base.owner.caller.run(async (ctx) => {
    const fogSave = await ctx.db.query('sceneFogSaves').unique()
    if (!fogSave) throw new Error('Staged fog save missing')
    await ctx.db.patch(fogSave._id, { status: 'PUBLISHED' })
  })
  const before = await current(value)

  await expect(finish(value)).rejects.toThrow('Stored geometry fog save is inconsistent.')

  expect(await current(value)).toEqual(before)
})

it('rejects a checksum-consistent tampered Scene delta during terminal replay', async () => {
  const value = await setup()
  const result = await finish(value)
  await value.base.owner.caller.run(async (ctx) => {
    const command = await ctx.db
      .query('sceneLiveCommands')
      .withIndex('by_sceneId_commandId', (q) =>
        q.eq('sceneId', value.base.sceneId).eq('commandId', value.input.commandId)
      )
      .unique()
    if (!command || command.encoding !== 'GEOMETRY')
      throw new Error('Terminal Scene command missing')
    if (command.result.delta?.kind !== 'TOKEN_MOVED') throw new Error('Expected token delta')
    const tampered = sceneGeometryCommandResultSchema.parse({
      ...command.result,
      delta: { ...command.result.delta, position: { x: 999, y: 999 } }
    })
    await ctx.db.patch(command._id, {
      result: tampered,
      resultChecksum: checksumCanonicalJson(tampered)
    })
  })
  const before = await current(value)

  await expect(finish(value)).rejects.toThrow('replay delta')

  expect(result.replayed).toBe(false)
  expect(await current(value)).toEqual(before)
})

it('refuses missing token source hints before publication writes', async () => {
  const value = await setup()
  const before = await current(value)

  await expect(finishWithHints(value)).rejects.toThrow()

  expect(await current(value)).toEqual(before)
})

it('refuses invalid token source hints before publication writes', async () => {
  const value = await setup()
  const before = await current(value)

  await expect(
    finishWithHints(value, [{ tokenId: value.tokenId, baseOrdinal: 1 }])
  ).rejects.toThrow()

  expect(await current(value)).toEqual(before)
})

it.each([false, true])('publishes a stationary terminal with fog=%s', async (withFog) => {
  const value = await setup([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 0, y: 0 }
  ])
  if (value.preparation.outcome.kind !== 'TERMINAL') throw new Error('Expected terminal fixture')
  if (withFog) await stageFog(value)
  const before = await current(value)
  const result = await finish(value)
  const after = await current(value)

  expect(result).toMatchObject({ replayed: false, version: withFog ? 1 : 0, delta: null })
  expect(after.runVersion).toBe(before.runVersion + 1)
  expect(after.actor.currentHitPoints).toBe(before.actor.currentHitPoints - 1)
  expect(after.effects).toEqual([])
  expect(after.liveEntities).toEqual(before.liveEntities)
  if (withFog) {
    expect(after.liveStates).toMatchObject([{ version: 1 }])
    expect(after.liveCommands).toHaveLength(1)
    expect(after.fogSaves).toMatchObject([{ status: 'PUBLISHED' }])
    expect(after.fogLayers).toHaveLength(1)
    const receipt = after.receipts.find(
      (candidate) => candidate.commandId === value.input.commandId
    )
    if (!receipt) throw new Error('Stationary receipt missing')
    const stored = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
    const metadata = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
      JSON.parse(receipt.commandMetadataJson)
    )
    if (stored.status === 'BATCH_COMPLETE') {
      if (stored.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT')
        throw new Error('Spatial batch receipt missing')
    } else if (stored.status !== 'MOVEMENT_COMPLETE') throw new Error('Spatial receipt missing')
    if (metadata.transition !== 'SPATIAL_MOVEMENT')
      throw new Error('Spatial receipt metadata missing')
    expect(stored.sceneVersion).toBe(1)
    expect(metadata.sceneVersionTransition).toBe('ADVANCED')
    expect(metadata.changedAggregates).toContainEqual(
      expect.objectContaining({
        aggregateKind: 'SCENE',
        aggregateId: value.base.sceneId,
        beforeVersion: 0,
        version: 1
      })
    )
  } else {
    expect(value.preparation.outcome.result.sceneVersion).toBe(0)
    expect(after.liveStates).toEqual(before.liveStates)
    expect(after.liveCommands).toHaveLength(before.liveCommands.length + 1)
    expect(after.fogSaves).toEqual(before.fogSaves)
    expect(after.fogChunks).toEqual(before.fogChunks)
    expect(after.fogLayers).toEqual(before.fogLayers)
  }

  const replay = await finish(value)
  expect(replay).toEqual({ ...result, replayed: true })
  expect(await current(value)).toEqual(after)
})

it('rolls back terminal mechanics and all publication records when the parent transaction fails', async () => {
  const value = await setup()
  const before = await current(value)

  await expect(
    value.base.owner.caller.run(async (ctx) => {
      await publishPreparedSpatialTerminal(ctx, value.saveId, value.geometry)
      throw new Error('parent publication failed')
    })
  ).rejects.toThrow('parent publication failed')

  expect(await current(value)).toEqual(before)
})

it('rejects a tampered terminal receipt replay without new writes', async () => {
  const value = await setup()
  await value.base.owner.caller.run((ctx) =>
    publishPreparedSpatialTerminal(ctx, value.saveId, value.geometry)
  )
  await value.base.owner.caller.run(async (ctx) => {
    const receipt = await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) =>
        q.eq('encounterId', value.base.run.id).eq('commandId', value.input.commandId)
      )
      .unique()
    if (!receipt) throw new Error('Terminal receipt missing')
    await ctx.db.patch(receipt._id, { resultChecksum: '0'.repeat(64) })
  })
  const before = await current(value)

  await expect(
    value.base.owner.caller.run((ctx) =>
      publishPreparedSpatialTerminal(ctx, value.saveId, value.geometry)
    )
  ).rejects.toThrow('replay receipt is inconsistent')

  expect(await current(value)).toEqual(before)
})

it('rejects a terminal replay whose stored command omits its occurrence summary', async () => {
  const value = await setup()
  await value.base.owner.caller.run((ctx) =>
    publishPreparedSpatialTerminal(ctx, value.saveId, value.geometry)
  )
  await value.base.owner.caller.run(async (ctx) => {
    const command = await ctx.db
      .query('encounterRunCommands')
      .withIndex('by_campaignId_commandId', (q) =>
        q.eq('campaignId', value.base.campaign.id).eq('commandId', value.input.commandId)
      )
      .unique()
    if (!command || command.commandType !== 'MOVE_SCENE_TOKEN')
      throw new Error('Terminal command missing')
    const stored = encounterCommandResultDtoSchema.parse(JSON.parse(command.resultJson))
    const tampered = encounterCommandResultDtoSchema.parse({ ...stored, occurrence: null })
    await ctx.db.patch(command._id, {
      resultJson: JSON.stringify(tampered),
      resultChecksum: checksumCanonicalJson(tampered)
    })
  })
  const before = await current(value)

  await expect(
    value.base.owner.caller.run((ctx) =>
      publishPreparedSpatialTerminal(ctx, value.saveId, value.geometry)
    )
  ).rejects.toThrow('replay summary is inconsistent')

  expect(await current(value)).toEqual(before)
})

it('rejects changed effect currentness before applying retained outcomes', async () => {
  const value = await setup()
  await value.base.owner.caller.run(async (ctx) => {
    const scope = await createSpatialRuleEffectStore(ctx).scope({
      encounterId: value.base.run.id,
      sceneId: value.base.sceneId
    })
    await scope!.updateCurrentStateCas({
      id: value.effect.id,
      expectedVersion: value.effect.version,
      lifecycle: { ...value.effect.lifecycle, remainingTicks: 2 },
      spatialState: value.effect.spatialState
    })
  })
  const before = await current(value)
  await expect(
    value.base.owner.caller.run((ctx) =>
      commitPreparedSpatialTerminal(ctx, value.saveId, value.geometry)
    )
  ).rejects.toThrow('stale')
  expect(await current(value)).toEqual(before)
})

it('rejects a newly contacting effect even when Run and Scene versions have not advanced', async () => {
  const value = await setup()
  await seedSpatialEffect(value.base)
  const before = await current(value)
  await expect(
    value.base.owner.caller.run((ctx) =>
      commitPreparedSpatialTerminal(ctx, value.saveId, value.geometry)
    )
  ).rejects.toThrow('stale')
  expect(await current(value)).toEqual(before)
})

it('rejects token control changes before mechanics publication', async () => {
  const value = await setup()
  const before = await current(value)
  await expect(
    value.base.owner.caller.run((ctx) =>
      commitPreparedSpatialTerminal(ctx, value.saveId, {
        ...value.geometry,
        sceneTokens: value.geometry.sceneTokens.map((token) => ({ ...token, locked: true }))
      })
    )
  ).rejects.toThrow('token')
  expect(await current(value)).toEqual(before)
})

it('rolls mechanics back when reconstructed outcomes differ from retained preparation', async () => {
  const value = await setup()
  if (value.preparation.outcome.kind !== 'TERMINAL') throw new Error('Expected terminal fixture')
  const changed = {
    ...value.preparation,
    outcome: {
      ...value.preparation.outcome,
      result: { ...value.preparation.outcome.result, terminalPosition: { x: 9, y: 0 } }
    }
  }
  await value.base.owner.caller.run(async (ctx) => {
    const { row } = await readGeometrySave(ctx, value.saveId)
    await ctx.db.patch(row._id, {
      spatialPreparationJson: JSON.stringify(changed),
      spatialPreparationChecksum: checksumCanonicalJson(changed)
    })
  })
  const before = await current(value)
  await expect(
    value.base.owner.caller.run((ctx) =>
      commitPreparedSpatialTerminal(ctx, value.saveId, value.geometry)
    )
  ).rejects.toThrow('does not match retained preparation')
  expect(await current(value)).toEqual(before)
})

it.each(['root replay', 'pending occurrence'] as const)(
  'refuses %s before replaying mechanics',
  async (kind) => {
    const value = await setup()
    await value.base.owner.caller.run(async (ctx) => {
      const pending = kind === 'pending occurrence'
      const now = new Date().toISOString()
      await ctx.db.insert('encounterRuleOccurrences', {
        id: crypto.randomUUID(),
        campaignId: value.base.campaign.id,
        encounterId: value.base.run.id,
        rootCommandId: pending ? crypto.randomUUID() : value.input.commandId,
        state: pending ? 'PENDING' : 'COMPLETED',
        version: 0,
        expectedEncounterVersion: value.input.expectedEncounterVersion,
        // Even unreadable pending evidence must block a different command's mechanics.
        pendingSnapshotJson: pending ? '{}' : null,
        pendingSnapshotChecksum: pending ? checksumCanonicalJson({}) : null,
        completedAt: pending ? null : now,
        createdAt: now,
        updatedAt: now
      })
    })
    const before = await current(value)
    await expect(
      value.base.owner.caller.run((ctx) =>
        commitPreparedSpatialTerminal(ctx, value.saveId, value.geometry)
      )
    ).rejects.toThrow(
      kind === 'root replay' ? 'replay must be handled by the parent' : 'pending rule occurrence'
    )
    expect(await current(value)).toEqual(before)
  }
)

it('prepares and replays authoritative movement evidence before one atomic Scene publication', async () => {
  const value = await setup()
  await value.base.owner.caller.run(async (ctx) => {
    const save = await ctx.db
      .query('sceneGeometrySaves')
      .withIndex('by_publicId', (q) => q.eq('id', value.saveId))
      .unique()
    if (!save) throw new Error('Fixture geometry save missing')
    await ctx.db.patch(save._id, {
      spatialPreparationJson: undefined,
      spatialPreparationChecksum: undefined
    })
  })
  const prepare = makeFunctionReference<
    'mutation',
    ReturnType<typeof sceneGeometryFinishInputSchema.parse>,
    SceneSpatialPreparation
  >('scenes/spatialPreparation:prepare')
  const request = {
    saveId: value.saveId,
    baseOrdinal: 0,
    tokenOrdinals: value.geometry.sceneTokens.map((token, baseOrdinal) => ({
      tokenId: token.id,
      baseOrdinal
    }))
  }
  const before = await current(value)
  const prepared = await value.base.owner.caller.mutation(prepare, request)
  expect(prepared.outcome.kind).toBe('TERMINAL')
  const { save: preparedSave, ...preparedState } = await current(value)
  const { save: priorSave, ...priorState } = before
  expect(preparedState).toEqual(priorState)
  expect(preparedSave.inputChecksum).toBe(priorSave.inputChecksum)
  await expect(value.base.owner.caller.mutation(prepare, request)).resolves.toEqual(prepared)
  const result = await finish(value)
  expect(sceneGeometryCommandResultSchema.parse(result).occurrence?.occurrenceId).toBe(
    prepared.occurrenceId
  )
  const after = await current(value)
  expect(after.runVersion).toBe(before.runVersion + 1)
  expect(after.actor.currentHitPoints).toBe(before.actor.currentHitPoints - 1)
})
