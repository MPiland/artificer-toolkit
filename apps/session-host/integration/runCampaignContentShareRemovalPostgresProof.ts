import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

import { createClient } from '@supabase/supabase-js'
import {
  createAuthoredRouteIdRepository,
  createCampaignRepository,
  createCharacterRepository,
  createDb,
  type DBLike
} from '@artificer-toolkit/db'
import { assignCampaignCharacter, createCampaign } from '@artificer-toolkit/functions/services'
import { sql } from 'kysely'

import { proveFixtureLifecycle } from '../../../packages/functions/src/scripts/characterLifecycleIntegrationBuilderProof.js'
import {
  findFixtureCatalog,
  requireLocalDatabaseUrl,
  type BuilderResolutionTiming,
  type CharacterLifecycleFixture,
  type CharacterRuleEvaluationTiming,
  type SheetReadTiming
} from '../../../packages/functions/src/scripts/characterLifecycleIntegrationFixtures.js'
import {
  proveCampaignContentShareRemovalPostgresSemantics,
  type CampaignContentShareRemovalCharacter,
  type CampaignContentShareRemovalProofGroup
} from './campaignContentShareRemovalPostgresProof.js'

interface DisposableUser {
  id: string
}

interface RootIdentity {
  subjectId: string
  subjectKind: 'BACKGROUND' | 'SPELL' | 'VEHICLE'
}

type InventoryTable =
  | 'campaign_vehicles'
  | 'inventory_currency_balances'
  | 'inventory_currency_groups'
  | 'inventory_items'
  | 'inventory_owners'

interface ResidualCounts {
  assignments: number
  auth_users: number
  background_routes: number
  background_versions: number
  backgrounds: number
  campaign_events: number
  campaign_routes: number
  campaign_vehicles: number
  campaigns: number
  character_class_spells: number
  character_events: number
  character_routes: number
  characters: number
  content_sources: number
  drafts: number
  inventory_currency_balances: number
  inventory_currency_groups: number
  inventory_items: number
  inventory_owners: number
  mechanics: number
  memberships: number
  overlays: number
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
    throw new Error('Root .env.local is required for the local B2 PostgreSQL proof.')
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
  if (!url || !secretKey) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required.')
  return { secretKey, url: requireLoopbackUrl(url, 'SUPABASE_URL') }
}

function parseGroup(): CampaignContentShareRemovalProofGroup {
  const arguments_ = process.argv.slice(2)
  assert.equal(
    arguments_.length,
    1,
    'Pass exactly one selector: --group=activation, --group=deletion, --group=unshare, --group=membership, or --group=vehicle.'
  )
  if (arguments_[0] === '--group=activation') return 'activation'
  if (arguments_[0] === '--group=deletion') return 'deletion'
  if (arguments_[0] === '--group=unshare') return 'unshare'
  if (arguments_[0] === '--group=membership') return 'membership'
  if (arguments_[0] === '--group=vehicle') return 'vehicle'
  throw new Error(`Unsupported B2 proof selector "${arguments_[0] ?? ''}".`)
}

async function createDisposableUser(
  admin: ReturnType<typeof createClient>['auth']['admin'],
  runId: string,
  label: string
): Promise<DisposableUser> {
  const password = `Local-${randomUUID()}-Aa1!`
  const email = `campaign-removal-${label}-${runId}@example.test`
  const username = `cr${label.replaceAll('-', '').slice(0, 14)}${runId.replaceAll('-', '').slice(0, 12)}`
  const { data, error } = await admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: { username }
  })
  if (error) throw error
  if (!data.user) throw new Error(`Supabase did not create the ${label} B2 proof user.`)
  return { id: data.user.id }
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

function clericFixture(
  catalog: Awaited<ReturnType<typeof findFixtureCatalog>>,
  characterId: string,
  userId: string,
  runId: string
): CharacterLifecycleFixture {
  return {
    ...catalog,
    characterId,
    classes: [
      {
        classId: catalog.clericId,
        classLabel: 'Cleric',
        classLevel: 1,
        subclassId: catalog.lifeDomainId,
        subclassLabel: 'Life Domain'
      }
    ],
    expectedMaxHitPoints: 10,
    hitpointLevels: [{ level: 1, classId: catalog.clericId, classLevel: 1, value: 10 }],
    label: `Campaign removal Cleric ${runId}`,
    preparedCasterClassId: catalog.clericId,
    raceId: catalog.humanId,
    raceLabel: 'Human',
    userId
  }
}

async function provisionCharacter(
  db: ReturnType<typeof createDb>,
  catalog: Awaited<ReturnType<typeof findFixtureCatalog>>,
  characterId: string,
  userId: string,
  runId: string
): Promise<CampaignContentShareRemovalCharacter> {
  const timings: {
    builder: BuilderResolutionTiming[]
    rules: CharacterRuleEvaluationTiming[]
    sheet: SheetReadTiming[]
  } = { builder: [], rules: [], sheet: [] }
  const sheet = await proveFixtureLifecycle(
    db,
    clericFixture(catalog, characterId, userId, runId),
    timings.builder,
    timings.sheet,
    timings.rules
  )
  assert.equal(sheet.meta.streamVersion, 1)
  return { characterId, classId: catalog.clericId, userId }
}

async function deleteExactRoutes(
  db: DBLike,
  campaignId: string | undefined,
  characterId: string | undefined,
  roots: readonly RootIdentity[]
): Promise<void> {
  const routes = createAuthoredRouteIdRepository(db)
  if (campaignId) await routes.delete({ subjectKind: 'CAMPAIGN', subjectId: campaignId })
  if (characterId) await routes.delete({ subjectKind: 'CHARACTER', subjectId: characterId })
  for (const root of roots) await routes.delete(root)
}

async function deleteDisposableAuthoredRoots(
  db: DBLike,
  userIds: readonly string[],
  roots: readonly RootIdentity[]
): Promise<void> {
  const backgroundIds = roots
    .filter((root) => root.subjectKind === 'BACKGROUND')
    .map((root) => root.subjectId)
  const spellIds = roots
    .filter((root) => root.subjectKind === 'SPELL')
    .map((root) => root.subjectId)
  const vehicleIds = roots
    .filter((root) => root.subjectKind === 'VEHICLE')
    .map((root) => root.subjectId)
  if (backgroundIds.length > 0) {
    await sql`
      delete from public.backgrounds
      where user_id = any(${sql.val(userIds)}::uuid[])
        and id = any(${sql.val(backgroundIds)}::uuid[])
    `.execute(db)
  }
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

function idsFor(table: InventoryTable, rows: ReadonlyMap<InventoryTable, Set<string>>): string[] {
  return [...(rows.get(table) ?? new Set<string>())]
}

async function residualCounts(
  db: DBLike,
  userIds: readonly string[],
  campaignId: string | undefined,
  characterId: string | undefined,
  roots: readonly RootIdentity[],
  inventoryRows: ReadonlyMap<InventoryTable, Set<string>>
): Promise<ResidualCounts> {
  const campaignIds = campaignId ? [campaignId] : []
  const characterIds = characterId ? [characterId] : []
  const backgroundIds = roots
    .filter((root) => root.subjectKind === 'BACKGROUND')
    .map((root) => root.subjectId)
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
      (select count(*)::int from public.campaign_character_assignments where campaign_id = any(${sql.val(campaignIds)}::uuid[])) as assignments,
      (select count(*)::int from public.campaign_content_shares where campaign_id = any(${sql.val(campaignIds)}::uuid[])) as shares,
      (select count(*)::int from public.campaign_events where campaign_id = any(${sql.val(campaignIds)}::uuid[])) as campaign_events,
      (select count(*)::int from public.characters where id = any(${sql.val(characterIds)}::uuid[])) as characters,
      (select count(*)::int from public.character_builder_drafts where character_id = any(${sql.val(characterIds)}::uuid[])) as drafts,
      (select count(*)::int from public.character_events where character_id = any(${sql.val(characterIds)}::uuid[])) as character_events,
      (select count(*)::int from public.character_class_spells where character_id = any(${sql.val(characterIds)}::uuid[])) as character_class_spells,
      (select count(*)::int from public.character_mechanics_projections where character_id = any(${sql.val(characterIds)}::uuid[])) as mechanics,
      (select count(*)::int from public.campaign_character_mechanics_projections where character_id = any(${sql.val(characterIds)}::uuid[])) as overlays,
      (select count(*)::int from public.backgrounds where id = any(${sql.val(backgroundIds)}::uuid[])) as backgrounds,
      (select count(*)::int from public.background_versions where background_id = any(${sql.val(backgroundIds)}::uuid[])) as background_versions,
      (select count(*)::int from public.spells where id = any(${sql.val(spellIds)}::uuid[])) as spells,
      (select count(*)::int from public.spell_versions where spell_id = any(${sql.val(spellIds)}::uuid[])) as spell_versions,
      (select count(*)::int from public.spell_catalog_classes where spell_id = any(${sql.val(spellIds)}::uuid[])) as spell_catalog_classes,
      (select count(*)::int from public.spell_catalog_index_versions where spell_id = any(${sql.val(spellIds)}::uuid[])) as spell_catalog_markers,
      (select count(*)::int from public.vehicles where id = any(${sql.val(vehicleIds)}::uuid[])) as vehicles,
      (select count(*)::int from public.vehicle_versions where vehicle_id = any(${sql.val(vehicleIds)}::uuid[])) as vehicle_versions,
      (select count(*)::int from public.campaign_vehicles where id = any(${sql.val(idsFor('campaign_vehicles', inventoryRows))}::uuid[])) as campaign_vehicles,
      (select count(*)::int from public.inventory_owners where id = any(${sql.val(idsFor('inventory_owners', inventoryRows))}::uuid[])) as inventory_owners,
      (select count(*)::int from public.inventory_items where id = any(${sql.val(idsFor('inventory_items', inventoryRows))}::uuid[])) as inventory_items,
      (select count(*)::int from public.inventory_currency_groups where id = any(${sql.val(idsFor('inventory_currency_groups', inventoryRows))}::uuid[])) as inventory_currency_groups,
      (select count(*)::int from public.inventory_currency_balances where id = any(${sql.val(idsFor('inventory_currency_balances', inventoryRows))}::uuid[])) as inventory_currency_balances,
      (select count(*)::int from public.authored_route_ids where subject_kind = 'CAMPAIGN' and subject_id = any(${sql.val(campaignIds)}::uuid[])) as campaign_routes,
      (select count(*)::int from public.authored_route_ids where subject_kind = 'CHARACTER' and subject_id = any(${sql.val(characterIds)}::uuid[])) as character_routes,
      (select count(*)::int from public.authored_route_ids where subject_kind = 'BACKGROUND' and subject_id = any(${sql.val(backgroundIds)}::uuid[])) as background_routes,
      (select count(*)::int from public.authored_route_ids where subject_id = any(${sql.val(rootIds)}::uuid[])) as root_routes
  `.execute(db)
  const counts = result.rows[0]
  assert.ok(counts)
  return counts
}

async function main(): Promise<void> {
  const group = parseGroup()
  loadLocalEnvironment()
  const connectionString = requireLoopbackUrl(
    requireLocalDatabaseUrl(),
    'DATABASE_CONNECTION_STRING'
  )
  const { secretKey, url } = localSupabaseConfig()
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
  const inventoryRows = new Map<InventoryTable, Set<string>>()
  let campaignId: string | undefined
  let characterId: string | undefined
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
    const gm = await createDisposableUser(admin.auth.admin, runId, `${group}gm`)
    const author = await createDisposableUser(admin.auth.admin, runId, `${group}author`)
    users.push(gm, author)
    const player =
      group === 'vehicle'
        ? null
        : await createDisposableUser(admin.auth.admin, runId, `${group}player`)
    if (player) users.push(player)
    const reader =
      group === 'membership'
        ? await createDisposableUser(admin.auth.admin, runId, 'membershipreader')
        : null
    if (reader) users.push(reader)

    const catalog = await findFixtureCatalog(db)
    let character: CampaignContentShareRemovalCharacter | undefined
    if (player) {
      characterId = randomUUID()
      character = await provisionCharacter(db, catalog, characterId, player.id, runId)
    }
    const campaign = await createCampaign(db, gm.id, {
      name: `Campaign removal ${group} ${runId}`,
      format: 'ONE_SHOT',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: catalog.systemId,
      primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301'
    })
    campaignId = campaign.id
    const memberships = createCampaignRepository(db)
    const now = new Date().toISOString()
    await memberships.activatePlayerMembership(campaign.id, author.id, now)
    if (player) await memberships.activatePlayerMembership(campaign.id, player.id, now)
    if (reader) await memberships.activatePlayerMembership(campaign.id, reader.id, now)
    if (character)
      await assignCampaignCharacter(db, player?.id ?? '', campaign.id, character.characterId)

    await proveCampaignContentShareRemovalPostgresSemantics({
      authorUserId: author.id,
      campaignId: campaign.id,
      character,
      connectionString,
      gmUserId: gm.id,
      group,
      onInventoryRowCreated: (table, id) => {
        const ids = inventoryRows.get(table) ?? new Set<string>()
        ids.add(id)
        inventoryRows.set(table, ids)
      },
      onRootCreated: (subjectKind, subjectId) => roots.push({ subjectKind, subjectId }),
      readerUserId: reader?.id,
      systemId: catalog.systemId
    })
  } catch (error) {
    runError = error
  } finally {
    if (campaignId) {
      const exactCampaignId = campaignId
      await captureCleanup(async () => {
        const deleted = await sql<{ id: string }>`
          delete from public.campaigns where id = ${exactCampaignId}::uuid returning id
        `.execute(db)
        assert.equal(deleted.rows.length, 1)
      })
    }
    await captureCleanup(() => deleteExactRoutes(db, campaignId, characterId, roots))
    await captureCleanup(() =>
      deleteDisposableAuthoredRoots(
        db,
        users.map((user) => user.id),
        roots
      )
    )
    for (const user of users) {
      await captureCleanup(async () => {
        if (await deleteAuthUserWithRetry(admin.auth.admin, db, user.id)) retryCount += 1
      })
    }
    await captureCleanup(async () => {
      const counts = await residualCounts(
        db,
        users.map((user) => user.id),
        campaignId,
        characterId,
        roots,
        inventoryRows
      )
      assert.deepEqual(counts, Object.fromEntries(Object.keys(counts).map((key) => [key, 0])))
      if (characterId) assert.equal(await createCharacterRepository(db).findById(characterId), null)
      console.log(JSON.stringify({ cleanup: 'PASS', counts, group, retryCount, runId }))
    })
    await captureCleanup(() => db.destroy())
  }

  if (runError && cleanupErrors.length > 0) {
    throw new AggregateError([runError, ...cleanupErrors], 'B2 proof and cleanup both failed.')
  }
  if (runError) throw runError
  if (cleanupErrors.length > 0) throw new AggregateError(cleanupErrors, 'B2 proof cleanup failed.')
  console.log(
    JSON.stringify({
      fixedGate4Results: group === 'activation' || group === 'deletion' ? '5-6' : '2-4',
      group,
      groupComplete: true
    })
  )
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
