import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'
import type {
  CharacterRestPreviewResponseDto,
  CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characters'
import type { CharacterSheetAdjustment } from '@artificer-toolkit/shared/character'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  character: '00000000-0000-4000-8000-000000000002',
  player: '00000000-0000-4000-8000-000000000003',
  owner: '00000000-0000-4000-8000-000000000004',
  playerAdjustment: '00000000-0000-4000-8000-000000000005',
  campaignAdjustment: '00000000-0000-4000-8000-000000000006',
  visibleCondition: '00000000-0000-4000-8000-000000000007',
  secretCondition: '00000000-0000-4000-8000-000000000008',
  conditionType: '00000000-0000-4000-8000-000000000009'
}

const mocks = vi.hoisted(() => ({
  findAssignedCampaign: vi.fn(),
  listAdjustments: vi.fn(),
  resolveAuthority: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createCampaignContentRepository: () => ({
      findAssignedCampaign: mocks.findAssignedCampaign
    }),
    createCampaignAdjustmentsRepository: () => ({
      listAdjustments: mocks.listAdjustments
    })
  }
})

vi.mock('../campaign/campaignService.js', () => ({
  resolveCampaignAuthority: mocks.resolveAuthority,
  assertActiveCampaignMember: vi.fn()
}))

const {
  getCharacterSheetDisplayAdjustments,
  getVisibleCampaignConditions,
  filterCharacterHistoryForViewer,
  mergeCampaignSheetAdjustments,
  projectCharacterRestForViewer,
  projectCharacterSheetForViewer,
  resolveCharacterSheetCampaignContext
} = await import('./campaignCharacterSheet.js')
const { assertCampaignGmSheetCommandAllowed } = await import('./sheetCommandValidation.js')

const metadata = {
  characterId: ids.character,
  createdBy: ids.player,
  updatedBy: ids.player,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z'
}

function hitPointAdjustment(
  id: string,
  value: number,
  createdBy = ids.player
): CharacterSheetAdjustment {
  return {
    ...metadata,
    id,
    createdBy,
    updatedBy: createdBy,
    family: 'HIT_POINTS',
    field: 'MAXIMUM_OVERRIDE',
    value
  }
}

describe('Campaign Character Sheet authority and projection', () => {
  beforeEach(() => vi.resetAllMocks())

  it('denies a user who neither owns the Character nor its Campaign', async () => {
    mocks.findAssignedCampaign.mockResolvedValue(null)

    await expect(
      resolveCharacterSheetCampaignContext(
        {} as DBLike,
        { id: ids.character, userId: ids.player } as CharacterAuthored,
        ids.owner
      )
    ).rejects.toMatchObject({ name: 'AuthoredContentOwnershipError' })
  })

  it('propagates the Campaign attunement slot override', async () => {
    mocks.findAssignedCampaign.mockResolvedValue({ campaignId: ids.campaign })
    mocks.resolveAuthority.mockResolvedValue({
      campaign: { status: 'ACTIVE', contentMaturity: 'STANDARD', attunementSlotOverride: 4 },
      membership: { role: 'PLAYER' }
    })
    mocks.listAdjustments.mockResolvedValue([])

    await expect(
      resolveCharacterSheetCampaignContext(
        {} as DBLike,
        { id: ids.character, userId: ids.player } as CharacterAuthored,
        ids.player
      )
    ).resolves.toMatchObject({ attunementSlotOverride: 4 })
  })

  it('lets Campaign slots replace player slots and restores the player value after deletion', () => {
    const player = hitPointAdjustment(ids.playerAdjustment, 12)
    const campaign = hitPointAdjustment(ids.campaignAdjustment, 17, ids.owner)

    expect(mergeCampaignSheetAdjustments([player], [campaign])).toEqual([campaign])
    expect(mergeCampaignSheetAdjustments([player], [])).toEqual([player])
  })

  it('keeps secret totals while omitting secret sources and conditions from the player view', () => {
    const player = hitPointAdjustment(ids.playerAdjustment, 12)
    const campaign = hitPointAdjustment(ids.campaignAdjustment, 17, ids.owner)
    const context = {
      viewer: 'CHARACTER_OWNER' as const,
      campaignId: ids.campaign,
      campaignStatus: 'ACTIVE' as const,
      contentMaturity: 'MATURE' as const,
      attunementSlotOverride: null,
      adjustments: [campaign],
      secretAdjustmentIds: new Set([campaign.id]),
      conditions: [
        {
          id: ids.visibleCondition,
          campaignId: ids.campaign,
          characterId: ids.character,
          conditionTypeId: ids.conditionType,
          visibility: 'VISIBLE' as const,
          version: 0,
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z'
        },
        {
          id: ids.secretCondition,
          campaignId: ids.campaign,
          characterId: ids.character,
          conditionTypeId: ids.secretCondition,
          visibility: 'SECRET' as const,
          version: 0,
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z'
        }
      ]
    }
    const projected = projectCharacterSheetForViewer(
      {
        overview: {
          maxHitPoints: 17,
          maxHitPointsOverride: 17,
          maxHitPointsModifier: 0,
          maxHitPointsModifierAdjustmentId: null
        }
      } as unknown as CharacterSheetResponseDto,
      context
    )

    expect(projected.overview.maxHitPoints).toBe(17)
    expect(projected.overview.maxHitPointsOverride).toBeNull()
    expect(projected.meta).toMatchObject({
      campaignId: ids.campaign,
      viewer: 'CHARACTER_OWNER',
      capabilities: {
        managePlayState: true,
        managePrivateNotes: true,
        manageInventory: true,
        openBuilder: true
      }
    })
    expect(getCharacterSheetDisplayAdjustments([player], context)).toEqual([])
    expect(getVisibleCampaignConditions(context)).toEqual([{ conditionTypeId: ids.conditionType }])

    const gmProjection = projectCharacterSheetForViewer(
      {
        meta: { characterId: ids.character, hasBuilderDraft: true },
        actions: { items: [] },
        inventory: { items: [], currencies: [], containers: [] },
        extras: { items: [] },
        resources: { items: [] },
        spells: { spells: [], activeGroups: [] },
        reference: { features: [] },
        notes: {
          alignment: 'lawful-good',
          notes: 'Private character notes',
          groups: [{ id: 'private', label: 'Private', sortOrder: 0, kind: 'CUSTOM' }],
          items: [
            {
              id: 'private-note',
              title: 'Private note',
              body: 'Hidden detail',
              groupId: 'private',
              pinned: false,
              createdAt: '2026-08-01T00:00:00.000Z',
              updatedAt: '2026-08-01T00:00:00.000Z'
            }
          ]
        }
      } as unknown as CharacterSheetResponseDto,
      { ...context, viewer: 'CAMPAIGN_OWNER' }
    )
    expect(gmProjection.meta).toMatchObject({
      campaignId: ids.campaign,
      viewer: 'CAMPAIGN_OWNER',
      capabilities: {
        managePlayState: true,
        managePrivateNotes: false,
        manageInventory: true,
        openBuilder: false
      }
    })
    expect(gmProjection.meta.hasBuilderDraft).toBe(false)
    expect(gmProjection.notes).toEqual({ alignment: 'lawful-good' })
  })

  it('omits GM-authored Character history from the Character owner', () => {
    const events = [
      { eventId: ids.visibleCondition, actorId: ids.player },
      { eventId: ids.secretCondition, actorId: ids.owner }
    ]
    expect(
      filterCharacterHistoryForViewer(
        events as unknown as Parameters<typeof filterCharacterHistoryForViewer>[0],
        ids.player,
        'CHARACTER_OWNER'
      ).map((event) => event.eventId)
    ).toEqual([ids.visibleCondition])
    expect(
      filterCharacterHistoryForViewer(
        events as unknown as Parameters<typeof filterCharacterHistoryForViewer>[0],
        ids.player,
        'CAMPAIGN_OWNER'
      )
    ).toHaveLength(2)
  })

  it('redacts Campaign-owner private customization from sheets and derived panel inputs', () => {
    const sentinel = 'PRIVATE-SENTINEL'
    const projected = projectCharacterSheetForViewer(
      {
        meta: { characterId: ids.character, hasBuilderDraft: true },
        actions: { items: [{ sourceLabel: sentinel }] },
        inventory: {
          items: [
            {
              id: 'item-1',
              equipmentId: 'equipment-1',
              label: sentinel,
              equipmentLabel: 'Longsword',
              customName: sentinel,
              notes: sentinel
            }
          ],
          currencies: [],
          containers: [{ id: 'item-1', label: sentinel, itemIds: [], currencies: [] }]
        },
        resources: {
          items: [
            {
              id: 'item-resource',
              owner: { kind: 'ITEM_INSTANCE', itemInstanceId: 'item-1', chargeId: 'charge-1' },
              label: `${sentinel} charges`,
              sourceLabel: sentinel
            }
          ]
        },
        extras: {
          items: [
            {
              id: 'companion-1',
              kind: 'COMPANION',
              authoredName: 'Wolf',
              displayName: sentinel,
              customName: sentinel,
              notes: sentinel
            },
            {
              id: 'vehicle-1',
              kind: 'VEHICLE',
              authoredName: 'Wagon',
              displayName: sentinel,
              customName: sentinel,
              notes: sentinel
            }
          ]
        },
        spells: {
          spells: [
            {
              id: 'spell-1',
              label: 'Magic Missile',
              sources: [
                {
                  source: {
                    spellId: 'spell-1',
                    sourceKind: 'FEATURE',
                    sourceInstanceId: 'feature-1'
                  },
                  label: 'Feature',
                  customName: sentinel,
                  notes: sentinel
                }
              ]
            }
          ],
          activeGroups: [
            {
              level: 1,
              label: 'Level 1',
              entries: [{ spellId: 'spell-1', displayName: sentinel }]
            }
          ]
        },
        reference: {
          features: [
            {
              id: 'feature-1',
              label: 'Charge',
              sourceLabel: sentinel,
              source: {
                kind: 'EQUIPMENT_INSTANCE',
                equipmentId: 'equipment-1',
                itemInstanceId: 'item-1'
              }
            }
          ]
        },
        notes: { notes: sentinel }
      } as unknown as CharacterSheetResponseDto,
      {
        viewer: 'CAMPAIGN_OWNER',
        campaignId: ids.campaign,
        campaignStatus: 'ACTIVE',
        contentMaturity: 'MATURE',
        attunementSlotOverride: null,
        adjustments: [],
        secretAdjustmentIds: new Set(),
        conditions: []
      }
    )

    expect(projected.inventory.items[0]).toMatchObject({ label: 'Longsword' })
    expect(projected.extras.items.map((item) => item.displayName)).toEqual(['Wolf', 'Wagon'])
    expect(projected.spells.spells[0]?.sources?.[0]).toMatchObject({ label: 'Feature' })
    expect(projected.spells.activeGroups[0]?.entries[0]?.displayName).toBe('Magic Missile')
    expect(JSON.stringify(projected)).not.toContain(sentinel)
  })

  it('redacts Campaign-owner rest reset metadata', () => {
    const preview = {
      hitPoints: {
        maximumHitPointModifier: 3,
        canResetMaximumHitPointModifier: true
      }
    } as CharacterRestPreviewResponseDto
    const projected = projectCharacterRestForViewer(preview, {
      viewer: 'CAMPAIGN_OWNER',
      campaignId: ids.campaign,
      campaignStatus: 'ACTIVE',
      contentMaturity: 'MATURE',
      attunementSlotOverride: null,
      adjustments: [],
      secretAdjustmentIds: new Set(),
      conditions: []
    })

    expect(projected.hitPoints).toMatchObject({
      maximumHitPointModifier: 0,
      canResetMaximumHitPointModifier: false
    })
  })
})

describe('Campaign GM Sheet command allowlist', () => {
  it('allows mechanics and inventory commands, and rejects player notes and Sheet adjustments', () => {
    expect(() =>
      assertCampaignGmSheetCommandAllowed({
        type: 'ADJUST_HIT_POINTS',
        commandId: ids.campaign,
        expectedVersion: 0,
        mode: 'DAMAGE',
        amount: 3
      })
    ).not.toThrow()
    expect(() =>
      assertCampaignGmSheetCommandAllowed({
        type: 'ADD_INVENTORY_ITEM',
        commandId: ids.campaign,
        expectedVersion: 0,
        equipmentId: ids.conditionType,
        quantity: 1
      })
    ).not.toThrow()
    expect(() =>
      assertCampaignGmSheetCommandAllowed({
        type: 'ADJUST_CURRENCY',
        commandId: ids.campaign,
        expectedVersion: 0,
        currencyId: ids.conditionType,
        amount: 1
      })
    ).not.toThrow()
    expect(() =>
      assertCampaignGmSheetCommandAllowed({
        type: 'CREATE_NOTE',
        commandId: ids.campaign,
        expectedVersion: 0,
        title: 'Private',
        groupId: ids.visibleCondition
      })
    ).toThrow(/Campaign owners cannot apply CREATE_NOTE/)
    expect(() =>
      assertCampaignGmSheetCommandAllowed({
        type: 'UPSERT_SHEET_ADJUSTMENT',
        commandId: ids.campaign,
        expectedVersion: 0,
        adjustment: {
          family: 'HIT_POINTS',
          field: 'MAXIMUM_MODIFIER',
          value: 2
        }
      })
    ).toThrow(/Campaign owners cannot apply UPSERT_SHEET_ADJUSTMENT/)
    expect(() =>
      assertCampaignGmSheetCommandAllowed({
        type: 'COMPLETE_REST',
        commandId: ids.campaign,
        expectedVersion: 0,
        restKind: 'LONG',
        previewFingerprint: 'fingerprint',
        selectedHitDice: [],
        resetMaximumHitPointModifier: false,
        healingMode: 'AUTOMATIC',
        manualHealingAccepted: false,
        selectedCompanionInstanceIds: []
      })
    ).not.toThrow()
    expect(() =>
      assertCampaignGmSheetCommandAllowed({
        type: 'COMPLETE_REST',
        commandId: ids.campaign,
        expectedVersion: 0,
        restKind: 'LONG',
        previewFingerprint: 'fingerprint',
        selectedHitDice: [],
        resetMaximumHitPointModifier: true,
        healingMode: 'AUTOMATIC',
        manualHealingAccepted: false,
        selectedCompanionInstanceIds: []
      })
    ).toThrow(/Campaign owners cannot apply COMPLETE_REST/)
    expect(() =>
      assertCampaignGmSheetCommandAllowed({
        type: 'UPDATE_INVENTORY_ITEM',
        commandId: ids.campaign,
        expectedVersion: 0,
        itemId: ids.character,
        quantity: 2
      })
    ).not.toThrow()
    expect(() =>
      assertCampaignGmSheetCommandAllowed({
        type: 'UPDATE_INVENTORY_ITEM',
        commandId: ids.campaign,
        expectedVersion: 0,
        itemId: ids.character,
        customName: null
      })
    ).toThrow(/Campaign owners cannot apply UPDATE_INVENTORY_ITEM/)
  })
})
