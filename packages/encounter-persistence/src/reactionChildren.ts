import { resolveEncounterActionInputDtoSchema } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionReactionChild } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { executionOutcomeCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformEncounterPolicy'
import { readPendingSnapshot, writePendingSnapshot } from './pendingSnapshots.js'
import type { EncounterDocument, EncounterReadContext, EncounterWriteContext } from './store.js'

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
 * Moves every suspended action above a held action to one Run version. A held reaction child's own
 * reactions move the Run while the action it answers, and each action above that one, waits
 * suspended; each is pinned to one Run version, so each follows the Run its tree left.
 */
async function repinSuspendedAncestors(
  ctx: EncounterWriteContext,
  held: NonNullable<Awaited<ReturnType<typeof readRecordingParent>>>,
  version: number
) {
  for (let current = held; ;) {
    // A contested escape's root is the escape itself (D152): no reaction child.
    const trigger = current.context.contest
      ? undefined
      : resolveEncounterActionInputDtoSchema.parse(JSON.parse(current.context.commandJson))
          .systemTrigger
    if (trigger?.trigger !== 'REACTION') return
    const above = await readRecordingParent(ctx, {
      campaignId: current.parent.campaignId,
      encounterId: current.parent.encounterId,
      parentCommandId: trigger.parentCommandId.toLowerCase(),
      childCommandId: current.parent.rootCommandId
    })
    if (above?.parent.state !== 'SUSPENDED')
      throw new Error('The reaction’s pending action is gone.')
    await ctx.db.patch(above.parent._id, { expectedEncounterVersion: version })
    current = above
  }
}

/** The command a stored reaction child was chosen against, or null for any other command. */
function reactedCommandId(row: EncounterDocument<'encounterRunCommands'>) {
  if (row.commandType !== 'RESOLVE_ACTION') return null
  const { systemTrigger } = resolveEncounterActionInputDtoSchema.parse(JSON.parse(row.commandJson))
  return systemTrigger?.trigger === 'REACTION' ? systemTrigger.parentCommandId.toLowerCase() : null
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
 * Suspends the pending action a reaction child answers when that child pauses on evidence of its
 * own, in the transaction that stores the child's pending decision, so the Run keeps one pending
 * decision: the child's.
 */
export async function suspendReactionChildParent(
  ctx: EncounterWriteContext,
  input: ReactionChildLink
) {
  const parent = await readReactionChildParent(ctx, input)
  if (parent?.state !== 'PENDING') throw new Error('The reaction’s pending action is gone.')
  await ctx.db.patch(parent._id, { state: 'SUSPENDED' })
}

/**
 * Moves the held action a committed reaction child answers to the Run version the child produced,
 * and returns it to pending if the child had paused. A pending action is pinned to one Run version,
 * so its later answers and its own commit are fenced on the Run as the child left it. The suspended
 * actions above it move with it.
 */
export async function repinReactionChildParent(
  ctx: EncounterWriteContext,
  input: ReactionChildLink & { version: number }
) {
  const recording = await readRecordingParent(ctx, input)
  if (!recording) throw new Error('The reaction’s pending action is gone.')
  await ctx.db.patch(recording.parent._id, {
    state: 'PENDING',
    expectedEncounterVersion: input.version
  })
  await repinSuspendedAncestors(ctx, recording, input.version)
}

/**
 * Returns the suspended action to pending when the GM voids the paused child it waited on: the
 * child is dropped from its record, so its answered offer stands open again, pinned to the Run
 * version the void produced. The suspended actions above it move with it.
 */
export async function releaseReactionChildParent(
  ctx: EncounterWriteContext,
  input: ReactionChildLink & { version: number }
) {
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
  await repinSuspendedAncestors(ctx, recording, input.version)
}

/**
 * How many Run versions GM voids made after one version, up to and including another: one for each
 * void, and one for the undo a void makes of the reactions that committed under the action it
 * cancels. While an action is held, the Run moves only by the reactions of its tree: each commit,
 * and each void of a held one.
 */
export async function countRunVoidVersions(
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
  return commands.filter(
    ({ commandType }) =>
      commandType === 'VOID_RULE_OCCURRENCE' || commandType === 'REVERT_LAST_ACTION'
  ).length
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
 * The reactions of one root command's tree that committed between two Run versions, both exclusive,
 * in Run order: its reaction children, the reactions chosen against those, and so on down, each with
 * the command it was chosen against. A held child the GM voided has no command, so the reactions
 * that committed under it are found through the void. A root's commit follows its own expected
 * version by one version for each of them, and a replay of the root counts them from the Run's
 * commands instead of keeping a counter.
 */
export async function readCommittedReactionDescendants(
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
  const tree = new Set([input.rootCommandId])
  const reactions: { commandId: string; parentCommandId: string }[] = []
  for (const row of commands) {
    if (row.commandType === 'VOID_RULE_OCCURRENCE') {
      const voided = await ctx.db
        .query('encounterRuleOccurrences')
        .withIndex('by_publicId', (query) => query.eq('id', row.ruleOccurrenceId))
        .unique()
      if (voided) tree.add(voided.rootCommandId)
      continue
    }
    const parentCommandId = reactedCommandId(row)
    if (parentCommandId) reactions.push({ commandId: row.commandId, parentCommandId })
  }
  // A reaction commits before the action it answers, so the tree closes from the root down, not in
  // Run order.
  for (let size = 0; size !== tree.size;) {
    size = tree.size
    for (const { commandId, parentCommandId } of reactions)
      if (tree.has(parentCommandId)) tree.add(commandId)
  }
  return reactions.filter(({ parentCommandId }) => tree.has(parentCommandId))
}

/**
 * The reactions of one root command's tree that are the Run's last commands: back from the latest,
 * every command that is a reaction to the root or to a reaction already among them. These are what
 * one undo takes back when the GM voids the held root.
 */
export async function readTrailingReactionDescendants(
  ctx: EncounterReadContext,
  input: { encounterId: string; rootCommandId: string }
) {
  const recent = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_encounterId_version', (query) => query.eq('encounterId', input.encounterId))
    .order('desc')
    .take(MAX_ENCOUNTER_ACTORS + 1)
  const trailing = new Set<string>()
  for (const row of recent) {
    // An answer that settled one of them is part of its action.
    if (row.commandType === 'RESOLVE_RULE_OCCURRENCE') continue
    const parentCommandId = reactedCommandId(row)
    if (
      parentCommandId !== input.rootCommandId &&
      !(parentCommandId && trailing.has(parentCommandId))
    )
      break
    trailing.add(row.commandId)
  }
  return trailing
}
