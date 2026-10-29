import { createConvexEncounterStoreReader } from '../lib/convexEncounterStore'
import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignAssignmentResult,
  setCampaignCharacterControllersInputSchema
} from '@artificer-toolkit/schema/api/campaignCore'
import { readEncounterActorControl } from '@artificer-toolkit/encounter-persistence/actorController'
import { readRunActor, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { readEncounterPlayerViewer } from '@artificer-toolkit/encounter-persistence/playerViewer'
import { playerControlsActor } from '@artificer-toolkit/rules-runtime/encounterPlayerProjection'
import {
  domainRejection,
  playerControlFixture,
  type PlayerControlFixture
} from '../../tests/fixtures/playerControl'
import {
  checkpointLiveRoom,
  executeInRoom,
  invalidateRoomInputs,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { encounterReadTransaction } from '../encounters/encounterReadPorts'
import { readRoomAuthorization } from '../liveSessions/roomAuthorization'

const setControllers = makeFunctionReference<
  'mutation',
  z.input<typeof setCampaignCharacterControllersInputSchema>,
  CampaignAssignmentResult
>('campaigns/characterControllers:setControllers')

const grant = (
  base: PlayerControlFixture,
  caller: PlayerControlFixture['owner']['caller'],
  controllerUserIds: string[]
) =>
  caller.mutation(setControllers, {
    campaignId: base.campaign.id,
    characterId: base.character.sourceId!,
    controllerUserIds
  })

/** Whether `userId` controls the Character actor, by the Convex predicate and the player projection. */
async function controlsCharacterActor(base: PlayerControlFixture, userId: string) {
  await checkpointLiveRoom(base.campaign.id)
  return base.t.run(async (ctx) => {
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
      .unique()
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    const membership = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', userId)
      )
      .unique()
    if (!campaign || !row || !membership) throw new Error('Missing Character control setup.')
    const state = readRunState(row)
    const actor = await readRunActor(
      { db: createConvexEncounterStoreReader(ctx) },
      state,
      base.character.id
    )
    const control = await readEncounterActorControl(encounterReadTransaction(ctx), {
      campaign,
      membership,
      actor
    })
    const viewer = await readEncounterPlayerViewer(
      encounterReadTransaction(ctx),
      { id: base.run.id, actors: [actor] },
      { userId, role: 'PLAYER' }
    )
    // The two derivations of control must agree.
    expect(playerControlsActor(actor, { ...viewer, userId }, [actor])).toBe(control !== null)
    return control
  })
}

async function storedGrants(base: PlayerControlFixture) {
  return base.t.run(async (ctx) =>
    (
      await ctx.db
        .query('campaignCharacterAssignments')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
        .collect()
    ).map(({ characterId, controllerUserIds }) => ({ characterId, controllerUserIds }))
  )
}

describe('Campaign Character control grants (SCENE-5.1)', () => {
  useLocalRoomWorker()

  it('lets the GM grant and revoke, and refuses anyone else or any other target', async () => {
    const base = await playerControlFixture()
    const characterId = base.character.sourceId!

    await expect(grant(base, base.player.caller, [base.other.userId])).rejects.toThrow(
      'Only the Campaign GM can grant control.'
    )
    await expect(grant(base, base.other.caller, [base.other.userId])).rejects.toThrow(
      'Only the Campaign GM can grant control.'
    )
    await expect(grant(base, base.owner.caller, [base.owner.userId])).rejects.toThrow(
      'Character controllers must be current Campaign players.'
    )
    await expect(grant(base, base.owner.caller, [base.player.userId])).rejects.toThrow(
      'The assigned player always controls their Character.'
    )
    await expect(grant(base, base.owner.caller, [crypto.randomUUID()])).rejects.toThrow(
      'Character controllers must be current Campaign players.'
    )
    await expect(
      base.owner.caller.mutation(setControllers, {
        campaignId: base.campaign.id,
        characterId: crypto.randomUUID(),
        controllerUserIds: []
      })
    ).rejects.toThrow('Assigned Character not found.')
    expect(await storedGrants(base)).toEqual([{ characterId, controllerUserIds: undefined }])

    await expect(grant(base, base.owner.caller, [base.other.userId])).resolves.toEqual({
      ok: true
    })
    expect(await storedGrants(base)).toEqual([
      { characterId, controllerUserIds: [base.other.userId] }
    ])
    await expect(grant(base, base.owner.caller, [])).resolves.toEqual({ ok: true })
    expect(await storedGrants(base)).toEqual([{ characterId, controllerUserIds: [] }])
  })

  it('makes a grantee a controller of the Character actor in the Run, and revoke takes it back', async () => {
    const base = await playerControlFixture()
    expect(await controlsCharacterActor(base, base.other.userId)).toBeNull()

    await grant(base, base.owner.caller, [base.other.userId])
    expect(await controlsCharacterActor(base, base.other.userId)).toBe('CONTROLLER')
    // The owner keeps control, and the Run's own per-Run list is untouched.
    expect(await controlsCharacterActor(base, base.player.userId)).toBe('CONTROLLER')

    await grant(base, base.owner.caller, [])
    expect(await controlsCharacterActor(base, base.other.userId)).toBeNull()
    expect(await controlsCharacterActor(base, base.player.userId)).toBe('CONTROLLER')
  })

  it('grants room admission to act for the Character and revokes it with the next authorization read', async () => {
    const base = await playerControlFixture()
    const actAsCharacter = async () =>
      domainRejection(
        executeInRoom(base.other.caller, {
          command: await base.bite(base.character.id, base.enemy.id)
        })
      )
    await expect(actAsCharacter()).resolves.toMatchObject({ reason: 'NOT_ACTOR_CONTROLLER' })

    await grant(base, base.owner.caller, [base.other.userId])
    await invalidateRoomInputs(base.campaign.id, ['CAMPAIGN'])
    // A grantee passes the control check; the Character simply is not on turn.
    expect((await actAsCharacter()).reason).not.toBe('NOT_ACTOR_CONTROLLER')

    await grant(base, base.owner.caller, [])
    await invalidateRoomInputs(base.campaign.id, ['CAMPAIGN'])
    await expect(actAsCharacter()).resolves.toMatchObject({ reason: 'NOT_ACTOR_CONTROLLER' })
  })

  it('publishes grants to the room authorization cache and bumps the Campaign revision', async () => {
    const base = await playerControlFixture()
    const read = () =>
      base.t.run((ctx) =>
        readRoomAuthorization(ctx, {
          campaignId: base.campaign.id,
          epoch: crypto.randomUUID(),
          known: null
        })
      )
    const before = await read()
    await grant(base, base.owner.caller, [base.other.userId])
    const granted = await read()
    expect(granted.campaign?.assignments).toEqual([
      expect.objectContaining({ controllerUserIds: [base.other.userId] })
    ])
    expect(granted.revisions.campaign).not.toBe(before.revisions.campaign)
    expect(granted.revisions.play).not.toBe(before.revisions.play)
    await grant(base, base.owner.caller, [])
    const revoked = await read()
    expect(revoked.campaign?.assignments[0]).not.toHaveProperty('controllerUserIds')
    expect(revoked.revisions.campaign).not.toBe(granted.revisions.campaign)
    expect(revoked.revisions.play).not.toBe(granted.revisions.play)
  })

  it('strips a departed member from every grant so rejoining restores nothing', async () => {
    const base = await playerControlFixture()
    await grant(base, base.owner.caller, [base.other.userId])
    const campaign = await base.t.run((ctx) =>
      ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
        .unique()
    )
    if (!campaign) throw new Error('Missing Campaign.')
    await base.other.caller.mutation(
      makeFunctionReference<'mutation', Record<string, unknown>, { ok: true }>(
        'campaigns/membershipDeparture:leave'
      ),
      {
        campaignId: base.campaign.id,
        expectedCampaignVersion: campaign.version,
        expectedMembershipAccessStartedAt: base.campaign.createdAt,
        commandId: crypto.randomUUID()
      }
    )
    expect(await storedGrants(base)).toEqual([
      { characterId: base.character.sourceId!, controllerUserIds: [] }
    ])
  })
})
