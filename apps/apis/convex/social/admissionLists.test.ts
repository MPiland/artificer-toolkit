import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type {
  CampaignInviteDto,
  CreateCampaignInviteInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  SocialApplicationDto,
  SubmitSocialApplicationInput
} from '@artificer-toolkit/schema/api/socialHub'
import type {
  SocialAdmissionListInput,
  SocialApplicationPage,
  SocialInvitationPage,
  SocialListingAdmissionListInput,
  SocialInvitationListInput,
  SocialListingInvitationListInput
} from '@artificer-toolkit/schema/api/socialAdmissionLists'
import { fixture } from '../../tests/fixtures/socialWriters'

const submit = makeFunctionReference<
  'mutation',
  SubmitSocialApplicationInput,
  SocialApplicationDto
>('social/applications:submit')
const invite = makeFunctionReference<'mutation', CreateCampaignInviteInput, CampaignInviteDto>(
  'social/invitations:create'
)
const listOwnApplications = makeFunctionReference<
  'query',
  SocialAdmissionListInput,
  SocialApplicationPage
>('social/admissionLists:listOwnApplications')
const listListingApplications = makeFunctionReference<
  'query',
  SocialListingAdmissionListInput,
  SocialApplicationPage
>('social/admissionLists:listListingApplications')
const listReceivedInvitations = makeFunctionReference<
  'query',
  SocialInvitationListInput,
  SocialInvitationPage
>('social/admissionLists:listReceivedInvitations')
const listListingInvitations = makeFunctionReference<
  'query',
  SocialListingInvitationListInput,
  SocialInvitationPage
>('social/admissionLists:listListingInvitations')

const pageInput = (
  cursor: string | null = null,
  numItems = 10,
  group: 'PENDING' | 'HISTORY' = 'PENDING'
): SocialAdmissionListInput => ({
  group,
  paginationOpts: { cursor, numItems }
})
const listingPageInput = (
  listingPublicId: string,
  cursor: string | null = null,
  numItems = 10,
  group: 'PENDING' | 'HISTORY' = 'PENDING'
): SocialListingAdmissionListInput => ({
  group,
  listingPublicId,
  paginationOpts: { cursor, numItems }
})

const invitationPageInput = (...args: Parameters<typeof pageInput>): SocialInvitationListInput => ({
  ...pageInput(...args),
  asOf: new Date().toISOString()
})
const listingInvitationPageInput = (
  ...args: Parameters<typeof listingPageInput>
): SocialListingInvitationListInput => ({
  ...listingPageInput(...args),
  asOf: new Date().toISOString()
})

async function sourceFixture() {
  const base = await fixture()
  const application = await base.other.caller.mutation(submit, {
    listingPublicId: base.listing.listingPublicId,
    expectedListingVersion: base.listing.version,
    message: 'A shitstorm message'
  })
  const invitation = await base.owner.caller.mutation(invite, {
    listingPublicId: base.listing.listingPublicId,
    expectedListingVersion: base.listing.version,
    username: 'AdmissionPlayer'
  })
  return { ...base, application, invitation }
}

describe('native Social admission inboxes', () => {
  it('keeps each inbox scoped, masks shared Standard prose, and preserves the applicant message', async () => {
    const base = await sourceFixture()
    const listingInput = listingPageInput(base.listing.listingPublicId)
    const before = await base.snapshot()

    expect((await base.other.caller.query(listOwnApplications, pageInput())).page).toEqual([
      expect.objectContaining({
        applicationPublicId: base.application.applicationPublicId,
        listingTitle: 'A ****storm campaign',
        message: 'A shitstorm message',
        expectations: expect.objectContaining({
          contentGuidance: 'A ****storm of adventure'
        })
      })
    ])
    expect((await base.owner.caller.query(listOwnApplications, pageInput())).page).toEqual([])
    await expect(base.other.caller.query(listListingApplications, listingInput)).rejects.toThrow(
      'Social listing not found'
    )
    expect((await base.owner.caller.query(listListingApplications, listingInput)).page).toEqual([
      expect.objectContaining({
        applicationPublicId: base.application.applicationPublicId,
        message: 'A ****storm message',
        listingTitle: 'A ****storm campaign'
      })
    ])
    expect(
      (await base.other.caller.query(listReceivedInvitations, invitationPageInput())).page
    ).toEqual([
      expect.objectContaining({
        invitePublicId: base.invitation.invitePublicId,
        listingTitle: 'A ****storm campaign'
      })
    ])
    expect(
      (await base.owner.caller.query(listReceivedInvitations, invitationPageInput())).page
    ).toEqual([])
    expect(
      (
        await base.owner.caller.query(listListingInvitations, {
          ...listingInput,
          asOf: new Date().toISOString()
        })
      ).page
    ).toEqual([
      expect.objectContaining({
        invitePublicId: base.invitation.invitePublicId,
        listingTitle: 'A ****storm campaign'
      })
    ])
    await expect(
      base.other.caller.query(listListingInvitations, {
        ...listingInput,
        asOf: new Date().toISOString()
      })
    ).rejects.toThrow('Social listing not found')
    await expect(base.t.query(listOwnApplications, pageInput())).rejects.toThrow('Unauthenticated')
    expect(await base.snapshot()).toEqual(before)
  })

  it('orders pending first, then one chronological terminal history and paginates beyond the read budget', async () => {
    const base = await sourceFixture()
    const extra: SocialApplicationDto[] = []
    for (let index = 0; index < 12; index++) {
      const actor = await base.addActor(`AdmissionPlayer${index}`)
      extra.push(
        await actor.caller.mutation(submit, {
          listingPublicId: base.listing.listingPublicId,
          expectedListingVersion: base.listing.version,
          message: `History ${index}`
        })
      )
    }
    const terminalStatuses = [
      'DECLINED',
      'WITHDRAWN',
      'ACCEPTED',
      'EXPIRED',
      'BLOCKED',
      'DECLINED',
      'WITHDRAWN',
      'ACCEPTED'
    ] as const
    await base.t.run(async (ctx) => {
      for (const [index, row] of extra.entries()) {
        const stored = await ctx.db
          .query('socialApplications')
          .withIndex('by_publicId', (q) => q.eq('id', row.applicationPublicId))
          .unique()
        if (!stored) throw new Error('Missing application history row.')
        const submittedAt = new Date(Date.UTC(2020, 0, Math.floor(index / 2) + 2)).toISOString()
        await ctx.db.patch(stored._id, {
          status: terminalStatuses[index % terminalStatuses.length],
          submittedAt,
          respondedAt: submittedAt,
          updatedAt: submittedAt
        })
      }
      const pending = await ctx.db
        .query('socialApplications')
        .withIndex('by_publicId', (q) => q.eq('id', base.application.applicationPublicId))
        .unique()
      if (!pending) throw new Error('Missing pending application.')
      await ctx.db.patch(pending._id, {
        submittedAt: new Date(Date.UTC(2020, 0, 1)).toISOString()
      })
    })

    const initial = await base.owner.caller.query(
      listListingApplications,
      listingPageInput(base.listing.listingPublicId, null, 1, 'PENDING')
    )
    expect(initial.page).toMatchObject([
      { applicationPublicId: base.application.applicationPublicId }
    ])

    const rows = [...initial.page]
    const historyRows: SocialApplicationDto[] = []
    let cursor: string | null = null
    let pagesRead = 0
    for (let index = 0; index < 30; index++) {
      const page: SocialApplicationPage = await base.owner.caller.query(
        listListingApplications,
        listingPageInput(base.listing.listingPublicId, cursor, 48, 'HISTORY')
      )
      pagesRead++
      historyRows.push(...page.page)
      if (page.isDone) break
      cursor = page.continueCursor
    }
    rows.push(...historyRows)
    expect(rows).toHaveLength(13)
    expect(new Set(rows.map((row) => row.applicationPublicId)).size).toBe(rows.length)
    expect(rows[0]?.status).toBe('SUBMITTED')
    expect(historyRows).toHaveLength(12)
    expect(pagesRead).toBeGreaterThan(1)
    expect(historyRows[0]?.submittedAt).toBe('2020-01-07T00:00:00.000Z')
    const expected = (await base.snapshot()).applications
      .filter((row) => row.status !== 'SUBMITTED')
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt) || b.id.localeCompare(a.id))
    expect(historyRows.map((row) => row.applicationPublicId)).toEqual(expected.map((row) => row.id))

    const first = await base.owner.caller.query(
      listListingApplications,
      listingPageInput(base.listing.listingPublicId, null, 1, 'HISTORY')
    )
    const outsider = await base.addActor('CursorOutsider')
    const replay = await outsider.caller
      .query(listOwnApplications, {
        paginationOpts: { cursor: first.continueCursor, numItems: 10 },
        group: 'HISTORY'
      })
      .catch(() => null)
    if (replay) expect(replay.page).toEqual([])
  })

  it('projects overdue invitations as EXPIRED without mutating the stored source', async () => {
    const base = await sourceFixture()
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaignInvites')
        .withIndex('by_publicId', (q) => q.eq('id', base.invitation.invitePublicId))
        .unique()
      if (!row) throw new Error('Missing invitation.')
      await ctx.db.patch(row._id, {
        expiresAt: new Date(Date.now() - 1).toISOString()
      })
    })
    const before = await base.snapshot()
    expect(
      (await base.other.caller.query(listReceivedInvitations, invitationPageInput())).page
    ).toEqual([])
    const result = await base.other.caller.query(
      listReceivedInvitations,
      invitationPageInput(null, 10, 'HISTORY')
    )
    expect(result.page).toEqual([expect.objectContaining({ status: 'EXPIRED' })])
    const stored = await base.t.run(async (ctx) =>
      ctx.db
        .query('campaignInvites')
        .withIndex('by_publicId', (q) => q.eq('id', base.invitation.invitePublicId))
        .unique()
    )
    expect(stored).toMatchObject({
      status: 'PENDING',
      version: base.invitation.version
    })
    expect(await base.snapshot()).toEqual(before)
  })

  it('paginates received and sent invitation history across statuses and tied timestamps', async () => {
    const base = await sourceFixture()
    const statuses = ['DECLINED', 'REVOKED', 'EXPIRED'] as const
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaignInvites')
        .withIndex('by_publicId', (q) => q.eq('id', base.invitation.invitePublicId))
        .unique()
      if (!row) throw new Error('Missing invitation.')
      const { _id, _creationTime, ...stored } = row
      await ctx.db.patch(_id, { createdAt: '2020-01-01T00:00:00.000Z' })
      for (let index = 0; index < 12; index++) {
        const status = statuses[index % statuses.length]!
        const createdAt = new Date(Date.UTC(2020, 0, Math.floor(index / 2) + 2)).toISOString()
        await ctx.db.insert('campaignInvites', {
          ...stored,
          id: crypto.randomUUID(),
          status,
          createdAt,
          updatedAt: createdAt,
          expiresAt: createdAt,
          respondedAt: status === 'DECLINED' ? createdAt : null,
          revokedAt: status === 'REVOKED' ? createdAt : null,
          expiredAt: status === 'EXPIRED' ? createdAt : null,
          version: 1
        })
      }
    })
    const before = await base.snapshot()
    const asOf = new Date().toISOString()
    const expected = before.invitations
      .filter((row) => row.status !== 'PENDING')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    for (const read of [
      (cursor: string | null) =>
        base.other.caller.query(listReceivedInvitations, {
          ...invitationPageInput(cursor, 48, 'HISTORY'),
          asOf
        }),
      (cursor: string | null) =>
        base.owner.caller.query(listListingInvitations, {
          ...listingInvitationPageInput(base.listing.listingPublicId, cursor, 48, 'HISTORY'),
          asOf
        })
    ]) {
      const rows: CampaignInviteDto[] = []
      let cursor: string | null = null
      let pagesRead = 0
      for (let index = 0; index < 20; index++) {
        const result = await read(cursor)
        pagesRead++
        rows.push(...result.page)
        if (result.isDone) break
        cursor = result.continueCursor
      }
      expect(pagesRead).toBeGreaterThan(1)
      expect(rows.map((row) => row.invitePublicId)).toEqual(expected.map((row) => row.id))
    }
    expect(
      (await base.other.caller.query(listReceivedInvitations, invitationPageInput())).page
    ).toMatchObject([{ invitePublicId: base.invitation.invitePublicId, status: 'PENDING' }])
    expect(await base.snapshot()).toEqual(before)
  })

  it('keeps invitation expiry fixed across page requests until both groups receive a new horizon', async () => {
    const base = await sourceFixture()
    const now = Date.now()
    const asOf = new Date(now).toISOString()
    const expiresAt = new Date(now + 1000).toISOString()
    const historyIds = [crypto.randomUUID(), crypto.randomUUID()]
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaignInvites')
        .withIndex('by_publicId', (q) => q.eq('id', base.invitation.invitePublicId))
        .unique()
      if (!row) throw new Error('Missing invitation.')
      const { _id, _creationTime, ...stored } = row
      await ctx.db.patch(_id, { expiresAt })
      for (const [index, id] of historyIds.entries()) {
        const createdAt = new Date(now - (index + 1) * 1000).toISOString()
        await ctx.db.insert('campaignInvites', {
          ...stored,
          id,
          status: 'DECLINED',
          createdAt,
          respondedAt: createdAt
        })
      }
    })
    const before = await base.snapshot()
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      for (const read of [
        (input: SocialInvitationListInput) =>
          base.other.caller.query(listReceivedInvitations, input),
        (input: SocialInvitationListInput) =>
          base.owner.caller.query(listListingInvitations, {
            ...input,
            listingPublicId: base.listing.listingPublicId
          })
      ]) {
        vi.setSystemTime(now)
        const first = await read({ ...pageInput(null, 1, 'HISTORY'), asOf })
        expect(first.page.map((row) => row.invitePublicId)).toEqual([historyIds[0]])
        expect(first.isDone).toBe(false)
        vi.setSystemTime(now + 1000)
        const next = await read({ ...pageInput(first.continueCursor, 10, 'HISTORY'), asOf })
        expect(next.page.map((row) => row.invitePublicId)).toEqual([historyIds[1]])
        expect(next.isDone).toBe(true)
        expect((await read({ ...pageInput(), asOf })).page).toMatchObject([
          { invitePublicId: base.invitation.invitePublicId, status: 'PENDING' }
        ])
        expect((await read({ ...pageInput(), asOf: expiresAt })).page).toEqual([])
        const refreshed = await read({ ...pageInput(null, 10, 'HISTORY'), asOf: expiresAt })
        expect(refreshed.page.map((row) => row.invitePublicId)).toEqual([
          base.invitation.invitePublicId,
          ...historyIds
        ])
        expect(refreshed.page[0]).toMatchObject({
          status: 'EXPIRED',
          version: base.invitation.version
        })
      }
      expect(await base.snapshot()).toEqual(before)
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps explicit application page ranges stable when new history arrives', async () => {
    const base = await sourceFixture()
    const ids = await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('socialApplications')
        .withIndex('by_publicId', (q) => q.eq('id', base.application.applicationPublicId))
        .unique()
      if (!row) throw new Error('Missing application.')
      const { _id, _creationTime, ...stored } = row
      const ids = [crypto.randomUUID(), crypto.randomUUID()]
      for (const [index, id] of ids.entries()) {
        const submittedAt = new Date(Date.UTC(2020, 0, index + 1)).toISOString()
        await ctx.db.insert('socialApplications', {
          ...stored,
          id,
          status: 'DECLINED',
          submittedAt,
          respondedAt: submittedAt,
          updatedAt: submittedAt,
          version: 1
        })
      }
      return ids
    })
    const input = pageInput(null, 1, 'HISTORY')
    const first = await base.other.caller.query(listOwnApplications, input)
    expect(first.page.map((row) => row.applicationPublicId)).toEqual([ids[1]])
    const added = await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('socialApplications')
        .withIndex('by_publicId', (q) => q.eq('id', ids[0]!))
        .unique()
      if (!row) throw new Error('Missing application.')
      const { _id, _creationTime, ...stored } = row
      const id = crypto.randomUUID()
      const submittedAt = '2020-01-03T00:00:00.000Z'
      await ctx.db.insert('socialApplications', {
        ...stored,
        id,
        submittedAt,
        respondedAt: submittedAt,
        updatedAt: submittedAt
      })
      return id
    })
    const range = await base.other.caller.query(listOwnApplications, {
      ...input,
      paginationOpts: { ...input.paginationOpts, endCursor: first.continueCursor }
    })
    expect(range.page.map((row) => row.applicationPublicId)).toEqual([added, ids[1]])
    const next = await base.other.caller.query(
      listOwnApplications,
      pageInput(first.continueCursor, 48, 'HISTORY')
    )
    expect(next.page.map((row) => row.applicationPublicId)).toEqual([ids[0]])
  })

  it('requires attested Mature preference for participant prose while preserving owner and private-message access', async () => {
    const base = await sourceFixture()
    await base.t.run(async (ctx) => {
      const campaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
        .unique()
      if (!campaign) throw new Error('Missing Campaign.')
      await ctx.db.patch(campaign._id, { contentMaturity: 'MATURE' })
    })
    const own = await base.other.caller.query(listOwnApplications, pageInput())
    expect(own.page[0]).toMatchObject({
      listingTitle: 'A ****storm campaign',
      message: 'A shitstorm message'
    })
    expect(
      (await base.other.caller.query(listReceivedInvitations, invitationPageInput())).page[0]
        ?.listingTitle
    ).toBe('A ****storm campaign')
    expect(
      (
        await base.owner.caller.query(
          listListingApplications,
          listingPageInput(base.listing.listingPublicId)
        )
      ).page[0]
    ).toMatchObject({ listingTitle: 'A shitstorm campaign', message: 'A shitstorm message' })
    expect(
      (
        await base.owner.caller.query(
          listListingInvitations,
          listingInvitationPageInput(base.listing.listingPublicId)
        )
      ).page[0]?.listingTitle
    ).toBe('A shitstorm campaign')
    const profileId = await base.t.run(async (ctx) => {
      const profile = await ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
        .unique()
      if (!profile) throw new Error('Missing profile.')
      await ctx.db.patch(profile._id, {
        contentPreference: 'MATURE',
        adultAttestedAt: new Date().toISOString()
      })
      return profile._id
    })
    expect(
      (await base.other.caller.query(listOwnApplications, pageInput())).page[0]?.listingTitle
    ).toBe('A shitstorm campaign')
    expect(
      (await base.other.caller.query(listReceivedInvitations, invitationPageInput())).page[0]
        ?.listingTitle
    ).toBe('A shitstorm campaign')
    await base.t.run((ctx) => ctx.db.patch(profileId, { adultAttestedAt: null }))
    await expect(base.other.caller.query(listOwnApplications, pageInput())).rejects.toThrow()
    await expect(
      base.other.caller.query(listReceivedInvitations, invitationPageInput())
    ).rejects.toThrow()
  })

  it('retains participant history after listing or Campaign closure, while active blocks and profiles filter all inboxes', async () => {
    const base = await sourceFixture()
    await base.t.run(async (ctx) => {
      const listing = await ctx.db
        .query('socialListings')
        .withIndex('by_publicId', (q) => q.eq('id', base.listing.listingPublicId))
        .unique()
      const campaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
        .unique()
      if (!listing || !campaign) throw new Error('Missing listing or Campaign.')
      await ctx.db.patch(listing._id, {
        status: 'CLOSED',
        moderationStatus: 'HIDDEN',
        audience: 'PRIVATE'
      })
      await ctx.db.patch(campaign._id, { status: 'ARCHIVED' })
    })
    expect((await base.other.caller.query(listOwnApplications, pageInput())).page).toHaveLength(1)
    expect(
      (await base.other.caller.query(listReceivedInvitations, invitationPageInput())).page
    ).toHaveLength(1)
    expect(
      (
        await base.owner.caller.query(
          listListingApplications,
          listingPageInput(base.listing.listingPublicId)
        )
      ).page
    ).toHaveLength(1)
    expect(
      (
        await base.owner.caller.query(
          listListingInvitations,
          listingInvitationPageInput(base.listing.listingPublicId)
        )
      ).page
    ).toHaveLength(1)

    for (const reverse of [false, true]) {
      const blockId = await base.t.run(async (ctx) => {
        const host = await ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
          .unique()
        const player = await ctx.db
          .query('socialProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
          .unique()
        if (!host || !player) throw new Error('Missing profiles.')
        return ctx.db.insert('socialBlocks', {
          blockerProfileId: reverse ? player.id : host.id,
          blockedProfileId: reverse ? host.id : player.id,
          createdAt: new Date().toISOString()
        })
      })
      expect((await base.other.caller.query(listOwnApplications, pageInput())).page).toEqual([])
      expect(
        (await base.other.caller.query(listReceivedInvitations, invitationPageInput())).page
      ).toEqual([])
      expect(
        (
          await base.owner.caller.query(
            listListingApplications,
            listingPageInput(base.listing.listingPublicId)
          )
        ).page
      ).toEqual([])
      expect(
        (
          await base.owner.caller.query(
            listListingInvitations,
            listingInvitationPageInput(base.listing.listingPublicId)
          )
        ).page
      ).toEqual([])
      await base.t.run((ctx) => ctx.db.delete(blockId))
    }

    await base.t.run(async (ctx) => {
      const profile = await ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
        .unique()
      if (!profile) throw new Error('Missing player profile.')
      await ctx.db.patch(profile._id, { status: 'SUSPENDED' })
    })
    await expect(base.other.caller.query(listOwnApplications, pageInput())).rejects.toThrow(
      'active Social profile'
    )
    await expect(
      base.other.caller.query(listReceivedInvitations, invitationPageInput())
    ).rejects.toThrow('active Social profile')
    expect(
      (
        await base.owner.caller.query(
          listListingApplications,
          listingPageInput(base.listing.listingPublicId)
        )
      ).page
    ).toEqual([])
    expect(
      (
        await base.owner.caller.query(
          listListingInvitations,
          listingInvitationPageInput(base.listing.listingPublicId)
        )
      ).page
    ).toEqual([])
  })

  it('requires an active Social actor and current listing owner for every direction', async () => {
    const base = await sourceFixture()
    const outsider = await base.addActor('AdmissionOutsider')
    const input = listingPageInput(base.listing.listingPublicId)
    await expect(outsider.caller.query(listListingApplications, input)).rejects.toThrow(
      'Social listing not found'
    )
    await expect(
      outsider.caller.query(listListingInvitations, { ...input, asOf: new Date().toISOString() })
    ).rejects.toThrow('Social listing not found')
    await base.t.run(async (ctx) => {
      const listing = await ctx.db
        .query('socialListings')
        .withIndex('by_publicId', (q) => q.eq('id', base.listing.listingPublicId))
        .unique()
      if (!listing) throw new Error('Missing listing.')
      await ctx.db.patch(listing._id, { ownerUserId: outsider.userId })
    })
    await expect(base.owner.caller.query(listListingApplications, input)).rejects.toThrow(
      'Social listing not found'
    )
    await expect(
      base.owner.caller.query(listListingInvitations, { ...input, asOf: new Date().toISOString() })
    ).rejects.toThrow('Social listing not found')
    await expect(base.t.query(listReceivedInvitations, invitationPageInput())).rejects.toThrow(
      'Unauthenticated'
    )
  })

  it('omits deleted counterpart profiles from the owner inboxes', async () => {
    const base = await sourceFixture()
    await base.t.run(async (ctx) => {
      const profile = await ctx.db
        .query('socialProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
        .unique()
      if (!profile) throw new Error('Missing profile.')
      await ctx.db.delete(profile._id)
    })
    const input = listingPageInput(base.listing.listingPublicId)
    expect((await base.owner.caller.query(listListingApplications, input)).page).toEqual([])
    expect(
      (
        await base.owner.caller.query(listListingInvitations, {
          ...input,
          asOf: new Date().toISOString()
        })
      ).page
    ).toEqual([])
  })
})
