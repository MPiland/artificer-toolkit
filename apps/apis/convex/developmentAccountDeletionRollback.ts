import { makeFunctionReference } from 'convex/server'
import { ConvexError, v } from 'convex/values'
import { zodToConvex } from 'convex-helpers/server/zod4'
import {
  developmentAccountDeletionKnownSchema,
  developmentAccountDeletionInspectResultSchema,
  type DevelopmentAccountDeletionInspectInput,
  type DevelopmentAccountDeletionInspectResult
} from '@artificer-toolkit/schema/api/developmentAccountDeletion'
import {
  developmentAccountDeletionRollbackInputSchema,
  developmentAccountDeletionRollbackResultSchema,
  type DevelopmentAccountDeletionRollbackFixture,
  type DevelopmentAccountDeletionRollbackInput,
  type DevelopmentAccountDeletionRollbackResult
} from '@artificer-toolkit/schema/api/developmentAccountDeletionRollback'
import { internal } from './_generated/api'
import { internalAction, type ActionCtx, type MutationCtx } from './_generated/server'
import { internalMutation } from './lib/mutations'
import { createAuth } from './authFactory.helper'
import { requireFixtureAccount } from './lib/developmentFixtures'

const MARKER = 'Injected native account deletion fixture rollback'
const inspectReference = makeFunctionReference<
  'query',
  DevelopmentAccountDeletionInspectInput,
  DevelopmentAccountDeletionInspectResult
>('developmentAccountDeletion:inspect')

const forceReference = makeFunctionReference<
  'mutation',
  DevelopmentAccountDeletionRollbackInput,
  null
>('developmentAccountDeletionRollback:forceRollback')
const scopes = ['IDENTITY', 'CHARACTERS', 'AUTHORED', 'DEFERRED'] as const
type Row = Record<string, unknown> & { _id: string }
function catalogue(stateJson: string): Record<string, Row[]> {
  const data: unknown = JSON.parse(stateJson)
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('Malformed fixture catalogue.')
  const result: Record<string, Row[]> = {}
  for (const [name, rows] of Object.entries(data)) {
    if (!Array.isArray(rows)) throw new Error('Malformed fixture table.')
    result[name] = rows.map((raw: unknown) => {
      if (
        !raw ||
        typeof raw !== 'object' ||
        Array.isArray(raw) ||
        !('_id' in raw) ||
        typeof raw._id !== 'string'
      )
        throw new Error('Malformed fixture row.')
      return raw as Row
    })
  }
  return result
}
async function capture(
  ctx: Pick<ActionCtx, 'runQuery'>,
  fixture: DevelopmentAccountDeletionRollbackFixture
) {
  let known = fixture.known
  // Each inspector merges prior IDs and validates its strict non-null bounds.
  for (const scope of scopes) {
    const result = developmentAccountDeletionInspectResultSchema.parse(
      await ctx.runQuery(inspectReference, { ...fixture, scope, ...(known ? { known } : {}) })
    )
    known = result.known
  }
  if (!known) throw new Error('Fixture identities were not captured.')
  const retained = developmentAccountDeletionKnownSchema.parse(known)
  const inspections: DevelopmentAccountDeletionInspectResult[] = []
  for (const scope of scopes)
    inspections.push(
      developmentAccountDeletionInspectResultSchema.parse(
        await ctx.runQuery(inspectReference, { ...fixture, scope, known: retained })
      )
    )
  if (inspections.some((result) => JSON.stringify(result.known) !== JSON.stringify(retained)))
    throw new Error('Fixture identities did not converge across the complete catalogue.')
  return { known: retained, inspections }
}
function requireDistinct(fixture: DevelopmentAccountDeletionRollbackFixture) {
  if (process.env.SITE_URL !== 'http://localhost:3000')
    throw new Error('Account rollback requires the development application origin.')
  if (fixture.auditorUserId === fixture.subjectUserId)
    throw new Error('Account rollback requires a distinct fixture auditor.')
}
/**
 * The request's own commit (ADR 0040): every session and credential is gone and a deletion job is
 * scheduled, while the provider user and profile stay until the job's ACCOUNT step. The browser
 * proof polls for the job's complete cleanup.
 */
async function assertDeletionScheduled(
  ctx: MutationCtx,
  after: Awaited<ReturnType<typeof capture>>,
  subjectUserId: string
) {
  const tables: Record<string, Row[]> = {}
  for (const inspection of after.inspections)
    for (const [name, rows] of Object.entries(catalogue(inspection.stateJson)))
      tables[name] = [
        ...new Map([...(tables[name] ?? []), ...rows].map((row) => [row._id, row])).values()
      ]
  for (const name of ['providerSessions', 'providerAccounts']) {
    if (!tables[name]) throw new Error('Required cleanup catalogue is missing: ' + name)
    if (tables[name].length) throw new Error('Account deletion request retains access: ' + name)
  }
  if (!tables.providerUsers?.length || !tables.userProfiles?.length)
    throw new Error('Account deletion request removed the account before its staged steps.')
  const job = await ctx.db
    .query('accountDeletionJobs')
    .withIndex('by_userId', (q) => q.eq('userId', subjectUserId))
    .unique()
  if (job?.step !== 'CAMPAIGNS') throw new Error('Account deletion request scheduled no job.')
}
export const forceRollback = internalMutation({
  args: zodToConvex(developmentAccountDeletionRollbackInputSchema),
  returns: v.null(),
  handler: async (ctx: MutationCtx, raw): Promise<null> => {
    const input = developmentAccountDeletionRollbackInputSchema.parse(raw)
    requireDistinct(input.fixture)
    await requireFixtureAccount(ctx, input.fixture.auditorUserId)
    await requireFixtureAccount(ctx, input.fixture.subjectUserId)
    const before = await capture(ctx, input.fixture)
    const auth = await createAuth(ctx).$context
    const current = await auth.internalAdapter.findSession(input.sessionToken)
    if (
      !current ||
      current.session.token !== input.sessionToken ||
      current.session.userId !== input.fixture.authUserId ||
      current.user.id !== input.fixture.authUserId
    )
      throw new Error('Account rollback session does not belong to the exact fixture subject.')
    await ctx.runMutation(internal.accountDeletion.execute, {
      sessionToken: input.sessionToken,
      command: input.command
    })
    const after = await capture(ctx, { ...input.fixture, known: before.known })
    await assertDeletionScheduled(ctx, after, input.fixture.subjectUserId)
    throw new ConvexError(MARKER)
  }
})
export const verifyRollback = internalAction({
  args: zodToConvex(developmentAccountDeletionRollbackInputSchema),
  returns: zodToConvex(developmentAccountDeletionRollbackResultSchema),
  handler: async (ctx, raw): Promise<DevelopmentAccountDeletionRollbackResult> => {
    const input = developmentAccountDeletionRollbackInputSchema.parse(raw)
    requireDistinct(input.fixture)
    const before = await capture(ctx, input.fixture)
    const fixture = { ...input.fixture, known: before.known }
    let caught = false
    try {
      await ctx.runMutation(forceReference, { ...input, fixture })
    } catch (error) {
      if (!(error instanceof ConvexError) || error.data !== MARKER) throw error
      caught = true
    }
    if (!caught) throw new Error('Native account rollback marker was not raised.')
    const after = await capture(ctx, fixture)
    if (JSON.stringify(before) !== JSON.stringify(after))
      throw new Error('Native account deletion rollback changed complete subject persisted state.')
    return { rolledBack: true }
  }
})
