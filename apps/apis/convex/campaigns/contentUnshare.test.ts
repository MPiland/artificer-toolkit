import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignContentRemovalReceiptDto,
  CampaignDetailDto,
  CreateCampaignInput,
  UnshareCampaignContentInput
} from '@artificer-toolkit/schema/api/campaignCore'
import { acquiredEquipmentRulesSchema } from '@artificer-toolkit/schema/projections/acquiredEquipmentRules'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api } from '../_generated/api'
import { readCharacterDraft } from '../characters/documents'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import { writeCharacterRecord } from '../../tests/fixtures/characterRecords'
import { makePublishedRootOwned } from '../../tests/fixtures/publication'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const unshare = makeFunctionReference<
  'mutation',
  UnshareCampaignContentInput,
  CampaignContentRemovalReceiptDto
>('campaigns/contentShares:unshare')

type ReadySheet = Awaited<ReturnType<typeof readySheetFixture>>

async function assignedCampaign(base: ReadySheet) {
  const campaign = await base.other.caller.mutation(createCampaign, {
    name: 'Source-loss campaign',
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
  return campaign
}

async function makeRootOwned(base: ReadySheet, subjectId: string, ownerUserId: string) {
  await base.t.run((ctx) => makePublishedRootOwned(ctx, subjectId, ownerUserId))
}

describe('native Campaign content-unshare reconciliation', () => {
  it('moves an assigned active Character into repair while preserving its draft, Sheet state and history', async () => {
    const base = await readySheetFixture()
    const campaign = await assignedCampaign(base)
    await makeRootOwned(base, acolyte.id, base.other.userId)
    await base.other.caller.mutation(api.campaigns.contentShares.share, {
      campaignId: campaign.id,
      subjectKind: 'BACKGROUND',
      subjectId: acolyte.id
    })
    await base.owner.caller.mutation(api.characters.sheetCommands.execute, {
      id: base.character.id,
      command: {
        type: 'UPSERT_SHEET_ADJUSTMENT',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        adjustment: {
          id: crypto.randomUUID(),
          family: 'ABILITY',
          ability: 'STRENGTH',
          field: 'SCORE_OVERRIDE',
          value: 20,
          sourceNote: 'Retained override'
        }
      }
    })
    const opened = await base.owner.caller.mutation(api.characters.drafts.create, {
      id: base.character.id,
      systemId: base.character.systemId
    })
    const saved = await base.owner.caller.mutation(api.characters.drafts.save, {
      characterId: base.character.id,
      expectedDraftId: opened.id,
      mode: 'edit',
      character: { ...opened.payload.character, label: 'Keep this draft' }
    })
    const before = await base.t.run(async (ctx) => ({
      character: await readCharacterRow(ctx, base.character.id),
      draft: await ctx.db
        .query('characterDrafts')
        .withIndex('by_characterId', (q) => q.eq('characterId', base.character.id))
        .unique(),
      receipts: await ctx.db
        .query('characterCommandReceipts')
        .withIndex('by_characterId_commandId', (q) => q.eq('characterId', base.character.id))
        .collect()
    }))
    if (!before.character || !before.draft)
      throw new Error('Missing Character reconciliation state.')
    const receipt = await base.other.caller.mutation(unshare, {
      campaignId: campaign.id,
      subjectKind: 'BACKGROUND',
      subjectId: acolyte.id,
      sharedBy: base.other.userId,
      expectedCampaignVersion: campaign.version,
      commandId: crypto.randomUUID()
    })
    expect(receipt.affectedCharacters).toEqual([
      {
        characterId: base.character.id,
        status: 'DRAFT',
        streamVersion: before.character.play.streamVersion + 1
      }
    ])
    const after = await base.t.run(async (ctx) => ({
      character: await readCharacterRow(ctx, base.character.id),
      draft: await ctx.db
        .query('characterDrafts')
        .withIndex('by_characterId', (q) => q.eq('characterId', base.character.id))
        .unique(),
      receipts: await ctx.db
        .query('characterCommandReceipts')
        .withIndex('by_characterId_commandId', (q) => q.eq('characterId', base.character.id))
        .collect()
    }))
    expect(after.character).toMatchObject({
      _id: before.character._id,
      createdAt: before.character.createdAt,
      sheetState: before.character.sheetState,
      status: 'DRAFT',
      play: { streamVersion: before.character.play.streamVersion + 1 }
    })
    expect(after.receipts).toEqual(before.receipts)
    expect(after.draft).toMatchObject({
      id: saved.id,
      createdAt: before.draft.createdAt,
      mode: 'edit',
      label: 'Keep this draft',
      baseActiveUpdatedAt: after.character?.updatedAt
    })
    const canonical = readCharacterRecord(after.character!)
    const working = await base.t.run(async (ctx) => {
      if (!after.draft || !after.character) throw new Error('Missing Character draft payload.')
      return (await readCharacterDraft(ctx, after.draft, after.character)).payload
    })
    expect(canonical.intent.background.backgroundId).toBe('')
    expect(working.character).toMatchObject({
      label: 'Keep this draft',
      intent: { background: { backgroundId: '' } }
    })
  })

  it('keeps a root selected by its Character owner when that owner unshares it from the Campaign', async () => {
    const base = await readySheetFixture()
    const campaign = await assignedCampaign(base)
    await makeRootOwned(base, acolyte.id, base.owner.userId)
    await base.owner.caller.mutation(api.campaigns.contentShares.share, {
      campaignId: campaign.id,
      subjectKind: 'BACKGROUND',
      subjectId: acolyte.id
    })
    const before = await base.readState()
    const receipt = await base.owner.caller.mutation(unshare, {
      campaignId: campaign.id,
      subjectKind: 'BACKGROUND',
      subjectId: acolyte.id,
      sharedBy: base.owner.userId,
      expectedCampaignVersion: campaign.version,
      commandId: crypto.randomUUID()
    })
    expect(receipt.affectedCharacters).toEqual([])
    expect(await base.readState()).toEqual(before)
  })

  it('keeps acquired Equipment on an active Character after unshare and clamps wounded HP', async () => {
    const base = await readySheetFixture()
    const campaign = await assignedCampaign(base)
    await makeRootOwned(base, club.id, base.other.userId)
    await base.other.caller.mutation(api.campaigns.contentShares.share, {
      campaignId: campaign.id,
      subjectKind: 'EQUIPMENT',
      subjectId: club.id
    })
    const before = await base.readState()
    if (!before.character) throw new Error('Missing active Character.')
    const document = readCharacterRecord(before.character)
    await base.t.run((ctx) =>
      writeCharacterRecord(ctx, before.character!, {
        document: {
          ...document,
          state: {
            ...document.state,
            hitpoints: { ...document.state.hitpoints, current: 999 }
          }
        }
      })
    )
    const receipt = await base.other.caller.mutation(unshare, {
      campaignId: campaign.id,
      subjectKind: 'EQUIPMENT',
      subjectId: club.id,
      sharedBy: base.other.userId,
      expectedCampaignVersion: campaign.version,
      commandId: crypto.randomUUID()
    })
    expect(receipt.affectedCharacters).toEqual([
      {
        characterId: base.character.id,
        status: 'ACTIVE',
        streamVersion: before.character.play.streamVersion + 1
      }
    ])
    const after = await base.readState()
    const reconciled = readCharacterRecord(after.character!)
    expect(reconciled.status).toBe('ACTIVE')
    const physicalItems = (items: typeof document.state.equipment.inventory) =>
      items.map(({ retainedRulesJson: _retainedRulesJson, ...item }) => item)
    expect(physicalItems(reconciled.state.equipment.inventory)).toEqual(
      physicalItems(document.state.equipment.inventory)
    )
    for (const item of reconciled.state.equipment.inventory) {
      if (!item.retainedRulesJson) throw new Error('Missing acquired Equipment rules.')
      const retained = acquiredEquipmentRulesSchema.parse(JSON.parse(item.retainedRulesJson))
      const leaf = retained.sources.find(
        (source) => source.subjectKind === 'EQUIPMENT' && source.subjectId === item.equipmentId
      )
      if (!leaf) throw new Error('Missing acquired Equipment pin.')
      // The pin is the version the other user's owned root published.
      const root = await base.t.run((ctx) =>
        ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', item.equipmentId))
          .unique()
      )
      expect(root?.ownerUserId).toBe(base.other.userId)
      expect(leaf.versionId).toBe(root?.currentVersionPublicId)
      expect(leaf.compilation.authoredChecksum).toBe(root?.checksum)
    }
    const sheet = await base.owner.caller.query(api.characters.sheet.get, {
      id: base.character.id
    })
    if (!sheet) throw new Error('Missing retained Character Sheet.')
    expect(sheet.inventory.items).toHaveLength(document.state.equipment.inventory.length)
    expect(sheet.reference.equipmentOptions.some((option) => option.id === club.id)).toBe(true)
    expect(reconciled.state.hitpoints.current).toBeLessThan(999)
    expect(after.character?.sheetState).toEqual(before.character.sheetState)
  })
})
