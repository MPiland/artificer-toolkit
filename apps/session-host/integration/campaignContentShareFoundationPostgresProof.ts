import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import {
  createAuthoredVersionRepository,
  createCampaignContentShareRepository,
  createCampaignRepository,
  createDb,
  srdBaselineContent,
  type DBLike
} from '@artificer-toolkit/db'
import {
  activateAuthoredDomainInput,
  archiveCampaign,
  authoredDomainConfigs,
  createCampaignVehicle,
  listCampaignContentShares,
  removeCampaignMember,
  shareCampaignContent
} from '@artificer-toolkit/functions/services'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import { vehicleAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/vehicle'
import type { SpellAuthored, VehicleAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { sql } from 'kysely'

const OPERATION_TIMEOUT_MS = 10_000
const CONTENTION_TIMEOUT_MS = 5_000
const LATE_FAILURE_MESSAGE = 'campaign-content-share-late-failure'

export interface CampaignContentShareFoundationProofOptions {
  authorUserId: string
  connectionString: string
  gmUserId: string
  onRootCreated(subjectKind: 'SPELL' | 'VEHICLE', subjectId: string): void
  otherAuthorUserId: string
  primaryCampaignId: string
  readerUserId: string
  secondaryCampaignId: string
  secondaryCampaignOwnerUserId: string
  secondaryCampaignVersion: number
  systemId: string
}

interface OwnedSource {
  checksum: string
  id: string
  subjectKind: 'SPELL' | 'VEHICLE'
  version: number
  versionId: string
}

class ProofPlumbingError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ProofPlumbingError'
  }
}

class RollbackSentinel extends Error {}

function boundedReason(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replaceAll(/\s+/g, ' ')
    .slice(0, 600)
}

function taggedConnectionString(connectionString: string, label: string): string {
  const url = new URL(connectionString)
  url.searchParams.set('application_name', `artificer-campaign-share-${label}`)
  return url.toString()
}

function createTaggedDb(connectionString: string, label: string) {
  return createDb({ connectionString: taggedConnectionString(connectionString, label) })
}

async function withTimeout<T>(label: string, promise: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new ProofPlumbingError(`${label} exceeded ${OPERATION_TIMEOUT_MS} ms.`)),
          OPERATION_TIMEOUT_MS
        )
      })
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function waitForBlockedActivity(
  observer: DBLike,
  applicationLabel: string,
  queryFragment?: string,
  diagnostic?: {
    expectedLock: {
      heldMode: 'FOR UPDATE'
      relation: string
      requestedMode: 'FOR KEY SHARE' | 'FOR SHARE'
      rowIdentity: string
    }
    holderLabel: string
  }
): Promise<void> {
  const applicationName = `artificer-campaign-share-${applicationLabel}`
  const deadline = Date.now() + CONTENTION_TIMEOUT_MS
  while (Date.now() < deadline) {
    const result = await sql<{ blocked: boolean }>`
      select exists (
        select 1
        from pg_stat_activity
        where datname = current_database()
          and application_name = ${applicationName}
          and wait_event_type = 'Lock'
          and (${queryFragment ?? null}::text is null or query ilike ${queryFragment ? `%${queryFragment}%` : null})
      ) as blocked
    `.execute(observer)
    if (result.rows[0]?.blocked) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  if (diagnostic) {
    const holderApplicationName = `artificer-campaign-share-${diagnostic.holderLabel}`
    const result = await sql<{
      applicationName: string
      backendXid: string | null
      backendXmin: string | null
      query: string
      queryStart: string
      state: string
      waitEvent: string | null
      waitEventType: string | null
    }>`
      select
        application_name as "applicationName",
        state,
        wait_event_type as "waitEventType",
        wait_event as "waitEvent",
        left(query, 240) as query,
        query_start::text as "queryStart",
        backend_xid::text as "backendXid",
        backend_xmin::text as "backendXmin"
      from pg_stat_activity
      where datname = current_database()
        and application_name in (${applicationName}, ${holderApplicationName})
      order by application_name, query_start
    `.execute(observer)
    console.error(
      JSON.stringify({
        connections: result.rows,
        expectedLock: diagnostic.expectedLock,
        holderApplicationName,
        result: 'use-order-lock-timeout-diagnostic',
        contenderApplicationName: applicationName
      })
    )
  }
  throw new ProofPlumbingError(
    `${applicationLabel} did not reach the expected lock wait within ${CONTENTION_TIMEOUT_MS} ms.`
  )
}

function deferred(): { promise: Promise<void>; resolve(): void } {
  let resolvePromise: (() => void) | undefined
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve
  })
  return {
    promise,
    resolve: () => {
      if (!resolvePromise) throw new ProofPlumbingError('Deferred release was not initialized.')
      resolvePromise()
    }
  }
}

async function expectRejected(label: string, operation: Promise<unknown>): Promise<void> {
  try {
    await operation
    assert.fail(`${label} unexpectedly succeeded.`)
  } catch (error) {
    if (error instanceof assert.AssertionError) throw error
  }
}

function seededSpell(): SpellAuthored {
  const source = srdBaselineContent.subjects.spells.find((spell) => spell.level > 0)
  assert.ok(source, 'The seeded corpus must contain a leveled Spell.')
  return source
}

function seededVehicle(): VehicleAuthored {
  const source = srdBaselineContent.subjects.vehicles[0]
  assert.ok(source, 'The seeded corpus must contain a Vehicle.')
  return source
}

async function createOwnedSpell(
  db: DBLike,
  options: CampaignContentShareFoundationProofOptions,
  label: string
): Promise<OwnedSource> {
  const id = randomUUID()
  options.onRootCreated('SPELL', id)
  const source = seededSpell()
  await activateAuthoredDomainInput(
    db,
    authoredDomainConfigs.spells,
    spellAuthoredDtoSchema.parse({
      ...source,
      id,
      label: `Campaign share ${label} ${id}`,
      systemId: options.systemId,
      userId: options.authorUserId
    }),
    options.authorUserId
  )
  const record = await createAuthoredVersionRepository(db).findActive({
    subjectKind: 'SPELL',
    subjectId: id
  })
  assert.ok(record)
  return {
    checksum: record.authored.checksum,
    id,
    subjectKind: 'SPELL',
    version: record.authored.version,
    versionId: record.authored.versionId
  }
}

async function createOwnedVehicle(
  db: DBLike,
  options: CampaignContentShareFoundationProofOptions
): Promise<OwnedSource> {
  const id = randomUUID()
  options.onRootCreated('VEHICLE', id)
  const source = seededVehicle()
  await activateAuthoredDomainInput(
    db,
    authoredDomainConfigs.vehicles,
    vehicleAuthoredDtoSchema.parse({
      ...source,
      id,
      label: `Campaign share Vehicle ${id}`,
      systemId: options.systemId,
      userId: options.authorUserId
    }),
    options.authorUserId
  )
  const record = await createAuthoredVersionRepository(db).findActive({
    subjectKind: 'VEHICLE',
    subjectId: id
  })
  assert.ok(record)
  return {
    checksum: record.authored.checksum,
    id,
    subjectKind: 'VEHICLE',
    version: record.authored.version,
    versionId: record.authored.versionId
  }
}

async function share(
  db: DBLike,
  options: CampaignContentShareFoundationProofOptions,
  source: OwnedSource
) {
  return shareCampaignContent(db, options.authorUserId, {
    campaignId: options.primaryCampaignId,
    subjectKind: source.subjectKind,
    subjectId: source.id
  })
}

async function proveShareAuthorization(
  db: DBLike,
  options: CampaignContentShareFoundationProofOptions,
  target: OwnedSource
): Promise<void> {
  const first = await share(db, options, target)
  const second = await share(db, options, target)
  assert.deepEqual(second, first)
  const count = await sql<{ count: number }>`
    select count(*)::int as count
    from public.campaign_content_shares
    where campaign_id = ${options.primaryCampaignId}::uuid
      and subject_kind = ${target.subjectKind}
      and subject_id = ${target.id}::uuid
  `.execute(db)
  assert.equal(count.rows[0]?.count, 1)

  await expectRejected(
    'Nonmember share',
    shareCampaignContent(db, options.readerUserId, {
      campaignId: options.secondaryCampaignId,
      subjectKind: target.subjectKind,
      subjectId: target.id
    })
  )
  await expectRejected(
    'Wrong-owner share',
    shareCampaignContent(db, options.otherAuthorUserId, {
      campaignId: options.primaryCampaignId,
      subjectKind: target.subjectKind,
      subjectId: target.id
    })
  )
  const master = seededSpell()
  await expectRejected(
    'Master root share',
    shareCampaignContent(db, options.authorUserId, {
      campaignId: options.primaryCampaignId,
      subjectKind: 'SPELL',
      subjectId: master.id
    })
  )

  await expectRejected(
    'Different-author replacement',
    createCampaignContentShareRepository(db).shareRoot({
      campaignId: options.primaryCampaignId,
      subjectKind: target.subjectKind,
      subjectId: target.id,
      sharedBy: options.otherAuthorUserId
    })
  )

  await createCampaignRepository(db).activatePlayerMembership(
    options.secondaryCampaignId,
    options.authorUserId,
    new Date().toISOString()
  )
  const archived = await archiveCampaign(
    db,
    options.secondaryCampaignOwnerUserId,
    options.secondaryCampaignId,
    options.secondaryCampaignVersion
  )
  assert.equal(archived.status, 'ARCHIVED')
  await expectRejected(
    'Archived Campaign share',
    shareCampaignContent(db, options.authorUserId, {
      campaignId: options.secondaryCampaignId,
      subjectKind: target.subjectKind,
      subjectId: target.id
    })
  )

  const listed = await listCampaignContentShares(db, options.gmUserId, options.primaryCampaignId)
  assert.equal(listed.filter((item) => item.subjectId === target.id).length, 1)
  assert.equal(listed.find((item) => item.subjectId === target.id)?.sharedBy, options.authorUserId)
  console.log(JSON.stringify({ result: 'share-authorization', status: 'PASS' }))
}

async function proveLateRollback(
  db: DBLike,
  options: CampaignContentShareFoundationProofOptions,
  source: OwnedSource
): Promise<void> {
  await expectRejected(
    'Late share insert failure',
    db.transaction().execute(async (trx) => {
      await sql`
        create function pg_temp.raise_campaign_content_share_late_failure()
        returns trigger language plpgsql as $$
        begin
          raise exception 'campaign-content-share-late-failure';
        end
        $$
      `.execute(trx)
      await sql`
        create trigger campaign_content_share_late_failure
        after insert on public.campaign_content_shares
        for each row execute function pg_temp.raise_campaign_content_share_late_failure()
      `.execute(trx)
      await share(trx, options, source)
      assert.fail(LATE_FAILURE_MESSAGE)
    })
  )
  const persisted = await createCampaignContentShareRepository(db).findShare({
    campaignId: options.primaryCampaignId,
    subjectKind: source.subjectKind,
    subjectId: source.id
  })
  assert.equal(persisted, null)
  console.log(JSON.stringify({ result: 'share-late-rollback', status: 'PASS' }))
}

async function proveStaleShareFailsClosed(
  db: DBLike,
  options: CampaignContentShareFoundationProofOptions,
  vehicle: OwnedSource,
  target: OwnedSource
): Promise<void> {
  await share(db, options, vehicle)
  try {
    await db.transaction().execute(async (trx) => {
      await sql`
        update public.campaign_memberships
        set status = 'LEFT', left_at = now(), updated_at = now()
        where campaign_id = ${options.primaryCampaignId}::uuid
          and user_id = ${options.authorUserId}::uuid
      `.execute(trx)
      const current = await createCampaignContentShareRepository(trx).listCurrentSources(
        options.primaryCampaignId
      )
      assert.equal(
        current.some((item) => item.share.subjectId === target.id),
        false
      )
      const listed = await listCampaignContentShares(
        trx,
        options.gmUserId,
        options.primaryCampaignId
      )
      assert.equal(
        listed.some((item) => item.subjectId === target.id),
        false
      )
      await expectRejected(
        'Stale Vehicle share use',
        createCampaignVehicle(trx, options.gmUserId, {
          campaignId: options.primaryCampaignId,
          vehicleDefinitionId: vehicle.id,
          label: 'Must not persist'
        })
      )
      throw new RollbackSentinel()
    })
    assert.fail('The stale-share transaction must roll back.')
  } catch (error) {
    if (!(error instanceof RollbackSentinel)) throw error
  }
  console.log(JSON.stringify({ result: 'stale-share-fail-closed', status: 'PASS' }))
}

async function proveUseLockOrder(
  options: CampaignContentShareFoundationProofOptions,
  target: OwnedSource
): Promise<void> {
  const labels = [
    'campaign-blocker',
    'share-blocker',
    'membership-blocker',
    'root-blocker'
  ] as const
  const blockers = labels.map((label) => createTaggedDb(options.connectionString, label))
  const useDb = createTaggedDb(options.connectionString, 'use-order')
  const observer = createTaggedDb(options.connectionString, 'observer')
  const ready = labels.map(() => deferred())
  const release = labels.map(() => deferred())
  const holders: Promise<unknown>[] = []
  try {
    holders.push(
      blockers[0]!.transaction().execute(async (trx) => {
        await sql`select id from public.campaigns where id = ${options.primaryCampaignId}::uuid for update`.execute(
          trx
        )
        ready[0]!.resolve()
        await release[0]!.promise
      }),
      blockers[1]!.transaction().execute(async (trx) => {
        await sql`select subject_id from public.campaign_content_shares where campaign_id = ${options.primaryCampaignId}::uuid and subject_kind = 'SPELL' and subject_id = ${target.id}::uuid for update`.execute(
          trx
        )
        ready[1]!.resolve()
        await release[1]!.promise
      }),
      blockers[2]!.transaction().execute(async (trx) => {
        await sql`select user_id from public.campaign_memberships where campaign_id = ${options.primaryCampaignId}::uuid and user_id = ${options.authorUserId}::uuid for update`.execute(
          trx
        )
        ready[2]!.resolve()
        await release[2]!.promise
      }),
      blockers[3]!.transaction().execute(async (trx) => {
        await sql`select id from public.spells where id = ${target.id}::uuid for update`.execute(
          trx
        )
        ready[3]!.resolve()
        await release[3]!.promise
      })
    )
    await Promise.all(ready.map((item) => item.promise))
    const use = useDb.transaction().execute((trx) =>
      createCampaignContentShareRepository(trx).lockSharesForUse({
        campaignId: options.primaryCampaignId,
        shares: [
          {
            checksum: target.checksum,
            sharedBy: options.authorUserId,
            subjectId: target.id,
            subjectKind: 'SPELL',
            version: target.version,
            versionId: target.versionId
          }
        ]
      })
    )
    await waitForBlockedActivity(observer, 'use-order', 'from public.campaigns', {
      expectedLock: {
        heldMode: 'FOR UPDATE',
        relation: 'public.campaigns',
        requestedMode: 'FOR SHARE',
        rowIdentity: options.primaryCampaignId
      },
      holderLabel: 'campaign-blocker'
    })
    release[0]!.resolve()
    await waitForBlockedActivity(observer, 'use-order', 'from public.campaign_content_shares', {
      expectedLock: {
        heldMode: 'FOR UPDATE',
        relation: 'public.campaign_content_shares',
        requestedMode: 'FOR KEY SHARE',
        rowIdentity: `${options.primaryCampaignId}/SPELL/${target.id}`
      },
      holderLabel: 'share-blocker'
    })
    release[1]!.resolve()
    await waitForBlockedActivity(observer, 'use-order', 'from public.campaign_memberships', {
      expectedLock: {
        heldMode: 'FOR UPDATE',
        relation: 'public.campaign_memberships',
        requestedMode: 'FOR SHARE',
        rowIdentity: `${options.primaryCampaignId}/${options.authorUserId}`
      },
      holderLabel: 'membership-blocker'
    })
    release[2]!.resolve()
    await waitForBlockedActivity(observer, 'use-order', '"public"."spells" root', {
      expectedLock: {
        heldMode: 'FOR UPDATE',
        relation: 'public.spells',
        requestedMode: 'FOR SHARE',
        rowIdentity: target.id
      },
      holderLabel: 'root-blocker'
    })
    release[3]!.resolve()
    const result = await withTimeout('ordered share use', use)
    assert.equal(result.missing.length, 0)
    assert.equal(result.locked.length, 1)
    await Promise.all(holders)
  } finally {
    for (const item of release) item.resolve()
    await Promise.allSettled(holders)
    await Promise.allSettled([...blockers, useDb, observer].map((db) => db.destroy()))
  }
  console.log(JSON.stringify({ result: 'share-use-lock-order', status: 'PASS' }))
}

async function proveDeleteBlockingAndIndependence(
  options: CampaignContentShareFoundationProofOptions,
  target: OwnedSource,
  unrelated: OwnedSource
): Promise<void> {
  const holderDb = createTaggedDb(options.connectionString, 'use-holder')
  const deleteDb = createTaggedDb(options.connectionString, 'target-delete')
  const unrelatedDb = createTaggedDb(options.connectionString, 'unrelated-delete')
  const observer = createTaggedDb(options.connectionString, 'delete-observer')
  const locked = deferred()
  const release = deferred()
  let holder: Promise<unknown> | undefined
  let targetDelete: Promise<unknown> | undefined
  try {
    holder = holderDb.transaction().execute(async (trx) => {
      const result = await createCampaignContentShareRepository(trx).lockSharesForUse({
        campaignId: options.primaryCampaignId,
        shares: [
          {
            checksum: target.checksum,
            sharedBy: options.authorUserId,
            subjectId: target.id,
            subjectKind: 'SPELL',
            version: target.version,
            versionId: target.versionId
          }
        ]
      })
      assert.equal(result.missing.length, 0)
      locked.resolve()
      await release.promise
    })
    await locked.promise
    targetDelete = deleteDb.transaction().execute(async (trx) => {
      await sql`delete from public.campaign_content_shares where campaign_id = ${options.primaryCampaignId}::uuid and subject_kind = 'SPELL' and subject_id = ${target.id}::uuid`.execute(
        trx
      )
      throw new RollbackSentinel()
    })
    await waitForBlockedActivity(
      observer,
      'target-delete',
      'delete from public.campaign_content_shares'
    )
    await expectRejected(
      'Unrelated delete rollback',
      withTimeout(
        'unrelated share delete',
        unrelatedDb.transaction().execute(async (trx) => {
          await sql`delete from public.campaign_content_shares where campaign_id = ${options.primaryCampaignId}::uuid and subject_kind = 'SPELL' and subject_id = ${unrelated.id}::uuid`.execute(
            trx
          )
          throw new RollbackSentinel()
        })
      )
    )
    release.resolve()
    await expectRejected('Target delete rollback', withTimeout('target share delete', targetDelete))
    await holder
  } finally {
    release.resolve()
    await Promise.allSettled(
      [holder, targetDelete].filter((item): item is Promise<unknown> => Boolean(item))
    )
    await Promise.allSettled([holderDb, deleteDb, unrelatedDb, observer].map((db) => db.destroy()))
  }
  console.log(JSON.stringify({ result: 'share-delete-blocking', status: 'PASS' }))
}

async function proveListingRevocationOrders(
  db: DBLike,
  options: CampaignContentShareFoundationProofOptions,
  target: OwnedSource
): Promise<void> {
  const listDb = createTaggedDb(options.connectionString, 'list-first')
  const removeDb = createTaggedDb(options.connectionString, 'remove-after-list')
  const observer = createTaggedDb(options.connectionString, 'list-observer')
  const listed = deferred()
  const releaseList = deferred()
  let listOperation: Promise<unknown> | undefined
  let removeOperation: Promise<unknown> | undefined
  try {
    listOperation = listDb.transaction().execute(async (trx) => {
      const result = await listCampaignContentShares(
        trx,
        options.readerUserId,
        options.primaryCampaignId
      )
      assert.equal(
        result.some((item) => item.subjectId === target.id),
        true
      )
      listed.resolve()
      await releaseList.promise
      return result
    })
    await listed.promise
    const listFirstState = await sql<{ accessStartedAt: string; version: number }>`
      select campaign.version, member.access_started_at::text as "accessStartedAt"
      from public.campaigns campaign
      join public.campaign_memberships member on member.campaign_id = campaign.id
      where campaign.id = ${options.primaryCampaignId}::uuid
        and member.user_id = ${options.readerUserId}::uuid
    `.execute(db)
    const listFirstRow = listFirstState.rows[0]
    assert.ok(listFirstRow)
    removeOperation = removeCampaignMember(
      removeDb,
      options.gmUserId,
      options.primaryCampaignId,
      options.readerUserId,
      listFirstRow.version,
      listFirstRow.accessStartedAt,
      randomUUID()
    )
    await waitForBlockedActivity(observer, 'remove-after-list')
    releaseList.resolve()
    await withTimeout('list-first list', listOperation)
    await withTimeout('list-first removal', removeOperation)
    await expectRejected(
      'Post-removal list',
      listCampaignContentShares(db, options.readerUserId, options.primaryCampaignId)
    )
  } finally {
    releaseList.resolve()
    await Promise.allSettled(
      [listOperation, removeOperation].filter((item): item is Promise<unknown> => Boolean(item))
    )
    await Promise.allSettled([listDb, removeDb, observer].map((item) => item.destroy()))
  }

  await createCampaignRepository(db).activatePlayerMembership(
    options.primaryCampaignId,
    options.readerUserId,
    new Date().toISOString()
  )
  const membershipBlocker = createTaggedDb(
    options.connectionString,
    'membership-blocker-remove-first'
  )
  const removeFirstDb = createTaggedDb(options.connectionString, 'remove-first')
  const listAfterDb = createTaggedDb(options.connectionString, 'list-after-remove')
  const secondObserver = createTaggedDb(options.connectionString, 'remove-observer')
  const blockerReady = deferred()
  const releaseBlocker = deferred()
  let blocker: Promise<unknown> | undefined
  let removal: Promise<unknown> | undefined
  let blockedList: Promise<unknown> | undefined
  try {
    blocker = membershipBlocker.transaction().execute(async (trx) => {
      await sql`select user_id from public.campaign_memberships where campaign_id = ${options.primaryCampaignId}::uuid and user_id = ${options.readerUserId}::uuid for update`.execute(
        trx
      )
      blockerReady.resolve()
      await releaseBlocker.promise
    })
    await blockerReady.promise
    const removeFirstState = await sql<{ accessStartedAt: string; version: number }>`
      select campaign.version, member.access_started_at::text as "accessStartedAt"
      from public.campaigns campaign
      join public.campaign_memberships member on member.campaign_id = campaign.id
      where campaign.id = ${options.primaryCampaignId}::uuid
        and member.user_id = ${options.readerUserId}::uuid
    `.execute(db)
    const removeFirstRow = removeFirstState.rows[0]
    assert.ok(removeFirstRow)
    removal = removeCampaignMember(
      removeFirstDb,
      options.gmUserId,
      options.primaryCampaignId,
      options.readerUserId,
      removeFirstRow.version,
      removeFirstRow.accessStartedAt,
      randomUUID()
    )
    await waitForBlockedActivity(secondObserver, 'remove-first')
    blockedList = listCampaignContentShares(
      listAfterDb,
      options.readerUserId,
      options.primaryCampaignId
    )
    await waitForBlockedActivity(secondObserver, 'list-after-remove')
    releaseBlocker.resolve()
    await withTimeout('removal-first removal', removal)
    await expectRejected('Removal-first list', withTimeout('removal-first list', blockedList))
    await blocker
  } finally {
    releaseBlocker.resolve()
    await Promise.allSettled(
      [blocker, removal, blockedList].filter((item): item is Promise<unknown> => Boolean(item))
    )
    await Promise.allSettled(
      [membershipBlocker, removeFirstDb, listAfterDb, secondObserver].map((item) => item.destroy())
    )
  }
  console.log(JSON.stringify({ result: 'listing-revocation-orders', status: 'PASS' }))
}

export async function proveCampaignContentShareFoundationPostgresSemantics(
  options: CampaignContentShareFoundationProofOptions
): Promise<void> {
  const db = createDb({ connectionString: options.connectionString })
  try {
    const target = await createOwnedSpell(db, options, 'target')
    const unrelated = await createOwnedSpell(db, options, 'unrelated')
    const rollback = await createOwnedSpell(db, options, 'rollback')
    const vehicle = await createOwnedVehicle(db, options)
    await proveShareAuthorization(db, options, target)
    await share(db, options, unrelated)
    await proveLateRollback(db, options, rollback)
    await proveStaleShareFailsClosed(db, options, vehicle, target)
    await proveUseLockOrder(options, target)
    await proveDeleteBlockingAndIndependence(options, target, unrelated)
    await proveListingRevocationOrders(db, options, target)
  } catch (error) {
    throw new Error(`Campaign-share B1 proof failed: ${boundedReason(error)}`, { cause: error })
  } finally {
    await db.destroy()
  }
}
