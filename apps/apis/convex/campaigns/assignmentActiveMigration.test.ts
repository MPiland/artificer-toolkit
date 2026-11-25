import migrations from '@convex-dev/migrations/test'
import { defineSchema, makeFunctionReference, type WithoutSystemFields } from 'convex/server'
import { expect, it, vi } from 'vitest'
import { convexTest } from '../../tests/convexTest'
import type { Doc } from '../_generated/dataModel'
import schema from '../schema'

const runAssignmentActiveMigration = makeFunctionReference<
  'mutation',
  Record<string, never>,
  unknown
>('campaigns/assignmentActiveMigration:run')
// Development rows predate `active`, so the legacy store must accept a row without it.
const legacySchema = defineSchema(schema.tables, { schemaValidation: false })

it('marks every Character assigned before the bench existed as its player’s Active Character (D236)', async ({
  onTestFinished
}) => {
  vi.useFakeTimers()
  onTestFinished(() => {
    vi.useRealTimers()
  })
  const t = convexTest(legacySchema, import.meta.glob('/apps/apis/convex/**/*.*s'))
  migrations.register(t)
  const assignedAt = new Date().toISOString()
  const legacyRow = (characterId: string, active?: boolean) => ({
    campaignId: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    characterId,
    assignedAt,
    ...(active === undefined ? {} : { active })
  })
  const [legacyId, benchedId] = [crypto.randomUUID(), crypto.randomUUID()]
  await t.run(async (ctx) => {
    for (const row of [legacyRow(legacyId), legacyRow(benchedId, false)])
      await ctx.db.insert(
        'campaignCharacterAssignments',
        row as WithoutSystemFields<Doc<'campaignCharacterAssignments'>>
      )
  })

  await t.mutation(runAssignmentActiveMigration, {})
  await t.finishAllScheduledFunctions(vi.runAllTimers)
  // A second pass proves the migration is idempotent on migrated rows.
  await t.mutation(runAssignmentActiveMigration, {})
  await t.finishAllScheduledFunctions(vi.runAllTimers)

  const rows = await t.run((ctx) => ctx.db.query('campaignCharacterAssignments').collect())
  expect(Object.fromEntries(rows.map(({ characterId, active }) => [characterId, active]))).toEqual({
    [legacyId]: true,
    [benchedId]: false
  })
})
