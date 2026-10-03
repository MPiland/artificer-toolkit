import type { GenericSchema, SchemaDefinition } from 'convex/server'
import { convexTest as createConvexTest, type TestConvex } from 'convex-test'
import { afterEach } from 'vitest'

const pendingCancellations = new Set<() => Promise<void>>()

/**
 * convex-test runs scheduled functions on real timers after the scheduling call returns. Work a
 * test leaves pending fires after the test ends, against an environment it never configured, and
 * can log while Vitest tears the file down. Each test owns its scheduled work: finish it inside
 * the test (`finishAllScheduledFunctions`) or it is cancelled here. Registered via `setupFiles`.
 */
export function convexTest<Schema extends GenericSchema>(
  schema: SchemaDefinition<Schema, boolean>,
  modules?: Record<string, () => Promise<unknown>>
): TestConvex<SchemaDefinition<Schema, boolean>> {
  const t = createConvexTest(schema, modules)
  pendingCancellations.add(() =>
    t.run(async (ctx) => {
      for (const job of await ctx.db.system.query('_scheduled_functions').collect())
        if (job.state.kind === 'pending') await ctx.scheduler.cancel(job._id)
    })
  )
  return t
}

afterEach(async () => {
  const cancellations = [...pendingCancellations]
  pendingCancellations.clear()
  for (const cancel of cancellations) await cancel()
})
