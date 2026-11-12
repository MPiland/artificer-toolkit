import { resolveEncounterActionInputDtoSchema } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionReactionChild } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { reactionOfferOccurrenceId } from '@artificer-toolkit/rules-runtime/encounterSystemTrigger'
import { executionOutcomeCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformEncounterPolicy'
import { readPendingSnapshot, writePendingSnapshot } from './pendingSnapshots.js'
import type { EncounterReadContext, EncounterWriteContext } from './store.js'

type ReactionChildLink = {
  campaignId: string
  encounterId: string
  /** The root command of the action the reaction was chosen against. */
  parentCommandId: string
  childCommandId: string
}

/** The held action that records a reaction child, with the sealed snapshot that records it. */
async function readRecordingParent(ctx: EncounterReadContext, input: ReactionChildLink) {
  const parent = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_campaignId_rootCommandId', (query) =>
      query.eq('campaignId', input.campaignId).eq('rootCommandId', input.parentCommandId)
    )
    .unique()
  if (
    parent?.encounterId !== input.encounterId ||
    (parent.state !== 'PENDING' && parent.state !== 'SUSPENDED')
  )
    return null
  const snapshot = await readPendingSnapshot(ctx, parent)
  if (
    snapshot?.snapshotKind !== 'KERNEL_EVIDENCE' ||
    snapshot.applicationContext.kind !== 'ENCOUNTER_ACTION' ||
    !snapshot.applicationContext.reactionChildren?.some(
      ({ commandId }) => commandId === input.childCommandId
    )
  )
    return null
  return { parent, snapshot, context: snapshot.applicationContext }
}

/**
 * The held action a reaction's child action answers (D219), or null when no held action of this Run
 * records that child. The record is the proof: the action's own context names the child command of
 * each reaction chosen against it, so an open offer alone admits nothing. The action is pending, or
 * suspended while that child is the Run's pending decision.
 */
export async function readReactionChildParent(ctx: EncounterReadContext, input: ReactionChildLink) {
  return (await readRecordingParent(ctx, input))?.parent ?? null
}

/**
 * The level of the cast a reaction child answers, as the held action recorded it beside the child
 * (D219); null when that action casts no spell, or no held action records the child.
 */
export async function readReactionChildCastLevel(
  ctx: EncounterReadContext,
  input: ReactionChildLink
) {
  return (await readRecordingParent(ctx, input))?.context.castLevel ?? null
}

/**
 * The answer that records a reaction child chosen from the offer its action raised once it had
 * committed (D219), or null when no settled offer of this Run records that child. The receipt is the
 * proof, and the child's only tie to the action: nothing is held, so the child suspends, re-pins
 * and releases nothing. A declined offer, the GM's void among them, records no child.
 */
export async function readReactionOfferChild(
  ctx: EncounterReadContext,
  input: ReactionChildLink & { reactorActorId: string }
) {
  const offer = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (query) =>
      query.eq('id', reactionOfferOccurrenceId(input.parentCommandId, input.reactorActorId))
    )
    .unique()
  if (
    offer?.campaignId !== input.campaignId ||
    offer.encounterId !== input.encounterId ||
    offer.state !== 'COMPLETED'
  )
    return null
  const answer = await ctx.db
    .query('encounterRuleReceipts')
    .withIndex('by_occurrenceId', (query) => query.eq('occurrenceId', offer.id))
    .unique()
  if (!answer) return null
  const result = storedRuleExecutionResultDtoSchema.parse(JSON.parse(answer.resultJson))
  const output = result.status === 'AGGREGATE_CHOICE_COMPLETE' ? result.applicationOutputs : null
  return output?.kind === 'REACTION_OFFER_ANSWER' &&
    output.child?.commandId === input.childCommandId
    ? { answer, output }
    : null
}

/**
 * Suspends the pending action a reaction child answers when that child pauses on evidence of its
 * own, in the transaction that stores the child's pending decision, so the Run keeps one pending
 * decision: the child's. Like the re-pin and the release below, it does nothing for a child an
 * offer's answer records, whose action committed before it.
 */
export async function suspendReactionChildParent(
  ctx: EncounterWriteContext,
  input: ReactionChildLink & { reactorActorId: string }
) {
  if (await readReactionOfferChild(ctx, input)) return
  const parent = await readReactionChildParent(ctx, input)
  if (parent?.state !== 'PENDING') throw new Error('The reaction’s pending action is gone.')
  await ctx.db.patch(parent._id, { state: 'SUSPENDED' })
}

/**
 * Moves the held action a committed reaction child answers to the Run version the child produced,
 * and returns it to pending if the child had paused. A pending action is pinned to one Run version,
 * so its later answers and its own commit are fenced on the Run as the child left it.
 */
export async function repinReactionChildParent(
  ctx: EncounterWriteContext,
  input: ReactionChildLink & { reactorActorId: string; version: number }
) {
  if (await readReactionOfferChild(ctx, input)) return
  const parent = await readReactionChildParent(ctx, input)
  if (!parent) throw new Error('The reaction’s pending action is gone.')
  await ctx.db.patch(parent._id, { state: 'PENDING', expectedEncounterVersion: input.version })
}

/**
 * Returns the suspended action to pending when the GM voids the paused child it waited on: the
 * child is dropped from its record, so its answered offer stands open again, pinned to the Run
 * version the void produced.
 */
export async function releaseReactionChildParent(
  ctx: EncounterWriteContext,
  input: ReactionChildLink & { reactorActorId: string; version: number }
) {
  if (await readReactionOfferChild(ctx, input)) return
  const recording = await readRecordingParent(ctx, input)
  if (recording?.parent.state !== 'SUSPENDED')
    throw new Error('The reaction’s pending action is gone.')
  const { parent, snapshot } = recording
  // The cast level is recorded with the children, so it goes when the last of them does.
  const { reactionChildren = [], castLevel, ...context } = recording.context
  const kept = reactionChildren.filter(({ commandId }) => commandId !== input.childCommandId)
  await ctx.db.patch(parent._id, {
    state: 'PENDING',
    version: parent.version + 1,
    expectedEncounterVersion: input.version,
    pendingSnapshotChecksum: await writePendingSnapshot(ctx, parent, {
      ...snapshot,
      applicationContext: {
        ...context,
        ...(kept.length > 0 && {
          reactionChildren: kept,
          ...(castLevel !== undefined && { castLevel })
        })
      }
    }),
    updatedAt: new Date().toISOString()
  })
}

/**
 * How many GM voids the Run recorded after one version, up to and including another. While an action
 * is held, the Run moves only by its reaction children: each commit, and each void of a paused one.
 */
export async function countRunVoids(
  ctx: EncounterReadContext,
  input: { encounterId: string; afterVersion: number; throughVersion: number }
) {
  const commands = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_encounterId_version', (query) =>
      query
        .eq('encounterId', input.encounterId)
        .gt('version', input.afterVersion)
        .lte('version', input.throughVersion)
    )
    .take(MAX_ENCOUNTER_ACTORS + 1)
  return commands.filter(({ commandType }) => commandType === 'VOID_RULE_OCCURRENCE').length
}

/**
 * Whether a pending action records a reaction child it has not resumed from: the child's mode is
 * written only by the resume that follows its commit.
 */
export const awaitsReactionChild = (context: RecordedReactionChildren) =>
  context.reactionChildren?.some(({ rollMode }) => rollMode === undefined) ?? false

type RecordedReactionChildren = {
  reactionChildren?: readonly { commandId: string; rollMode?: string | null }[]
  castLevel?: number
}

/**
 * Whether a pending action's next context keeps the reaction children its previous one recorded:
 * the same commands in order, each resolved and a resolved mode never rewritten, with at most one
 * new, unresolved child after them, and the cast level recorded with them unchanged.
 */
export function reactionChildrenKept(
  previous: RecordedReactionChildren,
  next: RecordedReactionChildren
): boolean {
  const recorded = previous.reactionChildren ?? []
  const kept = next.reactionChildren ?? []
  return (
    kept.length - recorded.length <= 1 &&
    (recorded.length === 0 || previous.castLevel === next.castLevel) &&
    recorded.every(({ commandId, rollMode }, index) => {
      const child = kept[index]
      return (
        child?.commandId === commandId &&
        child.rollMode !== undefined &&
        (rollMode === undefined || child.rollMode === rollMode)
      )
    }) &&
    kept.slice(recorded.length).every(({ rollMode }) => rollMode === undefined)
  )
}

/**
 * The committed child actions among those a pending action records, in recorded order: who reacted
 * with what, and whether the System reads a roll mode imposed on the action's roll, or the action's
 * cancellation, from the child's stored execution. A recorded child that has not committed is left out.
 */
export async function readCommittedReactionChildren(
  ctx: EncounterReadContext,
  input: {
    campaignId: string
    gameSystemId: string
    recorded: readonly { commandId: string }[]
  }
): Promise<LiveSessionReactionChild[]> {
  const outcomes = executionOutcomeCapabilityRegistry.require(input.gameSystemId)
  const children: LiveSessionReactionChild[] = []
  for (const { commandId } of input.recorded) {
    const command = await ctx.db
      .query('encounterRunCommands')
      .withIndex('by_campaignId_commandId', (query) =>
        query.eq('campaignId', input.campaignId).eq('commandId', commandId)
      )
      .unique()
    const receipt = await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_campaignId_commandId', (query) =>
        query.eq('campaignId', input.campaignId).eq('commandId', commandId)
      )
      .unique()
    if (command?.commandType !== 'RESOLVE_ACTION' || !receipt) continue
    const { actorId, actionId } = resolveEncounterActionInputDtoSchema.parse(
      JSON.parse(command.commandJson)
    )
    const execution = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
    const completed = execution.status === 'COMPLETE' ? execution : null
    children.push({
      commandId,
      reactorActorId: actorId,
      actionId,
      imposesRollMode: completed !== null && outcomes.imposesRollModeOnTriggeringRoll(completed),
      cancelsTriggeringEvent: completed !== null && outcomes.cancelsTriggeringEvent(completed)
    })
  }
  return children
}

/**
 * How many reaction children of one root command committed between two Run versions, both
 * exclusive. A root's commit follows its own expected version by one version for each of them, and a
 * replay of the root counts them from the Run's commands instead of keeping a counter.
 */
export async function countCommittedReactionChildren(
  ctx: EncounterReadContext,
  input: { encounterId: string; rootCommandId: string; afterVersion: number; beforeVersion: number }
) {
  const commands = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_encounterId_version', (query) =>
      query
        .eq('encounterId', input.encounterId)
        .gt('version', input.afterVersion)
        .lt('version', input.beforeVersion)
    )
    .take(MAX_ENCOUNTER_ACTORS + 1)
  return commands.filter((row) => {
    if (row.commandType !== 'RESOLVE_ACTION') return false
    const { systemTrigger } = resolveEncounterActionInputDtoSchema.parse(
      JSON.parse(row.commandJson)
    )
    return (
      systemTrigger?.trigger === 'REACTION' &&
      systemTrigger.parentCommandId.toLowerCase() === input.rootCommandId
    )
  }).length
}
