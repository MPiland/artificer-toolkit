import { makeFunctionReference } from 'convex/server'
import { expect, it, vi } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput,
  ShareCampaignContentInput
} from '@artificer-toolkit/schema/api/campaignCore'
import { grappler } from '@artificer-toolkit/source-data/srd/feats/grappler.js'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api } from '../_generated/api'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { corruptPublishedVersionPayload } from '../../tests/fixtures/publication'
import { loadCharacterBuilderContext } from './builderContext'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const share = makeFunctionReference<'mutation', ShareCampaignContentInput, unknown>(
  'campaigns/contentShares:share'
)

async function publishFeat(
  caller: Awaited<ReturnType<typeof readySheetFixture>>['owner']['caller'],
  document: typeof grappler
) {
  const draft = await caller.mutation(api.content.drafts.save, {
    subjectKind: 'FEAT',
    subjectId: document.id,
    systemId: document.systemId,
    label: document.label,
    payload: document
  })
  if (!draft.updatedAt) throw new Error('Missing Feat draft timestamp.')
  await caller.mutation(api.content.publication.publishDraft, {
    subjectKind: 'FEAT',
    subjectId: draft.subjectId,
    expectedDraftUpdatedAt: draft.updatedAt
  })
}

it('reads the complete authorized Feat selector catalogue from roots while selected mechanics remain validated', async () => {
  const base = await readySheetFixture()
  const campaign = await base.other.caller.mutation(createCampaign, {
    name: 'Feat catalogue reader',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
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
      characterId: base.character.id,
      assignedAt: campaign.createdAt
    })
  })
  const direct = {
    ...grappler,
    id: crypto.randomUUID(),
    userId: base.owner.userId,
    label: 'Direct Feat'
  }
  const shared = {
    ...grappler,
    id: crypto.randomUUID(),
    userId: base.other.userId,
    label: 'Shared Feat'
  }
  const foreign = {
    ...grappler,
    id: crypto.randomUUID(),
    userId: base.other.userId,
    label: 'Foreign Feat'
  }
  await publishFeat(base.owner.caller, direct)
  await publishFeat(base.other.caller, shared)
  await publishFeat(base.other.caller, foreign)
  await base.other.caller.mutation(share, {
    campaignId: campaign.id,
    subjectKind: 'FEAT',
    subjectId: shared.id
  })
  const character = {
    ...base.character,
    intent: {
      ...base.character.intent,
      featureAcquisitions: [
        {
          id: crypto.randomUUID(),
          featureId: direct.id,
          source: { kind: 'FEAT' as const, featId: direct.id },
          timing: { kind: 'IMMEDIATE' as const }
        }
      ]
    }
  }
  const initial = await base.t.run(async (ctx) => {
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', direct.id))
      .unique()
    if (!root) throw new Error('Missing direct Feat root.')
    const reads = vi.spyOn(ctx.db, 'get')
    const result = await loadCharacterBuilderContext(ctx, character, base.owner.userId)
    return {
      ids: result.catalog.feats.map((feat) => feat.id),
      selected: result.registry.feats?.map((feat) => feat.id),
      selectedVersionReads: reads.mock.calls.filter(([id]) => id === root.currentVersionId).length
    }
  })
  expect(initial.ids).toEqual([direct.id, shared.id])
  expect(initial.ids).not.toContain(foreign.id)
  expect(initial.selected).toEqual([direct.id])
  expect(initial.selectedVersionReads).toBe(1)

  await base.t.run(async (ctx) => {
    const record = await ctx.db
      .query('campaignContentShares')
      .withIndex('by_campaignId_subjectKind_subjectId', (q) =>
        q.eq('campaignId', campaign.id).eq('subjectKind', 'FEAT').eq('subjectId', shared.id)
      )
      .unique()
    if (!record) throw new Error('Missing shared Feat record.')
    await ctx.db.delete(record._id)
  })
  const withdrawn = await base.t.run(async (ctx) => {
    const result = await loadCharacterBuilderContext(ctx, character, base.owner.userId)
    return result.catalog.feats.map((feat) => feat.id)
  })
  expect(withdrawn).toEqual([direct.id])

  await base.t.run(async (ctx) => {
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', direct.id))
      .unique()
    if (!root) throw new Error('Missing direct Feat root.')
    await corruptPublishedVersionPayload(ctx, direct.id)
  })
  await expect(
    base.t.run((ctx) => loadCharacterBuilderContext(ctx, character, base.owner.userId))
  ).rejects.toThrow('Stored authored content checksum mismatch.')
})
