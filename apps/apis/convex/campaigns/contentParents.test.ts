import { describe, expect, it, vi } from 'vitest'
import { makeFunctionReference } from 'convex/server'
import type {
  CampaignContentRemovalReceiptDto,
  CampaignDetailDto,
  UpdateCampaignInput,
  UnshareCampaignContentInput
} from '@artificer-toolkit/schema/api/campaignCore'
import {
  campaignStoredPartyInventorySchema,
  campaignStoredPartyItemSchema
} from '@artificer-toolkit/schema/projections/campaignInventoryPersistence'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { championMartialArchetype } from '@artificer-toolkit/source-data/srd/classes/champion.js'
import { elf, highElf } from '@artificer-toolkit/source-data/srd/races/elf.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { clubPlus1 } from '@artificer-toolkit/source-data/srd/equipment/club-plus-1.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { readAcquiredEquipmentRules } from '@artificer-toolkit/rules-runtime/character/acquiredEquipmentRules'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { fixture } from '../../tests/fixtures/characters'
import { importedSubject } from '../../tests/fixtures/publication'
import { api, internal } from '../_generated/api'
import { parsePublicationDocument } from '../content/publicationDocument'
import { requireDefaultUserContentSource } from '../content/sources'
import { readPartyEquipmentSource } from './partyInventoryDocuments'

const families = [
  { kind: 'CLASS', parent: fighter, child: championMartialArchetype, field: 'parentClassId' },
  { kind: 'RACE', parent: elf, child: highElf, field: 'parentRaceId' },
  { kind: 'EQUIPMENT', parent: club, child: clubPlus1, field: 'parentEquipmentId' }
] as const

const unshare = makeFunctionReference<
  'mutation',
  UnshareCampaignContentInput,
  CampaignContentRemovalReceiptDto
>('campaigns/contentShares:unshare')
const updateCampaign = makeFunctionReference<'mutation', UpdateCampaignInput, CampaignDetailDto>(
  'campaigns/update:update'
)

async function setup() {
  const base = await fixture()
  const campaign = await base.owner.caller.mutation(api.campaigns.create.create, {
    name: 'Parent sharing',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  async function store(kind: (typeof families)[number]['kind'], input: unknown) {
    const publication = parsePublicationDocument(kind, input)
    const { document } = publication
    await base.t.run(async (ctx) => {
      const contentSourceId = await requireDefaultUserContentSource(
        ctx,
        document.systemId,
        base.owner.userId
      )
      const metadata = {
        id: document.id,
        systemId: document.systemId,
        label: document.label,
        subjectKind: kind,
        checksum: checksumRuleDocument(document),
        contentSourceId
      }
      const publicVersionId = crypto.randomUUID()
      const currentVersionId = await ctx.db.insert('authoredVersions', {
        ...metadata,
        versionId: publicVersionId,
        version: 1,
        documentSchemaVersion: 1,
        documentJson: JSON.stringify(document)
      })
      await ctx.db.insert('authoredRoots', {
        ...metadata,
        ownerUserId: base.owner.userId,
        currentVersionId,
        currentVersionPublicId: publicVersionId,
        parentClassId:
          publication.subjectKind === 'CLASS' && publication.document.category === 'SUBCLASS'
            ? publication.document.parentClassId
            : null,
        parentRaceId:
          publication.subjectKind === 'RACE' && publication.document.category === 'SUBRACE'
            ? publication.document.parentRaceId
            : null,
        parentEquipmentId:
          publication.subjectKind === 'EQUIPMENT' && publication.document.category === 'VARIANT'
            ? publication.document.parentEquipmentId
            : null
      })
    })
    return document.id
  }
  return { ...base, campaign, store }
}

describe('Campaign shared child parent prerequisites', () => {
  it.each(families)(
    'rejects disabling the official parent source of a shared $kind child',
    async ({ kind, parent, child, field }) => {
      const { t, owner, campaign, store } = await setup()
      await t.mutation(internal.content.import.importSubjects, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects: [importedSubject({ subjectKind: kind, ...parent, document: parent })]
      })
      const subjectId = await store(kind, {
        ...child,
        id: crypto.randomUUID(),
        userId: owner.userId,
        status: 'ACTIVE',
        [field]: parent.id
      })
      await owner.caller.mutation(api.campaigns.contentShares.share, {
        campaignId: campaign.id,
        subjectKind: kind,
        subjectId
      })
      const catalogueId = crypto.randomUUID()
      await t.run(async (ctx) => {
        const contentSourceId = crypto.randomUUID()
        await ctx.db.insert('contentSources', { ...SRD_CONTENT_SOURCE, id: contentSourceId })
        await ctx.db.insert('rulesCatalogues', {
          ...SRD_RULES_CATALOGUE,
          id: catalogueId,
          contentSourceIds: [contentSourceId]
        })
      })
      const snapshot = () =>
        t.run(async (ctx) => ({
          campaigns: await ctx.db.query('campaigns').collect(),
          shares: await ctx.db.query('campaignContentShares').collect()
        }))
      const before = await snapshot()
      await expect(
        owner.caller.mutation(updateCampaign, {
          campaignId: campaign.id,
          expectedVersion: campaign.version,
          primaryRulesCatalogueId: catalogueId
        })
      ).rejects.toThrow(`shared ${kind} ${subjectId}`)
      expect(await snapshot()).toEqual(before)
    }
  )

  it('cascades unshare through every shared Equipment descendant', async () => {
    const { t, owner, campaign, store } = await setup()
    const base = await store('EQUIPMENT', {
      ...club,
      id: crypto.randomUUID(),
      userId: owner.userId,
      status: 'ACTIVE'
    })
    const child = await store('EQUIPMENT', {
      ...clubPlus1,
      id: crypto.randomUUID(),
      userId: owner.userId,
      status: 'ACTIVE',
      parentEquipmentId: base
    })
    const grandchild = await store('EQUIPMENT', {
      ...clubPlus1,
      id: crypto.randomUUID(),
      userId: owner.userId,
      status: 'ACTIVE',
      parentEquipmentId: child
    })
    for (const subjectId of [base, child, grandchild])
      await owner.caller.mutation(api.campaigns.contentShares.share, {
        campaignId: campaign.id,
        subjectKind: 'EQUIPMENT',
        subjectId
      })
    const receipt = await owner.caller.mutation(unshare, {
      campaignId: campaign.id,
      subjectKind: 'EQUIPMENT',
      subjectId: base,
      sharedBy: owner.userId,
      expectedCampaignVersion: campaign.version,
      commandId: crypto.randomUUID()
    })
    expect(receipt.removedShares).toEqual(
      [base, child, grandchild]
        .sort()
        .map((subjectId) => ({ subjectKind: 'EQUIPMENT', subjectId, sharedBy: owner.userId }))
    )
    expect(await t.run((ctx) => ctx.db.query('campaignContentShares').collect())).toEqual([])
  })

  it('retains held Equipment mechanics when direct and dependent shares are removed', async () => {
    const { t, owner, campaign, store } = await setup()
    const base = await store('EQUIPMENT', {
      ...club,
      id: crypto.randomUUID(),
      userId: owner.userId,
      status: 'ACTIVE'
    })
    const child = await store('EQUIPMENT', {
      ...clubPlus1,
      id: crypto.randomUUID(),
      userId: owner.userId,
      status: 'ACTIVE',
      parentEquipmentId: base
    })
    for (const subjectId of [base, child])
      await owner.caller.mutation(api.campaigns.contentShares.share, {
        campaignId: campaign.id,
        subjectKind: 'EQUIPMENT',
        subjectId
      })
    const itemId = crypto.randomUUID()
    await t.run(async (ctx) => {
      await ctx.db.insert(
        'campaignPartyInventories',
        campaignStoredPartyInventorySchema.parse({ campaignId: campaign.id, version: 1 })
      )
      await ctx.db.insert(
        'campaignPartyItems',
        campaignStoredPartyItemSchema.parse({
          campaignId: campaign.id,
          id: itemId,
          equipmentId: child,
          quantity: 1,
          containerId: null
        })
      )
    })
    const receipt = await owner.caller.mutation(unshare, {
      campaignId: campaign.id,
      subjectKind: 'EQUIPMENT',
      subjectId: base,
      sharedBy: owner.userId,
      expectedCampaignVersion: campaign.version,
      commandId: crypto.randomUUID()
    })
    expect(receipt.removedShares).toEqual(
      [base, child]
        .sort()
        .map((subjectId) => ({ subjectKind: 'EQUIPMENT', subjectId, sharedBy: owner.userId }))
    )
    const after = await t.run(async (ctx) => ({
      shares: await ctx.db.query('campaignContentShares').collect(),
      items: await ctx.db.query('campaignPartyItems').collect(),
      inventories: await ctx.db.query('campaignPartyInventories').collect()
    }))
    expect(after.shares).toEqual([])
    expect(after.items).toHaveLength(1)
    const item = after.items[0]
    if (!item?.retainedRulesJson) throw new Error('Missing retained Campaign Equipment rules.')
    expect(item).toMatchObject({ campaignId: campaign.id, id: itemId, equipmentId: child })
    const retained = readAcquiredEquipmentRules(item.retainedRulesJson, child, srdSystemRecord.id)
    expect(retained.equipment.id).toBe(child)
    expect(new Set(retained.sources.map((source) => source.subjectId))).toEqual(
      new Set([base, child])
    )
    expect(after.inventories).toHaveLength(1)
    expect(after.inventories[0]).toMatchObject({ campaignId: campaign.id, version: 2 })

    // A fresh module graph has an empty memo: the cold parse and every warm hit agree.
    vi.resetModules()
    const fresh =
      await import('@artificer-toolkit/rules-runtime/character/acquiredEquipmentRules')
    const { acquiredEquipmentRulesSchema } =
      await import('@artificer-toolkit/schema/projections/acquiredEquipmentRules')
    const parse = vi.spyOn(acquiredEquipmentRulesSchema, 'parse')
    const cold = fresh.readAcquiredEquipmentRules(item.retainedRulesJson, child, srdSystemRecord.id)
    const warm = fresh.readAcquiredEquipmentRules(item.retainedRulesJson, child, srdSystemRecord.id)
    expect(parse).toHaveBeenCalledTimes(1)
    parse.mockRestore()
    expect(warm).toEqual(cold)
    expect(cold).toEqual(retained)
    expect(() =>
      fresh.readAcquiredEquipmentRules(item.retainedRulesJson, base, srdSystemRecord.id)
    ).toThrow('Acquired Equipment scope mismatch.')
  })
  it('parses published Equipment once per document and serves identical warm reads', async () => {
    const { t, campaign } = await setup()
    // A fresh id makes the document string new to the memo, so the first read is cold.
    const equipmentId = crypto.randomUUID()
    await t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [
        importedSubject({
          subjectKind: 'EQUIPMENT',
          ...club,
          id: equipmentId,
          document: { ...club, id: equipmentId }
        })
      ]
    })
    const parse = vi.spyOn(equipmentAuthoredDtoSchema, 'parse')
    const read = () =>
      t.run(async (ctx) => {
        const stored = await ctx.db
          .query('campaigns')
          .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
          .unique()
        if (!stored) throw new Error('Missing Campaign.')
        return (await readPartyEquipmentSource(ctx, stored, equipmentId))?.document
      })
    const cold = await read()
    expect(parse).toHaveBeenCalledTimes(1)
    const warm = await read()
    expect(parse).toHaveBeenCalledTimes(1)
    parse.mockRestore()
    expect(cold?.id).toBe(equipmentId)
    expect(warm).toEqual(cold)
  })
  it('does not treat Equipment held by another Campaign as local custody', async () => {
    const { t, owner, other, campaign, store } = await setup()
    const equipmentId = await store('EQUIPMENT', {
      ...club,
      id: crypto.randomUUID(),
      userId: owner.userId,
      status: 'ACTIVE'
    })
    await owner.caller.mutation(api.campaigns.contentShares.share, {
      campaignId: campaign.id,
      subjectKind: 'EQUIPMENT',
      subjectId: equipmentId
    })
    const foreignCampaign = await other.caller.mutation(api.campaigns.create.create, {
      name: 'Foreign custody',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    await t.run(async (ctx) => {
      await ctx.db.insert(
        'campaignPartyInventories',
        campaignStoredPartyInventorySchema.parse({ campaignId: foreignCampaign.id, version: 1 })
      )
      await ctx.db.insert(
        'campaignPartyItems',
        campaignStoredPartyItemSchema.parse({
          campaignId: foreignCampaign.id,
          id: crypto.randomUUID(),
          equipmentId,
          quantity: 1,
          containerId: null
        })
      )
    })
    const receipt = await owner.caller.mutation(unshare, {
      campaignId: campaign.id,
      subjectKind: 'EQUIPMENT',
      subjectId: equipmentId,
      sharedBy: owner.userId,
      expectedCampaignVersion: campaign.version,
      commandId: crypto.randomUUID()
    })
    expect(receipt.removedShares).toEqual([
      { subjectKind: 'EQUIPMENT', subjectId: equipmentId, sharedBy: owner.userId }
    ])
  })

  it('rejects another Game System and omits old cross-System shares from reads', async () => {
    const { t, owner, campaign, store } = await setup()
    const id = await store('EQUIPMENT', {
      ...club,
      id: crypto.randomUUID(),
      systemId: crypto.randomUUID(),
      userId: owner.userId,
      status: 'ACTIVE'
    })
    const input = { campaignId: campaign.id, subjectKind: 'EQUIPMENT' as const, subjectId: id }
    await expect(owner.caller.mutation(api.campaigns.contentShares.share, input)).rejects.toThrow(
      'Campaign Game System'
    )
    expect(await t.run((ctx) => ctx.db.query('campaignContentShares').take(2))).toEqual([])
    await t.run((ctx) =>
      ctx.db.insert('campaignContentShares', {
        ...input,
        sharedBy: owner.userId,
        createdAt: campaign.createdAt,
        updatedAt: campaign.createdAt
      })
    )
    expect(
      (
        await owner.caller.query(api.campaigns.contentShares.list, {
          campaignId: campaign.id,
          paginationOpts: { cursor: null, numItems: 4 }
        })
      ).page
    ).toEqual([])
  })
  it.each(families)(
    'requires an explicit Homebrew parent share for $kind and rechecks reads',
    async ({ kind, parent, child, field }) => {
      const { t, owner, campaign, store } = await setup()
      const parentId = await store(kind, {
        ...parent,
        id: crypto.randomUUID(),
        userId: owner.userId,
        status: 'ACTIVE'
      })
      const childId = await store(kind, {
        ...child,
        id: crypto.randomUUID(),
        userId: owner.userId,
        status: 'ACTIVE',
        [field]: parentId
      })
      const input = { campaignId: campaign.id, subjectKind: kind, subjectId: childId }
      await expect(owner.caller.mutation(api.campaigns.contentShares.share, input)).rejects.toThrow(
        /readable|Readable/
      )
      expect(await t.run((ctx) => ctx.db.query('campaignContentShares').take(5))).toEqual([])
      await owner.caller.mutation(api.campaigns.contentShares.share, {
        ...input,
        subjectId: parentId
      })
      const first = await owner.caller.mutation(api.campaigns.contentShares.share, input)
      expect(await owner.caller.mutation(api.campaigns.contentShares.share, input)).toEqual(first)
      const listInput = { campaignId: campaign.id, paginationOpts: { cursor: null, numItems: 4 } }
      expect(
        (await owner.caller.query(api.campaigns.contentShares.list, listInput)).page
      ).toHaveLength(2)
      await t.run(async (ctx) => {
        const share = await ctx.db
          .query('campaignContentShares')
          .withIndex('by_campaignId_subjectKind_subjectId', (q) =>
            q.eq('campaignId', campaign.id).eq('subjectKind', kind).eq('subjectId', parentId)
          )
          .unique()
        if (!share) throw new Error('Missing parent share.')
        await ctx.db.delete(share._id)
      })
      await expect(owner.caller.query(api.campaigns.contentShares.list, listInput)).rejects.toThrow(
        /readable|Readable/
      )
      await expect(owner.caller.mutation(api.campaigns.contentShares.share, input)).rejects.toThrow(
        /readable|Readable/
      )
    }
  )

  it.each(families)(
    'allows an enabled official $kind parent but rejects a disabled catalogue',
    async ({ kind, parent, child, field }) => {
      const { t, owner, campaign, store } = await setup()
      await t.mutation(internal.content.import.importSubjects, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects: [importedSubject({ subjectKind: kind, ...parent, document: parent })]
      })
      const childId = await store(kind, {
        ...child,
        id: crypto.randomUUID(),
        userId: owner.userId,
        status: 'ACTIVE',
        [field]: parent.id
      })
      const input = { campaignId: campaign.id, subjectKind: kind, subjectId: childId }
      await owner.caller.mutation(api.campaigns.contentShares.share, input)
      await t.run(async (ctx) => {
        const sourceId = crypto.randomUUID()
        const catalogueId = crypto.randomUUID()
        await ctx.db.insert('contentSources', {
          ...SRD_CONTENT_SOURCE,
          id: sourceId,
          code: 'other-source'
        })
        await ctx.db.insert('rulesCatalogues', {
          ...SRD_RULES_CATALOGUE,
          id: catalogueId,
          code: 'other-catalogue',
          contentSourceIds: [sourceId]
        })
        const stored = await ctx.db
          .query('campaigns')
          .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
          .unique()
        if (!stored) throw new Error('Missing Campaign.')
        await ctx.db.patch(stored._id, { primaryRulesCatalogueId: catalogueId })
      })
      await expect(owner.caller.mutation(api.campaigns.contentShares.share, input)).rejects.toThrow(
        /readable|Readable/
      )
    }
  )

  it('requires every Equipment ancestor, not only the direct parent', async () => {
    const { t, owner, campaign, store } = await setup()
    const base = await store('EQUIPMENT', {
      ...club,
      id: crypto.randomUUID(),
      userId: owner.userId,
      status: 'ACTIVE'
    })
    const parent = await store('EQUIPMENT', {
      ...clubPlus1,
      id: crypto.randomUUID(),
      userId: owner.userId,
      status: 'ACTIVE',
      parentEquipmentId: base
    })
    const child = await store('EQUIPMENT', {
      ...clubPlus1,
      id: crypto.randomUUID(),
      userId: owner.userId,
      status: 'ACTIVE',
      parentEquipmentId: parent
    })
    for (const subjectId of [base, parent, child])
      await owner.caller.mutation(api.campaigns.contentShares.share, {
        campaignId: campaign.id,
        subjectKind: 'EQUIPMENT',
        subjectId
      })
    await t.run(async (ctx) => {
      const share = await ctx.db
        .query('campaignContentShares')
        .withIndex('by_campaignId_subjectKind_subjectId', (q) =>
          q.eq('campaignId', campaign.id).eq('subjectKind', 'EQUIPMENT').eq('subjectId', base)
        )
        .unique()
      if (!share) throw new Error('Missing base share.')
      await ctx.db.delete(share._id)
    })
    await expect(
      owner.caller.mutation(api.campaigns.contentShares.share, {
        campaignId: campaign.id,
        subjectKind: 'EQUIPMENT',
        subjectId: child
      })
    ).rejects.toThrow('Readable parent Equipment')
  })
})
