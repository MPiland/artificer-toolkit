import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import { sql, type Transaction } from 'kysely'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { createDb } from '../client.js'
import {
  ConcurrencyError,
  createCharacterRepository,
  type CharacterSheetStatePatch
} from '../domains/subjects/repositories/character.js'
import { createCharacterEventRepository } from '../domains/subjects/repositories/characterEvent.js'
import { createCharacterSheetAdjustmentRepository } from '../domains/subjects/repositories/characterSheetAdjustment.js'
import type { Database } from '../types/index.js'
type Db = ReturnType<typeof createDb>
type CharacterTransaction = Transaction<Database>

const LOCAL_DATABASE_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])

function requireLocalDatabaseUrl(): string {
  const connectionString = process.env.DATABASE_CONNECTION_STRING
  if (!connectionString) {
    throw new Error(
      'DATABASE_CONNECTION_STRING is required for the Character Sheet integration proof.'
    )
  }

  let host: string
  try {
    host = new URL(connectionString).hostname.toLowerCase()
  } catch {
    throw new Error(
      'The Character Sheet integration proof requires a URL-shaped Postgres connection string.'
    )
  }

  if (!LOCAL_DATABASE_HOSTS.has(host)) {
    throw new Error(
      `Refusing to run the Character Sheet integration proof against non-local database host "${host}".`
    )
  }

  return connectionString
}

interface FixtureIdentity {
  backgroundId: string
  classId: string
  raceId: string
  speedId: string
  spellId: string
  systemId: string
  userId: string
}

async function findFixtureIdentity(db: CharacterTransaction): Promise<FixtureIdentity> {
  const [systemResult, userResult] = await Promise.all([
    sql<{ id: string }>`
      select id::text as id
      from systems
      where ruleset_code = 'dnd5e'
        and ruleset_version = '2014'
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

  if (!systemId) {
    throw new Error(
      'The local database has no D&D 5e 2014 system. Run `yarn seed:srd:local` first.'
    )
  }
  if (!userId) {
    throw new Error('The local database has no auth user. Run `yarn seed:srd:local` first.')
  }

  const [backgroundResult, classResult, raceResult, speedResult, spellResult] = await Promise.all([
    sql<{ id: string }>`
      select id::text as id
      from backgrounds
      where system_id = ${systemId}::uuid
      order by created_at, id
      limit 1
    `.execute(db),
    sql<{ id: string }>`
      select id::text as id
      from classes
      where system_id = ${systemId}::uuid
        and category = 'BASE'
      order by created_at, id
      limit 1
    `.execute(db),
    sql<{ id: string }>`
      select id::text as id
      from races
      where system_id = ${systemId}::uuid
        and category = 'BASE'
      order by created_at, id
      limit 1
    `.execute(db),
    sql<{ id: string }>`
      select id::text as id
      from speeds
      where system_id = ${systemId}::uuid
      order by created_at, id
      limit 1
    `.execute(db),
    sql<{ id: string }>`
      select id::text as id
      from spells
      where system_id = ${systemId}::uuid
      order by created_at, id
      limit 1
    `.execute(db)
  ])
  const backgroundId = backgroundResult.rows[0]?.id
  const classId = classResult.rows[0]?.id
  const raceId = raceResult.rows[0]?.id
  const speedId = speedResult.rows[0]?.id
  const spellId = spellResult.rows[0]?.id

  if (!backgroundId || !classId || !raceId || !speedId || !spellId) {
    throw new Error('The local D&D 5e 2014 corpus is incomplete. Run `yarn seed:srd:local` first.')
  }

  return { backgroundId, classId, raceId, speedId, spellId, systemId, userId }
}

interface SheetSnapshot {
  character: Array<{
    inspiration: boolean
    streamVersion: number
  }>
  exhaustion: Array<{
    level: number
    notes: string | null
  }>
  hitDice: Array<{
    die: number
    total: number
    used: number
  }>
  hitpoints: Array<{
    current: number | null
    legacyMaxOverride: number | null
    temp: number | null
  }>
  adjustments: Array<{
    field: string
    sourceNote: string | null
    value: number
  }>
  events: Array<{
    commandId: string
    eventType: string
    schemaVersion: number
  }>
  spellSlots: Array<{
    slotKey: string
    used: number
  }>
}

async function readSheetSnapshot(
  db: CharacterTransaction,
  characterId: string
): Promise<SheetSnapshot> {
  const [character, exhaustion, hitDice, hitpoints, adjustments, events, spellSlots] =
    await Promise.all([
      sql<{ inspiration: boolean; stream_version: number }>`
      select inspiration, stream_version
      from characters
      where id = ${characterId}::uuid
    `.execute(db),
      sql<{ level: number; notes: string | null }>`
      select level, notes
      from character_exhaustion
      where character_id = ${characterId}::uuid
    `.execute(db),
      sql<{ die: number; total: number; used: number }>`
      select die, total, used
      from character_hit_dice_state
      where character_id = ${characterId}::uuid
      order by die
    `.execute(db),
      sql<{ current: number | null; max_override: number | null; temp: number | null }>`
      select current, max_override, temp
      from character_hitpoint_state
      where character_id = ${characterId}::uuid
    `.execute(db),
      sql<{
        field_kind: string
        integer_value: number
        source_note: string | null
      }>`
      select field_kind, integer_value, source_note
      from character_hitpoint_adjustments
      where character_id = ${characterId}::uuid
      order by field_kind
    `.execute(db),
      sql<{ command_id: string; event_type: string; schema_version: number }>`
      select command_id::text, event_type, schema_version
      from character_events
      where character_id = ${characterId}::uuid
      order by occurred_at, event_id
    `.execute(db),
      sql<{ slot_key: string; used: number }>`
      select slot_key, used
      from character_spell_slot_state
      where character_id = ${characterId}::uuid
      order by slot_key
    `.execute(db)
    ])

  return {
    character: character.rows.map((row) => ({
      inspiration: row.inspiration,
      streamVersion: row.stream_version
    })),
    exhaustion: exhaustion.rows,
    hitDice: hitDice.rows,
    hitpoints: hitpoints.rows.map((row) => ({
      current: row.current,
      legacyMaxOverride: row.max_override,
      temp: row.temp
    })),
    adjustments: adjustments.rows.map((row) => ({
      field: row.field_kind,
      sourceNote: row.source_note,
      value: row.integer_value
    })),
    events: events.rows.map((row) => ({
      commandId: row.command_id,
      eventType: row.event_type,
      schemaVersion: row.schema_version
    })),
    spellSlots: spellSlots.rows.map((row) => ({
      slotKey: row.slot_key,
      used: row.used
    }))
  }
}

async function insertFixture(
  db: CharacterTransaction,
  characterId: string,
  identity: FixtureIdentity
): Promise<void> {
  const fixture: CharacterAuthored = {
    id: characterId,
    label: 'Character Sheet persistence proof',
    description: 'Created inside a rollback-only integration transaction.',
    status: 'ACTIVE',
    profile: {},
    systemId: identity.systemId,
    primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
    userId: identity.userId,
    intent: {
      advancement: { method: 'MILESTONE' },
      race: { raceId: identity.raceId },
      background: { backgroundId: identity.backgroundId },
      classes: [{ classId: identity.classId, classLevel: 1 }],
      abilities: {
        method: 'STANDARD_ARRAY',
        assignments: [{ ability: 'STRENGTH', option: '15' }]
      },
      hitpoints: {
        method: 'FIXED',
        levels: [{ level: 1, classId: identity.classId, classLevel: 1, value: 10 }]
      },
      featureAcquisitions: []
    },
    state: {
      equipment: { inventory: [], equipped: [], attuned: [] },
      currency: [],
      hitpoints: {
        current: 10,
        temp: 0,
        hitDice: [{ die: 8, total: 2, used: 0 }]
      },
      spellSlots: [{ slotKey: '1', used: 1 }],
      exhaustion: { level: 2, notes: 'Untouched control row' }
    }
  }

  await createCharacterRepository(db).upsertAuthored(fixture)
}

async function assertFixtureWasRolledBack(db: Db, characterId: string): Promise<void> {
  const result = await sql<{ count: number }>`
    select count(*)::int as count
    from characters
    where id = ${characterId}::uuid
  `.execute(db)

  assert.equal(
    result.rows[0]?.count,
    0,
    'The integration fixture escaped its rollback transaction.'
  )
}

async function assertCharacterSheetAdjustmentPolicies(db: CharacterTransaction): Promise<void> {
  const result = await sql<{
    tablename: string
    qual: string | null
    with_check: string | null
  }>`
    select tablename, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and policyname = 'Character owners manage Sheet state'
    order by tablename
  `.execute(db)

  assert.equal(result.rows.length, 15)
  for (const policy of result.rows) {
    assert.match(policy.qual ?? '', /characters/u)
    assert.match(policy.qual ?? '', /auth\.uid/u)
    assert.match(policy.with_check ?? '', /characters/u)
    assert.match(policy.with_check ?? '', /auth\.uid/u)
  }
}

async function runLegacyHitPointOverrideBackfill(db: CharacterTransaction): Promise<void> {
  await sql`
    insert into character_hitpoint_adjustments (
      id,
      character_id,
      field_kind,
      integer_value,
      source_note,
      created_by,
      updated_by
    )
    select
      gen_random_uuid(),
      hitpoints.character_id,
      'MAXIMUM_OVERRIDE',
      hitpoints.max_override,
      'Migrated maximum HP override',
      characters.user_id,
      characters.user_id
    from character_hitpoint_state hitpoints
    join characters on characters.id = hitpoints.character_id
    where hitpoints.max_override is not null
    on conflict (character_id, field_kind) do nothing
  `.execute(db)
}

async function main(): Promise<void> {
  const connectionString = requireLocalDatabaseUrl()
  const db = createDb({ connectionString })
  try {
    const characterId = randomUUID()
    const rollback = new Error('ROLLBACK_CHARACTER_SHEET_INTEGRATION_PROOF')
    let completed = false

    try {
      await db.transaction().execute(async (trx) => {
        const identity = await findFixtureIdentity(trx)
        await assertCharacterSheetAdjustmentPolicies(trx)
        await insertFixture(trx, characterId, identity)

        const repository = createCharacterRepository(trx)
        const adjustmentRepository = createCharacterSheetAdjustmentRepository(trx)
        await sql`
          update character_hitpoint_state
          set max_override = 14
          where character_id = ${characterId}::uuid
        `.execute(trx)
        await runLegacyHitPointOverrideBackfill(trx)
        await runLegacyHitPointOverrideBackfill(trx)
        const backfilledAdjustments = await adjustmentRepository.listByCharacter(characterId)
        assert.equal(backfilledAdjustments.length, 1)
        assert.equal(
          backfilledAdjustments[0]?.family === 'HIT_POINTS'
            ? backfilledAdjustments[0].value
            : undefined,
          14
        )
        assert.equal(
          await adjustmentRepository.remove({
            characterId,
            adjustmentId: backfilledAdjustments[0]!.id,
            family: 'HIT_POINTS'
          }),
          true
        )
        await sql`
          update character_hitpoint_state
          set max_override = null
          where character_id = ${characterId}::uuid
        `.execute(trx)

        const before = await readSheetSnapshot(trx, characterId)
        const commandId = randomUUID()
        const patches = [
          {
            kind: 'HITPOINTS',
            value: {
              current: 7,
              temp: 3,
              hitDice: [{ die: 8, total: 2, used: 1 }]
            }
          }
        ] satisfies CharacterSheetStatePatch[]

        const nextStreamVersion = await repository.patchSheetState(characterId, patches, {
          expectedStreamVersion: 0,
          afterPersist: async (eventTrx, streamVersion) => {
            assert.equal(streamVersion, 1)
            await createCharacterSheetAdjustmentRepository(eventTrx).upsert({
              id: randomUUID(),
              characterId,
              actorId: identity.userId,
              family: 'HIT_POINTS',
              field: 'MAXIMUM_OVERRIDE',
              value: 12,
              sourceNote: 'Integration proof'
            })
            await createCharacterEventRepository(eventTrx).append({
              eventId: randomUUID(),
              characterId,
              occurredAt: new Date().toISOString(),
              actorId: identity.userId,
              commandId,
              schemaVersion: 1,
              type: 'CHARACTER_SHEET_COMMAND_APPLIED',
              commandType: 'SET_HITPOINTS',
              commandFingerprint: 'integration-hitpoints-command',
              summary: 'Set current hit points to 7.'
            })
          }
        })
        const after = await readSheetSnapshot(trx, characterId)

        assert.equal(nextStreamVersion, 1)
        assert.deepEqual(after.character, [{ inspiration: false, streamVersion: 1 }])
        assert.deepEqual(after.hitpoints, [{ current: 7, legacyMaxOverride: null, temp: 3 }])
        assert.deepEqual(after.adjustments, [
          {
            field: 'MAXIMUM_OVERRIDE',
            sourceNote: 'Integration proof',
            value: 12
          }
        ])
        const persistedAdjustments = await adjustmentRepository.listByCharacter(characterId)
        assert.equal(persistedAdjustments.length, 1)
        assert.equal(persistedAdjustments[0]?.sourceNote, 'Integration proof')

        await adjustmentRepository.setMovementPreference({
          characterId,
          actorId: identity.userId,
          preference: { mode: 'EXPLICIT', speedId: identity.speedId }
        })
        assert.deepEqual(await adjustmentRepository.getMovementPreference(characterId), {
          mode: 'EXPLICIT',
          speedId: identity.speedId
        })
        await adjustmentRepository.setMovementPreference({
          characterId,
          actorId: identity.userId,
          preference: { mode: 'AUTO' }
        })
        assert.deepEqual(await adjustmentRepository.getMovementPreference(characterId), {
          mode: 'AUTO'
        })

        assert.deepEqual(after.hitDice, [{ die: 8, total: 2, used: 1 }])
        assert.deepEqual(after.events, [
          {
            commandId,
            eventType: 'CHARACTER_SHEET_COMMAND_APPLIED',
            schemaVersion: 1
          }
        ])
        assert.deepEqual(after.exhaustion, before.exhaustion)
        assert.deepEqual(after.spellSlots, before.spellSlots)

        let staleCallbackCalled = false
        await assert.rejects(
          repository.patchSheetState(
            characterId,
            [
              {
                kind: 'HITPOINTS',
                value: { current: 1, hitDice: [] }
              }
            ],
            {
              expectedStreamVersion: 0,
              afterPersist: async () => {
                staleCallbackCalled = true
              }
            }
          ),
          (error: unknown) => error instanceof ConcurrencyError
        )
        assert.equal(staleCallbackCalled, false)
        assert.deepEqual(await readSheetSnapshot(trx, characterId), after)

        const atomicitySavepoint = 'character_sheet_event_atomicity'
        await sql.raw(`savepoint ${atomicitySavepoint}`).execute(trx)
        const callbackFailure = new Error('INTENTIONAL_EVENT_CALLBACK_FAILURE')
        const failedCommandId = randomUUID()
        try {
          await repository.patchSheetState(
            characterId,
            [
              {
                kind: 'HITPOINTS',
                value: { current: 2, hitDice: [] }
              }
            ],
            {
              expectedStreamVersion: 1,
              afterPersist: async (eventTrx) => {
                await createCharacterEventRepository(eventTrx).append({
                  eventId: randomUUID(),
                  characterId,
                  occurredAt: new Date().toISOString(),
                  actorId: identity.userId,
                  commandId: failedCommandId,
                  schemaVersion: 1,
                  type: 'CHARACTER_SHEET_COMMAND_APPLIED',
                  commandType: 'SET_HITPOINTS',
                  commandFingerprint: 'integration-failed-hitpoints-command',
                  summary: 'This event must roll back with its state patch.'
                })
                throw callbackFailure
              }
            }
          )
          assert.fail('The intentional event callback failure did not reject the state patch.')
        } catch (error) {
          assert.equal(error, callbackFailure)
          await sql.raw(`rollback to savepoint ${atomicitySavepoint}`).execute(trx)
          await sql.raw(`release savepoint ${atomicitySavepoint}`).execute(trx)
        }
        assert.deepEqual(await readSheetSnapshot(trx, characterId), after)

        assert.equal(
          await adjustmentRepository.remove({
            characterId,
            adjustmentId: persistedAdjustments[0]!.id,
            family: 'HIT_POINTS'
          }),
          true
        )
        assert.deepEqual(await adjustmentRepository.listByCharacter(characterId), [])

        let streamVersion = await repository.patchSheetState(
          characterId,
          [
            {
              kind: 'CLASS_SPELLS',
              value: [
                {
                  classId: identity.classId,
                  spells: {
                    learned: [identity.spellId],
                    prepared: [identity.spellId]
                  }
                }
              ]
            }
          ],
          { expectedStreamVersion: 1 }
        )
        assert.equal(streamVersion, 2)
        let hydrated = await repository.findAuthoredById(characterId)
        assert.deepEqual(hydrated?.state.classes, [
          {
            classId: identity.classId,
            spells: {
              learned: [identity.spellId],
              prepared: [identity.spellId]
            }
          }
        ])

        streamVersion = await repository.patchSheetState(
          characterId,
          [
            {
              kind: 'CLASS_SPELLS',
              value: [
                {
                  classId: identity.classId,
                  spells: { learned: [identity.spellId] }
                }
              ]
            }
          ],
          { expectedStreamVersion: streamVersion }
        )
        assert.equal(streamVersion, 3)
        hydrated = await repository.findAuthoredById(characterId)
        assert.deepEqual(hydrated?.state.classes, [
          {
            classId: identity.classId,
            spells: { learned: [identity.spellId] }
          }
        ])

        const noteGroupId = randomUUID()
        const noteId = randomUUID()
        const createdAt = '2026-07-14T12:00:00.000Z'
        streamVersion = await repository.patchSheetState(
          characterId,
          [
            {
              kind: 'NOTES',
              groups: [
                {
                  id: noteGroupId,
                  label: 'Session Notes',
                  sortOrder: 0,
                  kind: 'SESSION'
                }
              ],
              notes: [
                {
                  id: noteId,
                  title: 'The western gate',
                  body: 'An artificer sigil marks the arch.',
                  groupId: noteGroupId,
                  pinned: false,
                  createdAt,
                  updatedAt: createdAt
                }
              ]
            }
          ],
          { expectedStreamVersion: streamVersion }
        )
        assert.equal(streamVersion, 4)
        hydrated = await repository.findAuthoredById(characterId)
        assert.deepEqual(hydrated?.state.noteGroups, [
          {
            id: noteGroupId,
            label: 'Session Notes',
            sortOrder: 0,
            kind: 'SESSION'
          }
        ])
        assert.deepEqual(hydrated?.state.notes, [
          {
            id: noteId,
            title: 'The western gate',
            body: 'An artificer sigil marks the arch.',
            groupId: noteGroupId,
            pinned: false,
            createdAt,
            updatedAt: createdAt
          }
        ])

        const updatedAt = '2026-07-14T13:00:00.000Z'
        streamVersion = await repository.patchSheetState(
          characterId,
          [
            {
              kind: 'NOTES',
              groups: [
                {
                  id: noteGroupId,
                  label: 'Expedition Notes',
                  sortOrder: 2,
                  kind: 'SESSION'
                }
              ],
              notes: [
                {
                  id: noteId,
                  title: 'The sealed western gate',
                  body: 'The artificer sigil reacts to thunder.',
                  groupId: noteGroupId,
                  pinned: true,
                  createdAt,
                  updatedAt
                }
              ]
            }
          ],
          { expectedStreamVersion: streamVersion }
        )
        assert.equal(streamVersion, 5)
        hydrated = await repository.findAuthoredById(characterId)
        assert.equal(hydrated?.state.noteGroups?.[0]?.label, 'Expedition Notes')
        assert.equal(hydrated?.state.noteGroups?.[0]?.sortOrder, 2)
        assert.deepEqual(hydrated?.state.notes?.[0], {
          id: noteId,
          title: 'The sealed western gate',
          body: 'The artificer sigil reacts to thunder.',
          groupId: noteGroupId,
          pinned: true,
          createdAt,
          updatedAt
        })

        streamVersion = await repository.patchSheetState(
          characterId,
          [
            {
              kind: 'NOTES',
              groups: hydrated?.state.noteGroups,
              notes: undefined
            }
          ],
          { expectedStreamVersion: streamVersion }
        )
        assert.equal(streamVersion, 6)
        hydrated = await repository.findAuthoredById(characterId)
        assert.equal(hydrated?.state.notes, undefined)
        assert.equal(hydrated?.state.noteGroups?.length, 1)

        streamVersion = await repository.patchSheetState(
          characterId,
          [{ kind: 'NOTES', groups: undefined, notes: undefined }],
          { expectedStreamVersion: streamVersion }
        )
        assert.equal(streamVersion, 7)
        hydrated = await repository.findAuthoredById(characterId)
        assert.equal(hydrated?.state.noteGroups, undefined)
        assert.equal(hydrated?.state.notes, undefined)

        completed = true
        throw rollback
      })
    } catch (error) {
      if (error !== rollback) throw error
    }

    assert.equal(
      completed,
      true,
      'The Character Sheet integration proof did not reach its assertions.'
    )
    await assertFixtureWasRolledBack(db, characterId)
    console.info(
      JSON.stringify({
        adjustmentClear: 'verified',
        adjustmentRoundTrip: 'verified',
        backfillIdempotency: 'verified',
        classSpellRoundTrip: 'verified',
        eventAtomicity: 'verified',
        localDatabaseOnly: true,
        movementPreference: 'verified',
        noteLifecycle: 'verified',
        ownerRlsPolicy: 'verified',
        rollback: 'verified',
        staleVersion: 'verified',
        touchedStateOnly: 'verified'
      })
    )
  } finally {
    await db.destroy()
  }
}

await main()
