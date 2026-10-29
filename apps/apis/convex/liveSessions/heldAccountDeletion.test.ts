import { describe, expect, it } from 'vitest'
import { deletedCampaignAuthorLabel } from '@artificer-toolkit/schema/api/campaignCommunication'
import { playerControlFixture, setActorControllers } from '../../tests/fixtures/playerControl'
import {
  checkpointLiveRoom,
  executeInRoom,
  invalidateRoomInputs,
  readRoomTimeline,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { deleteAccountCompletely } from '../../tests/fixtures/accountDeletion'
import { api } from '../_generated/api'

useLocalRoomWorker()

/**
 * Deleting the account of a player whose Character a live room holds (F12.3, F12.4, Convex half).
 * Convex writes no actors of a held Run (D74); the room removes the deleted Character's actor
 * when it reconciles departures, and the Run's retained history keeps naming the deleted account.
 */

const TABLE = 'TABLE' as const

/**
 * The room reloads after an input notice and then queues its departure reconcile behind that
 * reload, so the first checkpoint barrier may run before the reconcile and the second always follows it.
 */
async function settleReconcile(campaignId: string) {
  await checkpointLiveRoom(campaignId)
  await checkpointLiveRoom(campaignId)
}

describe('account deletion with a Character held by a live room', () => {
  it('leaves the held Run to the room, which removes the actor and keeps the history', async () => {
    const base = await playerControlFixture({ bite: 'ATTACK' })
    const { t, owner: gm, player, campaign, run } = base
    const characterId = (await base.readState()).character?.id
    if (!characterId) throw new Error('Missing held Character fixture.')

    // The player's history: a table roll and a table chat message while Convex still owns chat, then
    // a Run attack, which makes the room claim the Campaign's live authority and hold the Run.
    for (const member of [gm, player])
      await member.caller.mutation(api.campaigns.conversations.open, {
        campaignId: campaign.id,
        kind: TABLE
      })
    await player.caller.mutation(api.campaigns.rolls.execute, {
      campaignId: campaign.id,
      destination: TABLE,
      clientNonce: crypto.randomUUID(),
      roll: {
        characterId,
        expression: '1d20',
        source: { kind: 'MANUAL', label: 'Held table roll' }
      }
    })
    await player.caller.mutation(api.campaigns.chat.send, {
      campaignId: campaign.id,
      room: TABLE,
      mode: 'OOC',
      body: 'Held table chat',
      clientNonce: crypto.randomUUID()
    })
    await setActorControllers(base, base.companion.id, [player.userId])
    await executeInRoom(player.caller, {
      command: await base.bite(base.companion.id, base.enemy.id)
    })
    // The attack's roll card reaches the table chat with the room's checkpoint.
    await checkpointLiveRoom(campaign.id)
    const readChat = async () =>
      (
        await gm.caller.query(api.campaigns.chat.list, {
          campaignId: campaign.id,
          room: TABLE,
          limit: 50
        })
      ).entries.filter((entry) => entry.authorUserId === player.userId)
    const readTimeline = () => readRoomTimeline(gm.caller, campaign.id)
    const chatBefore = await readChat()
    expect(chatBefore.some((entry) => entry.roll !== null)).toBe(true)
    expect(chatBefore.some((entry) => entry.body === 'Held table chat')).toBe(true)
    expect(await readTimeline()).toContainEqual(
      expect.objectContaining({ commandType: 'RESOLVE_ACTION', actorUserId: player.userId })
    )

    const stored = () =>
      t.run(async (ctx) => ({
        run: await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', run.id))
          .unique(),
        actors: await ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id))
          .collect(),
        commands: await ctx.db
          .query('encounterRunCommands')
          .withIndex('by_encounterId', (q) => q.eq('encounterId', run.id))
          .collect(),
        holds: await ctx.db
          .query('liveCharacterHolds')
          .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
          .collect()
      }))
    const held = await stored()
    expect(held.holds).toEqual([expect.objectContaining({ characterId, encounterId: run.id })])
    const { authUserId, accessStartedAt } = await t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', player.userId))
        .unique()
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', campaign.id).eq('userId', player.userId)
        )
        .unique()
      if (!profile || !membership) throw new Error('Missing player account fixture.')
      return { authUserId: profile.authUserId, accessStartedAt: membership.accessStartedAt }
    })

    // Deleting the account makes the room evict the member, and Convex writes nothing to the Run.
    await deleteAccountCompletely(t, authUserId)
    expect(
      (await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect()))
        .filter((job) => job.name === 'liveSessions/control:evictUser')
        .map((job) => job.args)
    ).toEqual([
      [{ campaignId: campaign.id, userId: player.userId, membershipEpoch: accessStartedAt }]
    ])
    expect(await stored()).toEqual(held)

    // Until the room checkpoints, the GM's Convex reads leave out the deleted Character's actor.
    const heldActorIds = held.actors.map((actor) => actor.id)
    expect(heldActorIds).toContain(base.character.id)
    const { encounter } = await gm.caller.query(api.encounters.activeReads.active, {
      campaignId: campaign.id
    })
    expect(encounter?.actors.map((actor) => actor.id).sort()).toEqual(
      heldActorIds.filter((id) => id !== base.character.id).sort()
    )
    expect(
      (await gm.caller.query(api.encounters.projectionReads.get, { encounterId: run.id })).actors
    ).toHaveLength(heldActorIds.length - 1)

    // The room reloads its authorization, removes the deleted Character's actor and releases its hold.
    // Convex's scheduler sends the room this notice; convex-test runs none.
    await invalidateRoomInputs(campaign.id, ['CAMPAIGN'])
    await settleReconcile(campaign.id)
    const reconciled = await stored()
    expect(reconciled.actors.map((actor) => actor.id)).toEqual(
      held.actors.map((actor) => actor.id).filter((id) => id !== base.character.id)
    )
    // The room's reconcile returns nothing to a caller, so the departure list it acted on shows only as
    // the one actor it removed: exactly the deleted Character's. (The list itself is asserted in
    // `roomActorReconcile.test.ts`.)
    expect(
      held.actors
        .map((actor) => actor.id)
        .filter((id) => !reconciled.actors.some((a) => a.id === id))
    ).toEqual([base.character.id])
    expect(reconciled.holds).toEqual([])
    // History is kept in the room, which appends its own REMOVE_ACTOR command; Convex gains none.
    expect(reconciled.commands).toEqual(held.commands)
    const entries = await readTimeline()
    expect(entries).toContainEqual(
      expect.objectContaining({ commandType: 'RESOLVE_ACTION', actorUserId: player.userId })
    )
    expect(entries.filter((entry) => entry.commandType === 'REMOVE_ACTOR')).toHaveLength(1)
    const chatAfter = await readChat()
    expect(chatAfter).toHaveLength(chatBefore.length)
    for (const entry of chatAfter)
      expect(entry).toMatchObject({ authorUsername: deletedCampaignAuthorLabel })

    // A second reconcile finds nothing to do and writes nothing.
    await invalidateRoomInputs(campaign.id, ['CAMPAIGN'])
    await settleReconcile(campaign.id)
    expect(await stored()).toEqual(reconciled)
    expect(
      (await readTimeline()).filter((entry) => entry.commandType === 'REMOVE_ACTOR')
    ).toHaveLength(1)
  }, 120000)
})
