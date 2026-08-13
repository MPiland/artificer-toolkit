import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'

import { createDb, type DBLike } from '@artificer-toolkit/db'
import { sql } from 'kysely'

import { createCampaignAnnouncement, getCampaignAnnouncement } from '../services/campaign/campaignAnnouncementService.js'
import { createCampaign } from '../services/campaign/campaignService.js'
import { getNotificationFeed } from '../services/notifications/notificationService.js'

const LOCAL_DATABASE_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])
const HOST_EMAIL = 'social-host@local.test'
const PLAYER_EMAIL = 'social-player-one@local.test'
const DISPATCH_URL = 'http://127.0.0.1:54321/functions/v1/notification-dispatch'
const DISPATCH_SECRET = 'local-notification-dispatch-proof'

function requireLocalDatabaseUrl(): string {
  const connectionString = process.env.DATABASE_CONNECTION_STRING
  if (!connectionString) throw new Error('DATABASE_CONNECTION_STRING is required.')
  const host = new URL(connectionString).hostname.toLowerCase()
  if (!LOCAL_DATABASE_HOSTS.has(host)) {
    throw new Error(`Refusing to run the Campaign announcement proof against ${host}.`)
  }
  return connectionString
}

async function fixtureUsers(db: DBLike): Promise<{ hostId: string; playerId: string }> {
  const result = await sql<{ email: string; id: string }>`
    select email, id::text as id from auth.users where email in (${HOST_EMAIL}, ${PLAYER_EMAIL})
  `.execute(db)
  const byEmail = new Map(result.rows.map((row) => [row.email.toLowerCase(), row.id]))
  const hostId = byEmail.get(HOST_EMAIL)
  const playerId = byEmail.get(PLAYER_EMAIL)
  if (!hostId || !playerId) throw new Error('Seed both local announcement fixture users first.')
  return { hostId, playerId }
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
  let campaignId: string | undefined
  let announcementId: string | undefined
  try {
    const { hostId, playerId } = await fixtureUsers(db)
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
    assert.deepEqual(recipients.rows.map((row) => row.user_id), [playerId])

    await dispatch()
    const feed = await getNotificationFeed(db, playerId)
    assert.equal(feed.items.length, 1)
    assert.equal(feed.unseenCount, 1)
    assert.equal(feed.items[0]?.data.kind, 'CAMPAIGN_ANNOUNCEMENT')
    if (feed.items[0]?.data.kind !== 'CAMPAIGN_ANNOUNCEMENT') throw new Error('Missing announcement feed item.')
    assert.equal(feed.items[0].data.announcementPublicId, announcementId)

    const authorized = await getCampaignAnnouncement(db, playerId, campaign.id, announcementId)
    assert.equal(authorized.title, announcement.title)
    assert.equal(authorized.body, announcement.body)

    const hostFeed = await getNotificationFeed(db, hostId)
    assert.equal(hostFeed.items.length, 0)
    console.info('Campaign announcement local proof passed: GM source, Player-only intent, Supabase feed, authorized destination.')
  } finally {
    if (announcementId) {
      await sql`delete from notification_delivery_intents where source_public_id = ${announcementId}::uuid`.execute(db)
    }
    if (campaignId) await sql`delete from campaigns where id = ${campaignId}::uuid`.execute(db)
    await sql`delete from auth.users where email in (${HOST_EMAIL}, ${PLAYER_EMAIL})`.execute(db)
    await db.destroy()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
