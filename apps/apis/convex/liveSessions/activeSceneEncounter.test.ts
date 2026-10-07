import { makeFunctionReference } from 'convex/server'
import { expect, it } from 'vitest'
import type {
  LiveSessionRoomAuthorizationInput,
  LiveSessionRoomAuthorizationResponse
} from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import {
  bindPresentedScene,
  createEncounterSceneFixture,
  createRun
} from '../../tests/fixtures/encounterScene'
import { insertActiveLiveAuthority } from '../../tests/fixtures/localRoomWorker'

const read = makeFunctionReference<
  'query',
  LiveSessionRoomAuthorizationInput,
  LiveSessionRoomAuthorizationResponse
>('liveSessions/roomAuthorization:read')

it('plays only the ACTIVE Run bound to the Scene, though a PREPARED Run bound later is newer', async () => {
  const base = await createEncounterSceneFixture()
  const prepared = await base.other.caller.mutation(createRun, {
    campaignId: base.campaign.id,
    blueprintId: base.blueprint.id,
    commandId: crypto.randomUUID()
  })
  const bindRun = (encounterId: string) =>
    base.other.caller.run((ctx) =>
      bindPresentedScene(ctx, {
        type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
        commandId: crypto.randomUUID(),
        encounterId
      })
    )
  const epoch = crypto.randomUUID()
  const readPlay = async () => {
    const response = await base.t.query(read, {
      campaignId: base.campaign.id,
      epoch,
      known: null
    } satisfies LiveSessionRoomAuthorizationInput)
    if (!response.play) throw new Error('Missing Play authorization.')
    return response.play
  }
  await bindRun(base.run.id)
  await bindRun(prepared.id)
  await base.t.run((ctx) =>
    insertActiveLiveAuthority(ctx, {
      campaignId: base.campaign.id,
      epoch,
      createdAt: new Date().toISOString()
    })
  )

  // Both Runs are PREPARED and bound to the Scene: neither is being played.
  expect(await readPlay()).toEqual({ encounter: null })

  // The older Run starts; the newer PREPARED binding must not take the Scene back.
  await base.t.run((ctx) => activateFixtureRun(ctx, base.run.id))
  const actorIds = (encounterId: string) =>
    base.t.run(async (ctx) =>
      (
        await ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId))
          .collect()
      )
        .map((actor) => actor.id)
        .sort()
    )
  const activeActorIds = await actorIds(base.run.id)
  const preparedActorIds = await actorIds(prepared.id)
  expect(activeActorIds.length).toBeGreaterThan(0)
  expect(preparedActorIds.length).toBeGreaterThan(0)

  const play = await readPlay()
  expect(play.encounter?.encounterId).toBe(base.run.id)
  expect(play.encounter?.sceneId).toBe(base.sceneId)
  expect(play.encounter?.actors.map((actor) => actor.id).sort()).toEqual(activeActorIds)
  for (const id of preparedActorIds)
    expect(play.encounter?.actors.map((actor) => actor.id)).not.toContain(id)
}, 30_000)

it('plays nothing on a Scene its ACTIVE Run is not bound to', async () => {
  const base = await createEncounterSceneFixture()
  const prepared = await base.other.caller.mutation(createRun, {
    campaignId: base.campaign.id,
    blueprintId: base.blueprint.id,
    commandId: crypto.randomUUID()
  })
  await base.other.caller.run((ctx) =>
    bindPresentedScene(ctx, {
      type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
      commandId: crypto.randomUUID(),
      encounterId: prepared.id
    })
  )
  await base.t.run((ctx) => activateFixtureRun(ctx, base.run.id))
  const epoch = crypto.randomUUID()
  await base.t.run((ctx) =>
    insertActiveLiveAuthority(ctx, {
      campaignId: base.campaign.id,
      epoch,
      createdAt: new Date().toISOString()
    })
  )
  const authorization = await base.t.query(read, {
    campaignId: base.campaign.id,
    epoch,
    known: null
  })
  expect(authorization.play).toEqual({ encounter: null })
}, 30_000)
