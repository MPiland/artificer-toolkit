import { describe, expect, it } from 'vitest'
import { deletedCampaignAuthorLabel } from '@artificer-toolkit/schema/api/campaignCommunication'
import { api } from '../_generated/api'
import { deleteAccountCompletely } from '../../tests/fixtures/accountDeletion'
import { playerControlFixture, setActorControllers } from '../../tests/fixtures/playerControl'
import {
  executeInRoom,
  readRoomTimeline,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()

const page = { cursor: null, numItems: 16 }

describe('deleted member Campaign history', () => {
  it('keeps the Session log and Encounter Run history attributed to the deleted account id', async () => {
    const base = await playerControlFixture()
    const { t, owner: gm, other: departing, campaign } = base
    await departing.caller.mutation(api.account.updateProfile, { username: 'Mira', bio: null })
    await setActorControllers(base, base.companion.id, [departing.userId])
    await executeInRoom(departing.caller, {
      command: await base.bite(base.companion.id, base.enemy.id)
    })
    const session = await gm.caller.mutation(api.campaigns.sessions.create, {
      campaignId: campaign.id,
      title: 'Deleted member history'
    })
    await departing.caller.mutation(api.campaigns.sessionRsvps.set, {
      campaignId: campaign.id,
      sessionId: session.id,
      response: 'YES'
    })
    const note = await departing.caller.mutation(api.campaigns.sessionNotes.create, {
      campaignId: campaign.id,
      sessionId: session.id,
      title: 'Player recap',
      content: '<p>Player recap</p>',
      visibility: 'SHARED',
      kind: 'NOTE'
    })
    const gmNote = await gm.caller.mutation(api.campaigns.sessionNotes.create, {
      campaignId: campaign.id,
      sessionId: session.id,
      title: 'GM recap',
      content: '<p>GM recap</p>',
      visibility: 'SHARED',
      kind: 'NOTE'
    })
    expect(note).toMatchObject({ authorLabel: 'Mira' })
    const readHistory = async () => ({
      timeline: await readRoomTimeline(gm.caller, campaign.id),
      notes: await gm.caller.query(api.campaigns.sessionNotes.list, {
        campaignId: campaign.id,
        sessionId: session.id,
        paginationOpts: page
      }),
      rsvps: await gm.caller.query(api.campaigns.sessionRsvps.list, {
        campaignId: campaign.id,
        sessionId: session.id,
        paginationOpts: page
      })
    })
    const before = await readHistory()
    expect(before.timeline).toContainEqual(
      expect.objectContaining({ commandType: 'RESOLVE_ACTION', actorUserId: departing.userId })
    )
    expect(before.notes.page).toContainEqual(
      expect.objectContaining({ id: note.id, authorUserId: departing.userId, authorLabel: 'Mira' })
    )
    expect(before.notes.page).toContainEqual(
      expect.objectContaining({ id: gmNote.id, authorLabel: 'GameMaster' })
    )
    expect(before.rsvps.page).toEqual([
      expect.objectContaining({ userId: departing.userId, response: 'YES' })
    ])

    const authUserId = await t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', departing.userId))
        .unique()
      if (!profile) throw new Error('Missing departing profile.')
      return profile.authUserId
    })
    await deleteAccountCompletely(t, authUserId)

    // Every retained record keeps the opaque account id; no current member or profile resolves it,
    // so the deleted author's username is replaced while current members stay named.
    const after = await readHistory()
    expect(after).toEqual({
      ...before,
      notes: {
        ...before.notes,
        page: before.notes.page.map((row) =>
          row.id === note.id ? { ...row, authorLabel: deletedCampaignAuthorLabel } : row
        )
      }
    })
    const detail = await gm.caller.query(api.campaigns.queries.get, { id: campaign.id })
    expect(detail.memberships.map((member) => member.userId)).not.toContain(departing.userId)
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('userProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', departing.userId))
          .unique()
      )
    ).toBeNull()
    await expect(
      departing.caller.query(api.campaigns.sessionNotes.list, {
        campaignId: campaign.id,
        sessionId: session.id,
        paginationOpts: page
      })
    ).rejects.toThrow()
  }, 30_000)
})
