import { randomUUID } from 'node:crypto'
import {
  type CampaignCurrencyCleanup,
  createCampaignRepository,
  createInventoryRepository,
  withTransaction,
  type CampaignCurrencyDenomination,
  type CampaignCurrencySystem,
  type DBLike,
  type Json,
  type InventoryAggregate,
  type InventoryOwner,
  type InventoryOwnerRef,
  InsufficientInventoryCurrencyError
} from '@artificer-toolkit/db'
import type {
  CampaignInventoryAuditPageDto,
  CampaignPartyInventoryMutationInput,
  CurrencySystemDto,
  InventoryDto,
  InventoryOwnerRefDto,
  ListCampaignInventoryAuditInput,
  SaveCampaignCurrencySystemInput,
  TransferCampaignInventoryInput
} from '@artificer-toolkit/schema/api/campaigns'
import { campaignInventoryAuditPageDtoSchema } from '@artificer-toolkit/schema/api/campaigns'
import {
  presentCampaignPlainText,
  type CampaignContentMaturity
} from '@artificer-toolkit/shared/campaign/textPolicy'
import {
  CampaignAccessError,
  CampaignConflictError,
  CampaignNotFoundError,
  CampaignValidationError,
  assertActiveCampaignMember,
  assertCampaignOwner,
  assertCampaignWritable,
  resolveCampaignAuthority
} from './campaignService.js'
import { broadcastCampaignInvalidation } from './realtimeService.js'

const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER)

function safeNumber(value: bigint): number {
  if (value < 0n || value > MAX_SAFE_BIGINT) {
    throw new CampaignValidationError('Inventory amount exceeds the supported range.')
  }
  return Number(value)
}

function assertSafeCurrencyAmount(value: bigint): void {
  if (value < 0n || value > MAX_SAFE_BIGINT) {
    throw new CampaignValidationError('Inventory amount exceeds the supported range.')
  }
}

async function lockCampaignAuthority(db: DBLike, campaignId: string, userId: string) {
  if (!(await createCampaignRepository(db).lockCampaign(campaignId)))
    throw new CampaignNotFoundError()
  return resolveCampaignAuthority(db, campaignId, userId)
}

function toOwnerRef(owner: InventoryOwner): InventoryOwnerRefDto {
  if (owner.kind === 'CAMPAIGN') {
    if (!owner.campaignId) throw new Error('Campaign inventory owner is missing its Campaign.')
    return { kind: 'CAMPAIGN', campaignId: owner.campaignId }
  }
  if (owner.kind === 'VEHICLE') {
    if (!owner.vehicleId) throw new Error('Vehicle inventory owner is missing its Vehicle.')
    return { kind: 'VEHICLE', vehicleId: owner.vehicleId }
  }
  if (!owner.characterId) throw new Error('Character inventory owner is missing its Character.')
  return { kind: 'CHARACTER', characterId: owner.characterId }
}

function toInventoryDto(
  inventory: InventoryAggregate,
  maturity: CampaignContentMaturity
): InventoryDto {
  return {
    owner: toOwnerRef(inventory.owner),
    version: inventory.owner.version,
    items: inventory.items.map((item) => ({
      id: item.id,
      label: presentCampaignPlainText(
        item.customName ?? item.equipmentLabel ?? item.equipmentId,
        maturity
      ),
      quantity: item.quantity,
      containerId: item.containerId,
      isContainer: item.isContainer
    })),
    currencies: inventory.currencies.map((currency) => ({
      kind: currency.denomination.kind,
      denominationId: currency.denomination.id,
      label: presentCampaignPlainText(currency.denomination.label, maturity),
      abbreviation: presentCampaignPlainText(currency.denomination.abbreviation, maturity),
      amount: safeNumber(currency.amount),
      containerId: currency.containerId
    }))
  }
}

function toCurrencySystemDto(
  system: CampaignCurrencySystem,
  maturity: CampaignContentMaturity
): CurrencySystemDto {
  return {
    id: system.id,
    label: presentCampaignPlainText(system.name, maturity),
    isReference: system.isReference,
    version: system.version,
    denominations: system.denominations.map((denomination) => ({
      id: denomination.id,
      label: presentCampaignPlainText(denomination.name, maturity),
      abbreviation: presentCampaignPlainText(denomination.abbreviation, maturity),
      scaleInReference: safeNumber(denomination.scaleInReference)
    }))
  }
}

function presentInventoryAuditPayload(payload: Json, maturity: CampaignContentMaturity): Json {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return payload
  return {
    ...payload,
    ...(typeof payload.itemLabel === 'string'
      ? { itemLabel: presentCampaignPlainText(payload.itemLabel, maturity) }
      : {}),
    ...(typeof payload.denominationLabel === 'string'
      ? {
          denominationLabel: presentCampaignPlainText(payload.denominationLabel, maturity)
        }
      : {})
  }
}

async function resolvePermittedOwner(
  db: DBLike,
  campaignId: string,
  userId: string,
  isOwner: boolean,
  ref: InventoryOwnerRef,
  allowVehicleRead = false
): Promise<InventoryOwner> {
  const inventory = createInventoryRepository(db)
  if (ref.kind === 'CAMPAIGN') {
    if (ref.campaignId !== campaignId) throw new CampaignAccessError()
  } else if (ref.kind === 'VEHICLE') {
    const vehicle = await db
      .selectFrom('campaign_vehicles')
      .select('id')
      .where('campaign_id', '=', campaignId)
      .where('id', '=', ref.vehicleId)
      .executeTakeFirst()
    if (!vehicle) throw new CampaignAccessError()
    if (!isOwner && !allowVehicleRead) throw new CampaignAccessError()
  } else {
    const assignment = await createCampaignRepository(db).findAssignmentByCharacter(
      campaignId,
      ref.characterId
    )
    if (!assignment || (!isOwner && assignment.userId !== userId)) {
      throw new CampaignAccessError()
    }
  }
  const owner = await inventory.resolveOwner(ref)
  if (!owner) throw new CampaignNotFoundError()
  return owner
}

function assertVersions(
  source: InventoryOwner,
  destination: InventoryOwner,
  input: TransferCampaignInventoryInput
): void {
  if (
    source.version !== input.expectedSourceVersion ||
    destination.version !== input.expectedDestinationVersion
  ) {
    throw new CampaignConflictError('Inventory changed before this transfer completed.')
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505'
  )
}

async function broadcastInventory(
  db: DBLike,
  campaignId: string,
  eventId: string,
  event: 'CREATED' | 'UPDATED' | 'DELETED'
) {
  await broadcastCampaignInvalidation(db, campaignId, {
    scope: 'TABLE',
    entity: 'INVENTORY',
    entityId: campaignId,
    event,
    eventId,
    cursor: eventId
  })
}

export async function listCampaignCurrencySystems(
  db: DBLike,
  userId: string,
  campaignId: string
): Promise<CurrencySystemDto[]> {
  const authority = await resolveCampaignAuthority(db, campaignId, userId)
  assertActiveCampaignMember(authority)
  return (await createInventoryRepository(db).listCurrencySystems(campaignId)).map((system) =>
    toCurrencySystemDto(system, authority.campaign.contentMaturity)
  )
}

export async function getCampaignInventory(
  db: DBLike,
  userId: string,
  campaignId: string,
  ownerRef: InventoryOwnerRef
): Promise<InventoryDto> {
  const authority = await resolveCampaignAuthority(db, campaignId, userId)
  assertActiveCampaignMember(authority)
  const owner = await resolvePermittedOwner(
    db,
    campaignId,
    userId,
    authority.membership.role === 'OWNER',
    ownerRef,
    true
  )
  const inventory = await createInventoryRepository(db).getInventoryByOwnerId(owner.id)
  if (!inventory) throw new CampaignNotFoundError()
  return toInventoryDto(inventory, authority.campaign.contentMaturity)
}

export async function mutateCampaignPartyInventory(
  db: DBLike,
  userId: string,
  input: CampaignPartyInventoryMutationInput
): Promise<{ eventId: string }> {
  const result = await withTransaction(db, async (trx) => {
    const authority = await lockCampaignAuthority(trx, input.campaignId, userId)
    assertActiveCampaignMember(authority)
    assertCampaignWritable(authority)
    assertCampaignOwner(authority)
    const inventory = createInventoryRepository(trx)
    const existing = await inventory.findCampaignEventByIdempotency(
      input.campaignId,
      input.idempotencyKey
    )
    if (existing) {
      if (existing.actorUserId !== userId) throw new CampaignAccessError()
      return { eventId: existing.id, created: false }
    }

    const partyOwner = await inventory.resolveOwner({
      kind: 'CAMPAIGN',
      campaignId: input.campaignId
    })
    if (!partyOwner) throw new CampaignNotFoundError()
    const lockedOwner = (await inventory.lockOwners([partyOwner.id])).find(
      (owner) => owner.id === partyOwner.id
    )
    if (!lockedOwner) throw new CampaignNotFoundError()
    if (lockedOwner.version !== input.expectedOwnerVersion) {
      throw new CampaignConflictError('Party inventory changed before this mutation completed.')
    }

    const custody = {
      kind: 'CAMPAIGN' as const,
      campaignId: input.campaignId,
      ownerId: lockedOwner.id
    }
    let eventKind: Parameters<typeof inventory.insertInventoryEvent>[0]['kind']
    let payload: Json

    if (input.kind === 'ITEM_ADD') {
      const item = await inventory.insertPartyItem({
        ownerId: lockedOwner.id,
        equipmentId: input.equipmentId,
        quantity: input.quantity
      })
      eventKind = 'PARTY_ITEM_ADD'
      payload = {
        action: input.kind,
        custody,
        itemId: item.id,
        equipmentId: input.equipmentId,
        itemLabel: item.customName ?? item.equipmentLabel,
        beforeQuantity: 0,
        afterQuantity: item.quantity
      }
    } else if (input.kind === 'ITEM_UPDATE') {
      const item = await inventory.lockItem(lockedOwner.id, input.itemId)
      if (!item) throw new CampaignValidationError('Party item is not available.')
      const updated = await inventory.updatePartyItemQuantity({
        ownerId: lockedOwner.id,
        itemId: item.id,
        quantity: input.quantity
      })
      if (!updated)
        throw new CampaignConflictError('Party item changed before this mutation completed.')
      eventKind = 'PARTY_ITEM_UPDATE'
      payload = {
        action: input.kind,
        custody,
        itemId: item.id,
        itemLabel: item.customName ?? item.equipmentLabel,
        beforeQuantity: item.quantity,
        afterQuantity: updated.quantity
      }
    } else if (input.kind === 'ITEM_CONSUME') {
      const item = await inventory.lockItem(lockedOwner.id, input.itemId)
      if (!item || input.amount > item.quantity) {
        throw new CampaignValidationError('Party item does not contain enough quantity.')
      }
      let afterQuantity = item.quantity - input.amount
      if (afterQuantity === 0) {
        if (await inventory.hasContainerContents(lockedOwner.id, item.id)) {
          throw new CampaignValidationError('Empty a container before consuming it.')
        }
        if (!(await inventory.removePartyItem(lockedOwner.id, item.id))) {
          throw new CampaignConflictError('Party item changed before this mutation completed.')
        }
      } else {
        const updated = await inventory.decrementItemStack({
          ownerId: lockedOwner.id,
          itemId: item.id,
          quantity: input.amount
        })
        if (!updated)
          throw new CampaignConflictError('Party item changed before this mutation completed.')
        afterQuantity = updated.quantity
      }
      eventKind = 'PARTY_ITEM_CONSUME'
      payload = {
        action: input.kind,
        custody,
        itemId: item.id,
        itemLabel: item.customName ?? item.equipmentLabel,
        beforeQuantity: item.quantity,
        afterQuantity,
        consumedQuantity: input.amount
      }
    } else if (input.kind === 'ITEM_REMOVE') {
      const item = await inventory.lockItem(lockedOwner.id, input.itemId)
      if (!item) throw new CampaignValidationError('Party item is not available.')
      if (await inventory.hasContainerContents(lockedOwner.id, item.id)) {
        throw new CampaignValidationError('Empty a container before removing it.')
      }
      if (!(await inventory.removePartyItem(lockedOwner.id, item.id))) {
        throw new CampaignConflictError('Party item changed before this mutation completed.')
      }
      eventKind = 'PARTY_ITEM_REMOVE'
      payload = {
        action: input.kind,
        custody,
        itemId: item.id,
        itemLabel: item.customName ?? item.equipmentLabel,
        beforeQuantity: item.quantity,
        afterQuantity: 0
      }
    } else {
      const campaignDenomination = await inventory.findDenomination({
        kind: 'CAMPAIGN',
        id: input.denominationId
      })
      const denomination =
        campaignDenomination ??
        (await inventory.findDenomination({
          kind: 'RULESET',
          id: input.denominationId
        }))
      if (!denomination) throw new CampaignValidationError('Currency denomination not found.')
      if (denomination.kind === 'CAMPAIGN') {
        const system = await inventory.getCurrencySystem(denomination.systemId)
        if (!system || system.campaignId !== input.campaignId) throw new CampaignAccessError()
      }
      const ref = { kind: denomination.kind, id: denomination.id } as const
      const beforeAmount = (await inventory.lockCurrencyBalances(lockedOwner.id, ref)).reduce(
        (total, balance) => total + balance.amount,
        0n
      )
      const delta = BigInt(input.amount)
      try {
        if (delta > 0n) {
          await inventory.upsertUngroupedCurrencyBalance(lockedOwner.id, ref, delta)
        } else {
          await inventory.decrementCurrency({
            ownerId: lockedOwner.id,
            denomination: ref,
            amount: -delta
          })
        }
      } catch (error) {
        if (error instanceof InsufficientInventoryCurrencyError) {
          throw new CampaignValidationError('Party inventory does not contain enough currency.')
        }
        if (error instanceof RangeError) {
          throw new CampaignValidationError('Inventory amount exceeds the supported range.')
        }
        throw error
      }
      const afterAmount = beforeAmount + delta
      if (afterAmount < 0n) throw new CampaignValidationError('Currency amount cannot be negative.')
      eventKind = 'PARTY_CURRENCY_ADJUST'
      payload = {
        action: input.kind,
        custody,
        denominationId: denomination.id,
        denominationLabel: denomination.label,
        beforeAmount: beforeAmount.toString(),
        afterAmount: afterAmount.toString(),
        amount: input.amount
      }
    }

    await inventory.incrementVersions([lockedOwner.id])
    const event = await inventory.insertInventoryEvent({
      campaignId: input.campaignId,
      actorUserId: userId,
      kind: eventKind,
      idempotencyKey: input.idempotencyKey,
      payload
    })
    return { eventId: event.id, created: true }
  })

  if (result.created) await broadcastInventory(db, input.campaignId, result.eventId, 'UPDATED')
  return { eventId: result.eventId }
}

export async function listCampaignInventoryAudit(
  db: DBLike,
  userId: string,
  input: ListCampaignInventoryAuditInput
): Promise<CampaignInventoryAuditPageDto> {
  const authority = await resolveCampaignAuthority(db, input.campaignId, userId)
  assertActiveCampaignMember(authority)
  assertCampaignOwner(authority)
  const page = await createInventoryRepository(db).listInventoryAuditEvents({
    campaignId: input.campaignId,
    cursorId: input.cursor,
    limit: input.limit ?? 50
  })
  return campaignInventoryAuditPageDtoSchema.parse({
    events: page.events.map((event) => ({
      id: event.id,
      campaignId: event.campaignId,
      actorUserId: event.actorUserId,
      subjectCharacterId: event.subjectCharacterId,
      kind: event.kind,
      visibility: 'OWNER' as const,
      payload: presentInventoryAuditPayload(event.payload, authority.campaign.contentMaturity),
      createdAt: event.createdAt
    })),
    nextCursor: page.nextCursor
  })
}

export async function transferCampaignInventory(
  db: DBLike,
  userId: string,
  input: TransferCampaignInventoryInput
): Promise<{ eventId: string }> {
  const result = await withTransaction(db, async (trx) => {
    const authority = await lockCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignWritable(authority)
    const actorIsOwner = authority.membership.role === 'OWNER'
    const inventory = createInventoryRepository(trx)
    const existing = await inventory.findCampaignEventByIdempotency(
      input.campaignId,
      input.idempotencyKey
    )
    if (existing) {
      if (existing.actorUserId !== userId) throw new CampaignAccessError()
      return { eventId: existing.id, created: false }
    }

    const source = await resolvePermittedOwner(
      trx,
      input.campaignId,
      userId,
      actorIsOwner,
      input.source
    )
    let destination: InventoryOwner
    if (
      !actorIsOwner &&
      (input.destination.kind === 'CHARACTER' || input.destination.kind === 'VEHICLE')
    ) {
      if (input.destination.kind === 'VEHICLE') {
        const vehicle = await trx
          .selectFrom('campaign_vehicles')
          .select('id')
          .where('campaign_id', '=', input.campaignId)
          .where('id', '=', input.destination.vehicleId)
          .executeTakeFirst()
        if (!vehicle) throw new CampaignAccessError()
        const resolved = await inventory.resolveOwner(input.destination)
        if (!resolved) throw new CampaignNotFoundError()
        destination = resolved
      } else {
        const assignment = await createCampaignRepository(trx).findAssignmentByCharacter(
          input.campaignId,
          input.destination.characterId
        )
        if (!assignment) throw new CampaignAccessError()
        const resolved = await inventory.resolveOwner(input.destination)
        if (!resolved) throw new CampaignNotFoundError()
        destination = resolved
      }
    } else {
      destination = await resolvePermittedOwner(
        trx,
        input.campaignId,
        userId,
        actorIsOwner,
        input.destination
      )
    }
    if (source.id === destination.id)
      throw new CampaignValidationError('Choose two different inventory owners.')
    const locked = await inventory.lockOwners([source.id, destination.id])
    const lockedSource = locked.find((owner) => owner.id === source.id)
    const lockedDestination = locked.find((owner) => owner.id === destination.id)
    if (!lockedSource || !lockedDestination) throw new CampaignNotFoundError()
    assertVersions(lockedSource, lockedDestination, input)

    let auditPayload: Json
    if (input.kind === 'ITEM') {
      const item = await inventory.lockItem(lockedSource.id, input.itemId)
      if (!item || input.amount > item.quantity)
        throw new CampaignValidationError('Item is not available.')
      if (await inventory.hasContainerContents(lockedSource.id, item.id)) {
        throw new CampaignValidationError('Empty a container before transferring it.')
      }
      if (input.amount === item.quantity) {
        await inventory.moveItemStack({
          sourceOwnerId: lockedSource.id,
          destinationOwnerId: lockedDestination.id,
          itemId: item.id
        })
      } else {
        await inventory.decrementItemStack({
          ownerId: lockedSource.id,
          itemId: item.id,
          quantity: input.amount
        })
        await inventory.insertTransferredItem({
          destinationOwnerId: lockedDestination.id,
          source: item,
          quantity: input.amount
        })
      }
      auditPayload = {
        kind: input.kind,
        action: 'CUSTODY_TRANSFER',
        source: input.source,
        destination: input.destination,
        custodyContext: {
          sourceOwnerId: lockedSource.id,
          destinationOwnerId: lockedDestination.id
        },
        itemId: input.itemId,
        itemLabel: item.customName ?? item.equipmentLabel,
        amount: input.amount,
        beforeQuantity: item.quantity,
        afterSourceQuantity: item.quantity - input.amount,
        afterDestinationQuantity: input.amount
      }
    } else {
      const campaignDenomination = await inventory.findDenomination({
        kind: 'CAMPAIGN',
        id: input.denominationId
      })
      const denomination =
        campaignDenomination ??
        (await inventory.findDenomination({
          kind: 'RULESET',
          id: input.denominationId
        }))
      if (!denomination) throw new CampaignValidationError('Currency denomination not found.')
      if (denomination.kind === 'CAMPAIGN') {
        const system = await inventory.getCurrencySystem(denomination.systemId)
        if (!system || system.campaignId !== input.campaignId) throw new CampaignAccessError()
      }
      const ref = { kind: denomination.kind, id: denomination.id } as const
      const sourceBeforeAmount = (
        await inventory.lockCurrencyBalances(lockedSource.id, ref)
      ).reduce((total, balance) => total + balance.amount, 0n)
      const destinationBeforeAmount = (
        await inventory.lockCurrencyBalances(lockedDestination.id, ref)
      ).reduce((total, balance) => total + balance.amount, 0n)
      await inventory.decrementCurrency({
        ownerId: lockedSource.id,
        denomination: ref,
        amount: BigInt(input.amount)
      })
      try {
        await inventory.upsertUngroupedCurrencyBalance(
          lockedDestination.id,
          ref,
          BigInt(input.amount)
        )
      } catch (error) {
        if (
          error instanceof RangeError &&
          error.message === 'Currency amount exceeds the supported range.'
        ) {
          throw new CampaignValidationError('Inventory amount exceeds the supported range.')
        }
        throw error
      }
      auditPayload = {
        kind: input.kind,
        action: 'CUSTODY_TRANSFER',
        source: input.source,
        destination: input.destination,
        custodyContext: {
          sourceOwnerId: lockedSource.id,
          destinationOwnerId: lockedDestination.id
        },
        denominationId: denomination.id,
        denominationLabel: denomination.label,
        amount: input.amount,
        beforeAmount: sourceBeforeAmount.toString(),
        afterSourceAmount: (sourceBeforeAmount - BigInt(input.amount)).toString(),
        beforeDestinationAmount: destinationBeforeAmount.toString(),
        afterDestinationAmount: (destinationBeforeAmount + BigInt(input.amount)).toString()
      }
    }

    await inventory.incrementVersions([lockedSource.id, lockedDestination.id])
    const event = await inventory.insertCustodyEvent({
      campaignId: input.campaignId,
      actorUserId: userId,
      subjectCharacterId:
        input.source.kind === 'CHARACTER'
          ? input.source.characterId
          : input.destination.kind === 'CHARACTER'
            ? input.destination.characterId
            : null,
      idempotencyKey: input.idempotencyKey,
      payload: auditPayload
    })
    return { eventId: event.id, created: true }
  })

  if (result.created) await broadcastInventory(db, input.campaignId, result.eventId, 'UPDATED')
  return { eventId: result.eventId }
}

export async function reconcileCampaignCurrencyDeparture(
  db: DBLike,
  input: {
    campaignId: string
    characterId: string
    actorUserId: string
    reason: string
  }
): Promise<{ moved: CampaignCurrencyCleanup[]; eventId: string | null }> {
  return withTransaction(db, async (trx) => {
    const inventory = createInventoryRepository(trx)
    const [characterOwner, campaignOwner] = await Promise.all([
      inventory.resolveOwner({
        kind: 'CHARACTER',
        characterId: input.characterId
      }),
      inventory.resolveOwner({
        kind: 'CAMPAIGN',
        campaignId: input.campaignId
      })
    ])
    if (!characterOwner || !campaignOwner) {
      throw new CampaignConflictError(
        'Campaign inventory owner is missing during departure cleanup.'
      )
    }
    const locked = await inventory.lockOwners([characterOwner.id, campaignOwner.id])
    const lockedCharacter = locked.find((owner) => owner.id === characterOwner.id)
    const lockedCampaign = locked.find((owner) => owner.id === campaignOwner.id)
    if (!lockedCharacter || !lockedCampaign) {
      throw new CampaignConflictError('Campaign inventory owner changed during departure cleanup.')
    }
    const cleanup = await inventory.moveCharacterCampaignCurrencyToCampaign({
      campaignId: input.campaignId,
      characterOwnerId: lockedCharacter.id,
      campaignOwnerId: lockedCampaign.id
    })
    const moved = cleanup.filter((entry) => entry.amount > 0n)
    if (moved.length === 0) return { moved, eventId: null }

    await inventory.incrementVersions([lockedCharacter.id, lockedCampaign.id])
    const event = await inventory.insertCustodyEvent({
      campaignId: input.campaignId,
      actorUserId: input.actorUserId,
      subjectCharacterId: input.characterId,
      idempotencyKey: randomUUID(),
      payload: {
        action: 'CUSTODY_TRANSFER',
        custodyContext: {
          sourceOwnerId: lockedCharacter.id,
          destinationOwnerId: lockedCampaign.id
        },
        reason: input.reason,
        denominations: moved.map((entry) => ({
          denominationId: entry.denomination.id,
          amount: entry.amount.toString(),
          beforeSourceAmount: entry.amount.toString(),
          afterSourceAmount: '0'
        }))
      }
    })
    return { moved, eventId: event.id }
  })
}

function buildDenominations(
  input: SaveCampaignCurrencySystemInput
): CampaignCurrencyDenomination[] {
  const ids = new Set<string>()
  const denominations = input.denominations.map((denomination, sortOrder) => {
    const id = denomination.id ?? randomUUID()
    if (ids.has(id)) throw new CampaignValidationError('Currency denominations must be unique.')
    ids.add(id)
    return {
      id,
      systemId: input.systemId ?? '',
      name: denomination.label,
      abbreviation: denomination.abbreviation,
      scaleInReference: BigInt(denomination.scaleInReference),
      sortOrder
    }
  })
  if (denominations.filter((denomination) => denomination.scaleInReference === 1n).length !== 1) {
    throw new CampaignValidationError('A currency system needs exactly one reference denomination.')
  }
  return denominations
}

export async function saveCampaignCurrencySystem(
  db: DBLike,
  userId: string,
  input: SaveCampaignCurrencySystemInput
): Promise<CurrencySystemDto> {
  const saved = await withTransaction(db, async (trx) => {
    const authority = await lockCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    const inventory = createInventoryRepository(trx)
    let system: CampaignCurrencySystem
    const denominations = buildDenominations(input)
    try {
      const systems = await inventory.listCurrencySystems(input.campaignId)
      const isReference = systems.length === 0 || input.isReference
      if (!input.systemId) {
        if (isReference) {
          const reference = systems.find((candidate) => candidate.isReference)
          if (
            reference &&
            !(await inventory.updateCurrencySystem({
              id: reference.id,
              expectedVersion: reference.version,
              name: reference.name,
              isReference: false
            }))
          ) {
            throw new CampaignConflictError('Currency system changed before this update completed.')
          }
        }
        system = await inventory.insertCurrencySystem({
          campaignId: input.campaignId,
          name: input.label,
          isReference
        })
        for (const denomination of denominations) denomination.systemId = system.id
      } else {
        const current = systems.find((candidate) => candidate.id === input.systemId)
        if (!current || current.campaignId !== input.campaignId) throw new CampaignNotFoundError()
        if (input.expectedVersion === undefined || current.version !== input.expectedVersion) {
          throw new CampaignConflictError('Currency system changed before this update completed.')
        }
        if (current.isReference && !isReference) {
          throw new CampaignValidationError(
            'Set another reference system before changing this one.'
          )
        }
        if (isReference && !current.isReference) {
          const reference = systems.find((candidate) => candidate.isReference)
          if (
            reference &&
            !(await inventory.updateCurrencySystem({
              id: reference.id,
              expectedVersion: reference.version,
              name: reference.name,
              isReference: false
            }))
          ) {
            throw new CampaignConflictError('Currency system changed before this update completed.')
          }
        }
        const updated = await inventory.updateCurrencySystem({
          id: current.id,
          expectedVersion: input.expectedVersion,
          name: input.label,
          isReference
        })
        if (!updated)
          throw new CampaignConflictError('Currency system changed before this update completed.')
        system = updated
        for (const denomination of denominations) denomination.systemId = system.id

        const proposed = new Map(
          denominations.map((denomination) => [denomination.id, denomination])
        )
        const existing = new Map(
          current.denominations.map((denomination) => [denomination.id, denomination])
        )
        const balances = await inventory.lockCurrencySystemBalances(system.id)
        for (const balance of balances) {
          const oldDenomination = existing.get(balance.denominationId)
          const nextDenomination = proposed.get(balance.denominationId)
          if (!oldDenomination)
            throw new CampaignConflictError(
              'Currency denomination changed before this update completed.'
            )
          if (!nextDenomination && balance.amount > 0n) {
            throw new CampaignValidationError(
              'A denomination with a positive balance cannot be removed.'
            )
          }
          if (
            nextDenomination &&
            (balance.amount * oldDenomination.scaleInReference) %
              nextDenomination.scaleInReference !==
              0n
          ) {
            throw new CampaignValidationError(
              'Currency conversion must preserve every balance exactly.'
            )
          }
        }
      }

      const priorDenominations = input.systemId
        ? systems.find((candidate) => candidate.id === input.systemId)?.denominations
        : system.denominations
      if (!priorDenominations) throw new CampaignNotFoundError()
      const prior = new Map(
        priorDenominations.map((denomination) => [denomination.id, denomination])
      )
      const next = new Map(denominations.map((denomination) => [denomination.id, denomination]))
      const balances = await inventory.lockCurrencySystemBalances(system.id)
      const fallback = denominations[0]
      if (!fallback) throw new CampaignValidationError('Currency system needs a denomination.')
      const rewrites = balances.map((balance) => {
        const oldDenomination = prior.get(balance.denominationId)
        const nextDenomination = next.get(balance.denominationId) ?? fallback
        if (!oldDenomination)
          throw new CampaignConflictError(
            'Currency denomination changed before this update completed.'
          )
        const amount = next.has(balance.denominationId)
          ? (balance.amount * oldDenomination.scaleInReference) / nextDenomination.scaleInReference
          : 0n
        assertSafeCurrencyAmount(amount)
        return { ...balance, denominationId: nextDenomination.id, amount }
      })
      const savedDenominations = await inventory.replaceCurrencyDenominations({
        systemId: system.id,
        denominations,
        balanceRewrites: rewrites
      })
      await inventory.incrementVersions(rewrites.map((rewrite) => rewrite.ownerId))
      return { ...system, denominations: savedDenominations }
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new CampaignConflictError('This Campaign already has a reference currency system.')
      }
      throw error
    }
  })
  await broadcastInventory(db, input.campaignId, saved.id, 'UPDATED')
  return toCurrencySystemDto(
    saved,
    (await resolveCampaignAuthority(db, input.campaignId, userId)).campaign.contentMaturity
  )
}

export async function deleteCampaignCurrencySystem(
  db: DBLike,
  userId: string,
  input: { campaignId: string; systemId: string; expectedVersion: number }
): Promise<void> {
  await withTransaction(db, async (trx) => {
    const authority = await lockCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    const inventory = createInventoryRepository(trx)
    const systems = await inventory.listCurrencySystems(input.campaignId)
    const system = systems.find((candidate) => candidate.id === input.systemId)
    if (!system || system.campaignId !== input.campaignId) throw new CampaignNotFoundError()
    if (system.version !== input.expectedVersion)
      throw new CampaignConflictError('Currency system changed before deletion.')
    if (system.isReference && systems.length > 1) {
      throw new CampaignValidationError('Set another reference system before deleting this one.')
    }
    const balances = await inventory.lockCurrencySystemBalances(system.id)
    if (balances.some((balance) => balance.amount > 0n)) {
      throw new CampaignValidationError('Currency system has positive balances.')
    }
    if (!(await inventory.deleteCurrencySystem(system.id))) throw new CampaignConflictError()
  })
  await broadcastInventory(db, input.campaignId, input.systemId, 'DELETED')
}
