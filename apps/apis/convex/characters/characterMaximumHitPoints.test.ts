import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignAssignmentResult,
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignInventoryTransferResultDto,
  TransferCampaignInventoryInput
} from '@artificer-toolkit/schema/api/campaignInventory'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { api } from '../_generated/api'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const assign = makeFunctionReference<
  'mutation',
  { campaignId: string; characterId: string },
  CampaignAssignmentResult
>('campaigns/assignments:assign')
const transfer = makeFunctionReference<
  'mutation',
  { input: TransferCampaignInventoryInput },
  CampaignInventoryTransferResultDto
>('campaigns/inventoryTransfers:transfer')

/** A carried or equipped club that raises the hit point maximum by five. */
const toughClub = {
  ...club,
  modifiers: [
    {
      id: '71000000-0000-4000-8000-000000000001',
      grantKind: 'MODIFIER_GRANT' as const,
      valueDomainCode: 'HIT_POINTS_MAX' as const,
      domain: {},
      modifierKind: 'BONUS' as const,
      scope: 'GLOBAL' as const,
      selectionKind: 'GRANTED' as const,
      payload: { valueKind: 'FIXED' as const, amount: 5 },
      order: 0
    }
  ]
}

async function setup(equipment?: typeof club) {
  const base = await readySheetFixture({}, equipment)
  const campaign = await base.other.caller.mutation(createCampaign, {
    name: 'Stored maximum hit points',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.owner.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  )
  await base.owner.caller.mutation(assign, {
    campaignId: campaign.id,
    characterId: base.character.id
  })
  const read = async () => {
    const { character: row } = await base.readState()
    const sheet = await base.owner.caller.query(api.characters.sheet.get, { id: base.character.id })
    if (!row || !sheet) throw new Error('Missing Character.')
    return { row, sheet }
  }
  return { ...base, campaign, read }
}

describe('stored Character effective maximum hit points', () => {
  it('is set on creation and follows a Builder write', async () => {
    const fixture = await setup()
    const created = await fixture.read()
    expect(created.row.maximumHitPoints).toBe(created.sheet.overview.maxHitPoints)
    expect(created.row.maximumHitPoints).toBeGreaterThan(0)

    // Swap Strength 15 and Constitution 13: the Constitution modifier rises from +1 to +2.
    const current = characterAuthoredDtoSchema.parse(JSON.parse(created.row.documentJson))
    const abilities = current.intent.abilities
    if (abilities?.method !== 'STANDARD_ARRAY') throw new Error('Expected a standard array.')
    const draft = await fixture.owner.caller.mutation(api.characters.drafts.create, {
      id: current.id,
      systemId: srdSystemRecord.id
    })
    await fixture.owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: draft.id,
      mode: 'edit',
      character: {
        ...current,
        intent: {
          ...current.intent,
          abilities: {
            ...abilities,
            assignments: abilities.assignments.map((assignment) =>
              assignment.ability === 'STRENGTH'
                ? { ...assignment, option: '13' as const }
                : assignment.ability === 'CONSTITUTION'
                  ? { ...assignment, option: '15' as const }
                  : assignment
            )
          }
        }
      }
    })
    const edited = await fixture.read()
    expect(edited.row.maximumHitPoints).toBe(edited.sheet.overview.maxHitPoints)
    expect(edited.row.maximumHitPoints).toBe(created.row.maximumHitPoints + 1)
  })

  it('follows a GM Campaign maximum hit point adjustment without advancing the stream', async () => {
    const fixture = await setup()
    const before = await fixture.read()
    await fixture.other.caller.mutation(api.campaigns.gmWrites.saveAdjustment, {
      campaignId: fixture.campaign.id,
      characterId: fixture.character.id,
      adjustment: {
        id: crypto.randomUUID(),
        family: 'HIT_POINTS',
        field: 'MAXIMUM_MODIFIER',
        value: 4,
        sourceNote: 'Blessing of vigor'
      },
      visibility: 'VISIBLE',
      expectedVersion: 0
    })
    const after = await fixture.read()
    expect(after.row.maximumHitPoints).toBe(before.row.maximumHitPoints + 4)
    expect(after.row.streamVersion).toBe(before.row.streamVersion)
  })

  it('drops an item bonus when inventory custody moves the item out', async () => {
    const fixture = await setup(toughClub)
    const carried = await fixture.read()
    const item = carried.sheet.inventory.items.find((entry) => entry.equipmentId === club.id)
    if (!item) throw new Error('Missing tough club.')
    await fixture.owner.caller.mutation(api.characters.sheetCommands.execute, {
      id: fixture.character.id,
      command: {
        type: 'EQUIP_ITEM',
        commandId: crypto.randomUUID(),
        expectedVersion: carried.row.streamVersion,
        itemId: item.id
      }
    })
    const equipped = await fixture.read()
    expect(equipped.row.maximumHitPoints).toBe(equipped.sheet.overview.maxHitPoints)
    await fixture.owner.caller.mutation(transfer, {
      input: {
        kind: 'ITEM',
        campaignId: fixture.campaign.id,
        source: { kind: 'CHARACTER', characterId: fixture.character.id },
        destination: { kind: 'CAMPAIGN', campaignId: fixture.campaign.id },
        itemId: item.id,
        amount: item.quantity,
        expectedSourceVersion: equipped.row.streamVersion,
        expectedDestinationVersion: 0,
        idempotencyKey: crypto.randomUUID()
      }
    })
    const moved = await fixture.read()
    expect(moved.row.maximumHitPoints).toBe(moved.sheet.overview.maxHitPoints)
    expect(moved.row.maximumHitPoints).toBe(equipped.row.maximumHitPoints - 5)
  })
})
