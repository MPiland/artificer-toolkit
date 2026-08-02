import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import { sql } from 'kysely'

import { createDb } from '../client.js'
import {
  AuthoredDefinitionCreationRateLimitError,
  createAuthoredDefinitionRepository,
  type AuthoredSubjectKind,
  type SaveAuthoredDefinitionDraftInput
} from '../domains/subjects/repositories/authoredDefinition.js'
import type { DBLike } from '../types/index.js'

const LOCAL_DATABASE_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])
const SUBJECT_KINDS: readonly AuthoredSubjectKind[] = [
  'BACKGROUND',
  'CLASS',
  'CREATURE',
  'EQUIPMENT',
  'FEAT',
  'RACE',
  'SPELL',
  'VEHICLE'
]

interface CounterRow {
  hour_count: number
  hour_window_start: Date | string
  minute_count: number
  minute_window_start: Date | string
  user_id: string
}

function requireLocalDatabaseUrl(): string {
  const connectionString = process.env.DATABASE_CONNECTION_STRING
  if (!connectionString) {
    throw new Error('DATABASE_CONNECTION_STRING is required for the authored rate-limit proof.')
  }

  let host: string
  try {
    host = new URL(connectionString).hostname.toLowerCase()
  } catch {
    throw new Error(
      'The authored rate-limit proof requires a URL-shaped Postgres connection string.'
    )
  }

  if (!LOCAL_DATABASE_HOSTS.has(host)) {
    throw new Error(
      `Refusing to run the authored rate-limit proof against non-local database host "${host}".`
    )
  }

  return connectionString
}

async function findFixture(db: DBLike): Promise<{ systemId: string; userId: string }> {
  const [systemResult, userResult] = await Promise.all([
    sql<{ id: string }>`
      select id::text as id
      from systems
      order by created_at, id
      limit 1
    `.execute(db),
    sql<{ id: string }>`
      select id::text as id
      from auth.users
      order by created_at, id
      limit 1
    `.execute(db)
  ])
  const systemId = systemResult.rows[0]?.id
  const userId = userResult.rows[0]?.id

  if (!systemId || !userId) {
    throw new Error('The local database needs one system and auth user. Run the local seed first.')
  }

  return { systemId, userId }
}

function createDraftInput(
  subjectId: string,
  systemId: string,
  userId: string,
  subjectKind: AuthoredSubjectKind = 'SPELL'
): SaveAuthoredDefinitionDraftInput {
  return {
    label: `Rate limit proof ${subjectId}`,
    payload: { id: subjectId, label: 'Rate limit proof', systemId },
    subjectId,
    subjectKind,
    systemId,
    userId
  }
}

async function readCounter(db: DBLike, userId: string): Promise<CounterRow | null> {
  const result = await sql<CounterRow>`
    select *
    from authored_definition_creation_rate_limits
    where user_id = ${userId}
  `.execute(db)

  return result.rows[0] ?? null
}

async function setCounter(
  db: DBLike,
  userId: string,
  minuteCount: number,
  hourCount: number
): Promise<void> {
  await sql`
    insert into authored_definition_creation_rate_limits (
      user_id,
      minute_window_start,
      minute_count,
      hour_window_start,
      hour_count
    ) values (
      ${userId},
      date_trunc('minute', now() at time zone 'UTC') at time zone 'UTC',
      ${minuteCount},
      date_trunc('hour', now() at time zone 'UTC') at time zone 'UTC',
      ${hourCount}
    )
    on conflict (user_id) do update
    set
      minute_window_start = excluded.minute_window_start,
      minute_count = excluded.minute_count,
      hour_window_start = excluded.hour_window_start,
      hour_count = excluded.hour_count
  `.execute(db)
}

async function restoreCounter(
  db: DBLike,
  userId: string,
  original: CounterRow | null
): Promise<void> {
  await sql`
    delete from authored_definition_creation_rate_limits
    where user_id = ${userId}
  `.execute(db)

  if (!original) return

  await sql`
    insert into authored_definition_creation_rate_limits (
      user_id,
      minute_window_start,
      minute_count,
      hour_window_start,
      hour_count
    ) values (
      ${original.user_id},
      ${original.minute_window_start},
      ${original.minute_count},
      ${original.hour_window_start},
      ${original.hour_count}
    )
  `.execute(db)
}

async function expectLimit(
  promise: Promise<unknown>,
  messageFragment: 'per minute' | 'per hour'
): Promise<void> {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof AuthoredDefinitionCreationRateLimitError)
    assert.match(error.message, new RegExp(messageFragment))
    return true
  })
}

async function main(): Promise<void> {
  const db = createDb({ connectionString: requireLocalDatabaseUrl() })
  const createdSubjectIds = new Set<string>()

  try {
    const { systemId, userId } = await findFixture(db)
    const originalCounter = await readCounter(db, userId)

    try {
      await restoreCounter(db, userId, null)
      const repository = createAuthoredDefinitionRepository(db)

      const firstId = randomUUID()
      createdSubjectIds.add(firstId)
      await repository.saveDraft(createDraftInput(firstId, systemId, userId))
      await repository.saveDraft(createDraftInput(firstId, systemId, userId))
      assert.equal((await readCounter(db, userId))?.minute_count, 1)

      for (let index = 1; index < 10; index += 1) {
        const subjectId = randomUUID()
        createdSubjectIds.add(subjectId)
        await repository.saveDraft(
          createDraftInput(subjectId, systemId, userId, SUBJECT_KINDS[index % SUBJECT_KINDS.length])
        )
      }

      const minuteRejectedId = randomUUID()
      createdSubjectIds.add(minuteRejectedId)
      await expectLimit(
        repository.saveDraft(createDraftInput(minuteRejectedId, systemId, userId, 'VEHICLE')),
        'per minute'
      )
      assert.equal((await readCounter(db, userId))?.minute_count, 10)

      await repository.discardDraft({ subjectId: firstId, subjectKind: 'SPELL', userId })
      assert.equal((await readCounter(db, userId))?.minute_count, 10)

      await setCounter(db, userId, 0, 99)
      const hourAllowedId = randomUUID()
      createdSubjectIds.add(hourAllowedId)
      await repository.saveDraft(createDraftInput(hourAllowedId, systemId, userId))
      assert.equal((await readCounter(db, userId))?.hour_count, 100)

      const hourRejectedId = randomUUID()
      createdSubjectIds.add(hourRejectedId)
      await expectLimit(
        repository.saveDraft(createDraftInput(hourRejectedId, systemId, userId)),
        'per hour'
      )

      await restoreCounter(db, userId, null)
      const rolledBackId = randomUUID()
      createdSubjectIds.add(rolledBackId)
      const rollback = new Error('ROLLBACK_AUTHORED_CREATION_RATE_LIMIT_PROOF')
      await assert.rejects(
        db.transaction().execute(async (trx) => {
          await createAuthoredDefinitionRepository(trx).saveDraft(
            createDraftInput(rolledBackId, systemId, userId)
          )
          throw rollback
        }),
        (error: unknown) => error === rollback
      )
      assert.equal(await readCounter(db, userId), null)
      assert.equal(
        await db
          .selectFrom('authored_definitions')
          .select('subject_id')
          .where('subject_id', '=', rolledBackId)
          .executeTakeFirst(),
        undefined
      )

      await setCounter(db, userId, 9, 9)
      const concurrentIds = [randomUUID(), randomUUID()]
      concurrentIds.forEach((id) => createdSubjectIds.add(id))
      const concurrentResults = await Promise.allSettled(
        concurrentIds.map((id) => repository.saveDraft(createDraftInput(id, systemId, userId)))
      )
      assert.equal(concurrentResults.filter((result) => result.status === 'fulfilled').length, 1)
      assert.equal(
        concurrentResults.filter(
          (result) =>
            result.status === 'rejected' &&
            result.reason instanceof AuthoredDefinitionCreationRateLimitError
        ).length,
        1
      )
      const concurrentCounter = await readCounter(db, userId)
      assert.deepEqual(
        {
          hour: concurrentCounter?.hour_count,
          minute: concurrentCounter?.minute_count
        },
        { hour: 10, minute: 10 }
      )

      const createdConcurrentId = concurrentResults.find((result) => result.status === 'fulfilled')
        ?.value.subjectId
      assert.ok(createdConcurrentId)
      await repository.saveDraft(createDraftInput(createdConcurrentId, systemId, userId))
      assert.equal((await readCounter(db, userId))?.minute_count, 10)

      console.info(
        JSON.stringify({
          concurrentBoundary: 'verified',
          deletionDoesNotReset: 'verified',
          existingDraftSave: 'verified',
          hourlyBoundary: 'verified',
          minuteBoundary: 'verified',
          rollback: 'verified'
        })
      )
    } finally {
      if (createdSubjectIds.size > 0) {
        await db
          .deleteFrom('authored_definitions')
          .where('subject_id', 'in', [...createdSubjectIds])
          .execute()
      }
      await restoreCounter(db, userId, originalCounter)
    }
  } finally {
    await db.destroy()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
