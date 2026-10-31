import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  executeDiceConfigurationInputDtoSchema,
  executeRollInputDtoSchema,
  rollHistoryResponseDtoSchema,
  rollIdInputDtoSchema,
  rollRecordDtoSchema,
  rollResultDtoSchema,
  addAfterRollDieInputDtoSchema,
  type RollRecordDto
} from '@artificer-toolkit/schema/api/rolls'
import {
  evaluateRollExpression,
  parseStandaloneDiceConfiguration
} from '@artificer-toolkit/shared/rolls'
import { query } from './lib/queries'
import { mutation } from './lib/mutations'
import { requireIdentity } from './lib/identity'
import {
  presentRetainedRoll,
  presentRoll
} from '@artificer-toolkit/rules-runtime/character/rollPresentation'
import {
  addAfterRollDieToRoll,
  declineRollOffers,
  evaluateCharacterRoll,
  nextRollInt,
  readRollMaturity,
  retainUserRoll
} from './rollDocuments'

const ok = v.object({ ok: v.literal(true) })

export const executeConfiguration = mutation({
  args: zodToConvexFields(executeDiceConfigurationInputDtoSchema.shape),
  returns: zodToConvex(rollResultDtoSchema),
  handler: async (ctx, args) => {
    await requireIdentity(ctx)
    const input = executeDiceConfigurationInputDtoSchema.parse(args)
    return rollResultDtoSchema.parse({
      id: crypto.randomUUID(),
      ...evaluateRollExpression(parseStandaloneDiceConfiguration(input.configuration), {
        nextInt: nextRollInt
      })
    })
  }
})

export const execute = mutation({
  args: zodToConvexFields(executeRollInputDtoSchema.shape),
  returns: zodToConvex(rollRecordDtoSchema),
  handler: async (ctx, args): Promise<RollRecordDto> => {
    const { userId } = await requireIdentity(ctx)
    const input = executeRollInputDtoSchema.parse(args)
    const { record, maturity } = await evaluateCharacterRoll(ctx, userId, input)
    await retainUserRoll(ctx, userId, record, null)
    return presentRoll(record, maturity)
  }
})

/** D168: adds a die the Character held for after the roll to the user's latest roll, and spends it. */
export const addAfterRollDie = mutation({
  args: zodToConvexFields(addAfterRollDieInputDtoSchema.shape),
  returns: zodToConvex(rollRecordDtoSchema),
  handler: async (ctx, args): Promise<RollRecordDto> => {
    const { userId } = await requireIdentity(ctx)
    return addAfterRollDieToRoll(ctx, userId, addAfterRollDieInputDtoSchema.parse(args))
  }
})

/** D168: keeps the user's latest roll as rolled; its held dice are offered no more. */
export const declineAfterRollDice = mutation({
  args: zodToConvexFields(rollIdInputDtoSchema.shape),
  returns: zodToConvex(rollRecordDtoSchema),
  handler: async (ctx, args): Promise<RollRecordDto> => {
    const { userId } = await requireIdentity(ctx)
    return declineRollOffers(ctx, userId, rollIdInputDtoSchema.parse(args).id)
  }
})

export const history = query({
  args: {},
  returns: zodToConvex(rollHistoryResponseDtoSchema),
  handler: async (ctx) => {
    const { userId } = await requireIdentity(ctx)
    const records = await ctx.db
      .query('userRollHistory')
      .withIndex('by_userId_createdAt_id', (q) => q.eq('userId', userId))
      .order('desc')
      .take(20)
    const maturityByCharacterId = new Map(
      await Promise.all(
        [
          ...new Set(records.flatMap((record) => (record.characterId ? [record.characterId] : [])))
        ].map(async (id) => [id, await readRollMaturity(ctx, id)] as const)
      )
    )
    return rollHistoryResponseDtoSchema.parse(
      records.map((record) =>
        presentRetainedRoll(
          record,
          record.characterId ? (maturityByCharacterId.get(record.characterId) ?? null) : null
        )
      )
    )
  }
})

export const discard = mutation({
  args: zodToConvexFields(rollIdInputDtoSchema.shape),
  returns: ok,
  handler: async (ctx, args) => {
    const { userId } = await requireIdentity(ctx)
    const { id } = rollIdInputDtoSchema.parse(args)
    const record = await ctx.db
      .query('userRollHistory')
      .withIndex('by_userId_id', (q) => q.eq('userId', userId).eq('id', id))
      .unique()
    if (record && record.consumedAt === null) await ctx.db.delete(record._id)
    return { ok: true } as const
  }
})

export const clearHistory = mutation({
  args: {},
  returns: ok,
  handler: async (ctx) => {
    const { userId } = await requireIdentity(ctx)
    const records = await ctx.db
      .query('userRollHistory')
      .withIndex('by_userId_createdAt_id', (q) => q.eq('userId', userId))
      .take(20)
    for (const record of records) await ctx.db.delete(record._id)
    return { ok: true } as const
  }
})
