import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

import { createClient } from '@supabase/supabase-js'
import {
  createAuthoredRouteIdRepository,
  createCampaignRepository,
  createDb,
  createMediaRepository,
  type DBLike
} from '@artificer-toolkit/db'
import { createCampaign } from '@artificer-toolkit/functions/services'
import { sql } from 'kysely'

import { requireLocalDatabaseUrl } from '../../../packages/functions/src/scripts/characterLifecycleIntegrationFixtures.js'
import {
  proveGate4CloseoutPostgresSemantics,
  proveSeededMasterCampaignVehicleSemantics
} from './campaignGate4CloseoutPostgresProof.js'

interface DisposableUser {
  email: string
  id: string
  password: string
}

interface RootIdentity {
  subjectId: string
  subjectKind: 'SPELL' | 'VEHICLE'
}

interface ResidualCounts {
  authUsers: number
  campaignEvents: number
  campaignNotes: number
  campaignRoutes: number
  campaignVehicles: number
  campaigns: number
  contentSources: number
  inventoryBalances: number
  inventoryItems: number
  inventoryOwners: number
  mediaDeletions: number
  memberships: number
  notificationFeed: number
  notificationIntents: number
  notificationPreferences: number
  profiles: number
  rootRoutes: number
  shares: number
  socialListings: number
  socialProfiles: number
  spellCatalog: number
  spellVersions: number
  spells: number
  vehicleVersions: number
  vehicles: number
}

function loadLocalEnvironment(): void {
  const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
  const environmentPath = `${repoRoot}/.env.local`
  if (!existsSync(environmentPath)) throw new Error('Root .env.local is required.')
  for (const [key, value] of Object.entries(parseEnv(readFileSync(environmentPath, 'utf8')))) {
    if (
      key.startsWith('NETLIFY_') ||
      key.startsWith('PROD_') ||
      key.startsWith('STAGING_') ||
      key === 'MANAGED_LIVE_SESSION_ENDPOINT' ||
      key === 'MANAGED_VTT_BASE_URL' ||
      key === 'SUPABASE_ACCESS_TOKEN'
    ) {
      continue
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

function requireLoopbackUrl(value: string, label: string): string {
  const host = new URL(value).hostname.toLowerCase()
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error(`${label} must be loopback-only for this proof.`)
  }
  return value
}

function localSupabaseConfig() {
  const url = process.env.SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !secretKey || !publishableKey) {
    throw new Error('Local Supabase URL and keys are required.')
  }
  return {
    publishableKey,
    secretKey,
    url: requireLoopbackUrl(url, 'SUPABASE_URL')
  }
}

async function createDisposableUser(
  admin: ReturnType<typeof createClient>['auth']['admin'],
  runId: string,
  label: string
): Promise<DisposableUser> {
  const password = `Local-${randomUUID()}-Aa1!`
  const email = `gate4-closeout-${label}-${runId}@example.test`
  const username = `g4${label}${runId.replaceAll('-', '').slice(0, 12)}`
  const { data, error } = await admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: { username }
  })
  if (error) throw error
  if (!data.user) throw new Error(`Supabase did not create the ${label} proof user.`)
  return { email, id: data.user.id, password }
}

function isRetryableAdmin500(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 500
}

async function authUserExists(db: DBLike, userId: string): Promise<boolean> {
  const result = await sql<{ exists: boolean }>`
    select exists(select 1 from auth.users where id = ${userId}::uuid) as exists
  `.execute(db)
  return result.rows[0]?.exists ?? false
}

async function deleteAuthUserWithRetry(
  admin: ReturnType<typeof createClient>['auth']['admin'],
  db: DBLike,
  userId: string
): Promise<boolean> {
  if (!(await authUserExists(db, userId))) return false
  const first = await admin.deleteUser(userId)
  if (!first.error) return false
  if (!isRetryableAdmin500(first.error)) throw first.error
  const second = await admin.deleteUser(userId)
  if (second.error) throw second.error
  return true
}

async function expectDataApiDenied(
  url: string,
  publishableKey: string,
  user: DisposableUser
): Promise<void> {
  const anonymous = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  })
  const authenticated = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  })
  const signIn = await authenticated.auth.signInWithPassword({
    email: user.email,
    password: user.password
  })
  if (signIn.error) throw signIn.error
  for (const table of [
    'social_listings',
    'notification_delivery_intents',
    'notification_feed_items',
    'media_object_deletions'
  ] as const) {
    const anonymousResult = await anonymous.from(table).select('*').limit(1)
    assert.ok(
      anonymousResult.error,
      `Anonymous Data API access to ${table} unexpectedly succeeded.`
    )
    const authenticatedResult = await authenticated.from(table).select('*').limit(1)
    assert.ok(
      authenticatedResult.error,
      `Authenticated Data API access to ${table} unexpectedly succeeded.`
    )
  }
}

async function expectSqlRoleDenied(
  db: ReturnType<typeof createDb>,
  role: 'anon' | 'authenticated'
) {
  for (const statement of [
    'select id from public.social_listings limit 1',
    'select id from public.notification_delivery_intents limit 1',
    'select id from public.notification_feed_items limit 1',
    'select object_key from public.media_object_deletions limit 1'
  ]) {
    await assert.rejects(
      db.transaction().execute(async (trx) => {
        await sql.raw(`set local role ${role}`).execute(trx)
        await sql.raw(statement).execute(trx)
      })
    )
  }
}

async function readResidualCounts(
  db: DBLike,
  userIds: readonly string[],
  campaignIds: readonly string[],
  roots: readonly RootIdentity[],
  notificationSourceIds: readonly string[],
  mediaKeys: readonly string[],
  sourceName: string
): Promise<ResidualCounts> {
  const spellIds = roots
    .filter((root) => root.subjectKind === 'SPELL')
    .map((root) => root.subjectId)
  const vehicleIds = roots
    .filter((root) => root.subjectKind === 'VEHICLE')
    .map((root) => root.subjectId)
  const result = await sql<ResidualCounts>`
    select
      (select count(*)::int from auth.users where id = any(${sql.val(userIds)}::uuid[])) as "authUsers",
      (select count(*)::int from public.profiles where id = any(${sql.val(userIds)}::uuid[])) as profiles,
      (select count(*)::int from public.campaigns where id = any(${sql.val(campaignIds)}::uuid[]) or name = ${sourceName}) as campaigns,
      (select count(*)::int from public.content_sources where owner_user_id = any(${sql.val(userIds)}::uuid[])) as "contentSources",
      (select count(*)::int from public.campaign_memberships where campaign_id = any(${sql.val(campaignIds)}::uuid[])) as memberships,
      (select count(*)::int from public.campaign_content_shares where campaign_id = any(${sql.val(campaignIds)}::uuid[])) as shares,
      (select count(*)::int from public.campaign_vehicles where campaign_id = any(${sql.val(campaignIds)}::uuid[])) as "campaignVehicles",
      (select count(*)::int from public.campaign_note_sections where campaign_id = any(${sql.val(campaignIds)}::uuid[])) as "campaignNotes",
      (select count(*)::int from public.campaign_events where campaign_id = any(${sql.val(campaignIds)}::uuid[])) as "campaignEvents",
      (select count(*)::int from public.social_profiles where user_id = any(${sql.val(userIds)}::uuid[])) as "socialProfiles",
      (select count(*)::int from public.social_listings where campaign_id = any(${sql.val(campaignIds)}::uuid[])) as "socialListings",
      (select count(*)::int from public.notification_delivery_intents where source_public_id = any(${sql.val(notificationSourceIds)}::uuid[])) as "notificationIntents",
      (select count(*)::int from public.notification_feed_items where source_public_id = any(${sql.val(notificationSourceIds)}::uuid[])) as "notificationFeed",
      (select count(*)::int from public.notification_preferences where user_id = any(${sql.val(userIds)}::uuid[])) as "notificationPreferences",
      (select count(*)::int from public.inventory_owners where campaign_id = any(${sql.val(campaignIds)}::uuid[])) as "inventoryOwners",
      (select count(*)::int from public.inventory_items item join public.inventory_owners owner on owner.id = item.owner_id where owner.campaign_id = any(${sql.val(campaignIds)}::uuid[])) as "inventoryItems",
      (select count(*)::int from public.inventory_currency_balances balance join public.inventory_owners owner on owner.id = balance.owner_id where owner.campaign_id = any(${sql.val(campaignIds)}::uuid[])) as "inventoryBalances",
      (select count(*)::int from public.media_object_deletions where object_key = any(${sql.val(mediaKeys)}::text[])) as "mediaDeletions",
      (select count(*)::int from public.spells where id = any(${sql.val(spellIds)}::uuid[])) as spells,
      (select count(*)::int from public.spell_versions where spell_id = any(${sql.val(spellIds)}::uuid[])) as "spellVersions",
      (select count(*)::int from public.spell_catalog_index_versions where spell_id = any(${sql.val(spellIds)}::uuid[])) as "spellCatalog",
      (select count(*)::int from public.vehicles where id = any(${sql.val(vehicleIds)}::uuid[])) as vehicles,
      (select count(*)::int from public.vehicle_versions where vehicle_id = any(${sql.val(vehicleIds)}::uuid[])) as "vehicleVersions",
      (select count(*)::int from public.authored_route_ids where subject_kind = 'CAMPAIGN' and subject_id = any(${sql.val(campaignIds)}::uuid[])) as "campaignRoutes",
      (select count(*)::int from public.authored_route_ids where subject_id = any(${sql.val(roots.map((root) => root.subjectId))}::uuid[])) as "rootRoutes"
  `.execute(db)
  const counts = result.rows[0]
  if (!counts) throw new Error('The residual count query returned no row.')
  return counts
}

async function deleteExactRoutes(
  db: DBLike,
  campaignIds: readonly string[],
  roots: readonly RootIdentity[]
): Promise<void> {
  const routes = createAuthoredRouteIdRepository(db)
  for (const campaignId of campaignIds) {
    await routes.delete({ subjectKind: 'CAMPAIGN', subjectId: campaignId })
  }
  for (const root of roots) {
    await routes.delete(root)
  }
}

async function deleteDisposableAuthoredRoots(
  db: DBLike,
  userIds: readonly string[],
  roots: readonly RootIdentity[]
): Promise<void> {
  const spellIds = roots
    .filter((root) => root.subjectKind === 'SPELL')
    .map((root) => root.subjectId)
  const vehicleIds = roots
    .filter((root) => root.subjectKind === 'VEHICLE')
    .map((root) => root.subjectId)
  if (spellIds.length > 0) {
    await sql`
      delete from public.spells
      where user_id = any(${sql.val(userIds)}::uuid[])
        and id = any(${sql.val(spellIds)}::uuid[])
    `.execute(db)
  }
  if (vehicleIds.length > 0) {
    await sql`
      delete from public.vehicles
      where user_id = any(${sql.val(userIds)}::uuid[])
        and id = any(${sql.val(vehicleIds)}::uuid[])
    `.execute(db)
  }
  await sql`
    delete from public.content_sources
    where owner_user_id = any(${sql.val(userIds)}::uuid[])
  `.execute(db)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const seededMasterVehicleOnly = args.length === 1 && args[0] === '--seeded-master-vehicle'
  if (args.length > 0 && !seededMasterVehicleOnly) {
    throw new Error('Use --seeded-master-vehicle or omit the selector.')
  }
  loadLocalEnvironment()
  const connectionString = requireLoopbackUrl(
    requireLocalDatabaseUrl(),
    'DATABASE_CONNECTION_STRING'
  )
  const { publishableKey, secretKey, url } = localSupabaseConfig()
  const db = createDb({ connectionString })
  const admin = createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  })
  const runId = randomUUID()
  const sourceName = `Gate 4 closeout ${runId}`
  const users: DisposableUser[] = []
  const campaignIds = new Set<string>()
  const roots: RootIdentity[] = []
  const notificationSourceIds = new Set<string>()
  const mediaKeys = new Set<string>()
  let runError: unknown
  const cleanupErrors: unknown[] = []
  let retryCount = 0
  const captureCleanup = async (operation: () => Promise<unknown>) => {
    try {
      await operation()
    } catch (error) {
      cleanupErrors.push(error)
    }
  }

  try {
    const owner = await createDisposableUser(admin.auth.admin, runId, 'owner')
    users.push(owner)
    const systemResult = await sql<{ id: string }>`
      select id from public.systems order by created_at, id limit 1
    `.execute(db)
    const systemId = systemResult.rows[0]?.id
    assert.ok(systemId, 'The canonical System is unavailable.')
    const source = await createCampaign(db, owner.id, {
      name: sourceName,
      format: 'ONE_SHOT',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: systemId,
      primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301'
    })
    campaignIds.add(source.id)
    if (seededMasterVehicleOnly) {
      await proveSeededMasterCampaignVehicleSemantics({
        connectionString,
        ownerUserId: owner.id,
        runId,
        sourceCampaignId: source.id,
        sourceCampaignVersion: source.version,
        systemId,
        onCampaignCreated: (campaignId) => campaignIds.add(campaignId)
      })
    } else {
      const recipient = await createDisposableUser(admin.auth.admin, runId, 'recipient')
      users.push(recipient)
      await createCampaignRepository(db).activatePlayerMembership(
        source.id,
        recipient.id,
        new Date().toISOString()
      )
      await proveGate4CloseoutPostgresSemantics({
        connectionString,
        ownerUserId: owner.id,
        recipientUserId: recipient.id,
        runId,
        sourceCampaignId: source.id,
        sourceCampaignPublicId: source.publicId,
        sourceCampaignVersion: source.version,
        sourceName,
        systemId,
        onCampaignCreated: (campaignId) => campaignIds.add(campaignId),
        onMediaKeyCreated: (objectKey) => mediaKeys.add(objectKey),
        onNotificationSourceCreated: (sourceId) => notificationSourceIds.add(sourceId),
        onRootCreated: (subjectKind, subjectId) => roots.push({ subjectKind, subjectId })
      })
      await expectDataApiDenied(url, publishableKey, owner)
      await expectSqlRoleDenied(db, 'anon')
      await expectSqlRoleDenied(db, 'authenticated')
      console.log(JSON.stringify({ boundary: 'retained-domain-rls', status: 'PASS' }))
    }
  } catch (error) {
    runError = error
  } finally {
    await captureCleanup(async () => {
      if (campaignIds.size === 0) return
      const deleted = await sql<{ id: string }>`
        delete from public.campaigns
        where id = any(${sql.val([...campaignIds])}::uuid[])
        returning id
      `.execute(db)
      assert.equal(deleted.rows.length, campaignIds.size)
    })
    await captureCleanup(() => deleteExactRoutes(db, [...campaignIds], roots))
    await captureCleanup(() =>
      deleteDisposableAuthoredRoots(
        db,
        users.map((user) => user.id),
        roots
      )
    )
    await captureCleanup(async () => {
      if (mediaKeys.size > 0) {
        await createMediaRepository(db).completeObjectDeletions([...mediaKeys])
      }
    })
    for (const user of users) {
      await captureCleanup(async () => {
        if (await deleteAuthUserWithRetry(admin.auth.admin, db, user.id)) retryCount += 1
      })
    }
    await captureCleanup(async () => {
      const counts = await readResidualCounts(
        db,
        users.map((user) => user.id),
        [...campaignIds],
        roots,
        [...notificationSourceIds],
        [...mediaKeys],
        sourceName
      )
      assert.deepEqual(counts, {
        authUsers: 0,
        campaignEvents: 0,
        campaignNotes: 0,
        campaignRoutes: 0,
        campaignVehicles: 0,
        campaigns: 0,
        contentSources: 0,
        inventoryBalances: 0,
        inventoryItems: 0,
        inventoryOwners: 0,
        mediaDeletions: 0,
        memberships: 0,
        notificationFeed: 0,
        notificationIntents: 0,
        notificationPreferences: 0,
        profiles: 0,
        rootRoutes: 0,
        shares: 0,
        socialListings: 0,
        socialProfiles: 0,
        spellCatalog: 0,
        spellVersions: 0,
        spells: 0,
        vehicleVersions: 0,
        vehicles: 0
      })
      console.log(JSON.stringify({ cleanup: 'PASS', counts, retryCount, runId }))
    })
    await captureCleanup(() => db.destroy())
  }

  if (runError && cleanupErrors.length > 0) {
    throw new AggregateError([runError, ...cleanupErrors], 'Proof and cleanup both failed.')
  }
  if (runError) throw runError
  if (cleanupErrors.length > 0) throw new AggregateError(cleanupErrors, 'Cleanup failed.')
  console.log(JSON.stringify({ gate4: '10/10', proofComplete: true }))
}

main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      classification: error instanceof Error ? error.name : 'NonErrorFailure',
      error: (error instanceof Error ? error.message : String(error))
        .replaceAll(/\s+/g, ' ')
        .slice(0, 1200)
    })
  )
  process.exitCode = 1
})
