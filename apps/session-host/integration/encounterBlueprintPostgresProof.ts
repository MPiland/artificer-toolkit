import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { dirname } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import {
  canonicalizeJson,
  checksumCanonicalJson,
  createDb,
  createEncounterRepository,
  type DBLike
} from '@artificer-toolkit/db'
import {
  checksumEncounterCurrentProjection,
  checksumLegacyEncounterCurrentProjectionV1
} from '@artificer-toolkit/db'
import { sql } from 'kysely'

import {
  compileEncounterCurrentProjection,
  projectGm
} from '../../../packages/functions/src/services/encounter/encounterProjection.js'
import { replayEncounterCurrentProjection } from '../../../packages/functions/src/services/encounter/encounterProjectionReplay.js'
import {
  createEncounter,
  updateEncounterBlueprint
} from '../../../packages/functions/src/services/encounter/encounterService.js'
import type { EncounterRecord } from '../../../packages/db/src/repositories/encounter.js'

const migrationVersion = '20260825062000'
const loopbackHosts = new Set(['127.0.0.1', 'localhost', '::1', 'host.docker.internal'])

/**
 * The fixture identities are deliberately fixed. The run ID is only used in
 * the disposable Auth email and state-file name; exact cleanup makes retries
 * safe without touching seeded rows.
 */
const ids = {
  archivedCampaign: 'de000001-0000-4000-8000-000000000001',
  archivedCommand: 'de000001-0000-4000-8000-000000000002',
  archivedRun: 'de000001-0000-4000-8000-000000000003',
  blueprint: 'de000001-0000-4000-8000-000000000004',
  blueprintCommand: 'de000001-0000-4000-8000-000000000005',
  blueprintUpdateCommand: 'de000001-0000-4000-8000-000000000021',
  crossCampaign: 'de000001-0000-4000-8000-000000000006',
  crossCommand: 'de000001-0000-4000-8000-000000000007',
  extremeBlueprint: 'de000001-0000-4000-8000-000000000008',
  extremeBlueprintCommand: 'de000001-0000-4000-8000-000000000019',
  extremeCampaign: 'de000001-0000-4000-8000-000000000009',
  freshRunCommand: 'de000001-0000-4000-8000-000000000022',
  lateCommand: 'de000001-0000-4000-8000-000000000010',
  lateRun: 'de000001-0000-4000-8000-000000000011',
  legacyActor: 'de000001-0000-4000-8000-000000000012',
  legacyBlueprintCommand: 'de000001-0000-4000-8000-000000000020',
  legacyEvent: 'de000001-0000-4000-8000-000000000013',
  legacyRun: 'de000001-0000-4000-8000-000000000014',
  session: 'de000001-0000-4000-8000-000000000015',
  validCampaign: 'de000001-0000-4000-8000-000000000016',
  secondaryRulesCatalogue: 'de000001-0000-4000-8000-000000000017',
  secondarySystem: 'de000001-0000-4000-8000-000000000018',
  serializedRunCommand: 'de000001-0000-4000-8000-000000000023'
} as const

type Mode =
  | 'prepare-extreme'
  | 'verify-failed-cleanup-extreme'
  | 'prepare-valid-legacy'
  | 'verify-post'
  | 'cleanup'

interface EncounterBlueprintProofJournal {
  phase: 'PREPARING' | 'READY'
  ownerEmail: string
  ownerUserId: string | null
  gameSystemId: string
  primaryRulesCatalogueId: string
  otherGameSystemId: string
  otherPrimaryRulesCatalogueId: string
  rulePackRevisionId: string
  runId: string
}

export interface EncounterBlueprintProofState extends EncounterBlueprintProofJournal {
  phase: 'READY'
  ownerUserId: string
}

export interface EncounterBlueprintPostgresProofOptions {
  connectionString: string
  mode: Mode
  runId: string
  statePath: string
  supabaseSecretKey: string
  supabaseUrl: string
}

function requireLoopback(name: string, value: string): void {
  if (!loopbackHosts.has(new URL(value).hostname.toLowerCase())) {
    throw new Error(`${name} must use a loopback host.`)
  }
}

function readState(path: string): EncounterBlueprintProofJournal {
  if (!existsSync(path))
    throw new Error(`Proof state is missing at ${path}. Run prepare-extreme first.`)
  return JSON.parse(readFileSync(path, 'utf8')) as EncounterBlueprintProofJournal
}

function writeState(path: string, state: EncounterBlueprintProofJournal): void {
  const parent = dirname(path)
  mkdirSync(parent, { recursive: true })
  if (!statSync(parent).isDirectory())
    throw new Error(`Proof state parent is not a directory: ${parent}`)
  const temporaryPath = `${path}.tmp-${process.pid}-${randomUUID()}`
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
    renameSync(temporaryPath, path)
  } finally {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath)
  }
}

function ensureStateParent(path: string): void {
  const parent = dirname(path)
  mkdirSync(parent, { recursive: true })
  if (!statSync(parent).isDirectory())
    throw new Error(`Proof state parent is not a directory: ${parent}`)
}

function validateState(
  state: EncounterBlueprintProofJournal,
  expectedRunId: string
): EncounterBlueprintProofJournal {
  assert.equal(
    state.runId,
    expectedRunId,
    'Proof state runId does not match the requested lifecycle run.'
  )
  assert.equal(
    state.otherGameSystemId,
    ids.secondarySystem,
    'Proof state secondary System identity is not canonical.'
  )
  assert.equal(
    state.otherPrimaryRulesCatalogueId,
    ids.secondaryRulesCatalogue,
    'Proof state secondary Catalogue identity is not canonical.'
  )
  assert.ok(state.phase === 'PREPARING' || state.phase === 'READY', 'Proof state phase is invalid.')
  assert.equal(
    state.ownerEmail,
    `gate1-blueprint-${state.runId}@example.test`,
    'Proof state owner email is not deterministic.'
  )
  if (state.phase === 'READY') {
    assert.equal(
      typeof state.ownerUserId,
      'string',
      'Ready proof state must retain its owner UUID.'
    )
  } else {
    assert.equal(state.ownerUserId, null, 'Preparing proof state must not assert an owner UUID.')
  }
  for (const [name, value] of Object.entries({
    gameSystemId: state.gameSystemId,
    primaryRulesCatalogueId: state.primaryRulesCatalogueId,
    otherGameSystemId: state.otherGameSystemId,
    otherPrimaryRulesCatalogueId: state.otherPrimaryRulesCatalogueId,
    rulePackRevisionId: state.rulePackRevisionId,
    runId: state.runId
  })) {
    assert.equal(typeof value, 'string', `Proof state ${name} must be a string.`)
    assert.ok(value.length > 0, `Proof state ${name} must not be empty.`)
  }
  return state
}

function requireReadyState(state: EncounterBlueprintProofJournal): EncounterBlueprintProofState {
  assert.equal(state.phase, 'READY', 'Proof preparation has not completed.')
  assert.equal(typeof state.ownerUserId, 'string', 'Prepared proof state has no owner UUID.')
  return state as EncounterBlueprintProofState
}

async function migrationApplied(db: DBLike): Promise<boolean> {
  const result = await sql<{ applied: boolean }>`
    select exists(
      select 1 from supabase_migrations.schema_migrations
      where version = ${migrationVersion}
    ) as applied
  `.execute(db)
  return result.rows[0]?.applied ?? false
}

async function createOwner(
  db: DBLike,
  admin: ReturnType<typeof createClient>['auth']['admin'],
  runId: string
): Promise<string> {
  const email = `gate1-blueprint-${runId}@example.test`
  const existing = await sql<{ id: string }>`
    select id from auth.users where email = ${email} limit 1
  `.execute(db)
  if (existing.rows[0]) return existing.rows[0].id
  const response = await admin.createUser({
    email,
    email_confirm: true,
    password: `Local-${randomUUID()}-Aa1!`,
    user_metadata: { username: `g1blueprint${runId.replaceAll('-', '').slice(0, 12)}` }
  })
  if (response.error) throw response.error
  if (!response.data.user) throw new Error('Supabase did not create the Blueprint proof owner.')
  return response.data.user.id
}

async function requiredSeedState(db: DBLike): Promise<{
  gameSystemId: string
  primaryRulesCatalogueId: string
  rulePackRevisionId: string
}> {
  const system = await sql<{ game_system_id: string; catalogue_id: string; revision_id: string }>`
    select catalogue.game_system_id, catalogue.id as catalogue_id, revision.id as revision_id
    from public.rules_catalogues catalogue
    join public.systems system on system.id = catalogue.game_system_id
    join public.rule_packs pack on pack.ruleset_code = system.ruleset_code and pack.version = system.ruleset_version
    join public.rule_pack_revisions revision on revision.id = pack.active_revision_id
    order by system.created_at, catalogue.id
    limit 1
  `.execute(db)
  const gameSystemId = system.rows[0]?.game_system_id
  assert.ok(gameSystemId, 'A seeded Game System is required for the Blueprint proof.')
  const primaryRulesCatalogueId = system.rows[0]?.catalogue_id
  assert.ok(
    primaryRulesCatalogueId,
    'A same-System Rules Catalogue is required for the Blueprint proof.'
  )
  assert.ok(
    system.rows[0]?.revision_id,
    'An active compatible rule-pack revision is required for the Blueprint proof.'
  )
  return {
    gameSystemId,
    primaryRulesCatalogueId,
    rulePackRevisionId: system.rows[0]!.revision_id
  }
}

async function createSecondarySystemAndCatalogue(db: DBLike, ownerUserId: string): Promise<void> {
  await sql`
    insert into public.systems (id, user_id, label, description, ruleset_code, ruleset_version)
    values (
      ${ids.secondarySystem}::uuid, ${ownerUserId}::uuid, 'Gate 1 Blueprint mismatch System',
      'Disposable local PostgreSQL proof fixture.', 'gate1-blueprint-proof', '1.0.0'
    ) on conflict (id) do update set
      user_id = excluded.user_id,
      label = excluded.label,
      description = excluded.description,
      ruleset_code = excluded.ruleset_code,
      ruleset_version = excluded.ruleset_version
  `.execute(db)
  await sql`
    insert into public.rules_catalogues (id, game_system_id, code, label, description)
    values (
      ${ids.secondaryRulesCatalogue}::uuid, ${ids.secondarySystem}::uuid,
      'gate1-blueprint-proof', 'Gate 1 Blueprint mismatch catalogue',
      'Disposable local PostgreSQL proof fixture.'
    ) on conflict (id) do update set
      game_system_id = excluded.game_system_id,
      code = excluded.code,
      label = excluded.label,
      description = excluded.description
  `.execute(db)
}

async function ensureCampaignRoute(db: DBLike, campaignId: string): Promise<void> {
  await sql`
    insert into public.authored_route_ids (subject_kind, subject_id)
    values ('CAMPAIGN', ${campaignId}::uuid)
    on conflict (subject_kind, subject_id) do nothing
  `.execute(db)
}

async function insertLegacyCampaignAndSession(
  db: DBLike,
  state: EncounterBlueprintProofState
): Promise<void> {
  await sql`
    insert into public.campaigns (
      id, owner_user_id, game_system_id, primary_rules_catalogue_id, name, format, tone_tags, content_maturity
    ) values (
      ${ids.validCampaign}::uuid, ${state.ownerUserId}::uuid, ${state.gameSystemId}::uuid, ${state.primaryRulesCatalogueId}::uuid,
      'Gate 1 Blueprint legacy proof', 'ONE_SHOT', array['HEROIC']::text[], 'STANDARD'
    ) on conflict (id) do nothing
  `.execute(db)
  await ensureCampaignRoute(db, ids.validCampaign)
  await sql`
    insert into public.campaign_memberships (campaign_id, user_id, role, status)
    values (${ids.validCampaign}::uuid, ${state.ownerUserId}::uuid, 'OWNER', 'ACTIVE')
    on conflict do nothing
  `.execute(db)
  await sql`insert into public.campaign_play_settings (campaign_id) values (${ids.validCampaign}::uuid) on conflict do nothing`.execute(
    db
  )
  await sql`
    insert into public.campaign_sessions (id, campaign_id, session_number, title, status)
    values (${ids.session}::uuid, ${ids.validCampaign}::uuid, 1, 'Blueprint proof', 'OPEN')
    on conflict (id) do nothing
  `.execute(db)
}

function customEnemy(label: string, systemId: string | null, maxHitPoints = 9) {
  return {
    kind: 'CUSTOM',
    sourceId: null,
    sourceRevision: null,
    label,
    systemId,
    maxHitPoints,
    snapshot: { kind: 'CUSTOM', label, maxHitPoints, systemId }
  }
}

function createRunInput(commandId: string) {
  return {
    campaignId: ids.validCampaign,
    sessionId: ids.session,
    blueprintId: ids.blueprint,
    commandId
  }
}

function fingerprint(input: unknown): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex')
}

async function prepareExtreme(db: DBLike, state: EncounterBlueprintProofState): Promise<void> {
  assert.equal(
    await migrationApplied(db),
    false,
    'Extreme fixture must be prepared before the Blueprint migration.'
  )
  await sql`
    insert into public.campaigns (id, owner_user_id, game_system_id, primary_rules_catalogue_id, name, format, tone_tags, content_maturity)
    values (${ids.extremeCampaign}::uuid, ${state.ownerUserId}::uuid, ${state.gameSystemId}::uuid, ${state.primaryRulesCatalogueId}::uuid,
      'Gate 1 Blueprint extreme proof', 'ONE_SHOT', array['HEROIC']::text[], 'STANDARD')
    on conflict (id) do nothing
  `.execute(db)
  await ensureCampaignRoute(db, ids.extremeCampaign)
  const enemy = { ...customEnemy('Unsafe integer sentinel', null), evidence: { unsafeInteger: 0 } }
  await sql`
    insert into public.encounter_templates (
      id, campaign_id, command_id, command_fingerprint, name, enemies
    ) values (
      ${ids.extremeBlueprint}::uuid, ${ids.extremeCampaign}::uuid,
      ${ids.extremeBlueprintCommand}::uuid,
      ${fingerprint({ name: 'Unsafe integer sentinel', enemies: [enemy] })},
      'Unsafe integer sentinel',
      jsonb_set(
        ${JSON.stringify([enemy])}::jsonb,
        '{0,evidence,unsafeInteger}',
        '9007199254740993'::jsonb,
        true
      )
    ) on conflict (id) do update set
      command_id = excluded.command_id,
      command_fingerprint = excluded.command_fingerprint,
      enemies = excluded.enemies
  `.execute(db)
  console.log(JSON.stringify({ phase: 'prepare-extreme', status: 'PASS' }))
}

async function cleanupExtreme(db: DBLike): Promise<void> {
  assert.equal(
    await migrationApplied(db),
    false,
    'Extreme numeric fixture unexpectedly allowed the migration.'
  )
  await sql`delete from public.encounter_templates where id = ${ids.extremeBlueprint}::uuid`.execute(
    db
  )
  await sql`delete from public.campaigns where id = ${ids.extremeCampaign}::uuid`.execute(db)
  await sql`
    delete from public.authored_route_ids
    where subject_kind = 'CAMPAIGN' and subject_id = ${ids.extremeCampaign}::uuid
  `.execute(db)
  const rows = await sql<{ campaigns: number; routes: number; templates: number }>`
    select
      (select count(*)::int from public.encounter_templates where id = ${ids.extremeBlueprint}::uuid) as templates,
      (select count(*)::int from public.campaigns where id = ${ids.extremeCampaign}::uuid) as campaigns,
      (select count(*)::int from public.authored_route_ids where subject_kind = 'CAMPAIGN' and subject_id = ${ids.extremeCampaign}::uuid) as routes
  `.execute(db)
  assert.deepEqual(rows.rows[0], { campaigns: 0, routes: 0, templates: 0 })
  console.log(JSON.stringify({ phase: 'verify-failed-cleanup-extreme', status: 'PASS' }))
}

function legacyProjection(input: {
  actorId: string
  blueprintId: string
  encounterId: string
  gameSystemId: string
  rulePackRevisionId: string
  sessionId: string
}) {
  const encounter: EncounterRecord = {
    id: input.encounterId,
    campaignId: ids.validCampaign,
    sessionId: input.sessionId,
    gameSystemId: input.gameSystemId,
    blueprintId: input.blueprintId,
    blueprintVersion: 1,
    blueprintChecksum: '0'.repeat(64),
    rulePackRevisionId: input.rulePackRevisionId,
    name: 'Legacy Blueprint Run',
    status: 'PREPARED',
    automationMode: 'ASSISTED',
    manualReminderMode: 'OFF',
    version: 0,
    round: 0,
    currentActorId: null,
    actors: [
      {
        id: input.actorId,
        encounterId: input.encounterId,
        kind: 'CUSTOM',
        sourceId: null,
        sourceRevision: null,
        label: 'Legacy custom',
        systemId: null,
        stableTieKey: 'legacy-custom',
        public: true,
        currentHitPoints: 9,
        maxHitPoints: 9,
        tempHitPoints: 0,
        conditions: [],
        resources: {},
        gmNotes: null,
        initiative: null,
        manualOrder: null,
        snapshot: { kind: 'CUSTOM', label: 'Legacy custom', maxHitPoints: 9 },
        createdAt: '2026-08-25T00:00:00.000Z',
        updatedAt: '2026-08-25T00:00:00.000Z'
      }
    ],
    reminders: [],
    createdAt: '2026-08-25T00:00:00.000Z',
    updatedAt: '2026-08-25T00:00:00.000Z'
  }
  const current = compileEncounterCurrentProjection(
    projectGm(encounter, {
      actors: [
        {
          actorId: input.actorId,
          initiativeModifier: 0,
          targetProtection: { status: 'NOT_NORMALIZED' },
          featureResources: []
        }
      ]
    }),
    {
      encounterVersion: 0,
      revisionId: input.rulePackRevisionId,
      facts: {
        contractVersion: 1,
        actors: [
          {
            actorId: input.actorId,
            abilityScores: {},
            targetProtection: { status: 'NOT_NORMALIZED' },
            featureResources: []
          }
        ]
      },
      output: {
        actors: [
          {
            actorId: input.actorId,
            initiativeModifier: 0,
            targetProtection: { status: 'NOT_NORMALIZED' },
            featureResources: []
          }
        ]
      }
    }
  )
  const {
    gameSystemId: _gameSystemId,
    blueprintId: _blueprintId,
    blueprintVersion: _blueprintVersion,
    blueprintChecksum: _blueprintChecksum,
    ...legacyGm
  } = current.projection
  const legacy = {
    ...current,
    projectionSchemaVersion: 1 as const,
    projectionChecksum: '0'.repeat(64),
    projection: { ...legacyGm, templateId: input.blueprintId, templateVersion: 1 }
  }
  const checksummed = {
    ...legacy,
    projectionChecksum: checksumLegacyEncounterCurrentProjectionV1(legacy)
  }
  return {
    currentProjection: checksummed,
    eventPayload: {
      command: { projection: checksummed.projection, roll: null, resolution: null },
      currentProjection: checksummed
    }
  }
}

async function prepareValidLegacy(db: DBLike, state: EncounterBlueprintProofState): Promise<void> {
  assert.equal(
    await migrationApplied(db),
    false,
    'Valid legacy fixture must be prepared before the Blueprint migration.'
  )
  const extreme = await sql<{ count: number }>`
    select count(*)::int as count from public.encounter_templates where id = ${ids.extremeBlueprint}::uuid
  `.execute(db)
  assert.equal(
    extreme.rows[0]?.count,
    0,
    'Extreme fixture must be cleaned before preparing the valid legacy fixture.'
  )
  await insertLegacyCampaignAndSession(db, state)
  const enemy = { ...customEnemy('Café sentinel', null), evidence: { trailingScale: 0 } }
  const legacy = legacyProjection({
    actorId: ids.legacyActor,
    blueprintId: ids.blueprint,
    encounterId: ids.legacyRun,
    gameSystemId: state.gameSystemId,
    rulePackRevisionId: state.rulePackRevisionId,
    sessionId: ids.session
  })
  await sql`
    insert into public.encounter_templates (
      id, campaign_id, command_id, command_fingerprint, name, version, enemies
    ) values (
      ${ids.blueprint}::uuid, ${ids.validCampaign}::uuid,
      ${ids.legacyBlueprintCommand}::uuid,
      ${fingerprint({ name: 'Legacy Blueprint ✦', enemies: [enemy] })},
      'Legacy Blueprint ✦', 1,
      jsonb_set(
        ${JSON.stringify([enemy])}::jsonb,
        '{0,evidence,trailingScale}',
        '1.0'::jsonb,
        true
      )
    ) on conflict (id) do update set
      command_id = excluded.command_id,
      command_fingerprint = excluded.command_fingerprint,
      name = excluded.name,
      enemies = excluded.enemies
  `.execute(db)
  await sql`
    insert into public.encounters (
      id, campaign_id, session_id, template_id, template_version, rule_pack_revision_id, name, status, version, round
    ) values (
      ${ids.legacyRun}::uuid, ${ids.validCampaign}::uuid, ${ids.session}::uuid,
      ${ids.blueprint}::uuid, 1, ${state.rulePackRevisionId}::uuid, 'Legacy Blueprint Run', 'PREPARED', 0, 0
    ) on conflict (id) do nothing
  `.execute(db)
  await sql`
    insert into public.encounter_actors (
      id, encounter_id, kind, label, system_id, stable_tie_key, current_hit_points, max_hit_points, snapshot
    ) values (
      ${ids.legacyActor}::uuid, ${ids.legacyRun}::uuid, 'CUSTOM', 'Legacy custom', null, 'legacy-custom', 9, 9,
      ${JSON.stringify({ kind: 'CUSTOM', label: 'Legacy custom', maxHitPoints: 9 })}::jsonb
    ) on conflict (id) do nothing
  `.execute(db)
  await sql`
    insert into public.encounter_current_projections (
      encounter_id, stream_version, projection_schema_version, projection_checksum, projection
    ) values (
      ${ids.legacyRun}::uuid, 0, 1, ${legacy.currentProjection.projectionChecksum}, ${JSON.stringify(legacy.currentProjection)}::jsonb
    ) on conflict (encounter_id) do update set
      stream_version = excluded.stream_version, projection_schema_version = excluded.projection_schema_version,
      projection_checksum = excluded.projection_checksum, projection = excluded.projection
  `.execute(db)
  await sql`
    insert into public.encounter_events (
      id, encounter_id, campaign_id, version, command_id, command_type, command_fingerprint,
      command_payload, result_payload, actor_user_id
    ) values (
      ${ids.legacyEvent}::uuid, ${ids.legacyRun}::uuid, ${ids.validCampaign}::uuid, 0,
      ${ids.blueprintCommand}::uuid, 'CREATE', ${fingerprint(createRunInput(ids.blueprintCommand))},
      ${JSON.stringify(createRunInput(ids.blueprintCommand))}::jsonb, ${JSON.stringify(legacy.eventPayload)}::jsonb, ${state.ownerUserId}::uuid
    ) on conflict (encounter_id, command_id) do update set result_payload = excluded.result_payload
  `.execute(db)
  console.log(JSON.stringify({ phase: 'prepare-valid-legacy', status: 'PASS' }))
}

async function assertBrowserDenied(db: DBLike): Promise<void> {
  for (const role of ['anon', 'authenticated'] as const) {
    for (const table of ['encounter_blueprints', 'encounter_blueprint_events']) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as const) {
        const privilegeResult = await sql<{ allowed: boolean }>`
          select has_table_privilege(${role}, ${`public.${table}`}, ${privilege}) as allowed
        `.execute(db)
        assert.equal(
          privilegeResult.rows[0]?.allowed,
          false,
          `${role} must not retain ${privilege} on ${table}.`
        )
      }
      for (const statement of [
        `select id from public.${table} limit 1`,
        `insert into public.${table} default values`,
        `update public.${table} set id = id where false`,
        `delete from public.${table} where false`
      ]) {
        await assert.rejects(
          db.transaction().execute(async (trx) => {
            await sql.raw(`set local role ${role}`).execute(trx)
            await sql.raw(statement).execute(trx)
          }),
          `${role} must be denied ${statement}.`
        )
      }
    }
  }
}

function deferred<T = void>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  return {
    promise: new Promise<T>((currentResolve) => {
      resolve = currentResolve
    }),
    resolve
  }
}

const contentionTimeoutMs = 10_000

function taggedConnectionString(connectionString: string, label: string): string {
  const url = new URL(connectionString)
  url.searchParams.set('application_name', `gate1-blueprint-${label}`)
  return url.toString()
}

async function waitForBlockedContender(
  observer: DBLike,
  applicationName: string,
  blockerPid: number
): Promise<void> {
  const deadline = Date.now() + contentionTimeoutMs
  while (Date.now() < deadline) {
    const result = await sql<{ blocked: boolean }>`
      select exists (
        select 1
        from pg_catalog.pg_stat_activity
        where datname = current_database()
          and application_name = ${applicationName}
          and wait_event_type = 'Lock'
          and ${blockerPid} = any(pg_catalog.pg_blocking_pids(pid))
      ) as blocked
    `.execute(observer)
    if (result.rows[0]?.blocked) return
    await new Promise<void>((resolve) => setTimeout(resolve, 25))
  }
  const diagnostic = await sql<{
    applicationName: string
    pid: number
    state: string
    waitEvent: string | null
    waitEventType: string | null
    blockers: number[]
  }>`
    select
      application_name as "applicationName",
      pid,
      state,
      wait_event as "waitEvent",
      wait_event_type as "waitEventType",
      pg_catalog.pg_blocking_pids(pid) as blockers
    from pg_catalog.pg_stat_activity
    where datname = current_database()
      and application_name = ${applicationName}
  `.execute(observer)
  throw new Error(
    `Contender ${applicationName} did not enter a Lock wait blocked by backend ${blockerPid}: ${JSON.stringify(diagnostic.rows)}`
  )
}

interface RunCounts {
  actors: number
  encounters: number
  events: number
  projections: number
}

async function runCounts(db: DBLike, campaignId: string): Promise<RunCounts> {
  const result = await sql<RunCounts>`
    select
      (select count(*)::int from public.encounters where campaign_id = ${campaignId}::uuid) as encounters,
      (select count(*)::int from public.encounter_actors actor join public.encounters run on run.id = actor.encounter_id where run.campaign_id = ${campaignId}::uuid) as actors,
      (select count(*)::int from public.encounter_current_projections projection join public.encounters run on run.id = projection.encounter_id where run.campaign_id = ${campaignId}::uuid) as projections,
      (select count(*)::int from public.encounter_events where campaign_id = ${campaignId}::uuid) as events
  `.execute(db)
  const counts = result.rows[0]
  if (!counts) throw new Error('Run count query returned no row.')
  return counts
}

async function proveUpdateThenRun(
  db: DBLike,
  connectionString: string,
  state: EncounterBlueprintProofState
): Promise<void> {
  const locked = deferred<number>()
  const release = deferred()
  const contenderLabel = `u-${state.runId.slice(0, 12)}`
  const contenderApplicationName = `gate1-blueprint-${contenderLabel}`
  const contender = createDb({
    connectionString: taggedConnectionString(connectionString, contenderLabel)
  })
  const observer = createDb({
    connectionString: taggedConnectionString(connectionString, `uo-${state.runId.slice(0, 12)}`)
  })
  let run: ReturnType<typeof createEncounter> | undefined
  const update = db.transaction().execute(async (trx) => {
    await sql`select id from public.encounter_blueprints where id = ${ids.blueprint}::uuid for update`.execute(
      trx
    )
    const blocker = await sql<{ pid: number }>`select pg_backend_pid() as pid`.execute(trx)
    const blockerPid = blocker.rows[0]?.pid
    assert.ok(blockerPid, 'The Blueprint lock holder did not expose a backend PID.')
    locked.resolve(blockerPid)
    await release.promise
    const current = await sql<{
      enemies: unknown
    }>`select enemies from public.encounter_blueprints where id = ${ids.blueprint}::uuid`.execute(
      trx
    )
    const enemies = current.rows[0]?.enemies
    assert.ok(enemies, 'Blueprint vanished during the serialization proof.')
    const name = 'Legacy Blueprint ✦ updated'
    await sql`
      update public.encounter_blueprints
      set name = ${name}, version = version + 1,
          setup_checksum = ${checksumCanonicalJson({ name, enemies })}
      where id = ${ids.blueprint}::uuid
    `.execute(trx)
  })
  try {
    const blockerPid = await locked.promise
    run = createEncounter(contender, state.ownerUserId, {
      campaignId: ids.validCampaign,
      sessionId: ids.session,
      blueprintId: ids.blueprint,
      commandId: ids.serializedRunCommand
    })
    await waitForBlockedContender(observer, contenderApplicationName, blockerPid)
    release.resolve()
    await update
    assert.ok(run, 'The Update contender was not created.')
    const created = await run
    assert.equal(created.blueprintVersion, 3)
    assert.equal(
      created.blueprintChecksum,
      checksumCanonicalJson({
        name: 'Legacy Blueprint ✦ updated',
        enemies: (
          await sql<{
            enemies: unknown
          }>`select enemies from public.encounter_blueprints where id = ${ids.blueprint}::uuid`.execute(
            db
          )
        ).rows[0]?.enemies
      })
    )
  } finally {
    release.resolve()
    await update.catch(() => undefined)
    await run?.catch(() => undefined)
    await observer.destroy()
    await contender.destroy()
  }
}

async function proveBlueprintUpdateReceipt(
  db: DBLike,
  state: EncounterBlueprintProofState
): Promise<{
  input: Parameters<typeof updateEncounterBlueprint>[2]
  result: Awaited<ReturnType<typeof updateEncounterBlueprint>>
}> {
  const existingReceipt = await sql<{ command_id: string }>`
    select command_id from public.encounter_blueprint_events
    where blueprint_id = ${ids.blueprint}::uuid and blueprint_version = 2
  `.execute(db)
  const commandId = existingReceipt.rows[0]?.command_id ?? ids.blueprintUpdateCommand
  const update = {
    blueprintId: ids.blueprint,
    expectedVersion: 1,
    name: 'Legacy Blueprint ✦ service update',
    enemies: [{ kind: 'CUSTOM' as const, label: 'Café sentinel', maxHitPoints: 9 }],
    commandId
  }
  const updated = await updateEncounterBlueprint(db, state.ownerUserId, update)
  assert.equal(updated.version, 2)
  const replayed = await updateEncounterBlueprint(db, state.ownerUserId, update)
  assert.deepEqual(replayed, updated)
  await assert.rejects(
    updateEncounterBlueprint(db, state.ownerUserId, {
      ...update,
      name: 'Mismatched update replay'
    })
  )
  const receipts = await sql<{ count: number; version: number; payload: unknown }>`
    select count(*) over ()::int as count, blueprint_version as version, result_payload as payload
    from public.encounter_blueprint_events
    where owner_user_id = ${state.ownerUserId}::uuid and command_id = ${commandId}::uuid
  `.execute(db)
  assert.equal(receipts.rows.length, 1)
  assert.equal(receipts.rows[0]?.count, 1)
  assert.equal(receipts.rows[0]?.version, 2)
  assert.deepEqual(receipts.rows[0]?.payload, updated)
  return { input: update, result: updated }
}

async function proveArchivedCampaignRejectsRun(
  db: DBLike,
  connectionString: string,
  state: EncounterBlueprintProofState
): Promise<void> {
  const before = await runCounts(db, ids.validCampaign)
  const locked = deferred<number>()
  const release = deferred()
  const contenderLabel = `a-${state.runId.slice(0, 12)}`
  const contenderApplicationName = `gate1-blueprint-${contenderLabel}`
  const contender = createDb({
    connectionString: taggedConnectionString(connectionString, contenderLabel)
  })
  const observer = createDb({
    connectionString: taggedConnectionString(connectionString, `ao-${state.runId.slice(0, 12)}`)
  })
  let rejected: ReturnType<typeof createEncounter> | undefined
  const archive = db.transaction().execute(async (trx) => {
    await sql`select id from public.campaigns where id = ${ids.validCampaign}::uuid for update`.execute(
      trx
    )
    const blocker = await sql<{ pid: number }>`select pg_backend_pid() as pid`.execute(trx)
    const blockerPid = blocker.rows[0]?.pid
    assert.ok(blockerPid, 'The Campaign lock holder did not expose a backend PID.')
    locked.resolve(blockerPid)
    await release.promise
    await sql`update public.campaigns set status = 'ARCHIVED' where id = ${ids.validCampaign}::uuid`.execute(
      trx
    )
  })
  try {
    const blockerPid = await locked.promise
    rejected = createEncounter(contender, state.ownerUserId, {
      campaignId: ids.validCampaign,
      sessionId: ids.session,
      blueprintId: ids.blueprint,
      commandId: ids.archivedCommand
    })
    await waitForBlockedContender(observer, contenderApplicationName, blockerPid)
    release.resolve()
    await archive
    assert.ok(rejected, 'The archive contender was not created.')
    await assert.rejects(rejected)
    assert.deepEqual(await runCounts(db, ids.validCampaign), before)
    await sql`update public.campaigns set status = 'ACTIVE' where id = ${ids.validCampaign}::uuid`.execute(
      db
    )
  } finally {
    release.resolve()
    await archive.catch(() => undefined)
    await rejected?.catch(() => undefined)
    await observer.destroy()
    await contender.destroy()
  }
}

async function proveLateEventRollback(
  db: DBLike,
  state: EncounterBlueprintProofState
): Promise<void> {
  const suffix = ids.lateCommand.replaceAll('-', '')
  const functionName = `gate1_blueprint_late_${suffix}`
  const triggerName = `gate1_blueprint_late_${suffix}`
  const before = await runCounts(db, ids.validCampaign)
  try {
    await sql
      .raw(`
      create function public.${functionName}() returns trigger language plpgsql
      set search_path = pg_catalog, public as $$
      begin
        if new.command_id = '${ids.lateCommand}'::uuid then
          raise exception 'GATE1_BLUEPRINT_LATE_EVENT_FAILURE';
        end if;
        return new;
      end;
      $$;
      create trigger ${triggerName} before insert on public.encounter_events
      for each row execute function public.${functionName}();
    `)
      .execute(db)
    await assert.rejects(
      createEncounter(db, state.ownerUserId, {
        campaignId: ids.validCampaign,
        sessionId: ids.session,
        blueprintId: ids.blueprint,
        commandId: ids.lateCommand
      })
    )
    assert.deepEqual(await runCounts(db, ids.validCampaign), before)
  } finally {
    await sql
      .raw(
        `drop trigger if exists ${triggerName} on public.encounter_events; drop function if exists public.${functionName}();`
      )
      .execute(db)
    const remains = await sql<{ functions: number; triggers: number }>`
      select
        (select count(*)::int from pg_proc where proname = ${functionName}) as functions,
        (select count(*)::int from pg_trigger where tgname = ${triggerName} and not tgisinternal) as triggers
    `.execute(db)
    assert.deepEqual(remains.rows[0], { functions: 0, triggers: 0 })
  }
}

async function verifyPost(
  db: DBLike,
  connectionString: string,
  state: EncounterBlueprintProofState
): Promise<void> {
  assert.equal(await migrationApplied(db), true, 'The Blueprint migration is not applied.')
  await ensureCampaignRoute(db, ids.validCampaign)
  const normalized = await sql<{
    enemies: unknown
    setup_checksum: string
    actor_system_id: string | null
    actor_snapshot: unknown
    name: string
  }>`
    select blueprint.name, blueprint.enemies, blueprint.setup_checksum,
      actor.system_id as actor_system_id, actor.snapshot as actor_snapshot
    from public.encounter_blueprints blueprint
    join public.encounter_actors actor on actor.encounter_id = ${ids.legacyRun}::uuid
    where blueprint.id = ${ids.blueprint}::uuid
  `.execute(db)
  const row = normalized.rows[0]
  assert.ok(row, 'Migrated legacy Blueprint fixture is unavailable.')
  const enemies = row.enemies as unknown[]
  assert.equal((enemies[0] as { systemId?: string }).systemId, state.gameSystemId)
  assert.equal(
    (enemies[0] as { snapshot?: { systemId?: string } }).snapshot?.systemId,
    state.gameSystemId
  )
  assert.equal(row.actor_system_id, state.gameSystemId)
  assert.equal((row.actor_snapshot as { systemId?: string }).systemId, state.gameSystemId)
  const runtimeSetup = { name: row.name, enemies }
  assert.equal(
    row.setup_checksum,
    checksumCanonicalJson(runtimeSetup),
    `Migrated Blueprint checksum differs from runtime canonical JSON: ${canonicalizeJson(runtimeSetup)}`
  )

  const repository = createEncounterRepository(db)
  const projection = await repository.requireCurrentProjection({
    encounterId: ids.legacyRun,
    expectedStreamVersion: 0
  })
  assert.equal(projection.projectionSchemaVersion, 2)
  assert.equal(projection.projection.blueprintId, ids.blueprint)
  assert.equal(checksumEncounterCurrentProjection(projection), projection.projectionChecksum)
  const events = await repository.listEvents(ids.legacyRun)
  assert.equal(
    replayEncounterCurrentProjection(events, {
      encounterId: ids.legacyRun,
      gameSystemId: state.gameSystemId,
      blueprintId: ids.blueprint,
      blueprintVersion: 1,
      blueprintChecksum: projection.projection.blueprintChecksum,
      automationMode: 'ASSISTED',
      manualReminderMode: 'OFF'
    }).projectionChecksum,
    projection.projectionChecksum
  )

  const updateReceipt = await proveBlueprintUpdateReceipt(db, state)
  const historicalReplay = await createEncounter(
    db,
    state.ownerUserId,
    createRunInput(ids.blueprintCommand)
  )
  assert.equal(historicalReplay.id, ids.legacyRun)
  assert.equal(historicalReplay.blueprintVersion, 1)
  await assert.rejects(
    createEncounter(db, state.ownerUserId, {
      ...createRunInput(ids.blueprintCommand),
      blueprintId: ids.lateRun
    })
  )

  const freshCommandId = ids.freshRunCommand
  const created = await createEncounter(db, state.ownerUserId, {
    campaignId: ids.validCampaign,
    sessionId: ids.session,
    blueprintId: ids.blueprint,
    commandId: freshCommandId
  })
  assert.equal(created.blueprintId, ids.blueprint)
  assert.equal(created.gameSystemId, state.gameSystemId)
  const replayed = await createEncounter(db, state.ownerUserId, {
    campaignId: ids.validCampaign,
    sessionId: ids.session,
    blueprintId: ids.blueprint,
    commandId: freshCommandId
  })
  assert.equal(replayed.id, created.id, 'Matching Run creation must replay the committed Run.')
  assert.equal(
    state.otherGameSystemId,
    ids.secondarySystem,
    'The disposable mismatch System identity changed.'
  )
  assert.equal(
    state.otherPrimaryRulesCatalogueId,
    ids.secondaryRulesCatalogue,
    'The disposable mismatch Catalogue identity changed.'
  )
  await sql`
    insert into public.campaigns (id, owner_user_id, game_system_id, primary_rules_catalogue_id, name, format, tone_tags, content_maturity)
    values (${ids.crossCampaign}::uuid, ${state.ownerUserId}::uuid, ${state.otherGameSystemId}::uuid, ${state.otherPrimaryRulesCatalogueId}::uuid,
      'Cross System Blueprint proof', 'ONE_SHOT', array['HEROIC']::text[], 'STANDARD')
  `.execute(db)
  await ensureCampaignRoute(db, ids.crossCampaign)
  await sql`
    insert into public.campaign_memberships (campaign_id, user_id, role, status)
    values (${ids.crossCampaign}::uuid, ${state.ownerUserId}::uuid, 'OWNER', 'ACTIVE')
  `.execute(db)
  await sql`insert into public.campaign_play_settings (campaign_id) values (${ids.crossCampaign}::uuid)`.execute(
    db
  )
  await sql`
    insert into public.campaign_sessions (id, campaign_id, session_number, title, status)
    values (${ids.archivedCommand}::uuid, ${ids.crossCampaign}::uuid, 1, 'Cross System', 'OPEN')
  `.execute(db)
  await assert.rejects(
    createEncounter(db, state.ownerUserId, {
      campaignId: ids.crossCampaign,
      sessionId: ids.archivedCommand,
      blueprintId: ids.blueprint,
      commandId: ids.crossCommand
    }),
    /Encounter Blueprint does not match the Campaign Game System/
  )
  const crossRuns = await sql<{ count: number }>`
    select count(*)::int as count from public.encounters
    where campaign_id = ${ids.crossCampaign}::uuid
  `.execute(db)
  assert.equal(crossRuns.rows[0]?.count, 0)

  await proveUpdateThenRun(db, connectionString, state)
  assert.deepEqual(
    await updateEncounterBlueprint(db, state.ownerUserId, updateReceipt.input),
    updateReceipt.result,
    'A matching Blueprint update must replay its original receipt after later edits.'
  )
  const stableUpdateReceipt = await sql<{ count: number }>`
    select count(*)::int as count from public.encounter_blueprint_events
    where owner_user_id = ${state.ownerUserId}::uuid
      and command_id = ${updateReceipt.input.commandId}::uuid
  `.execute(db)
  assert.equal(stableUpdateReceipt.rows[0]?.count, 1)
  await proveArchivedCampaignRejectsRun(db, connectionString, state)
  await proveLateEventRollback(db, state)

  await assertBrowserDenied(db)
  console.log(
    JSON.stringify({
      phase: 'verify-post',
      status: 'PASS',
      projectionSchemaVersion: projection.projectionSchemaVersion
    })
  )
}

async function tableExists(db: DBLike, relation: string): Promise<boolean> {
  const result = await sql<{
    relation: string | null
  }>`select to_regclass(${relation}) as relation`.execute(db)
  return result.rows[0]?.relation !== null
}

async function cleanup(
  db: DBLike,
  admin: ReturnType<typeof createClient>['auth']['admin'],
  state: EncounterBlueprintProofJournal
): Promise<void> {
  const ownerLookup =
    state.ownerUserId === null
      ? await sql<{ id: string }>`
          select id from auth.users where email = ${state.ownerEmail} limit 1
        `.execute(db)
      : null
  const ownerUserId = state.ownerUserId ?? ownerLookup?.rows[0]?.id ?? null
  const campaignIds = [
    ids.validCampaign,
    ids.extremeCampaign,
    ids.archivedCampaign,
    ids.crossCampaign
  ]
  const hasBlueprints = await tableExists(db, 'public.encounter_blueprints')
  await sql`delete from public.campaigns where id in (${campaignIds[0]}::uuid, ${campaignIds[1]}::uuid, ${campaignIds[2]}::uuid, ${campaignIds[3]}::uuid)`.execute(
    db
  )
  await sql`
    delete from public.authored_route_ids
    where subject_kind = 'CAMPAIGN'
      and subject_id in (${campaignIds[0]}::uuid, ${campaignIds[1]}::uuid, ${campaignIds[2]}::uuid, ${campaignIds[3]}::uuid)
  `.execute(db)
  if (hasBlueprints) {
    await sql`delete from public.encounter_blueprint_events where blueprint_id in (${ids.blueprint}::uuid, ${ids.extremeBlueprint}::uuid)`.execute(
      db
    )
    await sql`delete from public.encounter_blueprints where id in (${ids.blueprint}::uuid, ${ids.extremeBlueprint}::uuid)`.execute(
      db
    )
  }
  if (await tableExists(db, 'public.encounter_templates')) {
    await sql`delete from public.encounter_templates where id in (${ids.blueprint}::uuid, ${ids.extremeBlueprint}::uuid)`.execute(
      db
    )
  }
  await sql`delete from public.rules_catalogues where id = ${ids.secondaryRulesCatalogue}::uuid`.execute(
    db
  )
  await sql`delete from public.systems where id = ${ids.secondarySystem}::uuid`.execute(db)
  const existingUser = await sql<{ count: number }>`
    select count(*)::int as count from auth.users where id = ${ownerUserId}::uuid
  `.execute(db)
  if (ownerUserId !== null && (existingUser.rows[0]?.count ?? 0) > 0) {
    const removed = await admin.deleteUser(ownerUserId)
    if (removed.error) throw removed.error
  }
  const residual = await sql<{
    campaignMemberships: number
    campaignSettings: number
    campaigns: number
    catalogues: number
    profiles: number
    routes: number
    sessions: number
    systems: number
    users: number
  }>`
    select
      (select count(*)::int from public.campaigns where id in (${campaignIds[0]}::uuid, ${campaignIds[1]}::uuid, ${campaignIds[2]}::uuid, ${campaignIds[3]}::uuid)) as campaigns,
      (select count(*)::int from public.campaign_memberships where campaign_id in (${campaignIds[0]}::uuid, ${campaignIds[1]}::uuid, ${campaignIds[2]}::uuid, ${campaignIds[3]}::uuid)) as "campaignMemberships",
      (select count(*)::int from public.campaign_play_settings where campaign_id in (${campaignIds[0]}::uuid, ${campaignIds[1]}::uuid, ${campaignIds[2]}::uuid, ${campaignIds[3]}::uuid)) as "campaignSettings",
      (select count(*)::int from public.campaign_sessions where campaign_id in (${campaignIds[0]}::uuid, ${campaignIds[1]}::uuid, ${campaignIds[2]}::uuid, ${campaignIds[3]}::uuid)) as sessions,
      (select count(*)::int from public.authored_route_ids where subject_kind = 'CAMPAIGN' and subject_id in (${campaignIds[0]}::uuid, ${campaignIds[1]}::uuid, ${campaignIds[2]}::uuid, ${campaignIds[3]}::uuid)) as routes,
      (select count(*)::int from public.rules_catalogues where id = ${ids.secondaryRulesCatalogue}::uuid) as catalogues,
      (select count(*)::int from public.systems where id = ${ids.secondarySystem}::uuid) as systems,
      (select count(*)::int from public.profiles where id = ${ownerUserId}::uuid) as profiles,
      (select count(*)::int from auth.users where id = ${ownerUserId}::uuid) as users
  `.execute(db)
  assert.deepEqual(residual.rows[0], {
    campaignMemberships: 0,
    campaignSettings: 0,
    campaigns: 0,
    catalogues: 0,
    profiles: 0,
    routes: 0,
    sessions: 0,
    systems: 0,
    users: 0
  })
  if (hasBlueprints) {
    const runResidual = await sql<{
      actors: number
      blueprintEvents: number
      blueprints: number
      events: number
      projections: number
      runs: number
    }>`
      select
        (select count(*)::int from public.encounter_blueprints where id in (${ids.blueprint}::uuid, ${ids.extremeBlueprint}::uuid)) as blueprints,
        (select count(*)::int from public.encounter_blueprint_events where blueprint_id in (${ids.blueprint}::uuid, ${ids.extremeBlueprint}::uuid)) as "blueprintEvents",
        (select count(*)::int from public.encounters where campaign_id in (${campaignIds[0]}::uuid, ${campaignIds[3]}::uuid)) as runs,
        (select count(*)::int from public.encounter_actors actor join public.encounters run on run.id = actor.encounter_id where run.campaign_id in (${campaignIds[0]}::uuid, ${campaignIds[3]}::uuid)) as actors,
        (select count(*)::int from public.encounter_current_projections projection join public.encounters run on run.id = projection.encounter_id where run.campaign_id in (${campaignIds[0]}::uuid, ${campaignIds[3]}::uuid)) as projections,
        (select count(*)::int from public.encounter_events where campaign_id in (${campaignIds[0]}::uuid, ${campaignIds[3]}::uuid)) as events
    `.execute(db)
    assert.deepEqual(runResidual.rows[0], {
      actors: 0,
      blueprintEvents: 0,
      blueprints: 0,
      events: 0,
      projections: 0,
      runs: 0
    })
  } else if (await tableExists(db, 'public.encounter_templates')) {
    const legacyResidual = await sql<{ templates: number }>`
      select count(*)::int as templates from public.encounter_templates
      where id in (${ids.blueprint}::uuid, ${ids.extremeBlueprint}::uuid)
    `.execute(db)
    assert.deepEqual(legacyResidual.rows[0], { templates: 0 })
  }
}

/**
 * Executes exactly one lifecycle stage. The caller intentionally runs the
 * Supabase migration between prepare-valid-legacy and verify-post.
 */
export async function proveEncounterBlueprintPostgresSemantics(
  options: EncounterBlueprintPostgresProofOptions
): Promise<void> {
  requireLoopback('DATABASE_CONNECTION_STRING', options.connectionString)
  requireLoopback('SUPABASE_URL', options.supabaseUrl)
  const db = createDb({ connectionString: options.connectionString })
  const admin = createClient(options.supabaseUrl, options.supabaseSecretKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false }
  })
  try {
    if (options.mode === 'prepare-extreme') {
      ensureStateParent(options.statePath)
      const stored = existsSync(options.statePath)
        ? validateState(readState(options.statePath), options.runId)
        : null
      const seed = stored ?? (await requiredSeedState(db))
      const journal: EncounterBlueprintProofJournal = stored ?? {
        ...seed,
        phase: 'PREPARING',
        ownerEmail: `gate1-blueprint-${options.runId}@example.test`,
        ownerUserId: null,
        otherGameSystemId: ids.secondarySystem,
        otherPrimaryRulesCatalogueId: ids.secondaryRulesCatalogue,
        runId: options.runId
      }
      if (stored === null) writeState(options.statePath, journal)
      const ownerUserId = await createOwner(db, admin.auth.admin, options.runId)
      const state: EncounterBlueprintProofState = {
        ...journal,
        phase: 'READY',
        ownerUserId
      }
      try {
        await createSecondarySystemAndCatalogue(db, ownerUserId)
        writeState(options.statePath, state)
        await prepareExtreme(db, state)
      } catch (error) {
        try {
          await cleanup(db, admin.auth.admin, state)
          rmSync(options.statePath, { force: true })
        } catch (cleanupError) {
          throw new AggregateError(
            [error, cleanupError],
            'Blueprint proof preparation and recovery cleanup both failed.'
          )
        }
        throw error
      }
      return
    }
    const stored = validateState(readState(options.statePath), options.runId)
    if (options.mode === 'cleanup') {
      await cleanup(db, admin.auth.admin, stored)
      rmSync(options.statePath, { force: true })
      console.log(JSON.stringify({ phase: 'cleanup', status: 'PASS' }))
      return
    }
    const state = requireReadyState(stored)
    if (options.mode === 'verify-failed-cleanup-extreme') {
      await cleanupExtreme(db)
      return
    }
    if (options.mode === 'prepare-valid-legacy') {
      await prepareValidLegacy(db, state)
      return
    }
    await verifyPost(db, options.connectionString, state)
    await cleanup(db, admin.auth.admin, state)
    rmSync(options.statePath, { force: true })
  } finally {
    await db.destroy()
  }
}

export const encounterBlueprintProofModes: readonly Mode[] = [
  'prepare-extreme',
  'verify-failed-cleanup-extreme',
  'prepare-valid-legacy',
  'verify-post',
  'cleanup'
]
