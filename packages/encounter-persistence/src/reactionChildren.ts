import { resolveEncounterActionInputDtoSchema } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionReactionChild } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { executionOutcomeCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformEncounterPolicy'
import { readPendingSnapshot } from './pendingSnapshots.js'
import type { EncounterReadContext, EncounterWriteContext } from './store.js'

type ReactionChildLink = {
  campaignId: string
  encounterId: string
  /** The root command of the action the reaction was chosen against. */
  parentCommandId: string
  childCommandId: string
}

/**
 * The pending action a reaction's child action answers (D219), or null when no pending action of
 * this Run records that child. The record is the proof: the pending action's own context names the
 * child command of each reaction chosen against it, so an open offer alone admits nothing.
 */
export async function readReactionChildParent(ctx: EncounterReadContext, input: ReactionChildLink) {
  const parent = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_campaignId_rootCommandId', (query) =>
      query.eq('campaignId', input.campaignId).eq('rootCommandId', input.parentCommandId)
    )
    .unique()
  if (parent?.encounterId !== input.encounterId || parent.state !== 'PENDING') return null
  const snapshot = await readPendingSnapshot(ctx, parent)
  const recorded =
    snapshot?.snapshotKind === 'KERNEL_EVIDENCE' &&
    snapshot.applicationContext.kind === 'ENCOUNTER_ACTION' &&
    snapshot.applicationContext.reactionChildren?.some(
      ({ commandId }) => commandId === input.childCommandId
    )
  return recorded ? parent : null
}

/**
 * Moves the pending action a committed reaction child answers to the Run version the child
 * produced. A pending action is pinned to one Run version, so its later answers and its own commit
 * are fenced on the Run as the child left it.
 */
export async function repinReactionChildParent(
  ctx: EncounterWriteContext,
  input: ReactionChildLink & { version: number }
) {
  const parent = await readReactionChildParent(ctx, input)
  if (!parent) throw new Error('The reaction’s pending action is gone.')
  await ctx.db.patch(parent._id, { expectedEncounterVersion: input.version })
}

/**
 * Whether a pending action records a reaction child it has not resumed from: the child's mode is
 * written only by the resume that follows its commit.
 */
export const awaitsReactionChild = (context: RecordedReactionChildren) =>
  context.reactionChildren?.some(({ rollMode }) => rollMode === undefined) ?? false

type RecordedReactionChildren = {
  reactionChildren?: readonly { commandId: string; rollMode?: string | null }[]
}

/**
 * Whether a pending action's next context keeps the reaction children its previous one recorded:
 * the same commands in order, each resolved and a resolved mode never rewritten, with at most one
 * new, unresolved child after them.
 */
export function reactionChildrenKept(
  previous: RecordedReactionChildren,
  next: RecordedReactionChildren
): boolean {
  const recorded = previous.reactionChildren ?? []
  const kept = next.reactionChildren ?? []
  return (
    kept.length - recorded.length <= 1 &&
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
 * with what, and whether the System reads a roll mode imposed on the action's roll from the child's
 * stored execution. A recorded child that has not committed is left out.
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
    if (!command || !receipt) continue
    const { actorId, actionId } = resolveEncounterActionInputDtoSchema.parse(
      JSON.parse(command.commandJson)
    )
    const execution = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
    children.push({
      commandId,
      reactorActorId: actorId,
      actionId,
      imposesRollMode:
        execution.status === 'COMPLETE' && outcomes.imposesRollModeOnTriggeringRoll(execution)
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
