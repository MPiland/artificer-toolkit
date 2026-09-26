import { describe, expect, it } from 'vitest'
import { deletedCampaignAuthorLabel } from '@artificer-toolkit/schema/api/campaignCommunication'
import { api, internal } from '../_generated/api'
import { readyCampaignFile } from '../../tests/fixtures/campaignFile'
import {
  executeEncounterCommand,
  playerControlFixture,
  setActorControllers
} from '../../tests/fixtures/playerControl'

const page = { cursor: null, numItems: 16 }

describe('deleted member Campaign history', () => {
  it('keeps the Session log, Encounter Run history and handout delivery attributed to the deleted account id', async () => {
    const base = await playerControlFixture()
    const { t, owner: gm, other: departing, campaign, run } = base
    await departing.caller.mutation(api.account.updateProfile, { username: 'Mira', bio: null })
    await setActorControllers(base, base.companion.id, [departing.userId])
    await departing.caller.mutation(executeEncounterCommand, {
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
      kind: 'SHARED_NOTE'
    })
    const gmNote = await gm.caller.mutation(api.campaigns.sessionNotes.create, {
      campaignId: campaign.id,
      sessionId: session.id,
      title: 'GM recap',
      content: '<p>GM recap</p>',
      visibility: 'SHARED',
      kind: 'SHARED_NOTE'
    })
    expect(note).toMatchObject({ authorLabel: 'Mira' })
    const file = await readyCampaignFile(t, departing.userId, campaign.id, 'CAMPAIGN_HANDOUT_MAP')
    const handout = await departing.caller.mutation(api.campaigns.attachments.create, {
      campaignId: campaign.id,
      assetId: file.id,
      displayName: 'Player handout'
    })
    const readHistory = async () => ({
      timeline: await gm.caller.query(api.encounters.timelineReads.timeline, {
        encounterId: run.id,
        limit: 100
      }),
      notes: await gm.caller.query(api.campaigns.sessionNotes.list, {
        campaignId: campaign.id,
        sessionId: session.id,
        paginationOpts: page
      }),
      rsvps: await gm.caller.query(api.campaigns.sessionRsvps.list, {
        campaignId: campaign.id,
        sessionId: session.id,
        paginationOpts: page
      }),
      handouts: await gm.caller.query(api.campaigns.attachments.list, {
        campaignId: campaign.id,
        paginationOpts: page
      }),
      delivery: await gm.caller.query(internal.campaigns.attachments.readDelivery, {
        campaignId: campaign.id,
        attachmentId: handout.id
      })
    })
    const before = await readHistory()
    expect(before.timeline.entries).toContainEqual(
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
    expect(handout).toMatchObject({ uploaderLabel: 'Mira' })
    expect(before.handouts.page).toEqual([
      expect.objectContaining({
        id: handout.id,
        uploaderUserId: departing.userId,
        uploaderLabel: 'Mira'
      })
    ])
    expect(before.delivery).toMatchObject({ assetId: file.id })

    const authUserId = await t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', departing.userId))
        .unique()
      if (!profile) throw new Error('Missing departing profile.')
      return profile.authUserId
    })
    await t.mutation(internal.auth.onDelete, { model: 'user', doc: { _id: authUserId } })
    // The deferred media cleanup must not take a handout the Campaign retained.
    await t.mutation(internal.media.assets.purgeAccount, { userId: departing.userId })

    // Every retained record keeps the opaque account id; no current member or profile resolves it,
    // so the deleted author's username is replaced while current members stay named.
    expect(await readHistory()).toEqual({
      ...before,
      notes: {
        ...before.notes,
        page: before.notes.page.map((row) =>
          row.id === note.id ? { ...row, authorLabel: deletedCampaignAuthorLabel } : row
        )
      },
      handouts: {
        ...before.handouts,
        page: before.handouts.page.map((row) => ({
          ...row,
          uploaderLabel: deletedCampaignAuthorLabel
        }))
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
