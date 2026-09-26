import { makeFunctionReference } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignAttachmentDto,
  CampaignAttachmentListInput,
  CampaignAttachmentListPage,
  CreateCampaignAttachmentInput
} from '@artificer-toolkit/schema/api/campaignAttachments'
import type {
  CampaignNotebookSectionDto,
  CampaignSessionDto,
  createCampaignNotebookSectionInputSchema,
  createCampaignSessionInputSchema
} from '@artificer-toolkit/schema/api/campaignSessions'
import type { CampaignFileDeliverySource } from '@artificer-toolkit/schema/projections/campaignFilePersistence'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { internal } from '../_generated/api'
import { fixture } from '../../tests/fixtures/characters'
import { readyCampaignFile } from '../../tests/fixtures/campaignFile'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const create = makeFunctionReference<
  'mutation',
  CreateCampaignAttachmentInput,
  CampaignAttachmentDto
>('campaigns/attachments:create')
const list = makeFunctionReference<
  'query',
  CampaignAttachmentListInput,
  CampaignAttachmentListPage
>('campaigns/attachments:list')
const remove = makeFunctionReference<
  'mutation',
  { campaignId: string; attachmentId: string },
  { ok: true }
>('campaigns/attachments:remove')
const createNotebook = makeFunctionReference<
  'mutation',
  z.input<typeof createCampaignNotebookSectionInputSchema>,
  CampaignNotebookSectionDto
>('campaigns/notebooks:create')
const removeNotebook = makeFunctionReference<
  'mutation',
  { campaignId: string; sectionId: string },
  { ok: true }
>('campaigns/notebooks:remove')
const createSession = makeFunctionReference<
  'mutation',
  z.input<typeof createCampaignSessionInputSchema>,
  CampaignSessionDto
>('campaigns/sessions:create')
const archive = makeFunctionReference<
  'mutation',
  { campaignId: string; expectedVersion: number },
  CampaignDetailDto
>('campaigns/archive:archive')
const readDelivery = makeFunctionReference<
  'query',
  { campaignId: string; attachmentId: string },
  CampaignFileDeliverySource
>('campaigns/attachments:readDelivery')

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

async function setup() {
  const base = await fixture()
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Campaign files',
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
  return { ...base, campaign, membershipId }
}

const pageInput = (
  campaignId: string,
  cursor: string | null = null
): CampaignAttachmentListInput => ({
  campaignId,
  paginationOpts: { cursor, numItems: 2 }
})

describe('native Campaign attachments', () => {
  it('preserves member uploads, associations, exact metadata and archived reads with bounded ordering', async () => {
    const { t, owner, other, campaign, membershipId } = await setup()
    const note = await owner.caller.mutation(createNotebook, {
      campaignId: campaign.id,
      title: 'Private preparation',
      content: ''
    })
    const session = await owner.caller.mutation(createSession, { campaignId: campaign.id })
    const file = await readyCampaignFile(t, other.userId, campaign.id)
    const handout = await readyCampaignFile(t, owner.userId, campaign.id, 'CAMPAIGN_HANDOUT_MAP')
    const attachments: CampaignAttachmentDto[] = []
    for (let index = 0; index < 5; index++) {
      attachments.push(
        await other.caller.mutation(create, {
          campaignId: campaign.id.toUpperCase(),
          assetId: file.id.toUpperCase(),
          displayName: `File ${index}`,
          description: 'Original shitstorm',
          sessionId: session.id.toUpperCase(),
          noteSectionId: note.id.toUpperCase()
        })
      )
    }
    attachments.push(
      await owner.caller.mutation(create, {
        campaignId: campaign.id,
        assetId: handout.id,
        displayName: 'Handout'
      })
    )
    expect(attachments[0]).toMatchObject({
      campaignId: campaign.id,
      assetId: file.id,
      uploaderUserId: other.userId,
      sessionId: session.id,
      noteSectionId: note.id,
      description: 'Original shitstorm',
      profile: 'CAMPAIGN_FILE'
    })
    const read: CampaignAttachmentDto[] = []
    let cursor: string | null = null
    for (let pageNumber = 0; pageNumber < 10; pageNumber++) {
      const page: CampaignAttachmentListPage = await other.caller.query(
        list,
        pageInput(campaign.id, cursor)
      )
      expect(page.page.length).toBeLessThanOrEqual(2)
      read.push(...page.page)
      if (page.isDone) break
      cursor = page.continueCursor
      if (pageNumber === 9) throw new Error('Attachment pagination did not terminate.')
    }
    expect(read).toEqual(
      attachments.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    )
    expect(JSON.stringify(read)).not.toMatch(
      /objectKey|rawObjectKey|ownerUserId|Private preparation|_creationTime|"_id"/
    )
    const deliveryInput = {
      campaignId: campaign.id.toUpperCase(),
      attachmentId: attachments
        .find((attachment) => attachment.assetId === file.id)!
        .id.toUpperCase()
    }
    const source = await other.caller.query(readDelivery, deliveryInput)
    expect(source).toEqual({
      assetId: file.id,
      objectKey: file.variants[0]!.objectKey,
      mimeType: 'text/plain',
      byteSize: 12,
      fileName: 'notes.txt'
    })
    expect(await owner.caller.query(readDelivery, deliveryInput)).toEqual(source)
    expect(
      await other.caller.query(readDelivery, {
        campaignId: campaign.id,
        attachmentId: attachments.find((attachment) => attachment.assetId === handout.id)!.id
      })
    ).toMatchObject({ assetId: handout.id, fileName: 'handout.png', mimeType: 'image/webp' })
    await owner.caller.mutation(archive, {
      campaignId: campaign.id,
      expectedVersion: campaign.version
    })
    expect((await other.caller.query(list, pageInput(campaign.id))).page).toEqual(read.slice(0, 2))
    expect(await other.caller.query(readDelivery, deliveryInput)).toEqual(source)
    await expect(
      other.caller.mutation(create, {
        campaignId: campaign.id,
        assetId: file.id,
        displayName: 'Archived'
      })
    ).rejects.toThrow('read-only')
    await expect(
      owner.caller.mutation(remove, { campaignId: campaign.id, attachmentId: read[0]!.id })
    ).rejects.toThrow('read-only')
    await t.run((ctx) =>
      ctx.db.patch(membershipId, { status: 'LEFT', leftAt: new Date().toISOString() })
    )
    await expect(other.caller.query(list, pageInput(campaign.id))).rejects.toThrow(
      'Campaign not found'
    )
    await expect(t.query(list, pageInput(campaign.id))).rejects.toThrow()
    await expect(other.caller.query(readDelivery, deliveryInput)).rejects.toThrow(
      'Campaign not found'
    )
    await expect(t.query(readDelivery, deliveryInput)).rejects.toThrow('Unauthenticated')
  })

  it('denies foreign, unready and wrong-profile assets and cross-Campaign associations without writes', async () => {
    const { t, owner, other, campaign } = await setup()
    const foreignCampaign = await other.caller.mutation(createCampaign, {
      name: 'Elsewhere',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    const foreignNote = await other.caller.mutation(createNotebook, {
      campaignId: foreignCampaign.id,
      title: 'Other note',
      content: ''
    })
    const foreignSession = await other.caller.mutation(createSession, {
      campaignId: foreignCampaign.id
    })
    const ownFile = await readyCampaignFile(t, owner.userId, campaign.id)
    const wrongCampaign = await readyCampaignFile(t, owner.userId, foreignCampaign.id)
    const otherFile = await readyCampaignFile(t, other.userId, campaign.id)
    const pending = await readyCampaignFile(t, owner.userId, campaign.id)
    await t.run((ctx) => ctx.db.patch(pending.rowId, { status: 'PENDING_UPLOAD' }))
    const avatarId = await t.run(async (ctx) => {
      const id = crypto.randomUUID()
      await ctx.db.insert('mediaAssets', {
        id,
        ownerUserId: owner.userId,
        profile: 'ACCOUNT_AVATAR',
        status: 'READY',
        upload: {
          originalFileName: 'avatar.png',
          declaredMimeType: 'image/png',
          declaredBytes: 12,
          idempotencyKey: crypto.randomUUID()
        },
        rawObjectKey: null,
        uploadExpiresAt: 0,
        chargedBytes: 0,
        variants: [],
        crop: null,
        operation: null,
        cleanupAt: null
      })
      return id
    })
    const before = await t.run((ctx) => ctx.db.query('mediaAssets').collect())
    for (const input of [
      { assetId: otherFile.id },
      { assetId: wrongCampaign.id },
      { assetId: pending.id },
      { assetId: avatarId },
      { assetId: ownFile.id, sessionId: foreignSession.id },
      { assetId: ownFile.id, noteSectionId: foreignNote.id },
      { assetId: ownFile.id, noteSectionId: crypto.randomUUID() }
    ]) {
      await expect(
        owner.caller.mutation(create, { campaignId: campaign.id, displayName: 'Denied', ...input })
      ).rejects.toThrow('unavailable')
    }
    await expect(
      owner.caller.mutation(create, {
        campaignId: campaign.id,
        assetId: ownFile.id,
        displayName: ' '
      })
    ).rejects.toThrow()
    expect(await t.run((ctx) => ctx.db.query('campaignAttachments').collect())).toEqual([])
    expect(await t.run((ctx) => ctx.db.query('mediaAssets').collect())).toEqual(before)
    const ownUpload = await other.caller.mutation(create, {
      campaignId: campaign.id,
      assetId: otherFile.id,
      displayName: 'My file'
    })
    await expect(
      other.caller.query(readDelivery, {
        campaignId: foreignCampaign.id,
        attachmentId: ownUpload.id
      })
    ).rejects.toThrow('not found')
    await expect(
      other.caller.mutation(remove, { campaignId: foreignCampaign.id, attachmentId: ownUpload.id })
    ).rejects.toThrow('not found')
    expect(
      await other.caller.mutation(remove, { campaignId: campaign.id, attachmentId: ownUpload.id })
    ).toEqual({ ok: true })
  })

  it('removes a retained attachment after its storage ownership transfers', async () => {
    const { t, owner, other, campaign } = await setup()
    const file = await readyCampaignFile(t, other.userId, campaign.id)
    const attachment = await other.caller.mutation(create, {
      campaignId: campaign.id,
      assetId: file.id,
      displayName: 'Retained upload'
    })
    await t.run((ctx) =>
      ctx.db.patch(file.rowId, {
        ownerUserId: owner.userId,
        retainedFromUserId: other.userId
      })
    )

    await expect(
      owner.caller.mutation(remove, { campaignId: campaign.id, attachmentId: attachment.id })
    ).resolves.toEqual({ ok: true })
    expect(await t.run((ctx) => ctx.db.query('campaignAttachments').collect())).toEqual([])
  })

  it('restricts deletion and protects shared references through rollback, reattachment and quota cleanup', async () => {
    const { t, owner, other, campaign } = await setup()
    const file = await readyCampaignFile(t, owner.userId, campaign.id)
    const input = { campaignId: campaign.id, assetId: file.id, displayName: 'Keep bytes' }
    const first = await owner.caller.mutation(create, input)
    const second = await owner.caller.mutation(create, input)
    const snapshot = () =>
      t.run(async (ctx) => ({
        attachments: await ctx.db.query('campaignAttachments').collect(),
        asset: await ctx.db.get(file.rowId),
        scheduled: await ctx.db.system.query('_scheduled_functions').collect()
      }))
    const before = await snapshot()
    await expect(
      other.caller.mutation(remove, { campaignId: campaign.id, attachmentId: first.id })
    ).rejects.toThrow('unavailable')
    await expect(
      owner.caller.mutation(async (ctx) => {
        await ctx.runMutation(remove, { campaignId: campaign.id, attachmentId: first.id })
        await ctx.runMutation(remove, { campaignId: campaign.id, attachmentId: second.id })
        expect((await ctx.db.get(file.rowId))?.cleanupAt).not.toBeNull()
        throw new Error('Injected attachment rollback')
      })
    ).rejects.toThrow('Injected attachment rollback')
    expect(await snapshot()).toEqual(before)
    await owner.caller.mutation(remove, {
      campaignId: campaign.id,
      attachmentId: first.id.toUpperCase()
    })
    expect((await snapshot()).asset?.cleanupAt).toBeNull()
    await expect(
      other.caller.query(readDelivery, { campaignId: campaign.id, attachmentId: first.id })
    ).rejects.toThrow('not found')
    expect(
      await other.caller.query(readDelivery, { campaignId: campaign.id, attachmentId: second.id })
    ).toMatchObject({ assetId: file.id })
    await owner.caller.mutation(remove, { campaignId: campaign.id, attachmentId: second.id })
    const detached = (await snapshot()).asset!
    await expect(
      owner.caller.query(readDelivery, { campaignId: campaign.id, attachmentId: second.id })
    ).rejects.toThrow('not found')
    expect(detached.cleanupAt).toBeGreaterThan(Date.now() + 86_399_000)
    const reattached = await owner.caller.mutation(create, input)
    expect((await snapshot()).asset?.cleanupAt).toBeNull()
    // A stale cleanup still rechecks current references, independently of cleanupAt.
    await t.run((ctx) => ctx.db.patch(file.rowId, { cleanupAt: 1 }))
    await t.mutation(internal.media.assets.cleanup, { assetId: file.id })
    expect((await snapshot()).asset?.status).toBe('READY')
    await owner.caller.mutation(remove, { campaignId: campaign.id, attachmentId: reattached.id })
    const deadline = (await snapshot()).asset!.cleanupAt!
    vi.useFakeTimers()
    vi.setSystemTime(deadline + 1)
    await t.mutation(internal.media.assets.cleanup, { assetId: file.id })
    expect((await snapshot()).asset).toMatchObject({
      status: 'DELETED',
      chargedBytes: 0,
      variants: [],
      cleanupAt: null
    })
    await t.mutation(internal.media.assets.cleanup, { assetId: file.id })
    const profile = await t.run((ctx) =>
      ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', owner.userId))
        .unique()
    )
    expect(profile?.mediaBytes).toBe(0)
  })

  it('fails closed on unavailable or inconsistent attached asset records without selecting raw or preview bytes', async () => {
    const { t, owner, other, campaign } = await setup()
    const file = await readyCampaignFile(t, owner.userId, campaign.id)
    const attachment = await owner.caller.mutation(create, {
      campaignId: campaign.id,
      assetId: file.id,
      displayName: 'Bound source'
    })
    const input = { campaignId: campaign.id, attachmentId: attachment.id }
    const original = await t.run((ctx) => ctx.db.get(file.rowId))
    if (!original) throw new Error('Missing fixture asset.')
    const { _id, _creationTime, ...stored } = original
    for (const patch of [
      { status: 'PENDING_UPLOAD' as const },
      { status: 'PROCESSING' as const },
      { status: 'REJECTED' as const },
      { status: 'DELETED' as const },
      { variants: [] },
      { campaignId: crypto.randomUUID() },
      { ownerUserId: other.userId },
      { profile: 'CAMPAIGN_HANDOUT_MAP' as const }
    ]) {
      await t.run((ctx) => ctx.db.patch(file.rowId, patch))
      await expect(other.caller.query(readDelivery, input)).rejects.toThrow()
      await t.run((ctx) => ctx.db.replace(file.rowId, stored))
    }
    await expect(
      other.caller.query(readDelivery, { ...input, attachmentId: file.id })
    ).rejects.toThrow('not found')
    await t.run((ctx) => ctx.db.delete(file.rowId))
    await expect(other.caller.query(readDelivery, input)).rejects.toThrow('unavailable')
  })

  it('cascades every notebook attachment atomically while retaining other notebook references', async () => {
    const { t, owner, other, campaign } = await setup()
    const note = await owner.caller.mutation(createNotebook, {
      campaignId: campaign.id,
      title: 'Remove',
      content: ''
    })
    const keepNote = await owner.caller.mutation(createNotebook, {
      campaignId: campaign.id,
      title: 'Keep',
      content: ''
    })
    const file = await readyCampaignFile(t, other.userId, campaign.id)
    const input = { campaignId: campaign.id, assetId: file.id, displayName: 'Player file' }
    for (let index = 0; index < 51; index++)
      await other.caller.mutation(create, { ...input, noteSectionId: note.id })
    const retained = await other.caller.mutation(create, { ...input, noteSectionId: keepNote.id })
    const read = () =>
      t.run(async (ctx) => ({
        notes: await ctx.db.query('campaignNotebookSections').collect(),
        attachments: await ctx.db.query('campaignAttachments').collect(),
        asset: await ctx.db.get(file.rowId),
        scheduled: await ctx.db.system.query('_scheduled_functions').collect()
      }))
    const before = await read()
    await expect(
      owner.caller.mutation(async (ctx) => {
        await ctx.runMutation(removeNotebook, { campaignId: campaign.id, sectionId: note.id })
        expect(await ctx.db.query('campaignAttachments').collect()).toHaveLength(1)
        throw new Error('Injected notebook attachment rollback')
      })
    ).rejects.toThrow('Injected notebook attachment rollback')
    expect(await read()).toEqual(before)
    await owner.caller.mutation(removeNotebook, { campaignId: campaign.id, sectionId: note.id })
    const after = await read()
    // Stored rows omit the uploader label that reads resolve.
    const { uploaderLabel: _retainedLabel, ...retainedRow } = retained
    expect(after.attachments.map(({ _id, _creationTime, ...row }) => row)).toEqual([retainedRow])
    expect(after.notes).toEqual(before.notes.filter((row) => row.id !== note.id))
    expect(after.asset?.cleanupAt).toBeNull()
    // The GM can remove another uploader's surviving attachment.
    await owner.caller.mutation(remove, { campaignId: campaign.id, attachmentId: retained.id })
    expect((await read()).asset?.cleanupAt).toBeGreaterThan(Date.now())
  })

  it('purges deleted-account attachment references in bounded batches before retiring asset keys', async () => {
    const { t, owner, other, campaign } = await setup()
    const file = await readyCampaignFile(t, other.userId, campaign.id)
    const keepFile = await readyCampaignFile(t, owner.userId, campaign.id)
    for (let index = 0; index < 35; index++)
      await other.caller.mutation(create, {
        campaignId: campaign.id,
        assetId: file.id,
        displayName: 'Account file'
      })
    const keep = await owner.caller.mutation(create, {
      campaignId: campaign.id,
      assetId: keepFile.id,
      displayName: 'Survivor'
    })
    await t.mutation(internal.media.assets.purgeAccount, { userId: other.userId })
    expect(await t.run((ctx) => ctx.db.query('campaignAttachments').collect())).toHaveLength(36)
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', other.userId))
        .unique()
      await ctx.db.delete(profile!._id)
    })
    await t.mutation(internal.media.assets.purgeAccount, { userId: other.userId })
    expect(await t.run((ctx) => ctx.db.query('campaignAttachments').collect())).toHaveLength(4)
    expect(await t.run((ctx) => ctx.db.get(file.rowId))).not.toBeNull()
    await t.mutation(internal.media.assets.purgeAccount, { userId: other.userId })
    expect(await t.run((ctx) => ctx.db.get(file.rowId))).toBeNull()
    expect(await t.run((ctx) => ctx.db.get(keepFile.rowId))).not.toBeNull()
    const { uploaderLabel: _keepLabel, ...keepRow } = keep
    expect(await t.run((ctx) => ctx.db.query('campaignAttachments').collect())).toMatchObject([
      keepRow
    ])
    const scheduled = await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())
    expect(
      scheduled.some((job) => JSON.stringify(job.args).includes(file.variants[0]!.objectKey))
    ).toBe(true)
  })
})
