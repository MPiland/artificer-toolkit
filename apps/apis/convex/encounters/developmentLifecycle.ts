import { ConvexError, v } from 'convex/values'
import type { Validator } from 'convex/values'
import { makeFunctionReference } from 'convex/server'
import { zodToConvex } from 'convex-helpers/server/zod4'
import { z } from 'zod'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounters'
import {
  bindEncounterToPresentedSceneInputDtoSchema,
  encounterActorTokenBindingCommandInputDtoSchema,
  type BindEncounterToPresentedSceneInputDto,
  type BindEncounterToPresentedSceneResultDto,
  type EncounterActorTokenBindingCommandInputDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { action, type MutationCtx, type QueryCtx } from '../_generated/server'
import { internalQuery, query } from '../lib/queries'
import { internalMutation } from '../lib/mutations'
import { requireFixtureAccount } from '../lib/developmentFixtures'
import { requireIdentity } from '../lib/identity'
import { readReceiptHeader, readReceiptHeaders } from '../lib/receiptLedgers'

const ROLLBACK_MARKER = 'Injected lifecycle fixture rollback'
const fixtureRunSchema = z.object({
  ownerUserId: z.string(),
  campaignId: z.string(),
  encounterId: z.string()
})
const operationSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('SCENE_BINDING'),
    input: bindEncounterToPresentedSceneInputDtoSchema
  }),
  z.object({
    kind: z.literal('TOKEN_BINDING'),
    input: encounterActorTokenBindingCommandInputDtoSchema
  })
])
const rollbackSchema = z.object({ ...fixtureRunSchema.shape, operation: operationSchema })
type FixtureRunInput = z.infer<typeof fixtureRunSchema>
type RollbackInput = FixtureRunInput & {
  operation:
    | { kind: 'SCENE_BINDING'; input: BindEncounterToPresentedSceneInputDto }
    | { kind: 'TOKEN_BINDING'; input: EncounterActorTokenBindingCommandInputDto }
}
const rollbackValidator: Validator<RollbackInput, 'required', string> =
  zodToConvex<z.core.$ZodType<RollbackInput>>(rollbackSchema)

const inspectReference = makeFunctionReference<'query', FixtureRunInput, string>(
  'encounters/developmentLifecycle:inspect'
)
const forceRollbackReference = makeFunctionReference<'mutation', RollbackInput, null>(
  'encounters/developmentLifecycle:forceRollback'
)
const bindScene = makeFunctionReference<
  'mutation',
  BindEncounterToPresentedSceneInputDto,
  BindEncounterToPresentedSceneResultDto
>('encounters/sceneBindings:bind')
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

/** Owner-only proof of a completed reaction, issued by fixture members, in a reserved development fixture. */
export const movementReactionDamage = query({
  args: {
    campaignId: v.string(),
    encounterId: v.string(),
    rootCommandId: v.string(),
    terminalCommandId: v.string()
  },
  returns: v.object({
    occurrenceId: v.string(),
    sourceActorId: v.string(),
    targetActorId: v.string(),
    resultPath: v.string(),
    requestedAmounts: v.array(v.number()),
    appliedAmount: v.number(),
    beforeHitPoints: v.number(),
    afterHitPoints: v.number()
  }),
  handler: async (ctx, args) => {
    const { userId } = await requireIdentity(ctx)
    const { campaign, run } = await fixtureRun(ctx, {
      ownerUserId: userId,
      campaignId: args.campaignId,
      encounterId: args.encounterId
    })
    const [root, terminal] = await Promise.all(
      [args.rootCommandId, args.terminalCommandId].map((commandId) =>
        ctx.db
          .query('encounterRuleReceipts')
          .withIndex('by_encounterId_commandId', (q) =>
            q.eq('encounterId', run.id).eq('commandId', commandId)
          )
          .unique()
      )
    )
    if (
      !root ||
      !terminal ||
      root.id === terminal.id ||
      root.campaignId !== campaign.id ||
      terminal.campaignId !== campaign.id ||
      root.commandType !== 'MOVE_SCENE_TOKEN' ||
      terminal.commandType !== 'RESOLVE_RULE_OCCURRENCE' ||
      root.occurrenceId !== terminal.occurrenceId
    )
      throw new Error('Fixture movement receipt lineage is unavailable.')
    // Players issue the commands for the actors they control, so each actor is a fixture member.
    for (const actorUserId of new Set([root.actorUserId, terminal.actorUserId])) {
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', campaign.id).eq('userId', actorUserId)
        )
        .unique()
      if (!membership) throw new Error('Fixture movement receipt lineage is unavailable.')
    }
    const occurrence = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_publicId', (q) => q.eq('id', root.occurrenceId))
      .unique()
    if (
      !occurrence ||
      occurrence.campaignId !== campaign.id ||
      occurrence.encounterId !== run.id ||
      occurrence.rootCommandId !== args.rootCommandId ||
      occurrence.state !== 'COMPLETED'
    )
      throw new Error('Fixture movement occurrence lineage is unavailable.')
    const [rootReceipt, terminalReceipt] = await Promise.all([
      readReceiptHeader(ctx, 'encounterRuleReceipts', root),
      readReceiptHeader(ctx, 'encounterRuleReceipts', terminal)
    ])
    const rootResult = storedRuleExecutionResultDtoSchema.parse(JSON.parse(rootReceipt.resultJson))
    const terminalResult = storedRuleExecutionResultDtoSchema.parse(
      JSON.parse(terminalReceipt.resultJson)
    )
    if (
      rootReceipt.resultChecksum !== checksumCanonicalJson(rootResult) ||
      terminalReceipt.resultChecksum !== checksumCanonicalJson(terminalResult) ||
      rootResult.status !== 'ENCOUNTER_OCCURRENCE_PENDING' ||
      rootResult.occurrenceId !== occurrence.id ||
      rootResult.encounterId !== run.id ||
      (terminalResult.status !== 'MOVEMENT_COMPLETE' &&
        (terminalResult.status !== 'BATCH_COMPLETE' ||
          terminalResult.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT')) ||
      terminalResult.occurrenceId !== occurrence.id ||
      terminalResult.occurrenceVersion !== occurrence.version ||
      terminalResult.encounterId !== run.id ||
      terminalResult.reactionExecutions.length !== 1
    )
      throw new Error('Fixture movement terminal receipt is inconsistent.')
    const reaction = terminalResult.reactionExecutions[0]!
    const application = reaction.application
    const test = reaction.phaseReceipts?.find((phase) => phase.phase === 'TEST')
    const resultPath = test?.execution.outputs.resultPath ?? reaction.execution.outputs.resultPath
    const damage =
      application.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
        ? application.applications.filter((entry) => entry.kind === 'DAMAGE')
        : []
    if (
      reaction.sourceCommandId !== args.terminalCommandId ||
      application.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH' ||
      application.applications.length === 0 ||
      damage.length !== application.applications.length ||
      typeof resultPath !== 'string'
    )
      throw new Error('Fixture movement reaction damage is inconsistent.')
    return {
      occurrenceId: occurrence.id,
      sourceActorId: application.sourceActorId,
      targetActorId: application.targetActorId,
      resultPath,
      requestedAmounts: damage.map((entry) => entry.requestedAmount),
      appliedAmount: damage.reduce((total, entry) => total + entry.appliedAmount, 0),
      beforeHitPoints: application.targetTransition.before.currentHitPoints,
      afterHitPoints: application.targetTransition.after.currentHitPoints
    }
  }
})

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
    if (args.operation.kind === 'SCENE_BINDING')
      await ctx.runMutation(bindScene, args.operation.input)
    else await ctx.runMutation(bindToken, { input: args.operation.input })
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
