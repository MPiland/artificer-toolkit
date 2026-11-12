import { resolveEncounterActionInputDtoSchema } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type {
  LiveSessionReactionAncestor,
  LiveSessionReactionChild
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { reactionOfferOccurrenceId } from '@artificer-toolkit/rules-runtime/encounterSystemTrigger'
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

type RecordingParent = NonNullable<Awaited<ReturnType<typeof readRecordingParent>>>

/**
 * The creature taking a held action, and the link from that action to the one it answers when it is
 * itself a reaction's child. Null for a contested escape, whose root is the escape itself (D152).
 */
function heldAction(held: RecordingParent) {
  if (held.context.contest) return null
  const command = resolveEncounterActionInputDtoSchema.parse(JSON.parse(held.context.commandJson))
  return {
    actorId: command.actorId,
    answers:
      command.systemTrigger?.trigger === 'REACTION'
        ? {
            campaignId: held.parent.campaignId,
            encounterId: held.parent.encounterId,
            parentCommandId: command.systemTrigger.parentCommandId.toLowerCase(),
            childCommandId: held.parent.rootCommandId,
            reactorActorId: command.actorId.toLowerCase()
          }
        : null
  }
}

/**
 * Moves every suspended action above a held action to one Run version. A held reaction child's own
 * reactions move the Run while the action it answers, and each action above that one, waits
 * suspended; each is pinned to one Run version, so each follows the Run its tree left.
 */
async function repinSuspendedAncestors(
  ctx: EncounterWriteContext,
  held: RecordingParent,
  version: number
) {
  for (let current = held; ;) {
    const link = heldAction(current)?.answers
    // A child an offer's answer records answers a committed action: nothing above it is held.
    if (!link || (await readReactionOfferChild(ctx, link))) return
    const above = await readRecordingParent(ctx, link)
    if (above?.parent.state !== 'SUSPENDED')
      throw new Error('The reaction’s pending action is gone.')
    await ctx.db.patch(above.parent._id, { expectedEncounterVersion: version })
    current = above
  }
}

/**
 * The command a stored reaction child was chosen against and the creature that reacted, or null for
 * any other command.
 */
function storedReaction(row: EncounterDocument<'encounterRunCommands'>) {
  if (row.commandType !== 'RESOLVE_ACTION') return null
  const { systemTrigger, actorId } = resolveEncounterActionInputDtoSchema.parse(
    JSON.parse(row.commandJson)
  )
  return systemTrigger?.trigger === 'REACTION'
    ? { parentCommandId: systemTrigger.parentCommandId.toLowerCase(), reactorActorId: actorId }
    : null
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
 * The held actions above a reaction child, nearest first (D219): the action that records it, the
 * action that one answers, and so on up to the action nothing holds. Each names its creature, whether
 * it is itself a reaction (its holder's reaction is spent on it, though nothing of it has committed),
 * and the spell slot its own cast spends when it commits. A child an offer's answer records answers a
 * committed action, so nothing is above it.
 */
export async function readReactionChildAncestors(
  ctx: EncounterReadContext,
  input: ReactionChildLink & { reactorActorId: string }
) {
  const ancestors: LiveSessionReactionAncestor[] = []
  for (let link: typeof input | null = input; link && !(await readReactionOfferChild(ctx, link));) {
    const held = await readRecordingParent(ctx, link)
    const action = held ? heldAction(held) : null
    if (!held || !action) break
    ancestors.push({
      actorId: action.actorId,
      reaction: action.answers !== null,
      castSlotKey: held.context.castSlotKey ?? null
    })
    link = action.answers
  }
  return ancestors
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
 * so its later answers and its own commit are fenced on the Run as the child left it. The suspended
 * actions above it move with it.
 */
export async function repinReactionChildParent(
  ctx: EncounterWriteContext,
  input: ReactionChildLink & { reactorActorId: string; version: number }
) {
  if (await readReactionOfferChild(ctx, input)) return
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
  input: ReactionChildLink & { reactorActorId: string; version: number }
) {
  if (await readReactionOfferChild(ctx, input)) return
  const recording = await readRecordingParent(ctx, input)
  if (recording?.parent.state !== 'SUSPENDED')
    throw new Error('The reaction’s pending action is gone.')
  const { parent, snapshot } = recording
  // The cast is recorded with the children, so it goes when the last of them does.
  const { reactionChildren = [], castLevel, castSlotKey, ...context } = recording.context
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
          ...(castLevel !== undefined && { castLevel }),
          ...(castSlotKey !== undefined && { castSlotKey })
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
  castSlotKey?: string
}

/**
 * Whether a pending action's next context keeps the reaction children its previous one recorded:
 * the same commands in order, each resolved and a resolved mode never rewritten, with at most one
 * new, unresolved child after them, and the cast recorded with them unchanged.
 */
export function reactionChildrenKept(
  previous: RecordedReactionChildren,
  next: RecordedReactionChildren
): boolean {
  const recorded = previous.reactionChildren ?? []
  const kept = next.reactionChildren ?? []
  return (
    kept.length - recorded.length <= 1 &&
    (recorded.length === 0 ||
      (previous.castLevel === next.castLevel && previous.castSlotKey === next.castSlotKey)) &&
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
    const { actorId, actionId, expectedVersion } = resolveEncounterActionInputDtoSchema.parse(
      JSON.parse(command.commandJson)
    )
    const execution = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
    const completed = execution.status === 'COMPLETE' ? execution : null
    // The child's own reactions committed between the Run version it was raised at and its commit.
    const descendants = await readCommittedReactionDescendants(ctx, {
      encounterId: command.encounterId,
      rootCommandId: commandId,
      afterVersion: expectedVersion,
      beforeVersion: command.version
    })
    children.push({
      commandId,
      reactorActorId: actorId,
      actionId,
      imposesRollMode: completed !== null && outcomes.imposesRollModeOnTriggeringRoll(completed),
      cancelsTriggeringEvent: completed !== null && outcomes.cancelsTriggeringEvent(completed),
      descendantReactorActorIds: [
        ...new Set(descendants.map(({ reactorActorId }) => reactorActorId))
      ]
    })
  }
  return children
}

/**
 * The reactions of one root command's tree that committed between two Run versions, both exclusive,
 * in Run order: its reaction children, the reactions chosen against those, and so on down, each with
 * the command it was chosen against and the creature that reacted. A held child the GM voided has
 * no command, so the reactions that committed under it are found through the void. A root's commit
 * follows its own expected version by one version for each of them, and a replay of the root counts
 * them from the Run's commands instead of keeping a counter.
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
  const reactions: { commandId: string; parentCommandId: string; reactorActorId: string }[] = []
  for (const row of commands) {
    if (row.commandType === 'VOID_RULE_OCCURRENCE') {
      const voided = await ctx.db
        .query('encounterRuleOccurrences')
        .withIndex('by_publicId', (query) => query.eq('id', row.ruleOccurrenceId))
        .unique()
      if (voided) tree.add(voided.rootCommandId)
      continue
    }
    const reaction = storedReaction(row)
    if (reaction) reactions.push({ commandId: row.commandId, ...reaction })
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
    const parentCommandId = storedReaction(row)?.parentCommandId
    if (
      parentCommandId !== input.rootCommandId &&
      !(parentCommandId && trailing.has(parentCommandId))
    )
      break
    trailing.add(row.commandId)
  }
  return trailing
}
