import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type {
  CampaignDetailDto,
  UpdateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type { CampaignPartyInventoryMutationInput } from '@artificer-toolkit/schema/api/campaignInventory'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { api } from '../_generated/api'
import * as sheetFacts from '../characters/sheetFacts'

const update = makeFunctionReference<'mutation', UpdateCampaignInput, CampaignDetailDto>(
  'campaigns/update:update'
)
const inventory = makeFunctionReference<
  'mutation',
  { input: CampaignPartyInventoryMutationInput },
  { eventId: string }
>('campaigns/partyInventoryCommands:mutate')

async function setup() {
  const base = await readySheetFixture()
  const campaign = await base.other.caller.mutation(api.campaigns.create.create, {
    name: 'Source dependencies',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const catalogueId = crypto.randomUUID()
  const sourceId = crypto.randomUUID()
  await base.t.run(async (ctx) => {
    await ctx.db.insert('contentSources', { ...SRD_CONTENT_SOURCE, id: sourceId })
    await ctx.db.insert('rulesCatalogues', {
      ...SRD_RULES_CATALOGUE,
      id: catalogueId,
      contentSourceIds: [sourceId]
    })
  })
  const snapshot = () =>
    base.t.run(async (ctx) => ({
      campaigns: await ctx.db.query('campaigns').collect(),
      characters: await ctx.db.query('characters').collect(),
      plays: await ctx.db.query('characterPlayStates').collect(),
      drafts: await ctx.db.query('characterDrafts').collect(),
      assignments: await ctx.db.query('campaignCharacterAssignments').collect(),
      items: await ctx.db.query('campaignPartyItems').collect(),
      vehicles: await ctx.db.query('campaignVehicles').collect(),
      events: await ctx.db.query('campaignEvents').collect(),
      receipts: await ctx.db.query('characterCommandReceipts').collect()
    }))
  async function assign() {
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
  }
  return { ...base, campaign, catalogueId, sourceId, snapshot, assign }
}

describe('Campaign update source and mechanics dependencies', () => {
  it('allows unused-source removal and same-source catalogue replacement, but rejects unavailable or duplicate bindings', async () => {
    const { t, other, campaign, catalogueId, snapshot, assign } = await setup()
    await assign()
    let current = await other.caller.mutation(update, {
      campaignId: campaign.id,
      expectedVersion: campaign.version,
      additionalRulesCatalogueIds: [catalogueId]
    })
    current = await other.caller.mutation(update, {
      campaignId: campaign.id,
      expectedVersion: current.version,
      additionalRulesCatalogueIds: []
    })
    const aliasId = crypto.randomUUID()
    await t.run((ctx) =>
      ctx.db.insert('rulesCatalogues', {
        ...SRD_RULES_CATALOGUE,
        id: aliasId,
        contentSourceIds: [SRD_CONTENT_SOURCE.id]
      })
    )
    current = await other.caller.mutation(update, {
      campaignId: campaign.id,
      expectedVersion: current.version,
      primaryRulesCatalogueId: aliasId
    })
    expect(current.primaryRulesCatalogueId).toBe(aliasId)
    const before = await snapshot()
    for (const changes of [
      { primaryRulesCatalogueId: crypto.randomUUID() },
      { additionalRulesCatalogueIds: [aliasId] }
    ]) {
      await expect(
        other.caller.mutation(update, {
          campaignId: campaign.id,
          expectedVersion: current.version,
          ...changes
        })
      ).rejects.toThrow()
      expect(await snapshot()).toEqual(before)
    }
  })

  it('rejects removal used by assigned canonical Character choices and preserves all state', async () => {
    const { other, campaign, catalogueId, character, snapshot, assign } = await setup()
    await assign()
    const before = await snapshot()
    await expect(
      other.caller.mutation(update, {
        campaignId: campaign.id,
        expectedVersion: campaign.version,
        primaryRulesCatalogueId: catalogueId
      })
    ).rejects.toThrow(`Character ${character.id}`)
    expect(await snapshot()).toEqual(before)
  })

  it('rejects removal used only by an assigned saved draft without pruning it', async () => {
    const { t, owner, other, campaign, catalogueId, sourceId, character, snapshot, assign } =
      await setup()
    const equipment = { ...club, id: crypto.randomUUID(), label: 'Draft-only club' }
    await importSeededSubjects(t, {
      contentSourceId: sourceId,
      subjects: [importedSubject({ subjectKind: 'EQUIPMENT', ...equipment, document: equipment })]
    })
    await assign()
    const current = await other.caller.mutation(update, {
      campaignId: campaign.id,
      expectedVersion: campaign.version,
      additionalRulesCatalogueIds: [catalogueId]
    })
    const draft = await owner.caller.mutation(api.characters.drafts.create, {
      id: character.id,
      systemId: character.systemId
    })
    const savedCharacter = structuredClone(draft.payload.character)
    savedCharacter.state.equipment.inventory.push({
      ...savedCharacter.state.equipment.inventory[0]!,
      id: crypto.randomUUID(),
      equipmentId: equipment.id
    })
    await owner.caller.mutation(api.characters.drafts.save, {
      characterId: character.id,
      expectedDraftId: draft.id,
      mode: 'edit',
      character: savedCharacter
    })
    const before = await snapshot()
    await expect(
      other.caller.mutation(update, {
        campaignId: campaign.id,
        expectedVersion: current.version,
        additionalRulesCatalogueIds: []
      })
    ).rejects.toThrow(`Character ${character.id}`)
    expect(await snapshot()).toEqual(before)
  })

  it.each(['Equipment', 'Vehicle'] as const)(
    'rejects removal used by Campaign %s custody',
    async (kind) => {
      const { t, other, campaign, catalogueId, snapshot } = await setup()
      let dependentId: string
      if (kind === 'Equipment') {
        await other.caller.mutation(inventory, {
          input: {
            campaignId: campaign.id,
            expectedOwnerVersion: 0,
            idempotencyKey: crypto.randomUUID(),
            kind: 'ITEM_ADD',
            equipmentId: club.id,
            quantity: 1
          }
        })
        dependentId = club.id
      } else {
        await importSeededSubjects(t, {
          contentSourceId: SRD_CONTENT_SOURCE.id,
          subjects: [importedSubject({ subjectKind: 'VEHICLE', ...cart, document: cart })]
        })
        const vehicle = await other.caller.mutation(api.campaigns.vehicles.create, {
          campaignId: campaign.id,
          vehicleDefinitionId: cart.id
        })
        dependentId = vehicle.id
      }
      const before = await snapshot()
      await expect(
        other.caller.mutation(update, {
          campaignId: campaign.id,
          expectedVersion: campaign.version,
          primaryRulesCatalogueId: catalogueId
        })
      ).rejects.toThrow(`${kind} ${dependentId}`)
      expect(await snapshot()).toEqual(before)
    }
  )

  it('rolls back an attunement update when assigned Sheet evaluation fails', async () => {
    const { other, campaign, snapshot, assign } = await setup()
    await assign()
    const before = await snapshot()
    const fault = vi
      .spyOn(sheetFacts, 'loadCharacterSheetFacts')
      .mockRejectedValueOnce(new Error('Injected Sheet evaluation failure'))
    try {
      await expect(
        other.caller.mutation(update, {
          campaignId: campaign.id,
          expectedVersion: campaign.version,
          attunementSlotOverride: 1
        })
      ).rejects.toThrow('Injected Sheet evaluation failure')
    } finally {
      fault.mockRestore()
    }
    expect(await snapshot()).toEqual(before)
  })
})
