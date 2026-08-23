import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'

import { createClient } from '@supabase/supabase-js'
import { createDb, type DBLike } from '@artificer-toolkit/db'
import { sql } from 'kysely'

import {
  createCampaignAnnouncement,
  getCampaignAnnouncement
} from '../services/campaign/campaignAnnouncementService.js'
import { createCampaign } from '../services/campaign/campaignService.js'
import { getNotificationFeed } from '../services/notifications/notificationService.js'

const LOCAL_DATABASE_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])
const HOST_EMAIL = 'social-host@local.test'
const PLAYER_EMAIL = 'social-player-one@local.test'
const DISPATCH_URL = 'http://127.0.0.1:54321/functions/v1/notification-dispatch'
const DISPATCH_SECRET = 'local-notification-dispatch-proof'

type AuthAdmin = ReturnType<typeof createClient>['auth']['admin']

interface NotificationPreferenceSnapshot {
  email_enabled: boolean
  in_app_enabled: boolean
}

function requireLocalDatabaseUrl(): string {
  const connectionString = process.env.DATABASE_CONNECTION_STRING
  if (!connectionString) throw new Error('DATABASE_CONNECTION_STRING is required.')
  const host = new URL(connectionString).hostname.toLowerCase()
  if (!LOCAL_DATABASE_HOSTS.has(host)) {
    throw new Error(`Refusing to run the Campaign announcement proof against ${host}.`)
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
    throw new Error('Campaign announcement Auth fixtures must target loopback Supabase.')
  }
  return createClient(rawUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  }).auth.admin
}

async function fixtureUsers(
  db: DBLike,
  admin: AuthAdmin,
  createdUserIds: string[]
): Promise<{ hostId: string; playerId: string }> {
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
  const hostId = await ensure(HOST_EMAIL, 'announcement_host')
  const playerId = await ensure(PLAYER_EMAIL, 'announcement_player')
  return { hostId, playerId }
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

async function dispatch(): Promise<void> {
  const response = await fetch(DISPATCH_URL, {
    method: 'POST',
    headers: { 'x-notification-dispatch-secret': DISPATCH_SECRET }
  })
  if (!response.ok) throw new Error(`Local notification dispatch failed with ${response.status}.`)
  const result = (await response.json()) as { claimed?: unknown; delivered?: unknown }
  assert.equal(result.claimed, 1)
  assert.equal(result.delivered, 1)
}

async function main(): Promise<void> {
  const db = createDb({ connectionString: requireLocalDatabaseUrl() })
  const admin = requireLocalSupabaseAdmin()
  const createdUserIds: string[] = []
  let campaignId: string | undefined
  let announcementId: string | undefined
  let playerId: string | undefined
  let preferenceBefore: NotificationPreferenceSnapshot | undefined
  try {
    const fixture = await fixtureUsers(db, admin, createdUserIds)
    const { hostId } = fixture
    playerId = fixture.playerId
    const campaign = await createCampaign(db, hostId, {
      name: 'Local announcement proof',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD'
    })
    campaignId = campaign.id
    await sql`
      insert into campaign_memberships (campaign_id, user_id, role, status)
      values (${campaign.id}::uuid, ${playerId}::uuid, 'PLAYER', 'ACTIVE')
    `.execute(db)
    preferenceBefore = (
      await sql<NotificationPreferenceSnapshot>`
        select in_app_enabled, email_enabled
        from notification_preferences
        where user_id = ${playerId}::uuid and category = 'CAMPAIGN'
      `.execute(db)
    ).rows[0]
    await sql`
      insert into notification_preferences (user_id, category, in_app_enabled, email_enabled)
      values (${playerId}::uuid, 'CAMPAIGN', true, false)
      on conflict (user_id, category) do update
      set in_app_enabled = true, email_enabled = false, updated_at = now()
    `.execute(db)

    const announcement = await createCampaignAnnouncement(db, hostId, {
      campaignId: campaign.id,
      commandId: randomUUID(),
      scope: 'TABLE',
      partyId: null,
      title: 'The next game is confirmed',
      body: 'Bring your current character sheet and be ready to begin in town.'
    })
    announcementId = announcement.announcementPublicId

    const recipients = await sql<{ user_id: string }>`
      select profile.id::text as user_id
      from notification_delivery_intents intent
      join profiles profile on profile.notification_recipient_id = intent.recipient_notification_id
      where intent.source_public_id = ${announcementId}::uuid and intent.operation = 'TRIGGER'
    `.execute(db)
    assert.deepEqual(
      recipients.rows.map((row) => row.user_id),
      [playerId]
    )

    await dispatch()
    const feed = await getNotificationFeed(db, playerId)
    assert.equal(feed.items.length, 1)
    assert.equal(feed.unseenCount, 1)
    assert.equal(feed.items[0]?.data.kind, 'CAMPAIGN_ANNOUNCEMENT')
    if (feed.items[0]?.data.kind !== 'CAMPAIGN_ANNOUNCEMENT')
      throw new Error('Missing announcement feed item.')
    assert.equal(feed.items[0].data.announcementPublicId, announcementId)

    const authorized = await getCampaignAnnouncement(db, playerId, campaign.id, announcementId)
    assert.equal(authorized.title, announcement.title)
    assert.equal(authorized.body, announcement.body)

    const hostFeed = await getNotificationFeed(db, hostId)
    assert.equal(hostFeed.items.length, 0)
    console.info(
      'Campaign announcement local proof passed: GM source, Player-only intent, Supabase feed, authorized destination.'
    )
  } finally {
    try {
      if (announcementId) {
        await sql`delete from notification_delivery_intents where source_public_id = ${announcementId}::uuid`.execute(
          db
        )
      }
      if (campaignId) await sql`delete from campaigns where id = ${campaignId}::uuid`.execute(db)
      if (playerId && !createdUserIds.includes(playerId)) {
        if (preferenceBefore) {
          await sql`
            update notification_preferences
            set in_app_enabled = ${preferenceBefore.in_app_enabled},
                email_enabled = ${preferenceBefore.email_enabled}, updated_at = now()
            where user_id = ${playerId}::uuid and category = 'CAMPAIGN'
          `.execute(db)
        } else {
          await sql`
            delete from notification_preferences
            where user_id = ${playerId}::uuid and category = 'CAMPAIGN'
          `.execute(db)
        }
      }
      let authDeleteRetryCount = 0
      for (const userId of createdUserIds.reverse()) {
        if (await deleteDisposableUser(admin, userId)) authDeleteRetryCount += 1
      }
      if (createdUserIds.length > 0) {
        const residual = await sql<{ auth_users: number; profiles: number }>`
          select
            (select count(*)::int from auth.users
              where id = any(${sql.val(createdUserIds)}::uuid[])) as auth_users,
            (select count(*)::int from profiles
              where id = any(${sql.val(createdUserIds)}::uuid[])) as profiles
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
