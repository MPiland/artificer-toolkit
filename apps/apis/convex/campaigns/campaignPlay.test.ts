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
  BindEncounterToPresentedSceneInputDto,
  BindEncounterToPresentedSceneResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import {
  createEncounterSceneFixture,
  publishSceneSource
} from '../../tests/fixtures/encounterScene'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import { executeInRoom } from '../../tests/fixtures/liveSessionWorker'

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

type SceneFixture = Awaited<ReturnType<typeof createEncounterSceneFixture>>

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
  await publishSceneSource(base)
  await base.t.run((ctx) => activateFixtureRun(ctx, base.run.id))
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
  // The claimed room finishes activating before it runs an Encounter command.
  await base.t.run(async (ctx) => {
    const authority = await ctx.db
      .query('campaignLiveAuthorities')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
      .unique()
    if (!authority) throw new Error('Missing claimed live authority.')
    await ctx.db.patch(authority._id, { phase: 'DO_ACTIVE' })
  })
  const reminder = await executeInRoom(base.other.caller, {
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

it('fences direct Scene binding while room authority is live', async () => {
  const base = await createEncounterSceneFixture()
  await publishSceneSource(base)
  await base.owner.caller.mutation(claim, { campaignId: base.campaign.id })
  await expect(
    base.other.caller.mutation(bindScene, {
      type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
      commandId: crypto.randomUUID(),
      encounterId: base.run.id
    })
  ).rejects.toThrow('currently owned by its Campaign live table')
})

it('fences prepared Run deletion while room authority is live', async () => {
  const base = await createEncounterSceneFixture()
  await base.owner.caller.mutation(claim, { campaignId: base.campaign.id })
  await expect(
    base.other.caller.mutation(deletePrepared, {
      campaignId: base.campaign.id,
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: base.run.version
    })
  ).rejects.toThrow('currently owned by its Campaign live table')
  expect(
    await base.t.run((ctx) =>
      ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
        .unique()
    )
  ).toMatchObject({ status: 'PREPARED', version: base.run.version })
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
  await active.t.run((ctx) => activateFixtureRun(ctx, active.run.id))
  await expect(
    active.other.caller.mutation(deletePrepared, {
      campaignId: active.campaign.id,
      encounterId: active.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: active.run.version
    })
  ).rejects.toThrow('Only prepared Encounters can be deleted')
})
