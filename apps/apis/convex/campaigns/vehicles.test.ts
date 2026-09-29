import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type {
  CampaignDetailDto,
  CampaignContentShareDto,
  CreateCampaignInput,
  ShareCampaignContentInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignVehicleDto,
  CreateCampaignVehicleInput,
  UpdateCampaignVehicleInput
} from '@artificer-toolkit/schema/api/campaignVehicles'
import type {
  CampaignVehicleListInput,
  CampaignVehiclePage
} from '@artificer-toolkit/schema/api/campaignVehiclePages'
import type { AuthoredDraftResult } from '@artificer-toolkit/schema/api/authoredDrafts'
import type {
  AuthoredPublicationResult,
  AuthoredPublishDraftInput
} from '@artificer-toolkit/schema/api/authoredPublication'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { rowboat } from '@artificer-toolkit/source-data/srd/vehicles/rowboat.js'
import { api } from '../_generated/api'
import * as vehicleDocuments from './vehicleDocuments'
import {
  corruptPublishedVersionPayload,
  importedSubject,
  publicationFixture
} from '../../tests/fixtures/publication'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const archiveCampaign = makeFunctionReference<
  'mutation',
  { campaignId: string; expectedVersion: number },
  CampaignDetailDto
>('campaigns/archive:archive')
const share = makeFunctionReference<'mutation', ShareCampaignContentInput, CampaignContentShareDto>(
  'campaigns/contentShares:share'
)
const publish = makeFunctionReference<
  'mutation',
  AuthoredPublishDraftInput,
  AuthoredPublicationResult
>('content/publication:publishDraft')
const list = makeFunctionReference<'query', CampaignVehicleListInput, CampaignVehiclePage>(
  'campaigns/vehicles:list'
)
const create = makeFunctionReference<'mutation', CreateCampaignVehicleInput, CampaignVehicleDto>(
  'campaigns/vehicles:create'
)
const update = makeFunctionReference<'mutation', UpdateCampaignVehicleInput, CampaignVehicleDto>(
  'campaigns/vehicles:update'
)
const remove = makeFunctionReference<
  'mutation',
  { campaignId: string; vehicleId: string; expectedVersion: number },
  null
>('campaigns/vehicles:remove')

const vehicleSubjects = [cart, rowboat].map((vehicle) =>
  importedSubject({ subjectKind: 'VEHICLE', ...vehicle, document: vehicle })
)

async function fixture() {
  return publicationFixture(
    import.meta.glob('/apps/apis/convex/**/*.*s'),
    import.meta.glob('../betterAuth/**/*.*s'),
    [vehicleSubjects]
  )
}

async function campaign(base: Awaited<ReturnType<typeof fixture>>['first']) {
  return base.caller.mutation(createCampaign, {
    name: 'Vehicle Campaign',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
}

function pageInput(
  campaignId: string,
  cursor: string | null = null,
  numItems = 48
): CampaignVehicleListInput {
  return { campaignId, paginationOpts: { cursor, numItems } }
}

async function homebrew(
  base: Awaited<ReturnType<typeof fixture>>['first']
): Promise<{ draft: AuthoredDraftResult; publication: AuthoredPublicationResult }> {
  const draft = await base.caller.mutation(api.content.drafts.duplicate, {
    subjectKind: 'VEHICLE',
    subjectId: cart.id
  })
  if (!draft.updatedAt) throw new Error('Missing Vehicle draft revision')
  const publication = await base.caller.mutation(publish, {
    subjectKind: 'VEHICLE',
    subjectId: draft.subjectId,
    expectedDraftUpdatedAt: draft.updatedAt
  })
  return { draft, publication }
}

describe('native Campaign Vehicle instances', () => {
  it('counts Vehicles as Campaign entries against the host limit', async () => {
    const base = await fixture()
    const campaignRecord = await campaign(base.first)
    const input = { campaignId: campaignRecord.id, vehicleDefinitionId: cart.id }
    const created = await base.first.caller.mutation(create, input)
    const usage = () =>
      base.t.run((ctx) =>
        ctx.db
          .query('campaignContentUsage')
          .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignRecord.id))
          .unique()
      )
    expect(await usage()).toMatchObject({ entries: 1, scenes: 0 })
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaignContentUsage')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignRecord.id))
        .unique()
      if (!row) throw new Error('Missing Campaign content usage.')
      await ctx.db.patch(row._id, { entries: 150 })
    })
    await expect(base.first.caller.mutation(create, input)).rejects.toThrow(
      'This Campaign has reached its entries limit.'
    )
    await base.first.caller.mutation(remove, {
      campaignId: campaignRecord.id,
      vehicleId: created.id,
      expectedVersion: created.version
    })
    expect(await usage()).toMatchObject({ entries: 149 })
  }, 60000)

  it('supports normalized CRUD, owner-only writes, versions, masking, and archived read-only access', async () => {
    const base = await fixture()
    const campaignRecord = await campaign(base.first)
    await base.t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: campaignRecord.id,
        userId: base.second.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: campaignRecord.createdAt,
        joinedAt: campaignRecord.createdAt,
        leftAt: null
      })
    )
    const input = {
      campaignId: campaignRecord.id.toUpperCase(),
      vehicleDefinitionId: cart.id.toUpperCase(),
      label: 'Fuck Boat'
    }
    const created = await base.first.caller.mutation(create, input)
    expect(created).toMatchObject({
      campaignId: campaignRecord.id,
      vehicleDefinitionId: cart.id,
      version: 0,
      label: '**** Boat'
    })
    expect((await base.second.caller.query(list, pageInput(campaignRecord.id))).page).toEqual([
      expect.objectContaining({ id: created.id, label: '**** Boat' })
    ])
    const foreignCampaign = await campaign(base.second)
    await expect(
      base.second.caller.mutation(update, {
        campaignId: foreignCampaign.id,
        vehicleId: created.id,
        expectedVersion: 0,
        label: 'Foreign'
      })
    ).rejects.toThrow('unavailable')
    await expect(
      base.second.caller.mutation(remove, {
        campaignId: foreignCampaign.id,
        vehicleId: created.id,
        expectedVersion: 0
      })
    ).rejects.toThrow('unavailable')
    const updateInput = {
      campaignId: campaignRecord.id,
      vehicleId: created.id,
      expectedVersion: 0,
      label: 'Nope'
    }
    await expect(
      base.second.caller.mutation(create, {
        campaignId: campaignRecord.id,
        vehicleDefinitionId: cart.id
      })
    ).rejects.toThrow('Only the Campaign owner')
    await expect(base.second.caller.mutation(update, updateInput)).rejects.toThrow(
      'Only the Campaign owner'
    )
    await expect(
      base.second.caller.mutation(remove, {
        campaignId: campaignRecord.id,
        vehicleId: created.id,
        expectedVersion: 0
      })
    ).rejects.toThrow('Only the Campaign owner')
    await expect(
      base.first.caller.mutation(update, { ...updateInput, expectedVersion: 9 })
    ).rejects.toThrow('changed')
    const updated = await base.first.caller.mutation(update, {
      ...updateInput,
      vehicleId: created.id.toUpperCase(),
      label: 'Fuck Boat'
    })
    expect(updated).toMatchObject({ id: created.id, version: 1, label: '**** Boat' })
    expect(Date.parse(updated.updatedAt)).toBeGreaterThan(Date.parse(updated.createdAt))
    expect(
      await base.t.run(async (ctx) => {
        const row = await ctx.db
          .query('campaignVehicles')
          .withIndex('by_campaignId_id', (q) =>
            q.eq('campaignId', campaignRecord.id).eq('id', created.id)
          )
          .unique()
        return row?.label
      })
    ).toBe('Fuck Boat')
    await expect(
      base.first.caller.mutation(remove, {
        campaignId: campaignRecord.id,
        vehicleId: created.id,
        expectedVersion: 0
      })
    ).rejects.toThrow('changed')
    await base.first.caller.mutation(archiveCampaign, {
      campaignId: campaignRecord.id,
      expectedVersion: 0
    })
    expect((await base.second.caller.query(list, pageInput(campaignRecord.id))).page).toHaveLength(
      1
    )
    await expect(
      base.first.caller.mutation(create, {
        campaignId: campaignRecord.id,
        vehicleDefinitionId: cart.id
      })
    ).rejects.toThrow('read-only')
    await expect(
      base.first.caller.mutation(update, {
        ...updateInput,
        vehicleId: created.id,
        expectedVersion: 1,
        label: null
      })
    ).rejects.toThrow('read-only')
    await expect(
      base.first.caller.mutation(remove, {
        campaignId: campaignRecord.id,
        vehicleId: created.id,
        expectedVersion: 1
      })
    ).rejects.toThrow('read-only')
  })

  it('requires an enabled official source or current shared homebrew, and fails closed on source loss while retaining metadata', async () => {
    const base = await fixture()
    const campaignRecord = await campaign(base.first)
    const instance = await base.first.caller.mutation(create, {
      campaignId: campaignRecord.id,
      vehicleDefinitionId: cart.id,
      label: 'Stored label'
    })
    await expect(
      base.first.caller.mutation(create, {
        campaignId: campaignRecord.id,
        vehicleDefinitionId: crypto.randomUUID()
      })
    ).rejects.toThrow('unavailable')
    const owned = await homebrew(base.first)
    await expect(
      base.first.caller.mutation(create, {
        campaignId: campaignRecord.id,
        vehicleDefinitionId: owned.draft.subjectId
      })
    ).rejects.toThrow('shared')
    await base.first.caller.mutation(share, {
      campaignId: campaignRecord.id,
      subjectKind: 'VEHICLE',
      subjectId: owned.draft.subjectId
    })
    const shared = await base.first.caller.mutation(create, {
      campaignId: campaignRecord.id,
      vehicleDefinitionId: owned.draft.subjectId
    })
    expect(shared.vehicleDefinitionId).toBe(owned.draft.subjectId)
    const rootId = await base.t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', cart.id))
        .unique()
      if (!root) throw new Error('Missing cart root')
      return root._id
    })
    await base.t.run((ctx) => ctx.db.delete(rootId))
    expect((await base.first.caller.query(list, pageInput(campaignRecord.id))).page).toEqual([
      expect.objectContaining({ id: instance.id, label: 'Stored label' }),
      expect.objectContaining({ id: shared.id })
    ])
    await expect(
      base.first.caller.mutation(update, {
        campaignId: campaignRecord.id,
        vehicleId: instance.id,
        expectedVersion: 0,
        label: 'x'
      })
    ).rejects.toThrow('unavailable')
    await expect(
      base.first.caller.mutation(remove, {
        campaignId: campaignRecord.id,
        vehicleId: instance.id,
        expectedVersion: 0
      })
    ).resolves.toBeNull()
  })

  it('paginates 49 same-time UUID-tied instances without duplication and rolls back rejected creates', async () => {
    const base = await fixture()
    const campaignRecord = await campaign(base.first)
    const rows = await Promise.all(
      Array.from({ length: 49 }, () =>
        base.first.caller.mutation(create, {
          campaignId: campaignRecord.id,
          vehicleDefinitionId: cart.id
        })
      )
    )
    const tiedCreatedAt = '2026-01-01T00:00:00.000Z'
    await base.t.run(async (ctx) => {
      for (const row of rows) {
        const stored = await ctx.db
          .query('campaignVehicles')
          .withIndex('by_campaignId_id', (q) =>
            q.eq('campaignId', campaignRecord.id).eq('id', row.id)
          )
          .unique()
        if (!stored) throw new Error('Missing Campaign Vehicle fixture')
        await ctx.db.patch(stored._id, { createdAt: tiedCreatedAt, updatedAt: tiedCreatedAt })
      }
    })
    const first = await base.first.caller.query(list, pageInput(campaignRecord.id))
    expect(first.page).toHaveLength(48)
    expect(first.isDone).toBe(false)
    const second = await base.first.caller.query(
      list,
      pageInput(campaignRecord.id, first.continueCursor)
    )
    expect(second.isDone).toBe(true)
    const paged = [...first.page, ...second.page]
    expect(paged.map((row) => row.createdAt)).toEqual(Array(49).fill(tiedCreatedAt))
    expect(paged.map((row) => row.id)).toEqual(rows.map((row) => row.id).sort())
    expect(new Set(paged.map((row) => row.id)).size).toBe(49)
    const beforeFailure = await base.t.run((ctx) => ctx.db.query('campaignVehicles').collect())
    const presentation = vi
      .spyOn(vehicleDocuments, 'presentCampaignVehicle')
      .mockImplementationOnce(() => {
        throw new Error('late presentation failure')
      })
    try {
      await expect(
        base.first.caller.mutation(create, {
          campaignId: campaignRecord.id,
          vehicleDefinitionId: cart.id
        })
      ).rejects.toThrow('late presentation failure')
    } finally {
      presentation.mockRestore()
    }
    expect(await base.t.run((ctx) => ctx.db.query('campaignVehicles').collect())).toEqual(
      beforeFailure
    )
    expect((await base.t.run((ctx) => ctx.db.query('campaignVehicles').collect())).length).toBe(
      rows.length
    )
  })

  it('requires the sharing Player to remain active for Homebrew authority', async () => {
    const base = await fixture()
    const campaignRecord = await campaign(base.first)
    const membershipId = await base.t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: campaignRecord.id,
        userId: base.second.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: campaignRecord.createdAt,
        joinedAt: campaignRecord.createdAt,
        leftAt: null
      })
    )
    const owned = await homebrew(base.second)
    await base.second.caller.mutation(share, {
      campaignId: campaignRecord.id,
      subjectKind: 'VEHICLE',
      subjectId: owned.draft.subjectId
    })
    const instance = await base.first.caller.mutation(create, {
      campaignId: campaignRecord.id,
      vehicleDefinitionId: owned.draft.subjectId,
      label: 'Shared instance'
    })
    await base.t.run((ctx) =>
      ctx.db.patch(membershipId, { status: 'LEFT', leftAt: new Date().toISOString() })
    )
    await expect(
      base.first.caller.mutation(create, {
        campaignId: campaignRecord.id,
        vehicleDefinitionId: owned.draft.subjectId
      })
    ).rejects.toThrow('shared')
    await expect(
      base.first.caller.mutation(update, {
        campaignId: campaignRecord.id,
        vehicleId: instance.id,
        expectedVersion: 0,
        label: 'Changed'
      })
    ).rejects.toThrow('shared')
    expect((await base.first.caller.query(list, pageInput(campaignRecord.id))).page).toEqual([
      expect.objectContaining({ id: instance.id, label: 'Shared instance' })
    ])
    await expect(
      base.first.caller.mutation(remove, {
        campaignId: campaignRecord.id,
        vehicleId: instance.id,
        expectedVersion: 0
      })
    ).resolves.toBeNull()
  })

  it('rejects excluded official sources, foreign Systems and corrupt publications without changing instances', async () => {
    const base = await fixture()
    const campaignRecord = await campaign(base.first)
    await expect(base.second.caller.query(list, pageInput(campaignRecord.id))).rejects.toThrow(
      'not found'
    )
    const input = { campaignId: campaignRecord.id, vehicleDefinitionId: cart.id }
    const instance = await base.first.caller.mutation(create, input)
    const original = await base.t.run(async (ctx) => {
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', cart.id))
        .unique()
      if (!root) throw new Error('Missing cart root')
      const version = await ctx.db.get(root.currentVersionId)
      if (!version) throw new Error('Missing cart publication')
      const sourceId = crypto.randomUUID()
      await ctx.db.insert('contentSources', { ...SRD_CONTENT_SOURCE, id: sourceId })
      // Keep publication metadata consistent; only the Campaign catalogue excludes this source.
      await ctx.db.patch(root._id, { contentSourceId: sourceId })
      await ctx.db.patch(version._id, { contentSourceId: sourceId })
      return { root, version }
    })
    await expect(base.first.caller.mutation(create, input)).rejects.toThrow('enabled official')
    await expect(
      base.first.caller.mutation(update, {
        campaignId: campaignRecord.id,
        vehicleId: instance.id,
        expectedVersion: 0,
        label: 'Excluded'
      })
    ).rejects.toThrow('enabled official')
    await base.t.run(async (ctx) => {
      await ctx.db.patch(original.root._id, {
        contentSourceId: original.root.contentSourceId,
        systemId: crypto.randomUUID()
      })
      await ctx.db.patch(original.version._id, {
        contentSourceId: original.version.contentSourceId
      })
    })
    await expect(base.first.caller.mutation(create, input)).rejects.toThrow('unavailable')
    await base.t.run(async (ctx) => {
      await ctx.db.patch(original.root._id, { systemId: original.root.systemId })
      await corruptPublishedVersionPayload(ctx, cart.id)
    })
    await expect(base.first.caller.mutation(create, input)).rejects.toThrow('checksum')
    expect((await base.first.caller.query(list, pageInput(campaignRecord.id))).page).toEqual([
      instance
    ])
  })
})
