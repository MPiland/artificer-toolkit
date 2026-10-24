import {
  checkpointLiveRoom,
  closeRoom,
  queueRoomRolls,
  readEncounterHistory,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { writeReceiptRecord, readReceiptHeaders } from '../lib/receiptLedgers'
import { makeFunctionReference, type FunctionArgs } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { CreateEncounterInputDto } from '@artificer-toolkit/schema/api/encounters'
import type { EncounterActorTokenBindingCommandInputDto } from '@artificer-toolkit/schema/api/vttScenes'
import { vttMapStoredAssetSchema } from '@artificer-toolkit/schema/projections/vttMapPersistence'
import { campaignStoredEventSchema } from '@artificer-toolkit/schema/projections/campaignEventPersistence'
import {
  sceneStoredDefinitionSaveSchema,
  sceneStoredDefinitionSchema
} from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { encodeCampaignEvent } from '@artificer-toolkit/schema/api/campaignEventTransport'
import { campaignLiveScenePresentationReceiptDtoSchema } from '@artificer-toolkit/schema/api/vttScenes'
import {
  encounterStoredRuleOccurrenceSchema,
  encounterStoredRuleReceiptSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { characterStoredCommandReceiptSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { api, components } from '../_generated/api'
import {
  bindPresentedScene,
  createEncounterSceneFixture,
  createRun
} from '../../tests/fixtures/encounterScene'
import { setupAutomaticCharacterMovement } from '../../tests/fixtures/automaticCharacterMovement'
import { useMovementReactionsInRoom } from '../../tests/fixtures/automaticSceneMovement'

useLocalRoomWorker()

const removeFixtureState = makeFunctionReference<
  'mutation',
  {
    ownerUserId: string
    playerUserId: string
    campaignId: string
    characterId: string
  },
  null
>('encounters/developmentRuns:removeFixtureState')
const removeFixtureCampaign = makeFunctionReference<
  'mutation',
  {
    ownerUserId: string
    playerUserId: string
    campaignId: string
    characterId: string
  },
  null
>('encounters/developmentCampaign:removeFixtureCampaign')
const removeFixtureScenes = makeFunctionReference<
  'mutation',
  { ownerUserId: string; campaignId: string },
  null
>('scenes/developmentScene:removeFixtureState')
const bindToken = makeFunctionReference<
  'mutation',
  { input: EncounterActorTokenBindingCommandInputDto },
  unknown
>('encounters/actorTokenBindings:execute')
async function setup() {
  const base = await createEncounterSceneFixture()
  await base.t.run(async (ctx) => {
    for (const [index, userId] of [base.other.userId, base.owner.userId].entries()) {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
      if (!profile) throw new Error('Missing fixture profile.')
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }],
          update: { email: `draft_123456abcde${index}@example.invalid` }
        }
      })
    }
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
      .unique()
    if (!campaign) throw new Error('Missing fixture Campaign.')
    await ctx.db.patch(campaign._id, { name: 'Encounter execution fixture' })
    const scene = await ctx.db
      .query('campaignScenes')
      .withIndex('by_publicId', (q) => q.eq('id', base.sceneId))
      .unique()
    if (!scene) throw new Error('Missing fixture Scene.')
    const settings = {
      campaignId: scene.campaignId,
      name: scene.name,
      ambientIllumination: scene.ambientIllumination,
      daylight: scene.daylight,
      fogMode: scene.fogMode,
      visionRevealMode: scene.visionRevealMode,
      grid: scene.grid,
      map: scene.map
    }
    const save = sceneStoredDefinitionSaveSchema.parse({
      id: base.saveId,
      commandId: scene.materializationCommandId,
      commandFingerprint: scene.materializationCommandFingerprint,
      ownerUserId: base.other.userId,
      definitionId: scene.definitionId,
      expectedVersion: null,
      settings,
      counts: {
        annotations: 0,
        barriers: 0,
        darknessZones: 0,
        lights: 0,
        tokens: base.tokens.length
      },
      received: {
        annotations: 0,
        barriers: 0,
        darknessZones: 0,
        lights: 0,
        tokens: base.tokens.length
      },
      status: 'PUBLISHED',
      liveSceneId: scene.id,
      entitiesRemoved: false,
      createdAt: scene.createdAt,
      expiresAt: Date.now() + 60_000
    })
    await ctx.db.insert('sceneDefinitionSaves', save)
    await ctx.db.insert(
      'sceneDefinitions',
      sceneStoredDefinitionSchema.parse({
        ...settings,
        id: scene.definitionId,
        saveId: save.id,
        version: scene.definitionVersion,
        counts: save.counts,
        createdAt: scene.createdAt,
        updatedAt: scene.updatedAt
      })
    )
    const commandId = crypto.randomUUID()
    const receipt = campaignLiveScenePresentationReceiptDtoSchema.parse({
      commandFingerprint: '0'.repeat(64),
      result: {
        commandId,
        replayed: false,
        campaignId: base.campaign.id,
        sceneId: scene.id,
        version: 0
      }
    })
    await ctx.db.insert(
      'campaignEvents',
      campaignStoredEventSchema.parse({
        ...encodeCampaignEvent({
          id: crypto.randomUUID(),
          campaignId: base.campaign.id,
          type: 'SESSION_SCENE_PRESENTATION_SET',
          visibility: 'TABLE',
          subjectCharacterId: null,
          payload: receipt,
          createdAt: scene.createdAt
        }),
        actorUserId: base.other.userId,
        visibleInHistory: true,
        commandId,
        inputFingerprint: '0'.repeat(64)
      })
    )
  })
  const cleanup: FunctionArgs<typeof removeFixtureState> = {
    ownerUserId: base.other.userId,
    playerUserId: base.owner.userId,
    campaignId: base.campaign.id,
    characterId: crypto.randomUUID()
  }
  return { ...base, cleanup }
}

async function createRuns(base: Awaited<ReturnType<typeof setup>>, count: number) {
  const runs = [base.run]
  for (let index = 1; index < count; index++) {
    const input: CreateEncounterInputDto = {
      campaignId: base.campaign.id,
      blueprintId: base.blueprint.id,
      commandId: crypto.randomUUID()
    }
    runs.push(await base.other.caller.mutation(createRun, input))
  }
  return runs
}

async function bindRuns(
  base: Awaited<ReturnType<typeof setup>>,
  runs: Awaited<ReturnType<typeof createRuns>>
) {
  for (const run of runs) {
    await base.other.caller.run((ctx) =>
      bindPresentedScene(ctx, {
        type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
        commandId: crypto.randomUUID(),
        encounterId: run.id
      })
    )
    const actor = run.actors[0]
    const token = base.tokens[0]
    if (!actor || !token) throw new Error('Missing fixture actor or token.')
    await base.other.caller.mutation(bindToken, {
      input: {
        type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
        commandId: crypto.randomUUID(),
        encounterId: run.id,
        actorId: actor.id,
        sceneId: base.sceneId,
        tokenId: token.id,
        expectedEncounterVersion: run.version
      }
    })
  }
}

async function seedRuleReceipt(base: Awaited<ReturnType<typeof setup>>, actorUserId: string) {
  await base.t.run(async (ctx) => {
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!run) throw new Error('Missing fixture Run.')
    const commandId = crypto.randomUUID()
    const now = run.createdAt
    const occurrence = encounterStoredRuleOccurrenceSchema.parse({
      id: crypto.randomUUID(),
      campaignId: base.campaign.id,
      encounterId: run.id,
      rootCommandId: commandId,
      state: 'COMPLETED',
      version: 0,
      expectedEncounterVersion: 0,
      pendingSnapshotChecksum: null,
      completedAt: now,
      createdAt: now,
      updatedAt: now
    })
    await ctx.db.insert('encounterRuleOccurrences', occurrence)
    await writeReceiptRecord(
      ctx,
      'encounterRuleReceipts',
      encounterStoredRuleReceiptSchema.parse({
        id: crypto.randomUUID(),
        campaignId: base.campaign.id,
        encounterId: run.id,
        occurrenceId: occurrence.id,
        commandId,
        commandType: 'RESOLVE_ACTION',
        commandFingerprint: '0'.repeat(64),
        encounterVersion: 0,
        commandMetadataJson: '{}',
        resultJson: '{}',
        resultChecksum: '0'.repeat(64),
        actorUserId,
        correlationId: null,
        createdAt: now
      })
    )
  })
}

async function seedPreservedSceneRows(base: Awaited<ReturnType<typeof setup>>) {
  const { draft, character } = await base.createCharacter()
  await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  base.cleanup.characterId = character.id
  await base.t.run(async (ctx) => {
    const scene = await ctx.db
      .query('campaignScenes')
      .withIndex('by_publicId', (q) => q.eq('id', base.sceneId))
      .unique()
    if (!scene) throw new Error('Missing fixture Scene.')
    await ctx.db.insert('campaignCharacterAssignments', {
      campaignId: base.campaign.id,
      userId: base.owner.userId,
      characterId: character.id,
      assignedAt: base.campaign.createdAt
    })

    await ctx.db.insert(
      'mediaAssets',
      vttMapStoredAssetSchema.parse({
        id: scene.map.assetId,
        ownerUserId: base.other.userId,
        storageAssetId: scene.map.assetId,
        profileClass: 'VTT_MAP',
        contentHash: null,
        upload: {
          originalFileName: 'fixture-map.png',
          declaredMimeType: 'image/png',
          declaredBytes: 1,
          idempotencyKey: crypto.randomUUID()
        },
        status: 'READY',
        rawObjectKey: null,
        uploadExpiresAt: 0,
        chargedBytes: 3,
        width: scene.map.width,
        height: scene.map.height,
        variants: [],
        operation: null,
        cleanupAt: null,
        hasSceneReferences: true
      })
    )
  })
  await base.other.caller.mutation(api.campaigns.sessions.create, { campaignId: base.campaign.id })
}

async function fixtureState(base: Awaited<ReturnType<typeof setup>>, runIds?: readonly string[]) {
  return base.t.run(async (ctx) => {
    const runs = await ctx.db
      .query('encounterRuns')
      .withIndex('by_campaignId_createdAt_id', (q) => q.eq('campaignId', base.campaign.id))
      .collect()
    const ids = runIds ?? runs.map((run) => run.id)
    const children = await Promise.all(
      ids.map(async (runId) => ({
        runId,
        actors: await ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) => q.eq('encounterId', runId))
          .collect(),
        commands: await (
          await readEncounterHistory(ctx)
        )
          .query('encounterRunCommands')
          .withIndex('by_encounterId', (q) => q.eq('encounterId', runId))
          .collect(),
        occurrences: await ctx.db
          .query('encounterRuleOccurrences')
          .withIndex('by_encounterId_state', (q) => q.eq('encounterId', runId))
          .collect(),
        receipts: await (
          await readEncounterHistory(ctx)
        )
          .query('encounterRuleReceipts')
          .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', runId))
          .collect(),
        rounds: await ctx.db
          .query('encounterInitiativeRounds')
          .withIndex('by_encounterId_round', (q) => q.eq('encounterId', runId))
          .collect(),
        participants: await ctx.db
          .query('encounterInitiativeParticipants')
          .withIndex('by_encounterId_round_actorId', (q) => q.eq('encounterId', runId))
          .collect(),
        sides: await ctx.db
          .query('encounterInitiativeSides')
          .withIndex('by_encounterId_round_sideId', (q) => q.eq('encounterId', runId))
          .collect(),
        sceneBinding: await ctx.db
          .query('encounterSceneBindings')
          .withIndex('by_encounterId', (q) => q.eq('encounterId', runId))
          .unique(),
        actorBindings: await ctx.db
          .query('encounterActorTokenBindings')
          .withIndex('by_encounterId_actorId', (q) => q.eq('encounterId', runId))
          .collect()
      }))
    )
    const scene = await ctx.db
      .query('campaignScenes')
      .withIndex('by_publicId', (q) => q.eq('id', base.sceneId))
      .unique()
    return {
      receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
      receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
      campaign: await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
        .unique(),
      runs,
      children,
      session: await ctx.db
        .query('campaignSessions')
        .withIndex('by_campaignId_sessionNumber', (q) => q.eq('campaignId', base.campaign.id))
        .unique(),
      scene,
      map: scene
        ? await ctx.db
            .query('mediaAssets')
            .withIndex('by_publicId', (q) => q.eq('id', scene.map.assetId))
            .unique()
        : null,
      presentation: await ctx.db
        .query('campaignScenePresentations')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
        .unique(),
      attendance: await ctx.db
        .query('campaignSessionAttendance')
        .withIndex('by_campaignId_sessionId_characterId', (q) =>
          q.eq('campaignId', base.campaign.id)
        )
        .collect(),
      entities: await ctx.db
        .query('sceneDefinitionEntities')
        .withIndex('by_saveId', (q) => q.eq('saveId', base.saveId))
        .collect()
    }
  })
}

/** A stored Character Sheet receipt by `actorId`, for the fixture Character. */
function characterReceipt(
  value: Awaited<ReturnType<typeof setupAutomaticCharacterMovement>>,
  id: string,
  actorId: string
) {
  return characterStoredCommandReceiptSchema.parse({
    id,
    characterId: value.base.character.id,
    commandId: crypto.randomUUID(),
    actorId,
    commandFingerprint: '0'.repeat(64),
    occurredAt: new Date().toISOString(),
    historyJson: '{}',
    historyChecksum: checksumCanonicalJson({})
  })
}

async function settleNativeMovementFixture() {
  const value = await setupAutomaticCharacterMovement(['AUTOMATIC'])
  await queueRoomRolls(value.base.campaign.id, { rolls: [], repeat: 14 })
  // Assisted mode turns the authored automatic reaction into the GM's Use choice; the Use response
  // settles the movement.
  const { occurrence } = await useMovementReactionsInRoom(value)
  if (!occurrence || occurrence.pending)
    throw new Error('Expected the native movement to settle in the room.')
  // The room holds the Run's command rows and receipts (D85); it checkpoints the Run and its
  // occurrences, then lets go so the cleanup mutation, which writes Convex directly, owns the Run.
  await checkpointLiveRoom(value.base.campaign.id)
  await closeRoom(value.base.campaign.id)
  return {
    value,
    cleanup: {
      ownerUserId: value.owner.userId,
      playerUserId: value.player.userId,
      campaignId: value.base.campaign.id,
      characterId: value.base.character.id
    }
  }
}

async function nativeMovementCleanupState(
  value: Awaited<ReturnType<typeof settleNativeMovementFixture>>['value']
) {
  return value.base.t.run(async (ctx) => ({
    receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
    receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
    runs: await ctx.db
      .query('encounterRuns')
      .withIndex('by_campaignId_createdAt_id', (q) => q.eq('campaignId', value.base.campaign.id))
      .collect(),
    commands: await ctx.db.query('encounterRunCommands').collect(),
    occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
    receipts: await ctx.db.query('encounterRuleReceipts').collect(),
    characterReceipts: await ctx.db
      .query('characterCommandReceipts')
      .withIndex('by_characterId_commandId', (q) => q.eq('characterId', value.base.character.id))
      .collect()
      .then((headers) => readReceiptHeaders(ctx, 'characterCommandReceipts', headers))
  }))
}

function expectRunChildrenRemoved(state: Awaited<ReturnType<typeof fixtureState>>) {
  expect(state.runs).toEqual([])
  expect(state.receiptLedgers.filter((ledger) => ledger.scope === 'CAMPAIGN')).toEqual([])
  expect(state.receiptLedgerParts).toEqual([])
  for (const child of state.children) {
    expect(child.actors).toEqual([])
    expect(child.commands).toEqual([])
    expect(child.occurrences).toEqual([])
    expect(child.receipts).toEqual([])
    expect(child.rounds).toEqual([])
    expect(child.participants).toEqual([])
    expect(child.sides).toEqual([])
    expect(child.sceneBinding).toBeNull()
    expect(child.actorBindings).toEqual([])
  }
}

describe('development Encounter Run cleanup', () => {
  it('removes eight bound Runs, preserves scene/session state, and retries as a no-op', async () => {
    const base = await setup()
    const runs = await createRuns(base, 8)
    await bindRuns(base, runs)
    await seedPreservedSceneRows(base)
    const ids = runs.map((run) => run.id)
    const before = await fixtureState(base, ids)
    await expect(
      base.t.run(async (ctx) => {
        await ctx.runMutation(removeFixtureState, base.cleanup)
        throw new Error('Injected fixture cleanup rollback')
      })
    ).rejects.toThrow('Injected fixture cleanup rollback')
    expect(await fixtureState(base, ids)).toEqual(before)
    await base.t.mutation(removeFixtureState, base.cleanup)
    const after = await fixtureState(base, ids)
    expectRunChildrenRemoved(after)
    expect(after).toMatchObject({
      campaign: before.campaign,
      session: before.session,
      scene: before.scene,
      map: before.map,
      presentation: before.presentation,
      attendance: before.attendance,
      entities: before.entities
    })
    expect(before.map).not.toBeNull()
    expect(before.attendance).toHaveLength(1)
    await expect(base.t.mutation(removeFixtureState, base.cleanup)).resolves.toBeNull()
  }, 30_000)

  it('rejects a tenth Campaign Run without writes', async () => {
    const base = await setup()
    const runs = await createRuns(base, 10)
    await bindRuns(base, runs)
    const ids = runs.map((run) => run.id)
    const before = await fixtureState(base, ids)
    await expect(base.t.mutation(removeFixtureState, base.cleanup)).rejects.toThrow(
      'Fixture Run ownership or bounds mismatch.'
    )
    expect(await fixtureState(base, ids)).toEqual(before)
  }, 30_000)

  it('rejects a Run whose round history exceeds the complete cleanup read', async () => {
    const base = await setup()
    const runs = await createRuns(base, 1)
    const run = runs[0]!
    await base.t.run(async (ctx) => {
      for (let round = 1; round <= 12; round++) {
        await ctx.db.insert('encounterInitiativeRounds', {
          encounterId: run.id,
          round,
          procedure: 'MANUAL',
          cadence: 'ENCOUNTER_START',
          status: 'ACTIVE',
          policySnapshotChecksum: null,
          nextTurnOrderOrdinal: 0,
          version: 0,
          createdAt: run.createdAt,
          updatedAt: run.updatedAt
        })
      }
    })
    const ids = runs.map((entry) => entry.id)
    const before = await fixtureState(base, ids)
    await expect(base.t.mutation(removeFixtureState, base.cleanup)).rejects.toThrow(
      'Fixture Encounter dependency or ownership mismatch.'
    )
    expect(await fixtureState(base, ids)).toEqual(before)
  }, 30_000)

  it.each(['missing Scene', 'foreign actor', 'missing Run binding'])(
    'rejects a late %s without deleting earlier Run receipts',
    async (kind) => {
      const base = await setup()
      const runs = await createRuns(base, 2)
      await bindRuns(base, runs)
      const late = runs[1]
      if (!late) throw new Error('Missing late Run.')
      await base.t.run(async (ctx) => {
        if (kind === 'missing Run binding') {
          const binding = await ctx.db
            .query('encounterSceneBindings')
            .withIndex('by_encounterId', (q) => q.eq('encounterId', late.id))
            .unique()
          if (!binding) throw new Error('Missing late Scene binding.')
          await ctx.db.delete(binding._id)
          return
        }
        if (kind === 'missing Scene') {
          const binding = await ctx.db
            .query('encounterSceneBindings')
            .withIndex('by_encounterId', (q) => q.eq('encounterId', late.id))
            .unique()
          if (!binding) throw new Error('Missing late Scene binding.')
          await ctx.db.patch(binding._id, { sceneId: crypto.randomUUID() })
          return
        }
        const binding = await ctx.db
          .query('encounterActorTokenBindings')
          .withIndex('by_encounterId_actorId', (q) => q.eq('encounterId', late.id))
          .unique()
        if (!binding) throw new Error('Missing late actor binding.')
        await ctx.db.patch(binding._id, { actorId: crypto.randomUUID() })
      })
      const ids = runs.map((run) => run.id)
      const before = await fixtureState(base, ids)
      await expect(base.t.mutation(removeFixtureState, base.cleanup)).rejects.toThrow(
        'Fixture Encounter dependency or ownership mismatch.'
      )
      const after = await fixtureState(base, ids)
      expect(after).toEqual(before)
      expect(before.children[0]?.commands.length).toBeGreaterThan(0)
      expect(after.children[0]?.receipts).toEqual(before.children[0]?.receipts)
    },
    30_000
  )

  it('rejects wrong-owner and nonfixture callers without writes', async () => {
    const base = await setup()
    const runs = await createRuns(base, 2)
    await bindRuns(base, runs)
    const ids = runs.map((run) => run.id)
    const before = await fixtureState(base, ids)
    await expect(
      base.t.mutation(removeFixtureState, {
        ...base.cleanup,
        ownerUserId: base.owner.userId,
        playerUserId: base.other.userId
      })
    ).rejects.toThrow('Fixture Campaign ownership mismatch.')
    await expect(
      base.t.mutation(removeFixtureState, {
        ...base.cleanup,
        ownerUserId: crypto.randomUUID()
      })
    ).rejects.toThrow()
    expect(await fixtureState(base, ids)).toEqual(before)
  }, 30_000)

  it('removes a valid rule receipt authored by the fixture player', async () => {
    const base = await setup()
    await seedRuleReceipt(base, base.owner.userId)
    const before = await fixtureState(base, [base.run.id])
    await base.t.mutation(removeFixtureState, base.cleanup)
    const after = await fixtureState(base, [base.run.id])
    expectRunChildrenRemoved(after)
    expect(after).toMatchObject({
      campaign: before.campaign,
      session: before.session,
      scene: before.scene,
      map: before.map,
      presentation: before.presentation,
      attendance: before.attendance,
      entities: before.entities
    })
  }, 30_000)

  it('rejects a rule receipt authored by an outside user without writes', async () => {
    const base = await setup()
    await seedRuleReceipt(base, crypto.randomUUID())
    const before = await fixtureState(base, [base.run.id])
    await expect(base.t.mutation(removeFixtureState, base.cleanup)).rejects.toThrow(
      'Fixture Encounter dependency or ownership mismatch.'
    )
    expect(await fixtureState(base, [base.run.id])).toEqual(before)
  }, 30_000)

  it('removes the native movement history and preserves unrelated Character history', async () => {
    const fixture = await settleNativeMovementFixture()
    const playerReceiptId = crypto.randomUUID()
    await fixture.value.base.t.run((ctx) =>
      writeReceiptRecord(
        ctx,
        'characterCommandReceipts',
        characterReceipt(fixture.value, playerReceiptId, fixture.value.player.userId)
      )
    )
    expect((await nativeMovementCleanupState(fixture.value)).runs.map((run) => run.id)).toContain(
      fixture.value.base.run.id
    )
    await fixture.value.base.t.mutation(removeFixtureState, fixture.cleanup)
    const after = await nativeMovementCleanupState(fixture.value)
    expect(after.runs).toEqual([])
    expect(after.commands).toEqual([])
    expect(after.occurrences).toEqual([])
    expect(after.receipts).toEqual([])
    expect(after.characterReceipts.map((receipt) => receipt.id)).toEqual([playerReceiptId])
    expect(after.receiptLedgers.filter((ledger) => ledger.scope === 'CAMPAIGN')).toEqual([])
    expect(after.receiptLedgerParts).toEqual([])
  }, 30_000)

  it('rejects unlinked foreign Character history before deleting native movement parents', async () => {
    const fixture = await settleNativeMovementFixture()
    await fixture.value.base.t.run((ctx) =>
      writeReceiptRecord(
        ctx,
        'characterCommandReceipts',
        characterReceipt(fixture.value, crypto.randomUUID(), crypto.randomUUID())
      )
    )
    const before = await nativeMovementCleanupState(fixture.value)
    await expect(
      fixture.value.base.t.mutation(removeFixtureState, fixture.cleanup)
    ).rejects.toThrow('Fixture Encounter dependency or ownership mismatch.')
    expect(await nativeMovementCleanupState(fixture.value)).toEqual(before)
  }, 30_000)

  it('requires ordered Run and Scene cleanup before removing the fixture Campaign', async () => {
    const base = await setup()
    const runs = await createRuns(base, 2)
    const ids = runs.map((run) => run.id)
    const before = await fixtureState(base, ids)
    await expect(base.t.mutation(removeFixtureCampaign, base.cleanup)).rejects.toThrow()
    expect(await fixtureState(base, ids)).toEqual(before)
    await base.t.mutation(removeFixtureState, base.cleanup)
    await base.t.mutation(removeFixtureScenes, {
      ownerUserId: base.cleanup.ownerUserId,
      campaignId: base.cleanup.campaignId
    })
    await base.t.mutation(removeFixtureCampaign, base.cleanup)
    const after = await fixtureState(base, ids)
    expect(after.campaign).toBeNull()
    expect(after.session).toBeNull()
    expect(after.scene).toBeNull()
    expect(after.presentation).toBeNull()
    expect(after.attendance).toEqual([])
    expect(after.entities).toEqual([])
    expectRunChildrenRemoved(after)
  }, 30_000)
})
