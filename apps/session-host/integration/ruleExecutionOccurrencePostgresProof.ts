import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import {
  createDb,
  createLiveSessionCommandLeaseRepository,
  type DBLike
} from '@artificer-toolkit/db'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { sql } from 'kysely'

import { lockCharacterAssignmentAuthority } from '../../../packages/functions/src/services/character/characterAssignmentAuthority.js'
import {
  createCharacterRuleExecutionAggregatePort,
  createEncounterRuleExecutionAggregatePort,
  createRuleExecutionOccurrenceService
} from '../../../packages/functions/src/services/rules/ruleExecutionOccurrenceService.js'
import {
  createRulesRuntimeService,
  type RulesRuntimeService
} from '../../../packages/functions/src/services/rules/rulesRuntimeService.js'

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', 'host.docker.internal'])

interface DisposableUser {
  id: string
}

interface Deferred<T = void> {
  promise: Promise<T>
  resolve(value: T): void
}

interface RuntimeCounter {
  execute: number
  resume: number
}

export interface RuleExecutionOccurrencePostgresProofOptions {
  connectionString: string
  runId: string
  supabaseSecretKey: string
  supabaseUrl: string
}

function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((currentResolve) => {
    resolve = currentResolve
  })
  return { promise, resolve }
}

function requireLoopback(name: string, value: string): void {
  const host = new URL(value).hostname.toLowerCase()
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`${name} must use a loopback host; received "${host}".`)
  }
}

async function createDisposableUser(
  admin: ReturnType<typeof createClient>['auth']['admin'],
  runId: string,
  role: string
): Promise<DisposableUser> {
  const { data, error } = await admin.createUser({
    email: `rule-occurrence-${role}-${runId}@example.test`,
    email_confirm: true,
    password: `Local-${randomUUID()}-Aa1!`,
    user_metadata: {
      username: `occurrence${role}${runId.replaceAll('-', '').slice(0, 10)}`
    }
  })
  if (error) throw error
  if (!data.user) throw new Error(`Supabase did not create the ${role} proof user.`)
  return { id: data.user.id }
}

function createProofRuntime(input: { definitionId: string; gameSystemId: string }): {
  counter: RuntimeCounter
  runtime: RulesRuntimeService
} {
  const definition = {
    schemaVersion: 1 as const,
    id: input.definitionId,
    gameSystemId: input.gameSystemId,
    definitionFamilyKey: 'occurrence-proof',
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
        id: 'second-roll',
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
          right: { kind: 'NODE_OUTPUT', nodeId: 'second-roll', port: 'value' }
        }
      }
    ],
    outputs: {
      value: { kind: 'NODE_OUTPUT', nodeId: 'result', port: 'value' }
    }
  } as const
  const checksum = checksumRuleDocument(definition)
  const base = createRulesRuntimeService({
    capabilities: [
      {
        gameSystemId: input.gameSystemId,
        contractVersion: 1,
        authoredRootKinds: ['action'],
        definitionFamilyKeys: ['occurrence-proof'],
        factContracts: [{ key: 'actor.base', valueKind: 'NUMBER' }],
        operationContracts: [
          { key: 'number.add', contractVersion: 1 },
          { key: 'evidence.integer-range', contractVersion: 1 }
        ]
      }
    ],
    continuationIntegrityKey: new TextEncoder().encode('local-rule-occurrence-proof-integrity-key'),
    definitions: {
      async requireCurrent(definitionId) {
        if (definitionId !== input.definitionId) throw new Error('Proof definition is unavailable.')
        return {
          id: input.definitionId,
          gameSystemId: input.gameSystemId,
          definitionFamilyKey: 'occurrence-proof',
          checksum,
          definition
        }
      }
    }
  })
  const counter: RuntimeCounter = { execute: 0, resume: 0 }
  return {
    counter,
    runtime: {
      async execute(candidate) {
        counter.execute += 1
        return base.execute(candidate)
      },
      async executeResolved(candidate) {
        counter.execute += 1
        return base.executeResolved(candidate)
      },
      async executeFrozen(candidate) {
        counter.execute += 1
        return base.executeFrozen(candidate)
      },
      async resume(candidate) {
        counter.resume += 1
        return base.resume(candidate)
      }
    }
  }
}

async function countRows(db: DBLike, table: string, column: string, ids: readonly string[]) {
  if (ids.length === 0) return 0
  const literals = ids.map((id) => `'${id}'::uuid`).join(', ')
  const result = await sql<{
    count: string
  }>`select 0::bigint as count`.execute(db)
  const counted = await sql
    .raw<{
      count: string
    }>(`select count(*)::text as count from ${table} where ${column} in (${literals})`)
    .execute(db)
  assert.equal(result.rows[0]?.count, '0')
  return Number(counted.rows[0]?.count ?? 0)
}

async function requireVersion(
  db: DBLike,
  table: 'characters' | 'encounters',
  id: string
): Promise<number> {
  const versionColumn = table === 'characters' ? 'stream_version' : 'version'
  const result = await sql
    .raw<{
      version: number
    }>(`select ${versionColumn} as version from public.${table} where id = '${id}'::uuid`)
    .execute(db)
  const version = result.rows[0]?.version
  assert.notEqual(version, undefined, `${table} fixture is unavailable.`)
  return Number(version)
}

async function waitForDatabaseLockWait(db: DBLike, blockerPid: number): Promise<void> {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const waiting = await sql<{ waiting: boolean }>`
      select exists (
        select 1
        from pg_catalog.pg_stat_activity
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

function receiptTable(aggregate: 'CHARACTER' | 'ENCOUNTER'): string {
  return aggregate === 'CHARACTER'
    ? 'public.character_rule_receipts'
    : 'public.encounter_rule_receipts'
}

function legacyEventTable(aggregate: 'CHARACTER' | 'ENCOUNTER'): string {
  return aggregate === 'CHARACTER' ? 'public.character_events' : 'public.encounter_events'
}

function aggregateColumn(aggregate: 'CHARACTER' | 'ENCOUNTER'): string {
  return aggregate === 'CHARACTER' ? 'character_id' : 'encounter_id'
}

async function requireReceiptCount(
  db: DBLike,
  aggregate: 'CHARACTER' | 'ENCOUNTER',
  aggregateId: string,
  commandId: string,
  expected: number
): Promise<void> {
  const table = receiptTable(aggregate)
  const aggregateIdColumn = aggregateColumn(aggregate)
  const result = await sql
    .raw<{
      count: string
    }>(
      `select count(*)::text as count from ${table} where ${aggregateIdColumn} = '${aggregateId}'::uuid and command_id = '${commandId}'::uuid`
    )
    .execute(db)
  assert.equal(Number(result.rows[0]?.count ?? 0), expected)
}

async function assertNoLegacyDomainEvent(
  db: DBLike,
  aggregate: 'CHARACTER' | 'ENCOUNTER',
  aggregateId: string,
  commandId: string
): Promise<void> {
  const table = legacyEventTable(aggregate)
  const aggregateIdColumn = aggregateColumn(aggregate)
  const result = await sql
    .raw<{
      count: string
    }>(
      `select count(*)::text as count from ${table} where ${aggregateIdColumn} = '${aggregateId}'::uuid and command_id = '${commandId}'::uuid`
    )
    .execute(db)
  assert.equal(result.rows[0]?.count, '0')
}

async function assertNoRuleCommandWrite(
  db: DBLike,
  aggregate: 'CHARACTER' | 'ENCOUNTER',
  aggregateId: string,
  commandId: string
): Promise<void> {
  await requireReceiptCount(db, aggregate, aggregateId, commandId, 0)
  await assertNoLegacyDomainEvent(db, aggregate, aggregateId, commandId)
}

async function assertBrowserRoleDenied(db: DBLike, role: 'anon' | 'authenticated'): Promise<void> {
  await assert.rejects(
    db.transaction().execute(async (trx) => {
      await sql.raw(`set local role ${role}`).execute(trx)
      await sql`select id from public.character_rule_occurrences limit 1`.execute(trx)
    })
  )
  await assert.rejects(
    db.transaction().execute(async (trx) => {
      await sql.raw(`set local role ${role}`).execute(trx)
      await sql`select id from public.encounter_rule_occurrences limit 1`.execute(trx)
    })
  )
  await assert.rejects(
    db.transaction().execute(async (trx) => {
      await sql.raw(`set local role ${role}`).execute(trx)
      await sql`select id from public.character_rule_receipts limit 1`.execute(trx)
    })
  )
  await assert.rejects(
    db.transaction().execute(async (trx) => {
      await sql.raw(`set local role ${role}`).execute(trx)
      await sql`select id from public.encounter_rule_receipts limit 1`.execute(trx)
    })
  )
}

async function installReceiptFailureTrigger(db: DBLike, commandId: string, suffix: string) {
  const functionName = `rule_occurrence_proof_fail_${suffix}`
  const triggerName = `rule_occurrence_proof_fail_${suffix}`
  await sql
    .raw(
      `
    create function public.${functionName}() returns trigger
    language plpgsql set search_path = pg_catalog, public as $$
    begin
      if new.command_id = '${commandId}'::uuid then
        raise exception 'RULE_OCCURRENCE_PROOF_LATE_FAILURE';
      end if;
      return new;
    end;
    $$;
    create trigger ${triggerName}
      before insert on public.character_rule_receipts
      for each row execute function public.${functionName}();
  `
    )
    .execute(db)
  return async () => {
    await sql
      .raw(
        `drop trigger if exists ${triggerName} on public.character_rule_receipts; drop function if exists public.${functionName}();`
      )
      .execute(db)
  }
}

export async function proveRuleExecutionOccurrencePostgresSemantics(
  options: RuleExecutionOccurrencePostgresProofOptions
): Promise<void> {
  requireLoopback('DATABASE_CONNECTION_STRING', options.connectionString)
  requireLoopback('SUPABASE_URL', options.supabaseUrl)
  const db = createDb({ connectionString: options.connectionString })
  const admin = createClient(options.supabaseUrl, options.supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  })
  const ids = {
    campaignId: randomUUID(),
    characterId: randomUUID(),
    characterDefinitionId: randomUUID(),
    encounterDefinitionId: randomUUID(),
    encounterId: randomUUID(),
    encounterBlueprintId: randomUUID(),
    encounterBlueprintCommandId: randomUUID(),
    otherCampaignId: randomUUID(),
    rulesCatalogueId: randomUUID(),
    rulePackId: randomUUID(),
    rulePackRevisionId: randomUUID(),
    sessionId: randomUUID(),
    systemId: randomUUID()
  }
  const createdUsers: DisposableUser[] = []
  const createdCampaignIds: string[] = []
  let dropFailureTrigger: (() => Promise<void>) | null = null
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
      insert into public.systems (
        id, user_id, label, ruleset_code, ruleset_version
      ) values (
        ${ids.systemId}::uuid, ${gm.id}::uuid, 'Rule occurrence proof System',
        'occurrence-proof', '1'
      )
    `.execute(db)
    const gameSystemId = ids.systemId
    await sql`
      insert into public.rules_catalogues (id, game_system_id, code, label)
      values (
        ${ids.rulesCatalogueId}::uuid, ${gameSystemId}::uuid,
        ${`occurrence-proof-${options.runId}`}, 'Rule occurrence proof catalogue'
      )
    `.execute(db)
    await sql`
      insert into public.rule_packs (id, ruleset_code, version)
      values (${ids.rulePackId}::uuid, ${`occurrence-proof-${options.runId}`}, '1')
    `.execute(db)
    await sql`
      insert into public.rule_pack_revisions (
        id, rule_pack_id, revision, document, checksum, created_by
      ) values (
        ${ids.rulePackRevisionId}::uuid, ${ids.rulePackId}::uuid, 1,
        '{}'::jsonb, ${'b'.repeat(64)}, ${gm.id}::uuid
      )
    `.execute(db)
    await sql`
      insert into public.characters (
        id, system_id, primary_rules_catalogue_id, user_id, label, status,
        rule_pack_revision_id, stream_version
      ) values (
        ${ids.characterId}::uuid, ${gameSystemId}::uuid,
        ${ids.rulesCatalogueId}::uuid, ${player.id}::uuid,
        ${`Rule occurrence proof ${options.runId}`}, 'ACTIVE',
        ${ids.rulePackRevisionId}::uuid, 0
      )
    `.execute(db)

    await sql`
      insert into public.campaigns (
        id, owner_user_id, game_system_id, primary_rules_catalogue_id,
        name, format, tone_tags, content_maturity
      ) values
        (
          ${ids.campaignId}::uuid, ${gm.id}::uuid, ${gameSystemId}::uuid,
          ${ids.rulesCatalogueId}::uuid,
          ${`Rule occurrence proof ${options.runId}`}, 'ONE_SHOT',
          array['HEROIC']::text[], 'STANDARD'
        ),
        (
          ${ids.otherCampaignId}::uuid, ${gm.id}::uuid, ${gameSystemId}::uuid,
          ${ids.rulesCatalogueId}::uuid,
          ${`Rule occurrence proof alternate ${options.runId}`}, 'ONE_SHOT',
          array['HEROIC']::text[], 'STANDARD'
        )
    `.execute(db)
    createdCampaignIds.push(ids.campaignId, ids.otherCampaignId)
    await sql`
      insert into public.authored_route_ids (subject_kind, subject_id)
      values
        ('CAMPAIGN', ${ids.campaignId}::uuid),
        ('CAMPAIGN', ${ids.otherCampaignId}::uuid)
    `.execute(db)
    await sql`
      insert into public.campaign_memberships (campaign_id, user_id, role, status)
      values
        (${ids.campaignId}::uuid, ${gm.id}::uuid, 'OWNER', 'ACTIVE'),
        (${ids.otherCampaignId}::uuid, ${gm.id}::uuid, 'OWNER', 'ACTIVE'),
        (${ids.campaignId}::uuid, ${player.id}::uuid, 'PLAYER', 'ACTIVE')
    `.execute(db)
    await sql`
      insert into public.campaign_play_settings (campaign_id)
      values (${ids.campaignId}::uuid), (${ids.otherCampaignId}::uuid)
    `.execute(db)
    await sql`
      insert into public.campaign_sessions (
        id, campaign_id, session_number, title, status
      ) values (
        ${ids.sessionId}::uuid, ${ids.campaignId}::uuid, 1,
        'Rule occurrence proof session', 'OPEN'
      )
    `.execute(db)
    const campaign = { id: ids.campaignId }
    const otherCampaign = { id: ids.otherCampaignId }
    const session = { id: ids.sessionId }
    await sql`
      insert into public.encounter_blueprints (
        id, owner_user_id, game_system_id, command_id, command_fingerprint, name, setup_checksum, enemies
      ) values (
        ${ids.encounterBlueprintId}::uuid, ${gm.id}::uuid, ${gameSystemId}::uuid,
        ${ids.encounterBlueprintCommandId}::uuid, ${'a'.repeat(64)},
        'Rule occurrence proof Blueprint', ${'b'.repeat(64)},
        ${JSON.stringify([{ kind: 'CUSTOM', label: 'Proof target', maxHitPoints: 1 }])}::jsonb
      )
    `.execute(db)
    await sql`
      insert into public.encounters (
        id, campaign_id, session_id, game_system_id, blueprint_id, blueprint_version, blueprint_checksum, name
      ) values (
        ${ids.encounterId}::uuid, ${campaign.id}::uuid, ${session.id}::uuid,
        ${gameSystemId}::uuid, ${ids.encounterBlueprintId}::uuid, 1, ${'b'.repeat(64)}, 'Rule occurrence proof encounter'
      )
    `.execute(db)

    // Equivalent UUID spellings must map to one transaction-level advisory key.
    const lockHeld = deferred()
    const releaseLock = deferred()
    const firstDb = createDb({ connectionString: options.connectionString })
    const firstLock = firstDb.transaction().execute(async (trx) => {
      await sql`
        select pg_advisory_xact_lock(
          hashtextextended(
            'character-assignment-authority:' || ${ids.characterId.toUpperCase()}::uuid::text,
            0
          )
        )
      `.execute(trx)
      lockHeld.resolve()
      await releaseLock.promise
    })
    await lockHeld.promise
    const secondDb = createDb({ connectionString: options.connectionString })
    const blocked = await secondDb.transaction().execute((trx) =>
      sql<{ acquired: boolean }>`
        select pg_try_advisory_xact_lock(
          hashtextextended(
            'character-assignment-authority:' || ${ids.characterId.toLowerCase()}::uuid::text,
            0
          )
        ) as acquired
      `.execute(trx)
    )
    assert.equal(blocked.rows[0]?.acquired, false)
    releaseLock.resolve()
    await firstLock
    await Promise.all([firstDb.destroy(), secondDb.destroy()])

    const characterRuntime = createProofRuntime({
      definitionId: ids.characterDefinitionId,
      gameSystemId
    })
    const characterService = createRuleExecutionOccurrenceService({
      db,
      runtime: characterRuntime.runtime
    })
    const characterPort = () =>
      createCharacterRuleExecutionAggregatePort({
        characterId: ids.characterId,
        actorUserId: player.id
      })
    const startCommand = {
      commandId: randomUUID().toUpperCase(),
      correlationId: randomUUID().toUpperCase(),
      expectedAggregateVersion: 0,
      definitionId: ids.characterDefinitionId.toUpperCase(),
      facts: { 'actor.base': 3 }
    }
    const started = await characterService.execute(characterPort(), startCommand)
    assert.equal(started.status, 'PAUSED')
    assert.equal(await requireVersion(db, 'characters', ids.characterId), 0)
    await requireReceiptCount(db, 'CHARACTER', ids.characterId, startCommand.commandId, 1)
    await assertNoLegacyDomainEvent(db, 'CHARACTER', ids.characterId, startCommand.commandId)
    assert.deepEqual(
      await characterService.execute(characterPort(), {
        ...startCommand,
        commandId: startCommand.commandId.toLowerCase(),
        correlationId: startCommand.correlationId.toLowerCase(),
        definitionId: startCommand.definitionId.toLowerCase()
      }),
      started
    )
    assert.equal(characterRuntime.counter.execute, 1)
    await assert.rejects(
      characterService.execute(characterPort(), {
        ...startCommand,
        facts: { 'actor.base': 4 }
      })
    )
    assert.equal(characterRuntime.counter.execute, 1)

    const resumeCommands = [randomUUID(), randomUUID()].map((commandId) => ({
      commandId: commandId.toUpperCase(),
      correlationId: null,
      expectedAggregateVersion: 0,
      occurrenceId: started.occurrenceId.toUpperCase(),
      expectedOccurrenceVersion: started.occurrenceVersion,
      response: { requestId: started.request.requestId, value: 7 }
    }))
    const resumeResults = await Promise.allSettled(
      resumeCommands.map((command) => characterService.resume(characterPort(), command))
    )
    const fulfilled = resumeResults.find(
      (
        result
      ): result is PromiseFulfilledResult<Awaited<ReturnType<typeof characterService.resume>>> =>
        result.status === 'fulfilled'
    )
    const rejected = resumeResults.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    )
    assert.ok(fulfilled && rejected)
    assert.equal(fulfilled.value.status, 'PAUSED')
    assert.equal(characterRuntime.counter.resume, 1)
    assert.equal(await requireVersion(db, 'characters', ids.characterId), 0)
    const winningResumeCommand = resumeCommands[resumeResults.indexOf(fulfilled)]
    assert.ok(winningResumeCommand)
    assert.deepEqual(
      await characterService.resume(characterPort(), {
        ...winningResumeCommand,
        commandId: winningResumeCommand.commandId.toLowerCase(),
        occurrenceId: winningResumeCommand.occurrenceId.toLowerCase()
      }),
      fulfilled.value
    )
    assert.equal(characterRuntime.counter.resume, 1)
    await requireReceiptCount(db, 'CHARACTER', ids.characterId, winningResumeCommand.commandId, 1)
    await assertNoLegacyDomainEvent(
      db,
      'CHARACTER',
      ids.characterId,
      winningResumeCommand.commandId
    )
    const rePaused = fulfilled.value
    assert.equal(rePaused.status, 'PAUSED')
    const terminalResumeCommand = {
      commandId: randomUUID(),
      correlationId: null,
      expectedAggregateVersion: 0,
      occurrenceId: rePaused.occurrenceId,
      expectedOccurrenceVersion: rePaused.occurrenceVersion,
      response: { requestId: rePaused.request.requestId, value: 8 }
    }
    const terminalResult = await characterService.resume(characterPort(), terminalResumeCommand)
    assert.equal(terminalResult.status, 'COMPLETE')
    assert.equal(characterRuntime.counter.resume, 2)
    assert.equal(await requireVersion(db, 'characters', ids.characterId), 0)
    await requireReceiptCount(db, 'CHARACTER', ids.characterId, terminalResumeCommand.commandId, 1)
    await assertNoLegacyDomainEvent(
      db,
      'CHARACTER',
      ids.characterId,
      terminalResumeCommand.commandId
    )
    assert.deepEqual(
      await characterService.resume(characterPort(), terminalResumeCommand),
      terminalResult
    )
    assert.equal(characterRuntime.counter.resume, 2)
    await requireReceiptCount(db, 'CHARACTER', ids.characterId, terminalResumeCommand.commandId, 1)
    await assert.rejects(
      characterService.resume(characterPort(), {
        ...terminalResumeCommand,
        commandId: randomUUID(),
        expectedAggregateVersion: 0
      })
    )
    await assert.rejects(
      characterService.resume(characterPort(), {
        ...terminalResumeCommand,
        commandId: randomUUID(),
        expectedAggregateVersion: 1,
        expectedOccurrenceVersion: 0
      })
    )
    const terminal = await sql<{
      pending_snapshot: unknown
      state: string
      version: number
      expected_stream_version: number
    }>`
      select pending_snapshot, state, version, expected_stream_version
      from public.character_rule_occurrences
      where id = ${started.occurrenceId}::uuid
    `.execute(db)
    assert.deepEqual(terminal.rows[0], {
      pending_snapshot: null,
      state: 'COMPLETED',
      version: 2,
      expected_stream_version: 0
    })

    let appliedDomainEvents = 0
    const appliedRuntime = createProofRuntime({
      definitionId: ids.characterDefinitionId,
      gameSystemId
    })
    const characterCompletionApplicator = {
      async apply(input: {
        db: DBLike
        aggregate: {
          aggregateId: string
          actorUserId: string
        }
        occurrenceId: string
        commandId: string
        correlationId: string | null
        commandFingerprint: string
        proposedAggregateVersion: number
      }) {
        appliedDomainEvents += 1
        await sql`
          insert into public.character_events (
            event_id, character_id, event_type, event_data, schema_version, actor_id,
            command_id, command_fingerprint, stream_version, result_payload, correlation_id
          ) values (
            ${randomUUID()}::uuid, ${input.aggregate.aggregateId}::uuid,
            'CHARACTER_RULE_OUTCOME_APPLIED',
            ${JSON.stringify({
              type: 'CHARACTER_RULE_OUTCOME_APPLIED',
              eventId: randomUUID(),
              characterId: input.aggregate.aggregateId,
              occurredAt: new Date().toISOString(),
              actorId: input.aggregate.actorUserId,
              commandId: input.commandId,
              sourceCommandId: input.commandId,
              schemaVersion: 1,
              encounterId: ids.encounterId,
              occurrenceId: input.occurrenceId,
              committedStreamVersion: input.proposedAggregateVersion,
              outcome: 'HEAL',
              targetActorId: input.aggregate.aggregateId,
              requestedAmount: 1,
              appliedAmount: 1,
              beforeCurrentHitPoints: 0,
              afterCurrentHitPoints: 1,
              maximumHitPoints: 1
            })}::jsonb,
            1, ${input.aggregate.actorUserId}::uuid, ${input.commandId}::uuid,
            ${input.commandFingerprint}, ${input.proposedAggregateVersion},
            ${JSON.stringify({ application: 'domain-event' })}::jsonb, ${input.correlationId}::uuid
          )
        `.execute(input.db)
        return { kind: 'NONE' as const }
      }
    }
    const appliedService = createRuleExecutionOccurrenceService({
      db,
      runtime: appliedRuntime.runtime,
      completionApplicator: characterCompletionApplicator
    })
    const appliedStart = await appliedService.execute(characterPort(), {
      commandId: randomUUID(),
      correlationId: null,
      expectedAggregateVersion: 0,
      definitionId: ids.characterDefinitionId,
      facts: { 'actor.base': 4 }
    })
    assert.equal(appliedStart.status, 'PAUSED')
    assert.equal(await requireVersion(db, 'characters', ids.characterId), 0)
    const appliedRePause = await appliedService.resume(characterPort(), {
      commandId: randomUUID(),
      correlationId: null,
      expectedAggregateVersion: 0,
      occurrenceId: appliedStart.occurrenceId,
      expectedOccurrenceVersion: appliedStart.occurrenceVersion,
      response: { requestId: appliedStart.request.requestId, value: 9 }
    })
    assert.equal(appliedRePause.status, 'PAUSED')
    assert.equal(await requireVersion(db, 'characters', ids.characterId), 0)
    const appliedCompletionCommand = {
      commandId: randomUUID(),
      correlationId: null,
      expectedAggregateVersion: 0,
      occurrenceId: appliedRePause.occurrenceId,
      expectedOccurrenceVersion: appliedRePause.occurrenceVersion,
      response: { requestId: appliedRePause.request.requestId, value: 10 }
    }
    const appliedComplete = await appliedService.resume(characterPort(), appliedCompletionCommand)
    assert.equal(appliedComplete.status, 'COMPLETE')
    assert.equal(await requireVersion(db, 'characters', ids.characterId), 1)
    assert.equal(appliedDomainEvents, 1)
    await requireReceiptCount(
      db,
      'CHARACTER',
      ids.characterId,
      appliedCompletionCommand.commandId,
      1
    )
    assert.equal(
      await countRows(db, 'public.character_events', 'command_id', [
        appliedCompletionCommand.commandId
      ]),
      1
    )
    assert.deepEqual(
      await appliedService.resume(characterPort(), appliedCompletionCommand),
      appliedComplete
    )
    assert.equal(appliedRuntime.counter.resume, 2)
    assert.equal(appliedDomainEvents, 1)
    await requireReceiptCount(
      db,
      'CHARACTER',
      ids.characterId,
      appliedCompletionCommand.commandId,
      1
    )

    const rollbackCommandId = randomUUID()
    const rollbackOccurrenceId = randomUUID()
    const rollbackService = createRuleExecutionOccurrenceService({
      db,
      runtime: appliedRuntime.runtime,
      createOccurrenceId: () => rollbackOccurrenceId,
      completionApplicator: characterCompletionApplicator
    })
    const rollbackStarted = await rollbackService.execute(characterPort(), {
      commandId: randomUUID(),
      correlationId: null,
      expectedAggregateVersion: 1,
      definitionId: ids.characterDefinitionId,
      facts: { 'actor.base': 5 }
    })
    assert.equal(rollbackStarted.status, 'PAUSED')
    const rollbackRePaused = await rollbackService.resume(characterPort(), {
      commandId: randomUUID(),
      correlationId: null,
      expectedAggregateVersion: 1,
      occurrenceId: rollbackStarted.occurrenceId,
      expectedOccurrenceVersion: rollbackStarted.occurrenceVersion,
      response: { requestId: rollbackStarted.request.requestId, value: 11 }
    })
    assert.equal(rollbackRePaused.status, 'PAUSED')
    const rollbackEventCount = await countRows(db, 'public.character_events', 'character_id', [
      ids.characterId
    ])
    dropFailureTrigger = await installReceiptFailureTrigger(
      db,
      rollbackCommandId,
      randomUUID().replaceAll('-', '')
    )
    await assert.rejects(
      rollbackService.resume(characterPort(), {
        commandId: rollbackCommandId,
        correlationId: null,
        expectedAggregateVersion: 1,
        occurrenceId: rollbackRePaused.occurrenceId,
        expectedOccurrenceVersion: rollbackRePaused.occurrenceVersion,
        response: { requestId: rollbackRePaused.request.requestId, value: 12 }
      }),
      /RULE_OCCURRENCE_PROOF_LATE_FAILURE/
    )
    assert.equal(await requireVersion(db, 'characters', ids.characterId), 1)
    const rollbackOccurrence = await sql<{
      state: string
      version: number
      pending_snapshot: unknown
    }>`
      select state, version, pending_snapshot
      from public.character_rule_occurrences
      where id = ${rollbackOccurrenceId}::uuid
    `.execute(db)
    assert.equal(rollbackOccurrence.rows[0]?.state, 'PENDING')
    assert.equal(rollbackOccurrence.rows[0]?.version, rollbackRePaused.occurrenceVersion)
    assert.notEqual(rollbackOccurrence.rows[0]?.pending_snapshot, null)
    await requireReceiptCount(db, 'CHARACTER', ids.characterId, rollbackCommandId, 0)
    await assertNoLegacyDomainEvent(db, 'CHARACTER', ids.characterId, rollbackCommandId)
    assert.equal(
      await countRows(db, 'public.character_events', 'character_id', [ids.characterId]),
      rollbackEventCount
    )
    await dropFailureTrigger()
    dropFailureTrigger = null

    // Assignment insertion and inactive membership commit while a direct command is waiting.
    const assignmentLocked = deferred<number>()
    const releaseAssignment = deferred()
    const assignmentMutation = db.transaction().execute(async (trx) => {
      await lockCharacterAssignmentAuthority(trx, ids.characterId)
      await sql`
        insert into public.campaign_character_assignments (campaign_id, character_id, user_id)
        values (${campaign.id}::uuid, ${ids.characterId}::uuid, ${player.id}::uuid)
      `.execute(trx)
      await sql`
        update public.campaign_memberships
        set status = 'LEFT', left_at = now()
        where campaign_id = ${campaign.id}::uuid and user_id = ${player.id}::uuid
      `.execute(trx)
      const pid = await sql<{
        pid: number
      }>`select pg_backend_pid() as pid`.execute(trx)
      assignmentLocked.resolve(Number(pid.rows[0]?.pid))
      await releaseAssignment.promise
    })
    const assignmentBlockerPid = await assignmentLocked.promise
    const assignmentCommandId = randomUUID()
    const runtimeBeforeAssignment = characterRuntime.counter.execute
    const assignmentCommand = characterService.execute(characterPort(), {
      commandId: assignmentCommandId,
      correlationId: null,
      expectedAggregateVersion: 1,
      definitionId: ids.characterDefinitionId,
      facts: { 'actor.base': 6 }
    })
    await waitForDatabaseLockWait(db, assignmentBlockerPid)
    releaseAssignment.resolve()
    await assignmentMutation
    await assert.rejects(assignmentCommand)
    assert.equal(characterRuntime.counter.execute, runtimeBeforeAssignment)
    assert.equal(await requireVersion(db, 'characters', ids.characterId), 1)
    await assertNoRuleCommandWrite(db, 'CHARACTER', ids.characterId, assignmentCommandId)
    await sql`
      update public.campaign_memberships
      set status = 'ACTIVE', left_at = null, access_started_at = now()
      where campaign_id = ${campaign.id}::uuid and user_id = ${player.id}::uuid
    `.execute(db)

    // An archive committed while the assigned Character command waits is authoritative.
    const archiveLocked = deferred<number>()
    const releaseArchive = deferred()
    const archiveMutation = db.transaction().execute(async (trx) => {
      await sql`select id from public.campaigns where id = ${campaign.id}::uuid for update`.execute(
        trx
      )
      await sql`update public.campaigns set status = 'ARCHIVED' where id = ${campaign.id}::uuid`.execute(
        trx
      )
      const pid = await sql<{
        pid: number
      }>`select pg_backend_pid() as pid`.execute(trx)
      archiveLocked.resolve(Number(pid.rows[0]?.pid))
      await releaseArchive.promise
    })
    const archiveBlockerPid = await archiveLocked.promise
    const archiveCommandId = randomUUID()
    const runtimeBeforeArchive = characterRuntime.counter.execute
    const archiveCommand = characterService.execute(characterPort(), {
      commandId: archiveCommandId,
      correlationId: null,
      expectedAggregateVersion: 1,
      definitionId: ids.characterDefinitionId,
      facts: { 'actor.base': 7 }
    })
    await waitForDatabaseLockWait(db, archiveBlockerPid)
    releaseArchive.resolve()
    await archiveMutation
    await assert.rejects(archiveCommand)
    assert.equal(characterRuntime.counter.execute, runtimeBeforeArchive)
    await assertNoRuleCommandWrite(db, 'CHARACTER', ids.characterId, archiveCommandId)
    await sql`update public.campaigns set status = 'ACTIVE' where id = ${campaign.id}::uuid`.execute(
      db
    )

    // Membership removal committed under its row lock is revalidated before runtime.
    const membershipLocked = deferred<number>()
    const releaseMembership = deferred()
    const membershipMutation = db.transaction().execute(async (trx) => {
      await sql`
        select user_id from public.campaign_memberships
        where campaign_id = ${campaign.id}::uuid and user_id = ${player.id}::uuid
        for update
      `.execute(trx)
      await sql`
        update public.campaign_memberships
        set status = 'LEFT', left_at = now()
        where campaign_id = ${campaign.id}::uuid and user_id = ${player.id}::uuid
      `.execute(trx)
      const pid = await sql<{
        pid: number
      }>`select pg_backend_pid() as pid`.execute(trx)
      membershipLocked.resolve(Number(pid.rows[0]?.pid))
      await releaseMembership.promise
    })
    const membershipBlockerPid = await membershipLocked.promise
    const membershipCommandId = randomUUID()
    const runtimeBeforeMembership = characterRuntime.counter.execute
    const membershipCommand = characterService.execute(characterPort(), {
      commandId: membershipCommandId,
      correlationId: null,
      expectedAggregateVersion: 1,
      definitionId: ids.characterDefinitionId,
      facts: { 'actor.base': 8 }
    })
    await waitForDatabaseLockWait(db, membershipBlockerPid)
    releaseMembership.resolve()
    await membershipMutation
    await assert.rejects(membershipCommand)
    assert.equal(characterRuntime.counter.execute, runtimeBeforeMembership)
    await assertNoRuleCommandWrite(db, 'CHARACTER', ids.characterId, membershipCommandId)
    await sql`
      update public.campaign_memberships
      set status = 'ACTIVE', left_at = null, access_started_at = now()
      where campaign_id = ${campaign.id}::uuid and user_id = ${player.id}::uuid
    `.execute(db)

    // Assignment removal converts the GM command to an unauthorized direct command.
    const removalLocked = deferred<number>()
    const releaseRemoval = deferred()
    const assignmentRemoval = db.transaction().execute(async (trx) => {
      await lockCharacterAssignmentAuthority(trx, ids.characterId)
      await sql`
        delete from public.campaign_character_assignments where character_id = ${ids.characterId}::uuid
      `.execute(trx)
      const pid = await sql<{
        pid: number
      }>`select pg_backend_pid() as pid`.execute(trx)
      removalLocked.resolve(Number(pid.rows[0]?.pid))
      await releaseRemoval.promise
    })
    const removalBlockerPid = await removalLocked.promise
    const removalCommandId = randomUUID()
    const runtimeBeforeRemoval = characterRuntime.counter.execute
    const removalCommand = characterService.execute(
      createCharacterRuleExecutionAggregatePort({
        characterId: ids.characterId,
        actorUserId: gm.id
      }),
      {
        commandId: removalCommandId,
        correlationId: null,
        expectedAggregateVersion: 1,
        definitionId: ids.characterDefinitionId,
        facts: { 'actor.base': 9 }
      }
    )
    await waitForDatabaseLockWait(db, removalBlockerPid)
    releaseRemoval.resolve()
    await assignmentRemoval
    await assert.rejects(removalCommand)
    assert.equal(characterRuntime.counter.execute, runtimeBeforeRemoval)
    await assertNoRuleCommandWrite(db, 'CHARACTER', ids.characterId, removalCommandId)
    await sql`
      insert into public.campaign_character_assignments (campaign_id, character_id, user_id)
      values (${campaign.id}::uuid, ${ids.characterId}::uuid, ${player.id}::uuid)
    `.execute(db)

    // A controlling live-session lease rejects an unleased direct command.
    await sql`
      insert into public.campaign_session_attendance (session_id, campaign_id, character_id, present)
      values (${session.id}::uuid, ${campaign.id}::uuid, ${ids.characterId}::uuid, true)
    `.execute(db)
    const leaseAuthorityId = `rule-occurrence-proof-${options.runId}`
    const now = new Date()
    assert.equal(
      await createLiveSessionCommandLeaseRepository(db).claim({
        sessionId: session.id,
        authorityId: leaseAuthorityId,
        now: now.toISOString(),
        expiresAt: new Date(now.getTime() + 60_000).toISOString()
      }),
      true
    )
    const leaseCommandId = randomUUID()
    const runtimeBeforeLease = characterRuntime.counter.execute
    await assert.rejects(
      characterService.execute(characterPort(), {
        commandId: leaseCommandId,
        correlationId: null,
        expectedAggregateVersion: 1,
        definitionId: ids.characterDefinitionId,
        facts: { 'actor.base': 10 }
      })
    )
    assert.equal(characterRuntime.counter.execute, runtimeBeforeLease)
    await assertNoRuleCommandWrite(db, 'CHARACTER', ids.characterId, leaseCommandId)
    await createLiveSessionCommandLeaseRepository(db).release({
      sessionId: session.id,
      authorityId: leaseAuthorityId
    })
    await sql`
      delete from public.campaign_session_attendance
      where session_id = ${session.id}::uuid and character_id = ${ids.characterId}::uuid
    `.execute(db)

    const encounterRuntime = createProofRuntime({
      definitionId: ids.encounterDefinitionId,
      gameSystemId
    })
    const encounterService = createRuleExecutionOccurrenceService({
      db,
      runtime: encounterRuntime.runtime
    })
    const encounterPort = () =>
      createEncounterRuleExecutionAggregatePort({
        encounterId: ids.encounterId,
        actorUserId: gm.id
      })
    const encounterStartCommand = {
      commandId: randomUUID(),
      correlationId: null,
      expectedAggregateVersion: 0,
      definitionId: ids.encounterDefinitionId,
      facts: { 'actor.base': 11 }
    }
    const encounterStarted = await encounterService.execute(encounterPort(), encounterStartCommand)
    assert.equal(encounterStarted.status, 'PAUSED')
    assert.equal(await requireVersion(db, 'encounters', ids.encounterId), 0)
    await requireReceiptCount(db, 'ENCOUNTER', ids.encounterId, encounterStartCommand.commandId, 1)
    await assertNoLegacyDomainEvent(
      db,
      'ENCOUNTER',
      ids.encounterId,
      encounterStartCommand.commandId
    )
    assert.deepEqual(
      await encounterService.execute(encounterPort(), encounterStartCommand),
      encounterStarted
    )
    assert.equal(encounterRuntime.counter.execute, 1)
    const encounterRePaused = await encounterService.resume(encounterPort(), {
      commandId: randomUUID(),
      correlationId: null,
      expectedAggregateVersion: 0,
      occurrenceId: encounterStarted.occurrenceId,
      expectedOccurrenceVersion: encounterStarted.occurrenceVersion,
      response: { requestId: encounterStarted.request.requestId, value: 12 }
    })
    assert.equal(encounterRePaused.status, 'PAUSED')
    assert.equal(await requireVersion(db, 'encounters', ids.encounterId), 0)
    const encounterCompletionCommand = {
      commandId: randomUUID(),
      correlationId: null,
      expectedAggregateVersion: 0,
      occurrenceId: encounterRePaused.occurrenceId,
      expectedOccurrenceVersion: encounterRePaused.occurrenceVersion,
      response: { requestId: encounterRePaused.request.requestId, value: 13 }
    }
    const encounterCompleted = await encounterService.resume(
      encounterPort(),
      encounterCompletionCommand
    )
    assert.equal(encounterCompleted.status, 'COMPLETE')
    assert.equal(await requireVersion(db, 'encounters', ids.encounterId), 0)
    await requireReceiptCount(
      db,
      'ENCOUNTER',
      ids.encounterId,
      encounterCompletionCommand.commandId,
      1
    )
    await assertNoLegacyDomainEvent(
      db,
      'ENCOUNTER',
      ids.encounterId,
      encounterCompletionCommand.commandId
    )
    assert.deepEqual(
      await encounterService.resume(encounterPort(), encounterCompletionCommand),
      encounterCompleted
    )
    assert.equal(encounterRuntime.counter.resume, 2)
    await requireReceiptCount(
      db,
      'ENCOUNTER',
      ids.encounterId,
      encounterCompletionCommand.commandId,
      1
    )

    await assert.rejects(
      sql`
        insert into public.encounter_rule_occurrences (
          encounter_id, campaign_id, root_command_id, state,
          expected_encounter_version, pending_snapshot, completed_at
        ) values (
          ${ids.encounterId}::uuid, ${otherCampaign.id}::uuid, ${randomUUID()}::uuid,
          'COMPLETED', 0, null, now()
        )
      `.execute(db)
    )
    await assertBrowserRoleDenied(db, 'anon')
    await assertBrowserRoleDenied(db, 'authenticated')
    await assert.rejects(
      encounterService.execute(
        createEncounterRuleExecutionAggregatePort({
          encounterId: ids.encounterId,
          actorUserId: outsider.id
        }),
        {
          ...encounterStartCommand,
          commandId: randomUUID(),
          expectedAggregateVersion: 0
        }
      )
    )

    console.log(
      JSON.stringify({
        proof: 'rule-execution-occurrences',
        result: 'PASS',
        runId: options.runId,
        schedules: {
          advisoryUuidCanonicalization: 'verified',
          assignmentAndAuthorityRaces: 'verified',
          browserRoleDenial: 'verified',
          domainAppliedCompletion: 'verified',
          encounterOwnership: 'verified',
          lateRollback: 'verified',
          replayAndConcurrentResume: 'verified',
          separateRuleReceipts: 'verified',
          terminalSnapshotClearing: 'verified'
        }
      })
    )
  } catch (error) {
    runError = error
  } finally {
    if (dropFailureTrigger) await captureCleanup(dropFailureTrigger)
    await captureCleanup(() =>
      sql`
        delete from public.campaigns where id = any(${createdCampaignIds}::uuid[])
      `.execute(db)
    )
    await captureCleanup(() =>
      sql`
        delete from public.authored_route_ids
        where subject_kind = 'CAMPAIGN'
          and subject_id = any(${createdCampaignIds}::uuid[])
      `.execute(db)
    )
    await captureCleanup(() =>
      sql`delete from public.characters where id = ${ids.characterId}::uuid`.execute(db)
    )
    await captureCleanup(() =>
      sql`delete from public.encounter_blueprints where id = ${ids.encounterBlueprintId}::uuid`.execute(
        db
      )
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
      sql`delete from public.rules_catalogues where id = ${ids.rulesCatalogueId}::uuid`.execute(db)
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
      assert.equal(
        await countRows(db, 'public.campaigns', 'id', createdCampaignIds),
        0,
        'Campaign cleanup was incomplete.'
      )
      assert.equal(
        await countRows(db, 'public.authored_route_ids', 'subject_id', createdCampaignIds),
        0,
        'Campaign route cleanup was incomplete.'
      )
      assert.equal(
        await countRows(db, 'public.characters', 'id', [ids.characterId]),
        0,
        'Character cleanup was incomplete.'
      )
      assert.equal(
        await countRows(db, 'public.encounters', 'id', [ids.encounterId]),
        0,
        'Encounter cleanup was incomplete.'
      )
      for (const [table, column, trackedIds] of [
        ['public.campaign_memberships', 'campaign_id', createdCampaignIds],
        ['public.campaign_play_settings', 'campaign_id', createdCampaignIds],
        ['public.campaign_sessions', 'campaign_id', createdCampaignIds],
        ['public.encounter_blueprints', 'owner_user_id', createdUsers.map(({ id }) => id)],
        ['public.campaign_character_assignments', 'campaign_id', createdCampaignIds],
        ['public.campaign_session_attendance', 'campaign_id', createdCampaignIds],
        ['public.character_rule_occurrences', 'character_id', [ids.characterId]],
        ['public.character_rule_receipts', 'character_id', [ids.characterId]],
        ['public.character_events', 'character_id', [ids.characterId]],
        ['public.encounter_rule_occurrences', 'encounter_id', [ids.encounterId]],
        ['public.encounter_rule_receipts', 'encounter_id', [ids.encounterId]],
        ['public.encounter_events', 'encounter_id', [ids.encounterId]]
      ] as const) {
        assert.equal(
          await countRows(db, table, column, trackedIds),
          0,
          `${table} cleanup was incomplete.`
        )
      }
      assert.equal(
        await countRows(
          db,
          'auth.users',
          'id',
          createdUsers.map(({ id }) => id)
        ),
        0,
        'Auth cleanup was incomplete.'
      )
      assert.equal(
        await countRows(
          db,
          'public.profiles',
          'id',
          createdUsers.map(({ id }) => id)
        ),
        0,
        'Profile cleanup was incomplete.'
      )
      assert.equal(
        await countRows(db, 'public.systems', 'id', [ids.systemId]),
        0,
        'System cleanup was incomplete.'
      )
      assert.equal(
        await countRows(db, 'public.rules_catalogues', 'id', [ids.rulesCatalogueId]),
        0,
        'Rules catalogue cleanup was incomplete.'
      )
      assert.equal(
        await countRows(db, 'public.rule_pack_revisions', 'id', [ids.rulePackRevisionId]),
        0,
        'Rule-pack revision cleanup was incomplete.'
      )
      assert.equal(
        await countRows(db, 'public.rule_packs', 'id', [ids.rulePackId]),
        0,
        'Rule-pack cleanup was incomplete.'
      )
    })
    await db.destroy()
  }
  if (runError) throw runError
  if (cleanupError) throw cleanupError
}
