import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import {
  createCharacterMechanicsProjectionRepository,
  createCharacterRepository,
  createDb,
  srdBaselineContent,
  type DBLike
} from '@artificer-toolkit/db'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characters'
import { sql } from 'kysely'

import {
  canonicalize,
  dispatchAndReloadSheetCommand
} from '../../../packages/functions/src/scripts/characterLifecycleIntegrationAssertions.js'
import { proveFixtureLifecycle } from '../../../packages/functions/src/scripts/characterLifecycleIntegrationBuilderProof.js'
import {
  findFixtureCatalog,
  requireRecordByLabel,
  type BuilderResolutionTiming,
  type CharacterRuleEvaluationTiming,
  type CharacterLifecycleFixture,
  type SheetReadTiming
} from '../../../packages/functions/src/scripts/characterLifecycleIntegrationFixtures.js'
import { resolveCharacterForUser } from '../../../packages/functions/src/services/character/characterApplicationService.js'
import { collectCharacterRuleOutputSpellIds } from '../../../packages/functions/src/services/character/characterSpellRuleFacts.js'

const localHosts = new Set(['127.0.0.1', '::1', 'host.docker.internal', 'localhost'])

type FixtureCatalog = Awaited<ReturnType<typeof findFixtureCatalog>>

function requireLoopbackUrl(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is required.`)
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} must be URL-shaped.`)
  }
  if (!localHosts.has(url.hostname.toLowerCase())) {
    throw new Error(`Refusing to run against non-local ${name}.`)
  }
  return value
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort()
}

function fixtureFor(
  catalog: FixtureCatalog,
  caster: 'SORCERER' | 'WARLOCK' | 'WIZARD',
  characterId: string,
  userId: string,
  runId: string
): CharacterLifecycleFixture {
  const classes = srdBaselineContent.subjects.classes
  const common = {
    ...catalog,
    characterId,
    raceId: catalog.humanId,
    raceLabel: 'Human',
    userId
  }
  if (caster === 'WIZARD') {
    const wizard = requireRecordByLabel(classes, 'Wizard', 'class')
    return {
      ...common,
      classes: [{ classId: wizard.id, classLabel: 'Wizard', classLevel: 1 }],
      expectedMaxHitPoints: 8,
      hitpointLevels: [{ level: 1, classId: wizard.id, classLevel: 1, value: 8 }],
      label: `Release Wizard ${runId}`,
      preparedCasterClassId: wizard.id
    }
  }
  if (caster === 'SORCERER') {
    const sorcerer = requireRecordByLabel(classes, 'Sorcerer', 'class')
    const draconic = requireRecordByLabel(classes, 'Draconic Bloodline', 'subclass')
    return {
      ...common,
      classes: [
        {
          classId: sorcerer.id,
          classLabel: 'Sorcerer',
          classLevel: 1,
          specializationLabel: 'Black Dragon',
          subclassId: draconic.id,
          subclassLabel: 'Draconic Bloodline'
        }
      ],
      expectedMaxHitPointBonus: 1,
      expectedMaxHitPoints: 9,
      hitpointLevels: [{ level: 1, classId: sorcerer.id, classLevel: 1, value: 8 }],
      label: `Release Sorcerer ${runId}`
    }
  }
  const warlock = requireRecordByLabel(classes, 'Warlock', 'class')
  const fiend = requireRecordByLabel(classes, 'The Fiend', 'subclass')
  return {
    ...common,
    classes: [
      {
        classId: warlock.id,
        classLabel: 'Warlock',
        classLevel: 1,
        subclassId: fiend.id,
        subclassLabel: 'The Fiend'
      }
    ],
    expectedMaxHitPoints: 10,
    hitpointLevels: [{ level: 1, classId: warlock.id, classLevel: 1, value: 10 }],
    label: `Release Warlock ${runId}`
  }
}

async function requireCurrentMechanics(
  db: DBLike,
  fixture: CharacterLifecycleFixture,
  expectedStreamVersion: number,
  expectedRuleRevisionId?: string
) {
  const row = await createCharacterRepository(db).findById(fixture.characterId)
  assert.ok(row?.rule_pack_revision_id, `${fixture.label} has no pinned rule revision.`)
  if (expectedRuleRevisionId) assert.equal(row.rule_pack_revision_id, expectedRuleRevisionId)
  const mechanics = await createCharacterMechanicsProjectionRepository(db).requireCurrent({
    characterId: fixture.characterId,
    expectedRuleRevisionId: row.rule_pack_revision_id,
    expectedStreamVersion
  })
  return { mechanics, ruleRevisionId: row.rule_pack_revision_id }
}

function classSource(
  sheet: CharacterSheetResponseDto,
  classId: string,
  options: { canPrepare?: boolean } = {}
) {
  for (const spell of sheet.spells.spells) {
    if (spell.level < 1) continue
    for (const source of spell.sources ?? []) {
      if (source.classId !== classId) continue
      if (source.source.sourceKind !== 'CLASS' && source.source.sourceKind !== 'SUBCLASS') continue
      if (options.canPrepare !== undefined && source.canPrepare !== options.canPrepare) continue
      return { source, spell }
    }
  }
  return null
}

function knownSpellIds(
  sheet: CharacterSheetResponseDto,
  classId: string,
  fallbackSpellId: string
): string[] {
  const known = sheet.spells.spells.flatMap((spell) => {
    const source = (spell.sources ?? []).find(
      (candidate) =>
        candidate.classId === classId &&
        (candidate.source.sourceKind === 'CLASS' || candidate.source.sourceKind === 'SUBCLASS') &&
        (candidate.acquisition === 'KNOWN' || spell.known === true)
    )
    return source && spell.level >= 1 ? [spell.id] : []
  })
  return sortedUnique(known.length > 0 ? known : [fallbackSpellId])
}

async function assertCanonicalClassSpellState(
  db: DBLike,
  fixture: CharacterLifecycleFixture,
  classId: string,
  state: 'KNOWN' | 'PREPARED',
  expectedSpellIds: readonly string[]
): Promise<void> {
  const rows = await db
    .selectFrom('character_class_spells')
    .select('spell_id')
    .where('character_id', '=', fixture.characterId)
    .where('class_id', '=', classId)
    .where('state', '=', state)
    .execute()
  assert.deepEqual(
    sortedUnique(rows.map(({ spell_id }) => spell_id)),
    sortedUnique(expectedSpellIds)
  )
}

async function proveKnownCommand(
  db: DBLike,
  fixture: CharacterLifecycleFixture,
  sheet: CharacterSheetResponseDto,
  requireNoPreparation: boolean
): Promise<CharacterSheetResponseDto> {
  const classId = fixture.classes[0]?.classId
  assert.ok(classId)
  const selected = classSource(sheet, classId)
  assert.ok(selected, `${fixture.label} exposed no committed CLASS/SUBCLASS leveled Spell.`)
  if (requireNoPreparation) assert.equal(selected.source.canPrepare, false)
  const requestedSpellIds = knownSpellIds(sheet, classId, selected.spell.id)
  const before = await requireCurrentMechanics(db, fixture, sheet.meta.streamVersion)
  const next = await dispatchAndReloadSheetCommand(db, fixture, sheet, {
    type: 'SET_KNOWN_SPELLS',
    classId,
    spellIds: requestedSpellIds
  })
  assert.equal(next.meta.streamVersion, sheet.meta.streamVersion + 1)
  await assertCanonicalClassSpellState(db, fixture, classId, 'KNOWN', requestedSpellIds)
  await requireCurrentMechanics(db, fixture, next.meta.streamVersion, before.ruleRevisionId)
  return next
}

async function provePreparedCommand(
  db: DBLike,
  fixture: CharacterLifecycleFixture,
  sheet: CharacterSheetResponseDto
): Promise<CharacterSheetResponseDto> {
  const classId = fixture.classes[0]?.classId
  assert.ok(classId)
  const selected = classSource(sheet, classId, { canPrepare: true })
  assert.ok(selected, `${fixture.label} exposed no committed preparable leveled Spell.`)
  const before = await requireCurrentMechanics(db, fixture, sheet.meta.streamVersion)
  const next = await dispatchAndReloadSheetCommand(db, fixture, sheet, {
    type: 'SET_PREPARED_SPELLS',
    classId,
    spellIds: [selected.spell.id]
  })
  assert.equal(next.meta.streamVersion, sheet.meta.streamVersion + 1)
  await assertCanonicalClassSpellState(db, fixture, classId, 'PREPARED', [selected.spell.id])
  assert.equal(
    next.spells.spells
      .find(({ id }) => id === selected.spell.id)
      ?.sources?.find((source) => source.classId === classId && source.canPrepare)?.prepared,
    true
  )
  await requireCurrentMechanics(db, fixture, next.meta.streamVersion, before.ruleRevisionId)
  return next
}

function assertPactMagic(
  sheet: CharacterSheetResponseDto,
  mechanics: Awaited<ReturnType<typeof requireCurrentMechanics>>['mechanics'],
  classId: string
) {
  const publicSlot = sheet.spells.slots.find(({ slotKey }) => slotKey === 'PACT')
  assert.deepEqual(publicSlot, {
    slotKey: 'PACT',
    label: 'Pact Magic',
    level: 1,
    used: 0,
    max: 1,
    remaining: 1
  })
  const ruleSlot = mechanics.rulePolicyOutput.spellSlots.pactMagic
  assert.deepEqual(ruleSlot, {
    sourceClassId: classId,
    slots: 1,
    level: 1,
    rawUsed: 0,
    effectiveUsed: 0,
    remaining: 1
  })
  return canonicalize({ publicSlot, ruleSlot })
}

async function assertCharacterAbsent(
  db: ReturnType<typeof createDb>,
  characterId: string,
  characterIdTables: readonly string[]
): Promise<void> {
  assert.equal(await createCharacterRepository(db).findById(characterId), null)
  for (const tableName of characterIdTables) {
    const result = await sql<{ count: string }>`
      select count(*)::text as count
      from ${sql.table(`public.${tableName}`)}
      where character_id = ${characterId}::uuid
    `.execute(db)
    assert.equal(result.rows[0]?.count, '0', `${tableName} retained ${characterId}.`)
  }
  const routes = await db
    .selectFrom('authored_route_ids')
    .select('subject_id')
    .where('subject_kind', '=', 'CHARACTER')
    .where('subject_id', '=', characterId)
    .execute()
  assert.deepEqual(routes, [])
}

async function main(): Promise<void> {
  const databaseUrl = requireLoopbackUrl(
    'DATABASE_CONNECTION_STRING',
    process.env.DATABASE_CONNECTION_STRING
  )
  const supabaseUrl = requireLoopbackUrl('SUPABASE_URL', process.env.SUPABASE_URL)
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!secretKey) throw new Error('SUPABASE_SECRET_KEY is required.')
  const db = createDb({ connectionString: databaseUrl })
  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false }
  })
  const runId = randomUUID().replaceAll('-', '')
  const characterIds = [randomUUID(), randomUUID(), randomUUID()]
  const username = `g6${runId.slice(0, 20)}`
  const email = `gate6-casters-${runId}@example.test`
  const password = `Local-${randomUUID()}-Aa1!`
  const characterIdTables = await sql<{ table_name: string }>`
    select columns.table_name
    from information_schema.columns columns
    join information_schema.tables tables
      on tables.table_schema = columns.table_schema
      and tables.table_name = columns.table_name
      and tables.table_type = 'BASE TABLE'
    where columns.table_schema = 'public'
      and columns.column_name = 'character_id'
    order by columns.table_name
  `.execute(db)
  let userId: string | null = null
  let runError: unknown
  const cleanupErrors: unknown[] = []

  try {
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password,
      user_metadata: { username }
    })
    if (created.error) throw created.error
    assert.ok(created.data.user)
    userId = created.data.user.id
    const catalog = await findFixtureCatalog(db)
    const casters = ['WIZARD', 'SORCERER', 'WARLOCK'] as const
    for (const [index, caster] of casters.entries()) {
      const fixture = fixtureFor(catalog, caster, characterIds[index]!, userId, runId)
      const rollback = new Error(`ROLLBACK_${caster}_${runId}`)
      try {
        await db.transaction().execute(async (trx) => {
          const resolutionTimings: BuilderResolutionTiming[] = []
          const sheetReadTimings: SheetReadTiming[] = []
          const ruleEvaluationTimings: CharacterRuleEvaluationTiming[] = []
          let sheet = await proveFixtureLifecycle(
            trx,
            fixture,
            resolutionTimings,
            sheetReadTimings,
            ruleEvaluationTimings
          )
          const initial = await requireCurrentMechanics(trx, fixture, sheet.meta.streamVersion)
          const classId = fixture.classes[0]!.classId
          if (caster === 'WIZARD') {
            const facts = initial.mechanics.rulePolicyInput
            const actionSpellIds = sortedUnique(
              facts.spellActionFacts.map(({ spellId }) => spellId)
            )
            const castSpellIds = sortedUnique(
              facts.spellCastCandidates.map(({ spellId }) => spellId)
            )
            const outputSpellIds = sortedUnique([
              ...collectCharacterRuleOutputSpellIds(initial.mechanics.rulePolicyOutput)
            ])
            const vectorSpellIds = sortedUnique(
              initial.mechanics.authoredVersionVector
                .filter(({ subjectKind }) => subjectKind === 'SPELL')
                .map(({ subjectId }) => subjectId)
            )
            const normalizedFactsBytes = Buffer.byteLength(JSON.stringify(facts), 'utf8')
            assert.ok(normalizedFactsBytes <= 262_144)
            assert.equal(facts.spellAccessCandidates.length, 86)
            assert.equal(facts.spellPreparationCatalog.length, 204)
            assert.equal(
              facts.spellPreparationCatalog.filter(({ spellLevel }) => spellLevel === 0).length,
              14
            )
            assert.equal(actionSpellIds.length, 9)
            assert.deepEqual(castSpellIds, actionSpellIds)
            assert.deepEqual(outputSpellIds, actionSpellIds)
            assert.deepEqual(vectorSpellIds, actionSpellIds)
            console.log(JSON.stringify({ gate3Result: 'B2', normalizedFactsBytes, status: 'PASS' }))
            sheet = await proveKnownCommand(trx, fixture, sheet, false)
            console.log(JSON.stringify({ gate3Result: 'B3', status: 'PASS' }))
            sheet = await provePreparedCommand(trx, fixture, sheet)
            console.log(JSON.stringify({ gate3Result: 'B4', status: 'PASS' }))
          } else if (caster === 'SORCERER') {
            const persisted = await createCharacterRepository(trx).findAuthoredById(
              fixture.characterId
            )
            assert.ok(persisted)
            const resolved = await resolveCharacterForUser(
              trx,
              { character: persisted, mode: 'edit' },
              fixture.userId
            )
            const expected = resolved.view.classes.selectedClasses
              .find((candidate) => candidate.classId === classId)
              ?.specializationOptions.find(({ label }) => label === 'Black Dragon')
            assert.ok(expected)
            assert.equal(persisted.intent.classes[0]?.specializationId, expected.id)
            console.log(JSON.stringify({ gate3Result: 'B7', status: 'PASS' }))
            sheet = await proveKnownCommand(trx, fixture, sheet, true)
            console.log(JSON.stringify({ gate3Result: 'B8', status: 'PASS' }))
          } else {
            const beforePact = assertPactMagic(sheet, initial.mechanics, classId)
            assert.equal(
              initial.mechanics.rulePolicyInput.resourcePoolCandidates.filter(
                ({ ownerKind }) => ownerKind === 'SPELL_SOURCE'
              ).length,
              0
            )
            assert.equal(
              initial.mechanics.rulePolicyInput.spellCastCandidates.filter(
                ({ resourceOwnerKey }) => (resourceOwnerKey?.length ?? 0) > 240
              ).length,
              0
            )
            console.log(JSON.stringify({ gate3Result: 'B9', status: 'PASS' }))
            sheet = await proveKnownCommand(trx, fixture, sheet, true)
            const after = await requireCurrentMechanics(trx, fixture, sheet.meta.streamVersion)
            assert.deepEqual(assertPactMagic(sheet, after.mechanics, classId), beforePact)
            console.log(JSON.stringify({ gate3Result: 'B10', status: 'PASS' }))
          }
          throw rollback
        })
      } catch (error) {
        if (error !== rollback) throw error
      }
      await assertCharacterAbsent(
        db,
        fixture.characterId,
        characterIdTables.rows.map(({ table_name }) => table_name)
      )
    }
  } catch (error) {
    runError = error
  } finally {
    if (userId) {
      try {
        let deletion = await admin.auth.admin.deleteUser(userId)
        if (deletion.error?.status === 500) {
          await new Promise((resolve) => setTimeout(resolve, 250))
          deletion = await admin.auth.admin.deleteUser(userId)
        }
        if (deletion.error) {
          cleanupErrors.push(deletion.error)
        } else {
          const counts = await sql<{ auth_count: string; profile_count: string }>`
            select
              (select count(*)::text from auth.users where id = ${userId}::uuid) as auth_count,
              (select count(*)::text from public.profiles where id = ${userId}::uuid) as profile_count
          `.execute(db)
          assert.deepEqual(counts.rows[0], { auth_count: '0', profile_count: '0' })
        }
      } catch (error) {
        cleanupErrors.push(error)
      }
    }
    try {
      await db.destroy()
    } catch (error) {
      cleanupErrors.push(error)
    }
  }

  if (runError && cleanupErrors.length > 0) {
    throw new AggregateError([runError, ...cleanupErrors], 'Caster proof and cleanup failed.')
  }
  if (runError) throw runError
  if (cleanupErrors.length > 0) throw new AggregateError(cleanupErrors, 'Caster cleanup failed.')
  console.log(JSON.stringify({ cleanup: 'PASS', fixedGate3Results: '7/7', runId }))
}

await main()
