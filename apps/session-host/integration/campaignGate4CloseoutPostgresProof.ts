import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import {
  createAuthoredVersionRepository,
  createCampaignAdjustmentsRepository,
  createCampaignCollaborationRepository,
  createCampaignRepository,
  createCampaignVehicleRepository,
  createDb,
  createMediaRepository,
  createNotificationRepository,
  srdBaselineContent,
  type DBLike
} from '@artificer-toolkit/db'
import {
  acceptCampaignOwnershipTransfer,
  activateAuthoredDomainInput,
  authoredDomainConfigs,
  copyCampaign,
  createCampaign,
  createCampaignVehicle,
  createSocialListing,
  enqueueCampaignAnnouncementNotification,
  getCampaign,
  getNotificationFeed,
  initializeSocialProfile,
  listCampaignVehicles,
  markNotificationRead,
  openSocialListing,
  requestCampaignOwnershipTransfer,
  searchSocialListings,
  shareCampaignContent,
  updateNotificationPreferences
} from '@artificer-toolkit/functions/services'
import {
  campaignVehicleDtoSchema,
  createCampaignVehicleInputSchema
} from '@artificer-toolkit/schema/api/campaigns'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import { vehicleAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/vehicle'
import type { SpellAuthored, VehicleAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { sql } from 'kysely'

const OPERATION_TIMEOUT_MS = 10_000
const COPY_EVENT_FAILURE = 'gate4-copy-event-failure'

export interface Gate4CloseoutProofOptions {
  connectionString: string
  ownerUserId: string
  recipientUserId: string
  runId: string
  sourceCampaignId: string
  sourceCampaignPublicId: string
  sourceCampaignVersion: number
  sourceName: string
  systemId: string
  onCampaignCreated(campaignId: string): void
  onMediaKeyCreated(objectKey: string): void
  onNotificationSourceCreated(sourceId: string): void
  onRootCreated(subjectKind: 'SPELL' | 'VEHICLE', subjectId: string): void
}

export interface SeededMasterVehicleProofOptions {
  connectionString: string
  ownerUserId: string
  runId: string
  sourceCampaignId: string
  sourceCampaignVersion: number
  systemId: string
  onCampaignCreated(campaignId: string): void
}

interface OwnedSpell {
  id: string
}

interface VehicleInventoryFixture {
  balanceId: string
  itemId: string
  ownerId: string
  vehicleId: string
}

class ProofPlumbingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProofPlumbingError'
  }
}

function taggedConnectionString(connectionString: string, label: string): string {
  const url = new URL(connectionString)
  url.searchParams.set('application_name', `artificer-gate4-closeout-${label}`)
  return url.toString()
}

function createTaggedDb(connectionString: string, label: string) {
  return createDb({ connectionString: taggedConnectionString(connectionString, label) })
}

async function withTimeout<T>(label: string, operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new ProofPlumbingError(`${label} exceeded ${OPERATION_TIMEOUT_MS} ms.`)),
          OPERATION_TIMEOUT_MS
        )
      })
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function seededSpell(): SpellAuthored {
  const spell = srdBaselineContent.subjects.spells.find((candidate) => candidate.level > 0)
  assert.ok(spell, 'The canonical corpus must contain a leveled Spell.')
  return spell
}

async function createOwnedSpell(
  db: DBLike,
  options: Gate4CloseoutProofOptions,
  userId: string,
  label: string
): Promise<OwnedSpell> {
  const id = randomUUID()
  options.onRootCreated('SPELL', id)
  const spell = seededSpell()
  await activateAuthoredDomainInput(
    db,
    authoredDomainConfigs.spells,
    spellAuthoredDtoSchema.parse({
      ...spell,
      id,
      label: `Gate 4 ${label} ${options.runId}`,
      systemId: options.systemId,
      userId
    }),
    userId
  )
  const current = await createAuthoredVersionRepository(db).findActive({
    subjectKind: 'SPELL',
    subjectId: id
  })
  assert.ok(current, 'The disposable owned Spell did not activate.')
  return { id }
}

async function createOwnedVehicle(
  db: DBLike,
  options: Gate4CloseoutProofOptions
): Promise<OwnedSpell> {
  const source = srdBaselineContent.subjects.vehicles[0] as VehicleAuthored | undefined
  assert.ok(source, 'The canonical corpus must contain a Vehicle.')
  const id = randomUUID()
  options.onRootCreated('VEHICLE', id)
  await activateAuthoredDomainInput(
    db,
    authoredDomainConfigs.vehicles,
    vehicleAuthoredDtoSchema.parse({
      ...source,
      id,
      label: `Gate 4 owned Vehicle ${options.runId}`,
      systemId: options.systemId,
      userId: options.ownerUserId
    }),
    options.ownerUserId
  )
  const current = await createAuthoredVersionRepository(db).findActive({
    subjectKind: 'VEHICLE',
    subjectId: id
  })
  assert.ok(current, 'The disposable owned Vehicle did not activate.')
  return { id }
}

async function createVehicleInventoryFixture(
  db: DBLike,
  options: Gate4CloseoutProofOptions,
  definitionId: string
): Promise<VehicleInventoryFixture> {
  const equipmentResult = await sql<{ id: string }>`
    select id from public.equipment
    where system_id = ${options.systemId}::uuid and is_master = true and status = 'ACTIVE'
    order by id limit 1
  `.execute(db)
  const equipmentId = equipmentResult.rows[0]?.id
  assert.ok(equipmentId, 'The canonical database must contain ACTIVE Master Equipment.')
  const vehicle = await createCampaignVehicle(db, options.ownerUserId, {
    campaignId: options.sourceCampaignId,
    vehicleDefinitionId: definitionId,
    label: `Gate 4 cargo ${options.runId}`
  })
  const ownerResult = await sql<{ ownerId: string }>`
    select id as "ownerId"
    from public.inventory_owners
    where kind = 'VEHICLE' and vehicle_id = ${vehicle.id}::uuid
  `.execute(db)
  const ownerId = ownerResult.rows[0]?.ownerId
  assert.ok(ownerId, 'The disposable Campaign Vehicle has no inventory owner.')
  const currencyResult = await sql<{ id: string }>`
    select id from public.currencies where system_id = ${options.systemId}::uuid order by id limit 1
  `.execute(db)
  const currencyId = currencyResult.rows[0]?.id
  assert.ok(currencyId, 'The canonical System has no currency.')
  const itemId = randomUUID()
  const balanceId = randomUUID()
  await sql`
    insert into public.inventory_items (
      id, owner_id, equipment_id, quantity, custom_name, notes,
      equipped, attuned, placement_kind, placement_id
    ) values (
      ${itemId}::uuid, ${ownerId}::uuid, ${equipmentId}::uuid, 2,
      'Gate 4 source cargo', 'Copy must not mutate this source item.',
      false, false, 'VEHICLE', ${vehicle.id}::uuid
    )
  `.execute(db)
  await sql`
    insert into public.inventory_currency_balances (
      id, owner_id, group_id, ruleset_currency_id, amount
    ) values (${balanceId}::uuid, ${ownerId}::uuid, null, ${currencyId}::uuid, 17)
  `.execute(db)
  return { balanceId, itemId, ownerId, vehicleId: vehicle.id }
}

export async function proveSeededMasterCampaignVehicleSemantics(
  options: SeededMasterVehicleProofOptions
): Promise<void> {
  const db = createDb({ connectionString: options.connectionString })
  try {
    await sql`
      update public.account_entitlements set tier = 'GM'
      where user_id = ${options.ownerUserId}::uuid
    `.execute(db)
    const definitionResult = await sql<{
      activeVersionId: string
      id: string
      status: string
      systemId: string
    }>`
      select
        active_version_id as "activeVersionId",
        id,
        status,
        system_id as "systemId"
      from public.vehicles
      where id = '00000000-0000-0000-0080-000100000000'::uuid
        and is_master = true
    `.execute(db)
    const definition = definitionResult.rows[0]
    assert.ok(definition, 'The canonical seeded Galley Vehicle is unavailable.')
    assert.equal(definition.id, '00000000-0000-0000-0080-000100000000')
    assert.equal(definition.status, 'ACTIVE')
    assert.equal(definition.systemId, options.systemId)
    assert.match(definition.activeVersionId, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/)

    const input = createCampaignVehicleInputSchema.parse({
      campaignId: options.sourceCampaignId,
      vehicleDefinitionId: definition.id,
      label: `Gate 4 seeded Master Vehicle ${options.runId}`
    })
    const vehicle = campaignVehicleDtoSchema.parse(
      await createCampaignVehicle(db, options.ownerUserId, input)
    )
    assert.equal(vehicle.vehicleDefinitionId, definition.id)
    assert.deepEqual(
      await listCampaignVehicles(db, options.ownerUserId, options.sourceCampaignId),
      [vehicle]
    )
    assert.deepEqual(
      await createCampaignVehicleRepository(db).find(options.sourceCampaignId, vehicle.id),
      vehicle
    )

    const sourceBefore = await sql<{ owners: unknown; vehicles: unknown }>`
      select
        (select coalesce(jsonb_agg(to_jsonb(row) order by row.id), '[]'::jsonb)
          from (select * from public.campaign_vehicles
            where campaign_id = ${options.sourceCampaignId}::uuid) row) as vehicles,
        (select coalesce(jsonb_agg(to_jsonb(row) order by row.id), '[]'::jsonb)
          from (select * from public.inventory_owners
            where campaign_id = ${options.sourceCampaignId}::uuid) row) as owners
    `.execute(db)
    const copied = await copyCampaign(db, options.ownerUserId, {
      campaignId: options.sourceCampaignId,
      commandId: randomUUID(),
      expectedVersion: options.sourceCampaignVersion
    })
    options.onCampaignCreated(copied.id)
    assert.deepEqual(
      await sql<{ owners: unknown; vehicles: unknown }>`
        select
          (select coalesce(jsonb_agg(to_jsonb(row) order by row.id), '[]'::jsonb)
            from (select * from public.campaign_vehicles
              where campaign_id = ${options.sourceCampaignId}::uuid) row) as vehicles,
          (select coalesce(jsonb_agg(to_jsonb(row) order by row.id), '[]'::jsonb)
            from (select * from public.inventory_owners
              where campaign_id = ${options.sourceCampaignId}::uuid) row) as owners
      `.execute(db),
      sourceBefore
    )
    assert.deepEqual(await listCampaignVehicles(db, options.ownerUserId, copied.id), [])

    console.log(
      JSON.stringify({
        gate4Result: 7,
        result: 'seeded-master-campaign-vehicle-api-repository',
        status: 'PASS',
        vehicleDefinitionId: definition.id
      })
    )
  } finally {
    await db.destroy()
  }
}

async function sourceCopyState(
  db: DBLike,
  options: Gate4CloseoutProofOptions,
  vehicle: VehicleInventoryFixture
) {
  const result = await sql<{
    balances: unknown
    items: unknown
    notes: unknown
    shares: unknown
    social: unknown
    vehicles: unknown
  }>`
    select
      (select coalesce(jsonb_agg(to_jsonb(row) order by row.subject_kind, row.subject_id), '[]'::jsonb)
        from (select * from public.campaign_content_shares
          where campaign_id = ${options.sourceCampaignId}::uuid) row) as shares,
      (select coalesce(jsonb_agg(to_jsonb(row) order by row.id), '[]'::jsonb)
        from (select * from public.campaign_vehicles
          where id = ${vehicle.vehicleId}::uuid) row) as vehicles,
      (select coalesce(jsonb_agg(to_jsonb(row) order by row.id), '[]'::jsonb)
        from (select * from public.inventory_items
          where id = ${vehicle.itemId}::uuid) row) as items,
      (select coalesce(jsonb_agg(to_jsonb(row) order by row.id), '[]'::jsonb)
        from (select * from public.inventory_currency_balances
          where id = ${vehicle.balanceId}::uuid) row) as balances,
      (select coalesce(jsonb_agg(to_jsonb(row) order by row.id), '[]'::jsonb)
        from (select * from public.campaign_note_sections
          where campaign_id = ${options.sourceCampaignId}::uuid) row) as notes,
      (select coalesce(jsonb_agg(to_jsonb(row) order by row.id), '[]'::jsonb)
        from (select * from public.social_listings
          where campaign_id = ${options.sourceCampaignId}::uuid) row) as social
  `.execute(db)
  const row = result.rows[0]
  assert.ok(row)
  return row
}

async function proveRetainedSocial(
  db: DBLike,
  options: Gate4CloseoutProofOptions
): Promise<string> {
  await initializeSocialProfile(db, options.ownerUserId)
  await initializeSocialProfile(db, options.recipientUserId)
  const draft = await createSocialListing(db, options.ownerUserId, {
    campaignId: options.sourceCampaignId,
    summary: `Gate 4 retained Social listing ${options.runId}`,
    audience: 'PUBLIC',
    systemId: options.systemId,
    playMode: 'ONLINE',
    capacity: 2,
    schedule: {
      kind: 'FLEXIBLE',
      timeZone: 'America/Chicago',
      summary: 'Schedule coordinated with the table.'
    },
    location: null,
    expectations: {
      contentGuidance: 'Standard heroic fantasy content.',
      attendancePolicy: 'Give notice when possible.',
      allowedContentRules: 'Published rules and agreed homebrew.',
      tableConduct: 'Respect boundaries and share spotlight time.',
      contentBoundaries: 'Boundaries are agreed before play.',
      safetyPractices: ['SESSION_ZERO', 'X_CARD'],
      safetyDetails: 'Session zero establishes table boundaries.'
    }
  })
  const opened = await openSocialListing(
    db,
    options.ownerUserId,
    draft.listingPublicId,
    draft.version
  )
  const discovered = await searchSocialListings(db, options.recipientUserId, {
    query: options.runId,
    limit: 20
  })
  assert.equal(opened.status, 'OPEN')
  assert.ok(
    discovered.items.some((listing) => listing.listingPublicId === opened.listingPublicId),
    'The public Social listing was not discoverable through the server service.'
  )
  return opened.listingPublicId
}

async function proveRetainedNotifications(
  db: DBLike,
  options: Gate4CloseoutProofOptions
): Promise<void> {
  const sourceId = randomUUID()
  options.onNotificationSourceCreated(sourceId)
  const occurredAt = new Date().toISOString()
  await enqueueCampaignAnnouncementNotification(db, {
    announcementPublicId: sourceId,
    campaignPublicId: options.sourceCampaignPublicId,
    recipientUserId: options.recipientUserId,
    scope: 'TABLE',
    occurredAt
  })
  const intentResult = await sql<{ id: string }>`
    select id from public.notification_delivery_intents
    where source_public_id = ${sourceId}::uuid and operation = 'TRIGGER'
  `.execute(db)
  const intentId = intentResult.rows[0]?.id
  assert.ok(intentId, 'The notification outbox intent was not persisted.')
  const feedResult = await sql<{ id: string | null }>`
    select public.record_notification_feed_item(${intentId}::uuid) as id
  `.execute(db)
  const feedItemId = feedResult.rows[0]?.id
  assert.ok(feedItemId, 'The notification feed item was not recorded.')
  await createNotificationRepository(db).markDeliverySucceeded(intentId, occurredAt)
  const feed = await getNotificationFeed(db, options.recipientUserId)
  assert.equal(feed.unseenCount, 1)
  assert.equal(feed.items[0]?.id, feedItemId)
  await markNotificationRead(db, options.recipientUserId, feedItemId)
  const afterRead = await getNotificationFeed(db, options.recipientUserId)
  assert.ok(afterRead.items[0]?.readAt)
  const preferences = await updateNotificationPreferences(db, options.recipientUserId, {
    category: 'CAMPAIGN',
    inApp: true,
    email: false
  })
  assert.deepEqual(preferences.campaign, { inApp: true, email: false })
}

async function proveRetainedMedia(db: DBLike, options: Gate4CloseoutProofOptions): Promise<void> {
  const objectKey = `gate4/${options.runId}/retained-object.webp`
  options.onMediaKeyCreated(objectKey)
  const media = createMediaRepository(db)
  await media.scheduleObjectDeletions([objectKey, objectKey])
  await sql`
    update public.media_object_deletions
    set created_at = now() - interval '16 minutes'
    where object_key = ${objectKey}
  `.execute(db)
  assert.equal((await media.listObjectDeletions()).filter((key) => key === objectKey).length, 1)
  await media.completeObjectDeletions([objectKey])
  assert.equal((await media.listObjectDeletions()).includes(objectKey), false)
}

async function proveCopyLateRollback(
  db: DBLike,
  options: Gate4CloseoutProofOptions
): Promise<void> {
  const before = await sql<{
    campaigns: number
    events: number
    memberships: number
    notes: number
    routes: number
  }>`
    select
      (select count(*)::int from public.campaigns where owner_user_id = ${options.ownerUserId}::uuid) as campaigns,
      (select count(*)::int from public.campaign_events where campaign_id = ${options.sourceCampaignId}::uuid) as events,
      (select count(*)::int from public.campaign_memberships membership
        join public.campaigns campaign on campaign.id = membership.campaign_id
        where campaign.owner_user_id = ${options.ownerUserId}::uuid) as memberships,
      (select count(*)::int from public.campaign_note_sections note
        join public.campaigns campaign on campaign.id = note.campaign_id
        where campaign.owner_user_id = ${options.ownerUserId}::uuid) as notes,
      (select count(*)::int from public.authored_route_ids route
        join public.campaigns campaign on campaign.id = route.subject_id
        where route.subject_kind = 'CAMPAIGN' and campaign.owner_user_id = ${options.ownerUserId}::uuid) as routes
  `.execute(db)
  await assert.rejects(
    db.transaction().execute(async (trx) => {
      await sql`
        create function pg_temp.raise_gate4_copy_event_failure()
        returns trigger language plpgsql as $$
        begin
          if new.kind = 'CAMPAIGN_COPIED' then raise exception 'gate4-copy-event-failure'; end if;
          return new;
        end
        $$
      `.execute(trx)
      await sql`
        create trigger gate4_copy_event_failure
        before insert on public.campaign_events
        for each row execute function pg_temp.raise_gate4_copy_event_failure()
      `.execute(trx)
      await copyCampaign(trx, options.ownerUserId, {
        campaignId: options.sourceCampaignId,
        commandId: randomUUID(),
        expectedVersion: options.sourceCampaignVersion
      })
    }),
    new RegExp(COPY_EVENT_FAILURE)
  )
  const after = await sql<{
    campaigns: number
    events: number
    memberships: number
    notes: number
    routes: number
  }>`
    select
      (select count(*)::int from public.campaigns where owner_user_id = ${options.ownerUserId}::uuid) as campaigns,
      (select count(*)::int from public.campaign_events where campaign_id = ${options.sourceCampaignId}::uuid) as events,
      (select count(*)::int from public.campaign_memberships membership
        join public.campaigns campaign on campaign.id = membership.campaign_id
        where campaign.owner_user_id = ${options.ownerUserId}::uuid) as memberships,
      (select count(*)::int from public.campaign_note_sections note
        join public.campaigns campaign on campaign.id = note.campaign_id
        where campaign.owner_user_id = ${options.ownerUserId}::uuid) as notes,
      (select count(*)::int from public.authored_route_ids route
        join public.campaigns campaign on campaign.id = route.subject_id
        where route.subject_kind = 'CAMPAIGN' and campaign.owner_user_id = ${options.ownerUserId}::uuid) as routes
  `.execute(db)
  assert.deepEqual(after.rows[0], before.rows[0])
}

async function createFillerCampaign(
  db: DBLike,
  options: Gate4CloseoutProofOptions,
  label: string
): Promise<string> {
  const campaign = await createCampaign(db, options.ownerUserId, {
    name: `Gate 4 filler ${label} ${options.runId}`,
    format: 'ONE_SHOT',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD'
  })
  options.onCampaignCreated(campaign.id)
  return campaign.id
}

async function proveCampaignCopy(
  db: DBLike,
  options: Gate4CloseoutProofOptions,
  listingId: string,
  vehicle: VehicleInventoryFixture
): Promise<void> {
  const before = await sourceCopyState(db, options, vehicle)
  const commandId = randomUUID()
  const left = createTaggedDb(options.connectionString, `same-left-${options.runId}`)
  const right = createTaggedDb(options.connectionString, `same-right-${options.runId}`)
  let sameResults: Awaited<ReturnType<typeof copyCampaign>>[]
  try {
    sameResults = await withTimeout(
      'Concurrent identical Campaign copy',
      Promise.all([
        copyCampaign(left, options.ownerUserId, {
          campaignId: options.sourceCampaignId,
          commandId,
          expectedVersion: options.sourceCampaignVersion
        }),
        copyCampaign(right, options.ownerUserId, {
          campaignId: options.sourceCampaignId,
          commandId,
          expectedVersion: options.sourceCampaignVersion
        })
      ])
    )
  } finally {
    await Promise.allSettled([left.destroy(), right.destroy()])
  }
  assert.equal(sameResults[0]?.id, sameResults[1]?.id)
  const copiedId = sameResults[0]?.id
  assert.ok(copiedId)
  options.onCampaignCreated(copiedId)
  const exactCopyCount = await sql<{ count: number }>`
    select count(*)::int as count from public.campaigns
    where owner_user_id = ${options.ownerUserId}::uuid and name = ${options.sourceName}
  `.execute(db)
  assert.equal(exactCopyCount.rows[0]?.count, 2)

  const destination = await sql<{
    assignments: number
    balances: number
    items: number
    notes: number
    shares: number
    social: number
    vehicles: number
  }>`
    select
      (select count(*)::int from public.campaign_content_shares where campaign_id = ${copiedId}::uuid) as shares,
      (select count(*)::int from public.campaign_vehicles where campaign_id = ${copiedId}::uuid) as vehicles,
      (select count(*)::int from public.campaign_character_assignments where campaign_id = ${copiedId}::uuid) as assignments,
      (select count(*)::int from public.social_listings where campaign_id = ${copiedId}::uuid) as social,
      (select count(*)::int from public.campaign_note_sections where campaign_id = ${copiedId}::uuid) as notes,
      (select count(*)::int from public.inventory_items item join public.inventory_owners owner on owner.id = item.owner_id where owner.campaign_id = ${copiedId}::uuid) as items,
      (select count(*)::int from public.inventory_currency_balances balance join public.inventory_owners owner on owner.id = balance.owner_id where owner.campaign_id = ${copiedId}::uuid) as balances
  `.execute(db)
  assert.deepEqual(destination.rows[0], {
    assignments: 0,
    balances: 0,
    items: 0,
    notes: 1,
    shares: 0,
    social: 0,
    vehicles: 0
  })
  assert.deepEqual(await sourceCopyState(db, options, vehicle), before)
  const sourceListing = await sql<{ count: number }>`
    select count(*)::int as count from public.social_listings
    where id = ${listingId}::uuid and campaign_id = ${options.sourceCampaignId}::uuid and status = 'OPEN'
  `.execute(db)
  assert.equal(sourceListing.rows[0]?.count, 1)
  const receipts = await sql<{ count: number }>`
    select count(*)::int as count from public.campaign_events
    where campaign_id = ${options.sourceCampaignId}::uuid
      and kind = 'CAMPAIGN_COPIED' and idempotency_key = ${commandId}::uuid
  `.execute(db)
  assert.equal(receipts.rows[0]?.count, 1)
  const timeline = await createCampaignAdjustmentsRepository(db).listVisibleEvents({
    campaignId: options.sourceCampaignId,
    viewer: { kind: 'OWNER' },
    limit: 25
  })
  assert.equal(
    timeline.some((event) => event.kind === 'CAMPAIGN_COPIED'),
    false
  )

  await proveCopyLateRollback(db, options)

  await createFillerCampaign(db, options, 'one')
  await createFillerCampaign(db, options, 'two')
  const distinctLeft = createTaggedDb(options.connectionString, `distinct-left-${options.runId}`)
  const distinctRight = createTaggedDb(options.connectionString, `distinct-right-${options.runId}`)
  let settled: PromiseSettledResult<Awaited<ReturnType<typeof copyCampaign>>>[]
  try {
    settled = await withTimeout(
      'Concurrent entitlement-bound Campaign copies',
      Promise.allSettled([
        copyCampaign(distinctLeft, options.ownerUserId, {
          campaignId: options.sourceCampaignId,
          commandId: randomUUID(),
          expectedVersion: options.sourceCampaignVersion
        }),
        copyCampaign(distinctRight, options.ownerUserId, {
          campaignId: options.sourceCampaignId,
          commandId: randomUUID(),
          expectedVersion: options.sourceCampaignVersion
        })
      ])
    )
  } finally {
    await Promise.allSettled([distinctLeft.destroy(), distinctRight.destroy()])
  }
  const fulfilled = settled.filter(
    (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof copyCampaign>>> =>
      result.status === 'fulfilled'
  )
  assert.equal(fulfilled.length, 1)
  assert.equal(settled.filter((result) => result.status === 'rejected').length, 1)
  options.onCampaignCreated(fulfilled[0].value.id)
  const activeCount = await createCampaignRepository(db).countActiveOwned(options.ownerUserId)
  assert.equal(activeCount, 5)

  await requestCampaignOwnershipTransfer(
    db,
    options.ownerUserId,
    options.sourceCampaignId,
    options.recipientUserId
  )
  await acceptCampaignOwnershipTransfer(db, options.recipientUserId, options.sourceCampaignId)
  const transferredTimeline = await createCampaignAdjustmentsRepository(db).listVisibleEvents({
    campaignId: options.sourceCampaignId,
    viewer: { kind: 'OWNER' },
    limit: 25
  })
  assert.equal(
    transferredTimeline.some((event) => event.kind === 'CAMPAIGN_COPIED'),
    false
  )
  await assert.rejects(getCampaign(db, options.recipientUserId, copiedId))
}

export async function proveGate4CloseoutPostgresSemantics(
  options: Gate4CloseoutProofOptions
): Promise<void> {
  const db = createDb({ connectionString: options.connectionString })
  try {
    await sql`
      update public.account_entitlements set tier = 'GM'
      where user_id in (${options.ownerUserId}::uuid, ${options.recipientUserId}::uuid)
    `.execute(db)
    await createCampaignCollaborationRepository(db).insertCampaignNoteSection({
      campaignId: options.sourceCampaignId,
      title: 'Reusable preparation',
      content: 'Only this scalar notebook preparation is copied.',
      visibility: 'GM_PRIVATE',
      category: 'GENERAL',
      sortOrder: 0,
      createdBy: options.ownerUserId
    })
    const ownerSpell = await createOwnedSpell(db, options, options.ownerUserId, 'owner Spell')
    const recipientSpell = await createOwnedSpell(
      db,
      options,
      options.recipientUserId,
      'third-party Spell'
    )
    const ownerVehicle = await createOwnedVehicle(db, options)
    await shareCampaignContent(db, options.ownerUserId, {
      campaignId: options.sourceCampaignId,
      subjectKind: 'SPELL',
      subjectId: ownerSpell.id
    })
    await shareCampaignContent(db, options.recipientUserId, {
      campaignId: options.sourceCampaignId,
      subjectKind: 'SPELL',
      subjectId: recipientSpell.id
    })
    await shareCampaignContent(db, options.ownerUserId, {
      campaignId: options.sourceCampaignId,
      subjectKind: 'VEHICLE',
      subjectId: ownerVehicle.id
    })
    const vehicle = await createVehicleInventoryFixture(db, options, ownerVehicle.id)
    const listingId = await proveRetainedSocial(db, options)
    await proveRetainedNotifications(db, options)
    await proveRetainedMedia(db, options)
    await proveCampaignCopy(db, options, listingId, vehicle)

    console.log(
      JSON.stringify({ gate4Result: 7, result: 'campaign-copy-direct-share', status: 'PASS' })
    )
    console.log(JSON.stringify({ gate4Result: 8, result: 'social-retained', status: 'PASS' }))
    console.log(
      JSON.stringify({ gate4Result: 9, result: 'notifications-retained', status: 'PASS' })
    )
    console.log(JSON.stringify({ gate4Result: 10, result: 'media-retained', status: 'PASS' }))
  } finally {
    await db.destroy()
  }
}
