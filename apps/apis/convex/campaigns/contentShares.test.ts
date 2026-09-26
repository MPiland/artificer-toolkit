import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignContentShareDto,
  CampaignContentRemovalReceiptDto,
  CampaignDetailDto,
  CreateCampaignInput,
  ShareCampaignContentInput,
  UnshareCampaignContentInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignContentListInput,
  CampaignContentListPage
} from '@artificer-toolkit/schema/api/campaignContentList'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { api, internal } from '../_generated/api'
import { fixture } from '../../tests/fixtures/characters'
import { corruptPublishedVersionPayload, importedSubject } from '../../tests/fixtures/publication'
import { deleteAuthoredVersion, insertAuthoredVersion } from '../content/documents'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const share = makeFunctionReference<'mutation', ShareCampaignContentInput, CampaignContentShareDto>(
  'campaigns/contentShares:share'
)
const unshare = makeFunctionReference<
  'mutation',
  UnshareCampaignContentInput,
  CampaignContentRemovalReceiptDto
>('campaigns/contentShares:unshare')
const list = makeFunctionReference<'query', CampaignContentListInput, CampaignContentListPage>(
  'campaigns/contentShares:list'
)

async function setup(contentMaturity: 'STANDARD' | 'MATURE' = 'STANDARD') {
  const base = await fixture()
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ subjectKind: 'BACKGROUND', ...acolyte, document: acolyte })]
  })
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Shared homebrew',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity,
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
  return { ...base, campaign, membershipId }
}

async function ownedContent(
  t: Awaited<ReturnType<typeof fixture>>['t'],
  userId: string,
  id: string = crypto.randomUUID()
) {
  return t.run(async (ctx) => {
    const template = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', acolyte.id))
      .unique()
    if (!template) throw new Error('Missing Acolyte fixture.')
    const stored = await ctx.db.get(template.currentVersionId)
    if (!stored) throw new Error('Missing Acolyte version fixture.')
    const contentSourceId = crypto.randomUUID()
    const sourceId = await ctx.db.insert('contentSources', {
      ...SRD_CONTENT_SOURCE,
      id: contentSourceId,
      kind: 'USER',
      ownerUserId: userId
    })
    const document = {
      ...acolyte,
      id,
      userId,
      status: 'ACTIVE' as const,
      label: 'Secret shitstorm',
      description: '<p>Secret shitstorm</p>'
    }
    const checksum = checksumRuleDocument(document)
    const publicVersionId = crypto.randomUUID()
    const versionId = await insertAuthoredVersion(
      ctx,
      {
        subjectKind: stored.subjectKind,
        id,
        systemId: stored.systemId,
        label: document.label,
        checksum,
        contentSourceId,
        versionId: publicVersionId,
        version: stored.version,
        documentSchemaVersion: stored.documentSchemaVersion,
        compilation: stored.compilation
      },
      canonicalizeRuleDocument(document)
    )
    const rootId = await ctx.db.insert('authoredRoots', {
      id,
      subjectKind: 'BACKGROUND',
      systemId: srdSystemRecord.id,
      label: document.label,
      checksum,
      contentSourceId,
      ownerUserId: userId,
      currentVersionId: versionId,
      currentVersionPublicId: publicVersionId
    })
    await ctx.db.insert('authoredRouteIds', {
      subjectKind: 'BACKGROUND',
      subjectId: id,
      ownerUserId: userId,
      routeNumber: 1000,
      publicId: id
    })
    return { id, rootId, sourceId, document }
  })
}

const pageInput = (
  campaignId: string,
  cursor: string | null = null,
  numItems = 2
): CampaignContentListInput => ({ campaignId, paginationOpts: { cursor, numItems } })
const shareInput = (campaignId: string, subjectId: string): ShareCampaignContentInput => ({
  campaignId,
  subjectKind: 'BACKGROUND',
  subjectId
})

describe('native Campaign content sharing', () => {
  it('unshares with current authority and version, then replays only the exact actor-bound command', async () => {
    const { t, owner, other, campaign } = await setup()
    const content = await ownedContent(t, owner.userId)
    await owner.caller.mutation(share, shareInput(campaign.id, content.id))
    const sharedRevision = await t.run((ctx) =>
      ctx.db
        .query('sceneVisionRevisions')
        .withIndex('by_scope_id', (q) => q.eq('scope', 'CAMPAIGN').eq('id', campaign.id))
        .unique()
    )
    expect(sharedRevision).not.toBeNull()
    const request: UnshareCampaignContentInput = {
      campaignId: campaign.id,
      subjectKind: 'BACKGROUND',
      subjectId: content.id,
      sharedBy: owner.userId,
      expectedCampaignVersion: campaign.version,
      commandId: crypto.randomUUID()
    }
    await expect(t.mutation(unshare, request)).rejects.toThrow('Unauthenticated')
    await expect(other.caller.mutation(unshare, request)).rejects.toThrow('cannot remove')
    const result = await owner.caller.mutation(unshare, request)
    expect(result).toMatchObject({
      campaignVersion: campaign.version + 1,
      removedShares: [{ subjectKind: 'BACKGROUND', subjectId: content.id, sharedBy: owner.userId }],
      affectedCharacters: [],
      evacuatedVehicles: []
    })
    expect(await owner.caller.mutation(unshare, request)).toEqual(result)
    await expect(
      owner.caller.mutation(unshare, { ...request, expectedCampaignVersion: campaign.version + 1 })
    ).rejects.toThrow('different input')
    await expect(
      owner.caller.mutation(unshare, { ...request, commandId: crypto.randomUUID() })
    ).rejects.toThrow('Campaign changed')
    const state = await t.run(async (ctx) => ({
      campaign: await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique(),
      shares: await ctx.db.query('campaignContentShares').collect(),
      visionRevision: await ctx.db
        .query('sceneVisionRevisions')
        .withIndex('by_scope_id', (q) => q.eq('scope', 'CAMPAIGN').eq('id', campaign.id))
        .unique(),
      receiptEvents: await ctx.db
        .query('campaignEvents')
        .withIndex('by_campaignId_commandId', (q) =>
          q.eq('campaignId', campaign.id).eq('commandId', request.commandId)
        )
        .collect()
    }))
    expect(state.campaign?.version).toBe(campaign.version + 1)
    expect(state.shares).toEqual([])
    expect(state.visionRevision?.revision).not.toBe(sharedRevision?.revision)
    expect(state.receiptEvents).toHaveLength(1)
  })

  it('allows an active Player to remove their own share and rejects archived unshare', async () => {
    const { t, owner, other, campaign } = await setup()
    const playerContent = await ownedContent(t, other.userId)
    await other.caller.mutation(share, shareInput(campaign.id, playerContent.id))
    const playerResult = await other.caller.mutation(unshare, {
      campaignId: campaign.id,
      subjectKind: 'BACKGROUND',
      subjectId: playerContent.id,
      sharedBy: other.userId,
      expectedCampaignVersion: campaign.version,
      commandId: crypto.randomUUID()
    })
    expect(playerResult.campaignVersion).toBe(campaign.version + 1)
    const playerEvent = await t.run((ctx) =>
      ctx.db
        .query('campaignEvents')
        .withIndex('by_campaignId_id', (q) =>
          q.eq('campaignId', campaign.id).eq('id', playerResult.eventId)
        )
        .unique()
    )
    expect(playerEvent?.commandId).toBeDefined()
    expect(
      await other.caller.mutation(unshare, {
        campaignId: campaign.id.toUpperCase(),
        subjectKind: 'BACKGROUND',
        subjectId: playerContent.id.toUpperCase(),
        sharedBy: other.userId.toUpperCase(),
        expectedCampaignVersion: campaign.version,
        commandId: playerEvent!.commandId!.toUpperCase()
      })
    ).toEqual(playerResult)
    const ownerContent = await ownedContent(t, owner.userId)
    await owner.caller.mutation(share, shareInput(campaign.id, ownerContent.id))
    await owner.caller.mutation(api.campaigns.archive.archive, {
      campaignId: campaign.id,
      expectedVersion: playerResult.campaignVersion
    })
    await expect(
      owner.caller.mutation(unshare, {
        campaignId: campaign.id,
        subjectKind: 'BACKGROUND',
        subjectId: ownerContent.id,
        sharedBy: owner.userId,
        expectedCampaignVersion: playerResult.campaignVersion + 1,
        commandId: crypto.randomUUID()
      })
    ).rejects.toThrow('read-only')
  })
  it('shares owned Active content idempotently, masks only Campaign reads, and grants no global access', async () => {
    const { t, owner, other, campaign } = await setup()
    const content = await ownedContent(t, owner.userId)
    const input = shareInput(campaign.id.toUpperCase(), content.id.toUpperCase())
    const first = await owner.caller.mutation(share, input)
    expect(first.document).toMatchObject({
      id: content.id,
      userId: owner.userId,
      label: 'Secret shitstorm'
    })
    expect(await owner.caller.mutation(share, input)).toEqual(first)
    const rows = await t.run((ctx) => ctx.db.query('campaignContentShares').take(5))
    expect(rows).toHaveLength(1)
    expect(rows[0]).not.toHaveProperty('document')
    expect(rows[0]).not.toHaveProperty('label')
    for (const caller of [owner.caller, other.caller]) {
      const result = await caller.query(list, pageInput(campaign.id))
      expect(result.page).toHaveLength(1)
      expect(result.page[0]?.document).toMatchObject({
        id: content.id,
        userId: owner.userId,
        systemId: srdSystemRecord.id
      })
      expect(JSON.stringify(result.page[0]?.document)).not.toContain('shitstorm')
    }
    expect(
      await other.caller.query(api.content.details.get, {
        subjectKind: 'BACKGROUND',
        id: content.id,
        view: 'active'
      })
    ).toBeNull()
    const document = { ...content.document, label: 'Current published label' }
    await t.run(async (ctx) => {
      const root = await ctx.db.get(content.rootId)
      if (!root) throw new Error('Missing owned Background fixture.')
      const version = await ctx.db.get(root.currentVersionId)
      if (!version) throw new Error('Missing owned Background version fixture.')
      const checksum = checksumRuleDocument(document)
      await deleteAuthoredVersion(ctx, version)
      const currentVersionId = await insertAuthoredVersion(
        ctx,
        {
          subjectKind: version.subjectKind,
          id: version.id,
          systemId: version.systemId,
          label: document.label,
          checksum,
          contentSourceId: version.contentSourceId,
          versionId: version.versionId,
          version: version.version,
          documentSchemaVersion: version.documentSchemaVersion,
          compilation: version.compilation
        },
        canonicalizeRuleDocument(document)
      )
      await ctx.db.patch(content.rootId, {
        label: document.label,
        checksum,
        currentVersionId
      })
    })
    expect(
      (await other.caller.query(list, pageInput(campaign.id))).page[0]?.document
    ).toMatchObject({ label: document.label })
  })

  it('allows Player shares and Mature text, but immediately removes revoked source and member visibility', async () => {
    const { t, owner, other, campaign, membershipId } = await setup('MATURE')
    const content = await ownedContent(t, other.userId)
    await other.caller.mutation(share, shareInput(campaign.id, content.id))
    expect(
      (await owner.caller.query(list, pageInput(campaign.id))).page[0]?.document
    ).toMatchObject({ label: 'Secret shitstorm' })
    await t.run((ctx) => ctx.db.patch(content.sourceId, { ownerUserId: owner.userId }))
    expect((await owner.caller.query(list, pageInput(campaign.id))).page).toEqual([])
    await t.run((ctx) => ctx.db.patch(content.sourceId, { ownerUserId: other.userId }))
    await t.run((ctx) => ctx.db.patch(membershipId, { status: 'LEFT', leftAt: campaign.createdAt }))
    expect((await owner.caller.query(list, pageInput(campaign.id))).page).toEqual([])
    await expect(other.caller.query(list, pageInput(campaign.id))).rejects.toThrow(
      'Campaign not found'
    )
    await t.run((ctx) => ctx.db.patch(membershipId, { status: 'ACTIVE', leftAt: null }))
    await t.run((ctx) => ctx.db.patch(content.rootId, { ownerUserId: owner.userId }))
    expect((await owner.caller.query(list, pageInput(campaign.id))).page).toEqual([])
    await t.run((ctx) => ctx.db.delete(content.rootId))
    expect((await owner.caller.query(list, pageInput(campaign.id))).page).toEqual([])
  })

  it('rejects anonymous, outsider, wrong-owner, master, inactive, wrong-kind and archived writes without inserting', async () => {
    const { t, owner, other, campaign, membershipId } = await setup()
    const content = await ownedContent(t, owner.userId)
    const input = shareInput(campaign.id, content.id)
    await expect(t.mutation(share, input)).rejects.toThrow('Unauthenticated')
    await expect(t.query(list, pageInput(campaign.id))).rejects.toThrow('Unauthenticated')
    await expect(other.caller.mutation(share, input)).rejects.toThrow('Only active homebrew')
    await expect(owner.caller.mutation(share, shareInput(campaign.id, acolyte.id))).rejects.toThrow(
      'Only active homebrew'
    )
    await expect(owner.caller.mutation(share, { ...input, subjectKind: 'SPELL' })).rejects.toThrow(
      'Only active homebrew'
    )
    const spoofedInput = { ...input, sharedBy: other.userId }
    await expect(owner.caller.mutation(share, spoofedInput)).rejects.toThrow()
    const inactive = { ...content.document, status: 'DRAFT' }
    await t.run(async (ctx) => {
      const root = await ctx.db.get(content.rootId)
      if (!root) throw new Error('Missing owned Background fixture.')
      const version = await ctx.db.get(root.currentVersionId)
      if (!version) throw new Error('Missing owned Background version fixture.')
      const checksum = checksumRuleDocument(inactive)
      await deleteAuthoredVersion(ctx, version)
      const currentVersionId = await insertAuthoredVersion(
        ctx,
        {
          subjectKind: version.subjectKind,
          id: version.id,
          systemId: version.systemId,
          label: version.label,
          checksum,
          contentSourceId: version.contentSourceId,
          versionId: version.versionId,
          version: version.version,
          documentSchemaVersion: version.documentSchemaVersion,
          compilation: version.compilation
        },
        canonicalizeRuleDocument(inactive)
      )
      await ctx.db.patch(content.rootId, { checksum, currentVersionId })
    })
    await expect(owner.caller.mutation(share, input)).rejects.toThrow('Only active homebrew')
    await t.run((ctx) => ctx.db.delete(membershipId))
    await expect(other.caller.query(list, pageInput(campaign.id))).rejects.toThrow(
      'Campaign not found'
    )
    await expect(other.caller.mutation(share, input)).rejects.toThrow('Campaign not found')
    expect(await t.run((ctx) => ctx.db.query('campaignContentShares').take(5))).toEqual([])
    const active = await ownedContent(t, owner.userId)
    await owner.caller.mutation(share, shareInput(campaign.id, active.id))
    await owner.caller.mutation(api.campaigns.archive.archive, {
      campaignId: campaign.id,
      expectedVersion: 0
    })
    expect((await owner.caller.query(list, pageInput(campaign.id))).page).toHaveLength(1)
    await expect(owner.caller.mutation(share, shareInput(campaign.id, active.id))).rejects.toThrow(
      'You cannot share'
    )
  })

  it('continues through an empty filtered page and returns all candidates beyond the per-query read bound', async () => {
    const { t, owner, campaign } = await setup()
    const contents: Awaited<ReturnType<typeof ownedContent>>[] = []
    for (let i = 1; i <= 7; i++) {
      const id = `10000000-0000-4000-8000-${String(i).padStart(12, '0')}`
      const content = await ownedContent(t, owner.userId, id)
      contents.push(content)
      await owner.caller.mutation(share, shareInput(campaign.id, id))
    }
    await t.run((ctx) => ctx.db.delete(contents[0]!.rootId))
    const first = await owner.caller.query(list, pageInput(campaign.id, null, 1))
    expect(first.page).toEqual([])
    expect(first.isDone).toBe(false)
    expect(first.continueCursor).not.toBe('')
    let result = first
    const found: string[] = []
    for (let i = 0; i < 10 && !result.isDone; i++) {
      result = await owner.caller.query(list, pageInput(campaign.id, result.continueCursor, 48))
      found.push(...result.page.map((row) => row.subjectId))
    }
    expect(result.isDone).toBe(true)
    expect(found).toEqual(contents.slice(1).map((content) => content.id))
  })

  it('fails closed for corrupt published data and refuses to replace a different recorded sharer', async () => {
    const { t, owner, other, campaign } = await setup()
    const content = await ownedContent(t, owner.userId)
    const input = shareInput(campaign.id, content.id)
    await owner.caller.mutation(share, input)
    const rowId = await t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaignContentShares')
        .withIndex('by_campaignId_subjectKind_subjectId', (q) =>
          q
            .eq('campaignId', campaign.id)
            .eq('subjectKind', 'BACKGROUND')
            .eq('subjectId', content.id)
        )
        .unique()
      if (!row) throw new Error('Missing share fixture.')
      await ctx.db.patch(row._id, { sharedBy: other.userId })
      return row._id
    })
    await expect(owner.caller.mutation(share, input)).rejects.toThrow('different author')
    expect((await owner.caller.query(list, pageInput(campaign.id))).page).toEqual([])
    await t.run(async (ctx) => {
      await ctx.db.patch(rowId, { sharedBy: owner.userId })
      await corruptPublishedVersionPayload(ctx, content.id)
    })
    await expect(other.caller.query(list, pageInput(campaign.id))).rejects.toThrow(
      'checksum mismatch'
    )
    await expect(owner.caller.mutation(share, input)).rejects.toThrow('checksum mismatch')
  })
})
