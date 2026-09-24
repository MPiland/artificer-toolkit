import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignDetailDto,
  CreateCampaignInput,
  archiveCampaignInputSchema
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignSessionDto,
  FinishCampaignSessionInput,
  CampaignSessionAttendanceDto,
  CampaignSessionRsvpDto,
  GetCampaignSessionInput,
  createCampaignSessionInputSchema,
  updateCampaignSessionInputSchema,
  setCampaignSessionAttendanceInputSchema,
  setCampaignSessionRsvpInputSchema
} from '@artificer-toolkit/schema/api/campaignSessions'
import type {
  CampaignSessionListInput,
  CampaignSessionListPage,
  CampaignSessionAttendanceListInput,
  CampaignSessionAttendanceListPage,
  CampaignSessionRsvpListInput,
  CampaignSessionRsvpListPage
} from '@artificer-toolkit/schema/api/campaignSessionLists'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api } from '../_generated/api'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const list = makeFunctionReference<'query', CampaignSessionListInput, CampaignSessionListPage>(
  'campaigns/sessions:list'
)
const get = makeFunctionReference<'query', GetCampaignSessionInput, CampaignSessionDto>(
  'campaigns/sessions:get'
)
const latestOpen = makeFunctionReference<
  'query',
  { campaignId: string },
  CampaignSessionDto | null
>('campaigns/sessions:latestOpen')
const create = makeFunctionReference<
  'mutation',
  z.input<typeof createCampaignSessionInputSchema>,
  CampaignSessionDto
>('campaigns/sessions:create')
const update = makeFunctionReference<
  'mutation',
  z.input<typeof updateCampaignSessionInputSchema>,
  CampaignSessionDto
>('campaigns/sessions:update')
const finish = makeFunctionReference<'mutation', FinishCampaignSessionInput, CampaignSessionDto>(
  'campaigns/sessionFinish:finish'
)
const attendanceList = makeFunctionReference<
  'query',
  CampaignSessionAttendanceListInput,
  CampaignSessionAttendanceListPage
>('campaigns/sessionAttendance:list')
const attendanceSet = makeFunctionReference<
  'mutation',
  z.input<typeof setCampaignSessionAttendanceInputSchema>,
  CampaignSessionAttendanceDto
>('campaigns/sessionAttendance:set')
const rsvpList = makeFunctionReference<
  'query',
  CampaignSessionRsvpListInput,
  CampaignSessionRsvpListPage
>('campaigns/sessionRsvps:list')
const rsvpSet = makeFunctionReference<
  'mutation',
  z.input<typeof setCampaignSessionRsvpInputSchema>,
  CampaignSessionRsvpDto
>('campaigns/sessionRsvps:set')
const archive = makeFunctionReference<
  'mutation',
  z.input<typeof archiveCampaignInputSchema>,
  CampaignDetailDto
>('campaigns/archive:archive')

const campaignInput: CreateCampaignInput = {
  name: 'Session tests',
  format: 'ONGOING',
  toneTags: ['HEROIC'],
  contentMaturity: 'STANDARD',
  gameSystemId: srdSystemRecord.id,
  primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
}

async function setup() {
  const base = await readyCharacterFixture()
  const campaign = await base.other.caller.mutation(createCampaign, campaignInput)
  const { draft, character } = await base.createCharacter()
  await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  await base.t.run(async (ctx) => {
    await ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.owner.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
    await ctx.db.insert('campaignCharacterAssignments', {
      campaignId: campaign.id,
      userId: base.owner.userId,
      characterId: character.id,
      assignedAt: campaign.createdAt
    })
  })
  return { ...base, campaign, character }
}

function pageInput(campaignId: string, cursor: string | null = null): CampaignSessionListInput {
  return { campaignId, paginationOpts: { cursor, numItems: 1 } }
}

function attendanceInput(
  campaignId: string,
  sessionId: string,
  cursor: string | null = null
): CampaignSessionAttendanceListInput {
  return { campaignId, sessionId, paginationOpts: { cursor, numItems: 1 } }
}

function rsvpInput(
  campaignId: string,
  sessionId: string,
  cursor: string | null = null
): CampaignSessionRsvpListInput {
  return { campaignId, sessionId, paginationOpts: { cursor, numItems: 1 } }
}

describe('native Campaign sessions', () => {
  it('returns the newest open Session after a newer Session finishes', async () => {
    const { t, owner, other, campaign } = await setup()
    expect(await other.caller.query(latestOpen, { campaignId: campaign.id })).toBeNull()
    const older = await other.caller.mutation(create, { campaignId: campaign.id, title: 'Older' })
    const newer = await other.caller.mutation(create, { campaignId: campaign.id, title: 'Newer' })
    expect(await owner.caller.query(latestOpen, { campaignId: campaign.id })).toMatchObject({
      id: newer.id,
      sessionNumber: newer.sessionNumber
    })
    await other.caller.mutation(finish, {
      campaignId: campaign.id,
      sessionId: newer.id,
      expectedVersion: newer.version,
      commandId: crypto.randomUUID()
    })
    expect(await owner.caller.query(latestOpen, { campaignId: campaign.id })).toMatchObject({
      id: older.id,
      sessionNumber: older.sessionNumber
    })
    await other.caller.mutation(finish, {
      campaignId: campaign.id,
      sessionId: older.id,
      expectedVersion: older.version,
      commandId: crypto.randomUUID()
    })
    expect(await owner.caller.query(latestOpen, { campaignId: campaign.id })).toBeNull()
    const closures = await t.run((ctx) =>
      ctx.db.system
        .query('_scheduled_functions')
        .collect()
        .then((jobs) => jobs.filter((job) => job.name === 'liveSessions/control:send'))
    )
    expect(closures.map((job) => job.args)).toEqual(
      [newer, older].map((session) => [
        {
          campaignId: campaign.id,
          sessionId: session.id,
          operation: { type: 'CLOSE_ROOM' }
        }
      ])
    )
    await expect(t.query(latestOpen, { campaignId: campaign.id })).rejects.toThrow()
  })

  it('creates sequential sessions, seeds assigned attendance, masks Standard titles, and paginates', async () => {
    const { t, owner, other, campaign, character } = await setup()
    const first = await other.caller.mutation(create, {
      campaignId: campaign.id,
      title: 'A shitstorm begins',
      scheduledStartAt: '2030-01-01T10:00:00.000Z',
      scheduledEndAt: '2030-01-01T11:00:00.000Z',
      timeZone: 'America/Chicago'
    })
    const second = await other.caller.mutation(create, { campaignId: campaign.id, title: 'Second' })
    expect(first).toMatchObject({ sessionNumber: 1, version: 0 })
    expect(second).toMatchObject({ sessionNumber: 2, version: 0 })
    expect(first.title).not.toContain('shitstorm')
    expect(
      await t.run(
        async (ctx) =>
          (
            await ctx.db
              .query('campaignSessions')
              .withIndex('by_campaignId_id', (q) =>
                q.eq('campaignId', campaign.id).eq('id', first.id)
              )
              .unique()
          )?.title
      )
    ).toBe('A shitstorm begins')
    expect(await owner.caller.query(get, { campaignId: campaign.id, sessionNumber: 1 })).toEqual(
      first
    )
    expect(
      (await owner.caller.query(attendanceList, attendanceInput(campaign.id, first.id))).page
    ).toEqual([
      { campaignId: campaign.id, sessionId: first.id, characterId: character.id, present: true }
    ])

    const rows: CampaignSessionDto[] = []
    let cursor: string | null = null
    for (;;) {
      const page: CampaignSessionListPage = await owner.caller.query(
        list,
        pageInput(campaign.id, cursor)
      )
      rows.push(...page.page)
      if (page.isDone) break
      cursor = page.continueCursor
    }
    expect(rows.map(({ sessionNumber }) => sessionNumber)).toEqual([2, 1])
    await expect(
      owner.caller.query(list, {
        campaignId: campaign.id,
        paginationOpts: { cursor: null, numItems: 0 }
      })
    ).rejects.toThrow()
  })

  it('merges schedule updates, clears nullable metadata together, and rejects stale or malformed writes', async () => {
    const { other, campaign } = await setup()
    const session = await other.caller.mutation(create, {
      campaignId: campaign.id,
      title: 'Scheduled',
      scheduledStartAt: '2030-01-01T10:00:00.000Z',
      scheduledEndAt: '2030-01-01T11:00:00.000Z',
      timeZone: 'America/Chicago'
    })
    const changed = await other.caller.mutation(update, {
      campaignId: campaign.id,
      sessionId: session.id,
      expectedVersion: 0,
      title: 'Renamed',
      scheduledEndAt: '2030-01-01T12:00:00.000Z'
    })
    expect(changed).toMatchObject({
      title: 'Renamed',
      scheduledStartAt: session.scheduledStartAt,
      version: 1
    })
    await expect(
      other.caller.mutation(update, {
        campaignId: campaign.id,
        sessionId: session.id,
        expectedVersion: 0,
        title: 'stale'
      })
    ).rejects.toThrow()
    await expect(
      other.caller.mutation(update, {
        campaignId: campaign.id,
        sessionId: session.id,
        expectedVersion: 1,
        scheduledStartAt: null
      })
    ).rejects.toThrow()
    const cleared = await other.caller.mutation(update, {
      campaignId: campaign.id,
      sessionId: session.id,
      expectedVersion: 1,
      title: null,
      scheduledStartAt: null,
      scheduledEndAt: null,
      timeZone: null
    })
    expect(cleared).toMatchObject({
      title: null,
      scheduledStartAt: null,
      scheduledEndAt: null,
      timeZone: null,
      version: 2
    })
  })

  it('enforces membership, owner-only writes, archived read-only behavior, and finished metadata updates', async () => {
    const { t, owner, other, campaign } = await setup()
    const session = await other.caller.mutation(create, { campaignId: campaign.id, title: 'Open' })
    await expect(t.query(get, { campaignId: campaign.id, sessionNumber: 1 })).rejects.toThrow()
    await expect(
      owner.caller.mutation(create, { campaignId: campaign.id, title: 'nope' })
    ).rejects.toThrow()
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaignSessions')
        .withIndex('by_campaignId_sessionNumber', (q) =>
          q.eq('campaignId', campaign.id).eq('sessionNumber', 1)
        )
        .unique()
      if (!row) throw new Error('Missing session.')
      await ctx.db.patch(row._id, { status: 'FINISHED', finishedAt: new Date().toISOString() })
    })
    const finished = await other.caller.mutation(update, {
      campaignId: campaign.id,
      sessionId: session.id,
      expectedVersion: 0,
      title: 'Finished metadata'
    })
    expect(finished.title).toBe('Finished metadata')
    const otherCampaign = await owner.caller.mutation(createCampaign, {
      ...campaignInput,
      name: 'Other session campaign'
    })
    await expect(
      other.caller.query(get, { campaignId: otherCampaign.id, sessionNumber: 1 })
    ).rejects.toThrow()
    await expect(
      owner.caller.mutation(update, {
        campaignId: otherCampaign.id,
        sessionId: session.id,
        expectedVersion: 1,
        title: 'Wrong scope'
      })
    ).rejects.toThrow()
    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', campaign.id).eq('userId', owner.userId)
        )
        .unique()
      if (!membership) throw new Error('Missing player membership.')
      await ctx.db.patch(membership._id, { status: 'LEFT', leftAt: new Date().toISOString() })
    })
    await expect(
      owner.caller.query(get, { campaignId: campaign.id, sessionNumber: 1 })
    ).rejects.toThrow()
    await other.caller.mutation(archive, {
      campaignId: campaign.id,
      expectedVersion: campaign.version
    })
    await expect(
      other.caller.mutation(update, {
        campaignId: campaign.id,
        sessionId: session.id,
        expectedVersion: 1,
        title: 'blocked'
      })
    ).rejects.toThrow()
    await expect(other.caller.mutation(create, { campaignId: campaign.id })).rejects.toThrow()
    await expect(
      other.caller.mutation(rsvpSet, {
        campaignId: campaign.id,
        sessionId: session.id,
        response: 'YES'
      })
    ).rejects.toThrow()
    expect(
      (await other.caller.query(get, { campaignId: campaign.id, sessionNumber: 1 })).title
    ).toBe('Finished metadata')
  })

  it('keeps RSVP identity self-scoped and unique, while attendance is owner-only and versioned', async () => {
    const { t, owner, other, campaign, character } = await setup()
    const session = await other.caller.mutation(create, { campaignId: campaign.id, title: 'Open' })
    const yes = await owner.caller.mutation(rsvpSet, {
      campaignId: campaign.id,
      sessionId: session.id,
      response: 'YES'
    })
    const maybe = await owner.caller.mutation(rsvpSet, {
      campaignId: campaign.id,
      sessionId: session.id,
      response: 'MAYBE'
    })
    expect(yes.userId).toBe(owner.userId)
    expect(maybe.userId).toBe(owner.userId)
    expect(
      (await other.caller.query(rsvpList, rsvpInput(campaign.id, session.id))).page
    ).toHaveLength(1)
    const spoofedRsvp = {
      campaignId: campaign.id,
      sessionId: session.id,
      response: maybe.response,
      userId: other.userId
    }
    await expect(owner.caller.mutation(rsvpSet, spoofedRsvp)).rejects.toThrow()
    await expect(
      owner.caller.mutation(attendanceSet, {
        campaignId: campaign.id,
        sessionId: session.id,
        characterId: character.id,
        present: false,
        expectedVersion: 0
      })
    ).rejects.toThrow()
    await expect(
      other.caller.mutation(attendanceSet, {
        campaignId: campaign.id,
        sessionId: session.id,
        characterId: character.id,
        present: false,
        expectedVersion: 99
      })
    ).rejects.toThrow()
    const attendance = await other.caller.mutation(attendanceSet, {
      campaignId: campaign.id,
      sessionId: session.id,
      characterId: character.id,
      present: false,
      expectedVersion: 0
    })
    expect(attendance.present).toBe(false)
    const restored = await other.caller.mutation(attendanceSet, {
      campaignId: campaign.id,
      sessionId: session.id,
      characterId: character.id,
      present: true,
      expectedVersion: 0
    })
    expect(restored.present).toBe(true)
    expect(
      (await other.caller.query(get, { campaignId: campaign.id, sessionNumber: 1 })).version
    ).toBe(0)
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaignSessions')
        .withIndex('by_campaignId_sessionNumber', (q) =>
          q.eq('campaignId', campaign.id).eq('sessionNumber', 1)
        )
        .unique()
      if (!row) throw new Error('Missing session.')
      await ctx.db.patch(row._id, { status: 'FINISHED', finishedAt: new Date().toISOString() })
    })
    expect((await owner.caller.query(rsvpList, rsvpInput(campaign.id, session.id))).page).toEqual(
      []
    )
    await expect(
      owner.caller.mutation(rsvpSet, {
        campaignId: campaign.id,
        sessionId: session.id,
        response: 'NO'
      })
    ).rejects.toThrow()
    await expect(
      other.caller.mutation(attendanceSet, {
        campaignId: campaign.id,
        sessionId: session.id,
        characterId: character.id,
        present: false,
        expectedVersion: 0
      })
    ).rejects.toThrow()
  })

  it('rolls back invalid schedules and corrupt attendance seeds without consuming a session number', async () => {
    const { t, other, campaign, character } = await setup()
    const input = {
      campaignId: campaign.id,
      scheduledStartAt: '2030-01-01T10:00:00.000Z',
      scheduledEndAt: '2030-01-01T11:00:00.000Z',
      timeZone: 'America/Chicago'
    }
    await expect(
      other.caller.mutation(create, { ...input, timeZone: 'Not/A_Timezone' })
    ).rejects.toThrow()
    await expect(
      other.caller.mutation(create, { ...input, scheduledEndAt: input.scheduledStartAt })
    ).rejects.toThrow()
    await t.run(async (ctx) => {
      const assignment = await ctx.db
        .query('campaignCharacterAssignments')
        .withIndex('by_characterId', (q) => q.eq('characterId', character.id))
        .unique()
      if (!assignment) throw new Error('Missing assignment.')
      await ctx.db.patch(assignment._id, { characterId: crypto.randomUUID() })
    })
    await expect(other.caller.mutation(create, { campaignId: campaign.id })).rejects.toThrow()
    expect((await other.caller.query(list, pageInput(campaign.id))).page).toEqual([])
    await t.run(async (ctx) => {
      const assignment = await ctx.db
        .query('campaignCharacterAssignments')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
        .unique()
      const stored = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique()
      if (!assignment || !stored) throw new Error('Missing fixture rows.')
      await ctx.db.patch(assignment._id, { characterId: character.id })
      await ctx.db.patch(stored._id, { contentMaturity: 'MATURE' })
    })
    const created = await other.caller.mutation(create, {
      campaignId: campaign.id,
      title: 'A shitstorm begins'
    })
    expect(created).toMatchObject({ sessionNumber: 1, title: 'A shitstorm begins' })
  })
})
