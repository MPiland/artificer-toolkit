import { ConvexError, v } from 'convex/values'
import type { Validator } from 'convex/values'
import { makeFunctionReference } from 'convex/server'
import { zodToConvex } from 'convex-helpers/server/zod4'
import { z } from 'zod'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounters'
import {
  encounterActorTokenBindingCommandInputDtoSchema,
  type EncounterActorTokenBindingCommandInputDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { action, type MutationCtx, type QueryCtx } from '../_generated/server'
import { internalQuery } from '../lib/queries'
import { internalMutation } from '../lib/mutations'
import { requireFixtureAccount } from '../lib/developmentFixtures'
import { requireIdentity } from '../lib/identity'
import { readReceiptHeaders } from '../lib/receiptLedgers'

const ROLLBACK_MARKER = 'Injected lifecycle fixture rollback'
const fixtureRunSchema = z.object({
  ownerUserId: z.string(),
  campaignId: z.string(),
  encounterId: z.string()
})
const rollbackSchema = z.object({
  ...fixtureRunSchema.shape,
  operation: z.object({
    kind: z.literal('TOKEN_BINDING'),
    input: encounterActorTokenBindingCommandInputDtoSchema
  })
})
type FixtureRunInput = z.infer<typeof fixtureRunSchema>
type RollbackInput = FixtureRunInput & {
  operation: { kind: 'TOKEN_BINDING'; input: EncounterActorTokenBindingCommandInputDto }
}
const rollbackValidator: Validator<RollbackInput, 'required', string> =
  zodToConvex<z.core.$ZodType<RollbackInput>>(rollbackSchema)

const inspectReference = makeFunctionReference<'query', FixtureRunInput, string>(
  'encounters/developmentLifecycle:inspect'
)
const forceRollbackReference = makeFunctionReference<'mutation', RollbackInput, null>(
  'encounters/developmentLifecycle:forceRollback'
)
const bindToken = makeFunctionReference<
  'mutation',
  { input: EncounterActorTokenBindingCommandInputDto },
  EncounterCommandResultDto
>('encounters/actorTokenBindings:execute')

async function fixtureRun(ctx: QueryCtx | MutationCtx, args: z.infer<typeof fixtureRunSchema>) {
  const { userId } = await requireIdentity(ctx)
  if (userId !== args.ownerUserId) throw new Error('Fixture owner does not match the caller.')
  await requireFixtureAccount(ctx, args.ownerUserId)
  const campaign = await ctx.db
    .query('campaigns')
    .withIndex('by_publicId', (q) => q.eq('id', args.campaignId))
    .unique()
  if (
    !campaign ||
    campaign.ownerUserId !== userId ||
    campaign.name !== 'Encounter execution fixture'
  )
    throw new Error('Fixture Campaign ownership mismatch.')
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', args.encounterId))
    .unique()
  if (!run || run.campaignId !== campaign.id) throw new Error('Fixture Encounter Run mismatch.')
  const presentation = await ctx.db
    .query('campaignScenePresentations')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
    .unique()
  return { campaign, run, presentation }
}

export const inspect = internalQuery({
  args: zodToConvex(fixtureRunSchema),
  returns: v.string(),
  handler: async (ctx, args) => {
    const { campaign, run, presentation } = await fixtureRun(ctx, args)
    const [
      actors,
      commands,
      occurrences,
      receipts,
      rounds,
      participants,
      sides,
      binding,
      tokenBindings
    ] = await Promise.all([
      ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id))
        .take(12),
      ctx.db
        .query('encounterRunCommands')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', run.id))
        .take(101),
      ctx.db
        .query('encounterRuleOccurrences')
        .withIndex('by_encounterId_state', (q) => q.eq('encounterId', run.id))
        .take(101),
      ctx.db
        .query('encounterRuleReceipts')
        .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', run.id))
        .take(101),
      ctx.db
        .query('encounterInitiativeRounds')
        .withIndex('by_encounterId_round', (q) => q.eq('encounterId', run.id))
        .take(11),
      ctx.db
        .query('encounterInitiativeParticipants')
        .withIndex('by_encounterId_round_actorId', (q) => q.eq('encounterId', run.id))
        .take(111),
      ctx.db
        .query('encounterInitiativeSides')
        .withIndex('by_encounterId_round_sideId', (q) => q.eq('encounterId', run.id))
        .take(21),
      ctx.db
        .query('encounterSceneBindings')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', run.id))
        .unique(),
      ctx.db
        .query('encounterActorTokenBindings')
        .withIndex('by_encounterId_actorId', (q) => q.eq('encounterId', run.id))
        .take(12)
    ])
    if (
      actors.length > 11 ||
      commands.length > 100 ||
      occurrences.length > 100 ||
      receipts.length > 100 ||
      rounds.length > 10 ||
      participants.length > 110 ||
      sides.length > 20 ||
      tokenBindings.length > 11
    )
      throw new Error('Fixture lifecycle inspection exceeds its bounds.')
    return JSON.stringify({
      campaign,
      presentation,
      run,
      actors: actors.sort((left, right) => left.id.localeCompare(right.id)),
      commands: (await readReceiptHeaders(ctx, 'encounterRunCommands', commands)).sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) ||
          left.commandId.localeCompare(right.commandId)
      ),
      occurrences: occurrences.sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
      ),
      receipts: (await readReceiptHeaders(ctx, 'encounterRuleReceipts', receipts)).sort(
        (left, right) => left.commandId.localeCompare(right.commandId)
      ),
      rounds: rounds.sort((left, right) => left.round - right.round),
      participants: participants.sort(
        (left, right) => left.round - right.round || left.actorId.localeCompare(right.actorId)
      ),
      sides: sides.sort(
        (left, right) => left.round - right.round || left.sideId.localeCompare(right.sideId)
      ),
      binding,
      tokenBindings: tokenBindings.sort((left, right) => left.actorId.localeCompare(right.actorId))
    })
  }
})

export const forceRollback = internalMutation({
  args: rollbackValidator,
  returns: v.null(),
  handler: async (ctx, args) => {
    const target = {
      ownerUserId: args.ownerUserId,
      campaignId: args.campaignId,
      encounterId: args.encounterId
    }
    const before = await ctx.runQuery(inspectReference, target)
    if (args.operation.input.encounterId.toLowerCase() !== args.encounterId.toLowerCase())
      throw new Error('Fixture lifecycle operation targets another Encounter Run.')
    await ctx.runMutation(bindToken, { input: args.operation.input })
    if (before === (await ctx.runQuery(inspectReference, target)))
      throw new Error('Fixture lifecycle operation did not change persisted state.')
    throw new ConvexError(ROLLBACK_MARKER)
  }
})

// Only reserved development fixtures pass inspect; use the caller's real session throughout.
export const verifyRollback = action({
  args: rollbackValidator,
  returns: v.object({ rolledBack: v.literal(true) }),
  handler: async (ctx, args): Promise<{ rolledBack: true }> => {
    const target = {
      ownerUserId: args.ownerUserId,
      campaignId: args.campaignId,
      encounterId: args.encounterId
    }
    const before = await ctx.runQuery(inspectReference, target)
    let caughtMarker = false
    try {
      await ctx.runMutation(forceRollbackReference, args)
    } catch (error) {
      if (!(error instanceof ConvexError) || error.data !== ROLLBACK_MARKER) throw error
      caughtMarker = true
    }
    if (!caughtMarker) throw new Error('Fixture lifecycle rollback marker was not raised.')
    const after = await ctx.runQuery(inspectReference, target)
    if (before !== after) throw new Error('Fixture lifecycle rollback changed persisted state.')
    return { rolledBack: true }
  }
})
