import { describe, expect, it } from 'vitest'

import {
  acceptCampaignOwnershipTransferInputSchema,
  advanceCampaignClockInputSchema,
  campaignContentSharesDtoSchema,
  campaignCharacterSummaryDtoSchema,
  campaignConversationDtoSchema,
  campaignRealtimeEnvelopeDtoSchema,
  saveCampaignConditionInputSchema,
  createCampaignInputSchema,
  currencySystemDtoSchema,
  campaignPartyInventoryMutationInputSchema,
  listCampaignInventoryAuditInputSchema,
  entitlementProjectionDtoSchema,
  executeCampaignRollInputSchema,
  getCampaignInventoryInputSchema,
  inventoryCurrencyDtoSchema,
  inventoryItemDtoSchema,
  shareCampaignContentInputSchema,
  sendCampaignChatEntryInputSchema,
  transferCampaignInventoryInputSchema,
  createCampaignNotebookSectionInputSchema,
  configureCampaignClockInputSchema,
  copyCampaignInputSchema,
  updateCampaignNotebookSectionInputSchema,
  updateCampaignInputSchema
} from '../api/campaigns.js'

const id = 'f3e3a390-5b22-4a1f-8a0b-bf7f184bd7c9'

describe('campaign contracts', () => {
  const seededId = '00000000-0000-0000-0080-000100000000'

  it('requires a copy command ID for exact retry semantics', () => {
    expect(
      copyCampaignInputSchema.safeParse({ campaignId: id, commandId: id, expectedVersion: 1 })
        .success
    ).toBe(true)
    expect(copyCampaignInputSchema.safeParse({ campaignId: id, expectedVersion: 1 }).success).toBe(
      false
    )
  })

  it('rejects clock values that cannot be represented safely', () => {
    const command = {
      campaignId: id,
      commandId: id,
      expectedVersion: 1
    }

    expect(
      advanceCampaignClockInputSchema.safeParse({
        ...command,
        minutes: Number.MAX_SAFE_INTEGER + 1
      }).success
    ).toBe(false)
    expect(
      configureCampaignClockInputSchema.safeParse({
        ...command,
        day: Number.MAX_SAFE_INTEGER + 1
      }).success
    ).toBe(false)
  })

  it('accepts deterministic Postgres UUIDs for seeded Character systems', () => {
    expect(
      campaignCharacterSummaryDtoSchema.safeParse({
        id,
        publicId: 'abc12',
        label: 'Elara Dawnshield',
        systemId: '00000000-0000-0000-0000-000000000001'
      }).success
    ).toBe(true)
  })

  it('requires read-only USD tier pricing metadata', () => {
    const projection = {
      tier: 'PLAYER',
      limits: {
        storageBytes: 1024 * 1024 * 1024,
        personalCharacters: null,
        homebrewRoots: null,
        activeHostedCampaigns: 1,
        playerSeatsPerCampaign: 5,
        publicListings: 1,
        savedEncounters: 3,
        paidTablesEnabled: false,
        platformFeeBasisPoints: 0
      },
      usage: {
        storageBytes: 0,
        personalCharacters: 0,
        homebrewRoots: 0,
        activeHostedCampaigns: 0,
        publicListings: 0,
        savedEncounters: 0
      },
      pricing: { currency: 'USD', monthlyPriceCents: 499, annualPriceCents: 4999 }
    }

    expect(entitlementProjectionDtoSchema.safeParse(projection).success).toBe(true)
    expect(
      entitlementProjectionDtoSchema.safeParse({
        ...projection,
        pricing: { ...projection.pricing, currency: 'EUR' }
      }).success
    ).toBe(false)
  })

  it('caps currency denominations at five', () => {
    const denomination = (index: number) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      label: `Coin ${index}`,
      abbreviation: `C${index}`,
      scaleInReference: 1
    })

    expect(
      currencySystemDtoSchema.safeParse({
        id,
        label: 'Gold',
        isReference: true,
        version: 0,
        denominations: Array.from({ length: 5 }, (_, index) => denomination(index))
      }).success
    ).toBe(true)
    expect(
      currencySystemDtoSchema.safeParse({
        id,
        label: 'Gold',
        isReference: true,
        version: 0,
        denominations: Array.from({ length: 6 }, (_, index) => denomination(index))
      }).success
    ).toBe(false)
    expect(
      currencySystemDtoSchema.safeParse({
        id,
        label: 'Gold',
        isReference: true,
        version: 0,
        denominations: [{ id, label: 'Gold', scaleInReference: 1 }]
      }).success
    ).toBe(false)
  })

  it('separates chat text from server-executed Campaign rolls', () => {
    const input = {
      campaignId: id,
      room: 'TABLE' as const,
      mode: 'OOC' as const,
      body: 'Hello party',
      clientNonce: '679e53e2-b57c-417a-bfa8-b0ea343d4277'
    }

    expect(sendCampaignChatEntryInputSchema.safeParse(input).success).toBe(true)
    expect(sendCampaignChatEntryInputSchema.safeParse({ ...input, roll: {} }).success).toBe(false)
    expect(sendCampaignChatEntryInputSchema.safeParse({ ...input, mode: undefined }).success).toBe(
      false
    )
    expect(
      sendCampaignChatEntryInputSchema.safeParse({ ...input, body: 'x'.repeat(2001) }).success
    ).toBe(false)
    expect(sendCampaignChatEntryInputSchema.safeParse({ ...input, mode: 'ROLEPLAY' }).success).toBe(
      false
    )
    expect(
      sendCampaignChatEntryInputSchema.safeParse({
        ...input,
        mode: 'ROLEPLAY',
        assignedCharacterId: id
      }).success
    ).toBe(true)
    expect(
      sendCampaignChatEntryInputSchema.safeParse({ ...input, assignedCharacterId: id }).success
    ).toBe(false)

    const roll = {
      campaignId: id,
      room: 'TABLE' as const,
      clientNonce: '679e53e2-b57c-417a-bfa8-b0ea343d4277',
      roll: {
        characterId: id,
        expression: '1d20 + 5',
        source: { kind: 'MANUAL' as const, label: 'Campaign roll' }
      }
    }
    expect(executeCampaignRollInputSchema.safeParse(roll).success).toBe(true)
    expect(executeCampaignRollInputSchema.safeParse({ ...roll, rollEvidence: {} }).success).toBe(
      false
    )
    expect(executeCampaignRollInputSchema.safeParse({ ...roll, room: 'PARTY' }).success).toBe(false)
    expect(
      executeCampaignRollInputSchema.safeParse({
        ...roll,
        roll: { ...roll.roll, characterId: null }
      }).success
    ).toBe(true)
    expect(
      sendCampaignChatEntryInputSchema.safeParse({
        ...input,
        room: 'DIRECT',
        directUserId: id
      }).success
    ).toBe(true)
    expect(sendCampaignChatEntryInputSchema.safeParse({ ...input, room: 'DIRECT' }).success).toBe(
      false
    )
  })

  it('requires positive safe-integer inventory transfers', () => {
    const input = {
      kind: 'ITEM' as const,
      campaignId: id,
      source: { kind: 'CAMPAIGN' as const, campaignId: id },
      destination: { kind: 'CHARACTER' as const, characterId: id },
      itemId: id,
      amount: 1,
      expectedSourceVersion: 0,
      expectedDestinationVersion: 0,
      idempotencyKey: id
    }

    expect(transferCampaignInventoryInputSchema.safeParse(input).success).toBe(true)
    expect(transferCampaignInventoryInputSchema.safeParse({ ...input, amount: 0 }).success).toBe(
      false
    )
    expect(transferCampaignInventoryInputSchema.safeParse({ ...input, amount: 1.5 }).success).toBe(
      false
    )
    expect(
      inventoryItemDtoSchema.safeParse({
        id,
        label: 'Rope',
        quantity: 1,
        containerId: null,
        isContainer: true
      }).success
    ).toBe(true)
    expect(
      inventoryCurrencyDtoSchema.safeParse({
        kind: 'RULESET',
        denominationId: seededId,
        label: 'Gold',
        abbreviation: 'gp',
        amount: 1,
        containerId: id
      }).success
    ).toBe(true)
    expect(
      inventoryItemDtoSchema.safeParse({
        id,
        label: 'Rope',
        quantity: 0,
        containerId: null,
        isContainer: false
      }).success
    ).toBe(false)
    expect(
      getCampaignInventoryInputSchema.safeParse({
        campaignId: id,
        owner: { kind: 'CAMPAIGN', campaignId: id }
      }).success
    ).toBe(true)
  })

  it('requires optimistic versions and idempotency for party inventory mutations', () => {
    const base = {
      campaignId: id,
      expectedOwnerVersion: 4,
      idempotencyKey: id
    }
    expect(
      campaignPartyInventoryMutationInputSchema.safeParse({
        ...base,
        kind: 'ITEM_ADD',
        equipmentId: seededId,
        quantity: 2
      }).success
    ).toBe(true)
    expect(
      campaignPartyInventoryMutationInputSchema.safeParse({
        ...base,
        kind: 'ITEM_CONSUME',
        itemId: id,
        amount: 1
      }).success
    ).toBe(true)
    expect(
      campaignPartyInventoryMutationInputSchema.safeParse({
        ...base,
        kind: 'CURRENCY_ADJUST',
        denominationId: id,
        amount: 0
      }).success
    ).toBe(false)
    expect(
      campaignPartyInventoryMutationInputSchema.safeParse({
        ...base,
        kind: 'ITEM_REMOVE',
        itemId: id,
        extra: true
      }).success
    ).toBe(false)
    expect(listCampaignInventoryAuditInputSchema.safeParse({ campaignId: id }).success).toBe(true)
  })

  it('rejects unrecognized input fields and requires optimistic versions', () => {
    const metadata = {
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD'
    } as const
    expect(
      createCampaignInputSchema.safeParse({ name: 'x'.repeat(100), ...metadata }).success
    ).toBe(true)
    expect(
      createCampaignInputSchema.safeParse({ name: 'x'.repeat(101), ...metadata }).success
    ).toBe(false)
    expect(
      createCampaignInputSchema.safeParse({
        name: 'Game',
        description: 'x'.repeat(20_001),
        ...metadata
      }).success
    ).toBe(false)
    expect(
      createCampaignInputSchema.safeParse({
        name: 'Game',
        ...metadata,
        toneTags: ['HEROIC', 'DARK', 'GRITTY', 'HORROR']
      }).success
    ).toBe(false)
    expect(acceptCampaignOwnershipTransferInputSchema.safeParse({ campaignId: id }).success).toBe(
      true
    )
    expect(
      shareCampaignContentInputSchema.safeParse({
        campaignId: id,
        subjectKind: 'SPELL',
        subjectId: id
      }).success
    ).toBe(true)
    expect(
      updateCampaignInputSchema.safeParse({ campaignId: id, name: 'New name', expectedVersion: 1 })
        .success
    ).toBe(true)
    expect(
      updateCampaignInputSchema.safeParse({
        campaignId: id,
        name: 'x'.repeat(101),
        expectedVersion: 1
      }).success
    ).toBe(false)
    for (const attunementSlotOverride of [null, 0, 4]) {
      expect(
        updateCampaignInputSchema.safeParse({
          campaignId: id,
          attunementSlotOverride,
          expectedVersion: 1
        }).success
      ).toBe(true)
    }
    for (const attunementSlotOverride of [-1, 1.5]) {
      expect(
        updateCampaignInputSchema.safeParse({
          campaignId: id,
          attunementSlotOverride,
          expectedVersion: 1
        }).success
      ).toBe(false)
    }
    expect(updateCampaignInputSchema.safeParse({ campaignId: id, name: 'New name' }).success).toBe(
      false
    )
    expect(
      updateCampaignInputSchema.safeParse({
        campaignId: id,
        name: 'New name',
        expectedVersion: 1,
        ignored: true
      }).success
    ).toBe(false)
    expect(
      updateCampaignNotebookSectionInputSchema.safeParse({ campaignId: id, sectionId: id }).success
    ).toBe(false)
  })

  it('defaults notebook categories to General and rejects unknown categories', () => {
    const section = {
      campaignId: id,
      title: 'Contacts',
      content: '<p>Rook</p>',
      visibility: 'SHARED' as const
    }
    expect(createCampaignNotebookSectionInputSchema.parse(section).category).toBe('GENERAL')
    expect(
      createCampaignNotebookSectionInputSchema.safeParse({ ...section, category: 'SESSIONS' })
        .success
    ).toBe(false)
  })

  it('requires exactly two participants for direct conversations', () => {
    const base = {
      id,
      campaignId: id,
      createdAt: '2026-08-01T00:00:00.000Z',
      lastReadAt: null,
      unreadCount: 0
    }
    expect(
      campaignConversationDtoSchema.safeParse({ ...base, kind: 'DIRECT', participantUserIds: [id] })
        .success
    ).toBe(false)
    expect(
      campaignConversationDtoSchema.safeParse({ ...base, kind: 'TABLE', participantUserIds: [] })
        .success
    ).toBe(true)
  })

  it('requires a recipient only for user-scoped Realtime invalidations', () => {
    const envelope = {
      scope: 'USER' as const,
      entity: 'CONTENT' as const,
      entityId: id,
      event: 'UPDATED' as const,
      eventId: id,
      cursor: '1'
    }

    expect(campaignRealtimeEnvelopeDtoSchema.safeParse(envelope).success).toBe(false)
    expect(
      campaignRealtimeEnvelopeDtoSchema.safeParse({ ...envelope, recipientUserId: id }).success
    ).toBe(true)
    expect(
      campaignRealtimeEnvelopeDtoSchema.safeParse({
        ...envelope,
        scope: 'OWNER',
        recipientUserId: id
      }).success
    ).toBe(false)
  })

  it('validates Campaign Character conditions and binding arrays', () => {
    expect(
      saveCampaignConditionInputSchema.safeParse({
        campaignId: id,
        characterId: id,
        conditionTypeId: id,
        visibility: 'SECRET',
        expectedVersion: 0
      }).success
    ).toBe(true)
    expect(campaignContentSharesDtoSchema.safeParse([]).success).toBe(true)
  })
})
