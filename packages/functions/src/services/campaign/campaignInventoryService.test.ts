import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  user: '00000000-0000-4000-8000-000000000002',
  character: '00000000-0000-4000-8000-000000000003',
  otherCharacter: '00000000-0000-4000-8000-000000000004',
  campaignOwner: '00000000-0000-4000-8000-000000000005',
  characterOwner: '00000000-0000-4000-8000-000000000006',
  event: '00000000-0000-4000-8000-000000000007',
  item: '00000000-0000-4000-8000-000000000008',
  nonce: '00000000-0000-4000-8000-000000000009',
  otherCharacterOwner: '00000000-0000-4000-8000-000000000010'
}

const mocks = vi.hoisted(() => ({
  authority: vi.fn(),
  assertCampaignOwner: vi.fn(),
  inventory: {
    findCampaignEventByIdempotency: vi.fn(),
    getInventoryByOwnerId: vi.fn(),
    resolveOwner: vi.fn(),
    lockOwners: vi.fn(),
    lockItem: vi.fn(),
    hasContainerContents: vi.fn(),
    moveItemStack: vi.fn(),
    decrementItemStack: vi.fn(),
    insertTransferredItem: vi.fn(),
    insertPartyItem: vi.fn(),
    updatePartyItemQuantity: vi.fn(),
    removePartyItem: vi.fn(),
    incrementVersions: vi.fn(),
    insertInventoryEvent: vi.fn(),
    insertCustodyEvent: vi.fn(),
    lockCurrencyBalances: vi.fn(),
    upsertUngroupedCurrencyBalance: vi.fn(),
    decrementCurrency: vi.fn(),
    findDenomination: vi.fn(),
    getCurrencySystem: vi.fn(),
    listInventoryAuditEvents: vi.fn(),
    moveCharacterCampaignCurrencyToCampaign: vi.fn(),
    listCurrencySystems: vi.fn(),
    insertCurrencySystem: vi.fn(),
    updateCurrencySystem: vi.fn(),
    lockCurrencySystemBalances: vi.fn(),
    replaceCurrencyDenominations: vi.fn()
  },
  campaign: { findAssignmentByCharacter: vi.fn(), lockCampaign: vi.fn() },
  broadcast: vi.fn(),
  transaction: { isTransaction: true }
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createInventoryRepository: () => mocks.inventory,
    createCampaignRepository: () => mocks.campaign,
    withTransaction: (_db: DBLike, callback: (trx: DBLike) => Promise<unknown>) =>
      callback(mocks.transaction as DBLike)
  }
})

vi.mock('./campaignService.js', () => {
  class CampaignAccessError extends Error {}
  class CampaignConflictError extends Error {}
  class CampaignNotFoundError extends Error {}
  class CampaignValidationError extends Error {}
  return {
    CampaignAccessError,
    CampaignConflictError,
    CampaignNotFoundError,
    CampaignValidationError,
    assertActiveCampaignMember: vi.fn(),
    assertCampaignOwner: mocks.assertCampaignOwner,
    assertCampaignWritable: vi.fn(),
    resolveCampaignAuthority: mocks.authority
  }
})

vi.mock('./realtimeService.js', () => ({ broadcastCampaignInvalidation: mocks.broadcast }))

const {
  reconcileCampaignCurrencyDeparture,
  getCampaignInventory,
  saveCampaignCurrencySystem,
  mutateCampaignPartyInventory,
  transferCampaignInventory
} = await import('./campaignInventoryService.js')

function playerAuthority() {
  return {
    campaign: { id: ids.campaign, status: 'ACTIVE' as const, contentMaturity: 'MATURE' as const },
    membership: { role: 'PLAYER' as const, status: 'ACTIVE' as const },
    assignedCharacter: { id: ids.character, label: 'Nia', systemId: ids.campaign }
  }
}

describe('Campaign inventory service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.authority.mockResolvedValue(playerAuthority())
    mocks.campaign.lockCampaign.mockResolvedValue({ id: ids.campaign })
    mocks.inventory.findCampaignEventByIdempotency.mockResolvedValue(null)
    mocks.inventory.getInventoryByOwnerId.mockResolvedValue({
      owner: {
        id: ids.campaignOwner,
        kind: 'CAMPAIGN',
        campaignId: ids.campaign,
        characterId: null,
        version: 2
      },
      items: [
        {
          id: ids.item,
          ownerId: ids.campaignOwner,
          equipmentId: ids.item,
          equipmentLabel: 'Bag',
          quantity: 1,
          containerId: null,
          isContainer: true,
          customName: null,
          notes: null,
          equipped: false,
          attuned: false,
          placementKind: null,
          placementId: null
        }
      ],
      currencies: [
        {
          id: 'balance-a',
          ownerId: ids.campaignOwner,
          groupId: 'group-a',
          containerId: ids.item,
          denomination: {
            kind: 'RULESET',
            id: ids.item,
            systemId: ids.campaign,
            label: 'Gold',
            abbreviation: 'gp',
            scaleInReference: null
          },
          amount: 3n
        },
        {
          id: 'balance-b',
          ownerId: ids.campaignOwner,
          groupId: 'group-b',
          containerId: null,
          denomination: {
            kind: 'RULESET',
            id: ids.item,
            systemId: ids.campaign,
            label: 'Gold',
            abbreviation: 'gp',
            scaleInReference: null
          },
          amount: 5n
        }
      ]
    })
    mocks.campaign.findAssignmentByCharacter.mockImplementation(
      async (_campaignId: string, characterId: string) => ({
        userId: characterId === ids.character ? ids.user : '00000000-0000-4000-8000-000000000099'
      })
    )
    mocks.inventory.resolveOwner.mockImplementation(
      async (ref: { kind: string; characterId?: string }) =>
        ref.kind === 'CAMPAIGN'
          ? {
              id: ids.campaignOwner,
              kind: 'CAMPAIGN',
              campaignId: ids.campaign,
              characterId: null,
              version: 2
            }
          : {
              id:
                ref.characterId === ids.otherCharacter
                  ? ids.otherCharacterOwner
                  : ids.characterOwner,
              kind: 'CHARACTER',
              campaignId: null,
              characterId: ref.characterId ?? ids.character,
              version: ref.characterId === ids.otherCharacter ? 3 : 1
            }
    )
    mocks.inventory.lockOwners.mockResolvedValue([
      {
        id: ids.characterOwner,
        kind: 'CHARACTER',
        campaignId: null,
        characterId: ids.character,
        version: 1
      },
      {
        id: ids.campaignOwner,
        kind: 'CAMPAIGN',
        campaignId: ids.campaign,
        characterId: null,
        version: 2
      },
      {
        id: ids.otherCharacterOwner,
        kind: 'CHARACTER',
        campaignId: null,
        characterId: ids.otherCharacter,
        version: 3
      }
    ])
    mocks.inventory.lockItem.mockResolvedValue({
      id: ids.item,
      ownerId: ids.characterOwner,
      quantity: 1
    })
    mocks.inventory.hasContainerContents.mockResolvedValue(false)
    mocks.inventory.insertPartyItem.mockResolvedValue({
      id: ids.item,
      ownerId: ids.campaignOwner,
      equipmentId: ids.character,
      quantity: 2,
      containerId: null,
      customName: null,
      notes: null,
      equipped: false,
      attuned: false,
      placementKind: null,
      placementId: null
    })
    mocks.inventory.updatePartyItemQuantity.mockResolvedValue({ id: ids.item, quantity: 2 })
    mocks.inventory.removePartyItem.mockResolvedValue(true)
    mocks.inventory.moveItemStack.mockResolvedValue({ id: ids.item })
    mocks.inventory.incrementVersions.mockResolvedValue([])
    mocks.inventory.insertInventoryEvent.mockResolvedValue({ id: ids.event })
    mocks.inventory.insertCustodyEvent.mockResolvedValue({ id: ids.event })
    mocks.inventory.lockCurrencyBalances.mockResolvedValue([])
    mocks.inventory.upsertUngroupedCurrencyBalance.mockResolvedValue(undefined)
    mocks.inventory.decrementCurrency.mockResolvedValue([])
    mocks.inventory.findDenomination.mockResolvedValue({
      kind: 'RULESET',
      id: ids.item,
      systemId: ids.campaign,
      label: 'Gold',
      abbreviation: 'gp',
      scaleInReference: null
    })
    mocks.inventory.getCurrencySystem.mockResolvedValue(null)
    mocks.inventory.listInventoryAuditEvents.mockResolvedValue({ events: [], nextCursor: null })
    mocks.inventory.moveCharacterCampaignCurrencyToCampaign.mockResolvedValue([])
    mocks.inventory.listCurrencySystems.mockResolvedValue([])
    mocks.inventory.insertCurrencySystem.mockResolvedValue({
      id: ids.item,
      campaignId: ids.campaign,
      name: 'Imperial',
      isReference: true,
      version: 1,
      denominations: []
    })
    mocks.inventory.lockCurrencySystemBalances.mockResolvedValue([])
    mocks.inventory.replaceCurrencyDenominations.mockResolvedValue([])
  })

  it('keeps same-denomination campaign currency balances in their containers', async () => {
    await expect(
      getCampaignInventory({} as DBLike, ids.user, ids.campaign, {
        kind: 'CAMPAIGN',
        campaignId: ids.campaign
      })
    ).resolves.toMatchObject({
      items: [{ id: ids.item, isContainer: true }],
      currencies: [
        { amount: 3, containerId: ids.item },
        { amount: 5, containerId: null }
      ]
    })
  })

  it('masks shared inventory labels for a Standard Campaign', async () => {
    mocks.authority.mockResolvedValue({
      ...playerAuthority(),
      campaign: { ...playerAuthority().campaign, contentMaturity: 'STANDARD' }
    })
    mocks.inventory.getInventoryByOwnerId.mockResolvedValueOnce({
      owner: {
        id: ids.campaignOwner,
        kind: 'CAMPAIGN',
        campaignId: ids.campaign,
        characterId: null,
        version: 2
      },
      items: [
        {
          id: ids.item,
          equipmentId: ids.item,
          equipmentLabel: 'Sword',
          customName: 'shit sword',
          quantity: 1,
          containerId: null,
          isContainer: false
        }
      ],
      currencies: []
    })

    await expect(
      getCampaignInventory({} as DBLike, ids.user, ids.campaign, {
        kind: 'CAMPAIGN',
        campaignId: ids.campaign
      })
    ).resolves.toMatchObject({ items: [{ label: '**** sword' }] })
  })

  it('prevents players from reading another assigned Character inventory', async () => {
    await expect(
      getCampaignInventory({} as DBLike, ids.user, ids.campaign, {
        kind: 'CHARACTER',
        characterId: ids.otherCharacter
      })
    ).rejects.toThrow()
    expect(mocks.inventory.getInventoryByOwnerId).not.toHaveBeenCalled()
  })

  it('allows owners to read any assigned Character inventory', async () => {
    mocks.authority.mockResolvedValue({
      ...playerAuthority(),
      membership: { role: 'OWNER', status: 'ACTIVE' }
    })

    await expect(
      getCampaignInventory({} as DBLike, ids.user, ids.campaign, {
        kind: 'CHARACTER',
        characterId: ids.otherCharacter
      })
    ).resolves.toBeDefined()
  })

  it('allows players to give their inventory directly to another assigned Character', async () => {
    await expect(
      transferCampaignInventory({} as DBLike, ids.user, {
        kind: 'ITEM',
        campaignId: ids.campaign,
        source: { kind: 'CHARACTER', characterId: ids.character },
        destination: { kind: 'CHARACTER', characterId: ids.otherCharacter },
        itemId: ids.item,
        amount: 1,
        expectedSourceVersion: 1,
        expectedDestinationVersion: 3,
        idempotencyKey: ids.nonce
      })
    ).resolves.toEqual({ eventId: ids.event })
    expect(mocks.inventory.moveItemStack).toHaveBeenCalledWith({
      sourceOwnerId: ids.characterOwner,
      destinationOwnerId: ids.otherCharacterOwner,
      itemId: ids.item
    })
  })

  it('prevents players from taking inventory from another assigned Character', async () => {
    await expect(
      transferCampaignInventory({} as DBLike, ids.user, {
        kind: 'ITEM',
        campaignId: ids.campaign,
        source: { kind: 'CHARACTER', characterId: ids.otherCharacter },
        destination: { kind: 'CAMPAIGN', campaignId: ids.campaign },
        itemId: ids.item,
        amount: 1,
        expectedSourceVersion: 3,
        expectedDestinationVersion: 2,
        idempotencyKey: ids.nonce
      })
    ).rejects.toThrow()
    expect(mocks.inventory.lockOwners).not.toHaveBeenCalled()
  })

  it('prevents players from mutating party inventory', async () => {
    mocks.assertCampaignOwner.mockImplementationOnce(() => {
      throw new Error()
    })

    await expect(
      mutateCampaignPartyInventory({} as DBLike, ids.user, {
        kind: 'ITEM_ADD',
        campaignId: ids.campaign,
        equipmentId: ids.character,
        quantity: 2,
        expectedOwnerVersion: 2,
        idempotencyKey: ids.nonce
      })
    ).rejects.toThrow()
    expect(mocks.inventory.findCampaignEventByIdempotency).not.toHaveBeenCalled()
  })

  it('allows owners to adjust party currency and records before/after amounts', async () => {
    mocks.authority.mockResolvedValue({
      ...playerAuthority(),
      membership: { role: 'OWNER', status: 'ACTIVE' }
    })
    mocks.inventory.lockCurrencyBalances.mockResolvedValue([{ amount: 5n }])

    await expect(
      mutateCampaignPartyInventory({} as DBLike, ids.user, {
        kind: 'CURRENCY_ADJUST',
        campaignId: ids.campaign,
        denominationId: ids.item,
        amount: 7,
        expectedOwnerVersion: 2,
        idempotencyKey: ids.nonce
      })
    ).resolves.toEqual({ eventId: ids.event })
    expect(mocks.inventory.upsertUngroupedCurrencyBalance).toHaveBeenCalledWith(
      ids.campaignOwner,
      { kind: 'RULESET', id: ids.item },
      7n
    )
    expect(mocks.inventory.insertInventoryEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'PARTY_CURRENCY_ADJUST',
        payload: expect.objectContaining({ beforeAmount: '5', afterAmount: '12' })
      })
    )
  })

  it('does not let another member reuse a custody idempotency key', async () => {
    mocks.inventory.findCampaignEventByIdempotency.mockResolvedValue({
      id: ids.event,
      actorUserId: '00000000-0000-4000-8000-000000000099'
    })

    await expect(
      transferCampaignInventory({} as DBLike, ids.user, {
        kind: 'ITEM',
        campaignId: ids.campaign,
        source: { kind: 'CHARACTER', characterId: ids.character },
        destination: { kind: 'CAMPAIGN', campaignId: ids.campaign },
        itemId: ids.item,
        amount: 1,
        expectedSourceVersion: 1,
        expectedDestinationVersion: 2,
        idempotencyKey: ids.nonce
      })
    ).rejects.toThrow()
    expect(mocks.inventory.resolveOwner).not.toHaveBeenCalled()
    expect(mocks.campaign.lockCampaign).toHaveBeenCalledBefore(
      mocks.inventory.findCampaignEventByIdempotency
    )
  })

  it('returns an existing retry before checking stale inventory versions', async () => {
    mocks.inventory.findCampaignEventByIdempotency.mockResolvedValue({
      id: ids.event,
      actorUserId: ids.user
    })

    await expect(
      transferCampaignInventory({} as DBLike, ids.user, {
        kind: 'ITEM',
        campaignId: ids.campaign,
        source: { kind: 'CHARACTER', characterId: ids.character },
        destination: { kind: 'CAMPAIGN', campaignId: ids.campaign },
        itemId: ids.item,
        amount: 1,
        expectedSourceVersion: 99,
        expectedDestinationVersion: 99,
        idempotencyKey: ids.nonce
      })
    ).resolves.toEqual({ eventId: ids.event })
    expect(mocks.inventory.lockOwners).not.toHaveBeenCalled()
  })

  it('moves a full item stack, records custody, and invalidates after commit', async () => {
    await expect(
      transferCampaignInventory({} as DBLike, ids.user, {
        kind: 'ITEM',
        campaignId: ids.campaign,
        source: { kind: 'CHARACTER', characterId: ids.character },
        destination: { kind: 'CAMPAIGN', campaignId: ids.campaign },
        itemId: ids.item,
        amount: 1,
        expectedSourceVersion: 1,
        expectedDestinationVersion: 2,
        idempotencyKey: ids.nonce
      })
    ).resolves.toEqual({ eventId: ids.event })
    expect(mocks.inventory.moveItemStack).toHaveBeenCalledWith({
      sourceOwnerId: ids.characterOwner,
      destinationOwnerId: ids.campaignOwner,
      itemId: ids.item
    })
    expect(mocks.inventory.incrementVersions).toHaveBeenCalledWith([
      ids.characterOwner,
      ids.campaignOwner
    ])
    expect(mocks.inventory.insertCustodyEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          itemId: ids.item,
          beforeQuantity: 1,
          afterSourceQuantity: 0,
          afterDestinationQuantity: 1,
          custodyContext: {
            sourceOwnerId: ids.characterOwner,
            destinationOwnerId: ids.campaignOwner
          }
        })
      })
    )
    expect(mocks.broadcast).toHaveBeenCalledWith(
      expect.anything(),
      ids.campaign,
      expect.objectContaining({ entity: 'INVENTORY', event: 'UPDATED', eventId: ids.event })
    )
  })

  it('moves departing Campaign currency into party custody without broadcasting', async () => {
    mocks.inventory.moveCharacterCampaignCurrencyToCampaign.mockResolvedValue([
      {
        denomination: { id: ids.item },
        amount: 42n,
        sourceBalanceIds: ['00000000-0000-4000-8000-000000000010']
      }
    ])

    await expect(
      reconcileCampaignCurrencyDeparture({} as DBLike, {
        campaignId: ids.campaign,
        characterId: ids.character,
        actorUserId: ids.user,
        reason: 'MEMBER_REMOVED'
      })
    ).resolves.toMatchObject({ eventId: ids.event, moved: [{ amount: 42n }] })
    expect(mocks.inventory.incrementVersions).toHaveBeenCalledWith([
      ids.characterOwner,
      ids.campaignOwner
    ])
    expect(mocks.inventory.insertCustodyEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectCharacterId: ids.character,
        payload: expect.objectContaining({
          action: 'CUSTODY_TRANSFER',
          reason: 'MEMBER_REMOVED',
          denominations: [
            {
              denominationId: ids.item,
              amount: '42',
              beforeSourceAmount: '42',
              afterSourceAmount: '0'
            }
          ]
        })
      })
    )
    expect(mocks.broadcast).not.toHaveBeenCalled()
  })

  it('makes the first currency system the reference system', async () => {
    mocks.authority.mockResolvedValue({
      ...playerAuthority(),
      membership: { ...playerAuthority().membership, role: 'OWNER' }
    })

    await expect(
      saveCampaignCurrencySystem({} as DBLike, ids.user, {
        campaignId: ids.campaign,
        label: 'Imperial',
        isReference: false,
        denominations: [{ label: 'Gold', abbreviation: 'gp', scaleInReference: 1 }]
      })
    ).resolves.toMatchObject({ isReference: true })
    expect(mocks.inventory.insertCurrencySystem).toHaveBeenCalledWith(
      expect.objectContaining({ isReference: true })
    )
  })

  it('demotes the old reference before promoting another system', async () => {
    const oldSystem = {
      id: ids.item,
      campaignId: ids.campaign,
      name: 'Old',
      isReference: true,
      version: 1,
      denominations: [
        {
          id: ids.nonce,
          systemId: ids.item,
          name: 'Gold',
          abbreviation: 'gp',
          scaleInReference: 1n,
          sortOrder: 0
        }
      ]
    }
    const nextSystem = {
      id: ids.event,
      campaignId: ids.campaign,
      name: 'New',
      isReference: false,
      version: 1,
      denominations: [
        {
          id: ids.character,
          systemId: ids.event,
          name: 'Silver',
          abbreviation: 'sp',
          scaleInReference: 1n,
          sortOrder: 0
        }
      ]
    }
    mocks.authority.mockResolvedValue({
      ...playerAuthority(),
      membership: { ...playerAuthority().membership, role: 'OWNER' }
    })
    mocks.inventory.listCurrencySystems.mockResolvedValue([oldSystem, nextSystem])
    mocks.inventory.updateCurrencySystem.mockResolvedValueOnce({
      ...oldSystem,
      isReference: false,
      version: 2
    })
    mocks.inventory.updateCurrencySystem.mockResolvedValueOnce({
      ...nextSystem,
      isReference: true,
      version: 2
    })

    await saveCampaignCurrencySystem({} as DBLike, ids.user, {
      campaignId: ids.campaign,
      systemId: ids.event,
      expectedVersion: 1,
      label: 'New',
      isReference: true,
      denominations: [
        { id: ids.character, label: 'Silver', abbreviation: 'sp', scaleInReference: 1 }
      ]
    })

    expect(mocks.inventory.updateCurrencySystem).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: ids.item, isReference: false })
    )
  })

  it('invalidates converted inventory versions and rejects unsafe conversion results', async () => {
    const system = {
      id: ids.item,
      campaignId: ids.campaign,
      name: 'Imperial',
      isReference: true,
      version: 1,
      denominations: [
        {
          id: ids.nonce,
          systemId: ids.item,
          name: 'Gold',
          abbreviation: 'gp',
          scaleInReference: 2n,
          sortOrder: 0
        }
      ]
    }
    mocks.authority.mockResolvedValue({
      ...playerAuthority(),
      membership: { ...playerAuthority().membership, role: 'OWNER' }
    })
    mocks.inventory.listCurrencySystems.mockResolvedValue([system])
    mocks.inventory.updateCurrencySystem.mockResolvedValue({ ...system, version: 2 })
    mocks.inventory.lockCurrencySystemBalances.mockResolvedValue([
      {
        id: ids.event,
        ownerId: ids.characterOwner,
        groupId: null,
        denominationId: ids.nonce,
        amount: 2n
      }
    ])

    await saveCampaignCurrencySystem({} as DBLike, ids.user, {
      campaignId: ids.campaign,
      systemId: ids.item,
      expectedVersion: 1,
      label: 'Imperial',
      isReference: true,
      denominations: [{ id: ids.nonce, label: 'Gold', abbreviation: 'gp', scaleInReference: 1 }]
    })
    expect(mocks.inventory.incrementVersions).toHaveBeenCalledWith([ids.characterOwner])

    mocks.inventory.lockCurrencySystemBalances.mockResolvedValue([
      {
        id: ids.event,
        ownerId: ids.characterOwner,
        groupId: null,
        denominationId: ids.nonce,
        amount: BigInt(Number.MAX_SAFE_INTEGER) + 1n
      }
    ])
    await expect(
      saveCampaignCurrencySystem({} as DBLike, ids.user, {
        campaignId: ids.campaign,
        systemId: ids.item,
        expectedVersion: 1,
        label: 'Imperial',
        isReference: true,
        denominations: [{ id: ids.nonce, label: 'Gold', abbreviation: 'gp', scaleInReference: 1 }]
      })
    ).rejects.toThrow('Inventory amount exceeds the supported range.')
  })
})
