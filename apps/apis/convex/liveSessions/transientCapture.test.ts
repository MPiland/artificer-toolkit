import { makeFunctionReference } from 'convex/server'
import { expect, it } from 'vitest'
import type {
  LiveSessionTransientCapture,
  LiveSessionTransientCaptureInput,
  LiveSessionVisionRevisions,
  LiveSessionVisionRevisionsInput
} from '@artificer-toolkit/schema/api/liveSessionTransient'
import type { CampaignSessionDto } from '@artificer-toolkit/schema/api/campaignSessions'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type { SceneGeometryCommandResult } from '@artificer-toolkit/schema/api/sceneGeometry'
import type {
  SceneCommandResultDto,
  SceneGeometryCommandInputDto,
  SceneLiveCommandInputDto,
  SetCampaignLiveScenePresentationInputDto,
  SetCampaignLiveScenePresentationResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import {
  createSceneDefinitionFixture,
  publishEmptyScene
} from '../../tests/fixtures/sceneDefinitions'

const capture = makeFunctionReference<
  'query',
  LiveSessionTransientCaptureInput,
  LiveSessionTransientCapture
>('liveSessions/transientCapture:capture')
const visionRevisions = makeFunctionReference<
  'query',
  LiveSessionVisionRevisionsInput,
  LiveSessionVisionRevisions
>('liveSessions/transientCapture:visionRevisions')
const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const createSession = makeFunctionReference<'mutation', { campaignId: string }, CampaignSessionDto>(
  'campaigns/sessions:create'
)
const executeScene = makeFunctionReference<
  'mutation',
  { input: SceneLiveCommandInputDto },
  SceneCommandResultDto
>('scenes/commands:execute')
const executeGeometry = makeFunctionReference<
  'action',
  { input: SceneGeometryCommandInputDto },
  SceneGeometryCommandResult
>('scenes/geometryActions:execute')
const setPresentation = makeFunctionReference<
  'mutation',
  SetCampaignLiveScenePresentationInputDto,
  SetCampaignLiveScenePresentationResultDto
>('scenes/presentations:set')

async function setup() {
  const base = await createSceneDefinitionFixture()
  const { sceneId } = await publishEmptyScene(base)
  await base.owner.caller.mutation(setPresentation, {
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: null,
    campaignId: base.campaign.id,
    sceneId,
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION'
  })
  const input: LiveSessionTransientCaptureInput = {
    campaignId: base.campaign.id,
    expectedRole: 'OWNER',
    expectedUserId: base.owner.userId,
    mode: 'FULL',
    observedCharacterRevisions: [],
    recipientUserIds: [base.owner.userId, base.other.userId]
  }
  return { base, input, sceneId }
}

it('captures current authenticated admission, presentation, active recipient epochs, and Scene freshness', async () => {
  const { base, input, sceneId } = await setup()
  await expect(base.owner.caller.query(capture, input)).resolves.toMatchObject({
    campaignId: base.campaign.id,
    systemId: base.campaign.gameSystemId,
    observedCharacterRevisions: [],
    origin: { role: 'OWNER', userId: base.owner.userId },
    presentation: { campaignId: base.campaign.id, sceneId, version: 0 },
    recipients: expect.arrayContaining([
      expect.objectContaining({ userId: base.owner.userId }),
      expect.objectContaining({ role: 'PLAYER', userId: base.other.userId })
    ]),
    sceneEncounterId: null,
    sceneMovementDecisionPending: false,
    sceneHeader: { id: sceneId, version: 0 },
    sceneSnapshot: {
      scene: expect.objectContaining({ id: sceneId, version: 0 }),
      baseOrdinals: { tokens: [], barriers: [] }
    },
    visionFreshness: expect.any(Object)
  })
  const encounterId = crypto.randomUUID()
  await base.t.run((ctx) =>
    ctx.db.insert('encounterSceneBindings', {
      encounterId,
      campaignId: base.campaign.id,
      sceneId,
      commandId: crypto.randomUUID(),
      commandFingerprint: 'a'.repeat(64),
      createdAt: new Date().toISOString()
    })
  )
  await expect(
    base.owner.caller.query(capture, { ...input, mode: 'AUTHORITY' })
  ).resolves.toMatchObject({
    sceneEncounterId: encounterId,
    sceneMovementDecisionPending: false
  })
}, 30_000)

it('fills the shared room Scene cache with every entity even from a player capture (S-0)', async () => {
  const { base, input, sceneId } = await setup()
  const hiddenToken = {
    assetId: null,
    controlledByUserIds: [],
    height: 1,
    hidden: true,
    id: crypto.randomUUID(),
    label: 'Hidden scout',
    locked: false,
    position: { x: 10, y: 10 },
    rotationDegrees: 0,
    vision: null,
    width: 1
  }
  await base.owner.caller.action(executeGeometry, {
    input: {
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 0,
      sceneId,
      token: hiddenToken,
      type: 'UPSERT_SCENE_TOKEN'
    }
  })
  const playerCapture = await base.other.caller.query(capture, {
    ...input,
    expectedRole: 'PLAYER',
    expectedUserId: base.other.userId
  })
  expect(playerCapture.sceneSnapshot?.scene.tokens.map((token) => token.id)).toEqual([
    hiddenToken.id
  ])
  // A token added during play has no definition ordinal.
  expect(playerCapture.sceneSnapshot?.baseOrdinals).toEqual({
    tokens: [{ tokenId: hiddenToken.id, baseOrdinal: null }],
    barriers: []
  })
})

it('captures a successfully admitted PLAYER origin and rejects anonymous or mismatched socket binding', async () => {
  const { base, input } = await setup()
  const authorityInput = { ...input, mode: 'AUTHORITY' as const }
  const playerInput = {
    ...authorityInput,
    expectedRole: 'PLAYER' as const,
    expectedUserId: base.other.userId
  }
  await expect(base.other.caller.query(capture, playerInput)).resolves.toMatchObject({
    origin: { role: 'PLAYER', userId: base.other.userId }
  })
  await expect(base.t.query(capture, authorityInput)).rejects.toThrow('Unauthenticated')
  await expect(
    base.owner.caller.query(capture, { ...authorityInput, expectedUserId: base.other.userId })
  ).rejects.toThrow('identity')
  await expect(
    base.owner.caller.query(capture, { ...authorityInput, expectedRole: 'PLAYER' })
  ).rejects.toThrow('identity')
})

it('omits departed recipients and returns their new epoch after rejoin', async () => {
  const { base, input } = await setup()
  const authorityInput = { ...input, mode: 'AUTHORITY' as const }
  const before = await base.owner.caller.query(capture, authorityInput)
  const prior = before.recipients.find((recipient) => recipient.userId === base.other.userId)
  if (!prior) throw new Error('Missing player recipient.')
  const later = new Date(Date.parse(prior.membershipEpoch) + 1_000).toISOString()
  await base.t.run(async (ctx) => {
    const membership = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
      )
      .unique()
    if (!membership) throw new Error('Missing player membership.')
    await ctx.db.patch(membership._id, { leftAt: later, status: 'LEFT' })
  })
  await expect(base.owner.caller.query(capture, authorityInput)).resolves.toMatchObject({
    recipients: [expect.objectContaining({ userId: base.owner.userId })]
  })
  await base.t.run(async (ctx) => {
    const membership = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
      )
      .unique()
    if (!membership) throw new Error('Missing player membership.')
    await ctx.db.patch(membership._id, { accessStartedAt: later, leftAt: null, status: 'ACTIVE' })
  })
  await expect(base.owner.caller.query(capture, authorityInput)).resolves.toMatchObject({
    recipients: expect.arrayContaining([
      expect.objectContaining({ membershipEpoch: later, userId: base.other.userId })
    ])
  })
})

it('rejects archived and cross-Campaign captures, and ignores finished Campaign Sessions', async () => {
  const archived = await setup()
  await archived.base.t.run(async (ctx) => {
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', archived.base.campaign.id))
      .unique()
    if (!campaign) throw new Error('Missing Campaign.')
    await ctx.db.patch(campaign._id, { status: 'ARCHIVED' })
  })
  await expect(
    archived.base.owner.caller.query(capture, { ...archived.input, mode: 'AUTHORITY' })
  ).rejects.toThrow('Archived')

  const finished = await setup()
  const finishedSession = await finished.base.owner.caller.mutation(createSession, {
    campaignId: finished.base.campaign.id
  })
  await finished.base.t.run(async (ctx) => {
    const session = await ctx.db
      .query('campaignSessions')
      .withIndex('by_publicId', (q) => q.eq('id', finishedSession.id))
      .unique()
    if (!session) throw new Error('Missing Session.')
    await ctx.db.patch(session._id, { finishedAt: new Date().toISOString(), status: 'FINISHED' })
  })
  await expect(
    finished.base.owner.caller.query(capture, { ...finished.input, mode: 'AUTHORITY' })
  ).resolves.toMatchObject({ campaignId: finished.base.campaign.id })

  const foreign = await setup()
  const foreignCampaign = await foreign.base.other.caller.mutation(createCampaign, {
    name: 'Foreign Campaign',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: foreign.base.campaign.gameSystemId,
    primaryRulesCatalogueId: foreign.base.campaign.primaryRulesCatalogueId
  })
  await expect(
    foreign.base.owner.caller.query(capture, {
      ...foreign.input,
      mode: 'AUTHORITY',
      campaignId: foreignCampaign.id
    })
  ).rejects.toThrow('Campaign not found')
})

it('captures a changed Scene header and presentation revision, then rejects stale Character observations', async () => {
  const { base, input, sceneId } = await setup()
  await base.owner.caller.mutation(executeScene, {
    input: {
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 0,
      illumination: 'DIM',
      sceneId,
      type: 'SET_SCENE_AMBIENT_ILLUMINATION'
    }
  })
  await expect(base.owner.caller.query(capture, input)).resolves.toMatchObject({
    sceneHeader: { ambientIllumination: 'DIM', id: sceneId, version: 1 },
    sceneSnapshot: { scene: { ambientIllumination: 'DIM', id: sceneId, version: 1 } }
  })
  await base.owner.caller.mutation(setPresentation, {
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: 0,
    campaignId: base.campaign.id,
    sceneId: null,
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION'
  })
  await expect(base.owner.caller.query(capture, input)).resolves.toMatchObject({
    presentation: { campaignId: base.campaign.id, sceneId: null, version: 1 },
    sceneEncounterId: null,
    sceneHeader: null,
    sceneSnapshot: null,
    visionFreshness: null
  })

  const characterId = crypto.randomUUID()
  await base.t.run((ctx) =>
    ctx.db.insert('sceneVisionRevisions', {
      id: characterId,
      revision: crypto.randomUUID(),
      scope: 'CHARACTER'
    })
  )
  await expect(
    base.owner.caller.query(capture, {
      ...input,
      observedCharacterRevisions: [{ characterId, revision: crypto.randomUUID() }]
    })
  ).rejects.toThrow('Character changed')
})
it('keeps authority capture on current admission data while skipping Character and compact Scene validation', async () => {
  const { base, input, sceneId } = await setup()
  const characterId = crypto.randomUUID()
  await base.t.run((ctx) =>
    ctx.db.insert('sceneVisionRevisions', {
      id: characterId,
      revision: crypto.randomUUID(),
      scope: 'CHARACTER'
    })
  )
  const authorityInput = {
    ...input,
    mode: 'AUTHORITY' as const,
    observedCharacterRevisions: [{ characterId, revision: crypto.randomUUID() }]
  }
  await expect(base.owner.caller.query(capture, authorityInput)).resolves.toMatchObject({
    origin: { role: 'OWNER', userId: base.owner.userId },
    sceneHeader: { id: sceneId, version: 0 },
    visionFreshness: null
  })

  await base.owner.caller.mutation(executeScene, {
    input: {
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 0,
      illumination: 'DIM',
      sceneId,
      type: 'SET_SCENE_AMBIENT_ILLUMINATION'
    }
  })
  await base.t.run(async (ctx) => {
    const live = await ctx.db
      .query('sceneLiveStates')
      .withIndex('by_sceneId', (q) => q.eq('sceneId', sceneId))
      .unique()
    if (!live) throw new Error('Missing live Scene state.')
    await ctx.db.patch(live._id, { counts: { ...live.counts, tokens: 1 } })
  })
  const authorityCapture = await base.owner.caller.query(capture, authorityInput)
  expect(authorityCapture).not.toHaveProperty('sceneSnapshot')
  expect(authorityCapture.visionFreshness).toBeNull()
  await expect(
    base.owner.caller.query(capture, {
      ...input,
      observedCharacterRevisions: []
    })
  ).rejects.toThrow('Stored Scene geometry state is inconsistent')
})

it('skips vision freshness reads for authority capture while full capture retains them', async () => {
  const { base, input, sceneId } = await setup()
  await base.t.run(async (ctx) => {
    await ctx.db.insert('sceneVisionRevisions', {
      id: base.campaign.gameSystemId,
      revision: crypto.randomUUID(),
      scope: 'SYSTEM'
    })
    await ctx.db.insert('sceneVisionRevisions', {
      id: base.campaign.gameSystemId,
      revision: crypto.randomUUID(),
      scope: 'SYSTEM'
    })
  })

  await expect(
    base.owner.caller.query(capture, { ...input, mode: 'AUTHORITY' })
  ).resolves.toMatchObject({
    sceneHeader: { id: sceneId },
    visionFreshness: null
  })
  await expect(base.owner.caller.query(capture, input)).rejects.toThrow()
})

it('checks only whether the Character revisions behind Scene vision are current (D33)', async () => {
  const { base } = await setup()
  const characterId = crypto.randomUUID()
  const revision = crypto.randomUUID()
  await base.t.run((ctx) =>
    ctx.db.insert('sceneVisionRevisions', { scope: 'CHARACTER', id: characterId, revision })
  )
  const input: LiveSessionVisionRevisionsInput = {
    campaignId: base.campaign.id,
    expectedRole: 'OWNER',
    expectedUserId: base.owner.userId,
    observedCharacterRevisions: [{ characterId, revision }]
  }
  await expect(base.owner.caller.query(visionRevisions, input)).resolves.toEqual({ current: true })
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('sceneVisionRevisions')
      .withIndex('by_scope_id', (q) => q.eq('scope', 'CHARACTER').eq('id', characterId))
      .unique()
    if (row) await ctx.db.patch(row._id, { revision: crypto.randomUUID() })
  })
  await expect(base.owner.caller.query(visionRevisions, input)).resolves.toEqual({ current: false })
  // The read stays member-authorized: a mismatched socket identity is refused.
  await expect(
    base.other.caller.query(visionRevisions, { ...input, expectedUserId: base.owner.userId })
  ).rejects.toThrow()
}, 30_000)
