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
  CampaignSessionNoteSectionDto,
  FinishCampaignSessionInput,
  createCampaignSessionInputSchema,
  updateCampaignSessionInputSchema,
  createCampaignSessionNoteSectionInputSchema,
  updateCampaignSessionNoteSectionInputSchema,
  deleteCampaignSessionNoteSectionInputSchema
} from '@artificer-toolkit/schema/api/campaignSessions'
import type {
  CampaignSessionNoteListInput,
  CampaignSessionNoteListPage
} from '@artificer-toolkit/schema/api/campaignSessionLists'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { fixture } from '../../tests/fixtures/characters'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const createSession = makeFunctionReference<
  'mutation',
  z.input<typeof createCampaignSessionInputSchema>,
  CampaignSessionDto
>('campaigns/sessions:create')
const updateSession = makeFunctionReference<
  'mutation',
  z.input<typeof updateCampaignSessionInputSchema>,
  CampaignSessionDto
>('campaigns/sessions:update')
const finish = makeFunctionReference<'mutation', FinishCampaignSessionInput, CampaignSessionDto>(
  'campaigns/sessionFinish:finish'
)
const archive = makeFunctionReference<
  'mutation',
  z.input<typeof archiveCampaignInputSchema>,
  CampaignDetailDto
>('campaigns/archive:archive')
const create = makeFunctionReference<
  'mutation',
  z.input<typeof createCampaignSessionNoteSectionInputSchema>,
  CampaignSessionNoteSectionDto
>('campaigns/sessionNotes:create')
const update = makeFunctionReference<
  'mutation',
  z.input<typeof updateCampaignSessionNoteSectionInputSchema>,
  CampaignSessionNoteSectionDto
>('campaigns/sessionNotes:update')
const remove = makeFunctionReference<
  'mutation',
  z.input<typeof deleteCampaignSessionNoteSectionInputSchema>,
  { ok: true }
>('campaigns/sessionNotes:remove')
const list = makeFunctionReference<
  'query',
  CampaignSessionNoteListInput,
  CampaignSessionNoteListPage
>('campaigns/sessionNotes:list')

async function setup() {
  const base = await fixture()
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Session notes',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const membershipId = await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.other.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  )
  const session = await base.owner.caller.mutation(createSession, {
    campaignId: campaign.id,
    title: 'Old title'
  })
  return { ...base, campaign, session, membershipId }
}

function pageInput(
  campaignId: string,
  sessionId: string,
  cursor: string | null = null
): CampaignSessionNoteListInput {
  return { campaignId, sessionId, paginationOpts: { cursor, numItems: 2 } }
}

describe('native Session finish and notes', () => {
  it('commits finish once, returns the original result after metadata edits, and rechecks replay authority', async () => {
    const { t, owner, other, campaign, session } = await setup()
    const input: FinishCampaignSessionInput = {
      campaignId: campaign.id,
      sessionId: session.id,
      expectedVersion: 0,
      commandId: crypto.randomUUID()
    }
    await expect(t.mutation(finish, input)).rejects.toThrow()
    await expect(other.caller.mutation(finish, input)).rejects.toThrow()
    const finished = await owner.caller.mutation(finish, input)
    expect(finished).toMatchObject({ status: 'FINISHED', version: 1, title: 'Old title' })
    expect(finished.finishedAt).toBe(finished.updatedAt)
    await owner.caller.mutation(updateSession, {
      campaignId: campaign.id,
      sessionId: session.id,
      expectedVersion: 1,
      title: 'Later metadata'
    })
    expect(await owner.caller.mutation(finish, input)).toEqual(finished)
    await expect(owner.caller.mutation(finish, { ...input, expectedVersion: 1 })).rejects.toThrow(
      'different input'
    )
    await expect(
      owner.caller.mutation(finish, {
        ...input,
        commandId: crypto.randomUUID(),
        expectedVersion: 2
      })
    ).rejects.toThrow('already finished')
    const receipt = await t.run((ctx) =>
      ctx.db
        .query('campaignCommands')
        .withIndex('by_campaignId_commandId', (q) =>
          q.eq('campaignId', campaign.id).eq('commandId', input.commandId)
        )
        .unique()
    )
    expect(receipt?.resultPayload).toEqual(finished)
    if (!receipt) throw new Error('Missing receipt.')
    await t.run((ctx) =>
      ctx.db.patch(receipt._id, { resultPayload: { ...finished, id: crypto.randomUUID() } })
    )
    await expect(owner.caller.mutation(finish, input)).rejects.toThrow('result mismatch')
    await t.run((ctx) => ctx.db.patch(receipt._id, { resultPayload: finished }))
    await owner.caller.mutation(archive, { campaignId: campaign.id, expectedVersion: 0 })
    await expect(owner.caller.mutation(finish, input)).rejects.toThrow('read-only')
  })

  it('rolls back a finish transition when its saved projection is invalid', async () => {
    const { t, owner, campaign, session } = await setup()
    const stored = await t.run((ctx) =>
      ctx.db
        .query('campaignSessions')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id).eq('id', session.id))
        .unique()
    )
    if (!stored) throw new Error('Missing Session.')
    await t.run((ctx) => ctx.db.patch(stored._id, { title: '' }))
    const input = {
      campaignId: campaign.id,
      sessionId: session.id,
      expectedVersion: 0,
      commandId: crypto.randomUUID()
    }
    await expect(owner.caller.mutation(finish, input)).rejects.toThrow()
    expect(await t.run((ctx) => ctx.db.get(stored._id))).toMatchObject({
      status: 'OPEN',
      version: 0,
      finishedAt: null
    })
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('campaignCommands')
          .withIndex('by_campaignId_commandId', (q) =>
            q.eq('campaignId', campaign.id).eq('commandId', input.commandId)
          )
          .unique()
      )
    ).toBeNull()
    await t.run((ctx) => ctx.db.patch(stored._id, { title: 'Repaired' }))
    expect(await owner.caller.mutation(finish, input)).toMatchObject({
      status: 'FINISHED',
      version: 1
    })
  })

  it('allows shared collaboration after finish, but only the author or owner can delete', async () => {
    const { t, owner, other, campaign, session } = await setup()
    await owner.caller.mutation(finish, {
      campaignId: campaign.id,
      sessionId: session.id,
      expectedVersion: 0,
      commandId: crypto.randomUUID()
    })
    const shared = await owner.caller.mutation(create, {
      campaignId: campaign.id.toUpperCase(),
      sessionId: session.id.toUpperCase(),
      title: 'Shared shitstorm',
      content: '<p>A shitstorm</p>',
      visibility: 'SHARED',
      kind: 'SHARED_NOTE'
    })
    expect(shared).toMatchObject({
      campaignId: campaign.id,
      sessionId: session.id,
      authorUserId: owner.userId,
      sortOrder: 0,
      version: 0
    })
    expect(shared.title).not.toContain('shitstorm')
    expect(shared.content).not.toContain('shitstorm')
    expect(JSON.stringify(shared)).not.toMatch(/updatedBy|_creationTime|"_id"/)
    const target = { campaignId: campaign.id, sessionId: session.id, sectionId: shared.id }
    const edited = await other.caller.mutation(update, {
      ...target,
      content: '',
      expectedVersion: 0
    })
    expect(edited).toMatchObject({ content: '', authorUserId: owner.userId, version: 1 })
    const stored = await t.run((ctx) =>
      ctx.db
        .query('campaignSessionNotes')
        .withIndex('by_campaignId_sessionId_id', (q) =>
          q.eq('campaignId', campaign.id).eq('sessionId', session.id).eq('id', shared.id)
        )
        .unique()
    )
    expect(stored).toMatchObject({
      title: 'Shared shitstorm',
      content: '',
      updatedBy: other.userId
    })
    await expect(other.caller.mutation(remove, target)).rejects.toThrow()
    await expect(
      other.caller.mutation(update, { ...target, title: 'Stale', expectedVersion: 0 })
    ).rejects.toThrow('version conflict')
    await expect(
      other.caller.mutation(update, {
        ...target,
        visibility: 'GM_PRIVATE',
        kind: 'SECRET',
        expectedVersion: 1
      })
    ).rejects.toThrow()
    const own = await other.caller.mutation(create, {
      campaignId: campaign.id,
      sessionId: session.id,
      title: 'Mine',
      content: '',
      visibility: 'SHARED',
      kind: 'SHARED_NOTE'
    })
    expect(await other.caller.mutation(remove, { ...target, sectionId: own.id })).toEqual({
      ok: true
    })
    expect(await owner.caller.mutation(remove, target)).toEqual({ ok: true })
    expect((await other.caller.query(list, pageInput(campaign.id, session.id))).page).toEqual([])
  })

  it('keeps private notes out of player pages and preserves kind, Session, archive, and membership boundaries', async () => {
    const { t, owner, other, campaign, session, membershipId } = await setup()
    const noteInput = {
      campaignId: campaign.id,
      sessionId: session.id,
      title: 'Private shitstorm',
      content: '<p>Secret</p>',
      visibility: 'GM_PRIVATE' as const,
      kind: 'SECRET' as const
    }
    await expect(t.mutation(create, noteInput)).rejects.toThrow()
    await expect(other.caller.mutation(create, noteInput)).rejects.toThrow()
    await expect(
      owner.caller.mutation(create, { ...noteInput, visibility: 'SHARED' })
    ).rejects.toThrow()
    const secret = await owner.caller.mutation(create, noteInput)
    expect(secret.title).toBe(noteInput.title)
    expect(await other.caller.query(list, pageInput(campaign.id, session.id))).toMatchObject({
      page: [],
      isDone: true
    })
    const target = { campaignId: campaign.id, sessionId: session.id, sectionId: secret.id }
    await expect(
      other.caller.mutation(update, { ...target, title: 'Leaked', expectedVersion: 0 })
    ).rejects.toThrow()
    await expect(other.caller.mutation(remove, target)).rejects.toThrow()
    const second = await owner.caller.mutation(createSession, { campaignId: campaign.id })
    await expect(
      owner.caller.mutation(update, {
        ...target,
        sessionId: second.id,
        title: 'Wrong Session',
        expectedVersion: 0
      })
    ).rejects.toThrow()
    await expect(
      owner.caller.mutation(update, { ...target, visibility: 'SHARED', expectedVersion: 0 })
    ).rejects.toThrow()
    await owner.caller.mutation(update, {
      ...target,
      visibility: 'SHARED',
      kind: 'SHARED_NOTE',
      expectedVersion: 0
    })
    const notes: CampaignSessionNoteSectionDto[] = []
    for (let index = 0; index < 9; index++)
      notes.push(
        await other.caller.mutation(create, {
          ...noteInput,
          title: `Shared ${index}`,
          visibility: 'SHARED',
          kind: 'SHARED_NOTE',
          sortOrder: index + 1
        })
      )
    const actual: string[] = []
    let cursor: string | null = null
    for (;;) {
      const page: CampaignSessionNoteListPage = await other.caller.query(
        list,
        pageInput(campaign.id, session.id, cursor)
      )
      actual.push(...page.page.map((note) => note.id))
      if (page.isDone) break
      cursor = page.continueCursor
    }
    expect(actual).toEqual([secret.id, ...notes.map((note) => note.id)])
    await owner.caller.mutation(update, {
      ...target,
      visibility: 'GM_PRIVATE',
      kind: 'SECRET',
      expectedVersion: 1
    })
    expect(
      (await other.caller.query(list, pageInput(campaign.id, session.id))).page.every(
        (note) => note.id !== secret.id
      )
    ).toBe(true)
    await t.run((ctx) =>
      ctx.db.patch(membershipId, { status: 'LEFT', leftAt: new Date().toISOString() })
    )
    await expect(other.caller.query(list, pageInput(campaign.id, session.id))).rejects.toThrow()
    await owner.caller.mutation(archive, { campaignId: campaign.id, expectedVersion: 0 })
    expect((await owner.caller.query(list, pageInput(campaign.id, session.id))).page[0]?.id).toBe(
      secret.id
    )
    await expect(owner.caller.mutation(create, noteInput)).rejects.toThrow('read-only')
    await expect(
      owner.caller.mutation(update, { ...target, expectedVersion: 2, title: 'Archived' })
    ).rejects.toThrow('read-only')
    await expect(owner.caller.mutation(remove, target)).rejects.toThrow('read-only')
  })
})
