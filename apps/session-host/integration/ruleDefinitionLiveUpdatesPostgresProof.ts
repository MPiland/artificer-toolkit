import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import {
  createDb,
  createReusableDefinitionRepository,
  withTransaction,
  type DBLike
} from '@artificer-toolkit/db'
import { ruleGraphDefinitionDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import type { StoredRuleExecutionResultDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { sql } from 'kysely'

import {
  createCharacterRuleExecutionAggregatePort,
  createEncounterRuleExecutionAggregatePort,
  createRuleExecutionOccurrenceService
} from '../../../packages/functions/src/services/rules/ruleExecutionOccurrenceService.js'
import {
  createReusableDefinitionRuntimeSource,
  createReusableDefinitionService,
  RULE_RUNTIME_GRAPH_FAMILY_KEY
} from '../../../packages/functions/src/services/rules/reusableDefinitionService.js'
import { createRulesRuntimeService } from '../../../packages/functions/src/services/rules/rulesRuntimeService.js'

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', 'host.docker.internal'])

interface DisposableUser {
  id: string
}

interface RuntimeCounters {
  execute: number
  resume: number
  requireCurrent: number
}

interface Deferred<T = void> {
  promise: Promise<T>
  resolve(value: T): void
}

export interface RuleDefinitionLiveUpdatesPostgresProofOptions {
  connectionString: string
  runId: string
  supabaseSecretKey: string
  supabaseUrl: string
}

function requireLoopback(name: string, value: string): void {
  const host = new URL(value).hostname.toLowerCase()
  if (!LOCAL_HOSTS.has(host))
    throw new Error(`${name} must use a loopback host; received "${host}".`)
}

function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((currentResolve) => {
    resolve = currentResolve
  })
  return { promise, resolve }
}

function taggedConnectionString(connectionString: string, label: string): string {
  const url = new URL(connectionString)
  url.searchParams.set('application_name', `rule-live-update-proof-${label}`)
  return url.toString()
}

async function waitForDatabaseLockWait(db: DBLike, blockerPid: number): Promise<void> {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const waiting = await sql<{ waiting: boolean }>`
      select exists (
        select 1 from pg_catalog.pg_stat_activity
        where datname = current_database()
          and pid <> pg_backend_pid()
          and wait_event_type = 'Lock'
          and ${blockerPid} = any(pg_catalog.pg_blocking_pids(pid))
      ) as waiting
    `.execute(db)
    if (waiting.rows[0]?.waiting) return
    await new Promise<void>((resolve) => setImmediate(resolve))
  }
  throw new Error(`The proof command never waited on PostgreSQL backend ${blockerPid}.`)
}

async function createDisposableUser(
  admin: ReturnType<typeof createClient>['auth']['admin'],
  runId: string,
  role: string
): Promise<DisposableUser> {
  const { data, error } = await admin.createUser({
    email: `rule-live-update-${role}-${runId}@example.test`,
    email_confirm: true,
    password: `Local-${randomUUID()}-Aa1!`,
    user_metadata: { username: `rulelive${role}${runId.replaceAll('-', '').slice(0, 10)}` }
  })
  if (error) throw error
  if (!data.user) throw new Error(`Supabase did not create the ${role} proof user.`)
  return { id: data.user.id }
}

function capability(gameSystemId: string) {
  return {
    gameSystemId,
    contractVersion: 1,
    authoredRootKinds: ['action'],
    definitionFamilyKeys: [RULE_RUNTIME_GRAPH_FAMILY_KEY],
    factContracts: [{ key: 'actor.base', valueKind: 'NUMBER' }],
    operationContracts: [
      { key: 'number.add', contractVersion: 1 },
      { key: 'evidence.integer-range', contractVersion: 1 }
    ]
  } as const
}

function pausedGraph(input: { definitionId: string; gameSystemId: string }) {
  return ruleGraphDefinitionDtoSchema.parse({
    schemaVersion: 1,
    id: input.definitionId,
    gameSystemId: input.gameSystemId,
    definitionFamilyKey: RULE_RUNTIME_GRAPH_FAMILY_KEY,
    nodes: [
      {
        id: 'base',
        operation: { key: 'number.add', contractVersion: 1 },
        inputs: {
          left: { kind: 'FACT', factKey: 'actor.base' },
          right: { kind: 'LITERAL', value: 1 }
        }
      },
      {
        id: 'roll',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: {
          min: { kind: 'LITERAL', value: 1 },
          max: { kind: 'LITERAL', value: 20 }
        }
      },
      {
        id: 'result',
        operation: { key: 'number.add', contractVersion: 1 },
        inputs: {
          left: { kind: 'NODE_OUTPUT', nodeId: 'base', port: 'value' },
          right: { kind: 'NODE_OUTPUT', nodeId: 'roll', port: 'value' }
        }
      }
    ],
    outputs: { value: { kind: 'NODE_OUTPUT', nodeId: 'result', port: 'value' } }
  })
}

function currentGraph(input: { definitionId: string; gameSystemId: string; increment: number }) {
  return ruleGraphDefinitionDtoSchema.parse({
    schemaVersion: 1,
    id: input.definitionId,
    gameSystemId: input.gameSystemId,
    definitionFamilyKey: RULE_RUNTIME_GRAPH_FAMILY_KEY,
    nodes: [
      {
        id: 'result',
        operation: { key: 'number.add', contractVersion: 1 },
        inputs: {
          left: { kind: 'FACT', factKey: 'actor.base' },
          right: { kind: 'LITERAL', value: input.increment }
        }
      }
    ],
    outputs: { value: { kind: 'NODE_OUTPUT', nodeId: 'result', port: 'value' } }
  })
}

function requireComplete(
  result: StoredRuleExecutionResultDto
): Extract<StoredRuleExecutionResultDto, { status: 'COMPLETE' }> {
  if (result.status !== 'COMPLETE') assert.fail('Rule execution unexpectedly paused.')
  return result
}

function outputValue(result: StoredRuleExecutionResultDto): number {
  const value = requireComplete(result).outputs.value
  if (typeof value !== 'number') assert.fail('Rule execution output "value" must be numeric.')
  return value
}

async function requireVersion(
  db: DBLike,
  table: 'characters' | 'encounters',
  id: string
): Promise<number> {
  const column = table === 'characters' ? 'stream_version' : 'version'
  const result = await sql
    .raw<{ version: number }>(
      `select ${column} as version from public.${table} where id = '${id}'::uuid`
    )
    .execute(db)
  assert.notEqual(result.rows[0]?.version, undefined, `${table} fixture is unavailable.`)
  return Number(result.rows[0]?.version)
}

async function countRows(db: DBLike, table: string, column: string, ids: readonly string[]) {
  if (ids.length === 0) return 0
  const literals = ids.map((id) => `'${id}'::uuid`).join(', ')
  const result = await sql
    .raw<{ count: string }>(
      `select count(*)::text as count from ${table} where ${column} in (${literals})`
    )
    .execute(db)
  return Number(result.rows[0]?.count ?? 0)
}

export async function proveRuleDefinitionLiveUpdatesPostgresSemantics(
  options: RuleDefinitionLiveUpdatesPostgresProofOptions
): Promise<void> {
  requireLoopback('DATABASE_CONNECTION_STRING', options.connectionString)
  requireLoopback('SUPABASE_URL', options.supabaseUrl)
  const db = createDb({ connectionString: options.connectionString })
  const admin = createClient(options.supabaseUrl, options.supabaseSecretKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false }
  })
  const ids = {
    campaignId: randomUUID(),
    characterDefinitionId: randomUUID(),
    characterId: randomUUID(),
    contentSourceId: randomUUID(),
    catalogueId: randomUUID(),
    encounterDefinitionId: randomUUID(),
    encounterId: randomUUID(),
    encounterBlueprintId: randomUUID(),
    rollbackDefinitionId: randomUUID(),
    rulePackId: randomUUID(),
    rulePackRevisionId: randomUUID(),
    sessionId: randomUUID(),
    systemId: randomUUID()
  }
  const createdUsers: DisposableUser[] = []
  let runError: unknown
  let cleanupError: unknown
  const captureCleanup = async (operation: () => Promise<unknown>) => {
    try {
      await operation()
    } catch (error) {
      cleanupError ??= error
    }
  }

  try {
    const gm = await createDisposableUser(admin.auth.admin, options.runId, 'gm')
    const player = await createDisposableUser(admin.auth.admin, options.runId, 'player')
    const outsider = await createDisposableUser(admin.auth.admin, options.runId, 'outsider')
    createdUsers.push(gm, player, outsider)

    await sql`
      insert into public.systems (id, user_id, label, ruleset_code, ruleset_version)
      values (${ids.systemId}::uuid, ${gm.id}::uuid, 'Rule live-update proof System',
        ${`live-update-${options.runId}`}, '1')
    `.execute(db)
    await sql`
      insert into public.content_sources (id, game_system_id, kind, owner_user_id, code, label)
      values (${ids.contentSourceId}::uuid, ${ids.systemId}::uuid, 'USER', ${gm.id}::uuid,
        ${`live-update-${options.runId}`}, 'Rule live-update proof source')
    `.execute(db)
    await sql`
      insert into public.rules_catalogues (id, game_system_id, code, label)
      values (${ids.catalogueId}::uuid, ${ids.systemId}::uuid, ${`live-update-${options.runId}`},
        'Rule live-update proof Catalogue')
    `.execute(db)
    await sql`
      insert into public.rules_catalogue_content_sources (catalogue_id, content_source_id, game_system_id)
      values (${ids.catalogueId}::uuid, ${ids.contentSourceId}::uuid, ${ids.systemId}::uuid)
    `.execute(db)
    for (const definitionId of [ids.characterDefinitionId, ids.encounterDefinitionId]) {
      await sql`
        insert into public.reusable_definitions (
          id, game_system_id, content_source_id, definition_family_key, label
        ) values (
          ${definitionId}::uuid, ${ids.systemId}::uuid, ${ids.contentSourceId}::uuid,
          ${RULE_RUNTIME_GRAPH_FAMILY_KEY}, 'Rule live-update proof definition'
        )
      `.execute(db)
    }
    await sql`
      insert into public.rule_packs (id, ruleset_code, version)
      values (${ids.rulePackId}::uuid, ${`live-update-${options.runId}`}, '1')
    `.execute(db)
    await sql`
      insert into public.rule_pack_revisions (id, rule_pack_id, revision, document, checksum, created_by)
      values (${ids.rulePackRevisionId}::uuid, ${ids.rulePackId}::uuid, 1, '{}'::jsonb,
        ${'c'.repeat(64)}, ${gm.id}::uuid)
    `.execute(db)
    await sql`
      insert into public.characters (
        id, system_id, primary_rules_catalogue_id, user_id, label, status, rule_pack_revision_id,
        stream_version
      ) values (
        ${ids.characterId}::uuid, ${ids.systemId}::uuid, ${ids.catalogueId}::uuid, ${player.id}::uuid,
        'Rule live-update proof Character', 'ACTIVE', ${ids.rulePackRevisionId}::uuid, 0
      )
    `.execute(db)
    await sql`
      insert into public.campaigns (
        id, owner_user_id, game_system_id, primary_rules_catalogue_id, name, format, tone_tags,
        content_maturity
      ) values (
        ${ids.campaignId}::uuid, ${gm.id}::uuid, ${ids.systemId}::uuid, ${ids.catalogueId}::uuid,
        'Rule live-update proof Campaign', 'ONE_SHOT', array['HEROIC']::text[], 'STANDARD'
      )
    `.execute(db)
    await sql`
      insert into public.authored_route_ids (subject_kind, subject_id)
      values ('CAMPAIGN', ${ids.campaignId}::uuid)
    `.execute(db)
    await sql`
      insert into public.campaign_memberships (campaign_id, user_id, role, status)
      values (${ids.campaignId}::uuid, ${gm.id}::uuid, 'OWNER', 'ACTIVE')
    `.execute(db)
    await sql`insert into public.campaign_play_settings (campaign_id) values (${ids.campaignId}::uuid)`.execute(
      db
    )
    await sql`
      insert into public.campaign_sessions (id, campaign_id, session_number, title, status)
      values (${ids.sessionId}::uuid, ${ids.campaignId}::uuid, 1, 'Rule live-update proof Session', 'OPEN')
    `.execute(db)
    await sql`
      insert into public.encounter_blueprints (id, owner_user_id, game_system_id, command_id, command_fingerprint, name, setup_checksum, enemies)
      values (${ids.encounterBlueprintId}::uuid, ${gm.id}::uuid, ${ids.systemId}::uuid, ${randomUUID()}::uuid,
        ${'d'.repeat(64)}, 'Rule live-update proof Blueprint', ${'e'.repeat(64)},
        ${JSON.stringify([{ kind: 'CUSTOM', label: 'Proof target', maxHitPoints: 1 }])}::jsonb)
    `.execute(db)
    await sql`
      insert into public.encounters (id, campaign_id, session_id, game_system_id, blueprint_id, blueprint_version, blueprint_checksum, name)
      values (${ids.encounterId}::uuid, ${ids.campaignId}::uuid, ${ids.sessionId}::uuid,
        ${ids.systemId}::uuid, ${ids.encounterBlueprintId}::uuid, 1, ${'e'.repeat(64)}, 'Rule live-update proof Encounter')
    `.execute(db)

    const repository = createReusableDefinitionRepository(db)
    const definitionService = createReusableDefinitionService({
      store: repository,
      capabilities: [capability(ids.systemId)]
    })
    const counters: RuntimeCounters = { execute: 0, resume: 0, requireCurrent: 0 }
    let beforeCurrentRead: ((definitionId: string) => Promise<void>) | null = null
    const runtimeSource = createReusableDefinitionRuntimeSource({
      async requireCurrent(definitionId) {
        if (beforeCurrentRead) await beforeCurrentRead(definitionId)
        counters.requireCurrent += 1
        return repository.requireCurrent(definitionId)
      }
    })
    const baseRuntime = createRulesRuntimeService({
      capabilities: [capability(ids.systemId)],
      definitions: runtimeSource,
      continuationIntegrityKey: new TextEncoder().encode(
        'local-rule-live-update-proof-integrity-key'
      )
    })
    const runtime = {
      async execute(input: unknown) {
        counters.execute += 1
        return baseRuntime.execute(input)
      },
      async executeResolved(input: Parameters<typeof baseRuntime.executeResolved>[0]) {
        counters.execute += 1
        return baseRuntime.executeResolved(input)
      },
      async executeFrozen(input: Parameters<typeof baseRuntime.executeFrozen>[0]) {
        counters.execute += 1
        return baseRuntime.executeFrozen(input)
      },
      async resume(input: unknown) {
        counters.resume += 1
        return baseRuntime.resume(input)
      }
    }
    const occurrenceService = createRuleExecutionOccurrenceService({ db, runtime })

    const stageDraft = async (
      definitionId: string,
      expectedDefinitionVersion: number,
      document: ReturnType<typeof pausedGraph>
    ) =>
      definitionService.saveDraft({
        definitionId,
        actorUserId: gm.id,
        expectedDefinitionVersion,
        expectedDraftVersion: null,
        document
      })
    const publishStaged = async (
      definitionId: string,
      expectedDefinitionVersion: number,
      expectedDraftVersion: number
    ) =>
      definitionService.publishDraft({
        definitionId,
        actorUserId: gm.id,
        expectedDefinitionVersion,
        expectedDraftVersion
      })
    const publish = async (
      definitionId: string,
      expectedDefinitionVersion: number,
      document: ReturnType<typeof pausedGraph>
    ) => {
      const draft = await stageDraft(definitionId, expectedDefinitionVersion, document)
      return publishStaged(definitionId, expectedDefinitionVersion, draft.version)
    }

    const characterA = pausedGraph({
      definitionId: ids.characterDefinitionId,
      gameSystemId: ids.systemId
    })
    const characterB = currentGraph({
      definitionId: ids.characterDefinitionId,
      gameSystemId: ids.systemId,
      increment: 100
    })
    const characterC = currentGraph({
      definitionId: ids.characterDefinitionId,
      gameSystemId: ids.systemId,
      increment: 200
    })
    const characterD = currentGraph({
      definitionId: ids.characterDefinitionId,
      gameSystemId: ids.systemId,
      increment: 300
    })
    const encounterA = pausedGraph({
      definitionId: ids.encounterDefinitionId,
      gameSystemId: ids.systemId
    })
    const encounterB = currentGraph({
      definitionId: ids.encounterDefinitionId,
      gameSystemId: ids.systemId,
      increment: 100
    })
    const publishedCharacterA = await publish(ids.characterDefinitionId, 0, characterA)
    const publishedEncounterA = await publish(ids.encounterDefinitionId, 0, encounterA)

    const characterPort = () =>
      createCharacterRuleExecutionAggregatePort({
        characterId: ids.characterId,
        actorUserId: player.id
      })
    const characterStart = {
      commandId: randomUUID(),
      correlationId: null,
      expectedAggregateVersion: 0,
      definitionId: ids.characterDefinitionId,
      facts: { 'actor.base': 3 }
    }
    const startedCharacterA = await occurrenceService.execute(characterPort(), characterStart)
    assert.equal(startedCharacterA.status, 'PAUSED')
    assert.equal(await requireVersion(db, 'characters', ids.characterId), 1)
    assert.equal(counters.execute, 1)
    assert.equal(
      (
        await sql<{ checksum: string }>`
        select pending_snapshot #>> '{graph,source,checksum}' as checksum
        from public.character_rule_occurrences where id = ${startedCharacterA.occurrenceId}::uuid
      `.execute(db)
      ).rows[0]?.checksum,
      publishedCharacterA.checksum
    )

    const publishedCharacterB = await publish(ids.characterDefinitionId, 1, characterB)
    const readsBeforeCharacterResume = counters.requireCurrent
    const resumeCharacterA = {
      commandId: randomUUID(),
      correlationId: null,
      expectedAggregateVersion: 1,
      occurrenceId: startedCharacterA.occurrenceId,
      expectedOccurrenceVersion: startedCharacterA.occurrenceVersion,
      response: { requestId: startedCharacterA.request.requestId, value: 7 }
    }
    const completedCharacterA = await occurrenceService.resume(characterPort(), resumeCharacterA)
    assert.equal(outputValue(completedCharacterA), 11)
    assert.equal(completedCharacterA.status, 'COMPLETE')
    assert.equal(counters.requireCurrent, readsBeforeCharacterResume)
    assert.equal(counters.resume, 1)
    assert.equal(
      requireComplete(completedCharacterA).evidence.source.checksum,
      publishedCharacterA.checksum
    )
    const resumeBeforeReplay = counters.resume
    assert.deepEqual(
      await occurrenceService.resume(characterPort(), resumeCharacterA),
      completedCharacterA
    )
    assert.equal(counters.resume, resumeBeforeReplay)
    assert.equal(counters.requireCurrent, readsBeforeCharacterResume)

    const characterBResult = await occurrenceService.execute(characterPort(), {
      commandId: randomUUID(),
      correlationId: null,
      expectedAggregateVersion: 2,
      definitionId: ids.characterDefinitionId,
      facts: { 'actor.base': 3 }
    })
    assert.equal(outputValue(characterBResult), 103)
    assert.equal(
      requireComplete(characterBResult).evidence.source.checksum,
      publishedCharacterB.checksum
    )
    assert.equal(await requireVersion(db, 'characters', ids.characterId), 3)

    const stagedCharacterC = await stageDraft(ids.characterDefinitionId, 2, characterC)
    const beforeUnauthorizedPublish = await repository.requireCurrent(ids.characterDefinitionId)
    await assert.rejects(
      definitionService.publishDraft({
        definitionId: ids.characterDefinitionId,
        actorUserId: outsider.id,
        expectedDefinitionVersion: 2,
        expectedDraftVersion: stagedCharacterC.version
      }),
      /not owned/
    )
    const afterUnauthorizedPublish = await repository.requireCurrent(ids.characterDefinitionId)
    assert.deepEqual(afterUnauthorizedPublish, beforeUnauthorizedPublish)
    const retainedDraft = await sql<{ checksum: string; document: unknown; version: number }>`
      select checksum, document, version from public.reusable_definition_drafts
      where definition_id = ${ids.characterDefinitionId}::uuid
    `.execute(db)
    assert.deepEqual(retainedDraft.rows[0], {
      checksum: stagedCharacterC.checksum,
      document: stagedCharacterC.document,
      version: stagedCharacterC.version
    })

    const encounterPort = () =>
      createEncounterRuleExecutionAggregatePort({
        encounterId: ids.encounterId,
        actorUserId: gm.id
      })
    const encounterStart = {
      commandId: randomUUID(),
      correlationId: null,
      expectedAggregateVersion: 0,
      definitionId: ids.encounterDefinitionId,
      facts: { 'actor.base': 5 }
    }
    const startedEncounterA = await occurrenceService.execute(encounterPort(), encounterStart)
    assert.equal(startedEncounterA.status, 'PAUSED')
    const publishedEncounterB = await publish(ids.encounterDefinitionId, 1, encounterB)
    const readsBeforeEncounterResume = counters.requireCurrent
    const resumeEncounterA = {
      commandId: randomUUID(),
      correlationId: null,
      expectedAggregateVersion: 1,
      occurrenceId: startedEncounterA.occurrenceId,
      expectedOccurrenceVersion: startedEncounterA.occurrenceVersion,
      response: { requestId: startedEncounterA.request.requestId, value: 7 }
    }
    const completedEncounterA = await occurrenceService.resume(encounterPort(), resumeEncounterA)
    assert.equal(outputValue(completedEncounterA), 13)
    assert.equal(
      requireComplete(completedEncounterA).evidence.source.checksum,
      publishedEncounterA.checksum
    )
    assert.equal(counters.requireCurrent, readsBeforeEncounterResume)
    const encounterResumeBeforeReplay = counters.resume
    assert.deepEqual(
      await occurrenceService.resume(encounterPort(), resumeEncounterA),
      completedEncounterA
    )
    assert.equal(counters.resume, encounterResumeBeforeReplay)
    const encounterBResult = await occurrenceService.execute(encounterPort(), {
      commandId: randomUUID(),
      correlationId: null,
      expectedAggregateVersion: 2,
      definitionId: ids.encounterDefinitionId,
      facts: { 'actor.base': 5 }
    })
    assert.equal(outputValue(encounterBResult), 105)
    assert.equal(
      requireComplete(encounterBResult).evidence.source.checksum,
      publishedEncounterB.checksum
    )

    const oldReadBlocker = createDb({
      connectionString: taggedConnectionString(options.connectionString, 'old-read-publish')
    })
    const oldReadHeld = deferred<number>()
    const releaseOldRead = deferred()
    const oldReadLock = oldReadBlocker.transaction().execute(async (trx) => {
      await sql`select id from public.content_sources where id = ${ids.contentSourceId}::uuid for update`.execute(
        trx
      )
      const pid = await sql<{ pid: number }>`select pg_backend_pid() as pid`.execute(trx)
      oldReadHeld.resolve(Number(pid.rows[0]?.pid))
      await releaseOldRead.promise
    })
    try {
      const oldReadBlockerPid = await oldReadHeld.promise
      const pendingCharacterCPublish = publishStaged(
        ids.characterDefinitionId,
        2,
        stagedCharacterC.version
      )
      await waitForDatabaseLockWait(db, oldReadBlockerPid)
      const oldCurrentExecution = await occurrenceService.execute(characterPort(), {
        commandId: randomUUID(),
        correlationId: null,
        expectedAggregateVersion: 3,
        definitionId: ids.characterDefinitionId,
        facts: { 'actor.base': 3 }
      })
      assert.equal(outputValue(oldCurrentExecution), 103)
      assert.equal(
        requireComplete(oldCurrentExecution).evidence.source.checksum,
        publishedCharacterB.checksum
      )
      releaseOldRead.resolve()
      const publishedCharacterC = await pendingCharacterCPublish
      assert.equal(publishedCharacterC.version, 3)
    } finally {
      releaseOldRead.resolve()
      await oldReadLock
      await oldReadBlocker.destroy()
    }
    assert.equal(await requireVersion(db, 'characters', ids.characterId), 4)

    const stagedCharacterD = await stageDraft(ids.characterDefinitionId, 3, characterD)
    const newReadBlocker = createDb({
      connectionString: taggedConnectionString(options.connectionString, 'new-read-publish')
    })
    const queuedReader = createDb({
      connectionString: taggedConnectionString(options.connectionString, 'new-read-reader')
    })
    const newReadHeld = deferred<number>()
    const releaseNewRead = deferred()
    const advisoryLockName = `rule-live-update-publish-${ids.characterDefinitionId}`
    const newReadLock = newReadBlocker.transaction().execute(async (trx) => {
      await sql`select pg_advisory_xact_lock(hashtextextended(${advisoryLockName}, 0))`.execute(trx)
      const pid = await sql<{ pid: number }>`select pg_backend_pid() as pid`.execute(trx)
      newReadHeld.resolve(Number(pid.rows[0]?.pid))
      await releaseNewRead.promise
    })
    try {
      const newReadBlockerPid = await newReadHeld.promise
      beforeCurrentRead = async (definitionId) => {
        if (definitionId !== ids.characterDefinitionId) return
        await queuedReader
          .transaction()
          .execute((trx) =>
            sql`select pg_advisory_xact_lock(hashtextextended(${advisoryLockName}, 0))`.execute(trx)
          )
      }
      const queuedNewCurrentExecution = occurrenceService.execute(characterPort(), {
        commandId: randomUUID(),
        correlationId: null,
        expectedAggregateVersion: 4,
        definitionId: ids.characterDefinitionId,
        facts: { 'actor.base': 3 }
      })
      await waitForDatabaseLockWait(db, newReadBlockerPid)
      const publishedCharacterD = await publishStaged(
        ids.characterDefinitionId,
        3,
        stagedCharacterD.version
      )
      releaseNewRead.resolve()
      const newCurrentExecution = await queuedNewCurrentExecution
      assert.equal(outputValue(newCurrentExecution), 303)
      assert.equal(
        requireComplete(newCurrentExecution).evidence.source.checksum,
        publishedCharacterD.checksum
      )
    } finally {
      beforeCurrentRead = null
      releaseNewRead.resolve()
      await newReadLock
      await Promise.all([newReadBlocker.destroy(), queuedReader.destroy()])
    }
    assert.equal(await requireVersion(db, 'characters', ids.characterId), 5)

    await sql`
      insert into public.reusable_definitions (
        id, game_system_id, content_source_id, definition_family_key, label
      ) values (
        ${ids.rollbackDefinitionId}::uuid, ${ids.systemId}::uuid, ${ids.contentSourceId}::uuid,
        ${RULE_RUNTIME_GRAPH_FAMILY_KEY}, 'Rule live-update rollback definition'
      )
    `.execute(db)
    const rollbackBeforeDocument = currentGraph({
      definitionId: ids.rollbackDefinitionId,
      gameSystemId: ids.systemId,
      increment: 10
    })
    const rollbackAfterDocument = currentGraph({
      definitionId: ids.rollbackDefinitionId,
      gameSystemId: ids.systemId,
      increment: 20
    })
    const rollbackPublished = await publish(ids.rollbackDefinitionId, 0, rollbackBeforeDocument)
    const rollbackBefore = await repository.requireCurrent(ids.rollbackDefinitionId)
    await assert.rejects(
      withTransaction(db, async (trx) => {
        const rollbackRepository = createReusableDefinitionRepository(trx)
        const rollbackService = createReusableDefinitionService({
          store: rollbackRepository,
          capabilities: [capability(ids.systemId)]
        })
        const draft = await rollbackService.saveDraft({
          definitionId: ids.rollbackDefinitionId,
          actorUserId: gm.id,
          expectedDefinitionVersion: rollbackPublished.version,
          expectedDraftVersion: null,
          document: rollbackAfterDocument
        })
        await rollbackService.publishDraft({
          definitionId: ids.rollbackDefinitionId,
          actorUserId: gm.id,
          expectedDefinitionVersion: rollbackPublished.version,
          expectedDraftVersion: draft.version
        })
        throw new Error('RULE_LIVE_UPDATE_PROOF_ROLLBACK')
      }),
      /RULE_LIVE_UPDATE_PROOF_ROLLBACK/
    )
    const rollbackAfter = await repository.requireCurrent(ids.rollbackDefinitionId)
    assert.deepEqual(rollbackAfter, rollbackBefore)
    const rollbackDraft = await sql<{ count: string }>`
      select count(*)::text as count from public.reusable_definition_drafts
      where definition_id = ${ids.rollbackDefinitionId}::uuid
    `.execute(db)
    assert.equal(rollbackDraft.rows[0]?.count, '0')

    console.log(
      JSON.stringify({
        proof: 'rule-definition-live-updates',
        result: 'PASS',
        runId: options.runId,
        schedules: {
          authorization: 'verified',
          characterCurrentAndFrozen: 'verified',
          deterministicOldAndNewCurrentSchedules: 'verified',
          encounterCurrentAndFrozen: 'verified',
          receiptReplayAfterPublish: 'verified',
          rollback: 'verified'
        }
      })
    )
  } catch (error) {
    runError = error
  } finally {
    await captureCleanup(() =>
      sql`delete from public.campaigns where id = ${ids.campaignId}::uuid`.execute(db)
    )
    await captureCleanup(() =>
      sql`delete from public.authored_route_ids where subject_kind = 'CAMPAIGN' and subject_id = ${ids.campaignId}::uuid`.execute(
        db
      )
    )
    await captureCleanup(() =>
      sql`delete from public.characters where id = ${ids.characterId}::uuid`.execute(db)
    )
    await captureCleanup(() =>
      sql`delete from public.reusable_definitions where content_source_id = ${ids.contentSourceId}::uuid`.execute(
        db
      )
    )
    await captureCleanup(() =>
      sql`delete from public.rules_catalogues where id = ${ids.catalogueId}::uuid`.execute(db)
    )
    await captureCleanup(() =>
      sql`delete from public.content_sources where id = ${ids.contentSourceId}::uuid`.execute(db)
    )
    await captureCleanup(() =>
      sql`delete from public.rule_pack_revisions where id = ${ids.rulePackRevisionId}::uuid`.execute(
        db
      )
    )
    await captureCleanup(() =>
      sql`delete from public.rule_packs where id = ${ids.rulePackId}::uuid`.execute(db)
    )
    await captureCleanup(() =>
      sql`delete from public.systems where id = ${ids.systemId}::uuid`.execute(db)
    )
    for (const user of createdUsers) {
      await captureCleanup(async () => {
        const { error } = await admin.auth.admin.deleteUser(user.id)
        if (error) throw error
      })
    }
    await captureCleanup(async () => {
      const trackedDefinitions = [
        ids.characterDefinitionId,
        ids.encounterDefinitionId,
        ids.rollbackDefinitionId
      ]
      for (const [table, column, trackedIds] of [
        ['public.characters', 'id', [ids.characterId]],
        ['public.encounters', 'id', [ids.encounterId]],
        ['public.character_rule_occurrences', 'character_id', [ids.characterId]],
        ['public.encounter_rule_occurrences', 'encounter_id', [ids.encounterId]],
        ['public.character_events', 'character_id', [ids.characterId]],
        ['public.encounter_events', 'encounter_id', [ids.encounterId]],
        ['public.reusable_definitions', 'id', trackedDefinitions],
        ['public.rules_catalogues', 'id', [ids.catalogueId]],
        ['public.content_sources', 'id', [ids.contentSourceId]],
        ['public.systems', 'id', [ids.systemId]],
        ['auth.users', 'id', createdUsers.map((user) => user.id)],
        ['public.profiles', 'id', createdUsers.map((user) => user.id)]
      ] as const) {
        assert.equal(
          await countRows(db, table, column, trackedIds),
          0,
          `${table} cleanup was incomplete.`
        )
      }
    })
    await db.destroy()
  }
  if (runError) throw runError
  if (cleanupError) throw cleanupError
}
