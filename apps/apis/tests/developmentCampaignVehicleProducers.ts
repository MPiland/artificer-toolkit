import assert from 'node:assert/strict'
import { appendFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  getFunctionName,
  type FunctionArgs,
  type FunctionReference,
  type FunctionReturnType
} from 'convex/server'
import type { InventoryOwnerRefDto } from '@artificer-toolkit/schema/api/campaignInventory'
import type { CampaignVehicleDto } from '@artificer-toolkit/schema/api/campaignVehicles'
import { vehicleAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/vehicle'
import { decodeCampaignInventoryAuditPage } from '@artificer-toolkit/schema/api/campaignInventoryPages'
import { srdVehicles } from '@artificer-toolkit/source-data/srd/vehicles/index.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { api } from '../convex/_generated/api.js'
import type { CampaignCustodyCohort } from './developmentCampaignCustody'
import type { DevelopmentClient } from './developmentClient'

async function pages<T>(
  load: (cursor: string | null) => Promise<{ page: T[]; isDone: boolean; continueCursor: string }>
) {
  const rows: T[] = []
  const seen = new Set<string>()
  let cursor: string | null = null
  while (true) {
    const result = await load(cursor)
    rows.push(...result.page)
    if (result.isDone) return rows
    assert.ok(result.continueCursor)
    assert.equal(seen.has(result.continueCursor), false, 'Pagination cursor must advance.')
    seen.add(result.continueCursor)
    cursor = result.continueCursor
  }
}

async function inventoryPages<T>(
  load: (cursor: string | null) => Promise<{
    owner: InventoryOwnerRefDto
    version: number
    page: T[]
    isDone: boolean
    continueCursor: string
  }>
) {
  let fence: { owner: InventoryOwnerRefDto; version: number } | undefined
  const page = await pages(async (cursor) => {
    const result = await load(cursor)
    const current = { owner: result.owner, version: result.version }
    if (fence)
      assert.deepEqual(
        current,
        fence,
        'Every inventory page must retain its owner and version fence.'
      )
    else fence = current
    return result
  })
  assert.ok(fence)
  return { ...fence, page }
}

/** Public Vehicle producer proof; proposal target: apps/apis/tests/developmentCampaignVehicleProducers.ts. */
export async function verifyCampaignVehicleProducers(
  cohort: CampaignCustodyCohort,
  anonymous: DevelopmentClient
) {
  const { owner, players, campaignId, characterIds } = cohort
  const [firstPlayer, secondPlayer] = players
  const [firstCharacterId, secondCharacterId] = characterIds
  assert.ok(firstPlayer && secondPlayer && firstCharacterId && secondCharacterId)
  const input = (cursor: string | null) => ({ campaignId, paginationOpts: { cursor, numItems: 1 } })
  const vehicleOptions = async (client: DevelopmentClient) => {
    const [official, shared] = await Promise.all([
      pages((cursor) => client.query(api.campaigns.vehicles.definitionOptions, input(cursor))),
      pages((cursor) => client.query(api.campaigns.contentShares.list, input(cursor)))
    ])
    const choices = [
      ...official.map((entry) => ({ id: entry.id, label: entry.label })),
      ...shared
        .filter((entry) => entry.subjectKind === 'VEHICLE')
        .map((entry) => ({
          id: entry.subjectId,
          label: vehicleAuthoredDtoSchema.parse(entry.document).label
        }))
    ]
    assert.equal(new Set(choices.map((entry) => entry.id)).size, choices.length)
    return { official, shared, choices }
  }
  const vehicles = (client: DevelopmentClient) =>
    pages((cursor) => client.query(api.campaigns.vehicles.list, input(cursor)))
  const shares = () =>
    pages((cursor) => owner.query(api.campaigns.contentShares.list, input(cursor)))
  const ownerRef = (vehicleId?: string): InventoryOwnerRefDto =>
    vehicleId === undefined ? { kind: 'CAMPAIGN', campaignId } : { kind: 'VEHICLE', vehicleId }
  const items = (vehicleId?: string) =>
    inventoryPages((cursor) =>
      vehicleId === undefined
        ? owner.query(api.campaigns.partyInventory.items, input(cursor))
        : owner.query(api.campaigns.vehicleInventory.items, { ...input(cursor), vehicleId })
    )
  const currencies = (vehicleId?: string) =>
    inventoryPages((cursor) =>
      vehicleId === undefined
        ? owner.query(api.campaigns.partyInventory.currencies, input(cursor))
        : owner.query(api.campaigns.vehicleInventory.currencies, { ...input(cursor), vehicleId })
    )
  const readShared = async (vehicleId?: string) => {
    const [heldItems, heldCurrencies, fence] = await Promise.all([
      items(vehicleId),
      currencies(vehicleId),
      owner.query(api.campaigns.inventoryOwners.version, {
        input: { campaignId, owner: ownerRef(vehicleId) }
      })
    ])
    assert.deepEqual(heldItems.owner, ownerRef(vehicleId))
    assert.deepEqual(heldCurrencies.owner, ownerRef(vehicleId))
    assert.equal(heldItems.version, heldCurrencies.version)
    assert.equal(heldItems.version, fence.version)
    assert.equal(new Set(heldItems.page.map((item) => item.id)).size, heldItems.page.length)
    return { items: heldItems, currencies: heldCurrencies, fence }
  }
  const audit = async () => {
    const rows = []
    const seen = new Set<string>()
    let cursor: string | undefined
    while (true) {
      const page = decodeCampaignInventoryAuditPage(
        await owner.query(api.campaigns.inventoryAudit.list, {
          campaignId,
          limit: 1,
          ...(cursor === undefined ? {} : { cursor })
        })
      )
      rows.push(...page.events)
      if (page.nextCursor === null) return rows
      assert.equal(seen.has(page.nextCursor), false, 'Audit cursor must advance.')
      seen.add(page.nextCursor)
      cursor = page.nextCursor
    }
  }
  const read = async () => {
    const [
      ownerOptions,
      firstOptions,
      secondOptions,
      ownerVehicles,
      firstVehicles,
      secondVehicles,
      currentShares,
      auditRows,
      party,
      characters
    ] = await Promise.all([
      vehicleOptions(owner),
      vehicleOptions(firstPlayer.client),
      vehicleOptions(secondPlayer.client),
      vehicles(owner),
      vehicles(firstPlayer.client),
      vehicles(secondPlayer.client),
      shares(),
      audit(),
      readShared(),
      Promise.all(
        characterIds.map(async (id, index) => {
          const player = players[index]
          assert.ok(player)
          const [builder, sheet, draft, fence] = await Promise.all([
            player.client.query(api.characters.builder.get, { id }),
            player.client.query(api.characters.sheet.get, { id }),
            player.client.query(api.characters.drafts.get, { id }),
            owner.query(api.campaigns.inventoryOwners.version, {
              input: { campaignId, owner: { kind: 'CHARACTER', characterId: id } }
            })
          ])
          assert.ok(builder && sheet)
          assert.equal(sheet.meta.viewer, 'CHARACTER_OWNER')
          assert.equal(sheet.meta.streamVersion, fence.version)
          return { id, builder, sheet, draft, fence }
        })
      )
    ])
    const cargo = await Promise.all(
      ownerVehicles.map(async (vehicle) => ({ vehicle, state: await readShared(vehicle.id) }))
    )
    return {
      options: { owner: ownerOptions, firstPlayer: firstOptions, secondPlayer: secondOptions },
      vehicles: { owner: ownerVehicles, firstPlayer: firstVehicles, secondPlayer: secondVehicles },
      shares: currentShares,
      party,
      characters,
      cargo,
      audit: auditRows
    }
  }
  type Snapshot = Awaited<ReturnType<typeof read>>
  const assertOfficialOptions = (snapshot: Snapshot) => {
    const expected = srdVehicles.map((vehicle) => vehicle.id).sort()
    assert.equal(expected.length, 11)
    assert.equal(new Set(expected).size, expected.length)
    for (const page of Object.values(snapshot.options)) {
      const ids = page.official.map((entry) => entry.id)
      assert.equal(new Set(ids).size, expected.length)
      assert.deepEqual(ids.sort(), expected)
      assert.ok(page.official.every((entry) => entry.provenance.kind === 'MASTER'))
    }
  }
  const deniedOperations: Array<{ label: string; before: Snapshot; after: Snapshot }> = []
  const noWrites = async (label: string, operation: () => Promise<unknown>) => {
    const before = await read()
    await assert.rejects(
      operation,
      /identity|authenticated|owner|permission|authorized|version|changed|unavailable/i
    )
    const after = await read()
    assert.deepEqual(after, before, label + ' must not write.')
    deniedOperations.push({ label, before, after })
  }
  const findVehicle = (snapshot: Snapshot, id: string) => {
    const found = snapshot.vehicles.owner.find((vehicle) => vehicle.id === id)
    assert.ok(found)
    return found
  }
  const shared = (snapshot: Snapshot, vehicleId?: string) => {
    if (vehicleId === undefined) return snapshot.party
    const found = snapshot.cargo.find((entry) => entry.vehicle.id === vehicleId)
    assert.ok(found)
    return found.state
  }
  const assertSupportingStatePreserved = (before: Snapshot, after: Snapshot) => {
    assert.deepEqual(after.party, before.party)
    assert.deepEqual(after.characters, before.characters)
  }
  const assertExistingVehiclesAndCargoPreserved = (
    before: Snapshot,
    after: Snapshot,
    exceptVehicleIds: string[] = []
  ) => {
    const exceptions = new Set(exceptVehicleIds)
    for (const vehicle of before.vehicles.owner) {
      if (exceptions.has(vehicle.id)) continue
      assert.deepEqual(findVehicle(after, vehicle.id), vehicle)
      assert.deepEqual(shared(after, vehicle.id), shared(before, vehicle.id))
    }
  }

  const mutations: Array<{
    function: string
    input: unknown
    receipt?: unknown
    error?: string
    before: Snapshot
    after: Snapshot
  }> = []
  const evidenceDirectory = process.env.CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY
  const recordStep = async (record: unknown) => {
    if (evidenceDirectory)
      await appendFile(
        resolve(evidenceDirectory, 'vehicle-producer-steps.jsonl'),
        JSON.stringify(record) + '\n'
      )
  }
  const mutate = async <Mutation extends FunctionReference<'mutation'>>(
    client: DevelopmentClient,
    reference: Mutation,
    input: FunctionArgs<Mutation>
  ): Promise<FunctionReturnType<Mutation>> => {
    const before = await read()
    const command = { step: mutations.length, function: getFunctionName(reference), input }
    await recordStep({ phase: 'before', ...command, before })
    let receipt: FunctionReturnType<Mutation>
    try {
      receipt = await client.mutation(reference, input)
      await recordStep({ phase: 'receipt', ...command, receipt })
    } catch (error) {
      await recordStep({
        phase: 'error',
        ...command,
        error: error instanceof Error ? error.message : String(error)
      })
      const after = await read()
      await recordStep({ phase: 'after-refusal', ...command, before, after })
      assert.deepEqual(after, before, 'A rejected producer command must preserve complete state.')
      mutations.push({
        function: getFunctionName(reference),
        input,
        error: error instanceof Error ? error.message : String(error),
        before,
        after
      })
      throw error
    }
    const after = await read()
    await recordStep({ phase: 'after', ...command, receipt, before, after })
    if (getFunctionName(reference) !== getFunctionName(api.campaigns.contentShares.unshare))
      assertSupportingStatePreserved(before, after)
    mutations.push({ function: getFunctionName(reference), input, receipt, before, after })
    return receipt
  }
  const initial = await read()
  assertOfficialOptions(initial)
  assert.deepEqual(initial.vehicles.owner, initial.vehicles.firstPlayer)
  assert.deepEqual(initial.vehicles.owner, initial.vehicles.secondPlayer)
  const createInput = { campaignId, vehicleDefinitionId: cart.id, label: 'P13 official Cart' }
  await noWrites('anonymous official Vehicle create', () =>
    mutate(anonymous, api.campaigns.vehicles.create, createInput)
  )
  await noWrites('Player official Vehicle create', () =>
    mutate(firstPlayer.client, api.campaigns.vehicles.create, createInput)
  )

  const officialBefore = await read()
  const official: CampaignVehicleDto = await mutate(
    owner,
    api.campaigns.vehicles.create,
    createInput
  )
  assert.equal(official.vehicleDefinitionId, cart.id)
  assert.equal(official.campaignId, campaignId)
  assert.equal(official.label, createInput.label)
  assert.equal(official.version, 0)
  assert.equal(official.availability ?? 'AVAILABLE', 'AVAILABLE')
  assert.ok(official.createdAt && official.updatedAt)
  const officialAfterCreate = await read()
  assertSupportingStatePreserved(initial, officialAfterCreate)
  assertExistingVehiclesAndCargoPreserved(initial, officialAfterCreate)
  assert.deepEqual(findVehicle(officialAfterCreate, official.id), official)
  assert.deepEqual(shared(officialAfterCreate, official.id).items.page, [])
  assert.deepEqual(shared(officialAfterCreate, official.id).currencies.page, [])
  for (const page of Object.values(officialAfterCreate.vehicles))
    assert.deepEqual(
      page.find((vehicle) => vehicle.id === official.id),
      official
    )
  const staleUpdate = {
    campaignId,
    vehicleId: official.id,
    label: 'P13 stale',
    expectedVersion: official.version + 1
  }
  await noWrites('anonymous Vehicle update', () =>
    mutate(anonymous, api.campaigns.vehicles.update, staleUpdate)
  )
  await noWrites('Player Vehicle update', () =>
    mutate(secondPlayer.client, api.campaigns.vehicles.update, staleUpdate)
  )
  await noWrites('stale Vehicle update', () =>
    mutate(owner, api.campaigns.vehicles.update, staleUpdate)
  )
  const officialUpdateInput = {
    campaignId,
    vehicleId: official.id,
    label: 'P13 official Cart renamed',
    expectedVersion: official.version
  }
  const officialUpdated = await mutate(owner, api.campaigns.vehicles.update, officialUpdateInput)
  assert.deepEqual(officialUpdated, {
    ...official,
    label: officialUpdateInput.label,
    version: official.version + 1,
    updatedAt: officialUpdated.updatedAt
  })
  assert.ok(Date.parse(officialUpdated.updatedAt) > Date.parse(official.updatedAt))
  const officialAfterUpdate = await read()
  assertSupportingStatePreserved(officialAfterCreate, officialAfterUpdate)
  assertExistingVehiclesAndCargoPreserved(officialAfterCreate, officialAfterUpdate, [official.id])
  assert.deepEqual(findVehicle(officialAfterUpdate, official.id), officialUpdated)
  assert.deepEqual(
    shared(officialAfterUpdate, official.id),
    shared(officialAfterCreate, official.id)
  )
  for (const original of officialBefore.vehicles.owner)
    assert.deepEqual(findVehicle(officialAfterUpdate, original.id), original)

  const unpublished = await mutate(owner, api.content.drafts.duplicate, {
    subjectKind: 'VEHICLE',
    subjectId: cart.id
  })
  await noWrites('unshared Homebrew create', () =>
    mutate(owner, api.campaigns.vehicles.create, {
      campaignId,
      vehicleDefinitionId: unpublished.subjectId,
      label: 'P13 unshared Homebrew'
    })
  )
  const saved = await mutate(owner, api.content.drafts.save, {
    subjectKind: 'VEHICLE',
    subjectId: unpublished.subjectId,
    systemId: unpublished.systemId,
    label: 'P13 shared Cart revision one',
    payload: unpublished.payload
  })
  assert.ok(saved.updatedAt)
  const published = await mutate(owner, api.content.publication.publishDraft, {
    subjectKind: 'VEHICLE',
    subjectId: saved.subjectId,
    expectedDraftUpdatedAt: saved.updatedAt
  })
  await mutate(owner, api.campaigns.contentShares.share, {
    campaignId,
    subjectKind: 'VEHICLE',
    subjectId: published.subjectId
  })
  const sharedBeforeRevision = await read()
  for (const page of Object.values(sharedBeforeRevision.options))
    assert.ok(
      page.choices.some((entry) => entry.id === published.subjectId && entry.label === saved.label)
    )
  const sharedCreateInput = {
    campaignId,
    vehicleDefinitionId: published.subjectId,
    label: 'P13 shared instance one'
  }
  const sharedOne = await mutate(owner, api.campaigns.vehicles.create, sharedCreateInput)
  const revisionTwo = await mutate(owner, api.content.drafts.save, {
    subjectKind: 'VEHICLE',
    subjectId: published.subjectId,
    systemId: saved.systemId,
    label: 'P13 shared Cart revision two',
    payload: saved.payload
  })
  assert.ok(revisionTwo.updatedAt)
  const republished = await mutate(owner, api.content.publication.publishDraft, {
    subjectKind: 'VEHICLE',
    subjectId: revisionTwo.subjectId,
    expectedDraftUpdatedAt: revisionTwo.updatedAt
  })
  const workingDraft = await mutate(owner, api.content.drafts.save, {
    subjectKind: 'VEHICLE',
    subjectId: republished.subjectId,
    systemId: revisionTwo.systemId,
    label: 'P13 owner-private working Cart after revision two',
    payload: revisionTwo.payload
  })
  assert.equal(workingDraft.draftState, 'ACTIVE_WITH_DRAFT')
  const afterRevision = await read()
  for (const page of Object.values(afterRevision.options)) {
    const current = page.choices.find((entry) => entry.id === published.subjectId)
    assert.ok(current)
    assert.equal(current.label, revisionTwo.label)
    assert.equal(JSON.stringify(page).includes(workingDraft.label), false)
    assert.deepEqual(page.official, initial.options.owner.official)
  }
  assert.deepEqual(findVehicle(afterRevision, sharedOne.id), sharedOne)
  const sharedTwo = await mutate(owner, api.campaigns.vehicles.create, {
    campaignId,
    vehicleDefinitionId: republished.subjectId,
    label: 'P13 shared instance two'
  })
  const sharedTwoUpdated = await mutate(owner, api.campaigns.vehicles.update, {
    campaignId,
    vehicleId: sharedTwo.id,
    label: 'P13 shared instance two renamed',
    expectedVersion: sharedTwo.version
  })
  assert.equal(sharedTwoUpdated.version, sharedTwo.version + 1)
  const beforeUnshare = await read()
  assertSupportingStatePreserved(officialAfterUpdate, beforeUnshare)
  assertExistingVehiclesAndCargoPreserved(officialAfterUpdate, beforeUnshare)
  const campaignBeforeUnshare = await owner.query(api.campaigns.queries.get, { id: campaignId })
  assert.ok(campaignBeforeUnshare)
  const unshareInput = {
    campaignId,
    subjectKind: 'VEHICLE' as const,
    subjectId: published.subjectId,
    sharedBy: cohort.ownerUserId,
    expectedCampaignVersion: campaignBeforeUnshare.version,
    commandId: crypto.randomUUID()
  }
  const unshared = await mutate(owner, api.campaigns.contentShares.unshare, unshareInput)
  const afterUnshare = await read()
  assert.deepEqual(await mutate(owner, api.campaigns.contentShares.unshare, unshareInput), unshared)
  assert.deepEqual(await read(), afterUnshare, 'Exact unshare replay must not write.')
  assert.deepEqual(unshared.removedShares, [
    { subjectKind: 'VEHICLE', subjectId: published.subjectId, sharedBy: cohort.ownerUserId }
  ])
  assert.deepEqual(
    unshared.evacuatedVehicles.map((vehicle) => vehicle.vehicleId).sort(),
    [sharedOne.id, sharedTwo.id].sort()
  )
  assert.deepEqual(
    afterUnshare.vehicles.owner,
    beforeUnshare.vehicles.owner.filter(
      (vehicle) => vehicle.vehicleDefinitionId !== published.subjectId
    )
  )
  assert.deepEqual(
    afterUnshare.shares,
    beforeUnshare.shares.filter((share) => share.subjectId !== published.subjectId)
  )
  assert.deepEqual(afterUnshare.characters, beforeUnshare.characters)
  const partyVersion = beforeUnshare.party.fence.version + unshared.evacuatedVehicles.length
  assert.deepEqual(
    afterUnshare.party,
    {
      items: { ...beforeUnshare.party.items, version: partyVersion },
      currencies: { ...beforeUnshare.party.currencies, version: partyVersion },
      fence: { ...beforeUnshare.party.fence, version: partyVersion }
    },
    'Every empty Vehicle evacuation advances the Party fence without changing cargo.'
  )
  assertExistingVehiclesAndCargoPreserved(beforeUnshare, afterUnshare, [sharedOne.id, sharedTwo.id])
  const retainedDraft = await owner.query(api.content.drafts.get, {
    subjectKind: 'VEHICLE',
    subjectId: published.subjectId
  })
  assert.deepEqual(
    retainedDraft,
    workingDraft,
    'Owner private draft must stay literal after Campaign source loss.'
  )
  const final = await read()
  assert.deepEqual(
    final.vehicles.owner.find((vehicle) => vehicle.id === official.id),
    officialUpdated
  )
  assert.equal(
    final.vehicles.owner.some(
      (vehicle) => vehicle.id === sharedOne.id || vehicle.id === sharedTwo.id
    ),
    false
  )
  assert.deepEqual(
    final.options.owner.official.map((entry) => entry.id).sort(),
    srdVehicles.map((entry) => entry.id).sort()
  )
  assert.deepEqual(final.options.firstPlayer, final.options.owner)
  assert.deepEqual(final.options.secondPlayer, final.options.owner)
  for (const page of Object.values(final.options))
    assert.equal(
      page.choices.some((entry) => entry.id === published.subjectId),
      false
    )
  const cleanupInput = {
    campaignId,
    vehicleId: official.id,
    expectedVersion: officialUpdated.version,
    expectedInventoryVersion: shared(final, official.id).fence.version,
    action: 'REMOVE_DESTROY_CARGO' as const,
    idempotencyKey: crypto.randomUUID()
  }
  const cleanupReceipt = await mutate(owner, api.campaigns.vehicles.lifecycle, {
    input: cleanupInput
  })
  const cleaned = await read()
  assert.deepEqual(
    await mutate(owner, api.campaigns.vehicles.lifecycle, { input: cleanupInput }),
    cleanupReceipt
  )
  assert.deepEqual(await read(), cleaned, 'Exact temporary Vehicle cleanup replay must not write.')
  assertSupportingStatePreserved(final, cleaned)
  assertExistingVehiclesAndCargoPreserved(final, cleaned, [official.id])
  assert.equal(
    cleaned.vehicles.owner.some((vehicle) => vehicle.id === official.id),
    false
  )
  assert.equal(characterIds.length, 2)
  return {
    initial,
    deniedOperations,
    mutations,
    official: {
      createInput,
      official,
      officialUpdated,
      before: officialBefore,
      afterCreate: officialAfterCreate,
      after: officialAfterUpdate
    },
    homebrew: {
      unpublished,
      saved,
      published,
      workingDraft,
      revisionTwo,
      republished,
      sharedOne,
      sharedTwo,
      sharedTwoUpdated,
      beforeUnshare,
      afterUnshare
    },
    final,
    cleanup: { input: cleanupInput, receipt: cleanupReceipt, after: cleaned }
  }
}
