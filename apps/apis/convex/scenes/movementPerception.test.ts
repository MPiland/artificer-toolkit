import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounters'
import type {
  EncounterActorTokenBindingCommandInputDto,
  SceneDefinitionDto
} from '@artificer-toolkit/schema/api/vttScenes'
import {
  sceneStoredDefinitionEntitySchema,
  sceneStoredDefinitionSaveSchema,
  sceneStoredInitialStateSchema,
  sceneStoredPresentationSchema
} from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import { isScenePointExplored } from '@artificer-toolkit/shared/vtt'
import type { SceneFogChunksPage } from '@artificer-toolkit/schema/api/sceneFog'
import { api, internal } from '../_generated/api'
import { setupCreatureReactionRun, reactionRecords } from '../../tests/fixtures/movementReaction'
import {
  planMovementDecisionInRoom,
  planMovementInRoom
} from '../../tests/fixtures/liveSessionWorker'
import { readReceiptHeaders } from '../lib/receiptLedgers'
import { createConvexEncounterStoreReader } from '../lib/convexEncounterStore'

const bindActorToken = makeFunctionReference<
  'mutation',
  { input: EncounterActorTokenBindingCommandInputDto },
  EncounterCommandResultDto
>('encounters/actorTokenBindings:execute')
const pendingReference = makeFunctionReference<'query', { encounterId: string }, unknown>(
  'encounters/pendingReads:pendingRuleOccurrence'
)

async function setup(withVision = false, returnsToOrigin = false) {
  const base = await setupCreatureReactionRun('SEE')
  const now = new Date().toISOString()
  const sceneId = crypto.randomUUID()
  const definitionSaveId = crypto.randomUUID()
  const commandId = crypto.randomUUID()
  const grid = {
    kind: 'SQUARE' as const,
    origin: { x: 0, y: 0 },
    cellSize: 100,
    distancePerCell: 5,
    diagonalPolicy: 'EQUAL' as const,
    unit: 'FEET' as const
  }
  const tokens: SceneDefinitionDto['tokens'] = [50, 150].map((x, index) => ({
    id: crypto.randomUUID(),
    assetId: null,
    controlledByUserIds: withVision && index === 1 ? [base.owner.userId] : [],
    width: 100,
    height: 100,
    hidden: false,
    label: index === 0 ? 'Reactor' : 'Mover',
    locked: false,
    position: { x, y: 50 },
    rotationDegrees: 0,
    vision:
      withVision && index === 1
        ? {
            enabled: true,
            brightRange: 5,
            dimRange: 5,
            angleDegrees: 360,
            directionDegrees: 0
          }
        : null
  }))
  const settings = {
    campaignId: base.campaign.id,
    name: 'Reaction Scene',
    ambientIllumination: 'BRIGHT' as const,
    fogMode: 'PER_PLAYER' as const,
    visionRevealMode: 'ON_DRAG' as const,
    grid,
    map: {
      assetId: crypto.randomUUID(),
      width: 1000,
      height: 1000,
      tileManifestAssetId: null
    }
  }
  const counts = {
    annotations: 0,
    barriers: 0,
    darknessZones: 0,
    lights: 0,
    tokens: 2
  }
  await base.t.run(async (ctx) => {
    const materializationCommandId = crypto.randomUUID()
    const definitionId = crypto.randomUUID()
    await ctx.db.insert(
      'campaignScenes',
      sceneStoredInitialStateSchema.parse({
        ...settings,
        id: sceneId,
        definitionId,
        definitionVersion: 1,
        definitionSaveId,
        version: 0,
        materializationCommandId,
        materializationCommandFingerprint: '0'.repeat(64),
        createdAt: now,
        updatedAt: now
      })
    )
    await ctx.db.insert(
      'sceneDefinitionSaves',
      sceneStoredDefinitionSaveSchema.parse({
        id: definitionSaveId,
        commandId: materializationCommandId,
        commandFingerprint: '0'.repeat(64),
        ownerUserId: base.owner.userId,
        definitionId,
        expectedVersion: null,
        settings,
        counts,
        received: counts,
        status: 'PUBLISHED',
        liveSceneId: sceneId,
        entitiesRemoved: false,
        createdAt: now,
        expiresAt: Date.now() + 60_000
      })
    )
    for (const [ordinal, entity] of tokens.entries()) {
      const value = { collection: 'tokens' as const, entity }
      await ctx.db.insert(
        'sceneDefinitionEntities',
        sceneStoredDefinitionEntitySchema.parse({
          saveId: definitionSaveId,
          entityId: entity.id,
          ordinal,
          value,
          checksum: checksumCanonicalJson(value)
        })
      )
    }
    await ctx.db.insert(
      'campaignScenePresentations',
      sceneStoredPresentationSchema.parse({
        campaignId: base.campaign.id,
        sceneId,
        version: 0,
        activeMapAssetId: null,
        createdAt: now,
        updatedAt: now
      })
    )
    await ctx.db.insert('encounterSceneBindings', {
      encounterId: base.run.id,
      campaignId: base.campaign.id,
      sceneId,
      commandId,
      commandFingerprint: checksumCanonicalJson({ sceneId }),
      createdAt: now
    })
  })
  let version = base.run.version
  for (const [index, actor] of [base.reactor, base.mover].entries()) {
    const result = await base.owner.caller.mutation(bindActorToken, {
      input: {
        type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
        commandId: crypto.randomUUID(),
        encounterId: base.run.id,
        expectedEncounterVersion: version,
        actorId: actor.id,
        sceneId,
        tokenId: tokens[index]!.id
      }
    })
    version = result.projection.version
  }
  const input = {
    sceneId,
    commandId,
    expectedSceneVersion: 0,
    type: 'MOVE_SCENE_TOKEN' as const,
    expectedEncounterVersion: version,
    correlationId: null,
    tokenId: tokens[1]!.id,
    movementKind: 'VOLUNTARY' as const,
    path: [
      { x: 150, y: 50 },
      { x: withVision ? 750 : 350, y: 50 },
      ...(returnsToOrigin ? [{ x: 150, y: 50 }] : [])
    ]
  }
  return { base, input, tokens, settings }
}

describe('room Scene movement perception staging', () => {
  it('captures retained SEE contacts after moving and completes the response through the geometry action', async () => {
    const { base, input } = await setup(true)
    const move = await planMovementInRoom(base.owner.caller, {
      ...input,
      commandId: crypto.randomUUID()
    })
    const boundary = await move.publish()
    if (!boundary.occurrence?.pending) throw new Error('Expected current movement choice.')
    expect(boundary.delta).toMatchObject({
      kind: 'TOKEN_MOVED',
      position: { x: 200, y: 50 }
    })
    const plan = await planMovementDecisionInRoom(base.owner.caller, {
      type: 'RESOLVE_RULE_OCCURRENCE',
      commandId: crypto.randomUUID(),
      encounterId: base.run.id,
      expectedVersion: boundary.occurrence.pending.encounterVersion,
      occurrenceId: boundary.occurrence.occurrenceId,
      expectedOccurrenceVersion: boundary.occurrence.occurrenceVersion,
      correlationId: null,
      resolution: { kind: 'DECLINE' }
    })
    const before = await reactionRecords(base.t, base.run.id)
    expect(plan.outcome.kind).toBe('TERMINAL')
    expect(await reactionRecords(base.t, base.run.id)).toEqual(before)
    const result = await plan.publish()
    expect(result).toMatchObject({
      occurrence: { status: 'COMPLETE', pending: null },
      delta: {
        kind: 'TOKEN_MOVED',
        tokenId: input.tokenId,
        position: input.path.at(-1)
      },
      fogPatches: [{ ownerUserId: base.owner.userId, mode: 'REPLACE' }]
    })
  }, 30000)

  it.each([false, true])(
    'derives and publishes fog only through the actual pending contact when the path%s returns to origin',
    async (returnsToOrigin) => {
      const { base, input, settings } = await setup(true, returnsToOrigin)
      const before = await reactionRecords(base.t, base.run.id)
      const command = { ...input, commandId: crypto.randomUUID() }
      const move = await planMovementInRoom(base.owner.caller, command)
      const result = await move.publish()
      expect(result).toMatchObject({
        version: 1,
        delta: {
          kind: 'TOKEN_MOVED',
          tokenId: input.tokenId,
          position: { x: 200, y: 50 }
        },
        occurrence: { status: 'PENDING' },
        fogPatches: [{ ownerUserId: base.owner.userId, mode: 'REPLACE' }]
      })
      const chunks: SceneFogChunksPage['page'] = []
      let page: SceneFogChunksPage
      let offset = 0
      do {
        page = await base.owner.caller.query(internal.scenes.transientFogReads.chunks, {
          sceneId: command.sceneId,
          ownerUserId: base.owner.userId,
          expectedVersion: result.version,
          offset,
          numItems: 8
        })
        chunks.push(...page.page)
        offset = page.nextOffset
      } while (!page.isDone)
      const layer = {
        ownerUserId: base.owner.userId,
        width: page.width,
        height: page.height,
        chunks
      }
      const explored = {
        map: settings.map,
        fogMode: settings.fogMode,
        fogLayers: [layer]
      }
      expect(isScenePointExplored(explored, base.owner.userId, { x: 250, y: 75 })).toBe(true)
      expect(isScenePointExplored(explored, base.owner.userId, { x: 650, y: 75 })).toBe(false)
      const after = await reactionRecords(base.t, base.run.id)
      expect(after.run).toEqual(before.run)
      expect(after.actors).toEqual(before.actors)
      expect(await (await planMovementInRoom(base.owner.caller, command)).publish()).toEqual({
        ...result,
        replayed: true
      })
      expect(await reactionRecords(base.t, base.run.id)).toEqual(after)
    },
    30000
  )

  it('publishes the actual boundary and pending receipt atomically and replays exactly', async () => {
    const { base, input, tokens } = await setup()
    const plan = await planMovementInRoom(base.owner.caller, input)
    if (plan.outcome.kind !== 'PENDING') throw new Error('Expected reaction choice.')
    const beforeMechanics = await reactionRecords(base.t, base.run.id)
    const records = () =>
      base.t.run(async (ctx) => ({
        occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
        receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
        receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
        receiptHeaders: await ctx.db.query('encounterRuleReceipts').collect(),
        receipts: await readReceiptHeaders(
          ctx,
          'encounterRuleReceipts',
          await ctx.db.query('encounterRuleReceipts').collect()
        ),
        commands: await ctx.db.query('sceneLiveCommands').collect(),
        entities: await ctx.db.query('sceneLiveEntities').collect(),
        states: await ctx.db.query('sceneLiveStates').collect()
      }))
    const before = await records()
    expect(await records()).toEqual(before)
    expect(await reactionRecords(base.t, base.run.id)).toEqual(beforeMechanics)
    const result = await plan.publish()
    expect(result).toMatchObject({
      version: 1,
      replayed: false,
      delta: {
        kind: 'TOKEN_MOVED',
        tokenId: tokens[1]!.id,
        position: { x: 200, y: 50 }
      },
      occurrence: { occurrenceVersion: 0, status: 'PENDING' }
    })
    const occurrenceId = result.occurrence?.occurrenceId
    if (!occurrenceId) throw new Error('Expected a published occurrence.')
    expect(await reactionRecords(base.t, base.run.id)).toEqual(beforeMechanics)
    const after = await records()
    expect(after.occurrences).toHaveLength(before.occurrences.length + 1)
    expect(after.receipts).toHaveLength(before.receipts.length + 1)
    const occurrence = after.occurrences.find((row) => row.id === occurrenceId)!
    expect(
      (
        await base.t.run((ctx) =>
          readPendingSnapshot({ db: createConvexEncounterStoreReader(ctx) }, occurrence)
        )
      )?.applicationContext
    ).toMatchObject({ root: { currentSceneVersion: 1 } })
    expect(after.entities.find((row) => row.entityId === tokens[1]!.id)?.value).toMatchObject({
      entity: { position: { x: 200, y: 50 } }
    })
    expect(await (await planMovementInRoom(base.owner.caller, input)).publish()).toEqual({
      ...result,
      replayed: true
    })
    expect(await records()).toEqual(after)
    const receipt = after.receipts.find((row) => row.commandId === input.commandId)!
    expect(JSON.parse(receipt.commandMetadataJson)).toMatchObject({
      encounterVersionTransition: 'UNCHANGED',
      sceneVersionTransition: 'ADVANCED'
    })
  }, 30000)

  it('projects a native pending movement choice only to its current audience', async () => {
    const { base, input } = await setup()
    const plan = await planMovementInRoom(base.owner.caller, input)
    if (plan.outcome.kind !== 'PENDING') throw new Error('Expected reaction choice.')
    const published = (await plan.publish()).occurrence
    if (!published?.pending) throw new Error('Expected a published pending occurrence.')
    const prepared = {
      occurrenceId: published.occurrenceId,
      expectedEncounterVersion: published.pending.encounterVersion
    }
    const query = { encounterId: base.run.id }
    await expect(base.other.caller.query(pendingReference, query)).rejects.toThrow(
      'Campaign not found.'
    )
    await expect(base.t.query(pendingReference, query)).rejects.toThrow('Unauthenticated')
    const now = new Date().toISOString()
    await base.t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: base.campaign.id,
        userId: base.other.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        joinedAt: now,
        accessStartedAt: now,
        leftAt: null
      })
    )
    const occurrenceRowId = await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRuleOccurrences')
        .withIndex('by_encounterId_state', (q) =>
          q.eq('encounterId', base.run.id).eq('state', 'PENDING')
        )
        .unique()
      if (!row) throw new Error('Missing published occurrence.')
      return row._id
    })
    const visible = await base.owner.caller.query(pendingReference, query)
    expect(visible).toMatchObject({
      kind: 'MOVEMENT_REACTION',
      occurrenceId: prepared.occurrenceId,
      occurrenceVersion: 0,
      encounterVersion: prepared.expectedEncounterVersion,
      allowedResponses: ['DECLINE', 'OPTION']
    })
    const wire = JSON.stringify(visible)
    for (const privateField of [
      'pendingSnapshot',
      'graph',
      'facts',
      'nodeOutputs',
      'seal',
      'reactionTimeline',
      'actionSourceCurrentnessChecksum',
      'eligibilityEvidenceChecksum'
    ])
      expect(wire).not.toContain(`"${privateField}"`)
    expect(await base.other.caller.query(pendingReference, query)).toBeNull()
    const before = await reactionRecords(base.t, base.run.id)
    for (const patch of [
      { campaignId: crypto.randomUUID() },
      { expectedEncounterVersion: prepared.expectedEncounterVersion + 1 },
      { rootCommandId: crypto.randomUUID() }
    ]) {
      await base.t.run((ctx) => ctx.db.patch(occurrenceRowId, patch))
      await expect(base.owner.caller.query(pendingReference, query)).rejects.toThrow(
        /Stored Encounter occurrence (state|root) is invalid\./
      )
      await base.t.run((ctx) =>
        ctx.db.patch(occurrenceRowId, {
          campaignId: base.campaign.id,
          expectedEncounterVersion: prepared.expectedEncounterVersion,
          rootCommandId: input.commandId
        })
      )
    }
    expect(await base.owner.caller.query(pendingReference, query)).toEqual(visible)
    expect(await reactionRecords(base.t, base.run.id)).toEqual(before)
    await base.owner.caller.mutation(api.campaigns.ownership.request, {
      campaignId: base.campaign.id,
      recipientUserId: base.other.userId
    })
    const transferred = await base.other.caller.mutation(api.campaigns.ownership.accept, {
      campaignId: base.campaign.id
    })
    expect(await base.other.caller.query(pendingReference, query)).toEqual(visible)
    expect(await base.owner.caller.query(pendingReference, query)).toBeNull()
    expect(await reactionRecords(base.t, base.run.id)).toEqual(before)
    const formerOwner = transferred.memberships.find(
      (member) => member.userId === base.owner.userId
    )
    if (!formerOwner) throw new Error('Missing former-owner membership.')
    await base.owner.caller.mutation(api.campaigns.membershipDeparture.leave, {
      campaignId: base.campaign.id,
      expectedCampaignVersion: transferred.version,
      expectedMembershipAccessStartedAt: formerOwner.accessStartedAt,
      commandId: crypto.randomUUID()
    })
    await expect(base.owner.caller.query(pendingReference, query)).rejects.toThrow(
      'Campaign not found.'
    )
    expect(await base.other.caller.query(pendingReference, query)).toEqual(visible)
    await base.t.run((ctx) =>
      ctx.db.patch(occurrenceRowId, {
        pendingSnapshotChecksum: '0'.repeat(64)
      })
    )
    await expect(base.other.caller.query(pendingReference, query)).rejects.toThrow(
      'Pending snapshot does not match its checksum.'
    )
  }, 30000)

  it('hydrates current Scene evidence and freezes the exact reaction choice without settling mechanics', async () => {
    const { base, input } = await setup()
    const before = await reactionRecords(base.t, base.run.id)
    const prepared = await planMovementInRoom(base.owner.caller, input)
    expect(prepared.outcome.kind).toBe('PENDING')
    if (prepared.outcome.kind !== 'PENDING') throw new Error('Expected reaction choice.')
    expect(prepared.outcome.movementIntent).toMatchObject({
      position: { x: 200, y: 50 }
    })
    expect(prepared.outcome.pendingSnapshot.applicationContext).toMatchObject({
      kind: 'ENCOUNTER_MOVEMENT_REACTION',
      phase: { kind: 'CHOICE' }
    })
    expect(await reactionRecords(base.t, base.run.id)).toEqual(before)
  }, 30000)
})
