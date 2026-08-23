import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'

import { createClient } from '@supabase/supabase-js'
import {
  createDb,
  createNotificationRepository,
  withTransaction,
  type DBLike
} from '@artificer-toolkit/db'
import type { CreateSocialListingInput } from '@artificer-toolkit/schema/api/socialHub'
import { sql } from 'kysely'

import { createCampaign } from '../services/campaign/campaignService.js'
import {
  createSocialListing,
  initializeSocialProfile,
  openSocialListing,
  submitSocialApplication
} from '../services/social/index.js'

const LOCAL_DATABASE_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])
const HOST_EMAIL = 'social-host@local.test'
const PLAYER_EMAIL = 'social-player-one@local.test'
const OLD_DUE_AT = '2000-01-01T00:00:00.000Z'

type AuthAdmin = ReturnType<typeof createClient>['auth']['admin']

function requireLocalDatabaseUrl(): string {
  const connectionString = process.env.DATABASE_CONNECTION_STRING
  if (!connectionString) throw new Error('DATABASE_CONNECTION_STRING is required.')
  const host = new URL(connectionString).hostname.toLowerCase()
  if (!LOCAL_DATABASE_HOSTS.has(host)) {
    throw new Error(`Refusing to run the notification proof against non-local host "${host}".`)
  }
  return connectionString
}

function requireLocalSupabaseAdmin(): AuthAdmin {
  const rawUrl = process.env.SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!rawUrl || !secretKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required.')
  }
  const url = new URL(rawUrl)
  if (!LOCAL_DATABASE_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error('Notification Auth fixtures must target loopback Supabase.')
  }
  return createClient(rawUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  }).auth.admin
}

async function fixtureUsers(
  db: DBLike,
  admin: AuthAdmin,
  createdUserIds: string[]
): Promise<{
  host: { id: string; username: string }
  player: { id: string; username: string }
}> {
  const result = await sql<{ email: string; id: string }>`
    select email, id::text as id from auth.users where email in (${HOST_EMAIL}, ${PLAYER_EMAIL})
  `.execute(db)
  const byEmail = new Map(result.rows.map((row) => [row.email.toLowerCase(), row.id]))

  const ensure = async (email: string, username: string): Promise<string> => {
    const existingId = byEmail.get(email)
    if (existingId) return existingId
    const { data, error } = await admin.createUser({
      email,
      email_confirm: true,
      password: `Local-${randomUUID()}-Aa1!`,
      user_metadata: { username }
    })
    if (error) throw error
    if (!data.user) throw new Error(`Supabase did not create the disposable user ${email}.`)
    createdUserIds.push(data.user.id)
    return data.user.id
  }

  const hostId = await ensure(HOST_EMAIL, 'notification_host')
  const playerId = await ensure(PLAYER_EMAIL, 'notification_player')
  return {
    host: { id: hostId, username: 'social_host' },
    player: { id: playerId, username: 'social_player_one' }
  }
}

function isRetryableAdmin500(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 500
}

async function deleteDisposableUser(admin: AuthAdmin, userId: string): Promise<boolean> {
  const first = await admin.deleteUser(userId)
  if (!first.error) return false
  if (!isRetryableAdmin500(first.error)) throw first.error
  const second = await admin.deleteUser(userId)
  if (second.error) throw second.error
  return true
}

async function prepareUser(db: DBLike, user: { id: string; username: string }): Promise<void> {
  await sql`
    update profiles set username = ${user.username}, updated_at = now() where id = ${user.id}::uuid
  `.execute(db)
  await initializeSocialProfile(db, user.id)
}

async function findSystemId(db: DBLike): Promise<string> {
  const result = await sql<{ id: string }>`
    select id::text as id from systems order by created_at, id limit 1
  `.execute(db)
  const systemId = result.rows[0]?.id
  if (!systemId) throw new Error('The local database needs one seeded rules system.')
  return systemId
}

function listingFields(systemId: string): Omit<CreateSocialListingInput, 'campaignId'> {
  return {
    summary: 'Notification integration proof listing.',
    audience: 'PUBLIC',
    systemId,
    playMode: 'ONLINE',
    capacity: 2,
    schedule: {
      kind: 'FLEXIBLE',
      timeZone: 'America/Chicago',
      summary: 'Schedule coordinated with accepted players.'
    },
    location: null,
    expectations: {
      contentGuidance: 'Adults-only fantasy adventure with agreed boundaries.',
      attendancePolicy: 'Give advance notice when possible.',
      allowedContentRules: 'Published rules plus host-approved options.',
      tableConduct: 'Respect boundaries and share spotlight time.',
      contentBoundaries: 'Boundaries are confirmed before play.',
      safetyPractices: ['SESSION_ZERO', 'X_CARD'],
      safetyDetails: 'Session zero establishes boundaries.'
    }
  }
}

async function main(): Promise<void> {
  const db = createDb({ connectionString: requireLocalDatabaseUrl() })
  const admin = requireLocalSupabaseAdmin()
  const createdSourceIds = new Set<string>()
  const createdUserIds: string[] = []
  let campaignId: string | undefined
  let hostId: string | undefined
  let playerId: string | undefined
  let originalTier = 'FREE'

  try {
    const users = await fixtureUsers(db, admin, createdUserIds)
    hostId = users.host.id
    playerId = users.player.id
    await prepareUser(db, users.host)
    await prepareUser(db, users.player)
    const tier = await sql<{ tier: string }>`
      select tier from account_entitlements where user_id = ${users.host.id}::uuid
    `.execute(db)
    originalTier = tier.rows[0]?.tier ?? 'FREE'
    await sql`
      update account_entitlements set tier = 'PRO_GM' where user_id = ${users.host.id}::uuid
    `.execute(db)

    const campaign = await createCampaign(db, users.host.id, {
      name: 'Notification integration proof',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD'
    })
    campaignId = campaign.id
    const draft = await createSocialListing(db, users.host.id, {
      campaignId: campaign.id,
      ...listingFields(await findSystemId(db))
    })
    const listing = await openSocialListing(db, users.host.id, draft.listingPublicId, draft.version)
    const application = await submitSocialApplication(db, users.player.id, {
      listingPublicId: listing.listingPublicId,
      expectedListingVersion: listing.version,
      message: 'Notification integration application.'
    })
    createdSourceIds.add(application.applicationPublicId)

    const committed = await sql<{ intent_count: string; source_count: string }>`
      select
        (select count(*) from social_applications where id = ${application.applicationPublicId}::uuid)::text as source_count,
        (select count(*) from notification_delivery_intents
          where source_public_id = ${application.applicationPublicId}::uuid
            and operation = 'TRIGGER'
            and workflow_key = 'social-application-submitted')::text as intent_count
    `.execute(db)
    assert.equal(committed.rows[0]?.source_count, '1')
    assert.equal(committed.rows[0]?.intent_count, '1')

    const notificationRepository = createNotificationRepository(db)
    assert.equal(
      await notificationRepository.insertDeliveryIntent({
        operation: 'TRIGGER',
        workflowKey: 'social-application-submitted',
        sourceKind: 'SOCIAL_APPLICATION',
        sourcePublicId: application.applicationPublicId,
        recipientUserId: users.host.id,
        groupingKey: listing.listingPublicId,
        occurredAt: new Date().toISOString(),
        payload: {
          kind: 'SOCIAL_APPLICATION_SUBMITTED',
          sourcePublicId: application.applicationPublicId,
          listingPublicId: listing.listingPublicId,
          listingTitle: 'Notification integration proof',
          applicantUsername: users.player.username,
          occurredAt: new Date().toISOString()
        }
      }),
      null
    )

    const beforeFailedMutation = await sql<{ count: string }>`
      select count(*)::text as count from notification_delivery_intents
      where source_public_id = ${application.applicationPublicId}::uuid
    `.execute(db)
    await assert.rejects(
      submitSocialApplication(db, users.player.id, {
        listingPublicId: listing.listingPublicId,
        expectedListingVersion: listing.version,
        message: 'Duplicate application must fail.'
      })
    )
    const afterFailedMutation = await sql<{ count: string }>`
      select count(*)::text as count from notification_delivery_intents
      where source_public_id = ${application.applicationPublicId}::uuid
    `.execute(db)
    assert.equal(afterFailedMutation.rows[0]?.count, beforeFailedMutation.rows[0]?.count)

    await assert.rejects(
      withTransaction(db, async (trx) => {
        await sql`
          update social_applications
          set status = 'WITHDRAWN', withdrawn_at = now(), version = version + 1, updated_at = now()
          where id = ${application.applicationPublicId}::uuid and status = 'SUBMITTED'
        `.execute(trx)
        const cancelId = await createNotificationRepository(trx).insertDeliveryIntent({
          operation: 'CANCEL',
          workflowKey: 'social-application-submitted',
          sourceKind: 'SOCIAL_APPLICATION',
          sourcePublicId: application.applicationPublicId,
          recipientUserId: users.host.id,
          occurredAt: new Date().toISOString()
        })
        assert.ok(cancelId)
        throw new Error('forced transaction rollback')
      }),
      /forced transaction rollback/
    )
    const rolledBack = await sql<{ cancel_count: string; status: string }>`
      select application.status,
        (select count(*) from notification_delivery_intents intent
          where intent.source_public_id = application.id and intent.operation = 'CANCEL')::text
          as cancel_count
      from social_applications application where application.id = ${application.applicationPublicId}::uuid
    `.execute(db)
    assert.equal(rolledBack.rows[0]?.status, 'SUBMITTED')
    assert.equal(rolledBack.rows[0]?.cancel_count, '0')
    await sql`
      update notification_delivery_intents set delivered_at = now()
      where source_public_id = ${application.applicationPublicId}::uuid
    `.execute(db)

    const concurrentIntentIds = new Set<string>()
    for (let index = 0; index < 20; index += 1) {
      const sourceId = randomUUID()
      createdSourceIds.add(sourceId)
      const intentId = await notificationRepository.insertDeliveryIntent({
        operation: 'CANCEL',
        workflowKey: 'social-application-submitted',
        sourceKind: 'SOCIAL_APPLICATION',
        sourcePublicId: sourceId,
        recipientUserId: users.host.id,
        occurredAt: new Date().toISOString()
      })
      assert.ok(intentId)
      concurrentIntentIds.add(intentId)
    }
    await sql`
      update notification_delivery_intents set next_attempt_at = ${OLD_DUE_AT}::timestamptz
      where id = any(${sql.val([...concurrentIntentIds])}::uuid[])
    `.execute(db)
    const claimNow = new Date().toISOString()
    const staleBefore = new Date(Date.now() - 5 * 60 * 1_000).toISOString()
    const [firstClaim, secondClaim] = await Promise.all([
      notificationRepository.claimDeliveryIntents({ limit: 10, now: claimNow, staleBefore }),
      notificationRepository.claimDeliveryIntents({ limit: 10, now: claimNow, staleBefore })
    ])
    assert.ok(firstClaim.length <= 10)
    assert.ok(secondClaim.length <= 10)
    const concurrentlyClaimedIds = [...firstClaim, ...secondClaim].map((intent) => intent.id)
    assert.equal(concurrentlyClaimedIds.length, 20)
    assert.equal(new Set(concurrentlyClaimedIds).size, 20)
    assert.deepEqual(new Set(concurrentlyClaimedIds), concurrentIntentIds)
    await sql`
      update notification_delivery_intents set claimed_at = null, delivered_at = now()
      where id = any(${sql.val([...concurrentIntentIds])}::uuid[])
    `.execute(db)

    const staleIntentIds = new Set<string>()
    for (let index = 0; index < 10; index += 1) {
      const sourceId = randomUUID()
      createdSourceIds.add(sourceId)
      const intentId = await notificationRepository.insertDeliveryIntent({
        operation: 'CANCEL',
        workflowKey: 'social-application-submitted',
        sourceKind: 'SOCIAL_APPLICATION',
        sourcePublicId: sourceId,
        recipientUserId: users.host.id,
        occurredAt: new Date().toISOString()
      })
      assert.ok(intentId)
      staleIntentIds.add(intentId)
    }
    await sql`
      update notification_delivery_intents
      set next_attempt_at = ${OLD_DUE_AT}::timestamptz,
        claimed_at = ${OLD_DUE_AT}::timestamptz, attempt_count = 1
      where id = any(${sql.val([...staleIntentIds])}::uuid[])
    `.execute(db)
    const staleClaim = await notificationRepository.claimDeliveryIntents({
      limit: 10,
      now: claimNow,
      staleBefore
    })
    assert.deepEqual(new Set(staleClaim.map((intent) => intent.id)), staleIntentIds)
    const reclaimed = await sql<{ count: string }>`
      select count(*)::text as count from notification_delivery_intents
      where id = any(${sql.val([...staleIntentIds])}::uuid[]) and attempt_count = 2
    `.execute(db)
    assert.equal(reclaimed.rows[0]?.count, '10')
    await sql`
      update notification_delivery_intents set claimed_at = null, delivered_at = now()
      where id = any(${sql.val([...staleIntentIds])}::uuid[])
    `.execute(db)

    await assert.rejects(
      withTransaction(db, async (trx) => {
        const cancellationDueAt = '1900-01-01T00:00:00.000Z'
        const cancelledRetrySourceId = randomUUID()
        const repository = createNotificationRepository(trx)
        const cancelledTriggerId = await repository.insertDeliveryIntent({
          operation: 'TRIGGER',
          workflowKey: 'social-application-submitted',
          sourceKind: 'SOCIAL_APPLICATION',
          sourcePublicId: cancelledRetrySourceId,
          recipientUserId: users.host.id,
          groupingKey: listing.listingPublicId,
          occurredAt: cancellationDueAt,
          payload: {
            kind: 'SOCIAL_APPLICATION_SUBMITTED',
            sourcePublicId: cancelledRetrySourceId,
            listingPublicId: listing.listingPublicId,
            listingTitle: 'Cancelled retry proof',
            applicantUsername: users.player.username,
            occurredAt: cancellationDueAt
          }
        })
        assert.ok(cancelledTriggerId)
        await sql`
          update notification_delivery_intents
          set attempt_count = 1, next_attempt_at = ${cancellationDueAt}::timestamptz
          where id = ${cancelledTriggerId}::uuid
        `.execute(trx)
        const cancellationId = await repository.insertDeliveryIntent({
          operation: 'CANCEL',
          workflowKey: 'social-application-submitted',
          sourceKind: 'SOCIAL_APPLICATION',
          sourcePublicId: cancelledRetrySourceId,
          recipientUserId: users.host.id,
          occurredAt: cancellationDueAt
        })
        assert.ok(cancellationId)
        await sql`
          update notification_delivery_intents
          set next_attempt_at = ${cancellationDueAt}::timestamptz
          where id in (${cancelledTriggerId}::uuid, ${cancellationId}::uuid)
        `.execute(trx)
        await repository.suppressCancelledDeliveryTriggers(claimNow, staleBefore)
        const cancellationClaim = await repository.claimDeliveryIntents({
          limit: 10,
          now: claimNow,
          staleBefore
        })
        assert.ok(cancellationClaim.some((intent) => intent.id === cancellationId))
        assert.ok(cancellationClaim.every((intent) => intent.id !== cancelledTriggerId))
        const suppressedTrigger = await sql<{
          failed_at: string | null
          last_error_code: string | null
        }>`
          select failed_at::text, last_error_code
          from notification_delivery_intents
          where id = ${cancelledTriggerId}::uuid
        `.execute(trx)
        assert.ok(suppressedTrigger.rows[0]?.failed_at)
        assert.equal(suppressedTrigger.rows[0]?.last_error_code, 'SOURCE_CANCELLED')
        throw new Error('forced cancellation proof rollback')
      }),
      /forced cancellation proof rollback/
    )

    const exhaustedSourceId = randomUUID()
    createdSourceIds.add(exhaustedSourceId)
    const exhaustedIntentId = await notificationRepository.insertDeliveryIntent({
      operation: 'CANCEL',
      workflowKey: 'social-application-submitted',
      sourceKind: 'SOCIAL_APPLICATION',
      sourcePublicId: exhaustedSourceId,
      recipientUserId: users.host.id,
      occurredAt: new Date().toISOString()
    })
    assert.ok(exhaustedIntentId)
    await sql`
      update notification_delivery_intents
      set claimed_at = ${OLD_DUE_AT}::timestamptz, attempt_count = 10
      where id = ${exhaustedIntentId}::uuid
    `.execute(db)
    await notificationRepository.markExhaustedDeliveryIntents(claimNow, staleBefore)
    const exhausted = await sql<{ failed_at: string | null; last_error_code: string | null }>`
      select failed_at::text, last_error_code from notification_delivery_intents
      where id = ${exhaustedIntentId}::uuid
    `.execute(db)
    assert.ok(exhausted.rows[0]?.failed_at)
    assert.equal(exhausted.rows[0]?.last_error_code, 'ATTEMPTS_EXHAUSTED')

    console.info('Notification local proof passed: source/outbox commit and rollback coupling')
    console.info('Notification local proof passed: uniqueness and failed mutation silence')
    console.info('Notification local proof passed: concurrent claiming, lease recovery, exhaustion')
    console.info('Notification local proof passed: cancellation suppresses trigger retry')
  } finally {
    try {
      if (createdSourceIds.size > 0) {
        await sql`
          delete from notification_delivery_intents
          where source_public_id = any(${sql.val([...createdSourceIds])}::uuid[])
        `.execute(db)
      }
      if (campaignId) await sql`delete from campaigns where id = ${campaignId}::uuid`.execute(db)
      if (hostId) {
        await sql`
          update account_entitlements set tier = ${originalTier} where user_id = ${hostId}::uuid
        `.execute(db)
      }
      if (hostId && playerId) {
        await sql`
          delete from social_action_rate_limits
          where user_id in (${hostId}::uuid, ${playerId}::uuid)
        `.execute(db)
      }
      let authDeleteRetryCount = 0
      for (const userId of createdUserIds.reverse()) {
        if (await deleteDisposableUser(admin, userId)) authDeleteRetryCount += 1
      }
      if (createdUserIds.length > 0) {
        const residual = await sql<{ auth_users: number; profiles: number }>`
          select
            (select count(*)::int from auth.users where id = any(${sql.val(createdUserIds)}::uuid[]))
              as auth_users,
            (select count(*)::int from profiles where id = any(${sql.val(createdUserIds)}::uuid[]))
              as profiles
        `.execute(db)
        assert.deepStrictEqual(residual.rows[0], { auth_users: 0, profiles: 0 })
        console.info(
          JSON.stringify({
            authFixtureCleanup: 'verified',
            authDeleteRetryCount,
            createdUserCount: createdUserIds.length
          })
        )
      }
    } finally {
      await db.destroy()
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
