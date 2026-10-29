import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignNotebookListInput,
  CampaignNotebookListPage,
  CampaignNotebookSectionDto,
  createCampaignNotebookSectionInputSchema,
  updateCampaignNotebookSectionInputSchema,
  deleteCampaignNotebookSectionInputSchema
} from '@artificer-toolkit/schema/api/campaignSessions'
import { deletedCampaignAuthorLabel } from '@artificer-toolkit/schema/api/campaignCommunication'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { deleteAccountCompletely } from '../../tests/fixtures/accountDeletion'
import { fixture } from '../../tests/fixtures/characters'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const list = makeFunctionReference<'query', CampaignNotebookListInput, CampaignNotebookListPage>(
  'campaigns/notebooks:list'
)
const create = makeFunctionReference<
  'mutation',
  z.input<typeof createCampaignNotebookSectionInputSchema>,
  CampaignNotebookSectionDto
>('campaigns/notebooks:create')
const update = makeFunctionReference<
  'mutation',
  z.input<typeof updateCampaignNotebookSectionInputSchema>,
  CampaignNotebookSectionDto
>('campaigns/notebooks:update')
const remove = makeFunctionReference<
  'mutation',
  z.input<typeof deleteCampaignNotebookSectionInputSchema>,
  { ok: true }
>('campaigns/notebooks:remove')
const archive = makeFunctionReference<
  'mutation',
  { campaignId: string; expectedVersion: number },
  CampaignDetailDto
>('campaigns/archive:archive')

async function setup(contentMaturity: 'STANDARD' | 'MATURE' = 'STANDARD') {
  const base = await fixture()
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Notebook test',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity,
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const addPlayer = (userId: string) =>
    base.t.run(async (ctx) => {
      const now = new Date().toISOString()
      return ctx.db.insert('campaignMemberships', {
        campaignId: campaign.id,
        userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: now,
        joinedAt: now,
        leftAt: null
      })
    })
  const membershipId = await addPlayer(base.other.userId)
  const third = await base.addActor('Third')
  await addPlayer(third.userId)
  return { ...base, campaign, membershipId, third }
}

function pageInput(campaignId: string, cursor: string | null = null): CampaignNotebookListInput {
  return { campaignId, paginationOpts: { cursor, numItems: 1 } }
}

type Caller = Awaited<ReturnType<typeof setup>>['owner']['caller']

async function listAll(caller: Caller, campaignId: string) {
  const rows: CampaignNotebookSectionDto[] = []
  let cursor: string | null = null
  for (;;) {
    const result: CampaignNotebookListPage = await caller.query(list, pageInput(campaignId, cursor))
    rows.push(...result.page)
    if (result.isDone) return rows
    cursor = result.continueCursor
  }
}

async function listIds(caller: Caller, campaignId: string) {
  return (await listAll(caller, campaignId)).map((row) => row.id)
}

describe('native Campaign notebooks', () => {
  it('creates, masks, updates, and deletes sections while retaining private storage', async () => {
    const { t, owner, other, campaign } = await setup()
    const privateSection = await owner.caller.mutation(create, {
      campaignId: campaign.id.toUpperCase(),
      title: 'Private shitstorm',
      content: '<p>Private shitstorm</p>'
    })
    expect(privateSection).toMatchObject({
      campaignId: campaign.id,
      visibility: 'PRIVATE',
      authorUserId: owner.userId,
      authorLabel: 'Owner',
      category: 'GENERAL',
      version: 0
    })
    expect(privateSection.title).toBe('Private shitstorm')
    expect(privateSection.content).toBe('<p>Private shitstorm</p>')
    expect(await other.caller.query(list, pageInput(campaign.id))).toMatchObject({
      page: [],
      isDone: true
    })
    const shared = await owner.caller.mutation(create, {
      campaignId: campaign.id,
      title: 'Shared shitstorm',
      content: '<p>Shared shitstorm</p>',
      visibility: 'SHARED',
      category: 'PEOPLE'
    })
    expect(shared.title).not.toContain('shitstorm')
    expect(shared.content).not.toContain('shitstorm')
    expect(JSON.stringify(shared)).not.toMatch(/_id|createdBy|updatedBy/)
    // One-row pages end at the shared row or continue past the hidden one, by id order.
    expect(await listAll(other.caller, campaign.id)).toEqual([shared])
    expect(
      await t.run(async (ctx) =>
        ctx.db
          .query('campaignNotebookSections')
          .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id).eq('id', shared.id))
          .unique()
      )
    ).toMatchObject({ title: 'Shared shitstorm', content: '<p>Shared shitstorm</p>' })

    await expect(
      owner.caller.mutation(update, {
        campaignId: campaign.id,
        sectionId: shared.id,
        expectedVersion: 99,
        title: 'stale'
      })
    ).rejects.toThrow('version conflict')
    expect((await other.caller.query(list, pageInput(campaign.id))).page[0]).toEqual(shared)

    const updated = await owner.caller.mutation(update, {
      campaignId: campaign.id,
      sectionId: shared.id.toUpperCase(),
      expectedVersion: 0,
      content: '',
      visibility: 'PRIVATE'
    })
    expect(updated).toMatchObject({
      title: 'Shared shitstorm',
      content: '',
      version: 1,
      visibility: 'PRIVATE'
    })
    expect(await other.caller.query(list, pageInput(campaign.id))).toMatchObject({ page: [] })
    const rows = await t.run((ctx) => ctx.db.query('campaignNotebookSections').collect())
    expect(rows.find((row) => row.id === privateSection.id)).toMatchObject({
      title: 'Private shitstorm',
      content: '<p>Private shitstorm</p>',
      sortOrder: 0,
      authorUserId: owner.userId,
      updatedBy: owner.userId
    })
    const republished = await owner.caller.mutation(update, {
      campaignId: campaign.id,
      sectionId: shared.id,
      expectedVersion: 1,
      visibility: 'SHARED'
    })
    expect(republished).toMatchObject({ version: 2, content: '', category: 'PEOPLE' })
    expect(republished.title).not.toContain('shitstorm')
    expect((await other.caller.query(list, pageInput(campaign.id))).page).toEqual([republished])
    await owner.caller.mutation(remove, {
      campaignId: campaign.id.toUpperCase(),
      sectionId: privateSection.id.toUpperCase()
    })
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('campaignNotebookSections')
          .withIndex('by_campaignId_id', (q) =>
            q.eq('campaignId', campaign.id).eq('id', privateSection.id)
          )
          .unique()
      )
    ).toBeNull()
    await expect(
      owner.caller.mutation(remove, { campaignId: campaign.id, sectionId: crypto.randomUUID() })
    ).rejects.toThrow('Notebook section not found')
  })

  it('keeps mature shared text original and exposes all rows through native pages', async () => {
    const { t, owner, other, campaign } = await setup('MATURE')
    const created = await Promise.all(
      Array.from({ length: 9 }, (_, index) =>
        owner.caller.mutation(create, {
          campaignId: campaign.id,
          title: `Note ${index} shitstorm`,
          content: `<p>Body ${index} shitstorm</p>`,
          visibility: 'SHARED'
        })
      )
    )
    expect(created[0]?.title).toContain('shitstorm')
    const last = created[0]!
    await t.run(async (ctx) => {
      const stored = await ctx.db
        .query('campaignNotebookSections')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id).eq('id', last.id))
        .unique()
      if (!stored) throw new Error('Missing test note.')
      await ctx.db.patch(stored._id, { sortOrder: 1 })
    })
    const ids: string[] = []
    let cursor: string | null = null
    for (let page = 0; page < 12; page++) {
      const result: CampaignNotebookListPage = await other.caller.query(
        list,
        pageInput(campaign.id, cursor)
      )
      ids.push(...result.page.map((row) => row.id))
      if (result.isDone) break
      cursor = result.continueCursor
    }
    expect(ids).toHaveLength(9)
    expect(ids).toEqual([
      ...created
        .slice(1)
        .map((note) => note.id)
        .sort(),
      last.id
    ])
  })

  it('enforces membership and author writes, including archived and left campaigns', async () => {
    const { t, owner, other, campaign, membershipId } = await setup()
    const section = await owner.caller.mutation(create, {
      campaignId: campaign.id,
      title: 'Shared',
      content: 'Text',
      visibility: 'SHARED'
    })
    await expect(t.query(list, pageInput(campaign.id))).rejects.toThrow('Unauthenticated')
    await expect(
      t.mutation(create, { campaignId: campaign.id, title: 'x', content: '' })
    ).rejects.toThrow('Unauthenticated')
    await expect(
      other.caller.mutation(update, {
        campaignId: campaign.id,
        sectionId: section.id,
        expectedVersion: 0,
        title: 'x'
      })
    ).rejects.toThrow('Only the author')
    await expect(
      other.caller.mutation(remove, { campaignId: campaign.id, sectionId: section.id })
    ).rejects.toThrow('Only the author or the GM')
    await owner.caller.mutation(archive, {
      campaignId: campaign.id,
      expectedVersion: campaign.version
    })
    expect((await other.caller.query(list, pageInput(campaign.id))).page).toHaveLength(1)
    await expect(
      owner.caller.mutation(create, { campaignId: campaign.id, title: 'x', content: '' })
    ).rejects.toThrow('read-only')
    await expect(
      owner.caller.mutation(update, {
        campaignId: campaign.id,
        sectionId: section.id,
        expectedVersion: 0,
        title: 'x'
      })
    ).rejects.toThrow('read-only')
    await expect(
      owner.caller.mutation(remove, { campaignId: campaign.id, sectionId: section.id })
    ).rejects.toThrow('read-only')
    await t.run((ctx) =>
      ctx.db.patch(membershipId, { status: 'LEFT', leftAt: new Date().toISOString() })
    )
    await expect(other.caller.query(list, pageInput(campaign.id))).rejects.toThrow(
      'Campaign not found'
    )
  })

  it('rejects cross-campaign and malformed UUID targets', async () => {
    const { t, owner, other, campaign } = await setup()
    await t.run((ctx) =>
      ctx.db.insert('accountEntitlements', { userId: owner.userId, tier: 'PRO_GM' })
    )
    const otherCampaign = await owner.caller.mutation(createCampaign, {
      name: 'Other notebook test',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    const section = await owner.caller.mutation(create, {
      campaignId: campaign.id,
      title: 'x',
      content: ''
    })
    await expect(other.caller.query(list, pageInput(otherCampaign.id))).rejects.toThrow(
      'Campaign not found'
    )
    await expect(
      owner.caller.mutation(remove, { campaignId: otherCampaign.id, sectionId: section.id })
    ).rejects.toThrow('Notebook section not found')
    await expect(
      owner.caller.mutation(update, {
        campaignId: otherCampaign.id,
        sectionId: section.id,
        expectedVersion: 0,
        title: 'x'
      })
    ).rejects.toThrow('Notebook section not found')
    await expect(
      owner.caller.mutation(create, { campaignId: campaign.id, title: '', content: '' })
    ).rejects.toThrow()
    await expect(
      owner.caller.mutation(create, {
        campaignId: campaign.id,
        title: 'x',
        content: 'x'.repeat(20_001)
      })
    ).rejects.toThrow()
    await expect(owner.caller.query(list, pageInput('not-a-uuid'))).rejects.toThrow()
  })

  it('keeps a new entry private to its author and the GM, and a hidden entry reads as missing by ID', async () => {
    const { owner, other, third, campaign } = await setup()
    const entry = await other.caller.mutation(create, {
      campaignId: campaign.id,
      title: 'Mine',
      content: '<p>mine</p>'
    })
    const gmEntry = await owner.caller.mutation(create, {
      campaignId: campaign.id,
      title: 'GM only',
      content: ''
    })
    expect(entry).toMatchObject({
      visibility: 'PRIVATE',
      authorUserId: other.userId,
      authorLabel: 'Other'
    })
    expect(await listIds(other.caller, campaign.id)).toEqual([entry.id])
    expect((await listIds(owner.caller, campaign.id)).sort()).toEqual([entry.id, gmEntry.id].sort())
    expect(await listIds(third.caller, campaign.id)).toEqual([])
    for (const sectionId of [entry.id, gmEntry.id, crypto.randomUUID()]) {
      await expect(
        third.caller.mutation(update, {
          campaignId: campaign.id,
          sectionId,
          expectedVersion: 0,
          title: 'x'
        })
      ).rejects.toThrow('Notebook section not found')
      await expect(
        third.caller.mutation(remove, { campaignId: campaign.id, sectionId })
      ).rejects.toThrow('Notebook section not found')
    }
    await expect(
      owner.caller.mutation(update, {
        campaignId: campaign.id,
        sectionId: entry.id,
        expectedVersion: 0,
        title: 'GM edit'
      })
    ).rejects.toThrow('Only the author')
    expect(await listIds(other.caller, campaign.id)).toEqual([entry.id])
  })

  it('lists a shared entry to every active member with its author, changeable only by the author, and lets the GM delete it', async () => {
    const { t, owner, other, third, campaign } = await setup()
    const entry = await other.caller.mutation(create, {
      campaignId: campaign.id,
      title: 'Shared by Other',
      content: '<p>shared</p>'
    })
    const target = { campaignId: campaign.id, sectionId: entry.id }
    const shared = await other.caller.mutation(update, {
      ...target,
      expectedVersion: 0,
      visibility: 'SHARED'
    })
    expect(shared).toMatchObject({ visibility: 'SHARED', version: 1 })
    expect(await listAll(third.caller, campaign.id)).toEqual([
      expect.objectContaining({ id: entry.id, authorUserId: other.userId, authorLabel: 'Other' })
    ])
    for (const caller of [owner.caller, third.caller])
      await expect(
        caller.mutation(update, { ...target, expectedVersion: 1, visibility: 'PRIVATE' })
      ).rejects.toThrow('Only the author')
    await other.caller.mutation(update, { ...target, expectedVersion: 1, visibility: 'PRIVATE' })
    expect(await listIds(third.caller, campaign.id)).toEqual([])
    await other.caller.mutation(update, { ...target, expectedVersion: 2, visibility: 'SHARED' })
    expect(await owner.caller.mutation(remove, target)).toEqual({ ok: true })
    expect(await listIds(third.caller, campaign.id)).toEqual([])
    expect(await t.run((ctx) => ctx.db.query('campaignNotebookSections').collect())).toEqual([])
  })

  it('keeps a departed player’s entries, private ones readable only by the GM', async () => {
    const { t, owner, other, third, campaign, membershipId } = await setup()
    const [privateEntry, sharedEntry] = await Promise.all(
      (['PRIVATE', 'SHARED'] as const).map((visibility) =>
        other.caller.mutation(create, {
          campaignId: campaign.id,
          title: visibility,
          content: '',
          visibility
        })
      )
    )
    await t.run((ctx) =>
      ctx.db.patch(membershipId, { status: 'LEFT', leftAt: new Date().toISOString() })
    )
    expect((await listIds(owner.caller, campaign.id)).sort()).toEqual(
      [privateEntry!.id, sharedEntry!.id].sort()
    )
    expect(await listAll(third.caller, campaign.id)).toEqual([
      expect.objectContaining({ id: sharedEntry!.id, authorLabel: 'Other' })
    ])
  })

  it('keeps a deleted account’s entries as Deleted user, private ones readable only by the GM', async () => {
    const { t, owner, other, third, campaign } = await setup()
    const [privateEntry, sharedEntry] = await Promise.all(
      (['PRIVATE', 'SHARED'] as const).map((visibility) =>
        other.caller.mutation(create, {
          campaignId: campaign.id,
          title: visibility,
          content: '',
          visibility
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
    expect(await listAll(owner.caller, campaign.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: privateEntry!.id, authorLabel: deletedCampaignAuthorLabel }),
        expect.objectContaining({ id: sharedEntry!.id, authorLabel: deletedCampaignAuthorLabel })
      ])
    )
    expect(await listAll(third.caller, campaign.id)).toEqual([
      expect.objectContaining({ id: sharedEntry!.id, authorLabel: deletedCampaignAuthorLabel })
    ])
  })
})
