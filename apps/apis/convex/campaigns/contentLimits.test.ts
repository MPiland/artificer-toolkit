import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignAttachmentDto,
  CreateCampaignAttachmentInput
} from '@artificer-toolkit/schema/api/campaignAttachments'
import type {
  CampaignNotebookListInput,
  CampaignNotebookListPage,
  CampaignNotebookSectionDto,
  createCampaignNotebookSectionInputSchema,
  updateCampaignNotebookSectionInputSchema
} from '@artificer-toolkit/schema/api/campaignSessions'
import type {
  BeginSceneDefinitionInput,
  SceneDefinitionSaveProgress
} from '@artificer-toolkit/schema/api/sceneDefinitionSave'
import {
  CAMPAIGN_CONTENT_SAFETY_CAPS,
  ENTITLEMENT_LIMITS
} from '@artificer-toolkit/shared/account/entitlements'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api } from '../_generated/api'
import { fixture } from '../../tests/fixtures/characters'
import { readyCampaignFile } from '../../tests/fixtures/campaignFile'
import {
  createSceneDefinitionFixture,
  publishEmptyScene
} from '../../tests/fixtures/sceneDefinitions'
import { assertCampaignContentAllowed } from './contentUsage'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const createNotebook = makeFunctionReference<
  'mutation',
  z.input<typeof createCampaignNotebookSectionInputSchema>,
  CampaignNotebookSectionDto
>('campaigns/notebooks:create')
const updateNotebook = makeFunctionReference<
  'mutation',
  z.input<typeof updateCampaignNotebookSectionInputSchema>,
  CampaignNotebookSectionDto
>('campaigns/notebooks:update')
const removeNotebook = makeFunctionReference<
  'mutation',
  { campaignId: string; sectionId: string },
  { ok: true }
>('campaigns/notebooks:remove')
const listNotebook = makeFunctionReference<
  'query',
  CampaignNotebookListInput,
  CampaignNotebookListPage
>('campaigns/notebooks:list')
const createAttachment = makeFunctionReference<
  'mutation',
  CreateCampaignAttachmentInput,
  CampaignAttachmentDto
>('campaigns/attachments:create')
const beginScene = makeFunctionReference<
  'mutation',
  BeginSceneDefinitionInput,
  SceneDefinitionSaveProgress
>('scenes/definitions:begin')
const publishScene = makeFunctionReference<
  'mutation',
  { saveId: string },
  SceneDefinitionSaveProgress
>('scenes/definitions:publish')

type Base = Awaited<ReturnType<typeof fixture>>
const FREE_ENTRIES = ENTITLEMENT_LIMITS.FREE.campaignEntriesPerCampaign
const FREE_SCENES = ENTITLEMENT_LIMITS.FREE.scenesPerCampaign

async function setup() {
  const base = await fixture()
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Content limits',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  await base.t.run((ctx) =>
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
  return { ...base, campaign }
}

async function setTier(t: Base['t'], userId: string, tier: keyof typeof ENTITLEMENT_LIMITS) {
  await t.run(async (ctx) => {
    const entitlement = await ctx.db
      .query('accountEntitlements')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
    if (entitlement) await ctx.db.patch(entitlement._id, { tier })
    else await ctx.db.insert('accountEntitlements', { userId, tier })
  })
}

async function readUsage(t: Base['t'], campaignId: string) {
  const row = await t.run((ctx) =>
    ctx.db
      .query('campaignContentUsage')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
      .unique()
  )
  return row ? { entries: row.entries, scenes: row.scenes } : null
}

/** Stands in for existing content without inserting hundreds of rows. */
async function seedUsage(
  t: Base['t'],
  campaignId: string,
  usage: { entries?: number; scenes?: number }
) {
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query('campaignContentUsage')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
      .unique()
    const next = {
      entries: usage.entries ?? row?.entries ?? 0,
      scenes: usage.scenes ?? row?.scenes ?? 0
    }
    if (row) await ctx.db.patch(row._id, next)
    else await ctx.db.insert('campaignContentUsage', { campaignId, ...next })
  })
}

const section = (campaignId: string, title = 'Prep') => ({ campaignId, title, content: '' })

describe('per-Campaign content limits (Q18)', () => {
  it('reports the per-Campaign limits in the entitlement projection', async () => {
    const { t, owner } = await setup()
    expect((await owner.caller.query(api.accountEntitlements.get, {})).limits).toMatchObject({
      campaignEntriesPerCampaign: 150,
      scenesPerCampaign: 5
    })
    await setTier(t, owner.userId, 'PRO_GM')
    expect((await owner.caller.query(api.accountEntitlements.get, {})).limits).toMatchObject({
      activeHostedCampaigns: 25,
      campaignEntriesPerCampaign: null,
      scenesPerCampaign: null
    })
  }, 30000)

  it('counts notebook sections and attachments through every insert and cascade delete', async () => {
    const { t, owner, other, campaign } = await setup()
    const note = await owner.caller.mutation(createNotebook, section(campaign.id))
    const file = await readyCampaignFile(t, other.userId, campaign.id)
    await other.caller.mutation(createAttachment, {
      campaignId: campaign.id,
      assetId: file.id,
      displayName: 'Handout',
      noteSectionId: note.id
    })
    expect(await readUsage(t, campaign.id)).toEqual({ entries: 2, scenes: 0 })
    await owner.caller.mutation(removeNotebook, { campaignId: campaign.id, sectionId: note.id })
    expect(await readUsage(t, campaign.id)).toBeNull()
  }, 30000)

  it('refuses a notebook section over the Free limit and allows it exactly at the limit', async () => {
    const { t, owner, campaign } = await setup()
    await seedUsage(t, campaign.id, { entries: FREE_ENTRIES - 1 })
    await expect(
      owner.caller.mutation(createNotebook, section(campaign.id))
    ).resolves.toMatchObject({ title: 'Prep' })
    expect(await readUsage(t, campaign.id)).toEqual({ entries: FREE_ENTRIES, scenes: 0 })
    await expect(owner.caller.mutation(createNotebook, section(campaign.id))).rejects.toThrow(
      'This Campaign has reached its campaignEntriesPerCampaign limit.'
    )
    expect(await readUsage(t, campaign.id)).toEqual({ entries: FREE_ENTRIES, scenes: 0 })
  }, 30000)

  it('applies the hosting owner tier to member attachments, not the member tier', async () => {
    const { t, owner, other, campaign } = await setup()
    await seedUsage(t, campaign.id, { entries: FREE_ENTRIES })
    await setTier(t, other.userId, 'PRO_GM')
    const file = await readyCampaignFile(t, other.userId, campaign.id)
    const attach = () =>
      other.caller.mutation(createAttachment, {
        campaignId: campaign.id,
        assetId: file.id,
        displayName: 'Map'
      })
    await expect(attach()).rejects.toThrow('campaignEntriesPerCampaign limit')
    await setTier(t, owner.userId, 'GM')
    await setTier(t, other.userId, 'FREE')
    await expect(attach()).resolves.toMatchObject({ displayName: 'Map' })
    expect(await readUsage(t, campaign.id)).toEqual({ entries: FREE_ENTRIES + 1, scenes: 0 })
  }, 30000)

  it('keeps over-limit content readable and editable after a downgrade while refusing new entries', async () => {
    const { t, owner, other, campaign } = await setup()
    await setTier(t, owner.userId, 'GM')
    const kept = await owner.caller.mutation(createNotebook, {
      ...section(campaign.id, 'Shared lore'),
      visibility: 'SHARED'
    })
    await seedUsage(t, campaign.id, { entries: FREE_ENTRIES + 50 })
    await setTier(t, owner.userId, 'FREE')
    await expect(owner.caller.mutation(createNotebook, section(campaign.id))).rejects.toThrow(
      'campaignEntriesPerCampaign limit'
    )
    const page = await other.caller.query(listNotebook, {
      campaignId: campaign.id,
      paginationOpts: { cursor: null, numItems: 8 }
    })
    expect(page.page.map((row) => row.id)).toEqual([kept.id])
    await expect(
      owner.caller.mutation(updateNotebook, {
        campaignId: campaign.id,
        sectionId: kept.id,
        expectedVersion: kept.version,
        title: 'Shared lore, revised'
      })
    ).resolves.toMatchObject({ title: 'Shared lore, revised' })
    expect(await readUsage(t, campaign.id)).toEqual({ entries: FREE_ENTRIES + 50, scenes: 0 })
  }, 30000)

  it('enforces the hidden safety cap for unlimited tiers and counts multi-row copies', async () => {
    const { t, owner, campaign } = await setup()
    await setTier(t, owner.userId, 'PRO_GM')
    await seedUsage(t, campaign.id, {
      entries: CAMPAIGN_CONTENT_SAFETY_CAPS.campaignEntriesPerCampaign
    })
    await expect(owner.caller.mutation(createNotebook, section(campaign.id))).rejects.toThrow(
      'campaignEntriesPerCampaign limit'
    )
    const staged = { id: crypto.randomUUID(), ownerUserId: owner.userId }
    await setTier(t, owner.userId, 'FREE')
    await t.run((ctx) =>
      assertCampaignContentAllowed(ctx.db, staged, 'campaignEntriesPerCampaign', FREE_ENTRIES)
    )
    await expect(
      t.run((ctx) =>
        assertCampaignContentAllowed(ctx.db, staged, 'campaignEntriesPerCampaign', FREE_ENTRIES + 1)
      )
    ).rejects.toThrow('campaignEntriesPerCampaign limit')
  }, 30000)

  it('counts published Scenes and refuses a new Scene at begin and publish once the limit is reached', async () => {
    const base = await createSceneDefinitionFixture()
    const { t, owner, campaign, input } = base
    await seedUsage(t, campaign.id, { scenes: FREE_SCENES - 1 })
    await publishEmptyScene(base)
    expect(await readUsage(t, campaign.id)).toEqual({ entries: 0, scenes: FREE_SCENES })
    await expect(
      owner.caller.mutation(beginScene, { ...input, commandId: crypto.randomUUID() })
    ).rejects.toThrow('This Campaign has reached its scenesPerCampaign limit.')

    await seedUsage(t, campaign.id, { scenes: FREE_SCENES - 1 })
    const save = await owner.caller.mutation(beginScene, {
      ...input,
      commandId: crypto.randomUUID()
    })
    await seedUsage(t, campaign.id, { scenes: FREE_SCENES })
    await expect(owner.caller.mutation(publishScene, { saveId: save.saveId })).rejects.toThrow(
      'scenesPerCampaign limit'
    )
    await setTier(t, owner.userId, 'GM')
    await expect(
      owner.caller.mutation(publishScene, { saveId: save.saveId })
    ).resolves.toMatchObject({ status: 'PUBLISHED' })
    expect(await readUsage(t, campaign.id)).toEqual({ entries: 0, scenes: FREE_SCENES + 1 })
  }, 30000)
})
