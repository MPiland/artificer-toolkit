import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { makeFunctionReference } from 'convex/server'
import { ConvexError } from 'convex/values'
import {
  developmentReceiptLedgerRemovalSchema,
  developmentReceiptLedgerRetirementInputSchema,
  developmentReceiptLedgerRetirementInspectionSchema,
  developmentReceiptLedgerScopeSchema,
  type DevelopmentReceiptLedgerScope
} from '@artificer-toolkit/schema/api/developmentReceiptLedger'
import { components } from '../_generated/api'
import { internalAction } from '../_generated/server'
import { internalMutation } from '../lib/mutations'
import { internalQuery } from '../lib/queries'
import { requireFixtureAccount } from '../lib/developmentFixtures'
import { removePrivateCharacter } from './accountDeletion'
import { readCharacterRow } from './stateDocuments'

const ROLLBACK_MARKER = 'Abort after private receipt retirement.'
const rollbackReference = makeFunctionReference<'mutation', DevelopmentReceiptLedgerScope, null>(
  'characters/developmentReceiptRetirement:rollback'
)

export const rollback = internalMutation({
  args: zodToConvexFields(developmentReceiptLedgerScopeSchema.shape),
  returns: zodToConvex(developmentReceiptLedgerRemovalSchema),
  handler: async (ctx, { userId, characterId }) => {
    await requireFixtureAccount(ctx, userId)
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
    const draft = await ctx.db
      .query('characterDrafts')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .unique()
    if (!profile || !draft || draft.userId !== userId)
      throw new Error('Receipt retirement rollback requires the owned fixture draft.')
    await removePrivateCharacter(
      ctx,
      userId,
      characterId,
      await readCharacterRow(ctx, characterId),
      draft
    )
    const [remaining, intent, removedRoute] = await Promise.all([
      ctx.db
        .query('characterCommandReceipts')
        .withIndex('by_characterId_commandId', (q) => q.eq('characterId', characterId))
        .first(),
      ctx.db
        .query('characterReceiptPurgeJobs')
        .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
        .unique(),
      ctx.db
        .query('authoredRouteIds')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', characterId))
        .unique()
    ])
    if (remaining || !intent || removedRoute)
      throw new Error('Receipt retirement did not atomically remove references and create intent.')
    throw new ConvexError(ROLLBACK_MARKER)
  }
})

export const verifyRollback = internalAction({
  args: zodToConvexFields(developmentReceiptLedgerScopeSchema.shape),
  returns: zodToConvex(developmentReceiptLedgerRemovalSchema),
  handler: async (ctx, args) => {
    try {
      await ctx.runMutation(rollbackReference, developmentReceiptLedgerScopeSchema.parse(args))
    } catch (error) {
      if (error instanceof ConvexError && error.data === ROLLBACK_MARKER) return null
      throw error
    }
    throw new Error('The native private receipt retirement rollback marker was not raised.')
  }
})

export const inspect = internalQuery({
  args: zodToConvexFields(developmentReceiptLedgerRetirementInputSchema.shape),
  returns: zodToConvex(developmentReceiptLedgerRetirementInspectionSchema),
  handler: async (ctx, args) => {
    const input = developmentReceiptLedgerRetirementInputSchema.parse(args)
    if (process.env.SITE_URL !== 'http://localhost:3000')
      throw new Error('Receipt retirement inspection requires the local application origin.')
    const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: 'user',
      where: [{ field: '_id', value: input.authUserId }],
      select: ['_id', 'email']
    })
    if (user && !/^draft_[0-9a-f]{12}@example\.invalid$/.test(user.email))
      throw new Error('Receipt retirement inspection requires the exact fixture auth account.')
    const [profile, active, draft, job, headers, ledgers] = await Promise.all([
      ctx.db
        .query('userProfiles')
        .withIndex('by_authUserId', (q) => q.eq('authUserId', input.authUserId))
        .unique(),
      ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', input.characterId))
        .unique(),
      ctx.db
        .query('characterDrafts')
        .withIndex('by_characterId', (q) => q.eq('characterId', input.characterId))
        .unique(),
      ctx.db
        .query('characterReceiptPurgeJobs')
        .withIndex('by_characterId', (q) => q.eq('characterId', input.characterId))
        .unique(),
      ctx.db
        .query('characterCommandReceipts')
        .withIndex('by_characterId_commandId', (q) => q.eq('characterId', input.characterId))
        .take(101),
      ctx.db
        .query('receiptLedgers')
        .withIndex('by_scope_scopeId', (q) =>
          q.eq('scope', 'CHARACTER').eq('scopeId', input.characterId)
        )
        .take(4)
    ])
    // Staged account deletion removes the auth account last, so its absence is valid only after
    // the profile is gone too.
    if (
      (!user && profile) ||
      (profile && profile.userId !== input.userId) ||
      (active && active.userId !== input.userId) ||
      (draft && draft.userId !== input.userId) ||
      (job && job.ownerUserId !== input.userId) ||
      headers.length > 100 ||
      ledgers.length > 3
    )
      throw new Error('Receipt retirement inspection ownership or fixture bounds mismatch.')
    let storagePresent = ledgers.length > 0
    // Fixture ledger IDs are deterministic; inspect one part per ID without reading complete bodies.
    for (let ordinal = 0; ordinal < 3; ordinal++) {
      const ledgerId = `${input.characterId.slice(0, -2)}${ordinal.toString(16).padStart(2, '0')}`
      const part = await ctx.db
        .query('receiptLedgerParts')
        .withIndex('by_ledgerId_index', (q) => q.eq('ledgerId', ledgerId))
        .first()
      if (part) storagePresent = true
    }
    return developmentReceiptLedgerRetirementInspectionSchema.parse({
      characterExists: Boolean(active || draft),
      profileExists: Boolean(profile),
      headerCount: headers.length,
      jobExists: Boolean(job),
      ledgerCount: ledgers.length,
      storagePresent
    })
  }
})
