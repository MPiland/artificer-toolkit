import { makeFunctionReference } from 'convex/server'
import { expect, it } from 'vitest'
import type {
  CampaignSessionDto,
  FinishCampaignSessionInput
} from '@artificer-toolkit/schema/api/campaignSessions'
import type {
  DeletePreparedEncounterInputDto,
  DeletePreparedEncounterResultDto,
  EncounterSessionStateDto
} from '@artificer-toolkit/schema/api/encounterData'
import type {
  EncounterCommandResultDto,
  EncounterExecuteInput
} from '@artificer-toolkit/schema/api/encounters'
import type { LiveSessionPresentationCommitInput } from '@artificer-toolkit/schema/api/liveSessions'
import type {
  SceneGeometryCommandResult,
  SceneGeometryExecuteInput
} from '@artificer-toolkit/schema/api/sceneGeometry'
import type {
  BindEncounterToPresentedSceneInputDto,
  BindEncounterToPresentedSceneResultDto,
  SetCampaignLiveScenePresentationResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { sceneStoredDefinitionSaveSchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { createEncounterSceneFixture } from '../../tests/fixtures/encounterScene'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { readRunProjection, readRunState } from '../encounters/documents'

const claim = makeFunctionReference<'mutation', { campaignId: string }, { epoch: string }>(
  'liveSessions/authority:claim'
)
const createSession = makeFunctionReference<'mutation', { campaignId: string }, CampaignSessionDto>(
  'campaigns/sessions:create'
)
const finishSession = makeFunctionReference<
  'mutation',
  FinishCampaignSessionInput,
  CampaignSessionDto
>('campaigns/sessionFinish:finish')
const execute = makeFunctionReference<'mutation', EncounterExecuteInput, EncounterCommandResultDto>(
  'encounters/commands:execute'
)
const activeEncounter = makeFunctionReference<
  'query',
  { campaignId: string },
  EncounterSessionStateDto
>('encounters/activeReads:active')
const deletePrepared = makeFunctionReference<
  'mutation',
  DeletePreparedEncounterInputDto,
  DeletePreparedEncounterResultDto
>('encounters/runs:deletePrepared')
const bindScene = makeFunctionReference<
  'mutation',
  BindEncounterToPresentedSceneInputDto,
  BindEncounterToPresentedSceneResultDto
>('encounters/sceneBindings:bind')
const presentFromRoom = makeFunctionReference<
  'mutation',
  LiveSessionPresentationCommitInput,
  SetCampaignLiveScenePresentationResultDto
>('scenes/presentations:setFromRoom')
const moveDirect = makeFunctionReference<
  'mutation',
  SceneGeometryExecuteInput,
  SceneGeometryCommandResult
>('scenes/geometryFastCommands:execute')

type SceneFixture = Awaited<ReturnType<typeof createEncounterSceneFixture>>

async function activateRun(base: SceneFixture) {
  await base.t.run(async (ctx) => {
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!run) throw new Error('Missing fixture Run.')
    const state = { ...readRunState(run), status: 'ACTIVE' as const }
    const projection = { ...readRunProjection(run), status: 'ACTIVE' as const }
    await ctx.db.patch(run._id, {
      status: 'ACTIVE',
      stateJson: JSON.stringify(state),
      stateChecksum: checksumCanonicalJson(state),
      projectionJson: JSON.stringify(projection),
      projectionChecksum: checksumCanonicalJson(projection)
    })
  })
}

function readPlayRows(base: SceneFixture) {
  return base.t.run(async (ctx) => ({
    authority: await ctx.db
      .query('campaignLiveAuthorities')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
      .unique(),
    presentations: await ctx.db
      .query('campaignScenePresentations')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
      .collect(),
    runs: await ctx.db
      .query('encounterRuns')
      .withIndex('by_campaignId_createdAt_id', (q) => q.eq('campaignId', base.campaign.id))
      .collect()
  }))
}

async function publishSceneSource(base: SceneFixture) {
  await base.t.run(async (ctx) => {
    const scene = await ctx.db
      .query('campaignScenes')
      .withIndex('by_publicId', (q) => q.eq('id', base.sceneId))
      .unique()
    if (!scene) throw new Error('Missing fixture Scene.')
    const counts = {
      annotations: 0,
      barriers: 0,
      darknessZones: 0,
      lights: 0,
      tokens: base.tokens.length
    }
    await ctx.db.insert(
      'sceneDefinitionSaves',
      sceneStoredDefinitionSaveSchema.parse({
        id: base.saveId,
        commandId: scene.materializationCommandId,
        commandFingerprint: '0'.repeat(64),
        ownerUserId: base.other.userId,
        definitionId: scene.definitionId,
        expectedVersion: null,
        settings: {
          campaignId: scene.campaignId,
          name: scene.name,
          ambientIllumination: scene.ambientIllumination,
          fogMode: scene.fogMode,
          visionRevealMode: scene.visionRevealMode,
          grid: scene.grid,
          map: scene.map
        },
        counts,
        received: counts,
        status: 'PUBLISHED',
        liveSceneId: scene.id,
        entitiesRemoved: false,
        createdAt: scene.createdAt,
        expiresAt: Date.now() + 60_000
      })
    )
  })
}

it('builds the party from active assignments and opens the table for a player without a Session', async () => {
  const base = await setupCharacterRun()
  expect(
    base.run.actors.filter((actor) => actor.kind === 'CHARACTER').map((actor) => actor.sourceId)
  ).toEqual([base.character.id])
  expect(
    await base.t.run((ctx) =>
      ctx.db
        .query('campaignSessions')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', base.campaign.id))
        .collect()
    )
  ).toEqual([])
  const authority = await base.player.caller.mutation(claim, { campaignId: base.campaign.id })
  expect(authority).toMatchObject({ campaignId: base.campaign.id, phase: 'ACTIVATING' })
  expect(authority).not.toHaveProperty('sessionId')
})

it('leaves live authority, presentation and an ACTIVE Run untouched when a Session finishes', async () => {
  const base = await createEncounterSceneFixture()
  await activateRun(base)
  await base.owner.caller.mutation(claim, { campaignId: base.campaign.id })
  const session = await base.other.caller.mutation(createSession, { campaignId: base.campaign.id })
  const before = await readPlayRows(base)
  expect(before.presentations).toHaveLength(1)
  await base.other.caller.mutation(finishSession, {
    campaignId: base.campaign.id,
    sessionId: session.id,
    expectedVersion: session.version,
    commandId: crypto.randomUUID()
  })
  expect(await readPlayRows(base)).toEqual(before)
  expect(
    (await base.other.caller.query(activeEncounter, { campaignId: base.campaign.id })).encounter
  ).toMatchObject({ id: base.run.id, status: 'ACTIVE' })
  const reminder = await base.other.caller.mutation(execute, {
    command: {
      type: 'UPSERT_REMINDER',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: base.run.version,
      reminder: {
        label: 'Resume next sitting',
        timing: 'ROUND_NUMBER',
        round: 2,
        actorId: null,
        public: false,
        notes: null,
        order: 0
      }
    }
  })
  expect(reminder.projection).toMatchObject({ id: base.run.id, version: base.run.version + 1 })
})

it('fences direct writes only to the presented Scene while room authority is live', async () => {
  const base = await createEncounterSceneFixture()
  await publishSceneSource(base)
  const authority = await base.owner.caller.mutation(claim, { campaignId: base.campaign.id })
  const token = base.tokens[1]!
  const move = (x: number): SceneGeometryExecuteInput => ({
    input: {
      type: 'MOVE_SCENE_TOKEN',
      sceneId: base.sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 0,
      expectedEncounterVersion: null,
      correlationId: null,
      movementKind: 'VOLUNTARY',
      tokenId: token.id,
      path: [token.position, { x, y: 0 }]
    }
  })
  await expect(base.other.caller.mutation(moveDirect, move(3))).rejects.toThrow(
    'currently owned by its Campaign live table'
  )
  await expect(
    base.other.caller.mutation(bindScene, {
      type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
      commandId: crypto.randomUUID(),
      encounterId: base.run.id
    })
  ).rejects.toThrow('currently owned by its Campaign live table')
  await base.t.mutation(presentFromRoom, {
    campaignId: base.campaign.id,
    actorUserId: base.other.userId,
    epoch: authority.epoch,
    input: {
      type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
      commandId: crypto.randomUUID(),
      expectedPresentationVersion: 0,
      campaignId: base.campaign.id,
      sceneId: null
    },
    expectedSequence: 0,
    expectedStateChecksum: null
  })
  await expect(base.other.caller.mutation(moveDirect, move(3))).resolves.toMatchObject({
    sceneId: base.sceneId,
    replayed: false
  })
})

it('deletes only a prepared Run with exact command replay', async () => {
  const base = await createEncounterSceneFixture()
  const input: DeletePreparedEncounterInputDto = {
    campaignId: base.campaign.id,
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: base.run.version
  }
  await expect(base.owner.caller.mutation(deletePrepared, input)).rejects.toThrow(
    'Campaign not found'
  )
  await expect(
    base.other.caller.mutation(deletePrepared, {
      ...input,
      expectedVersion: input.expectedVersion + 1
    })
  ).rejects.toThrow('Encounter version is stale')
  const result = await base.other.caller.mutation(deletePrepared, input)
  expect(result).toEqual({ campaignId: base.campaign.id, encounterId: base.run.id })
  expect(await base.other.caller.mutation(deletePrepared, input)).toEqual(result)
  await expect(
    base.other.caller.mutation(deletePrepared, { ...input, expectedVersion: 1 })
  ).rejects.toThrow('already used with different input')
  const remaining = await base.t.run(async (ctx) => ({
    runs: await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .collect(),
    actors: await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id))
      .collect(),
    commands: await ctx.db
      .query('encounterRunCommands')
      .withIndex('by_encounterId', (q) => q.eq('encounterId', base.run.id))
      .collect()
  }))
  expect(remaining).toEqual({ runs: [], actors: [], commands: [] })

  const active = await createEncounterSceneFixture()
  await activateRun(active)
  await expect(
    active.other.caller.mutation(deletePrepared, {
      campaignId: active.campaign.id,
      encounterId: active.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: active.run.version
    })
  ).rejects.toThrow('Only prepared Encounters can be deleted')
})
