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
import { deletedCampaignAuthorLabel } from '@artificer-toolkit/schema/api/campaignCommunication'
import { api, components } from '../_generated/api'
import { deleteAccountCompletely } from '../../tests/fixtures/accountDeletion'
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
  const addPlayer = (userId: string) =>
    base.t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: campaign.id,
        userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: campaign.createdAt,
        joinedAt: campaign.createdAt,
        leftAt: null
      })
    )
  const membershipId = await addPlayer(base.other.userId)
  const third = await base.addActor('Third')
  await addPlayer(third.userId)
  const session = await base.owner.caller.mutation(createSession, {
    campaignId: campaign.id,
    title: 'Old title'
  })
  return { ...base, campaign, session, membershipId, third }
}

function pageInput(
  campaignId: string,
  sessionId: string,
  cursor: string | null = null
): CampaignSessionNoteListInput {
  return { campaignId, sessionId, paginationOpts: { cursor, numItems: 2 } }
}

type Caller = Awaited<ReturnType<typeof setup>>['owner']['caller']

async function listAll(caller: Caller, campaignId: string, sessionId: string) {
  const rows: CampaignSessionNoteSectionDto[] = []
  let cursor: string | null = null
  for (;;) {
    const page: CampaignSessionNoteListPage = await caller.query(
      list,
      pageInput(campaignId, sessionId, cursor)
    )
    rows.push(...page.page)
    if (page.isDone) return rows
    cursor = page.continueCursor
  }
}

async function listIds(caller: Caller, campaignId: string, sessionId: string) {
  return (await listAll(caller, campaignId, sessionId)).map((row) => row.id)
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

  it('allows notes after finish, but only the author edits and only the author or owner deletes', async () => {
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
      kind: 'NOTE'
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
    await expect(
      other.caller.mutation(update, { ...target, content: '', expectedVersion: 0 })
    ).rejects.toThrow('Only the author')
    const edited = await owner.caller.mutation(update, {
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
      updatedBy: owner.userId
    })
    await expect(other.caller.mutation(remove, target)).rejects.toThrow('Only the author or the GM')
    await expect(
      owner.caller.mutation(update, { ...target, title: 'Stale', expectedVersion: 0 })
    ).rejects.toThrow('version conflict')
    const own = await other.caller.mutation(create, {
      campaignId: campaign.id,
      sessionId: session.id,
      title: 'Mine',
      content: '',
      visibility: 'SHARED',
      kind: 'NOTE'
    })
    await expect(
      other.caller.mutation(update, {
        campaignId: campaign.id,
        sessionId: session.id,
        sectionId: own.id,
        kind: 'SECRET',
        visibility: 'PRIVATE',
        expectedVersion: 0
      })
    ).rejects.toThrow()
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
      visibility: 'PRIVATE' as const,
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
      kind: 'NOTE',
      expectedVersion: 0
    })
    const notes: CampaignSessionNoteSectionDto[] = []
    for (let index = 0; index < 9; index++)
      notes.push(
        await other.caller.mutation(create, {
          ...noteInput,
          title: `Shared ${index}`,
          visibility: 'SHARED',
          kind: 'NOTE',
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
      visibility: 'PRIVATE',
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
  it('refuses shared notes and handouts from a member without a username, as chat does', async () => {
    const { t, owner, other, campaign, session } = await setup()
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', other.userId))
        .unique()
      if (!profile) throw new Error('Missing player profile.')
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }],
          update: { username: null, displayUsername: null }
        }
      })
    })
    const usernameRequired = 'A username is required to post in this Campaign.'
    await expect(
      other.caller.mutation(create, {
        campaignId: campaign.id,
        sessionId: session.id,
        title: 'Unnamed recap',
        content: '<p>Recap</p>',
        visibility: 'SHARED',
        kind: 'NOTE'
      })
    ).rejects.toThrow(usernameRequired)
    await expect(
      other.caller.mutation(api.campaigns.chat.send, {
        campaignId: campaign.id,
        room: 'TABLE',
        mode: 'OOC',
        body: 'Hello',
        clientNonce: crypto.randomUUID()
      })
    ).rejects.toThrow(usernameRequired)
    expect(await t.run((ctx) => ctx.db.query('campaignSessionNotes').collect())).toEqual([])
    await expect(
      owner.caller.mutation(create, {
        campaignId: campaign.id,
        sessionId: session.id,
        title: 'Named recap',
        content: '<p>Recap</p>',
        visibility: 'SHARED',
        kind: 'NOTE'
      })
    ).resolves.toMatchObject({ authorLabel: 'Owner' })
  })

  it('keeps a new note private to its author and the GM, and a hidden note reads as missing by ID', async () => {
    const { owner, other, third, campaign, session } = await setup()
    const base = {
      campaignId: campaign.id,
      sessionId: session.id,
      content: '',
      kind: 'NOTE'
    } as const
    const note = await other.caller.mutation(create, { ...base, title: 'Mine' })
    const gmNote = await owner.caller.mutation(create, { ...base, title: 'GM only' })
    expect(note).toMatchObject({
      visibility: 'PRIVATE',
      authorUserId: other.userId,
      authorLabel: 'Other'
    })
    expect(await listIds(other.caller, campaign.id, session.id)).toEqual([note.id])
    expect((await listIds(owner.caller, campaign.id, session.id)).sort()).toEqual(
      [note.id, gmNote.id].sort()
    )
    expect(await listIds(third.caller, campaign.id, session.id)).toEqual([])
    for (const sectionId of [note.id, gmNote.id, crypto.randomUUID()]) {
      const target = { campaignId: campaign.id, sessionId: session.id, sectionId }
      await expect(
        third.caller.mutation(update, { ...target, expectedVersion: 0, title: 'x' })
      ).rejects.toThrow('Session note not found')
      await expect(third.caller.mutation(remove, target)).rejects.toThrow('Session note not found')
    }
    await expect(
      owner.caller.mutation(update, {
        campaignId: campaign.id,
        sessionId: session.id,
        sectionId: note.id,
        expectedVersion: 0,
        title: 'GM edit'
      })
    ).rejects.toThrow('Only the author')
    await expect(
      other.caller.mutation(create, { ...base, title: 'Prep', kind: 'AGENDA' })
    ).rejects.toThrow('Campaign not found')
  })

  it('lists a shared note to every active member with its author, changeable only by the author, and lets the GM delete it', async () => {
    const { owner, other, third, campaign, session } = await setup()
    const note = await other.caller.mutation(create, {
      campaignId: campaign.id,
      sessionId: session.id,
      title: 'Recap',
      content: '',
      kind: 'NOTE'
    })
    const target = { campaignId: campaign.id, sessionId: session.id, sectionId: note.id }
    await other.caller.mutation(update, { ...target, expectedVersion: 0, visibility: 'SHARED' })
    expect(await listAll(third.caller, campaign.id, session.id)).toEqual([
      expect.objectContaining({ id: note.id, authorUserId: other.userId, authorLabel: 'Other' })
    ])
    for (const caller of [owner.caller, third.caller])
      await expect(
        caller.mutation(update, { ...target, expectedVersion: 1, visibility: 'PRIVATE' })
      ).rejects.toThrow('Only the author')
    await other.caller.mutation(update, { ...target, expectedVersion: 1, visibility: 'PRIVATE' })
    expect(await listIds(third.caller, campaign.id, session.id)).toEqual([])
    await other.caller.mutation(update, { ...target, expectedVersion: 2, visibility: 'SHARED' })
    expect(await owner.caller.mutation(remove, target)).toEqual({ ok: true })
    expect(await listIds(third.caller, campaign.id, session.id)).toEqual([])
  })

  it('keeps a departed player’s notes, private ones readable only by the GM', async () => {
    const { t, owner, other, third, campaign, session, membershipId } = await setup()
    const [privateNote, sharedNote] = await Promise.all(
      (['PRIVATE', 'SHARED'] as const).map((visibility) =>
        other.caller.mutation(create, {
          campaignId: campaign.id,
          sessionId: session.id,
          title: visibility,
          content: '',
          visibility,
          kind: 'NOTE'
        })
      )
    )
    await t.run((ctx) =>
      ctx.db.patch(membershipId, { status: 'LEFT', leftAt: new Date().toISOString() })
    )
    expect((await listIds(owner.caller, campaign.id, session.id)).sort()).toEqual(
      [privateNote!.id, sharedNote!.id].sort()
    )
    expect(await listAll(third.caller, campaign.id, session.id)).toEqual([
      expect.objectContaining({ id: sharedNote!.id, authorLabel: 'Other' })
    ])
  })

  it('keeps a deleted account’s notes as Deleted user, private ones readable only by the GM', async () => {
    const { t, owner, other, third, campaign, session } = await setup()
    const [privateNote, sharedNote] = await Promise.all(
      (['PRIVATE', 'SHARED'] as const).map((visibility) =>
        other.caller.mutation(create, {
          campaignId: campaign.id,
          sessionId: session.id,
          title: visibility,
          content: '',
          visibility,
          kind: 'NOTE'
        })
      )
    )
    const authUserId = await t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', other.userId))
        .unique()
      if (!profile) throw new Error('Missing player profile.')
      return profile.authUserId
    })
    await deleteAccountCompletely(t, authUserId)
    expect(await listAll(owner.caller, campaign.id, session.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: privateNote!.id, authorLabel: deletedCampaignAuthorLabel }),
        expect.objectContaining({ id: sharedNote!.id, authorLabel: deletedCampaignAuthorLabel })
      ])
    )
    expect(await listAll(third.caller, campaign.id, session.id)).toEqual([
      expect.objectContaining({ id: sharedNote!.id, authorLabel: deletedCampaignAuthorLabel })
    ])
  })
})
