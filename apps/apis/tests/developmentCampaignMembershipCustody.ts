import assert from 'node:assert/strict'
import { ConvexHttpClient } from 'convex/browser'
import type { FunctionArgs } from 'convex/server'
import type {
  CampaignPartyInventoryMutationInput,
  TransferCampaignInventoryInput
} from '@artificer-toolkit/schema/api/campaignInventory'
import { acquiredEquipmentRulesSchema } from '@artificer-toolkit/schema/projections/acquiredEquipmentRules'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { backpack } from '@artificer-toolkit/source-data/srd/equipment/backpack.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api } from '../convex/_generated/api.js'
import type { CampaignCustodyCohort } from './developmentCampaignCustody'

export type MembershipCustodyDepartureReason = 'MEMBER_LEFT' | 'MEMBER_REMOVED'

export type MembershipCustodyDepartureProof = {
  actorUserId: string
  departingUserId: string
  contention: { performed: boolean; rejectedCommandId: string | null }
  departure:
    | {
        campaignId: string
        expectedCampaignVersion: number
        expectedMembershipAccessStartedAt: string
        commandId: string
      }
    | {
        campaignId: string
        userId: string
        expectedCampaignVersion: number
        expectedMembershipAccessStartedAt: string
        commandId: string
      }
  source: {
    equipmentId: string
    vehicleDefinitionId: string
    vehicleId: string
    partyBackpackId: string
    sourceVehicleBackpackId: string
    unrelatedVehicleId: string
    unrelatedVehicleBackpackId: string
  }
}

async function collectPages<T>(
  load: (cursor: string | null) => Promise<{
    page: T[]
    isDone: boolean
    continueCursor: string
  }>
): Promise<T[]> {
  const rows: T[] = []
  const cursors = new Set<string>()
  let cursor: string | null = null
  while (true) {
    const result = await load(cursor)
    rows.push(...result.page)
    if (result.isDone) return rows
    assert.equal(cursors.has(result.continueCursor), false, 'Inventory cursor must advance.')
    cursors.add(result.continueCursor)
    cursor = result.continueCursor
  }
}

async function collectAuditPages(cohort: CampaignCustodyCohort): Promise<unknown[]> {
  const rows: unknown[] = []
  const cursors = new Set<string>()
  let cursor: string | undefined
  while (true) {
    const page = await cohort.owner.query(api.campaigns.inventoryAudit.list, {
      campaignId: cohort.campaignId,
      limit: 8,
      ...(cursor ? { cursor } : {})
    })
    rows.push(...page.events)
    if (page.nextCursor === null) return rows
    assert.equal(cursors.has(page.nextCursor), false, 'Inventory audit cursor must advance.')
    cursors.add(page.nextCursor)
    cursor = page.nextCursor
  }
}

/**
 * Public P10/P12/P13 proof for one active player departure. The caller restores the player before
 * invoking the other reason, so this verifier deliberately does not rejoin or clean up fixture state.
 */
export async function verifyCampaignMembershipCustodyDeparture(
  cohort: CampaignCustodyCohort,
  departingPlayerIndex: 0 | 1,
  reason: MembershipCustodyDepartureReason
): Promise<MembershipCustodyDepartureProof> {
  if (fighter.category !== 'BASE') throw new Error('Custody departure requires the base Fighter.')
  const rulesetCurrencyId = srdSystemRecord.currencies[0]?.id
  if (!rulesetCurrencyId) throw new Error('Custody departure requires a ruleset currency.')
  const remainingPlayerIndex = departingPlayerIndex === 0 ? 1 : 0
  const departing = cohort.players[departingPlayerIndex]
  const remaining = cohort.players[remainingPlayerIndex]
  const departingUserId = cohort.playerUserIds[departingPlayerIndex]
  const departingCharacterId = cohort.characterIds[departingPlayerIndex]
  const remainingCharacterId = cohort.characterIds[remainingPlayerIndex]
  const { campaignId, owner } = cohort
  const pagination = { cursor: null, numItems: 1 }

  const listItems = (vehicleId?: string) =>
    collectPages((cursor) =>
      vehicleId
        ? owner.query(api.campaigns.vehicleInventory.items, {
            campaignId,
            vehicleId,
            paginationOpts: { ...pagination, cursor }
          })
        : owner.query(api.campaigns.partyInventory.items, {
            campaignId,
            paginationOpts: { ...pagination, cursor }
          })
    )
  const listCurrencies = (vehicleId?: string) =>
    collectPages((cursor) =>
      vehicleId
        ? owner.query(api.campaigns.vehicleInventory.currencies, {
            campaignId,
            vehicleId,
            paginationOpts: { ...pagination, cursor }
          })
        : owner.query(api.campaigns.partyInventory.currencies, {
            campaignId,
            paginationOpts: { ...pagination, cursor }
          })
    )
  const ownerVersion = (vehicleId?: string) =>
    owner.query(api.campaigns.inventoryOwners.version, {
      input: {
        campaignId,
        owner: vehicleId
          ? { kind: 'VEHICLE' as const, vehicleId }
          : { kind: 'CAMPAIGN' as const, campaignId }
      }
    })
  const partyMutation = async (input: CampaignPartyInventoryMutationInput) =>
    owner.mutation(api.campaigns.partyInventoryCommands.mutate, { input })
  const seedContainer = async (vehicleId?: string) => {
    const beforeIds = new Set((await listItems(vehicleId)).map((item) => item.id))
    const addVersion = await ownerVersion(vehicleId)
    await partyMutation({
      kind: 'ITEM_ADD',
      campaignId,
      ...(vehicleId ? { vehicleId } : {}),
      equipmentId: equipment.subjectId,
      quantity: 1,
      expectedOwnerVersion: addVersion.version,
      idempotencyKey: crypto.randomUUID()
    })
    const bag = (await listItems(vehicleId)).find((item) => !beforeIds.has(item.id))
    assert.ok(bag?.isContainer, 'The published Backpack must be retained as a container.')
    for (const input of [
      {
        kind: 'ITEM_ADD' as const,
        equipmentId: club.id,
        quantity: 1,
        containerId: bag.id
      },
      {
        kind: 'CURRENCY_ADJUST' as const,
        denominationId: rulesetCurrencyId,
        campaignCurrencySystemId: null,
        amount: 3,
        containerId: bag.id
      }
    ]) {
      const version = await ownerVersion(vehicleId)
      await partyMutation({
        ...input,
        campaignId,
        ...(vehicleId ? { vehicleId } : {}),
        expectedOwnerVersion: version.version,
        idempotencyKey: crypto.randomUUID()
      })
    }
    return bag
  }
  const appendRetainedContent = async (vehicleId: string | undefined, bagId: string) => {
    for (const input of [
      {
        kind: 'ITEM_ADD' as const,
        equipmentId: club.id,
        quantity: 1,
        containerId: bagId
      },
      {
        kind: 'CURRENCY_ADJUST' as const,
        denominationId: rulesetCurrencyId,
        campaignCurrencySystemId: null,
        amount: 1,
        containerId: bagId
      }
    ]) {
      const version = await ownerVersion(vehicleId)
      await partyMutation({
        ...input,
        campaignId,
        ...(vehicleId ? { vehicleId } : {}),
        expectedOwnerVersion: version.version,
        idempotencyKey: crypto.randomUUID()
      })
    }
  }

  let equipmentDraft = await departing.client.mutation(api.content.drafts.duplicate, {
    subjectKind: 'EQUIPMENT',
    subjectId: backpack.id
  })
  if (!equipmentDraft.updatedAt)
    throw new Error('Membership custody requires an Equipment draft revision.')
  equipmentDraft = await departing.client.mutation(api.content.drafts.save, {
    subjectKind: 'EQUIPMENT',
    subjectId: equipmentDraft.subjectId,
    systemId: equipmentDraft.systemId,
    label: `${reason} Backpack ${equipmentDraft.subjectId}`,
    payload: equipmentDraft.payload
  })
  assert.ok(equipmentDraft.updatedAt, 'Renamed departure source needs its exact draft revision.')
  const equipment = await departing.client.mutation(api.content.publication.publishDraft, {
    subjectKind: 'EQUIPMENT',
    subjectId: equipmentDraft.subjectId,
    expectedDraftUpdatedAt: equipmentDraft.updatedAt
  })
  let vehicleDraft = await departing.client.mutation(api.content.drafts.duplicate, {
    subjectKind: 'VEHICLE',
    subjectId: cart.id
  })
  if (!vehicleDraft.updatedAt)
    throw new Error('Membership custody requires a Vehicle draft revision.')
  vehicleDraft = await departing.client.mutation(api.content.drafts.save, {
    subjectKind: 'VEHICLE',
    subjectId: vehicleDraft.subjectId,
    systemId: vehicleDraft.systemId,
    label: `${reason} Cart ${vehicleDraft.subjectId}`,
    payload: vehicleDraft.payload
  })
  assert.ok(vehicleDraft.updatedAt, 'Renamed departure source needs its exact draft revision.')
  const vehicleDefinition = await departing.client.mutation(api.content.publication.publishDraft, {
    subjectKind: 'VEHICLE',
    subjectId: vehicleDraft.subjectId,
    expectedDraftUpdatedAt: vehicleDraft.updatedAt
  })
  await Promise.all([
    departing.client.mutation(api.campaigns.contentShares.share, {
      campaignId,
      subjectKind: 'EQUIPMENT',
      subjectId: equipment.subjectId
    }),
    departing.client.mutation(api.campaigns.contentShares.share, {
      campaignId,
      subjectKind: 'VEHICLE',
      subjectId: vehicleDefinition.subjectId
    })
  ])
  const [sourceVehicle, unrelatedVehicle] = await Promise.all([
    owner.mutation(api.campaigns.vehicles.create, {
      campaignId,
      vehicleDefinitionId: vehicleDefinition.subjectId,
      label: `Departure source Vehicle ${departingPlayerIndex}`
    }),
    owner.mutation(api.campaigns.vehicles.create, {
      campaignId,
      vehicleDefinitionId: cart.id,
      label: `Unrelated custody Vehicle ${departingPlayerIndex}`
    })
  ])
  const existingCurrencySystems = await collectPages((cursor) =>
    owner.query(api.campaigns.currencySystems.list, {
      campaignId,
      paginationOpts: { ...pagination, cursor }
    })
  )
  const currencySystem = await owner.mutation(api.campaigns.currencySystems.save, {
    campaignId,
    label: `Departure currency ${departingPlayerIndex}`,
    isReference: existingCurrencySystems.length === 0,
    denominations: [
      {
        label: 'Departure token',
        abbreviation: 'dt',
        scaleInReference: 1
      }
    ]
  })
  const denominationId = currencySystem.denominations[0]!.id
  const partyBag = await seedContainer()
  const sourceVehicleBag = await seedContainer(sourceVehicle.id)
  const unrelatedVehicleBag = await seedContainer(unrelatedVehicle.id)

  const characterSheet = await remaining.client.query(api.characters.sheet.get, {
    id: remainingCharacterId
  })
  assert.ok(characterSheet, 'The remaining assigned Character must be available.')
  const beforeHeld = await remaining.client.query(api.characters.builder.activeCharacter, {
    id: remainingCharacterId
  })
  assert.ok(beforeHeld)
  await remaining.client.mutation(api.characters.sheetCommands.execute, {
    id: remainingCharacterId,
    command: {
      type: 'ADD_INVENTORY_ITEM',
      commandId: crypto.randomUUID(),
      expectedVersion: characterSheet.meta.streamVersion,
      equipmentId: equipment.subjectId,
      quantity: 1,
      customName: 'Departure retained Backpack',
      notes: 'Keep this acquired Equipment after the author leaves.'
    }
  })
  const heldBeforeDeparture = await remaining.client.query(api.characters.builder.activeCharacter, {
    id: remainingCharacterId
  })
  assert.ok(heldBeforeDeparture)
  const heldBackpack = heldBeforeDeparture.state.equipment.inventory.find(
    (item) =>
      item.equipmentId === equipment.subjectId &&
      !beforeHeld.state.equipment.inventory.some((previous) => previous.id === item.id)
  )
  if (!heldBackpack?.retainedRulesJson)
    throw new Error('Acquired Equipment must retain raw rules before source loss.')
  const heldRules = acquiredEquipmentRulesSchema.parse(JSON.parse(heldBackpack.retainedRulesJson))
  assert.equal(heldRules.equipmentId, equipment.subjectId)
  assert.equal(heldRules.systemId, fighter.systemId)
  assert.ok(
    heldRules.sources.some(
      (source) => source.subjectKind === 'EQUIPMENT' && source.subjectId === equipment.subjectId
    )
  )

  const qualifiedBalanceVersion = await ownerVersion()
  await partyMutation({
    kind: 'CURRENCY_ADJUST',
    campaignId,
    denominationId,
    campaignCurrencySystemId: currencySystem.id,
    amount: 7,
    expectedOwnerVersion: qualifiedBalanceVersion.version,
    idempotencyKey: crypto.randomUUID()
  })
  const currencyFences = await owner.query(api.campaigns.inventoryOwners.transferVersions, {
    input: {
      campaignId,
      source: { kind: 'CAMPAIGN', campaignId },
      destination: { kind: 'CHARACTER', characterId: departingCharacterId }
    }
  })
  await owner.mutation(api.campaigns.inventoryTransfers.transfer, {
    input: {
      kind: 'CURRENCY',
      campaignId,
      source: { kind: 'CAMPAIGN', campaignId },
      destination: { kind: 'CHARACTER', characterId: departingCharacterId },
      denominationId,
      campaignCurrencySystemId: currencySystem.id,
      amount: 5,
      expectedSourceVersion: currencyFences.sourceVersion,
      expectedDestinationVersion: currencyFences.destinationVersion,
      idempotencyKey: crypto.randomUUID()
    } satisfies TransferCampaignInventoryInput
  })

  const read = async () => {
    const [campaign, shares, systems, vehicles, partyItems, partyCurrencies, audit] =
      await Promise.all([
        owner.query(api.campaigns.queries.get, { id: campaignId }),
        collectPages((cursor) =>
          owner.query(api.campaigns.contentShares.list, {
            campaignId,
            paginationOpts: { ...pagination, cursor }
          })
        ),
        collectPages((cursor) =>
          owner.query(api.campaigns.currencySystems.list, {
            campaignId,
            paginationOpts: { ...pagination, cursor }
          })
        ),
        collectPages((cursor) =>
          owner.query(api.campaigns.vehicles.list, {
            campaignId,
            paginationOpts: { ...pagination, cursor }
          })
        ),
        listItems(),
        listCurrencies(),
        collectAuditPages(cohort)
      ])
    assert.ok(campaign, 'The Campaign owner must retain the Campaign detail.')
    const sourcePresent = vehicles.some((vehicle) => vehicle.id === sourceVehicle.id)
    const unrelatedPresent = vehicles.some((vehicle) => vehicle.id === unrelatedVehicle.id)
    assert.equal(unrelatedPresent, true, 'Unrelated Vehicle custody must remain visible.')
    const [sourceCargo, unrelatedCargo] = await Promise.all([
      sourcePresent
        ? Promise.all([listItems(sourceVehicle.id), listCurrencies(sourceVehicle.id)]).then(
            ([items, currencies]) => ({ items, currencies })
          )
        : Promise.resolve(null),
      Promise.all([listItems(unrelatedVehicle.id), listCurrencies(unrelatedVehicle.id)]).then(
        ([items, currencies]) => ({ items, currencies })
      )
    ])
    return {
      campaign,
      shares,
      systems,
      vehicles,
      partyItems,
      partyCurrencies,
      audit,
      sourceCargo,
      unrelatedCargo
    }
  }

  if (reason === 'MEMBER_REMOVED') {
    const beforeUnavailable = await read()
    const input = {
      campaignId,
      vehicleId: sourceVehicle.id,
      action: 'MAKE_UNAVAILABLE' as const,
      expectedVersion: sourceVehicle.version,
      idempotencyKey: crypto.randomUUID()
    }
    const receipt = await owner.mutation(api.campaigns.vehicles.lifecycle, {
      input
    })
    const afterUnavailable = await read()
    assert.equal(
      afterUnavailable.vehicles.find((vehicle) => vehicle.id === sourceVehicle.id)?.availability,
      'UNAVAILABLE'
    )
    assert.deepEqual(afterUnavailable.sourceCargo, beforeUnavailable.sourceCargo)
    assert.deepEqual(afterUnavailable.unrelatedCargo, beforeUnavailable.unrelatedCargo)
    assert.deepEqual(await owner.mutation(api.campaigns.vehicles.lifecycle, { input }), receipt)
    assert.deepEqual(await read(), afterUnavailable, 'Unavailable replay must not write.')
    for (const player of cohort.players) {
      const vehicles = await collectPages((cursor) =>
        player.client.query(api.campaigns.vehicles.list, {
          campaignId,
          paginationOpts: { ...pagination, cursor }
        })
      )
      assert.equal(
        vehicles.some((vehicle) => vehicle.id === sourceVehicle.id),
        false
      )
      for (const query of [
        api.campaigns.vehicleInventory.items,
        api.campaigns.vehicleInventory.currencies
      ] as const)
        await assert.rejects(
          () =>
            player.client.query(query, {
              campaignId,
              vehicleId: sourceVehicle.id,
              paginationOpts: pagination
            }),
          /unavailable|permission|authorized/i
        )
    }
    assert.deepEqual(await read(), afterUnavailable, 'Denied player cargo reads must not write.')
  }

  const beforeDeparture = await read()
  assert.ok(beforeDeparture.sourceCargo)
  assert.equal(
    beforeDeparture.shares.filter((share) => share.sharedBy === departingUserId).length >= 2,
    true,
    'The departing player must have published Equipment and Vehicle shares.'
  )
  assert.equal(
    beforeDeparture.sourceCargo.items.some((item) => item.id === sourceVehicleBag.id),
    true
  )
  assert.equal(
    beforeDeparture.sourceCargo.items.some((item) => item.containerId === sourceVehicleBag.id),
    true
  )
  assert.equal(
    beforeDeparture.sourceCargo.currencies.some((row) => row.containerId === sourceVehicleBag.id),
    true
  )

  const membership = beforeDeparture.campaign.memberships.find(
    (entry) => entry.userId === departingUserId
  )
  if (!membership || membership.role !== 'PLAYER' || !membership.accessStartedAt)
    throw new Error('The departure target must be the current active PLAYER.')
  let departure: FunctionArgs<typeof api.campaigns.membershipDeparture.leave> = {
    campaignId,
    expectedCampaignVersion: beforeDeparture.campaign.version,
    expectedMembershipAccessStartedAt: membership.accessStartedAt,
    commandId: crypto.randomUUID()
  }
  const invoke = (input: typeof departure) =>
    reason === 'MEMBER_LEFT'
      ? departing.client.mutation(api.campaigns.membershipDeparture.leave, input)
      : owner.mutation(api.campaigns.membershipDeparture.removeMember, {
          ...input,
          userId: departingUserId
        })
  const rejectedBeforeDeparture = async (input: typeof departure) => {
    await assert.rejects(() => invoke(input), /campaign changed|membership changed/i)
    assert.deepEqual(await read(), beforeDeparture, 'Fence refusal must not write custody state.')
  }
  await rejectedBeforeDeparture({
    ...departure,
    commandId: crypto.randomUUID(),
    expectedCampaignVersion: departure.expectedCampaignVersion + 1
  })
  await rejectedBeforeDeparture({
    ...departure,
    commandId: crypto.randomUUID(),
    expectedMembershipAccessStartedAt: new Date(
      Date.parse(departure.expectedMembershipAccessStartedAt) + 1
    ).toISOString()
  })
  const invokingClient = reason === 'MEMBER_LEFT' ? departing.client : owner
  let rejectedCommandId: string | null = null
  if (invokingClient instanceof ConvexHttpClient) {
    const commands = [departure, { ...departure, commandId: crypto.randomUUID() }] as const
    const results = await Promise.allSettled(
      commands.map((input) =>
        reason === 'MEMBER_LEFT'
          ? invokingClient.mutation(api.campaigns.membershipDeparture.leave, input, {
              skipQueue: true
            })
          : invokingClient.mutation(
              api.campaigns.membershipDeparture.removeMember,
              { ...input, userId: departingUserId },
              { skipQueue: true }
            )
      )
    )
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
    const winner = results.findIndex((result) => result.status === 'fulfilled')
    const loser = results.findIndex((result) => result.status === 'rejected')
    assert.ok(winner >= 0 && loser >= 0)
    const success = results[winner]
    const failure = results[loser]
    assert.ok(success?.status === 'fulfilled')
    assert.deepEqual(success.value, { ok: true })
    assert.ok(failure?.status === 'rejected' && failure.reason instanceof Error)
    assert.match(
      failure.reason.message,
      reason === 'MEMBER_LEFT'
        ? /campaign changed|membership changed|Campaign not found\./i
        : /campaign changed|membership changed|active player membership/i
    )
    departure = commands[winner]!
    rejectedCommandId = commands[loser]!.commandId
  } else assert.deepEqual(await invoke(departure), { ok: true })
  // Later acknowledgements replay the winning receipt, never the rejected command UUID.

  const afterDeparture = await read()
  if (rejectedCommandId) {
    const losingCommand = { ...departure, commandId: rejectedCommandId }
    await assert.rejects(
      () => invoke(losingCommand),
      reason === 'MEMBER_LEFT' ? /Campaign not found\./i : /active player membership/i
    )
    assert.deepEqual(
      await read(),
      afterDeparture,
      'The losing departure UUID must have no replay receipt or writes.'
    )
  }
  assert.equal(afterDeparture.campaign.version, departure.expectedCampaignVersion + 1)
  assert.equal(
    afterDeparture.sourceCargo,
    null,
    'Source-loss Vehicle cargo must evacuate atomically.'
  )
  assert.equal(
    afterDeparture.vehicles.some((vehicle) => vehicle.id === sourceVehicle.id),
    false
  )
  assert.deepEqual(afterDeparture.unrelatedCargo, beforeDeparture.unrelatedCargo)
  assert.deepEqual(
    afterDeparture.partyItems.find((item) => item.id === sourceVehicleBag.id),
    beforeDeparture.sourceCargo.items.find((item) => item.id === sourceVehicleBag.id)
  )
  assert.deepEqual(
    afterDeparture.partyItems.find((item) => item.containerId === sourceVehicleBag.id),
    beforeDeparture.sourceCargo.items.find((item) => item.containerId === sourceVehicleBag.id)
  )
  assert.deepEqual(
    afterDeparture.partyCurrencies.find((row) => row.containerId === sourceVehicleBag.id),
    beforeDeparture.sourceCargo.currencies.find((row) => row.containerId === sourceVehicleBag.id)
  )
  assert.equal(
    afterDeparture.shares.some(
      (share) =>
        share.sharedBy === departingUserId &&
        (share.subjectId === equipment.subjectId || share.subjectId === vehicleDefinition.subjectId)
    ),
    false
  )
  assert.equal(
    afterDeparture.partyCurrencies.find(
      (row) =>
        row.denominationId === denominationId && row.campaignCurrencySystemId === currencySystem.id
    )?.amount,
    7,
    'Departure must return the exact qualified balance to Party custody.'
  )
  const departedCharacter = await departing.client.query(api.characters.builder.activeCharacter, {
    id: departingCharacterId
  })
  assert.ok(departedCharacter, 'Departure preserves the player-owned Character.')
  assert.equal(
    departedCharacter.state.currency
      .flatMap((group) => group.currencies)
      .some(
        (currency) =>
          currency.currencyId === denominationId &&
          currency.kind === 'CAMPAIGN' &&
          currency.campaignCurrencySystemId === currencySystem.id
      ),
    false,
    'Departure must remove the returned qualified balance from the Character.'
  )
  const heldAfterDeparture = await remaining.client.query(api.characters.builder.activeCharacter, {
    id: remainingCharacterId
  })
  assert.ok(heldAfterDeparture)
  const retainedAfterDeparture = heldAfterDeparture.state.equipment.inventory.find(
    (item) => item.id === heldBackpack.id
  )
  assert.deepEqual(retainedAfterDeparture, heldBackpack)
  if (!retainedAfterDeparture?.retainedRulesJson)
    throw new Error('Retained Character Equipment lost its raw rules.')
  assert.deepEqual(
    acquiredEquipmentRulesSchema.parse(JSON.parse(retainedAfterDeparture.retainedRulesJson)),
    heldRules
  )

  assert.deepEqual(await invoke(departure), { ok: true })
  assert.deepEqual(await read(), afterDeparture, 'Exact departure replay must not write.')
  const wrongActorReplay =
    reason === 'MEMBER_LEFT'
      ? owner.mutation(api.campaigns.membershipDeparture.leave, departure)
      : remaining.client.mutation(api.campaigns.membershipDeparture.removeMember, {
          ...departure,
          userId: departingUserId
        })
  await assert.rejects(() => wrongActorReplay, /different input/i)
  await assert.rejects(
    () =>
      invoke({
        ...departure,
        commandId: crypto.randomUUID(),
        expectedCampaignVersion: afterDeparture.campaign.version
      }),
    /active player|campaign not found|membership/i
  )
  assert.deepEqual(await read(), afterDeparture, 'Revoked replays must not write.')
  await assert.rejects(
    () => departing.client.query(api.campaigns.queries.get, { id: campaignId }),
    /not found|authorized|permission/i
  )
  await assert.rejects(
    () =>
      departing.client.query(api.campaigns.characterSheet.get, {
        campaignId,
        characterId: remainingCharacterId
      }),
    /not found|authorized|permission/i
  )
  assert.equal(
    await departing.client.query(api.characters.builder.activeCharacter, {
      id: remainingCharacterId
    }),
    null,
    'The revoked player must not read the other player Character.'
  )
  assert.equal(
    await remaining.client.query(api.characters.builder.activeCharacter, {
      id: departingCharacterId
    }),
    null,
    'The remaining player must not read the departed Character.'
  )

  const noWriteBeforeDenials = await read()
  for (const [vehicleId, bagId] of [
    [undefined, partyBag.id],
    [unrelatedVehicle.id, unrelatedVehicleBag.id]
  ] as const) {
    const version = await ownerVersion(vehicleId)
    await assert.rejects(
      () =>
        partyMutation({
          kind: 'ITEM_ADD',
          campaignId,
          ...(vehicleId ? { vehicleId } : {}),
          equipmentId: equipment.subjectId,
          quantity: 1,
          expectedOwnerVersion: version.version,
          idempotencyKey: crypto.randomUUID()
        }),
      /unavailable|not available|source/i
    )
    await assert.rejects(
      () =>
        partyMutation({
          kind: 'ITEM_UPDATE',
          campaignId,
          ...(vehicleId ? { vehicleId } : {}),
          itemId: bagId,
          quantity: 2,
          expectedOwnerVersion: version.version,
          idempotencyKey: crypto.randomUUID()
        }),
      /unavailable|not available|source/i
    )
  }
  const heldSheet = await remaining.client.query(api.characters.sheet.get, {
    id: remainingCharacterId
  })
  assert.ok(heldSheet)
  await assert.rejects(
    () =>
      remaining.client.mutation(api.characters.sheetCommands.execute, {
        id: remainingCharacterId,
        command: {
          type: 'ADD_INVENTORY_ITEM',
          equipmentId: equipment.subjectId,
          quantity: 1,
          commandId: crypto.randomUUID(),
          expectedVersion: heldSheet.meta.streamVersion
        }
      }),
    /unavailable|not available|source/i
  )
  await assert.rejects(
    () =>
      remaining.client.mutation(api.characters.sheetCommands.execute, {
        id: remainingCharacterId,
        command: {
          type: 'UPDATE_INVENTORY_ITEM',
          itemId: heldBackpack.id,
          quantity: 2,
          commandId: crypto.randomUUID(),
          expectedVersion: heldSheet.meta.streamVersion
        }
      }),
    /unavailable|not available|source/i
  )
  assert.deepEqual(
    await read(),
    noWriteBeforeDenials,
    'Source-loss denials must not write Party state.'
  )
  assert.deepEqual(
    await remaining.client.query(api.characters.builder.activeCharacter, {
      id: remainingCharacterId
    }),
    heldAfterDeparture,
    'Source-loss denials must not write the retained Character.'
  )

  await appendRetainedContent(undefined, partyBag.id)
  await appendRetainedContent(unrelatedVehicle.id, unrelatedVehicleBag.id)
  const metadataVersion = (
    await remaining.client.query(api.characters.sheet.get, {
      id: remainingCharacterId
    })
  )?.meta.streamVersion
  assert.ok(metadataVersion !== undefined)
  await remaining.client.mutation(api.characters.sheetCommands.execute, {
    id: remainingCharacterId,
    command: {
      type: 'UPDATE_INVENTORY_ITEM',
      itemId: heldBackpack.id,
      quantity: 1,
      customName: 'Retained after departure',
      notes: 'Updated without restoring the removed source.',
      commandId: crypto.randomUUID(),
      expectedVersion: metadataVersion
    }
  })
  const finalHeld = await remaining.client.query(api.characters.builder.activeCharacter, {
    id: remainingCharacterId
  })
  assert.equal(
    finalHeld?.state.equipment.inventory.find((item) => item.id === heldBackpack.id)?.customName,
    'Retained after departure'
  )
  assert.equal(
    finalHeld?.state.equipment.inventory.find((item) => item.id === heldBackpack.id)?.notes,
    'Updated without restoring the removed source.'
  )
  const finalState = await read()
  for (const [items, currencies, bagId] of [
    [finalState.partyItems, finalState.partyCurrencies, partyBag.id],
    [finalState.unrelatedCargo.items, finalState.unrelatedCargo.currencies, unrelatedVehicleBag.id]
  ] as const) {
    assert.equal(items.filter((item) => item.containerId === bagId).length, 2)
    assert.equal(
      currencies
        .filter((currency) => currency.containerId === bagId)
        .reduce((total, currency) => total + currency.amount, 0),
      4,
      'Existing retained containers must accept authorized contents after source loss.'
    )
  }

  return {
    actorUserId: reason === 'MEMBER_LEFT' ? departingUserId : cohort.ownerUserId,
    departingUserId,
    contention: {
      performed: invokingClient instanceof ConvexHttpClient,
      rejectedCommandId
    },
    departure: reason === 'MEMBER_LEFT' ? departure : { ...departure, userId: departingUserId },
    source: {
      equipmentId: equipment.subjectId,
      vehicleDefinitionId: vehicleDefinition.subjectId,
      vehicleId: sourceVehicle.id,
      partyBackpackId: partyBag.id,
      sourceVehicleBackpackId: sourceVehicleBag.id,
      unrelatedVehicleId: unrelatedVehicle.id,
      unrelatedVehicleBackpackId: unrelatedVehicleBag.id
    }
  }
}
