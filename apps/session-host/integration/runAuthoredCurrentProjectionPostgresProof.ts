import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

import { createClient } from '@supabase/supabase-js'
import {
  createAuthoredRouteIdRepository,
  createCharacterRepository,
  createDb,
  type DBLike
} from '@artificer-toolkit/db'
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
  proveAuthoredCurrentProjectionPostgresSemantics,
  type AuthoredCurrentProjectionCharacter,
  type AuthoredCurrentProjectionProofGroup
} from './authoredCurrentProjectionPostgresProof.js'

interface DisposableUser {
  id: string
}

interface ResidualCounts {
  auth_users: number
  character_events: number
  character_routes: number
  characters: number
  content_sources: number
  mechanics_projections: number
  profiles: number
  spell_catalog_classes: number
  spell_catalog_markers: number
  spell_routes: number
  spell_versions: number
  spells: number
}

function loadLocalEnvironment(): void {
  const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
  const environmentPath = `${repoRoot}/.env.local`
  if (!existsSync(environmentPath)) {
    throw new Error(
      'Root .env.local is required for the local current-projection PostgreSQL proof.'
    )
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

function parseProofGroup(): AuthoredCurrentProjectionProofGroup {
  const arguments_ = process.argv.slice(2)
  assert.equal(
    arguments_.length,
    1,
    'Pass exactly one selector: --group=catalog, --group=mechanics, --group=concurrency, or --group=concurrency-c9.'
  )
  const value = arguments_[0]
  if (value === '--group=catalog') return 'catalog'
  if (value === '--group=mechanics') return 'mechanics'
  if (value === '--group=concurrency') return 'concurrency'
  if (value === '--group=concurrency-c9') return 'concurrency-c9'
  throw new Error(`Unsupported current-projection proof selector "${value ?? ''}".`)
}

async function createDisposableUser(
  admin: ReturnType<typeof createClient>['auth']['admin'],
  runId: string,
  group: AuthoredCurrentProjectionProofGroup
): Promise<DisposableUser> {
  const password = `Local-${randomUUID()}-Aa1!`
  const email = `current-projection-${group}-${runId}@example.test`
  const username = `cp${group.slice(0, 10)}${runId.replaceAll('-', '').slice(0, 12)}`
  const { data, error } = await admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: { username }
  })
  if (error) throw error
  if (!data.user) throw new Error('Supabase did not create the disposable proof user.')
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

function fixtureFor(
  catalog: Awaited<ReturnType<typeof findFixtureCatalog>>,
  characterId: string,
  userId: string,
  runId: string,
  index: number
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
    label: `Current Projection Cleric ${index + 1} ${runId}`,
    preparedCasterClassId: catalog.clericId,
    raceId: catalog.humanId,
    raceLabel: 'Human',
    userId
  }
}

async function provisionCharacters(
  db: ReturnType<typeof createDb>,
  group: AuthoredCurrentProjectionProofGroup,
  catalog: Awaited<ReturnType<typeof findFixtureCatalog>>,
  characterIds: readonly string[],
  userId: string,
  runId: string
): Promise<AuthoredCurrentProjectionCharacter[]> {
  const expectedCount =
    group === 'catalog' ? 0 : group === 'mechanics' ? 1 : group === 'concurrency-c9' ? 2 : 4
  assert.equal(characterIds.length, expectedCount)
  const timings: {
    builder: BuilderResolutionTiming[]
    rules: CharacterRuleEvaluationTiming[]
    sheet: SheetReadTiming[]
  } = { builder: [], rules: [], sheet: [] }
  const targets: AuthoredCurrentProjectionCharacter[] = []
  for (const [index, characterId] of characterIds.entries()) {
    const fixture = fixtureFor(catalog, characterId, userId, runId, index)
    const sheet = await proveFixtureLifecycle(
      db,
      fixture,
      timings.builder,
      timings.sheet,
      timings.rules
    )
    assert.equal(sheet.meta.streamVersion, 1)
    targets.push({ characterId, classId: catalog.clericId, userId })
  }
  return targets
}

async function deleteExactRouteIdentities(
  db: DBLike,
  characterIds: readonly string[],
  spellIds: readonly string[]
): Promise<void> {
  const routes = createAuthoredRouteIdRepository(db)
  for (const characterId of characterIds) {
    await routes.delete({ subjectId: characterId, subjectKind: 'CHARACTER' })
  }
  for (const spellId of spellIds) {
    await routes.delete({ subjectId: spellId, subjectKind: 'SPELL' })
  }
}

async function deleteDisposableAuthoredRoots(
  db: DBLike,
  userId: string,
  spellIds: readonly string[]
): Promise<void> {
  if (spellIds.length > 0) {
    await sql`
      delete from public.spells
      where user_id = ${userId}::uuid
        and id = any(${sql.val(spellIds)}::uuid[])
    `.execute(db)
  }
  await sql`
    delete from public.content_sources
    where owner_user_id = ${userId}::uuid
  `.execute(db)
}

async function readResidualCounts(
  db: DBLike,
  userId: string,
  characterIds: readonly string[],
  spellIds: readonly string[]
): Promise<ResidualCounts> {
  const result = await sql<ResidualCounts>`
    select
      (select count(*)::int from auth.users where id = ${userId}::uuid) as auth_users,
      (select count(*)::int from public.profiles where id = ${userId}::uuid) as profiles,
      (
        select count(*)::int
        from public.content_sources
        where owner_user_id = ${userId}::uuid
      ) as content_sources,
      (select count(*)::int from public.characters where id = any(${sql.val(characterIds)}::uuid[])) as characters,
      (
        select count(*)::int
        from public.authored_route_ids
        where subject_kind = 'CHARACTER'
          and subject_id = any(${sql.val(characterIds)}::uuid[])
      ) as character_routes,
      (
        select count(*)::int
        from public.character_mechanics_projections
        where character_id = any(${sql.val(characterIds)}::uuid[])
      ) as mechanics_projections,
      (
        select count(*)::int
        from public.character_events
        where character_id = any(${sql.val(characterIds)}::uuid[])
      ) as character_events,
      (select count(*)::int from public.spells where id = any(${sql.val(spellIds)}::uuid[])) as spells,
      (
        select count(*)::int
        from public.spell_versions
        where spell_id = any(${sql.val(spellIds)}::uuid[])
      ) as spell_versions,
      (
        select count(*)::int
        from public.spell_catalog_classes
        where spell_id = any(${sql.val(spellIds)}::uuid[])
      ) as spell_catalog_classes,
      (
        select count(*)::int
        from public.spell_catalog_index_versions
        where spell_id = any(${sql.val(spellIds)}::uuid[])
      ) as spell_catalog_markers,
      (
        select count(*)::int
        from public.authored_route_ids
        where subject_kind = 'SPELL'
          and subject_id = any(${sql.val(spellIds)}::uuid[])
      ) as spell_routes
  `.execute(db)
  const counts = result.rows[0]
  if (!counts) throw new Error('Disposable residual-count query returned no row.')
  return counts
}

async function assertDisposableRowsRemoved(
  db: ReturnType<typeof createDb>,
  userId: string,
  characterIds: readonly string[],
  spellIds: readonly string[]
): Promise<ResidualCounts> {
  const counts = await readResidualCounts(db, userId, characterIds, spellIds)
  assert.deepEqual(counts, {
    auth_users: 0,
    character_events: 0,
    character_routes: 0,
    characters: 0,
    content_sources: 0,
    mechanics_projections: 0,
    profiles: 0,
    spell_catalog_classes: 0,
    spell_catalog_markers: 0,
    spell_routes: 0,
    spell_versions: 0,
    spells: 0
  })
  for (const characterId of characterIds) {
    assert.equal(await createCharacterRepository(db).findById(characterId), null)
  }
  return counts
}

async function main(): Promise<void> {
  const group = parseProofGroup()
  loadLocalEnvironment()
  const connectionString = requireLoopbackUrl(
    requireLocalDatabaseUrl(),
    'DATABASE_CONNECTION_STRING'
  )
  const { secretKey, url } = localSupabaseConfig()
  const db = createDb({ connectionString })
  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false }
  })
  const runId = randomUUID()
  const characterCount =
    group === 'catalog' ? 0 : group === 'mechanics' ? 1 : group === 'concurrency-c9' ? 2 : 4
  const characterIds = Array.from({ length: characterCount }, () => randomUUID())
  const spellIds = new Set<string>()
  let user: DisposableUser | null = null
  let runError: unknown
  const cleanupErrors: unknown[] = []
  let retryUsed = false
  const captureCleanup = async (operation: () => Promise<unknown>) => {
    try {
      await operation()
    } catch (error) {
      cleanupErrors.push(error)
    }
  }

  try {
    user = await createDisposableUser(admin.auth.admin, runId, group)
    const catalog = await findFixtureCatalog(db)
    const characters = await provisionCharacters(db, group, catalog, characterIds, user.id, runId)
    await proveAuthoredCurrentProjectionPostgresSemantics({
      characters,
      clericClassId: catalog.clericId,
      connectionString,
      group,
      onSpellCreated: (spellId) => spellIds.add(spellId),
      ownerUserId: user.id,
      systemId: catalog.systemId
    })
  } catch (error) {
    runError = error
  } finally {
    if (user) {
      const userId = user.id
      await captureCleanup(() => deleteExactRouteIdentities(db, characterIds, [...spellIds]))
      await captureCleanup(() => deleteDisposableAuthoredRoots(db, userId, [...spellIds]))
      await captureCleanup(async () => {
        retryUsed = await deleteAuthUserWithRetry(admin.auth.admin, db, userId)
      })
      await captureCleanup(async () => {
        const counts = await assertDisposableRowsRemoved(db, userId, characterIds, [...spellIds])
        console.log(JSON.stringify({ cleanup: 'PASS', counts, group, retryUsed, runId }))
      })
    }
    await captureCleanup(() => db.destroy())
  }

  if (runError && cleanupErrors.length > 0) {
    throw new AggregateError([runError, ...cleanupErrors], 'Proof and cleanup both failed.')
  }
  if (runError) throw runError
  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, 'Current-projection proof cleanup failed.')
  }
  console.log(JSON.stringify({ fixedTotal: 9, group, groupComplete: true }))
}

main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      classification: error instanceof Error ? error.name : 'NonErrorFailure',
      error:
        error instanceof Error ? error.message.replaceAll(/\s+/g, ' ').slice(0, 800) : String(error)
    })
  )
  process.exitCode = 1
})
