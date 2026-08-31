import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

import { createClient } from '@supabase/supabase-js'
import { createDb } from '@artificer-toolkit/db'
import { createCampaign } from '@artificer-toolkit/functions/services'
import { findFixtureCatalog } from '../../../packages/functions/src/scripts/characterLifecycleIntegrationFixtures.js'
import { proveFixtureLifecycle } from '../../../packages/functions/src/scripts/characterLifecycleIntegrationBuilderProof.js'
import { sql } from 'kysely'

import { requireLocalDatabaseUrl } from '../../../packages/functions/src/scripts/characterLifecycleIntegrationFixtures.js'
import { proveCampaignCatalogueContentSourcePostgresSemantics } from './campaignCatalogueContentSourcePostgresProof.js'

function loadLocalEnvironment(): void {
  const root = fileURLToPath(new URL('../../../', import.meta.url))
  const path = `${root}/.env.local`
  if (!existsSync(path)) throw new Error('Root .env.local is required for this local proof.')
  for (const [key, value] of Object.entries(parseEnv(readFileSync(path, 'utf8'))))
    if (process.env[key] === undefined) process.env[key] = value
}

function requireLoopback(value: string): string {
  const host = new URL(value).hostname
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('Proof is loopback-only.')
  return value
}

async function assertCleanupComplete(
  db: ReturnType<typeof createDb>,
  ids: {
    backgroundIds: readonly string[]
    campaignId: string | undefined
    catalogueIds: readonly string[]
    characterId: string | undefined
    otherSystemId: string | undefined
    reusableDefinitionIds: readonly string[]
    userContentSourceIds: readonly string[]
    userIds: readonly string[]
  }
): Promise<void> {
  const result = await sql<Record<string, number>>`
    select
      (select count(*)::int from auth.users where id = any(${sql.val(ids.userIds)}::uuid[])) as auth_users,
      (select count(*)::int from public.profiles where id = any(${sql.val(ids.userIds)}::uuid[])) as profiles,
      (select count(*)::int from public.campaigns where id = ${ids.campaignId ?? null}::uuid) as campaigns,
      (select count(*)::int from public.campaign_memberships where campaign_id = ${ids.campaignId ?? null}::uuid) as campaign_memberships,
      (select count(*)::int from public.campaign_character_assignments where campaign_id = ${ids.campaignId ?? null}::uuid) as campaign_assignments,
      (select count(*)::int from public.campaign_additional_rules_catalogues where campaign_id = ${ids.campaignId ?? null}::uuid) as campaign_additional_catalogues,
      (select count(*)::int from public.characters where id = ${ids.characterId ?? null}::uuid) as characters,
      (select count(*)::int from public.character_events where character_id = ${ids.characterId ?? null}::uuid) as character_events,
      (select count(*)::int from public.authored_route_ids where subject_kind = 'CHARACTER' and subject_id = ${ids.characterId ?? null}::uuid) as character_routes,
      (select count(*)::int from public.authored_route_ids where subject_kind = 'CAMPAIGN' and subject_id = ${ids.campaignId ?? null}::uuid) as campaign_routes,
      (select count(*)::int from public.authored_drafts where subject_kind = 'BACKGROUND' and subject_id = any(${sql.val(ids.backgroundIds)}::uuid[])) as background_drafts,
      (select count(*)::int from public.backgrounds where id = any(${sql.val(ids.backgroundIds)}::uuid[])) as backgrounds,
      (select count(*)::int from public.background_versions where background_id = any(${sql.val(ids.backgroundIds)}::uuid[])) as background_versions,
      (select count(*)::int from public.authored_route_ids where subject_kind = 'BACKGROUND' and subject_id = any(${sql.val(ids.backgroundIds)}::uuid[])) as background_routes,
      (select count(*)::int from public.reusable_definition_drafts where definition_id = any(${sql.val(ids.reusableDefinitionIds)}::uuid[])) as reusable_definition_drafts,
      (select count(*)::int from public.reusable_definitions where id = any(${sql.val(ids.reusableDefinitionIds)}::uuid[])) as reusable_definitions,
      (select count(*)::int from public.rules_catalogue_content_sources where catalogue_id = any(${sql.val(ids.catalogueIds)}::uuid[]) or content_source_id = any(${sql.val(ids.userContentSourceIds)}::uuid[])) as catalogue_source_relations,
      (select count(*)::int from public.content_sources where id = any(${sql.val(ids.userContentSourceIds)}::uuid[])) as user_content_sources,
      (select count(*)::int from public.rules_catalogues where id = any(${sql.val(ids.catalogueIds)}::uuid[])) as rules_catalogues
      ,(select count(*)::int from public.systems where id = ${ids.otherSystemId ?? null}::uuid) as proof_system
  `.execute(db)
  const counts = result.rows[0]
  assert.ok(counts, 'Cleanup verification returned no row.')
  assert.deepEqual(counts, Object.fromEntries(Object.keys(counts).map((key) => [key, 0])))
}

async function main(): Promise<void> {
  loadLocalEnvironment()
  const connectionString = requireLoopback(requireLocalDatabaseUrl())
  const url = requireLoopback(process.env.SUPABASE_URL ?? '')
  const key = process.env.SUPABASE_SECRET_KEY
  if (!key) throw new Error('SUPABASE_SECRET_KEY is required.')
  const db = createDb({ connectionString })
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  const runId = randomUUID()
  const userIds: string[] = []
  const sameSystemCatalogueIds: string[] = []
  const otherCatalogueIds: string[] = []
  const proofOwned = {
    backgroundIds: [] as string[],
    reusableDefinitionIds: [] as string[],
    userContentSourceIds: [] as string[]
  }
  let campaignId: string | undefined
  let characterId: string | undefined
  let otherSystemId: string | undefined
  try {
    const createUser = async (label: string) => {
      const result = await admin.auth.admin.createUser({
        email: `catalogue-proof-${label}-${runId}@example.test`,
        password: `Local-${randomUUID()}-Aa1!`,
        email_confirm: true,
        user_metadata: {
          username: `cp${label}${runId.replaceAll('-', '').slice(0, 10)}`
        }
      })
      if (result.error || !result.data.user)
        throw result.error ?? new Error('Disposable user creation failed.')
      userIds.push(result.data.user.id)
      return result.data.user.id
    }
    const owner = await createUser('owner')
    const player = await createUser('player')
    const catalog = await findFixtureCatalog(db)
    otherSystemId = randomUUID()
    const otherCatalogueId = randomUUID()
    const otherContentSourceId = randomUUID()
    await sql`insert into public.systems (id, user_id, label, ruleset_code, ruleset_version) values (${otherSystemId}::uuid, ${owner}::uuid, ${`Proof System ${runId}`}, ${`proof-${runId}`}, '1')`.execute(
      db
    )
    await sql`insert into public.rules_catalogues (id, game_system_id, code, label) values (${otherCatalogueId}::uuid, ${otherSystemId}::uuid, ${`proof-other-${runId}`}, 'Proof other catalogue')`.execute(
      db
    )
    await sql`insert into public.content_sources (id, game_system_id, kind, owner_user_id, code, label) values (${otherContentSourceId}::uuid, ${otherSystemId}::uuid, 'USER', ${owner}::uuid, ${`proof-other-${runId}`}, 'Proof other source')`.execute(
      db
    )
    otherCatalogueIds.push(otherCatalogueId)
    proofOwned.userContentSourceIds.push(otherContentSourceId)
    const catalogueRows = await sql<{
      id: string
    }>`select id from public.rules_catalogues where game_system_id = ${catalog.systemId}::uuid order by id limit 1`.execute(
      db
    )
    const primaryCatalogueId = catalogueRows.rows[0]?.id
    assert.ok(primaryCatalogueId, 'Seeded primary Rules Catalogue is missing.')
    for (let index = 0; index < 34; index += 1) {
      const id = randomUUID()
      sameSystemCatalogueIds.push(id)
      await sql`insert into public.rules_catalogues (id, game_system_id, code, label) values (${id}::uuid, ${catalog.systemId}::uuid, ${`proof-${index}-${runId}`}, ${`Proof catalogue ${index}`})`.execute(
        db
      )
    }
    const secondaryCatalogueId = sameSystemCatalogueIds[0]!
    const campaign = await createCampaign(db, owner, {
      name: `Catalogue proof ${runId}`,
      format: 'ONE_SHOT',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: catalog.systemId,
      primaryRulesCatalogueId: primaryCatalogueId,
      additionalRulesCatalogueIds: [secondaryCatalogueId]
    })
    campaignId = campaign.id
    const fixture = {
      backgroundId: catalog.backgroundId,
      characterId: randomUUID(),
      classes: [{ classId: catalog.fighterId, classLabel: 'Fighter', classLevel: 1 }],
      expectedMaxHitPoints: 12,
      hitpointLevels: [{ classId: catalog.fighterId, classLevel: 1, level: 1, value: 12 }],
      label: `Catalogue Character ${runId}`,
      raceId: catalog.humanId,
      raceLabel: 'Human',
      systemId: catalog.systemId,
      userId: player
    }
    characterId = fixture.characterId
    await proveFixtureLifecycle(db, fixture, [], [], [])
    await sql`insert into public.campaign_memberships (campaign_id, user_id, role, status, access_started_at) values (${campaign.id}::uuid, ${player}::uuid, 'PLAYER', 'ACTIVE', now())`.execute(
      db
    )
    await proveCampaignCatalogueContentSourcePostgresSemantics({
      additionalCatalogueIds: sameSystemCatalogueIds,
      campaignId: campaign.id,
      characterId: fixture.characterId,
      connectionString,
      gameSystemId: catalog.systemId,
      otherContentSourceId,
      otherCatalogueId,
      otherSystemId,
      ownerUserId: owner,
      playerUserId: player,
      primaryCatalogueId,
      proofOwned,
      secondaryCatalogueId
    })
    console.log(
      JSON.stringify({
        gate1Result: 'catalogue-content-source',
        proofComplete: true
      })
    )
  } finally {
    const failures: unknown[] = []
    const attempt = async (operation: () => Promise<unknown>) => {
      try {
        await operation()
      } catch (error) {
        failures.push(error)
      }
    }
    await attempt(() =>
      sql`delete from public.authored_route_ids where subject_kind = 'BACKGROUND' and subject_id = any(${sql.val(proofOwned.backgroundIds)}::uuid[])`.execute(
        db
      )
    )
    await attempt(() =>
      sql`delete from public.backgrounds where id = any(${sql.val(proofOwned.backgroundIds)}::uuid[])`.execute(
        db
      )
    )
    await attempt(() =>
      sql`delete from public.reusable_definitions where id = any(${sql.val(proofOwned.reusableDefinitionIds)}::uuid[])`.execute(
        db
      )
    )
    await attempt(() =>
      sql`delete from public.authored_route_ids where subject_kind = 'CAMPAIGN' and subject_id = ${campaignId ?? null}::uuid`.execute(
        db
      )
    )
    await attempt(() =>
      sql`delete from public.campaigns where id = ${campaignId ?? null}::uuid`.execute(db)
    )
    await attempt(() =>
      sql`delete from public.authored_route_ids where subject_kind = 'CHARACTER' and subject_id = ${characterId ?? null}::uuid`.execute(
        db
      )
    )
    await attempt(() =>
      sql`delete from public.characters where id = ${characterId ?? null}::uuid`.execute(db)
    )
    await attempt(() =>
      sql`delete from public.content_sources where id = any(${sql.val(proofOwned.userContentSourceIds)}::uuid[])`.execute(
        db
      )
    )
    await attempt(() =>
      sql`delete from public.rules_catalogues where id = any(${sql.val([...sameSystemCatalogueIds, ...otherCatalogueIds])}::uuid[])`.execute(
        db
      )
    )
    await attempt(() =>
      sql`delete from public.systems where id = ${otherSystemId ?? null}::uuid`.execute(db)
    )
    for (const userId of userIds) await attempt(() => admin.auth.admin.deleteUser(userId))
    await attempt(() =>
      assertCleanupComplete(db, {
        backgroundIds: proofOwned.backgroundIds,
        campaignId,
        catalogueIds: [...sameSystemCatalogueIds, ...otherCatalogueIds],
        characterId,
        otherSystemId,
        reusableDefinitionIds: proofOwned.reusableDefinitionIds,
        userContentSourceIds: proofOwned.userContentSourceIds,
        userIds
      })
    )
    await db.destroy()
    if (failures.length) {
      console.error(new AggregateError(failures, 'Proof cleanup failed.'))
      process.exitCode = 1
    }
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
