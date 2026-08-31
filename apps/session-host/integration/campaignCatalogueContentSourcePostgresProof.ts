import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import {
  createDb,
  createReusableDefinitionRepository,
  type DBLike,
  withTransaction
} from '@artificer-toolkit/db'
import {
  activateAuthoredDomainDraft,
  assignCampaignCharacter,
  authoredDomainConfigs,
  createReusableDefinitionService,
  duplicateAuthoredDomain,
  saveAuthoredDomainInputDraft,
  updateCampaign
} from '@artificer-toolkit/functions/services'
import { sql } from 'kysely'

const OPERATION_TIMEOUT_MS = 10_000
const CONTENTION_TIMEOUT_MS = 5_000

export interface CampaignCatalogueContentSourceProofOptions {
  additionalCatalogueIds: readonly string[]
  campaignId: string
  characterId: string
  connectionString: string
  gameSystemId: string
  otherContentSourceId: string
  otherCatalogueId: string
  otherSystemId: string
  ownerUserId: string
  playerUserId: string
  primaryCatalogueId: string
  proofOwned: {
    backgroundIds: string[]
    reusableDefinitionIds: string[]
    userContentSourceIds: string[]
  }
  secondaryCatalogueId: string
}

class ProofPlumbingError extends Error {}
type SqlError = { code?: unknown; message?: unknown }

function taggedConnectionString(connectionString: string, label: string): string {
  const url = new URL(connectionString)
  url.searchParams.set('application_name', `artificer-catalogue-proof-${label}`)
  return url.toString()
}

function createTaggedDb(connectionString: string, label: string) {
  return createDb({
    connectionString: taggedConnectionString(connectionString, label)
  })
}

async function withTimeout<T>(label: string, promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new ProofPlumbingError(`${label} exceeded ${OPERATION_TIMEOUT_MS} ms.`)),
          OPERATION_TIMEOUT_MS
        )
      })
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function sqlError(error: unknown): SqlError | null {
  return typeof error === 'object' && error !== null ? (error as SqlError) : null
}

async function expectSqlRejected(
  label: string,
  operation: Promise<unknown>,
  expected: { code: string; message: string }
): Promise<void> {
  try {
    await operation
    assert.fail(`${label} unexpectedly succeeded.`)
  } catch (error) {
    if (error instanceof assert.AssertionError) throw error
    const actual = sqlError(error)
    assert.equal(actual?.code, expected.code, `${label} SQLSTATE mismatch.`)
    assert.equal(actual?.message, expected.message, `${label} error message mismatch.`)
  }
}

async function expectDomainRejected(
  label: string,
  operation: Promise<unknown>,
  message: string
): Promise<void> {
  await assert.rejects(operation, { message }, label)
}

async function waitForLock(observer: DBLike, label: string): Promise<void> {
  const applicationName = `artificer-catalogue-proof-${label}`
  const deadline = Date.now() + CONTENTION_TIMEOUT_MS
  while (Date.now() < deadline) {
    const result = await sql<{ blocked: boolean }>`
      select exists (
        select 1 from pg_stat_activity
        where datname = current_database() and application_name = ${applicationName}
          and wait_event_type = 'Lock'
      ) as blocked
    `.execute(observer)
    if (result.rows[0]?.blocked) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new ProofPlumbingError(`${label} did not reach a PostgreSQL lock wait.`)
}

async function campaignState(db: DBLike, campaignId: string) {
  const row = await sql<{
    version: number
    primary: string
    additional: string[]
  }>`
    select campaign.version, campaign.primary_rules_catalogue_id as primary,
      coalesce(array_agg(additional.rules_catalogue_id order by additional.rules_catalogue_id)
        filter (where additional.rules_catalogue_id is not null), '{}'::uuid[]) as additional
    from public.campaigns campaign
    left join public.campaign_additional_rules_catalogues additional on additional.campaign_id = campaign.id
    where campaign.id = ${campaignId}::uuid
    group by campaign.id
  `.execute(db)
  const state = row.rows[0]
  assert.ok(state, 'Campaign fixture disappeared.')
  return state
}

async function proveServiceBinding(
  options: CampaignCatalogueContentSourceProofOptions
): Promise<void> {
  const db = createDb({ connectionString: options.connectionString })
  try {
    const initial = await campaignState(db, options.campaignId)
    assert.equal(initial.primary, options.primaryCatalogueId)
    assert.deepEqual(initial.additional, [options.secondaryCatalogueId])

    const swapped = await updateCampaign(db, options.ownerUserId, {
      campaignId: options.campaignId,
      expectedVersion: initial.version,
      primaryRulesCatalogueId: options.secondaryCatalogueId,
      additionalRulesCatalogueIds: [options.primaryCatalogueId]
    })
    assert.equal(swapped.primaryRulesCatalogueId, options.secondaryCatalogueId)
    assert.deepEqual(swapped.additionalRulesCatalogueIds, [options.primaryCatalogueId])
    const beforeStale = await campaignState(db, options.campaignId)
    await expectDomainRejected(
      'stale catalogue CAS',
      updateCampaign(db, options.ownerUserId, {
        campaignId: options.campaignId,
        expectedVersion: initial.version,
        primaryRulesCatalogueId: options.primaryCatalogueId,
        additionalRulesCatalogueIds: [options.secondaryCatalogueId]
      }),
      'Campaign changed before this action completed.'
    )
    assert.deepEqual(await campaignState(db, options.campaignId), beforeStale)

    await assignCampaignCharacter(db, options.playerUserId, options.campaignId, options.characterId)
    const assignedState = await campaignState(db, options.campaignId)
    await expectDomainRejected(
      'assigned Character catalogue removal',
      updateCampaign(db, options.ownerUserId, {
        campaignId: options.campaignId,
        expectedVersion: assignedState.version,
        additionalRulesCatalogueIds: []
      }),
      'Campaign Rules Catalogues cannot remove an assigned Character primary Rules Catalogue.'
    )
    assert.deepEqual(await campaignState(db, options.campaignId), assignedState)
    console.log(
      JSON.stringify({
        result: 'catalogue-service-cas-assignment',
        status: 'PASS'
      })
    )
  } finally {
    await db.destroy()
  }
}

async function proveTriggers(options: CampaignCatalogueContentSourceProofOptions): Promise<void> {
  const db = createDb({ connectionString: options.connectionString })
  const [first, second, ...rest] = options.additionalCatalogueIds
  assert.ok(
    first && second && rest.length >= 31,
    'Proof requires 33 disposable same-System catalogues.'
  )
  try {
    await sql`delete from public.campaign_additional_rules_catalogues where campaign_id = ${options.campaignId}::uuid`.execute(
      db
    )
    await sql`update public.campaigns set primary_rules_catalogue_id = ${options.primaryCatalogueId}::uuid where id = ${options.campaignId}::uuid`.execute(
      db
    )
    await sql`insert into public.campaign_additional_rules_catalogues (campaign_id, rules_catalogue_id, game_system_id) values (${options.campaignId}::uuid, ${first}::uuid, ${options.gameSystemId}::uuid)`.execute(
      db
    )
    await expectSqlRejected(
      'immutable additional catalogue',
      sql`update public.campaign_additional_rules_catalogues set rules_catalogue_id = ${second}::uuid where campaign_id = ${options.campaignId}::uuid and rules_catalogue_id = ${first}::uuid`.execute(
        db
      ),
      { code: 'P0001', message: 'Campaign additional Rules Catalogue ownership is immutable.' }
    )
    await expectSqlRejected(
      'primary as additional',
      sql`insert into public.campaign_additional_rules_catalogues (campaign_id, rules_catalogue_id, game_system_id) values (${options.campaignId}::uuid, ${options.primaryCatalogueId}::uuid, ${options.gameSystemId}::uuid)`.execute(
        db
      ),
      {
        code: 'P0001',
        message: 'Campaign primary Rules Catalogue must not be stored as an additional catalogue.'
      }
    )
    await expectSqlRejected(
      'additional as primary',
      sql`update public.campaigns set primary_rules_catalogue_id = ${first}::uuid where id = ${options.campaignId}::uuid`.execute(
        db
      ),
      {
        code: 'P0001',
        message: 'Campaign primary Rules Catalogue must not be stored as an additional catalogue.'
      }
    )
    await sql`delete from public.campaign_additional_rules_catalogues where campaign_id = ${options.campaignId}::uuid and rules_catalogue_id = ${first}::uuid`.execute(
      db
    )
    assert.equal((await campaignState(db, options.campaignId)).additional.length, 0)

    for (const catalogueId of rest.slice(0, 31)) {
      await sql`insert into public.campaign_additional_rules_catalogues (campaign_id, rules_catalogue_id, game_system_id) values (${options.campaignId}::uuid, ${catalogueId}::uuid, ${options.gameSystemId}::uuid)`.execute(
        db
      )
    }
    await expectSqlRejected(
      '32nd additional catalogue',
      sql`insert into public.campaign_additional_rules_catalogues (campaign_id, rules_catalogue_id, game_system_id) values (${options.campaignId}::uuid, ${second}::uuid, ${options.gameSystemId}::uuid)`.execute(
        db
      ),
      { code: 'P0001', message: 'Campaign may enable at most 31 additional Rules Catalogues.' }
    )
    console.log(
      JSON.stringify({
        result: 'catalogue-trigger-invariants',
        status: 'PASS'
      })
    )
  } finally {
    await db.destroy()
  }
}

async function proveBoundaryContention(
  options: CampaignCatalogueContentSourceProofOptions
): Promise<void> {
  const db = createDb({ connectionString: options.connectionString })
  const observer = createTaggedDb(options.connectionString, 'observer')
  const contenderA = createTaggedDb(options.connectionString, 'boundary-a')
  const contenderB = createTaggedDb(options.connectionString, 'boundary-b')
  const candidates = options.additionalCatalogueIds.slice(-2)
  let releaseA: (() => void) | undefined
  let a: Promise<void> | undefined
  let b: Promise<void> | undefined
  try {
    await sql`delete from public.campaign_additional_rules_catalogues where campaign_id = ${options.campaignId}::uuid`.execute(
      db
    )
    for (const catalogueId of options.additionalCatalogueIds.slice(0, 30)) {
      await sql`insert into public.campaign_additional_rules_catalogues (campaign_id, rules_catalogue_id, game_system_id) values (${options.campaignId}::uuid, ${catalogueId}::uuid, ${options.gameSystemId}::uuid)`.execute(
        db
      )
    }
    let resolveAInserted: (() => void) | undefined
    const aInserted = new Promise<void>((resolve) => {
      resolveAInserted = resolve
    })
    a = contenderA.transaction().execute(async (trx) => {
      await sql`insert into public.campaign_additional_rules_catalogues (campaign_id, rules_catalogue_id, game_system_id) values (${options.campaignId}::uuid, ${candidates[0]!}::uuid, ${options.gameSystemId}::uuid)`.execute(
        trx
      )
      resolveAInserted?.()
      await new Promise<void>((resolve) => {
        releaseA = resolve
      })
    })
    void a.catch(() => undefined)
    await withTimeout('31st catalogue insertion', aInserted)
    b = contenderB.transaction().execute(async (trx) => {
      await sql`insert into public.campaign_additional_rules_catalogues (campaign_id, rules_catalogue_id, game_system_id) values (${options.campaignId}::uuid, ${candidates[1]!}::uuid, ${options.gameSystemId}::uuid)`.execute(
        trx
      )
    })
    void b.catch(() => undefined)
    await waitForLock(observer, 'boundary-b')
    releaseA?.()
    const results = await withTimeout('31st/32nd settlement', Promise.allSettled([a, b]))
    assert.equal(results[0]?.status, 'fulfilled')
    assert.equal(results[1]?.status, 'rejected')
    if (results[1]?.status === 'rejected') {
      const error = sqlError(results[1].reason)
      assert.equal(error?.code, 'P0001')
      assert.equal(error?.message, 'Campaign may enable at most 31 additional Rules Catalogues.')
    }
    assert.equal((await campaignState(db, options.campaignId)).additional.length, 31)
    console.log(
      JSON.stringify({
        result: 'catalogue-boundary-serialization',
        status: 'PASS'
      })
    )
  } finally {
    releaseA?.()
    await Promise.allSettled([a ?? Promise.resolve(), b ?? Promise.resolve()])
    await Promise.allSettled([
      db.destroy(),
      observer.destroy(),
      contenderA.destroy(),
      contenderB.destroy()
    ])
  }
}

async function provePrimaryAdditionalRace(
  options: CampaignCatalogueContentSourceProofOptions
): Promise<void> {
  const db = createDb({ connectionString: options.connectionString })
  const observer = createTaggedDb(options.connectionString, 'primary-race-observer')
  const primaryWriter = createTaggedDb(options.connectionString, 'primary-race-primary')
  const additionalWriter = createTaggedDb(options.connectionString, 'primary-race-additional')
  const contender = options.additionalCatalogueIds.at(-1)
  assert.ok(contender, 'Proof requires a primary/additional race catalogue.')
  let releasePrimary: (() => void) | undefined
  let resolvePrimaryLocked: (() => void) | undefined
  const primaryLocked = new Promise<void>((resolve) => {
    resolvePrimaryLocked = resolve
  })
  let primary: Promise<void> | undefined
  let additional: Promise<void> | undefined
  try {
    await sql`delete from public.campaign_additional_rules_catalogues where campaign_id = ${options.campaignId}::uuid`.execute(
      db
    )
    await sql`update public.campaigns set primary_rules_catalogue_id = ${options.primaryCatalogueId}::uuid where id = ${options.campaignId}::uuid`.execute(
      db
    )
    primary = primaryWriter.transaction().execute(async (trx) => {
      await sql`select id from public.campaigns where id = ${options.campaignId}::uuid for update`.execute(
        trx
      )
      resolvePrimaryLocked?.()
      await new Promise<void>((resolve) => {
        releasePrimary = resolve
      })
      await sql`update public.campaigns set primary_rules_catalogue_id = ${contender}::uuid where id = ${options.campaignId}::uuid`.execute(
        trx
      )
    })
    void primary.catch(() => undefined)
    await withTimeout('primary race lock acquisition', primaryLocked)
    additional = additionalWriter.transaction().execute(async (trx) => {
      await sql`insert into public.campaign_additional_rules_catalogues (campaign_id, rules_catalogue_id, game_system_id) values (${options.campaignId}::uuid, ${contender}::uuid, ${options.gameSystemId}::uuid)`.execute(
        trx
      )
    })
    void additional.catch(() => undefined)
    await waitForLock(observer, 'primary-race-additional')
    releasePrimary?.()
    const settled = await withTimeout(
      'primary/additional race settlement',
      Promise.allSettled([primary, additional])
    )
    assert.equal(settled[0]?.status, 'fulfilled')
    assert.equal(settled[1]?.status, 'rejected')
    const error = settled[1]?.status === 'rejected' ? sqlError(settled[1].reason) : null
    assert.equal(error?.code, 'P0001')
    assert.equal(
      error?.message,
      'Campaign primary Rules Catalogue must not be stored as an additional catalogue.'
    )
    const state = await campaignState(db, options.campaignId)
    assert.equal(state.primary, contender)
    assert.equal(state.additional.includes(contender), false)
    console.log(JSON.stringify({ result: 'catalogue-primary-additional-race', status: 'PASS' }))
  } finally {
    releasePrimary?.()
    await Promise.allSettled([primary ?? Promise.resolve(), additional ?? Promise.resolve()])
    await Promise.allSettled([
      db.destroy(),
      observer.destroy(),
      primaryWriter.destroy(),
      additionalWriter.destroy()
    ])
  }
}

async function proveServerOnlyTables(
  options: CampaignCatalogueContentSourceProofOptions
): Promise<void> {
  const db = createDb({ connectionString: options.connectionString })
  const tables = [
    'rules_catalogues',
    'content_sources',
    'rules_catalogue_content_sources',
    'reusable_definitions',
    'reusable_definition_drafts',
    'campaign_additional_rules_catalogues'
  ]
  try {
    for (const table of tables) {
      const security = await sql<{ relforcerowsecurity: boolean; relrowsecurity: boolean }>`
        select relrowsecurity, relforcerowsecurity
        from pg_class where oid = ${`public.${table}`}::regclass
      `.execute(db)
      assert.deepEqual(
        security.rows[0],
        { relforcerowsecurity: true, relrowsecurity: true },
        `${table} must force RLS.`
      )
      for (const role of ['anon', 'authenticated'] as const) {
        await expectSqlRejected(
          `${role} ${table} privilege`,
          db.transaction().execute(async (trx) => {
            await sql.raw(`set local role ${role}`).execute(trx)
            await sql.raw(`select 1 from public.${table} limit 1`).execute(trx)
          }),
          { code: '42501', message: `permission denied for table ${table}` }
        )
      }
    }
    console.log(JSON.stringify({ result: 'catalogue-server-only-tables', status: 'PASS' }))
  } finally {
    await db.destroy()
  }
}

async function proveReusableDefinitionLifecycle(
  options: CampaignCatalogueContentSourceProofOptions
): Promise<void> {
  const db = createDb({ connectionString: options.connectionString })
  const definitionId = randomUUID()
  const sourceId = randomUUID()
  const document = {
    schemaVersion: 1 as const,
    id: definitionId,
    gameSystemId: options.gameSystemId,
    definitionFamilyKey: 'rules-runtime-graph',
    nodes: [
      {
        id: 'result',
        operation: { key: 'number.add', contractVersion: 1 },
        inputs: { left: { kind: 'LITERAL', value: 1 }, right: { kind: 'LITERAL', value: 2 } }
      }
    ],
    outputs: { value: { kind: 'NODE_OUTPUT', nodeId: 'result', port: 'value' } }
  }
  try {
    options.proofOwned.userContentSourceIds.push(sourceId)
    options.proofOwned.reusableDefinitionIds.push(definitionId)
    await sql`insert into public.content_sources (id, game_system_id, kind, owner_user_id, code, label) values (${sourceId}::uuid, ${options.gameSystemId}::uuid, 'USER', ${options.ownerUserId}::uuid, ${`reusable-${definitionId}`}, 'Reusable proof source')`.execute(
      db
    )
    await sql`insert into public.reusable_definitions (id, game_system_id, content_source_id, definition_family_key, label) values (${definitionId}::uuid, ${options.gameSystemId}::uuid, ${sourceId}::uuid, 'rules-runtime-graph', 'Reusable proof definition')`.execute(
      db
    )
    const repository = createReusableDefinitionRepository(db)
    const service = createReusableDefinitionService({
      store: repository,
      capabilities: [
        {
          gameSystemId: options.gameSystemId,
          contractVersion: 1,
          authoredRootKinds: ['action'],
          definitionFamilyKeys: ['rules-runtime-graph'],
          factContracts: [],
          operationContracts: [{ key: 'number.add', contractVersion: 1 }]
        }
      ]
    })
    const draft = await service.saveDraft({
      definitionId,
      actorUserId: options.ownerUserId,
      expectedDefinitionVersion: 0,
      expectedDraftVersion: null,
      document
    })
    assert.equal(draft.version, 0)
    const updatedDraft = await service.saveDraft({
      definitionId,
      actorUserId: options.ownerUserId,
      expectedDefinitionVersion: 0,
      expectedDraftVersion: draft.version,
      document
    })
    assert.equal(updatedDraft.version, 1)
    await expectDomainRejected(
      'stale reusable draft CAS',
      service.saveDraft({
        definitionId,
        actorUserId: options.ownerUserId,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: draft.version,
        document
      }),
      'Reusable definition draft version is stale.'
    )
    const published = await service.publishDraft({
      definitionId,
      actorUserId: options.ownerUserId,
      expectedDefinitionVersion: 0,
      expectedDraftVersion: updatedDraft.version
    })
    assert.deepEqual(published.document, document)
    assert.equal(published.checksum, draft.checksum)
    assert.equal((await repository.getRoot(definitionId))?.current?.checksum, draft.checksum)
    const noDraft = await sql<{
      count: number
    }>`select count(*)::int as count from public.reusable_definition_drafts where definition_id = ${definitionId}::uuid`.execute(
      db
    )
    assert.equal(noDraft.rows[0]?.count, 0, 'Publish must consume the exact draft.')
    const nextDraft = await service.saveDraft({
      definitionId,
      actorUserId: options.ownerUserId,
      expectedDefinitionVersion: 1,
      expectedDraftVersion: null,
      document
    })
    const beforeInvalidPublish = await repository.getRoot(definitionId)
    await expectDomainRejected(
      'stale reusable publish',
      service.publishDraft({
        definitionId,
        actorUserId: options.ownerUserId,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: nextDraft.version
      }),
      'Reusable definition version is stale.'
    )
    assert.deepEqual(
      await repository.getRoot(definitionId),
      beforeInvalidPublish,
      'Failed publish changed current or draft state.'
    )
    console.log(JSON.stringify({ result: 'reusable-definition-cas-publish', status: 'PASS' }))
  } finally {
    await sql`delete from public.reusable_definitions where id = ${definitionId}::uuid`.execute(db)
    await sql`delete from public.content_sources where id = ${sourceId}::uuid`.execute(db)
    await db.destroy()
  }
}

async function proveAuthoredContentSourceProvenance(
  options: CampaignCatalogueContentSourceProofOptions
): Promise<void> {
  const db = createDb({ connectionString: options.connectionString })
  const config = authoredDomainConfigs.backgrounds
  try {
    const source = await sql<{ public_id: string }>`
      select route.public_id
      from public.backgrounds background
      join public.authored_route_ids route
        on route.subject_kind = 'BACKGROUND' and route.subject_id = background.id
      where background.system_id = ${options.gameSystemId}::uuid
        and background.is_master = true
        and background.status = 'ACTIVE'
      order by background.id
      limit 1
    `.execute(db)
    const publicId = source.rows[0]?.public_id
    assert.ok(publicId, 'Proof requires a routed seeded active Background.')
    const copied = await withTransaction(db, async (trx) => {
      await sql`select set_config('request.jwt.claim.sub', ${options.ownerUserId}, true)`.execute(
        trx
      )
      return duplicateAuthoredDomain(trx, config, publicId, options.ownerUserId)
    })
    assert.ok(copied, 'Background copy did not create a draft.')
    options.proofOwned.backgroundIds.push(copied.subjectId)
    const draftBeforePublish = await sql<{
      content_source_id: string
      game_system_id: string
      kind: string
      owner_user_id: string
    }>`
      select draft.content_source_id, source.game_system_id, source.kind, source.owner_user_id
      from public.authored_drafts draft
      join public.content_sources source on source.id = draft.content_source_id
      where subject_kind = 'BACKGROUND' and subject_id = ${copied.subjectId}::uuid
    `.execute(db)
    const draftSourceId = draftBeforePublish.rows[0]?.content_source_id
    assert.ok(draftSourceId, 'Copied Background draft lost its Content Source.')
    assert.equal(draftBeforePublish.rows[0]?.kind, 'USER')
    assert.equal(draftBeforePublish.rows[0]?.owner_user_id, options.ownerUserId)
    assert.equal(draftBeforePublish.rows[0]?.game_system_id, options.gameSystemId)
    if (!options.proofOwned.userContentSourceIds.includes(draftSourceId)) {
      options.proofOwned.userContentSourceIds.push(draftSourceId)
    }
    await activateAuthoredDomainDraft(db, config, copied.subjectId, options.ownerUserId)
    const published = await sql<{ content_source_id: string }>`
      select content_source_id from public.backgrounds where id = ${copied.subjectId}::uuid
    `.execute(db)
    assert.equal(published.rows[0]?.content_source_id, draftSourceId)
    const saved = await saveAuthoredDomainInputDraft(
      db,
      config,
      config.schema.parse(copied.payload),
      options.ownerUserId
    )
    const updateDraft = await sql<{ content_source_id: string }>`
      select content_source_id from public.authored_drafts
      where subject_kind = 'BACKGROUND' and subject_id = ${saved.subjectId}::uuid
    `.execute(db)
    assert.equal(updateDraft.rows[0]?.content_source_id, draftSourceId)
    await activateAuthoredDomainDraft(db, config, saved.subjectId, options.ownerUserId)
    const updated = await sql<{ content_source_id: string }>`
      select content_source_id from public.backgrounds where id = ${saved.subjectId}::uuid
    `.execute(db)
    assert.equal(updated.rows[0]?.content_source_id, draftSourceId)
    console.log(JSON.stringify({ result: 'authored-content-source-provenance', status: 'PASS' }))
  } finally {
    await db.destroy()
  }
}

async function proveCompositeForeignKeys(
  options: CampaignCatalogueContentSourceProofOptions
): Promise<void> {
  const db = createDb({ connectionString: options.connectionString })
  const crossSystemCampaignId = randomUUID()
  try {
    await expectSqlRejected(
      'Campaign catalogue System FK',
      sql`insert into public.campaigns (id, owner_user_id, game_system_id, primary_rules_catalogue_id, name, format, tone_tags, content_maturity) values (${crossSystemCampaignId}::uuid, ${options.ownerUserId}::uuid, ${options.gameSystemId}::uuid, ${options.otherCatalogueId}::uuid, 'Cross-System FK proof', 'ONE_SHOT', ARRAY['HEROIC']::text[], 'STANDARD')`.execute(
        db
      ),
      {
        code: '23503',
        message:
          'insert or update on table "campaigns" violates foreign key constraint "campaigns_primary_catalogue_system_fk"'
      }
    )
    const failedCampaign = await sql<{ campaigns: number; routes: number }>`
      select
        (select count(*)::int from public.campaigns where id = ${crossSystemCampaignId}::uuid) as campaigns,
        (select count(*)::int from public.authored_route_ids where subject_kind = 'CAMPAIGN' and subject_id = ${crossSystemCampaignId}::uuid) as routes
    `.execute(db)
    assert.deepEqual(failedCampaign.rows[0], { campaigns: 0, routes: 0 })
    for (const table of [
      'backgrounds',
      'classes',
      'creatures',
      'equipment',
      'feats',
      'races',
      'spells',
      'vehicles'
    ] as const) {
      await expectSqlRejected(
        `${table} content-source System FK`,
        sql
          .raw(
            `update public.${table} set content_source_id = '${options.otherContentSourceId}'::uuid where id = (select id from public.${table} limit 1)`
          )
          .execute(db),
        {
          code: '23503',
          message: `insert or update on table "${table}" violates foreign key constraint "${table}_content_source_system_fk"`
        }
      )
    }
    console.log(JSON.stringify({ result: 'same-system-composite-fks', status: 'PASS' }))
  } finally {
    await db.destroy()
  }
}

export async function proveCampaignCatalogueContentSourcePostgresSemantics(
  options: CampaignCatalogueContentSourceProofOptions
): Promise<void> {
  await proveServerOnlyTables(options)
  await proveServiceBinding(options)
  await proveTriggers(options)
  await proveBoundaryContention(options)
  await provePrimaryAdditionalRace(options)
  await proveReusableDefinitionLifecycle(options)
  await proveAuthoredContentSourceProvenance(options)
  await proveCompositeForeignKeys(options)
}
