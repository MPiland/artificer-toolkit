import { makeFunctionReference } from 'convex/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  AppendSceneDefinitionInput,
  BeginSceneDefinitionInput,
  SceneDefinitionSaveProgress
} from '@artificer-toolkit/schema/api/sceneDefinitionSave'
import type {
  SceneGeometryCommandResult,
  SceneGeometryExecuteInput
} from '@artificer-toolkit/schema/api/sceneGeometry'
import type {
  SceneUndoCommandResult,
  SceneUndoExecuteInput
} from '@artificer-toolkit/schema/api/sceneUndo'
import type {
  SetCampaignLiveScenePresentationInputDto,
  SetCampaignLiveScenePresentationResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import type { campaignCharacterSheetExecuteInputSchema } from '@artificer-toolkit/schema/api/campaignCharacterSheet'
import type { CharacterSheetCommandResponseDto } from '@artificer-toolkit/schema/api/characterSheetCommands'
import type {
  LiveSessionActivationInput,
  LiveSessionAuthorityDto,
  LiveSessionBootstrapInput,
  LiveSessionBootstrapResponse,
  LiveSessionDrainReleaseInput,
  LiveSessionPublishInput,
  LiveSessionPublishResponse
} from '@artificer-toolkit/schema/api/liveSessionState'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { SceneBarrier, SceneToken } from '@artificer-toolkit/shared/vtt/scene'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { createSceneDefinitionFixture } from '../../tests/fixtures/sceneDefinitions'
import { api } from '../_generated/api'

const secret = 'test-live-session-worker-secret-that-is-long-enough'
const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const claim = makeFunctionReference<'mutation', { campaignId: string }, LiveSessionAuthorityDto>(
  'liveSessions/authority:claim'
)
const setPresentation = makeFunctionReference<
  'mutation',
  SetCampaignLiveScenePresentationInputDto,
  SetCampaignLiveScenePresentationResultDto
>('scenes/presentations:set')
const activate = makeFunctionReference<
  'mutation',
  LiveSessionActivationInput,
  LiveSessionAuthorityDto
>('liveSessions/state:activate')
const publish = makeFunctionReference<
  'mutation',
  LiveSessionPublishInput,
  LiveSessionPublishResponse
>('liveSessions/state:publish')
const beginSceneDefinition = makeFunctionReference<
  'mutation',
  BeginSceneDefinitionInput,
  SceneDefinitionSaveProgress
>('scenes/definitions:begin')
const appendSceneDefinition = makeFunctionReference<
  'mutation',
  { input: AppendSceneDefinitionInput },
  SceneDefinitionSaveProgress
>('scenes/definitions:append')
const publishSceneDefinition = makeFunctionReference<
  'mutation',
  { saveId: string },
  SceneDefinitionSaveProgress
>('scenes/definitions:publish')
const executeFastGeometry = makeFunctionReference<
  'mutation',
  SceneGeometryExecuteInput,
  SceneGeometryCommandResult
>('scenes/geometryFastCommands:execute')
const executeGeometry = makeFunctionReference<
  'action',
  SceneGeometryExecuteInput,
  SceneGeometryCommandResult
>('scenes/geometryActions:execute')
const executeFastUndo = makeFunctionReference<
  'mutation',
  SceneUndoExecuteInput,
  SceneUndoCommandResult
>('scenes/undo:executeFast')
const executeUndo = makeFunctionReference<'action', SceneUndoExecuteInput, SceneUndoCommandResult>(
  'scenes/undo:execute'
)
const executeCampaignSheet = makeFunctionReference<
  'mutation',
  z.input<typeof campaignCharacterSheetExecuteInputSchema>,
  CharacterSheetCommandResponseDto
>('campaigns/characterSheet:execute')

beforeEach(() => vi.stubEnv('LIVE_SESSION_WORKER_SECRET', secret))
afterEach(() => vi.unstubAllEnvs())

it('keeps Character Sheet commands in Convex while Scene authority is active and draining', async () => {
  const { owner: player, other: gm, ...base } = await readySheetFixture()
  const campaign = await gm.caller.mutation(createCampaign, {
    name: 'Live Scene with Convex Character Sheet',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  await base.t.run(async (ctx) => {
    await ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: player.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
    await ctx.db.insert('campaignCharacterAssignments', {
      campaignId: campaign.id,
      userId: player.userId,
      characterId: base.character.id,
      assignedAt: campaign.createdAt
    })
  })
  const authority = await player.caller.mutation(claim, { campaignId: campaign.id })
  const bootstrapInput: LiveSessionBootstrapInput = {
    campaignId: campaign.id,
    authorityEpoch: authority.epoch,
    expectedUserId: player.userId,
    expectedRole: 'PLAYER'
  }
  const playerBootstrap = await player.caller.fetch(
    '/live-sessions/bootstrap',
    request(bootstrapInput, authHeaders())
  )
  expect(playerBootstrap.status).toBe(200)
  const metadata = (await playerBootstrap.json()) as LiveSessionBootstrapResponse
  expect(metadata).toEqual({
    activationFingerprint: authority.activationFingerprint,
    persistedSequence: 0,
    persistedStateChecksum: authority.persistedStateChecksum
  })
  const gmBootstrap = await gm.caller.fetch(
    '/live-sessions/bootstrap',
    request({ ...bootstrapInput, expectedUserId: gm.userId, expectedRole: 'OWNER' }, authHeaders())
  )
  expect(gmBootstrap.status).toBe(200)
  expect(await gmBootstrap.json()).toEqual(metadata)
  expect(
    (
      await player.caller.fetch(
        '/live-sessions/bootstrap',
        request(bootstrapInput, {
          ...authHeaders(),
          'x-artificer-live-session-secret': secret + '-bad'
        })
      )
    ).status
  ).toBe(401)
  expect(
    (
      await player.caller.fetch(
        '/live-sessions/bootstrap',
        request({ ...bootstrapInput, expectedUserId: gm.userId }, authHeaders())
      )
    ).status
  ).toBe(409)
  expect(
    (
      await player.caller.fetch(
        '/live-sessions/bootstrap',
        request({ ...bootstrapInput, authorityEpoch: crypto.randomUUID() }, authHeaders())
      )
    ).status
  ).toBe(409)

  const sceneChecksum = 'a'.repeat(64)
  const active = await base.t.mutation(activate, {
    campaignId: campaign.id,
    epoch: authority.epoch,
    activationFingerprint: authority.activationFingerprint,
    stateChecksum: sceneChecksum
  })
  expect(active.phase).toBe('DO_ACTIVE')
  const before = await player.caller.query(api.campaigns.characterSheet.get, {
    campaignId: campaign.id,
    characterId: base.character.id
  })
  const adjustment = {
    campaignId: campaign.id,
    characterId: base.character.id,
    command: adjustmentCommand(1)
  }
  const [adjusted, duplicate] = await Promise.all([
    player.caller.mutation(executeCampaignSheet, adjustment),
    player.caller.mutation(executeCampaignSheet, adjustment)
  ])
  expect(duplicate).toEqual(adjusted)
  expect(adjusted.streamVersion).toBe(2)
  expect(adjusted.sheet.overview.maxHitPoints).toBe(before.overview.maxHitPoints + 1)
  expect((await base.readState()).receipts).toHaveLength(1)

  const drainInput: LiveSessionDrainReleaseInput = {
    campaignId: campaign.id,
    epoch: authority.epoch,
    finalSequence: 0,
    finalStateChecksum: sceneChecksum
  }
  const drainResponse = await base.t.fetch(
    '/live-sessions/begin-drain',
    request(drainInput, workerHeaders())
  )
  expect(drainResponse.status).toBe(200)
  expect((await drainResponse.json()) as LiveSessionAuthorityDto).toMatchObject({
    phase: 'DRAINING',
    persistedSequence: 0
  })
  const damage = {
    campaignId: campaign.id,
    characterId: base.character.id,
    command: {
      type: 'ADJUST_HIT_POINTS' as const,
      commandId: crypto.randomUUID(),
      expectedVersion: 2,
      mode: 'DAMAGE' as const,
      amount: 2
    }
  }
  const damaged = await player.caller.mutation(executeCampaignSheet, damage)
  expect(damaged.streamVersion).toBe(3)
  expect(damaged.sheet.overview.currentHitPoints).toBe(adjusted.sheet.overview.currentHitPoints - 2)
  const replay = await player.caller.mutation(executeCampaignSheet, adjustment)
  expect(replay.streamVersion).toBe(3)
  expect(replay.historyEntry).toEqual(adjusted.historyEntry)

  const competing = await Promise.allSettled(
    [1, 2].map((amount) =>
      player.caller.mutation(executeCampaignSheet, {
        campaignId: campaign.id,
        characterId: base.character.id,
        command: {
          type: 'ADJUST_HIT_POINTS',
          commandId: crypto.randomUUID(),
          expectedVersion: 3,
          mode: 'DAMAGE',
          amount
        }
      })
    )
  )
  expect(competing.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
  expect(competing.filter((result) => result.status === 'rejected')).toHaveLength(1)
  const rejected = competing.find((result) => result.status === 'rejected')
  if (!rejected) throw new Error('Expected one stale Character Sheet command.')
  expect(rejected.reason).toMatchObject({
    message: expect.stringContaining('Character Sheet changed')
  })
  const stored = await base.readState()
  expect(stored.character?.streamVersion).toBe(4)
  expect(stored.receipts).toHaveLength(3)
  const authorityRow = await base.t.run((ctx) =>
    ctx.db
      .query('campaignLiveAuthorities')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
      .unique()
  )
  expect(authorityRow).toMatchObject({ phase: 'DRAINING', persistedSequence: 0 })
  expect(
    (await base.t.fetch('/live-sessions/release', request(drainInput, workerHeaders()))).status
  ).toBe(200)
}, 60_000)
it('publishes one resolved live door command with exact replay, fences and atomic rollback', async () => {
  const base = await createSceneDefinitionFixture()
  const initialDoor = door()
  const save = await base.owner.caller.mutation(beginSceneDefinition, {
    ...base.input,
    counts: { ...base.input.counts, barriers: 1 }
  })
  await base.owner.caller.mutation(appendSceneDefinition, {
    input: {
      saveId: save.saveId,
      offset: 0,
      collection: 'barriers',
      entities: [initialDoor]
    }
  })
  await base.owner.caller.mutation(publishSceneDefinition, { saveId: save.saveId })
  if (!save.liveSceneId) throw new Error('Missing live Scene fixture.')
  const presentation = await base.owner.caller.mutation(setPresentation, {
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: null,
    campaignId: base.campaign.id,
    sceneId: save.liveSceneId
  })
  const authority = await base.owner.caller.mutation(claim, { campaignId: base.campaign.id })
  const initialStateChecksum = '1'.repeat(64)
  const nextStateChecksum = '2'.repeat(64)
  await base.t.mutation(activate, {
    campaignId: base.campaign.id,
    epoch: authority.epoch,
    activationFingerprint: authority.activationFingerprint,
    stateChecksum: initialStateChecksum
  })

  const command = {
    type: 'SET_SCENE_DOOR_STATE' as const,
    sceneId: save.liveSceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    barrierId: initialDoor.id,
    state: 'OPEN' as const
  }
  const presentationFence = { expectedPresentationVersion: presentation.version }
  const expectedSceneResult = {
    commandId: command.commandId,
    delta: { kind: 'DOOR_STATE_SET' as const, barrierId: initialDoor.id, state: 'OPEN' as const },
    occurrence: null,
    replayed: false,
    sceneId: save.liveSceneId,
    version: 1
  }
  const input: LiveSessionPublishInput = {
    campaignId: base.campaign.id,
    epoch: authority.epoch,
    sequence: 1,
    expectedStateChecksum: initialStateChecksum,
    stateChecksum: nextStateChecksum,
    actorUserId: base.owner.userId,
    actorRole: 'OWNER',
    command: { scope: 'SCENE', command, presentation: presentationFence },
    // Commands occur inside this authority epoch, before any later access change.
    occurredAt: new Date().toISOString(),
    receiptId: crypto.randomUUID(),
    expectedSceneResult
  }

  await expect(
    base.owner.caller.mutation(executeFastGeometry, {
      input: command,
      presentation: presentationFence
    })
  ).rejects.toThrow('owned by its Campaign live table')
  await expect(
    base.owner.caller.action(executeGeometry, { input: command, presentation: presentationFence })
  ).rejects.toThrow('owned by its Campaign live table')
  await expect(base.t.mutation(publish, { ...input, actorRole: 'PLAYER' })).rejects.toThrow(
    'actor role mismatch'
  )

  const published = await base.t.mutation(publish, input)
  expect(published).toMatchObject({
    scope: 'SCENE',
    authority: { persistedSequence: 1, persistedStateChecksum: nextStateChecksum },
    sceneResult: expectedSceneResult
  })
  await expect(base.t.mutation(publish, input)).resolves.toEqual(published)

  await base.t.run(async (ctx) => {
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
      .unique()
    const owner = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.owner.userId)
      )
      .unique()
    const newOwner = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
      )
      .unique()
    const currentPresentation = await ctx.db
      .query('campaignScenePresentations')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
      .unique()
    if (!campaign || !owner || !newOwner || !currentPresentation)
      throw new Error('Missing Campaign fixture.')
    // Ownership transfer restarts both members' access after the committed command.
    const transferredAt = new Date(Date.parse(input.occurredAt) + 1).toISOString()
    await ctx.db.patch(campaign._id, { status: 'ARCHIVED', ownerUserId: base.other.userId })
    await ctx.db.patch(owner._id, { role: 'PLAYER', accessStartedAt: transferredAt })
    await ctx.db.patch(newOwner._id, { role: 'OWNER', accessStartedAt: transferredAt })
    await ctx.db.patch(currentPresentation._id, { version: currentPresentation.version + 1 })
  })
  await expect(
    base.owner.caller.query(api.scenes.liveReads.header, { sceneId: save.liveSceneId })
  ).rejects.toThrow('only available to the Campaign owner')
  await expect(
    base.other.caller.mutation(executeFastGeometry, {
      input: command,
      presentation: presentationFence
    })
  ).rejects.toThrow('Archived Campaigns are read-only')

  const reusedCommand = { ...command, state: 'CLOSED' as const }
  await expect(
    base.t.mutation(publish, {
      ...input,
      command: { scope: 'SCENE', command: reusedCommand, presentation: presentationFence },
      expectedSceneResult: {
        ...expectedSceneResult,
        delta: { kind: 'DOOR_STATE_SET', barrierId: initialDoor.id, state: 'CLOSED' }
      }
    })
  ).rejects.toThrow('already used')

  const nextCommand = {
    ...command,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 1,
    state: 'CLOSED' as const
  }
  const nextResult = {
    ...expectedSceneResult,
    commandId: nextCommand.commandId,
    delta: { kind: 'DOOR_STATE_SET' as const, barrierId: initialDoor.id, state: 'CLOSED' as const },
    version: 2
  }
  const nextInput: LiveSessionPublishInput = {
    ...input,
    sequence: 2,
    expectedStateChecksum: nextStateChecksum,
    stateChecksum: '3'.repeat(64),
    receiptId: crypto.randomUUID(),
    command: { scope: 'SCENE', command: nextCommand, presentation: presentationFence },
    expectedSceneResult: nextResult
  }
  await expect(
    base.t.mutation(publish, {
      ...nextInput,
      epoch: crypto.randomUUID()
    })
  ).rejects.toThrow('authority is stale')
  await expect(
    base.t.mutation(publish, {
      ...nextInput,
      command: {
        ...nextInput.command,
        command: { ...nextCommand, expectedSceneVersion: 0 }
      },
      expectedSceneResult: { ...nextResult, version: 1 }
    })
  ).rejects.toThrow('Scene version is stale')

  await expect(
    base.t.mutation(publish, {
      ...nextInput,
      expectedStateChecksum: 'f'.repeat(64)
    })
  ).rejects.toThrow('not contiguous')
  await base.t.run(async (ctx) => {
    const state = await ctx.db
      .query('sceneLiveStates')
      .withIndex('by_sceneId', (q) => q.eq('sceneId', save.liveSceneId!))
      .unique()
    const doorState = await ctx.db
      .query('sceneLiveEntities')
      .withIndex('by_sceneId_collection_entityId', (q) =>
        q
          .eq('sceneId', save.liveSceneId!)
          .eq('collection', 'barriers')
          .eq('entityId', initialDoor.id)
      )
      .unique()
    const rolledBackReceipt = await ctx.db
      .query('sceneLiveCommands')
      .withIndex('by_sceneId_commandId', (q) =>
        q.eq('sceneId', save.liveSceneId!).eq('commandId', nextCommand.commandId)
      )
      .unique()
    const currentAuthority = await ctx.db
      .query('campaignLiveAuthorities')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
      .unique()
    expect(state?.version).toBe(1)
    expect(doorState?.doorState).toBe('OPEN')
    expect(rolledBackReceipt).toBeNull()
    expect(currentAuthority).toMatchObject({
      persistedSequence: 1,
      persistedStateChecksum: nextStateChecksum
    })
  })
  const delayed = await base.t.mutation(publish, nextInput)
  expect(delayed).toMatchObject({
    authority: { persistedSequence: 2, persistedStateChecksum: nextInput.stateChecksum },
    sceneResult: nextResult
  })
  await expect(base.t.mutation(publish, nextInput)).resolves.toEqual(delayed)
}, 60_000)

it('publishes exact standalone movement and undo while live authority rejects direct writes', async () => {
  const base = await createSceneDefinitionFixture()
  const token: SceneToken = {
    id: crypto.randomUUID(),
    assetId: null,
    label: 'Controlled scout',
    width: 1,
    height: 1,
    position: { x: 100, y: 100 },
    rotationDegrees: 0,
    hidden: false,
    locked: false,
    controlledByUserIds: [base.other.userId],
    vision: {
      enabled: false,
      brightRange: 0,
      dimRange: 0,
      angleDegrees: 360,
      directionDegrees: 0
    }
  }
  const uncontrolled: SceneToken = {
    ...token,
    id: crypto.randomUUID(),
    label: 'Uncontrolled scout',
    position: { x: 100, y: 300 },
    controlledByUserIds: []
  }
  const save = await base.owner.caller.mutation(beginSceneDefinition, {
    ...base.input,
    counts: { ...base.input.counts, tokens: 2 }
  })
  await base.owner.caller.mutation(appendSceneDefinition, {
    input: {
      saveId: save.saveId,
      offset: 0,
      collection: 'tokens',
      entities: [token, uncontrolled]
    }
  })
  await base.owner.caller.mutation(publishSceneDefinition, { saveId: save.saveId })
  if (!save.liveSceneId) throw new Error('Missing live Scene fixture.')
  const presentation = await base.owner.caller.mutation(setPresentation, {
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: null,
    campaignId: base.campaign.id,
    sceneId: save.liveSceneId
  })
  const authority = await base.owner.caller.mutation(claim, { campaignId: base.campaign.id })
  const initialStateChecksum = '4'.repeat(64)
  const movedStateChecksum = '5'.repeat(64)
  const undoneStateChecksum = '6'.repeat(64)
  await base.t.mutation(activate, {
    campaignId: base.campaign.id,
    epoch: authority.epoch,
    activationFingerprint: authority.activationFingerprint,
    stateChecksum: initialStateChecksum
  })
  const presentationFence = { expectedPresentationVersion: presentation.version }
  const move = {
    type: 'MOVE_SCENE_TOKEN' as const,
    sceneId: save.liveSceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    expectedEncounterVersion: null,
    correlationId: null,
    movementKind: 'VOLUNTARY' as const,
    tokenId: token.id,
    path: [token.position, { x: 200, y: 100 }]
  }
  const moveResult = {
    commandId: move.commandId,
    delta: {
      kind: 'TOKEN_MOVED' as const,
      tokenId: token.id,
      position: { x: 200, y: 100 }
    },
    occurrence: null,
    replayed: false,
    sceneId: save.liveSceneId,
    version: 1
  }
  const movePublication: LiveSessionPublishInput = {
    campaignId: base.campaign.id,
    epoch: authority.epoch,
    sequence: 1,
    expectedStateChecksum: initialStateChecksum,
    stateChecksum: movedStateChecksum,
    actorUserId: base.other.userId,
    actorRole: 'PLAYER',
    command: { scope: 'SCENE', command: move, presentation: presentationFence },
    occurredAt: new Date().toISOString(),
    receiptId: crypto.randomUUID(),
    expectedSceneResult: moveResult
  }

  await expect(
    base.other.caller.mutation(executeFastGeometry, {
      input: move,
      presentation: presentationFence
    })
  ).rejects.toThrow('owned by its Campaign live table')
  await expect(
    base.other.caller.action(executeGeometry, { input: move, presentation: presentationFence })
  ).rejects.toThrow('owned by its Campaign live table')
  const unauthorized = {
    ...move,
    commandId: crypto.randomUUID(),
    tokenId: uncontrolled.id,
    path: [uncontrolled.position, { x: 200, y: 300 }]
  }
  await expect(
    base.t.mutation(publish, {
      ...movePublication,
      command: { scope: 'SCENE', command: unauthorized, presentation: presentationFence },
      expectedSceneResult: {
        ...moveResult,
        commandId: unauthorized.commandId,
        delta: {
          kind: 'TOKEN_MOVED',
          tokenId: uncontrolled.id,
          position: { x: 200, y: 300 }
        }
      }
    })
  ).rejects.toThrow('token they control')
  await expect(
    base.t.mutation(publish, {
      ...movePublication,
      command: {
        scope: 'SCENE',
        command: {
          ...move,
          commandId: crypto.randomUUID(),
          path: [
            { x: 99, y: 100 },
            { x: 200, y: 100 }
          ]
        },
        presentation: presentationFence
      }
    })
  ).rejects.toThrow()
  await expect(
    base.t.mutation(publish, {
      ...movePublication,
      expectedSceneResult: {
        ...moveResult,
        delta: { ...moveResult.delta, position: { x: 201, y: 100 } }
      }
    })
  ).rejects.toThrow('Scene result mismatch')
  await expect(
    base.t.mutation(publish, { ...movePublication, actorRole: 'OWNER' })
  ).rejects.toThrow('actor role mismatch')

  await base.t.run(async (ctx) => {
    const member = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
      )
      .unique()
    if (!member) throw new Error('Missing player fixture.')
    await ctx.db.patch(member._id, { status: 'LEFT', leftAt: new Date().toISOString() })
  })
  await expect(
    base.other.caller.query(api.scenes.recipientReads.header, { sceneId: save.liveSceneId })
  ).rejects.toThrow('Campaign not found')

  const moved = await base.t.mutation(publish, movePublication)
  expect(moved).toMatchObject({
    scope: 'SCENE',
    authority: { persistedSequence: 1, persistedStateChecksum: movedStateChecksum },
    sceneResult: moveResult
  })
  await expect(base.t.mutation(publish, movePublication)).resolves.toEqual(moved)

  await base.t.run(async (ctx) => {
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
      .unique()
    const owner = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.owner.userId)
      )
      .unique()
    const newOwner = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
      )
      .unique()
    if (!campaign || !owner || !newOwner) throw new Error('Missing Campaign fixture.')
    // Ownership transfer restarts both members' access after the committed move and undo.
    const transferredAt = new Date(Date.parse(movePublication.occurredAt) + 2).toISOString()
    await ctx.db.patch(campaign._id, { ownerUserId: base.other.userId })
    await ctx.db.patch(owner._id, { role: 'PLAYER', accessStartedAt: transferredAt })
    await ctx.db.patch(newOwner._id, {
      role: 'OWNER',
      status: 'ACTIVE',
      leftAt: null,
      accessStartedAt: transferredAt
    })
  })

  const undo = {
    type: 'UNDO_LAST_SCENE_MOVE' as const,
    sceneId: save.liveSceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 1
  }
  const undoResult = {
    commandId: undo.commandId,
    delta: {
      kind: 'TOKEN_MOVE_UNDONE' as const,
      tokenId: token.id,
      position: token.position,
      undoneCommandId: move.commandId
    },
    occurrence: null,
    replayed: false,
    sceneId: save.liveSceneId,
    version: 2
  }
  const undoPublication: LiveSessionPublishInput = {
    ...movePublication,
    sequence: 2,
    expectedStateChecksum: movedStateChecksum,
    stateChecksum: undoneStateChecksum,
    actorUserId: base.owner.userId,
    actorRole: 'OWNER',
    command: { scope: 'SCENE', command: undo, presentation: presentationFence },
    occurredAt: new Date(Date.parse(movePublication.occurredAt) + 1).toISOString(),
    receiptId: crypto.randomUUID(),
    expectedSceneResult: undoResult
  }
  await expect(
    base.owner.caller.mutation(executeFastUndo, { input: undo, presentation: presentationFence })
  ).rejects.toThrow('only available to the Campaign owner')
  await expect(
    base.owner.caller.action(executeUndo, { input: undo, presentation: presentationFence })
  ).rejects.toThrow('only available to the Campaign owner')
  await expect(
    base.t.mutation(publish, { ...undoPublication, actorRole: 'PLAYER' })
  ).rejects.toThrow('committed Campaign owner')

  const undone = await base.t.mutation(publish, undoPublication)
  expect(undone).toMatchObject({
    scope: 'SCENE',
    authority: { persistedSequence: 2, persistedStateChecksum: undoneStateChecksum },
    sceneResult: undoResult
  })
  await expect(base.t.mutation(publish, undoPublication)).resolves.toEqual(undone)
  await expect(
    base.t.mutation(publish, {
      ...undoPublication,
      expectedSceneResult: { ...undoResult, version: 3 }
    })
  ).rejects.toThrow('Scene result mismatch')

  await base.t.run(async (ctx) => {
    const state = await ctx.db
      .query('sceneLiveStates')
      .withIndex('by_sceneId', (q) => q.eq('sceneId', save.liveSceneId!))
      .unique()
    const storedToken = await ctx.db
      .query('sceneLiveEntities')
      .withIndex('by_sceneId_collection_entityId', (q) =>
        q.eq('sceneId', save.liveSceneId!).eq('collection', 'tokens').eq('entityId', token.id)
      )
      .unique()
    const storedUndo = await ctx.db
      .query('sceneLiveCommands')
      .withIndex('by_sceneId_commandId', (q) =>
        q.eq('sceneId', save.liveSceneId!).eq('commandId', undo.commandId)
      )
      .unique()
    const currentAuthority = await ctx.db
      .query('campaignLiveAuthorities')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
      .unique()
    expect(state?.version).toBe(2)
    expect(storedToken?.value).toMatchObject({
      collection: 'tokens',
      entity: { position: token.position }
    })
    expect(storedUndo).toMatchObject({
      encoding: 'UNDO',
      result: { ...undoResult, restoredFogOwners: [] }
    })
    expect(currentAuthority).toMatchObject({
      persistedSequence: 2,
      persistedStateChecksum: undoneStateChecksum
    })
  })
}, 60_000)

function door(id: string = crypto.randomUUID()): SceneBarrier {
  return {
    a: { x: 0, y: 0 },
    b: { x: 10, y: 0 },
    blocksLightWhenClosed: true,
    blocksMovementWhenClosed: true,
    id,
    initialState: 'CLOSED',
    kind: 'DOOR',
    openAngleDegrees: 90
  }
}
function adjustmentCommand(expectedVersion: number) {
  return {
    type: 'UPSERT_SHEET_ADJUSTMENT' as const,
    commandId: crypto.randomUUID(),
    expectedVersion,
    adjustment: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      family: 'HIT_POINTS' as const,
      field: 'MAXIMUM_MODIFIER' as const,
      value: 1,
      sourceNote: 'Campaign adjustment'
    }
  }
}

function request(input: unknown, headers: Record<string, string>): RequestInit {
  return { body: JSON.stringify(input), headers, method: 'POST' }
}

function workerHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-artificer-live-session-secret': secret
  }
}
function authHeaders(): Record<string, string> {
  return {
    Authorization: 'Bearer test-convex-identity',
    'Content-Type': 'application/json',
    'x-artificer-live-session-secret': secret
  }
}
