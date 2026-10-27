import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type { CampaignPlaySettingsOptionsDto } from '@artificer-toolkit/schema/api/campaignSettings'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_OPTIONAL_COMBAT_DEFINITIONS } from '@artificer-toolkit/source-data/srd/optionalCombat.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { fixture } from '../../tests/fixtures/characters'
import { internal } from '../_generated/api'
import { encodeDefinitionDocument } from '../content/definitionDocumentJson'

const create = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const options = makeFunctionReference<
  'query',
  { campaignId: string },
  CampaignPlaySettingsOptionsDto
>('campaigns/playSettings:options')
const disarm = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
  (definition) => definition.document.kind === 'DISARM'
)!
const facing = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
  (definition) => definition.document.kind === 'FACING'
)!
const hittingCover = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
  (definition) => definition.document.kind === 'HITTING_COVER'
)!
const climb = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
  (definition) => definition.document.kind === 'CLIMB_ONTO_LARGER_CREATURE'
)!
const mark = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
  (definition) => definition.document.kind === 'MARK'
)!
const morale = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
  (definition) => definition.document.kind === 'MORALE'
)!

async function setup() {
  const base = await fixture()
  const campaign = await base.owner.caller.mutation(create, {
    name: 'Options test',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: [disarm, hittingCover]
  })
  return { ...base, campaign }
}

describe('native Campaign settings options', () => {
  it('requires current active membership, including on archived Campaigns, and exposes only compact integrated choices', async () => {
    const { t, owner, other, campaign } = await setup()
    const args = { campaignId: campaign.id }
    const expected = {
      initiativePolicies: [],
      optionalCombatRules: [{ definitionId: disarm.id, label: disarm.label, kind: 'DISARM' }]
    }
    await expect(t.query(options, args)).rejects.toThrow()
    await expect(other.caller.query(options, args)).rejects.toThrow()
    await expect(owner.caller.query(options, args)).resolves.toEqual(expected)
    const memberId = await t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: campaign.id,
        userId: other.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: campaign.createdAt,
        joinedAt: campaign.createdAt,
        leftAt: null
      })
    )
    await expect(other.caller.query(options, args)).resolves.toEqual(expected)
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique()
      if (!root) throw new Error('Missing Campaign.')
      await ctx.db.patch(root._id, { status: 'ARCHIVED' })
    })
    await expect(other.caller.query(options, args)).resolves.toEqual(expected)
    await t.run((ctx) =>
      ctx.db.patch(memberId, { status: 'LEFT', leftAt: new Date().toISOString() })
    )
    await expect(other.caller.query(options, args)).rejects.toThrow()
  })

  it('offers Morale once its System policy resolves it (ENCOUNTER-6.3)', async () => {
    const { t, owner, campaign } = await setup()
    await t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: [morale]
    })
    const result = await owner.caller.query(options, { campaignId: campaign.id })
    expect(result.optionalCombatRules).toContainEqual({
      definitionId: morale.id,
      label: morale.label,
      kind: 'MORALE'
    })
    expect(result.optionalCombatRules.map(({ kind }) => kind)).not.toContain('HITTING_COVER')
  })

  it('offers Climb onto a larger creature once its System policy resolves it (MOVE-4.4)', async () => {
    const { t, owner, campaign } = await setup()
    await t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: [climb]
    })
    const result = await owner.caller.query(options, { campaignId: campaign.id })
    expect(result.optionalCombatRules).toContainEqual({
      definitionId: climb.id,
      label: climb.label,
      kind: 'CLIMB_ONTO_LARGER_CREATURE'
    })
  })

  it('offers Facing once its System policy resolves it (ATTACK-12.3)', async () => {
    const { t, owner, campaign } = await setup()
    await t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: [facing]
    })
    const result = await owner.caller.query(options, { campaignId: campaign.id })
    expect(result.optionalCombatRules).toContainEqual({
      definitionId: facing.id,
      label: facing.label,
      kind: 'FACING'
    })
  })

  it('offers Marking once its System policy resolves it (ATTACK-13.3)', async () => {
    const { t, owner, campaign } = await setup()
    await t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: [mark]
    })
    const result = await owner.caller.query(options, { campaignId: campaign.id })
    expect(result.optionalCombatRules).toContainEqual({
      definitionId: mark.id,
      label: mark.label,
      kind: 'MARK'
    })
  })

  it('includes additional catalogue sources once and excludes unpublished, unselected and private definitions', async () => {
    const { t, owner, campaign } = await setup()
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique()
      if (!root) throw new Error('Missing Campaign.')
      const selectedSource = crypto.randomUUID()
      const unselectedSource = crypto.randomUUID()
      const privateSource = crypto.randomUUID()
      await ctx.db.insert('contentSources', { ...SRD_CONTENT_SOURCE, id: selectedSource })
      await ctx.db.insert('contentSources', { ...SRD_CONTENT_SOURCE, id: unselectedSource })
      await ctx.db.insert('contentSources', {
        ...SRD_CONTENT_SOURCE,
        id: privateSource,
        kind: 'USER',
        ownerUserId: owner.userId
      })
      const catalogueId = crypto.randomUUID()
      await ctx.db.insert('rulesCatalogues', {
        ...SRD_RULES_CATALOGUE,
        id: catalogueId,
        contentSourceIds: [SRD_CONTENT_SOURCE.id, selectedSource]
      })
      await ctx.db.patch(root._id, { additionalRulesCatalogueIds: [catalogueId] })
      for (const [label, sourceId] of [
        ['A selected option', selectedSource],
        ['Private option', privateSource],
        ['Disabled option', unselectedSource]
      ] as const) {
        const id = crypto.randomUUID()
        const document = { ...disarm.document, id }
        await ctx.db.insert('reusableDefinitions', {
          definitionFamilyKey: disarm.definitionFamilyKey,
          description: disarm.description,
          id,
          label,
          documentJson: encodeDefinitionDocument(document),
          checksum: checksumRuleDocument(document),
          contentSourceId: sourceId,
          gameSystemId: srdSystemRecord.id,
          version: 1,
          contractVersion: 1,
          publishedAt: new Date().toISOString(),
          publishedBy: owner.userId,
          ...(sourceId === privateSource ? { ownerUserId: owner.userId } : {})
        })
      }
      await ctx.db.insert('reusableDefinitions', {
        id: crypto.randomUUID(),
        label: 'Unpublished option',
        description: null,
        definitionFamilyKey: 'dnd5e-optional-combat',
        contentSourceId: selectedSource,
        gameSystemId: srdSystemRecord.id,
        version: 0
      })
    })
    const result = await owner.caller.query(options, { campaignId: campaign.id })
    expect(result.optionalCombatRules.map(({ label }) => label)).toEqual([
      'A selected option',
      disarm.label
    ])
    expect(
      result.optionalCombatRules.filter(({ definitionId }) => definitionId === disarm.id)
    ).toHaveLength(1)
  })

  it('rejects invalid enabled definition integrity and source ownership without changing Campaign state', async () => {
    const { t, owner, campaign } = await setup()
    const args = { campaignId: campaign.id }
    await t.run(async (ctx) => {
      const root = await ctx.db
        .query('reusableDefinitions')
        .withIndex('by_publicId', (q) => q.eq('id', disarm.id))
        .unique()
      if (!root) throw new Error('Missing definition.')
      await ctx.db.patch(root._id, { checksum: '0'.repeat(64) })
    })
    await expect(owner.caller.query(options, args)).rejects.toThrow('integrity mismatch')
    await t.run(async (ctx) => {
      const source = await ctx.db
        .query('contentSources')
        .withIndex('by_publicId', (q) => q.eq('id', SRD_CONTENT_SOURCE.id))
        .unique()
      if (!source) throw new Error('Missing source.')
      await ctx.db.patch(source._id, { kind: 'USER', ownerUserId: owner.userId })
    })
    await expect(owner.caller.query(options, args)).rejects.toThrow(
      'Invalid catalogue content source binding'
    )
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('campaignPlaySettings')
          .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
          .unique()
      )
    ).toMatchObject({ version: 0 })
  })

  it('fails at the shared inline definition ceiling instead of returning a truncated choice list', async () => {
    const { t, owner, campaign } = await setup()
    await t.run(async (ctx) => {
      // Unsupported optional rules still count as current source records before projection, as
      // do the fixture's seeded condition rule states (D94). Fill the source to the ceiling.
      const seeded = await ctx.db
        .query('reusableDefinitions')
        .withIndex('by_contentSourceId_version', (q) =>
          q.eq('contentSourceId', SRD_CONTENT_SOURCE.id).gt('version', 0)
        )
        .collect()
      for (let index = seeded.length; index < 500; index++) {
        const id = crypto.randomUUID()
        const document = { ...hittingCover.document, id }
        await ctx.db.insert('reusableDefinitions', {
          label: hittingCover.label,
          definitionFamilyKey: hittingCover.definitionFamilyKey,
          description: hittingCover.description,
          id,
          documentJson: encodeDefinitionDocument(document),
          checksum: checksumRuleDocument(document),
          contentSourceId: SRD_CONTENT_SOURCE.id,
          gameSystemId: srdSystemRecord.id,
          version: 1,
          contractVersion: 1,
          publishedAt: new Date().toISOString(),
          publishedBy: owner.userId
        })
      }
    })
    expect(
      (await owner.caller.query(options, { campaignId: campaign.id })).optionalCombatRules
    ).toHaveLength(1)
    await t.run((ctx) => {
      const id = crypto.randomUUID()
      const document = { ...hittingCover.document, id }
      return ctx.db.insert('reusableDefinitions', {
        label: hittingCover.label,
        definitionFamilyKey: hittingCover.definitionFamilyKey,
        description: hittingCover.description,
        id,
        documentJson: encodeDefinitionDocument(document),
        checksum: checksumRuleDocument(document),
        contentSourceId: SRD_CONTENT_SOURCE.id,
        gameSystemId: srdSystemRecord.id,
        version: 1,
        contractVersion: 1,
        publishedAt: new Date().toISOString(),
        publishedBy: owner.userId
      })
    })
    await expect(owner.caller.query(options, { campaignId: campaign.id })).rejects.toThrow(
      'paginated search'
    )
  })
})
