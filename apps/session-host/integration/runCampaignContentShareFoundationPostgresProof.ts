import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

import { createClient } from '@supabase/supabase-js'
import {
  createAuthoredRouteIdRepository,
  createCampaignContentShareRepository,
  createCampaignRepository,
  createDb,
  type DBLike
} from '@artificer-toolkit/db'
import { createCampaign, deleteCampaign, getCampaign } from '@artificer-toolkit/functions/services'
import { sql } from 'kysely'

import { requireLocalDatabaseUrl } from '../../../packages/functions/src/scripts/characterLifecycleIntegrationFixtures.js'
import { proveCampaignContentShareFoundationPostgresSemantics } from './campaignContentShareFoundationPostgresProof.js'

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
  auth_users: number
  campaign_routes: number
  campaign_vehicles: number
  campaigns: number
  content_sources: number
  memberships: number
  profiles: number
  root_routes: number
  shares: number
  spell_catalog_classes: number
  spell_catalog_markers: number
  spell_versions: number
  spells: number
  vehicle_versions: number
  vehicles: number
}

function loadLocalEnvironment(): void {
  const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
  const environmentPath = `${repoRoot}/.env.local`
  if (!existsSync(environmentPath)) {
    throw new Error('Root .env.local is required for the local Campaign-share proof.')
  }
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
  const url = new URL(value)
  if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost' && url.hostname !== '::1') {
    throw new Error(`${label} must be loopback-only for this proof.`)
  }
  return value
}

function localSupabaseConfig() {
  const url = process.env.SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !secretKey || !publishableKey) {
    throw new Error(
      'SUPABASE_URL, SUPABASE_SECRET_KEY, and VITE_SUPABASE_PUBLISHABLE_KEY are required.'
    )
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
  const email = `campaign-share-${label}-${runId}@example.test`
  const username = `cs${label}${runId.replaceAll('-', '').slice(0, 12)}`
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
  author: DisposableUser
): Promise<void> {
  const anonymous = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  })
  const anonymousResult = await anonymous.from('campaign_content_shares').select('campaign_id')
  assert.ok(anonymousResult.error, 'Anonymous Data API access unexpectedly succeeded.')

  const authenticated = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  })
  const signIn = await authenticated.auth.signInWithPassword({
    email: author.email,
    password: author.password
  })
  if (signIn.error) throw signIn.error
  const authenticatedResult = await authenticated
    .from('campaign_content_shares')
    .select('campaign_id')
  assert.ok(authenticatedResult.error, 'Authenticated Data API access unexpectedly succeeded.')
}

async function expectSqlRoleDenied(
  db: ReturnType<typeof createDb>,
  role: 'anon' | 'authenticated'
) {
  await assert.rejects(
    db.transaction().execute(async (trx) => {
      await sql.raw(`set local role ${role}`).execute(trx)
      await sql`select campaign_id from public.campaign_content_shares limit 1`.execute(trx)
    })
  )
}

async function readResidualCounts(
  db: DBLike,
  userIds: readonly string[],
  campaignIds: readonly string[],
  roots: readonly RootIdentity[]
): Promise<ResidualCounts> {
  const spellIds = roots
    .filter((root) => root.subjectKind === 'SPELL')
    .map((root) => root.subjectId)
  const vehicleIds = roots
    .filter((root) => root.subjectKind === 'VEHICLE')
    .map((root) => root.subjectId)
  const rootIds = roots.map((root) => root.subjectId)
  const result = await sql<ResidualCounts>`
    select
      (select count(*)::int from auth.users where id = any(${sql.val(userIds)}::uuid[])) as auth_users,
      (select count(*)::int from public.profiles where id = any(${sql.val(userIds)}::uuid[])) as profiles,
      (
        select count(*)::int
        from public.content_sources
        where owner_user_id = any(${sql.val(userIds)}::uuid[])
      ) as content_sources,
      (select count(*)::int from public.campaigns where id = any(${sql.val(campaignIds)}::uuid[])) as campaigns,
      (select count(*)::int from public.campaign_memberships where campaign_id = any(${sql.val(campaignIds)}::uuid[])) as memberships,
      (select count(*)::int from public.campaign_content_shares where campaign_id = any(${sql.val(campaignIds)}::uuid[])) as shares,
      (select count(*)::int from public.campaign_vehicles where campaign_id = any(${sql.val(campaignIds)}::uuid[])) as campaign_vehicles,
      (select count(*)::int from public.spells where id = any(${sql.val(spellIds)}::uuid[])) as spells,
      (select count(*)::int from public.spell_versions where spell_id = any(${sql.val(spellIds)}::uuid[])) as spell_versions,
      (select count(*)::int from public.spell_catalog_classes where spell_id = any(${sql.val(spellIds)}::uuid[])) as spell_catalog_classes,
      (select count(*)::int from public.spell_catalog_index_versions where spell_id = any(${sql.val(spellIds)}::uuid[])) as spell_catalog_markers,
      (select count(*)::int from public.vehicles where id = any(${sql.val(vehicleIds)}::uuid[])) as vehicles,
      (select count(*)::int from public.vehicle_versions where vehicle_id = any(${sql.val(vehicleIds)}::uuid[])) as vehicle_versions,
      (select count(*)::int from public.authored_route_ids where subject_kind = 'CAMPAIGN' and subject_id = any(${sql.val(campaignIds)}::uuid[])) as campaign_routes,
      (select count(*)::int from public.authored_route_ids where subject_id = any(${sql.val(rootIds)}::uuid[])) as root_routes
  `.execute(db)
  const counts = result.rows[0]
  if (!counts) throw new Error('Disposable residual-count query returned no row.')
  return counts
}

async function deleteExactRouteIdentities(
  db: DBLike,
  campaignIds: readonly string[],
  roots: readonly RootIdentity[]
): Promise<void> {
  const routes = createAuthoredRouteIdRepository(db)
  for (const campaignId of campaignIds) {
    await routes.delete({ subjectId: campaignId, subjectKind: 'CAMPAIGN' })
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
  const users: DisposableUser[] = []
  const roots: RootIdentity[] = []
  const campaignIds: string[] = []
  let primaryCampaignId: string | undefined
  let secondaryCampaignId: string | undefined
  let runError: unknown
  const cleanupErrors: unknown[] = []
  const retryUsers: string[] = []
  const captureCleanup = async (operation: () => Promise<unknown>) => {
    try {
      await operation()
    } catch (error) {
      cleanupErrors.push(error)
    }
  }

  try {
    const gm = await createDisposableUser(admin.auth.admin, runId, 'gm')
    const author = await createDisposableUser(admin.auth.admin, runId, 'author')
    const otherAuthor = await createDisposableUser(admin.auth.admin, runId, 'other')
    const reader = await createDisposableUser(admin.auth.admin, runId, 'reader')
    const outsider = await createDisposableUser(admin.auth.admin, runId, 'outsider')
    users.push(gm, author, otherAuthor, reader, outsider)

    const system = await sql<{
      id: string
    }>`select id from public.systems order by id limit 1`.execute(db)
    const systemId = system.rows[0]?.id
    assert.ok(systemId, 'The canonical System is unavailable.')

    const primary = await createCampaign(db, gm.id, {
      name: `Campaign share primary ${runId}`,
      format: 'ONE_SHOT',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: systemId,
      primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301'
    })
    const secondary = await createCampaign(db, outsider.id, {
      name: `Campaign share secondary ${runId}`,
      format: 'ONE_SHOT',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: systemId,
      primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301'
    })
    primaryCampaignId = primary.id
    secondaryCampaignId = secondary.id
    campaignIds.push(primary.id, secondary.id)
    const memberships = createCampaignRepository(db)
    const now = new Date().toISOString()
    await memberships.activatePlayerMembership(primary.id, author.id, now)
    await memberships.activatePlayerMembership(primary.id, otherAuthor.id, now)
    await memberships.activatePlayerMembership(primary.id, reader.id, now)

    await proveCampaignContentShareFoundationPostgresSemantics({
      authorUserId: author.id,
      connectionString,
      gmUserId: gm.id,
      onRootCreated: (subjectKind, subjectId) => roots.push({ subjectKind, subjectId }),
      otherAuthorUserId: otherAuthor.id,
      primaryCampaignId: primary.id,
      readerUserId: reader.id,
      secondaryCampaignId: secondary.id,
      secondaryCampaignOwnerUserId: outsider.id,
      secondaryCampaignVersion: secondary.version,
      systemId
    })

    await expectDataApiDenied(url, publishableKey, author)
    await expectSqlRoleDenied(db, 'anon')
    await expectSqlRoleDenied(db, 'authenticated')
    const serverRows = await createCampaignContentShareRepository(db).listShares(primary.id)
    assert.ok(serverRows.length > 0, 'Server repository access did not return the fixture shares.')
    console.log(JSON.stringify({ result: 'rls-and-server-boundary', status: 'PASS' }))

    const currentPrimary = await getCampaign(db, gm.id, primary.id)
    await deleteCampaign(db, gm.id, primary.id, currentPrimary.version)
    primaryCampaignId = undefined
    console.log(JSON.stringify({ result: 'campaign-delete-with-shares', status: 'PASS' }))
  } catch (error) {
    runError = error
  } finally {
    if (primaryCampaignId) {
      const campaignId = primaryCampaignId
      await captureCleanup(async () => {
        const deleted = await sql<{
          id: string
        }>`delete from public.campaigns where id = ${campaignId}::uuid returning id`.execute(db)
        assert.equal(deleted.rows.length, 1)
      })
    }
    if (secondaryCampaignId) {
      const campaignId = secondaryCampaignId
      await captureCleanup(async () => {
        const deleted = await sql<{
          id: string
        }>`delete from public.campaigns where id = ${campaignId}::uuid returning id`.execute(db)
        assert.equal(deleted.rows.length, 1)
      })
    }
    await captureCleanup(() => deleteExactRouteIdentities(db, campaignIds, roots))
    await captureCleanup(() =>
      deleteDisposableAuthoredRoots(
        db,
        users.map((user) => user.id),
        roots
      )
    )
    for (const user of users) {
      await captureCleanup(async () => {
        if (await deleteAuthUserWithRetry(admin.auth.admin, db, user.id)) retryUsers.push(user.id)
      })
    }
    await captureCleanup(async () => {
      const counts = await readResidualCounts(
        db,
        users.map((user) => user.id),
        campaignIds,
        roots
      )
      assert.deepEqual(counts, {
        auth_users: 0,
        campaign_routes: 0,
        campaign_vehicles: 0,
        campaigns: 0,
        content_sources: 0,
        memberships: 0,
        profiles: 0,
        root_routes: 0,
        shares: 0,
        spell_catalog_classes: 0,
        spell_catalog_markers: 0,
        spell_versions: 0,
        spells: 0,
        vehicle_versions: 0,
        vehicles: 0
      })
      console.log(
        JSON.stringify({
          cleanup: 'PASS',
          counts,
          retryCount: retryUsers.length,
          runId
        })
      )
    })
    await captureCleanup(() => db.destroy())
  }

  if (runError && cleanupErrors.length > 0) {
    throw new AggregateError([runError, ...cleanupErrors], 'Proof and cleanup both failed.')
  }
  if (runError) throw runError
  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, 'Campaign-share proof cleanup failed.')
  }
  console.log(JSON.stringify({ gate4Result: '1/10', proofComplete: true }))
}

main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      classification: error instanceof Error ? error.name : 'NonErrorFailure',
      error:
        error instanceof Error
          ? error.message.replaceAll(/\s+/g, ' ').slice(0, 1000)
          : String(error)
    })
  )
  process.exitCode = 1
})
